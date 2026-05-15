"""
SLM Gov Hub Placement API — Generic (any GeoJSON polygon)
Run: uvicorn main:app --reload --port 8000
"""
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Any
import random, math, io, os
from datetime import datetime
from typing import List, Optional
from fastapi import FastAPI, HTTPException, UploadFile, File, Form, Response, Depends, Request
import tempfile
import uuid
import shutil
import time
import boto3
import json
from concurrent.futures import ThreadPoolExecutor
import asyncio


# In-memory storage for pending uploads (for demo purposes)
PENDING_UPLOADS = {}

from engines.geo_engine import compute_placement, build_folium_map
from engines.transcription import transcribe_video as transcribe
from engines.aws_pipeline import moderate_with_bedrock, upload_to_s3
from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseUpload
import numpy as np
from sklearn.cluster import KMeans
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer,
    Table, TableStyle, HRFlowable
)

app = FastAPI(title="SLM Hub Placement API", version="1.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"],
    allow_methods=["*"], allow_headers=["*"], allow_credentials=True)


from engines.auth import create_access_token, verify_password, get_current_user_id
from engines.database import get_user_by_username_with_hash

class LoginReq(BaseModel):
    username: str
    password: str

@app.post("/api/auth/login")
def login(req: LoginReq, response: Response):
    user = get_user_by_username_with_hash(req.username)
    if not user or not verify_password(req.password, user.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Incorrect username or password")
    
    token = create_access_token({"sub": str(user["id"])})
    response.set_cookie(
        key="session_token", 
        value=token, 
        httponly=True, 
        secure=False, # Set to True in production with HTTPS
        samesite="lax",
        max_age=60 * 24 * 7 * 60
    )
    return {"status": "success", "message": "Logged in"}

@app.post("/api/auth/logout")
def logout(response: Response):
    response.delete_cookie("session_token")
    return {"status": "success"}

@app.get("/api/auth/me")
def get_me(user_id: int = Depends(get_current_user_id)):
    from engines.database import get_user_masked_by_id
    user = get_user_masked_by_id(user_id)
    if not user:
        raise HTTPException(404, "User not found")
    return user


HUB_COST = {
    "master": {"hardware":38000,"installation":0,"antenna":0,"annual_maintenance":6000},
    "child":  {"hardware": 14500,"installation":0,"antenna":0,"annual_maintenance": 1200},
}
MASTER_REASONS = [
    "Highest elevation in the region — optimal radio line-of-sight to all child hubs within a 10 km radius.",
    "Central geographic position minimises average radio hop distance to all child hubs.",
    "Co-located with existing telco/government tower infrastructure — zero new backhaul cost.",
    "Nearest point to district administrative office — maintenance team access within 15 minutes.",
]
CHILD_REASONS = [
    "Dense student cluster — estimated {n} students within 2 km. Balai Raya identified as host site with power supply.",
    "Coverage gap identified — no cellular signal within 3 km. Elevated ground provides clear LOS to master hub.",
    "Primary school compound available as host — secured premises, 24/7 caretaker, existing electrical supply.",
    "High-density residential area with school-age population. Community centre identified as installation point.",
    "Remote village cluster — serves students with zero alternative connectivity within 5 km.",
    "Existing government building with rooftop clearance available for low-cost antenna mounting.",
]

def extract_ring(g: dict) -> list:
    t = g.get("type","")
    if t == "FeatureCollection": return g["features"][0]["geometry"]["coordinates"][0]
    if t == "Feature": return g["geometry"]["coordinates"][0]
    if t == "Polygon": return g["coordinates"][0]
    raise ValueError(f"Unsupported GeoJSON type: {t}")

def pip(lat, lng, ring) -> bool:
    x,y,inside,j = lng,lat,False,len(ring)-1
    for i in range(len(ring)):
        xi,yi=ring[i]; xj,yj=ring[j]
        if ((yi>y)!=(yj>y)) and (x<(xj-xi)*(y-yi)/(yj-yi)+xi):
            inside=not inside
        j=i
    return inside

def haversine(la1,lo1,la2,lo2):
    R=6371; r=math.radians
    a=math.sin(r(la2-la1)/2)**2+math.cos(r(la1))*math.cos(r(la2))*math.sin(r(lo2-lo1)/2)**2
    return R*2*math.asin(math.sqrt(a))

def gen_points(ring, n=150, seed=42):
    rng=random.Random(seed)
    xs=[c[0] for c in ring]; ys=[c[1] for c in ring]
    mn_x,mx_x,mn_y,mx_y=min(xs),max(xs),min(ys),max(ys)
    pts=[]
    # seed cluster centres inside polygon
    nc=max(4,int(math.sqrt(n)))
    centres=[]; att=0
    while len(centres)<nc and att<5000:
        att+=1
        la=rng.uniform(mn_y,mx_y); lo=rng.uniform(mn_x,mx_x)
        if pip(la,lo,ring): centres.append((la,lo))
    # generate density points around centres
    for cla,clo in centres:
        w=rng.randint(1,5)
        for _ in range(max(2,n//nc*w//3)):
            sp=rng.uniform(0.008,0.05)
            la=cla+rng.gauss(0,sp); lo=clo+rng.gauss(0,sp)
            if pip(la,lo,ring): pts.append([la,lo])
    # fill remainder randomly
    att=0
    while len(pts)<n and att<n*25:
        att+=1
        la=rng.uniform(mn_y,mx_y); lo=rng.uniform(mn_x,mx_x)
        if pip(la,lo,ring): pts.append([la,lo])
    return pts

def kmeans_py(pts,k,seed=42):
    rng=random.Random(seed); centres=rng.sample(pts,k)
    for _ in range(80):
        cl=[[] for _ in range(k)]
        for p in pts:
            d=[haversine(p[0],p[1],c[0],c[1]) for c in centres]
            cl[d.index(min(d))].append(p)
        centres=[[sum(p[i] for p in c)/len(c) if c else centres[j][i]
                  for i in range(2)] for j,c in enumerate(cl)]
    sizes=[len(pts)//k]*k
    return centres,sizes

class PlacementReq(BaseModel):
    geojson: dict[str,Any]
    num_child_hubs: int = 5
    district_name: str = "Target District"
    deployment_mode: str = "regional"

def compute(req: PlacementReq):
    try: ring=extract_ring(req.geojson)
    except Exception as e: raise HTTPException(400,f"Invalid GeoJSON: {e}")
    k=req.num_child_hubs+1
    pts=gen_points(ring)
    if len(pts)<k:
        raise HTTPException(400,
            f"Only {len(pts)} points inside polygon (need {k}). Use a larger area or reduce hubs.")
    arr=np.array(pts)
    km=KMeans(n_clusters=k,random_state=42,n_init=10)
    km.fit(arr)
    centres=km.cluster_centers_.tolist()
    sizes=[int((km.labels_==i).sum()) for i in range(k)]
    # master = most central
    alat=sum(c[0] for c in centres)/k; alng=sum(c[1] for c in centres)/k
    master_i=min(range(k),key=lambda i:haversine(alat,alng,centres[i][0],centres[i][1]))
    rng=random.Random(77); feats=[]; cn=1
    for i,c in enumerate(centres):
        lat,lng=round(c[0],6),round(c[1],6)
        is_m=(i==master_i); ht="master" if is_m else "child"
        hid="MSTR-01" if is_m else f"CHLD-{cn:02d}"
        if not is_m: cn+=1
        if is_m:
            reason=MASTER_REASONS[i%len(MASTER_REASONS)]
        else:
            tmpl=CHILD_REASONS[(i*3)%len(CHILD_REASONS)]
            reason=tmpl.replace("{n}",str(sizes[i]*rng.randint(9,16)))
        cost=HUB_COST[ht]; capex=cost["hardware"]+cost["installation"]+cost["antenna"]
        feats.append({"type":"Feature",
            "geometry":{"type":"Point","coordinates":[lng,lat]},
            "properties":{"id":hid,"type":ht,
                "label":"Master Hub" if is_m else f"Child Hub {cn-1}",
                "lat":lat,"lng":lng,"reason":reason,
                "students_served":sizes[i]*rng.randint(10,18),
                "coverage_km":8.5 if is_m else 3.2,
                "cost_breakdown":cost,"total_capex":capex,
                "annual_opex":cost["annual_maintenance"]}})
    feats.sort(key=lambda f:0 if f["properties"]["type"]=="master" else 1)
    tc=sum(f["properties"]["total_capex"] for f in feats)
    to=sum(f["properties"]["annual_opex"]  for f in feats)
    return {"type":"FeatureCollection","features":feats,
        "metadata":{"district":req.district_name,
            "generated_at":datetime.now().isoformat(),
            "total_hubs":len(feats),"master_hubs":1,"child_hubs":len(feats)-1,
            "density_points":len(pts),"total_capex_myr":tc,"annual_opex_myr":to,
            "sklearn_used":True}}

@app.get("/")
def root(): return {"status":"SLM Hub Placement API running"}

@app.post("/api/placement")
def placement(req: PlacementReq): return compute(req)

@app.post("/api/analyze-hubs")
def analyze_hubs(req: PlacementReq):
    try:
        # Run K-Means analysis
        result = compute_placement(req.geojson, req.num_child_hubs, req.district_name, req.deployment_mode)
        
        # Debug: Print metadata to verify correct values
        print(f"\n=== HUB PLACEMENT RESULT ===")
        print(f"Total Hubs: {result['metadata']['total_hubs']}")
        print(f"Master Hubs: {result['metadata']['master_hubs']}")
        print(f"Child Hubs: {result['metadata']['child_hubs']}")
        print(f"Features count: {len(result['features'])}")
        print(f"============================\n")
        
        # Generate the Folium map
        fmap = build_folium_map(result)
        map_html = fmap.get_root().render()
        
        # Return both the data and the HTML string
        return {
            "data": result,
            "map_html": map_html
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/report")
def report(req: PlacementReq):
    data=compute(req); feats=data["features"]; meta=data["metadata"]
    buf=io.BytesIO()
    doc=SimpleDocTemplate(buf,pagesize=A4,rightMargin=2*cm,leftMargin=2*cm,topMargin=2*cm,bottomMargin=2*cm)
    DG=colors.HexColor("#1a3a2a"); MG=colors.HexColor("#2d6a4f")
    LBG=colors.HexColor("#f0f7f4"); RED=colors.HexColor("#e63946")
    BLU=colors.HexColor("#2196f3"); GRY=colors.HexColor("#888")
    S=getSampleStyleSheet()
    P=lambda n,**kw: ParagraphStyle(n,parent=S["Normal"],**kw)
    tit=P("t",fontSize=20,textColor=DG,spaceAfter=4,fontName="Helvetica-Bold")
    sub=P("s",fontSize=11,textColor=MG,spaceAfter=16)
    sec=P("h",fontSize=13,textColor=DG,spaceBefore=14,spaceAfter=6,fontName="Helvetica-Bold")
    bod=P("b",fontSize=10,textColor=colors.HexColor("#333"),leading=15)
    sml=P("sm",fontSize=9,textColor=GRY,leading=13)
    story=[Paragraph("SOVEREIGN LEARNING MESH",tit),
           Paragraph("Hub Placement Procurement Report — Government Use Only",sub),
           HRFlowable(width="100%",thickness=2,color=MG,spaceAfter=12)]
    sr=[["District",meta["district"]],
        ["Report Date",datetime.now().strftime("%d %B %Y, %H:%M")],
        ["Total Hubs",f"{meta['total_hubs']} ({meta['master_hubs']} Master + {meta['child_hubs']} Child)"],
        ["Total CAPEX",f"RM {meta['total_capex_myr']:,.0f}"],
        ["Annual OPEX",f"RM {meta['annual_opex_myr']:,.0f} / year"],
        ["Algorithm","K-Means (scikit-learn)" if meta["sklearn_used"] else "K-Means (built-in)"]]
    st=Table(sr,colWidths=[5*cm,11*cm])
    st.setStyle(TableStyle([("BACKGROUND",(0,0),(0,-1),LBG),("FONTNAME",(0,0),(0,-1),"Helvetica-Bold"),
        ("TEXTCOLOR",(0,0),(0,-1),DG),("FONTSIZE",(0,0),(-1,-1),10),
        ("GRID",(0,0),(-1,-1),0.5,colors.HexColor("#ccc")),
        ("TOPPADDING",(0,0),(-1,-1),6),("BOTTOMPADDING",(0,0),(-1,-1),6),("LEFTPADDING",(0,0),(-1,-1),10)]))
    story+=[st,Spacer(1,.5*cm)]
    story.append(Paragraph("Hub Placement Coordinates",sec))
    hdr=[["#","Hub ID","Type","Latitude","Longitude","CAPEX (RM)","Students"]]
    br=[[str(i),p["id"],"Master Hub" if p["type"]=="master" else "Child Hub",
         f"{p['lat']:.5f}",f"{p['lng']:.5f}",f"RM {p['total_capex']:,.0f}",str(p["students_served"])]
        for i,f in enumerate(feats,1) for p in [f["properties"]]]
    ht=Table(hdr+br,colWidths=[.8*cm,2.2*cm,2.5*cm,2.5*cm,2.5*cm,2.5*cm,2.5*cm])
    hts=TableStyle([("BACKGROUND",(0,0),(-1,0),DG),("TEXTCOLOR",(0,0),(-1,0),colors.white),
        ("FONTNAME",(0,0),(-1,0),"Helvetica-Bold"),("FONTSIZE",(0,0),(-1,-1),9),
        ("GRID",(0,0),(-1,-1),0.4,colors.HexColor("#ddd")),
        ("ROWBACKGROUNDS",(0,1),(-1,-1),[colors.white,LBG]),
        ("TOPPADDING",(0,0),(-1,-1),5),("BOTTOMPADDING",(0,0),(-1,-1),5),("LEFTPADDING",(0,0),(-1,-1),6)])
    for i,f in enumerate(feats,1):
        hts.add("TEXTCOLOR",(2,i),(2,i),RED if f["properties"]["type"]=="master" else BLU)
    ht.setStyle(hts); story+=[ht,Spacer(1,.5*cm)]
    story.append(Paragraph("Placement Justifications",sec))
    for f in feats:
        p=f["properties"]; hx="e63946" if p["type"]=="master" else "2196f3"
        story.append(Paragraph(f'<font color="#{hx}"><b>{p["label"]} — {p["id"]}</b></font>',bod))
        story.append(Paragraph(f'• {p["reason"]}',bod))
        story.append(Spacer(1,.15*cm))
    story.append(Paragraph("Cost Breakdown per Hub Type",sec))
    cr=[["Item","Master Hub (RM)","Child Hub (RM)"],
        ["Hardware & Compute","38,000","14,500"],
        ["Installation & Civil Works","0","0"],
        ["Antenna","0","0"],
        ["Annual Maintenance","6,000","1,200"],
        ["Total CAPEX per hub","38,000","14,500"]]
    ct=Table(cr,colWidths=[9*cm,3.5*cm,3.5*cm])
    ct.setStyle(TableStyle([("BACKGROUND",(0,0),(-1,0),DG),("TEXTCOLOR",(0,0),(-1,0),colors.white),
        ("FONTNAME",(0,0),(-1,0),"Helvetica-Bold"),("FONTNAME",(0,-1),(-1,-1),"Helvetica-Bold"),
        ("BACKGROUND",(0,-1),(-1,-1),LBG),("FONTSIZE",(0,0),(-1,-1),9),
        ("GRID",(0,0),(-1,-1),0.4,colors.HexColor("#ddd")),
        ("ROWBACKGROUNDS",(0,1),(-1,-2),[colors.white,LBG]),
        ("TOPPADDING",(0,0),(-1,-1),5),("BOTTOMPADDING",(0,0),(-1,-1),5),
        ("LEFTPADDING",(0,0),(-1,-1),8),("ALIGN",(1,0),(2,-1),"RIGHT")]))
    story+=[ct,Spacer(1,.4*cm)]
    story.append(Paragraph(f"<b>Total: RM {meta['total_capex_myr']:,.0f} CAPEX + RM {meta['annual_opex_myr']:,.0f}/year OPEX</b>",bod))
    story+=[Spacer(1,.8*cm),HRFlowable(width="100%",thickness=.5,color=GRY),Spacer(1,.2*cm)]
    story.append(Paragraph("Sovereign Learning Mesh Gov Hub Placement Tool. Coordinates WGS84. On-site verification required before procurement.",sml))
    doc.build(story); buf.seek(0)
    fname=f"SLM_Hubs_{meta['district'].replace(' ','_')}_{datetime.now().strftime('%Y%m%d')}.pdf"
    return StreamingResponse(buf,media_type="application/pdf",
        headers={"Content-Disposition":f'attachment; filename="{fname}"'})

@app.get("/api/sample/{region}")
def sample(region:str="generic"):
    s={"generic":{"type":"FeatureCollection","features":[{"type":"Feature","properties":{"name":"Sample District"},
           "geometry":{"type":"Polygon","coordinates":[[
               [110.20,3.80],[110.90,3.80],[111.20,4.20],[111.00,4.70],
               [110.40,4.80],[109.90,4.40],[110.20,3.80]]]}}]},
       "sarawak":{"type":"FeatureCollection","features":[{"type":"Feature","properties":{"name":"Sarawak Region"},
           "geometry":{"type":"Polygon","coordinates":[[
               [109.65,1.10],[111.10,1.10],[113.20,2.20],[114.20,3.00],
               [114.30,4.60],[113.80,4.70],[112.80,3.50],[111.50,2.80],
               [110.50,2.00],[109.80,1.60],[109.65,1.10]]]}}]},
       "kuching":{"type":"FeatureCollection","features":[{"type":"Feature","properties":{"name":"Kuching Division"},
           "geometry":{"type":"Polygon","coordinates":[[
               [109.80,1.10],[110.60,1.10],[110.80,1.60],[110.50,1.85],
               [110.10,1.80],[109.80,1.50],[109.80,1.10]]]}}]}}
    if region not in s: raise HTTPException(404,f"Unknown region. Options: generic, sarawak, kuching")
    return s[region]

def get_or_create_drive_folder(service, parent_id, folder_name):
    query = f"'{parent_id}' in parents and name='{folder_name}' and mimeType='application/vnd.google-apps.folder' and trashed=false"
    results = service.files().list(q=query, spaces='drive', fields='files(id, name)').execute()
    items = results.get('files', [])
    if items: return items[0]['id']
    meta = {'name': folder_name, 'mimeType': 'application/vnd.google-apps.folder', 'parents': [parent_id]}
    f = service.files().create(body=meta, fields='id').execute()
    return f.get('id')

@app.post("/api/verify-video")
async def verify_video(file: UploadFile = File(...), user_id: int = Depends(get_current_user_id)):
    # Fetch AWS credentials from database using session user_id
    from engines.database import get_user_aws_credentials_by_id
    aws_creds = get_user_aws_credentials_by_id(user_id)
    
    if not aws_creds.get("aws_access_key") or not aws_creds.get("aws_secret_key"):
        raise HTTPException(400, "AWS credentials not configured. Please go to Admin Profile to set them.")
    
    temp_dir = tempfile.mkdtemp()
    temp_file_path = os.path.join(temp_dir, f"{uuid.uuid4()}_{file.filename}")
    
    try:
        with open(temp_file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        # Transcribe — may fail if ffmpeg is missing or file format unsupported
        try:
            transcription_result = transcribe(temp_file_path)
            transcript_text = transcription_result.get("text", "")
        except Exception as te:
            raise HTTPException(status_code=500, detail=f"Transcription failed: {str(te)}. Ensure ffmpeg is installed and the video format is supported (mp4, webm, mkv).")
        
        if not transcript_text or len(transcript_text.strip()) < 10:
            # Whisper produced empty/very short transcript — still allow moderation to handle it
            transcript_text = transcript_text or ""
        
        # Pass AWS credentials to moderation function
        moderation_result = moderate_with_bedrock(transcript_text, aws_creds)
        status = moderation_result.get("status", "Pending")
        
        pending_id = str(uuid.uuid4())
        PENDING_UPLOADS[pending_id] = {
            "path": temp_file_path,
            "filename": file.filename,
            "timestamp": time.time()
        }
        
        return {
            "pending_id": pending_id,
            "status": status,
            "reason": moderation_result.get("reason", ""),
            "confidence": moderation_result.get("confidence", 0),
            "transcript": transcript_text,
            "segments": transcription_result.get("segments", [])
        }
    except HTTPException:
        # Re-raise HTTP exceptions as-is
        if os.path.exists(temp_file_path):
            os.remove(temp_file_path)
        shutil.rmtree(temp_dir, ignore_errors=True)
        raise
    except Exception as e:
        # Cleanup on failure
        if os.path.exists(temp_file_path):
            os.remove(temp_file_path)
        shutil.rmtree(temp_dir, ignore_errors=True)
        raise HTTPException(status_code=500, detail=f"Video verification failed: {str(e)}")
    # We do NOT remove the file here, it's kept until confirm/reject

@app.post("/api/confirm-upload")
async def confirm_upload(
    pending_id: str = Form(...),
    title: str = Form(default=""),
    description: str = Form(default=""),
    user_id: int = Depends(get_current_user_id)
):
    if pending_id not in PENDING_UPLOADS:
        raise HTTPException(404, "Pending upload not found.")
    
    # Fetch AWS credentials from database using session user_id
    from engines.database import get_user_aws_credentials_by_id
    aws_creds = get_user_aws_credentials_by_id(user_id)
    
    if not aws_creds.get("aws_access_key") or not aws_creds.get("aws_secret_key"):
        raise HTTPException(400, "AWS credentials not configured. Please go to Admin Profile to set them.")
    
    data = PENDING_UPLOADS.pop(pending_id)
    # Use provided title or fall back to filename
    video_title = title.strip() if title.strip() else data["filename"]
    video_description = description.strip()

    try:
        # Pass AWS credentials and metadata to S3 upload function
        success = upload_to_s3(
            data["path"], data["filename"], aws_creds,
            metadata={"title": video_title, "description": video_description}
        )
        if not success:
            raise HTTPException(500, "S3 Upload Failed")
        return {"status": "success", "message": "Video uploaded to AWS S3."}
    finally:
        if os.path.exists(data["path"]):
            os.remove(data["path"])
            shutil.rmtree(os.path.dirname(data["path"]), ignore_errors=True)

@app.post("/api/reject-upload")
async def reject_upload(pending_id: str = Form(...)):
    if pending_id not in PENDING_UPLOADS:
        return {"status": "success", "message": "Already cleared."}
    
    data = PENDING_UPLOADS.pop(pending_id)
    if os.path.exists(data["path"]):
        os.remove(data["path"])
        shutil.rmtree(os.path.dirname(data["path"]), ignore_errors=True)
    return {"status": "success", "message": "Video rejected and deleted."}
async def drive_upload(folder_id: str = Form(...), files: List[UploadFile] = File(...)):
    # Normally you would load credentials from a secure path or environment variable.
    cred_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS", "service_account.json")
    if not os.path.exists(cred_path):
        raise HTTPException(500, f"Service account credentials not found at {cred_path}. Please provide valid JSON key.")

    try:
        creds = service_account.Credentials.from_service_account_file(
            cred_path, scopes=['https://www.googleapis.com/auth/drive']
        )
        service = build('drive', 'v3', credentials=creds)

        # Cache folder IDs to avoid redundant API calls
        folder_cache = {}

        for file in files:
            # Check if there is a subfolder in the filename (e.g. textbooks/math.pdf)
            parts = file.filename.split('/')
            target_parent_id = folder_id

            if len(parts) > 1:
                # We need to create/get subfolders
                for part in parts[:-1]:
                    cache_key = f"{target_parent_id}/{part}"
                    if cache_key not in folder_cache:
                        sub_id = get_or_create_drive_folder(service, target_parent_id, part)
                        folder_cache[cache_key] = sub_id
                    target_parent_id = folder_cache[cache_key]
                
                actual_filename = parts[-1]
            else:
                actual_filename = file.filename

            file_metadata = {'name': actual_filename, 'parents': [target_parent_id]}
            content = await file.read()
            media = MediaIoBaseUpload(io.BytesIO(content), mimetype=file.content_type, resumable=True)
            
            service.files().create(body=file_metadata, media_body=media, fields='id').execute()

        return {"status": "success", "message": f"Successfully uploaded {len(files)} files to Drive folder {folder_id}."}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Training Pipeline Endpoints ──────────────────────────

@app.post("/api/v1/training/upload")
async def upload_training_data(files: List[UploadFile] = File(...), user_id: int = Depends(get_current_user_id)):
    """Upload training files to Google Drive with proper folder routing and renaming.
    
    File routing:
    - textbooks/xxx.pdf → SLM_Training/textbooks/xxx.pdf
    - exam_questions/xxx.pdf → SLM_Training/exam_questions/xxx_Q.pdf
    - exam_answers/xxx.pdf → SLM_Training/exam_answers/xxx_A.pdf
    """
    from engines.database import get_user_by_id_decrypted
    u = get_user_by_id_decrypted(user_id)
    
    if not u or not u.get("google_client_email") or not u.get("google_private_key") or not u.get("google_drive_folder_id"):
        raise HTTPException(400, "Google Drive credentials not configured. Go to Admin Profile to set them.")
    
    try:
        from engines.database import normalize_private_key
        info = {
            "type": "service_account",
            "project_id": u.get("google_project_id", ""),
            "private_key": normalize_private_key(u.get("google_private_key", "")),
            "client_email": u.get("google_client_email", ""),
            "token_uri": "https://oauth2.googleapis.com/token",
        }
        creds = service_account.Credentials.from_service_account_info(
            info, scopes=['https://www.googleapis.com/auth/drive']
        )
        service = build('drive', 'v3', credentials=creds)
        folder_id = u.get("google_drive_folder_id")  # This is the SLM_Training folder ID
        
        # Find existing subfolders (don't create — they already exist)
        folder_cache = {}
        for folder_name in ["textbooks", "exam_questions", "exam_answers"]:
            query = f"'{folder_id}' in parents and name='{folder_name}' and mimeType='application/vnd.google-apps.folder' and trashed=false"
            results = service.files().list(q=query, spaces='drive', fields='files(id, name)').execute()
            items = results.get('files', [])
            if items:
                folder_cache[folder_name] = items[0]['id']
            else:
                # Fallback: create if not found
                folder_cache[folder_name] = get_or_create_drive_folder(service, folder_id, folder_name)
        
        uploaded = 0
        
        # Upload files to appropriate folders with renaming
        for file in files:
            parts = file.filename.split('/')
            
            if len(parts) > 1:
                folder_prefix = parts[0]  # "textbooks", "exam_questions", or "exam_answers"
                original_name = parts[-1]
            else:
                # Files without folder prefix go to root
                folder_prefix = ""
                original_name = file.filename

            # Determine target folder and apply renaming
            if folder_prefix == "textbooks" and "textbooks" in folder_cache:
                target_parent_id = folder_cache["textbooks"]
                actual_filename = original_name  # No renaming for textbooks
            elif folder_prefix == "exam_questions" and "exam_questions" in folder_cache:
                target_parent_id = folder_cache["exam_questions"]
                # Rename: xxx.pdf → xxx_Q.pdf
                name_base, ext = os.path.splitext(original_name)
                actual_filename = f"{name_base}_Q{ext}"
            elif folder_prefix == "exam_answers" and "exam_answers" in folder_cache:
                target_parent_id = folder_cache["exam_answers"]
                # Rename: xxx.pdf → xxx_A.pdf
                name_base, ext = os.path.splitext(original_name)
                actual_filename = f"{name_base}_A{ext}"
            else:
                target_parent_id = folder_id
                actual_filename = original_name

            file_metadata = {'name': actual_filename, 'parents': [target_parent_id]}
            content = await file.read()
            media = MediaIoBaseUpload(io.BytesIO(content), mimetype=file.content_type, resumable=True)
            
            service.files().create(body=file_metadata, media_body=media, fields='id').execute()
            uploaded += 1
        
        return {
            "status": "success",
            "files_uploaded": uploaded,
            "folder_id": folder_id,
            "folders": {
                "textbooks": f"https://drive.google.com/drive/folders/{folder_cache.get('textbooks', '')}",
                "exam_questions": f"https://drive.google.com/drive/folders/{folder_cache.get('exam_questions', '')}",
                "exam_answers": f"https://drive.google.com/drive/folders/{folder_cache.get('exam_answers', '')}",
            }
        }
    except Exception as e:
        raise HTTPException(500, f"Google Drive upload failed: {str(e)}")


@app.get("/api/v1/equity/alerts")
async def get_equity_alerts():
    """
    Returns detected educational equity gaps where hub usage is high 
    but unique device connections are low.
    """
    return [
        {
            "hub_id": "SWK-SUB-04",
            "alert_level": "CRITICAL",
            "usage_rate": 0.18,
            "device_ownership_survey": 0.28,
            "recommendation": "KIOSK_DEPLOYMENT",
            "est_cost": 9500
        }
    ]

import base64
from engines.database import (
    get_user, get_user_masked, update_user_profile,
    update_user_credentials, get_user_aws_credentials,
    log_user_action, get_user_actions,
    save_training_job, get_training_jobs
)

# ── User Profile Endpoints ───────────────────────────────

class UserProfileUpdate(BaseModel):
    full_name: str
    role: str
    government_id: str

class UserCredentialsUpdate(BaseModel):
    aws_access_key: str = ""
    aws_secret_key: str = ""
    aws_region: str = "us-east-1"
    bedrock_role_arn: str = ""
    s3_training_bucket: str = "cryptedu-training-data"
    google_client_email: str = ""
    google_private_key: str = ""
    google_project_id: str = ""
    google_drive_folder_id: str = ""
    lambda_url: str = ""
    lambda_api_key: str = ""

@app.get("/api/v1/user/profile")
async def get_profile(user_id: int = Depends(get_current_user_id)):
    """Get current user profile with masked secrets."""
    from engines.database import get_user_masked_by_id
    u = get_user_masked_by_id(user_id)
    if not u:
        raise HTTPException(404, "User not found")
    return u

@app.post("/api/v1/user/profile")
async def save_profile(profile: UserProfileUpdate, user_id: int = Depends(get_current_user_id)):
    """Update user profile (non-sensitive fields)."""
    from engines.database import update_user_profile_by_id
    update_user_profile_by_id(user_id, profile.full_name, profile.role, profile.government_id)
    log_user_action(user_id, "profile_update", {
        "full_name": profile.full_name, "role": profile.role
    }, "admin")
    return {"status": "success", "message": "Profile updated."}

@app.post("/api/v1/user/credentials")
async def save_credentials(creds: UserCredentialsUpdate, user_id: int = Depends(get_current_user_id)):
    """Save AWS and Google credentials — encrypted with Fernet before database storage."""
    from engines.database import update_user_credentials_by_id
    # Decode from Base64 transport encoding (handles UTF-8 via encodeURIComponent)
    import urllib.parse
    def safe_b64_decode(val: str) -> str:
        if not val:
            return ""
        try:
            decoded_bytes = base64.b64decode(val)
            # Reverse the encodeURIComponent encoding
            return urllib.parse.unquote(decoded_bytes.decode('utf-8'))
        except Exception:
            return val  # Already plain text

    try:
        access_key = safe_b64_decode(creds.aws_access_key)
        secret_key = safe_b64_decode(creds.aws_secret_key)
        role_arn = safe_b64_decode(creds.bedrock_role_arn)
        g_email = safe_b64_decode(creds.google_client_email)
        g_key = safe_b64_decode(creds.google_private_key)
        l_api_key = safe_b64_decode(creds.lambda_api_key)
    except Exception:
        # If not base64 encoded, use as-is (for direct API calls)
        access_key = creds.aws_access_key
        secret_key = creds.aws_secret_key
        role_arn = creds.bedrock_role_arn
        g_email = creds.google_client_email
        g_key = creds.google_private_key
        l_api_key = creds.lambda_api_key

    update_user_credentials_by_id(
        user_id, access_key, secret_key,
        creds.aws_region, role_arn, creds.s3_training_bucket,
        g_email, g_key, creds.google_project_id, creds.google_drive_folder_id,
        creds.lambda_url, l_api_key
    )
    log_user_action(user_id, "credentials_update", {
        "aws_region": creds.aws_region,
        "s3_training_bucket": creds.s3_training_bucket,
        "google_project_id": creds.google_project_id,
        "google_drive_folder_id": creds.google_drive_folder_id
    }, "admin")
    return {"status": "success", "message": "Credentials encrypted and saved."}

@app.get("/api/v1/user/credentials/check")
async def check_credentials(user_id: int = Depends(get_current_user_id)):
    """Check if AWS and Google credentials are configured (without revealing them)."""
    from engines.database import get_user_aws_credentials_by_id, get_user_by_id_decrypted
    creds = get_user_aws_credentials_by_id(user_id)
    u = get_user_by_id_decrypted(user_id) or {}

    return {
        "has_aws_access_key": bool(creds.get("aws_access_key")),
        "has_aws_secret_key": bool(creds.get("aws_secret_key")),
        "aws_region": creds.get("aws_region", "us-east-1"),
        "has_role_arn": bool(creds.get("bedrock_role_arn")),
        "s3_training_bucket": creds.get("s3_training_bucket", ""),
        "has_google_email": bool(u.get("google_client_email")),
        "has_google_key": bool(u.get("google_private_key")),
        "google_project_id": u.get("google_project_id", ""),
        "google_drive_folder_id": u.get("google_drive_folder_id", ""),
    }

# Keep backward compatibility with old endpoint
class AWSConfig(BaseModel):
    accessKey: str
    secretKey: str
    region: str

@app.post("/api/v1/config/aws")
async def save_aws_config(config: AWSConfig):
    """Legacy endpoint — redirects to new credential storage."""
    try:
        access_key = base64.b64decode(config.accessKey).decode('utf-8')
        secret_key = base64.b64decode(config.secretKey).decode('utf-8')
        update_user_credentials("admin", access_key, secret_key, config.region)
        return {"status": "success", "message": "AWS credentials updated and encrypted."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ── User Action History ──────────────────────────────────

@app.get("/api/v1/user/actions")
async def get_actions(action_type: str = None, limit: int = 50, user_id: int = Depends(get_current_user_id)):
    """Get user action history (encrypted, user-isolated)."""
    actions = get_user_actions(user_id, action_type, limit)
    return actions

@app.post("/api/v1/user/actions")
async def log_action(action: dict, user_id: int = Depends(get_current_user_id)):
    """Log a user action for history/cache."""
    log_user_action(
        user_id,
        action.get("action_type", "unknown"),
        action.get("data", {}),
        action.get("page", "")
    )
    return {"status": "logged"}


# ── End-User Account Endpoints ───────────────────────────

@app.post("/api/end-users/bulk-create")
async def bulk_create_end_users_endpoint(
    file: UploadFile = File(...),
    user_id: int = Depends(get_current_user_id)
):
    """Parse CSV/Excel and bulk-create end-user accounts."""
    import io
    from engines.database import bulk_create_end_users as db_bulk_create

    content = await file.read()
    filename = file.filename.lower()

    accounts = []

    if filename.endswith('.csv'):
        import csv
        text = content.decode('utf-8-sig')  # handle BOM
        reader = csv.reader(io.StringIO(text))
        for i, row in enumerate(reader):
            if i == 0 and row and row[0].lower() in ('username', 'email', 'user'):
                continue  # skip header
            if len(row) >= 2:
                accounts.append({"username": row[0].strip(), "password": row[1].strip()})
    elif filename.endswith('.xlsx') or filename.endswith('.xls'):
        try:
            import openpyxl
            wb = openpyxl.load_workbook(io.BytesIO(content), read_only=True)
            ws = wb.active
            rows = list(ws.iter_rows(values_only=True))
            start = 0
            if rows and rows[0] and str(rows[0][0]).lower() in ('username', 'email', 'user'):
                start = 1
            for row in rows[start:]:
                if row and len(row) >= 2 and row[0] and row[1]:
                    accounts.append({"username": str(row[0]).strip(), "password": str(row[1]).strip()})
        except ImportError:
            raise HTTPException(400, "openpyxl not installed. Please install it: pip install openpyxl")
    else:
        raise HTTPException(400, "Only .csv and .xlsx files are supported.")

    if not accounts:
        raise HTTPException(400, "No valid accounts found in file. Ensure column 1 = username, column 2 = password.")

    result = db_bulk_create(accounts, user_id)
    return {"status": "success", "accounts_parsed": len(accounts), **result}


@app.get("/api/end-users")
async def list_end_users_endpoint(user_id: int = Depends(get_current_user_id)):
    from engines.database import list_end_users as db_list
    return db_list()


@app.post("/api/end-users/login")
async def end_user_login(req: LoginReq, response: Response):
    """Login endpoint for end_user_app to authenticate against admin-created accounts."""
    from engines.database import get_end_user_by_username
    from engines.auth import verify_password
    user = get_end_user_by_username(req.username)
    if not user or not verify_password(req.password, user.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Incorrect username or password")
    return {
        "status": "success",
        "user": {
            "username": user["username"],
            "full_name": user.get("full_name", ""),
            "role": user.get("role", "student")
        }
    }


# ── AI Tutor Endpoints (Ollama) ──────────────────────────────────────────────

import requests as http_requests

OLLAMA_URL = os.getenv("OLLAMA_URL", "http://127.0.0.1:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "cryptedu-ai")

class AIChatRequest(BaseModel):
    messages: List[dict]
    model: str = ""
    stream: bool = False
    options: Optional[dict] = None

class AIGradeRequest(BaseModel):
    essay_text: str
    subject: str = "Bahasa Malaysia"

class AIQuizRequest(BaseModel):
    prompt: str

@app.post("/api/ai/chat")
async def ai_chat(req: AIChatRequest):
    """Proxy chat request to local Ollama instance."""
    model = req.model or OLLAMA_MODEL
    try:
        resp = http_requests.post(
            f"{OLLAMA_URL}/api/chat",
            json={
                "model": model,
                "messages": req.messages,
                "stream": False,
                "options": req.options or {"temperature": 0.1, "min_p": 0.1},
            },
            timeout=300,
        )
        if resp.status_code != 200:
            raise HTTPException(502, f"Ollama returned {resp.status_code}: {resp.text[:200]}")
        return resp.json()
    except http_requests.exceptions.ConnectionError:
        raise HTTPException(503, "AI service unavailable. Ensure Ollama is running on the server.")
    except http_requests.exceptions.Timeout:
        raise HTTPException(504, "AI service timed out.")

@app.post("/api/ai/grade-essay")
async def ai_grade_essay(req: AIGradeRequest):
    """Grade an essay using Ollama."""
    grading_prompt = f"""You are a KPM essay examiner for {req.subject}. 
Assess this student essay and return ONLY valid JSON in this exact format:
{{"overall": <0-100>, "content": <0-40>, "language": <0-40>, "structure": <0-20>, "feedback": "<2-3 sentences of warm, encouraging feedback in the student's language>"}}
No other text. Only JSON.
Essay: {req.essay_text}"""
    try:
        resp = http_requests.post(
            f"{OLLAMA_URL}/api/chat",
            json={
                "model": OLLAMA_MODEL,
                "messages": [{"role": "user", "content": grading_prompt}],
                "stream": False,
                "options": {"temperature": 0.1, "min_p": 0.1},
            },
            timeout=300,
        )
        if resp.status_code != 200:
            raise HTTPException(502, f"Ollama returned {resp.status_code}")
        return resp.json()
    except http_requests.exceptions.ConnectionError:
        raise HTTPException(503, "AI service unavailable. Ensure Ollama is running on the server.")
    except http_requests.exceptions.Timeout:
        raise HTTPException(504, "AI service timed out.")

@app.post("/api/ai/generate-quiz")
async def ai_generate_quiz(req: AIQuizRequest):
    """Generate quiz questions using Ollama."""
    prompt = f"""You are a certified Malaysian KPM examination question setter.
The student wants to be tested on: "{req.prompt}"
Generate exactly 1 MCQ question with 4 options (A, B, C, D).
Return ONLY a valid JSON array:
[{{"question": "...", "options": ["A", "B", "C", "D"], "correct": 0, "explanation": "..."}}]
The "correct" field is the zero-based index of the correct option."""
    try:
        resp = http_requests.post(
            f"{OLLAMA_URL}/api/chat",
            json={
                "model": OLLAMA_MODEL,
                "messages": [{"role": "user", "content": prompt}],
                "stream": False,
                "options": {"temperature": 0.1, "min_p": 0.1},
            },
            timeout=300,
        )
        if resp.status_code != 200:
            raise HTTPException(502, f"Ollama returned {resp.status_code}")
        return resp.json()
    except http_requests.exceptions.ConnectionError:
        raise HTTPException(503, "AI service unavailable. Ensure Ollama is running on the server.")
    except http_requests.exceptions.Timeout:
        raise HTTPException(504, "AI service timed out.")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

# AWS Lambda handler (via Mangum)
try:
    from mangum import Mangum
    handler = Mangum(app)
except ImportError:
    pass  # Mangum not needed for local development
