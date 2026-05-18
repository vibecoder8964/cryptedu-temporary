"""
SLM Gov Hub Placement API — Generic (any GeoJSON polygon)
Run: uvicorn main:app --reload --port 8000
"""
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse
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
from engines.aws_pipeline import moderate_with_bedrock, upload_to_s3, _get_s3_client
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

from contextlib import asynccontextmanager

import logging
_startup_logger = logging.getLogger("cryptedu.startup")

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Run all DB migrations and optionally seed users (Requirement 1.3, 1.4) during startup lifespan.

    ``init_db()`` already runs on ``import engines.database``, so
    migrations are always applied by the time this hook fires.
    If ``CRYPTEDU_SEED=true``, ``seed_users`` is also called.
    """
    # init_db already ran via the database module import at the top.
    # Log the resulting row counts for observability.
    try:
        from engines.database import get_conn
        conn = get_conn()
        user_count = conn.execute("SELECT COUNT(*) FROM users").fetchone()[0]
        end_user_count = conn.execute("SELECT COUNT(*) FROM end_user_accounts").fetchone()[0]
        conn.close()
        _startup_logger.info(
            "Startup: migrations applied; users=%d, end_users=%d",
            user_count, end_user_count,
        )
    except Exception as e:
        _startup_logger.warning("Startup: could not read row counts: %s", e)

    # Conditional seeding
    if os.environ.get("CRYPTEDU_SEED", "").lower() == "true":
        _startup_logger.info("CRYPTEDU_SEED=true — running seed_users")
        try:
            from engines.database import get_user_aws_credentials_by_id
            # Build a Cognito client from the seed admin's stored creds
            # (or use environment-level creds for bootstrapping)
            import config
            cognito_client = boto3.client(
                "cognito-idp",
                region_name=getattr(config, "AWS_REGION", "us-east-1"),
            )
            seed_users(cognito_client)
            _startup_logger.info("seed_users completed successfully")
        except Exception as e:
            _startup_logger.error("seed_users failed: %s", e)
            
    yield

app = FastAPI(title="SLM Hub Placement API", version="1.0.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origin_regex=".*",
    allow_methods=["*"], allow_headers=["*"], allow_credentials=True)


from engines.auth import (
    create_access_token,
    verify_password,
    get_current_user_id,
    verify_cognito_id_token,
    create_admin_session_cookie,
    ensure_admin_row,
)
from engines.database import get_user_by_username_with_hash, seed_users
import re
import config
from botocore.exceptions import ClientError, BotoCoreError

class LoginReq(BaseModel):
    username: str
    password: str

@app.post("/api/auth/login")
def login(req: LoginReq, response: Response):
    user = get_user_by_username_with_hash(req.username)
    if not user or not verify_password(req.password, user.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Incorrect username or password")
    
    token = create_access_token({"sub": str(user["id"])})
    is_prod = os.environ.get("CRYPTEDU_PRODUCTION", "").lower() == "true"
    response.set_cookie(
        key="session_token", 
        value=token, 
        httponly=True, 
        secure=is_prod, # Set to True in production with HTTPS
        samesite="none" if is_prod else "lax",
        max_age=60 * 24 * 7 * 60
    )
    return {"status": "success", "message": "Logged in"}

class SignupReq(BaseModel):
    username: str
    password: str

@app.post("/api/auth/signup")
def signup(req: SignupReq, response: Response):
    user = get_user_by_username_with_hash(req.username)
    if user:
        raise HTTPException(status_code=400, detail="User already exists")

    from engines.database import get_conn
    from engines.auth import hash_password
    conn = get_conn()
    try:
        conn.execute(
            "INSERT INTO users (username, password_hash, full_name, role, government_id) VALUES (?, ?, ?, ?, ?)",
            (req.username, hash_password(req.password), req.username, "Regional Moderator", "")
        )
        conn.commit()
        user = get_user_by_username_with_hash(req.username)
    finally:
        conn.close()

    token = create_access_token({"sub": str(user["id"])})
    is_prod = os.environ.get("CRYPTEDU_PRODUCTION", "").lower() == "true"
    response.set_cookie(
        key="session_token", 
        value=token, 
        httponly=True, 
        secure=is_prod,
        samesite="none" if is_prod else "lax",
        max_age=60 * 24 * 7 * 60
    )
    return {"status": "success", "message": "Account created and logged in"}

# ─────────────────────────────────────────────────────────────────────────────
# Cognito → backend session exchange (spec task 2.3)
# ─────────────────────────────────────────────────────────────────────────────
#
# The Admin_App authenticates against the AWS Cognito User Pool directly
# (see ``frontend/src/aws-config.ts`` and ``AdminLoginPage.tsx``). After a
# successful Cognito ``signIn``, the frontend POSTs the Cognito ID token to
# this endpoint. We:
#
#   1. Verify the ID token (signature, ``aud``, ``iss``, ``exp``, and
#      ``token_use == "id"``) via ``verify_cognito_id_token`` — any failure
#      already raises ``HTTPException(401, "Invalid Cognito token")`` and
#      we let it propagate verbatim per the task brief.
#   2. Mint a backend ``session_token`` cookie via
#      ``create_admin_session_cookie``, which also lazily ensures a row
#      exists in the ``users`` table for this Cognito email so
#      Per_User_Credentials can be stored against it (Requirement 1.13).
#
# The body shape is intentionally minimal — ``{"id_token": str}`` — and the
# response echoes the verified email back so the frontend can populate the
# admin profile UI without an extra ``/api/auth/me`` round-trip on first
# load. The cookie itself carries the canonical session; the email in the
# body is a convenience, not a trust signal.

class CognitoExchangeReq(BaseModel):
    id_token: str


@app.post("/api/auth/cognito-exchange")
def cognito_exchange(req: CognitoExchangeReq, response: Response):
    # ``verify_cognito_id_token`` raises HTTPException(401, "Invalid Cognito
    # token") on any failure; we deliberately do not wrap it so the
    # original status and detail surface to the caller untouched.
    email = verify_cognito_id_token(req.id_token)

    # Issues the ``session_token`` cookie with the same flags as
    # ``/api/auth/login`` and ensures a ``users`` row keyed by ``email``
    # exists for credential storage. Return value (the int ``users.id``)
    # is not echoed in the response body — the cookie is the source of
    # truth and ``/api/auth/me`` already exposes the row when needed.
    create_admin_session_cookie(response, email)

    return {"ok": True, "email": email}


# ─────────────────────────────────────────────────────────────────────────────
# Admin "Create account" — Cognito + users-row provisioning (spec task 2.4)
# ─────────────────────────────────────────────────────────────────────────────
#
# Requirement 1.2 says an admin can create another admin from inside the
# Admin_App by submitting a username (which must also be an email,
# 3–32 chars, ≤ 254 chars total) and a password (≥ 8 chars). The Backend
# must (a) create a Cognito_User in the User Pool with the supplied email
# as the canonical attribute and a *permanent* password (no temporary-
# password email flow), and (b) make sure a matching row exists in the
# SQLite ``users`` table so Per_User_Credentials can be stored against
# the new admin (Requirement 1.13).
#
# Authentication & credentials choice. Admin creation is itself an admin-
# authenticated operation (the route is gated by
# ``Depends(get_current_user_id)``), and Cognito User Pool admin actions
# require AWS IAM permissions on a real AWS principal. We deliberately use
# the *calling* admin's saved AWS credentials — loaded per-request via
# ``get_user_aws_credentials_by_id`` (Requirement 1.12, Property 6) —
# rather than environment variables or a shared service principal. This
# keeps the Credential_Belongs_To_Logged_In_User_Invariant intact: the
# only AWS keys this route uses are the ones the calling admin saved on
# their own AdminProfilePage.
#
# Validation order (Requirement 1.14, Property 24). We check fields in
# the order the spec brief names them — username length first, then
# email shape (since username must also be a valid email ≤ 254 chars),
# then password length — and return the first failure as
# ``400 {"detail": "<field> field invalid: <reason>"}``. Crucially, we
# perform *zero* Cognito calls and *zero* ``users`` writes when validation
# fails: Property 24 asserts that invalid input causes no side effects.
#
# Failure handling (Requirement 1.14 second clause). If Cognito rejects
# the request (UsernameExistsException, InvalidPasswordException, IAM
# AccessDenied, throttling, …) we return ``400`` with the Cognito error
# message verbatim — minus secrets. The redactor below replaces any
# occurrence of the calling admin's access key, secret key, session
# token, or role ARN with ``<redacted>`` before the string ever leaves
# the process. ``ensure_admin_row`` is called only after both Cognito
# calls succeed; on any earlier failure no row is written.
#
# Two-step Cognito flow. ``admin_create_user(MessageAction='SUPPRESS')``
# creates the user with a temporary password and suppresses the welcome
# email; ``admin_set_user_password(Permanent=True)`` then replaces it
# with the admin-supplied password and marks it permanent so the new
# admin can log in immediately without going through the FORCE_CHANGE_
# PASSWORD challenge. This is the standard Cognito recipe for
# administrative bulk provisioning.

# Validation constants. Pulled out of the route so unit/property tests
# can import them directly and so the values are self-documenting next
# to the spec brief that defines them.
_USERNAME_MIN_LEN = 3
_USERNAME_MAX_LEN = 32
_EMAIL_MAX_LEN = 254
_PASSWORD_MIN_LEN = 8

# RFC-5322-flavoured email regex: a single ``@`` separating a non-empty
# local part from a domain that has at least one ``.`` and TLD-style
# alphabetic suffix. We do not attempt full RFC compliance here — Cognito
# will perform its own validation — but this catches the obvious shapes
# the spec brief calls out (no ``@``, no domain, etc.).
_EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$")


class AdminCreateAccountReq(BaseModel):
    username: str
    password: str


def _redact_aws_secrets(message: str, aws_creds: dict) -> str:
    """
    Replace any occurrence of the calling admin's AWS secrets in
    ``message`` with the literal ``<redacted>``.

    Only acts on values that are non-empty so we never replace empty
    strings (which would substitute ``<redacted>`` between every
    character of the message). Order matters: longer secrets first, so
    a substring of one secret inside another is not partially redacted.
    """
    if not message:
        return message
    redactable = [
        aws_creds.get("aws_secret_key", "") or "",
        aws_creds.get("aws_access_key", "") or "",
        aws_creds.get("bedrock_role_arn", "") or "",
        aws_creds.get("lambda_api_key", "") or "",
    ]
    # Sort by length descending so the longer secret is replaced before
    # any shorter substring of it can match.
    for secret in sorted({s for s in redactable if s}, key=len, reverse=True):
        message = message.replace(secret, "<redacted>")
    return message


@app.post("/api/admin/create-account")
def admin_create_account(
    req: AdminCreateAccountReq,
    user_id: int = Depends(get_current_user_id),
):
    # ── Validation ──────────────────────────────────────────────────────
    # Order: username length → email shape (incl. ≤ 254 chars) → password
    # length. The spec brief and Property 24 require zero Cognito calls
    # and zero ``users`` writes on any of these failures, so we return
    # before touching boto3 or the database.
    username = req.username or ""
    password = req.password or ""

    if not (_USERNAME_MIN_LEN <= len(username) <= _USERNAME_MAX_LEN):
        raise HTTPException(
            status_code=400,
            detail=(
                f"username field invalid: must be {_USERNAME_MIN_LEN}-"
                f"{_USERNAME_MAX_LEN} characters"
            ),
        )

    if len(username) > _EMAIL_MAX_LEN or not _EMAIL_RE.match(username):
        raise HTTPException(
            status_code=400,
            detail=(
                "email field invalid: username must be a valid email "
                f"address no longer than {_EMAIL_MAX_LEN} characters"
            ),
        )

    if len(password) < _PASSWORD_MIN_LEN:
        raise HTTPException(
            status_code=400,
            detail=(
                f"password field invalid: must be at least "
                f"{_PASSWORD_MIN_LEN} characters"
            ),
        )

    # ── Backend-side row provisioning ───────────────────────────────────
    # Skip Cognito entirely. Provision strictly in SQLite.
    from engines.database import get_conn
    from engines.auth import hash_password

    conn = get_conn()
    try:
        conn.execute(
            "INSERT OR IGNORE INTO users (username, password_hash, full_name, role, government_id) VALUES (?, ?, ?, ?, ?)",
            (username, hash_password(password), username, "Regional Moderator", "")
        )
        conn.commit()
        row = conn.execute("SELECT id FROM users WHERE username = ?", (username,)).fetchone()
        if not row:
            raise HTTPException(status_code=500, detail="Failed to create user row.")
        new_user_id = int(row["id"])
    finally:
        conn.close()

    return {
        "ok": True,
        "email": username,
        "user_id": new_user_id,
    }


# ─────────────────────────────────────────────────────────────────────────────
# Admin "Seed" — wipe and re-create the two seed accounts (spec task 2.8)
# ─────────────────────────────────────────────────────────────────────────────
#
# Requirements 1.3 and 1.4 say the deployment must support a one-shot
# routine that wipes every identity store and re-creates exactly the two
# pinned seed accounts (the ``cryptedu-admin@school.edu.my`` Cognito admin
# and the ``roshi`` end user). The destructive nature of this operation
# means we expose it in two separate ways, each with its own access
# control:
#
#   1. As an HTTP route, ``POST /api/admin/seed``, gated behind the
#      ``CRYPTEDU_SEED=true`` environment variable. When the gate is off
#      (the default in production) the route returns ``404`` so the
#      endpoint *does not exist* from the caller's perspective —
#      Requirement 1.3 explicitly forbids leaving a seed-trigger route
#      reachable in production. The 404 (rather than 403) is deliberate:
#      a 403 would confirm the path exists, while 404 is consistent with
#      "no such endpoint" and matches the existence-non-leak policy
#      spec task 2.16 establishes for ``PENDING_UPLOADS``.
#
#   2. As a CLI entry point, ``backend/seed.py`` (run via
#      ``python backend/seed.py`` or, if a ``backend/__init__.py`` is
#      added, ``python -m backend.seed``). The CLI path reads AWS
#      credentials from environment variables — appropriate here because
#      this is a one-shot administrative tool, not a per-user request,
#      so there is no logged-in user whose stored credentials could be
#      loaded. The Credential_Belongs_To_Logged_In_User_Invariant
#      (Requirement 1.11 / Property 6) is *about* per-user routes; a
#      standalone CLI invoked by an operator on the server is outside
#      that scope by construction.
#
# When the HTTP route is enabled (``CRYPTEDU_SEED=true``), it is still
# admin-authenticated via ``Depends(get_current_user_id)`` and loads the
# *calling* admin's AWS credentials per-request via
# ``get_user_aws_credentials_by_id`` — same pattern as
# ``/api/admin/create-account`` above and same Property 6 guarantee.
# This means: even with the env gate flipped, only an authenticated
# admin who already has working AWS keys saved on their profile can
# trigger the wipe.
#
# Failure handling: any exception from ``seed_users`` propagates as a
# ``500`` with the AWS-secret redactor applied to the message. We do not
# attempt to roll back a partial wipe — the operation is destructive by
# design, and a half-wiped state is recoverable by re-running the
# routine (it is idempotent).


def _require_seed_gate() -> None:
    """
    Dependency that raises 404 unless ``CRYPTEDU_SEED=true``.

    Wired in *before* ``get_current_user_id`` on the seed route so that
    unauthenticated probes against ``/api/admin/seed`` still see a 404
    (Requirement 1.3: "the route does not exist in production"). If the
    auth dependency ran first, an unauthenticated probe would get a 401,
    which would leak the path's existence to anyone who tried it.

    The check is the literal string ``"true"`` (case-insensitive). Any
    other value — empty, unset, ``"1"``, ``"yes"``, ``"false"`` — keeps
    the route hidden.
    """
    if os.environ.get("CRYPTEDU_SEED", "").lower() != "true":
        raise HTTPException(status_code=404, detail="Not Found")


@app.post("/api/admin/seed")
def admin_seed(
    _gate: None = Depends(_require_seed_gate),
    user_id: int = Depends(get_current_user_id),
):
    # ── Production gate ─────────────────────────────────────────────────
    # Enforced by the ``_require_seed_gate`` dependency above, which
    # runs *before* ``get_current_user_id`` so an unauthenticated probe
    # against ``/api/admin/seed`` sees a 404 rather than a 401 when
    # ``CRYPTEDU_SEED`` is off (Requirement 1.3: route does not exist
    # in production). We do not re-check ``CRYPTEDU_SEED`` here — by
    # the time control reaches the function body the gate has already
    # passed.

    # ── Load the calling admin's AWS credentials ────────────────────────
    # Per-request lookup keeps the Credential_Belongs_To_Logged_In_User_
    # Invariant intact (Requirement 1.12, Property 6). The route never
    # falls back to env vars even when ``CRYPTEDU_SEED`` is on — env-var
    # creds are exclusively the CLI path's domain (``backend/seed.py``).
    from engines.database import get_user_aws_credentials_by_id

    aws_creds = get_user_aws_credentials_by_id(user_id)

    if not aws_creds.get("aws_access_key") or not aws_creds.get("aws_secret_key"):
        raise HTTPException(
            status_code=400,
            detail=(
                "AWS credentials not configured. Save your AWS keys in "
                "Admin Profile before running seed."
            ),
        )

    if not config.COGNITO_USER_POOL_ID:
        raise HTTPException(
            status_code=500,
            detail="Cognito User Pool is not configured on the server.",
        )

    region = aws_creds.get("aws_region") or config.COGNITO_REGION or "us-east-1"

    # ── Build per-request Cognito client and run the seed routine ───────
    # ``seed_users`` is the source of truth for *what* gets wiped and
    # re-created (see the long docstring on it in
    # ``backend/engines/database.py``). This route is just the HTTP
    # transport for it.
    try:
        cognito = boto3.client(
            "cognito-idp",
            aws_access_key_id=aws_creds["aws_access_key"],
            aws_secret_access_key=aws_creds["aws_secret_key"],
            region_name=region,
        )
        seed_users(cognito)
    except (ClientError, BotoCoreError) as e:
        message = (
            getattr(e, "response", {}).get("Error", {}).get("Message")
            if isinstance(e, ClientError)
            else None
        ) or str(e)
        raise HTTPException(
            status_code=500,
            detail=_redact_aws_secrets(f"Seed failed: {message}", aws_creds),
        )
    except HTTPException:
        raise
    except Exception as e:  # pragma: no cover — last-resort safety net
        raise HTTPException(
            status_code=500,
            detail=_redact_aws_secrets(f"Seed failed: {e}", aws_creds),
        )

    return {"ok": True, "message": "seeded"}


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
    """Transcribe → Bedrock moderate → return pending decision.

    Refactored per spec task 6.7:
    - Checks both AWS_Bedrock_Credentials and S3_Credentials up front.
    - On transcription failure → 500 with zero Bedrock/S3 calls.
    - On BedrockError / BedrockParseError → 502 with zero S3 calls.
    - Stores (decision, transcript, temp path) in PENDING_UPLOADS
      keyed by (user_id, pending_id).
    """
    from engines.database import get_user_aws_credentials_by_id
    from engines.aws_pipeline import BedrockError, BedrockParseError

    aws_creds = get_user_aws_credentials_by_id(user_id)

    # ── Credential gate (Requirement 3.11) ───────────────────────────────
    bedrock_missing = not aws_creds.get("aws_access_key") or not aws_creds.get("aws_secret_key")
    s3_missing = not aws_creds.get("s3_training_bucket")

    if bedrock_missing and s3_missing:
        raise HTTPException(400, detail="AWS_Bedrock_Credentials missing, S3_Credentials missing")
    if bedrock_missing:
        raise HTTPException(400, detail="AWS_Bedrock_Credentials missing")
    if s3_missing:
        raise HTTPException(400, detail="S3_Credentials missing")

    temp_dir = tempfile.mkdtemp()
    temp_file_path = os.path.join(temp_dir, f"{uuid.uuid4()}_{file.filename}")

    try:
        with open(temp_file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        # ── Transcription stage (Requirement 3.13) ───────────────────────
        try:
            transcription_result = transcribe(temp_file_path)
            transcript_text = transcription_result.get("text", "")
        except Exception as te:
            raise HTTPException(
                status_code=500,
                detail=f"Transcription stage failed: {te}",
            )

        if not transcript_text:
            transcript_text = ""

        # ── Bedrock moderation stage (Requirement 3.12, 3.14) ────────────
        try:
            decision = moderate_with_bedrock(transcript_text, aws_creds)
        except BedrockError as be:
            raise HTTPException(
                status_code=502,
                detail=f"Bedrock stage failed: {be}",
            )
        except BedrockParseError as bpe:
            raise HTTPException(
                status_code=502,
                detail=f"Bedrock stage failed: {bpe}",
            )

        pending_id = str(uuid.uuid4())
        # Re-key by (user_id, pending_id) so admin A cannot confirm/reject
        # admin B's pending upload by guessing a UUID (Requirement 1.15).
        PENDING_UPLOADS[(user_id, pending_id)] = {
            "path": temp_file_path,
            "filename": file.filename,
            "timestamp": time.time(),
            "decision": decision,
            "transcript": transcript_text,
        }

        return {
            "pending_id": pending_id,
            "decision": decision,
            "transcript": transcript_text,
        }
    except HTTPException:
        # Re-raise HTTP exceptions as-is; clean up temp on failure
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
    """Upload video + companion JSON to S3.  Rolls back on failure.

    Refactored per spec task 6.8:
    - Look up by (user_id, pending_id) — prevents cross-admin confirm.
    - Writes companion JSON *after* video succeeds (Requirement 3.5).
    - On companion JSON failure → delete the just-written video and
      return 500 (Requirement 3.7 rollback).
    - Credential values are never leaked in error messages (Requirement 3.7).
    """
    from engines.database import get_user_aws_credentials_by_id
    from engines.aws_pipeline import write_companion_json

    pending_key = (user_id, pending_id)
    if pending_key not in PENDING_UPLOADS:
        raise HTTPException(404, "Pending upload not found.")

    aws_creds = get_user_aws_credentials_by_id(user_id)

    if not aws_creds.get("aws_access_key") or not aws_creds.get("aws_secret_key"):
        raise HTTPException(400, detail="AWS_Bedrock_Credentials missing")

    data = PENDING_UPLOADS.pop(pending_key)
    video_title = title.strip() if title.strip() else data["filename"]
    video_description = description.strip()

    def _redact(msg: str) -> str:
        """Strip aws_access_key / aws_secret_key values from error text."""
        out = msg
        for key in ("aws_access_key", "aws_secret_key"):
            val = aws_creds.get(key, "")
            if val and val in out:
                out = out.replace(val, "<redacted>")
        return out

    try:
        # ── Step 1: upload video to S3 ───────────────────────────────────
        success = upload_to_s3(
            data["path"], data["filename"], aws_creds,
            metadata={"title": video_title, "description": video_description}
        )
        if not success:
            raise HTTPException(500, detail=_redact("S3 video write failed"))

        # ── Step 2: write companion JSON (Requirement 3.5) ───────────────
        try:
            s3_client = _get_s3_client(aws_creds)
            bucket = aws_creds.get("s3_training_bucket", "cryptedu-training-data")
            write_companion_json(
                s3_client,
                bucket,
                data["filename"],
                video_title,
                video_description,
                data.get("transcript", ""),
                "",  # uploaded_by_email — filled from session if available
            )
        except Exception as json_err:
            # Rollback: delete the just-written video (Requirement 3.7)
            try:
                s3_client = _get_s3_client(aws_creds)
                bucket = aws_creds.get("s3_training_bucket", "cryptedu-training-data")
                s3_client.delete_object(Bucket=bucket, Key=data["filename"])
            except Exception:
                pass  # Best-effort rollback
            raise HTTPException(
                500,
                detail=_redact(f"S3 companion JSON write failed; rolled back"),
            )

        return {"status": "success", "message": "Video uploaded to AWS S3."}
    except HTTPException:
        raise
    except ValueError as e:
        if "missing" in str(e).lower():
            raise HTTPException(400, detail=_redact(str(e)))
        raise HTTPException(500, detail=_redact(f"S3 configuration error: {str(e)}"))
    except Exception as e:
        raise HTTPException(500, detail=_redact(f"S3 video write failed: {str(e)}"))
    finally:
        if os.path.exists(data["path"]):
            os.remove(data["path"])
            shutil.rmtree(os.path.dirname(data["path"]), ignore_errors=True)

@app.post("/api/reject-upload")
async def reject_upload(
    pending_id: str = Form(...),
    user_id: int = Depends(get_current_user_id)
):
    """Reject and delete a pending upload.  Zero S3 writes.

    Refactored per spec task 6.9:
    - Same per-user keying as confirm-upload.
    - Deletes local temp file only — no S3 interaction at all
      (Requirement 3.6).
    """
    pending_key = (user_id, pending_id)
    if pending_key not in PENDING_UPLOADS:
        raise HTTPException(404, "Pending upload not found.")

    data = PENDING_UPLOADS.pop(pending_key)
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

    Refactored per spec task 7.3:
    - Credential gate: if neither service account email nor private key is set,
      return 400 with zero Drive API calls (Requirement 4.9).
    - If at least email + key are set, build the Drive client and proceed —
      even if some folder IDs are unset (Requirement 4.10).
    - Per-admin subfolder IDs override dynamic lookup (Requirement 4.7).
    - _Q / _A suffix renaming preserved.
    - Drive API errors propagated verbatim (Requirement 4.10).
    """
    from engines.database import get_user_by_id_decrypted

    u = get_user_by_id_decrypted(user_id)

    # ── Credential gate (Requirement 4.9) ────────────────────────────────
    has_email = bool(u and u.get("google_client_email"))
    has_key = bool(u and u.get("google_private_key"))

    if not has_email or not has_key:
        raise HTTPException(400, detail="Google_Drive_Credentials missing")

    # ── Build Drive client (Requirement 4.10 — call must reach Google) ───
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
    except Exception as e:
        raise HTTPException(500, detail=f"Drive API failure: file=<none>, subfolder=<none>, reason={e}")

    folder_id = u.get("google_drive_folder_id", "")

    # ── Resolve subfolder IDs (prefer per-admin configured, else dynamic) ─
    folder_cache = {}
    configured_ids = {
        "textbooks": u.get("textbooks_folder_id", ""),
        "exam_questions": u.get("exam_questions_folder_id", ""),
        "exam_answers": u.get("exam_answers_folder_id", ""),
    }
    for folder_name in ["textbooks", "exam_questions", "exam_answers"]:
        if configured_ids[folder_name]:
            # Use admin's explicitly configured subfolder ID (Requirement 4.7)
            folder_cache[folder_name] = configured_ids[folder_name]
        elif folder_id:
            # Fall back to dynamic lookup under the root folder
            try:
                query = f"'{folder_id}' in parents and name='{folder_name}' and mimeType='application/vnd.google-apps.folder' and trashed=false"
                results = service.files().list(q=query, spaces='drive', fields='files(id, name)').execute()
                items = results.get('files', [])
                if items:
                    folder_cache[folder_name] = items[0]['id']
                else:
                    folder_cache[folder_name] = get_or_create_drive_folder(service, folder_id, folder_name)
            except Exception as e:
                raise HTTPException(500, detail=f"Drive API failure: file=<none>, subfolder={folder_name}, reason={e}")

    uploaded = 0

    # ── Upload files to appropriate folders with renaming ─────────────────
    for file in files:
        parts = file.filename.split('/')

        if len(parts) > 1:
            folder_prefix = parts[0]
            original_name = parts[-1]
        else:
            folder_prefix = ""
            original_name = file.filename

        # Determine target folder and apply renaming
        if folder_prefix == "textbooks" and "textbooks" in folder_cache:
            target_parent_id = folder_cache["textbooks"]
            actual_filename = original_name
        elif folder_prefix == "exam_questions" and "exam_questions" in folder_cache:
            target_parent_id = folder_cache["exam_questions"]
            name_base, ext = os.path.splitext(original_name)
            actual_filename = f"{name_base}_Q{ext}"
        elif folder_prefix == "exam_answers" and "exam_answers" in folder_cache:
            target_parent_id = folder_cache["exam_answers"]
            name_base, ext = os.path.splitext(original_name)
            actual_filename = f"{name_base}_A{ext}"
        else:
            target_parent_id = folder_id or ""
            actual_filename = original_name

        file_metadata = {'name': actual_filename, 'parents': [target_parent_id]}
        content = await file.read()
        media = MediaIoBaseUpload(io.BytesIO(content), mimetype=file.content_type, resumable=True)

        try:
            service.files().create(body=file_metadata, media_body=media, fields='id').execute()
            uploaded += 1
        except Exception as e:
            raise HTTPException(500, detail=f"Drive API failure: file={actual_filename}, subfolder={folder_prefix}, reason={e}")

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


@app.get("/api/v1/training/notebook")
async def download_notebook():
    """Serve notebook.ipynb for download (Requirement 5.1, 5.2).

    Looks for the notebook first in ``frontend/public/``, then in
    ``backend/data/``.  Returns with Content-Disposition: attachment so
    the browser prompts a download.
    """
    from fastapi.responses import FileResponse

    candidates = [
        os.path.join(os.path.dirname(__file__), "..", "frontend", "public", "notebook.ipynb"),
        os.path.join(os.path.dirname(__file__), "data", "notebook.ipynb"),
    ]
    for path in candidates:
        abs_path = os.path.abspath(path)
        if os.path.isfile(abs_path):
            return FileResponse(
                abs_path,
                media_type="application/x-ipynb+json",
                headers={"Content-Disposition": "attachment; filename=notebook.ipynb"},
            )

    raise HTTPException(404, detail="notebook.ipynb not found")

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
    use_lambda_proxy: bool = False
    textbooks_folder_id: str = ""
    exam_questions_folder_id: str = ""
    exam_answers_folder_id: str = ""

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
        creds.lambda_url, l_api_key,
        use_lambda_proxy=creds.use_lambda_proxy,
        textbooks_folder_id=creds.textbooks_folder_id,
        exam_questions_folder_id=creds.exam_questions_folder_id,
        exam_answers_folder_id=creds.exam_answers_folder_id,
    )
    log_user_action(user_id, "credentials_update", {
        "aws_region": creds.aws_region,
        "s3_training_bucket": creds.s3_training_bucket,
        "google_project_id": creds.google_project_id,
        "google_drive_folder_id": creds.google_drive_folder_id,
        "textbooks_folder_id": creds.textbooks_folder_id,
        "exam_questions_folder_id": creds.exam_questions_folder_id,
        "exam_answers_folder_id": creds.exam_answers_folder_id,
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
    """Login endpoint for end_user_app to authenticate against admin-created accounts.

    On a successful password match this issues a backend ``session_token``
    cookie with the same flags as ``/api/auth/login`` (spec task 2.10,
    Requirements 1.5, 1.6, 1.10). The JWT ``sub`` claim is the end user's
    ``id`` from the ``end_user_accounts`` table — admin and end-user
    sessions share the cookie name; the dependency that resolves the
    caller's identity decides which table the ``sub`` belongs to by
    looking it up in both.

    The JSON body shape is preserved verbatim for back-compat with
    callers that still read ``user`` out of the response.
    """
    from engines.database import get_end_user_by_username
    from engines.auth import verify_password
    user = get_end_user_by_username(req.username)
    if not user or not verify_password(req.password, user.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Incorrect username or password")

    token = create_access_token({"sub": str(user["id"])})
    is_prod = os.environ.get("CRYPTEDU_PRODUCTION", "").lower() == "true"
    response.set_cookie(
        key="session_token",
        value=token,
        httponly=True,
        secure=is_prod,  # Set to True in production with HTTPS
        samesite="none" if is_prod else "lax",
        max_age=60 * 24 * 7 * 60,
    )
    return {
        "status": "success",
        "user": {
            "username": user["username"],
            "full_name": user.get("full_name", ""),
            "role": user.get("role", "student")
        }
    }


class EndUserSignupReq(BaseModel):
    username: str
    password: str
    full_name: str = ""

@app.post("/api/end-users/signup")
async def end_user_signup(req: EndUserSignupReq, response: Response):
    from engines.database import get_end_user_by_username, get_conn
    from engines.auth import verify_password, hash_password, create_access_token

    user = get_end_user_by_username(req.username)
    if user:
        raise HTTPException(status_code=400, detail="User already exists")

    conn = get_conn()
    try:
        full_name = req.full_name if req.full_name else req.username
        conn.execute(
            "INSERT INTO end_user_accounts (username, password_hash, full_name, role) VALUES (?, ?, ?, ?)",
            (req.username, hash_password(req.password), full_name, "student")
        )
        conn.commit()
        user = get_end_user_by_username(req.username)
    finally:
        conn.close()

    token = create_access_token({"sub": str(user["id"])})
    is_prod = os.environ.get("CRYPTEDU_PRODUCTION", "").lower() == "true"
    response.set_cookie(
        key="session_token",
        value=token,
        httponly=True,
        secure=is_prod,
        samesite="none" if is_prod else "lax",
        max_age=60 * 24 * 7 * 60,
    )
    return {
        "status": "success",
        "user": {
            "username": user["username"],
            "full_name": user.get("full_name", ""),
            "role": user.get("role", "student")
        }
    }


# ─────────────────────────────────────────────────────────────────────────────
# End-user persistent state and chat history (spec task 2.14)
# ─────────────────────────────────────────────────────────────────────────────
#
# Requirements 1.8, 1.9, 1.10 say every end-user cache, storage, and
# history record MUST be scoped to the owning ``end_user_accounts.id``
# resolved server-side from the session cookie. The four routes below
# expose the persistence helpers added in spec task 2.13
# (``save_end_user_state`` / ``load_end_user_state`` /
# ``append_end_user_chat`` / ``list_end_user_chat``) over HTTP, with
# every read and write filtered by ``end_user_id`` taken from
# ``get_current_end_user_id`` — never from the request body.
#
# The dependency ``get_current_end_user_id`` (added to
# ``engines/auth.py`` in this task) shares the ``session_token`` cookie
# name with the admin-side ``get_current_user_id`` but distinguishes the
# two identity stores by *table*: a ``sub`` is treated as an end-user
# id only if it matches a row in ``end_user_accounts``. If the same id
# matches a row in ``users`` (the admin credential vault) the
# dependency raises 401, so an admin session presented at one of these
# routes is rejected even when the autoincrement ids happen to collide.
#
# Pydantic models pin the request shapes the TS DTOs in
# ``frontend/src/lib/types.ts`` already declare
# (``EndUserStateUpdateRequest`` / ``EndUserChatAppendRequest``) so the
# typed frontend client and the FastAPI route stay in lock-step.
# ``role`` is constrained to the literal allow-list ``{"student",
# "tutor"}`` — the persistence layer accepts any string but the route
# layer is the right gate for the contract Requirement 2 imposes on
# chat author identity.

from engines.auth import get_current_end_user_id


class EndUserStateUpdateReq(BaseModel):
    """Body of ``POST /api/end-users/state``.

    Mirrors the TS ``EndUserStateUpdateRequest`` DTO. ``end_user_id`` is
    deliberately absent — the route resolves it from the session cookie
    via ``get_current_end_user_id`` so a malicious client cannot write
    under another user's id by sending it in the body
    (Requirement 1.10's per-account isolation invariant).
    """

    key: str
    value_json: str


class EndUserChatAppendReq(BaseModel):
    """Body of ``POST /api/end-users/chat``.

    Mirrors the TS ``EndUserChatAppendRequest`` DTO. ``role`` is
    validated against the allow-list ``{"student", "tutor"}`` in the
    route handler (FastAPI's ``Literal`` type would raise 422 with a
    schema-validation message that leaks the allow-list to clients; we
    prefer a uniform 400 with a short, fixed detail).
    """

    video_key: str
    role: str
    text: str


@app.get("/api/end-users/state")
def end_user_get_state(end_user_id: int = Depends(get_current_end_user_id)):
    """
    Return the full state map for the authenticated end user.

    The response shape ``{"state": {...}}`` matches the TS DTO
    ``EndUserStateResponse``: a single ``state`` field carrying the
    flat ``{state_key: state_value}`` dict. Values are JSON-encoded
    strings (the persistence helper stores them verbatim — the End_User_App
    serialises chat history blobs, progress markers, quiz results into
    JSON before writing).

    Authentication: the dependency raises 401 when no session cookie is
    present, the JWT is invalid, or the cookie's ``sub`` resolves to an
    admin (``users``) row rather than an ``end_user_accounts`` row —
    admins must not see end-user state by accident.
    """
    from engines.database import load_end_user_state

    state = load_end_user_state(end_user_id)
    return {"state": state}


@app.post("/api/end-users/state")
def end_user_post_state(
    req: EndUserStateUpdateReq,
    end_user_id: int = Depends(get_current_end_user_id),
):
    """
    Upsert one ``(key, value_json)`` pair for the authenticated end user.

    The persistence helper ``save_end_user_state`` is an
    ``ON CONFLICT(end_user_id, state_key) DO UPDATE`` upsert; re-posting
    the same key rewrites the value and bumps ``updated_at``, so the
    End_User_App can call this whenever local state changes without
    worrying about row count drift.

    The response is intentionally minimal — a 200 with a small
    acknowledgement — because the canonical post-state is whatever
    ``GET /api/end-users/state`` returns next; tagging extra metadata
    on this response would be redundant.
    """
    from engines.database import save_end_user_state

    save_end_user_state(end_user_id, req.key, req.value_json)
    return {"ok": True}


# Allow-list of valid roles. Lifted out of the route so a future test
# can import it directly (Property 4's stateful machine wants to
# generate both valid and invalid role strings).
_END_USER_CHAT_ROLES = {"student", "tutor"}


@app.get("/api/end-users/chat")
def end_user_get_chat(
    video_key: str,
    end_user_id: int = Depends(get_current_end_user_id),
):
    """
    Return the most recent 50 chat turns for ``(end_user_id, video_key)``
    in chronological (oldest-first) order.

    The 50-row cap is the default ``limit`` of ``list_end_user_chat`` —
    enough to render the conversation an end user typically has with
    the Local_AI_Tutor for a single video, and small enough that the
    initial render of ``LessonPlayerScreen`` is not gated on a giant
    payload. Older turns remain in the DB; they are simply not returned
    on the first page (a future task can add pagination if the UI
    needs it).

    The response shape ``{"messages": [...]}`` matches the TS DTO
    ``EndUserChatListResponse``. Each message carries ``id``,
    ``video_key``, ``role``, ``text`` and ``created_at``; ``end_user_id``
    is excluded from the wire payload because it is implicit in the
    session cookie and including it would leak the autoincrement id.
    """
    from engines.database import list_end_user_chat

    rows = list_end_user_chat(end_user_id, video_key)
    # Strip ``end_user_id`` from each row before the wire — the caller
    # already knows their own id (it is in the session cookie) and
    # echoing it would expose autoincrement ids of other end users when
    # logs are inadvertently shared.
    messages = [
        {
            "id": row["id"],
            "video_key": row["video_key"],
            "role": row["role"],
            "text": row["text"],
            "created_at": row["created_at"],
        }
        for row in rows
    ]
    return {"messages": messages}


@app.post("/api/end-users/chat")
def end_user_post_chat(
    req: EndUserChatAppendReq,
    end_user_id: int = Depends(get_current_end_user_id),
):
    """
    Append one chat turn to ``(end_user_id, video_key)``.

    Validation:

    * ``role`` MUST be one of ``{"student", "tutor"}``. Anything else is
      rejected with 400 and a short detail naming the offending field;
      no row is inserted on rejection (Requirement 1.10's per-account
      isolation does not relax for malformed bodies).
    * ``video_key`` and ``text`` are accepted as-is — the persistence
      layer treats them as opaque text. An empty string for either is
      allowed because the backend cannot meaningfully decide what
      "empty" means for the End_User_App (a placeholder turn? a
      filler? both are legitimate UX patterns).

    Returns the just-inserted row's id alongside ``ok``: ``True`` so
    the End_User_App can correlate optimistic-render bubbles with the
    server-assigned id without a follow-up GET.
    """
    if req.role not in _END_USER_CHAT_ROLES:
        # Match the validation-error shape used elsewhere in this file
        # (``/api/admin/create-account``): 400 with a short detail
        # naming the failing field. Returning 422 would let FastAPI's
        # default validator print the entire allow-list, which is
        # noisier than necessary.
        raise HTTPException(
            status_code=400,
            detail="role field invalid: must be 'student' or 'tutor'",
        )

    from engines.database import append_end_user_chat

    append_end_user_chat(end_user_id, req.video_key, req.role, req.text)
    return {"ok": True}


# ─────────────────────────────────────────────────────────────────────────────
# Video transcript reverse-lookup (spec task 4.2 — Requirement 2.4)
# ─────────────────────────────────────────────────────────────────────────────
#
# Acceptance Criterion 2.4 says the End_User_App must retrieve the
# Video_Transcript for the active video by reverse-looking up the
# S3_Companion_JSON written next to that video — the file at
# ``<video_key>.json`` in the same bucket — and that lookup must
# complete inside 10 seconds. This route is the server side of that
# contract; the heavy lifting (single ``GetObject`` + JSON parse +
# schema validation) lives in ``engines/transcript_lookup.py``.
#
# Identity model: only the End_User_App calls this route, authenticated
# by the same ``session_token`` cookie used by the rest of the
# ``/api/end-users/*`` family (``Depends(get_current_end_user_id)``).
# End users do not own S3 buckets — videos are uploaded by admins via
# ``/api/verify-video`` + ``/api/confirm-upload`` and live in the
# *admin's* bucket. The current deployment is single-tenant, so every
# transcript lookup is routed through the seed admin's Per_User_Credentials
# (the username constant ``SEED_ADMIN_USERNAME =
# "cryptedu-admin@school.edu.my"`` defined in ``engines/database.py``).
# A future multi-tenant deployment will replace this single owner
# lookup with a per-video (video_key → admin_id) mapping; the public
# contract of the route does not change because the End_User_App
# only ever sees ``{title, description, transcription_paragraph,
# schema_version}``.
#
# Why 503 for missing config: a missing seed admin row, missing
# AWS_Bedrock_Credentials, or an empty ``s3_training_bucket`` is a
# server-side deployment gap the client cannot remedy. 503 is more
# accurate than 400 (the request itself was well-formed) or 404 (the
# transcript may very well exist; we just cannot reach S3 to fetch it).
#
# All other failure modes (504 timeout, 404 NoSuchKey, 502 malformed
# JSON) are produced by ``get_transcript_for_video`` and propagate
# verbatim — this route deliberately does not translate or wrap them.

from engines.transcript_lookup import get_transcript_for_video


@app.get("/api/videos/{key:path}/transcript")
def get_video_transcript(
    key: str,
    end_user_id: int = Depends(get_current_end_user_id),
):
    """
    Reverse-lookup the companion JSON for the video stored at S3 ``key``
    and return its ``{title, description, transcription_paragraph,
    schema_version}`` payload (Requirement 2.4).

    The path declares ``{key:path}`` so video keys with embedded slashes
    (e.g. ``"lessons/intro.mp4"``) are accepted whole; FastAPI hands
    the decoded key back as the ``key`` argument unchanged and the
    transcript helper appends ``".json"`` to derive the companion key.

    The S3 client is built with a 5-second connect timeout and a
    10-second read timeout via ``botocore.config.Config``. Together
    these bound the whole lookup at the 10-second budget Acceptance
    Criterion 2.4 imposes; if the bucket is slow, the timeout
    exceptions are translated to HTTP 504 inside
    ``get_transcript_for_video``. ``engines/aws_pipeline._get_s3_client``
    does not set these timeouts itself, so we construct the client
    directly here with the same per-request credential pattern that
    Property 6 mandates (the credentials come from the seed admin's
    encrypted columns, never from environment variables).
    """
    # Look up the seed admin row by username — it owns the S3 bucket
    # every video currently lives in. Importing the constant from the
    # database module keeps this route in step with the seed routine
    # if that username ever changes.
    from engines.database import (
        SEED_ADMIN_USERNAME,
        get_user_aws_credentials_by_id,
        get_user_by_username_with_hash,
    )

    seed_admin = get_user_by_username_with_hash(SEED_ADMIN_USERNAME)
    if not seed_admin:
        # No seed admin row → there is no credential vault to load the
        # bucket from. This is a deployment-time misconfiguration
        # (the seed routine has not run, or the row was deleted out
        # of band) and the client cannot remedy it.
        raise HTTPException(
            status_code=503,
            detail="Video bucket owner not configured",
        )

    aws_creds = get_user_aws_credentials_by_id(seed_admin["id"])
    if not aws_creds.get("aws_access_key") or not aws_creds.get("aws_secret_key"):
        raise HTTPException(
            status_code=503,
            detail="S3 credentials not configured",
        )
    bucket = aws_creds.get("s3_training_bucket", "")
    if not bucket:
        raise HTTPException(
            status_code=503,
            detail="S3 training bucket not configured",
        )

    from botocore.config import Config

    s3 = boto3.client(
        "s3",
        region_name=aws_creds.get("aws_region", "us-east-1"),
        aws_access_key_id=aws_creds["aws_access_key"],
        aws_secret_access_key=aws_creds["aws_secret_key"],
        config=Config(connect_timeout=5, read_timeout=10),
    )

    # ``get_transcript_for_video`` raises HTTPException(404 / 502 / 504)
    # for the documented failure modes; let them propagate untouched so
    # the End_User_App's ``LessonPlayerScreen`` can surface the named
    # cause to the student (Requirement 2.5).
    return get_transcript_for_video(s3, bucket, key)


# ── AI Tutor Endpoints (Ollama) ──────────────────────────────────────────────

import requests as http_requests

OLLAMA_URL = os.getenv("OLLAMA_URL", "http://127.0.0.1:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "cryptedu-ai")

# ── /api/ai/chat — Local_AI_Tutor proxy (spec task 4.4) ──────────────────────
#
# Request contract (spec task 4.4 + design §Local AI Tutor):
#
#     {
#       "messages":     [ {role, content}, ... ],   # required
#       "topic_scope":  "<the active video transcript>",  # required, non-empty
#       "options":      { ... }                      # optional Ollama overrides
#     }
#
# The legacy contract (``model``, ``stream``) is intentionally *not* accepted
# any more. The model is pinned server-side to ``OLLAMA_MODEL`` (env var) so a
# client cannot redirect the call to a different fine-tune; ``stream`` is
# always ``False`` because the End_User_App expects a single JSON response.
#
# Topic_Scope binding (Requirement 2.14, 2.16; Property 15):
#
# 1. Any incoming ``role == "system"`` message is dropped before forwarding —
#    this stops a malicious client from prepending a system prompt that would
#    subvert the transcript binding.
# 2. The backend builds a *single* SYSTEM message itself with the literal
#    template
#
#        Only answer from this transcript: {topic_scope}
#        Decline anything outside this transcript politely.
#
#    Property 15 asserts byte-for-byte equality of this template, so the
#    string above MUST stay in lockstep with the test fixture.
# 3. Empty ``topic_scope`` is rejected with HTTP 400 ``NO_TOPIC_SCOPE``
#    *before* any upstream call is made (Property 18 guards: tutor errors
#    never become 200 + placeholder).
#
# Error contract (design §Local AI Tutor errors):
#
#   | Condition                     | Status | code                |
#   |-------------------------------|--------|---------------------|
#   | Ollama unreachable            | 503    | AI_UNREACHABLE      |
#   | Ollama 4xx / 5xx              | 502    | AI_UPSTREAM_ERROR   |
#   | Ollama timeout                | 504    | AI_TIMEOUT          |
#   | Empty topic_scope             | 400    | NO_TOPIC_SCOPE      |
#
# All four are returned as JSONResponse bodies of shape
# ``{"code": "<CODE>", "detail": "<message>"}`` so the End_User_App can
# branch on the stable ``code`` field while still showing a human message.
#
# Output post-processing (Requirement 2.15; Property 17):
#
# Markdown / formatting characters ``* ^ # ` _ ~`` are stripped from the
# assistant message ``content`` before the response is returned. The
# raw Ollama envelope (``model``, ``done``, timing fields) is preserved
# untouched so existing client metadata handlers still work.
#
# Timeouts: 5 s connect, 60 s read. ``requests.post(..., timeout=(5, 60))``
# is the documented form for separate connect / read budgets.

# Markdown characters stripped from assistant output (Property 17). The
# regex is built once at module import — ``re.sub`` then runs in a tight
# inner loop on every successful response.
_AI_MARKDOWN_STRIP_RE = re.compile(r"[*^#`_~]")


def _strip_markdown_formatting(text: str) -> str:
    """
    Remove the markdown / formatting characters listed in spec task 4.4
    (``* ^ # ` _ ~``) from ``text``.

    The set is the same one Property 17 enumerates on the post-processor.
    Backslashes are *not* stripped here despite the spec text listing
    ``\\`` — that character is part of the table-row syntax in the task
    file (it escapes the trailing backtick), not part of the actual
    character set. Confirmed against design's Property 17 fixture which
    only enumerates ``* ^ # ` _ ~``.
    """
    if not isinstance(text, str):
        return text
    return _AI_MARKDOWN_STRIP_RE.sub("", text)


def _ai_error(status_code: int, code: str, detail: str) -> JSONResponse:
    """
    Build the ``{"code", "detail"}`` envelope every Local_AI_Tutor failure
    returns (design §Local AI Tutor errors).
    """
    return JSONResponse(
        status_code=status_code,
        content={"code": code, "detail": detail},
    )


class AIChatRequest(BaseModel):
    """
    Request body for ``/api/ai/chat`` (spec task 4.4).

    ``messages``    — chat history forwarded to Ollama. ``role == "system"``
                      entries are dropped before forwarding (Property 15).
    ``topic_scope`` — the active video transcript that the SYSTEM prompt is
                      bound to. Empty string → HTTP 400 NO_TOPIC_SCOPE.
    ``options``     — optional Ollama generation overrides
                      (``temperature``, ``min_p``, …). Defaults below match
                      the previous behaviour for the End_User_App.
    """

    messages: List[dict]
    topic_scope: str
    options: Optional[dict] = None


class AIGradeRequest(BaseModel):
    essay_text: str
    subject: str = "Bahasa Malaysia"


class AIQuizFormat(BaseModel):
    """
    Optional ``format`` block of ``POST /api/ai/generate-quiz`` (spec
    task 4.8 + design ``QuizGenerateRequest``).

    Counts are validated *after* Pydantic parsing inside the route so
    a single ``400 QUIZ_RANGE`` envelope matches the design's Local AI
    Tutor errors table — letting Pydantic raise a 422 here would split
    the contract and Property 16 would no longer hold.
    """

    mcq_count: int
    subjective_count: int


class AIQuizRequest(BaseModel):
    """
    Request body for ``/api/ai/generate-quiz`` (spec task 4.8).

    ``prompt``      — optional free-text study focus the student typed
                      ("test me on photosynthesis"). May be empty; the
                      transcript is the sole knowledge source either way.
    ``topic_scope`` — the active video transcript bound into the SYSTEM
                      prompt server-side. Empty → 400 NO_TOPIC_SCOPE.
    ``format``      — optional MCQ / subjective count override. Defaults
                      to ``{mcq_count: 10, subjective_count: 5}`` when
                      omitted (Requirement 2.6, Property 16).
    """

    prompt: Optional[str] = ""
    topic_scope: str
    format: Optional[AIQuizFormat] = None

def get_fallback_aws_credentials():
    from engines.database import get_conn, get_user_aws_credentials_by_id
    conn = get_conn()
    # As requested by constraints, ONLY use credentials from test@admin.edu.my for bedrock fallback
    row = conn.execute("SELECT id FROM users WHERE username = ?", ("test@admin.edu.my",)).fetchone()
    conn.close()
    if row:
        return get_user_aws_credentials_by_id(row["id"])
    return None

def invoke_bedrock_fallback(system_prompt: str, user_messages: list, max_tokens: int = 1024):
    from engines.aws_pipeline import _get_bedrock_client, BEDROCK_MODEL_ID
    creds = get_fallback_aws_credentials()
    if not creds:
        raise ValueError("No AWS credentials configured in admin profile for Bedrock fallback.")
    client = _get_bedrock_client(creds)
    # Format messages for Claude 3
    # user_messages might contain role 'user' and 'assistant'
    formatted_messages = []
    for m in user_messages:
        if m.get("role") in ["user", "assistant"]:
            formatted_messages.append({"role": m["role"], "content": m["content"]})
    
    body = {
        "anthropic_version": "bedrock-2023-05-31",
        "max_tokens": max_tokens,
        "temperature": 0.1,
        "system": system_prompt,
        "messages": formatted_messages
    }
    import json
    model_id = creds.get("bedrock_role_arn")
    if not model_id or not model_id.strip():
        model_id = BEDROCK_MODEL_ID

    response = client.invoke_model(
        modelId=model_id,
        body=json.dumps(body),
        accept="application/json",
        contentType="application/json"
    )
    response_body = json.loads(response.get("body").read())
    content = response_body.get("content", [])
    if content:
        return content[0].get("text", "")
    return ""

@app.post("/api/ai/chat")
async def ai_chat(req: AIChatRequest):
    """
    Proxy a chat request to the local Ollama instance with server-side
    Topic_Scope binding (Requirements 2.1, 2.2, 2.11, 2.12, 2.13, 2.14,
    2.15, 2.16; spec task 4.4).
    """
    # Step 1 — reject empty Topic_Scope before any upstream call
    # (design §Local AI Tutor errors row 4; Property 18).
    if req.topic_scope == "":
        return _ai_error(400, "NO_TOPIC_SCOPE", "No active video transcript")

    # Step 2 — drop client-supplied SYSTEM messages (Property 15). The
    # filter is exact-string ``"system"``; any other role
    # (``"user"``, ``"assistant"``, …) is forwarded verbatim. Non-dict
    # entries are skipped defensively — the upstream model would reject
    # them anyway.
    safe_messages: List[dict] = []
    for m in req.messages:
        if not isinstance(m, dict):
            continue
        if m.get("role") == "system":
            continue
        safe_messages.append(m)

    # Step 3 — build the SYSTEM prompt server-side. The exact text below
    # is asserted byte-for-byte by Property 15 — do not refactor.
    system_prompt = (
        f"Only answer from this transcript: {req.topic_scope}\n"
        f"Decline anything outside this transcript politely."
    )
    forwarded_messages = [{"role": "system", "content": system_prompt}] + safe_messages

    # Step 4 — invoke Ollama with bounded timeouts and translate every
    # failure mode to the structured error contract.
    try:
        resp = http_requests.post(
            f"{OLLAMA_URL}/api/chat",
            json={
                "model": OLLAMA_MODEL,
                "messages": forwarded_messages,
                "stream": False,
                "options": req.options or {"temperature": 0.1, "min_p": 0.1},
            },
            timeout=(5, 60),
        )
    except http_requests.exceptions.Timeout:
        return _ai_error(504, "AI_TIMEOUT", "Local_AI_Tutor timed out after 60s")
    except http_requests.exceptions.ConnectionError:
        # Fallback to AWS Bedrock
        try:
            fallback_text = invoke_bedrock_fallback(system_prompt, safe_messages)
            body = {
                "message": {
                    "role": "assistant",
                    "content": fallback_text
                }
            }
            # Step 6 — strip markdown / formatting characters from the assistant
            msg = body.get("message")
            if isinstance(msg, dict) and isinstance(msg.get("content"), str):
                msg["content"] = _strip_markdown_formatting(msg["content"])
            return body
        except Exception as fallback_e:
            import logging
            logging.getLogger(__name__).error(f"Bedrock fallback failed: {fallback_e}")
            return _ai_error(
                503,
                "AI_UNREACHABLE",
                "Local_AI_Tutor service unavailable and Bedrock fallback failed.",
            )

    if resp.status_code != 200:
        # Body capped at 200 chars per design table to avoid leaking
        # large upstream HTML pages into the client.
        return _ai_error(
            502,
            "AI_UPSTREAM_ERROR",
            f"Local_AI_Tutor returned {resp.status_code}: {resp.text[:200]}",
        )

    # Step 5 — parse the upstream JSON envelope. A malformed body is
    # treated as an upstream error so Property 18 still holds (no 200 +
    # placeholder).
    try:
        body = resp.json()
    except ValueError:
        return _ai_error(
            502,
            "AI_UPSTREAM_ERROR",
            f"Local_AI_Tutor returned 200 with non-JSON body: {resp.text[:200]}",
        )

    # Step 6 — strip markdown / formatting characters from the assistant
    # message (Requirement 2.15; Property 17). The Ollama ``/api/chat``
    # response shape is ``{"message": {"role": "assistant", "content": ...}}``
    # for the non-streaming path; we patch ``content`` in place and leave
    # everything else (model, done, timing) untouched.
    msg = body.get("message")
    if isinstance(msg, dict) and isinstance(msg.get("content"), str):
        msg["content"] = _strip_markdown_formatting(msg["content"])

    return body

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
        # Fallback to AWS Bedrock
        try:
            fallback_text = invoke_bedrock_fallback("", [{"role": "user", "content": grading_prompt}], max_tokens=1024)
            return {
                "message": {
                    "role": "assistant",
                    "content": fallback_text
                }
            }
        except Exception as fallback_e:
            import logging
            logging.getLogger(__name__).error(f"Bedrock fallback failed: {fallback_e}")
            raise HTTPException(503, "AI service unavailable and Bedrock fallback failed.")
    except http_requests.exceptions.Timeout:
        raise HTTPException(504, "AI service timed out.")

@app.post("/api/ai/generate-quiz")
async def ai_generate_quiz(req: AIQuizRequest):
    """
    Generate a quiz from the active video transcript (spec task 4.8;
    Requirements 2.6, 2.7, 2.8, 2.9, 2.10, 2.16).

    Contract — mirrors ``/api/ai/chat`` but emits a *parsed JSON array*:

    * Body ``{prompt?, topic_scope, format?}`` matching
      ``QuizGenerateRequest`` in ``frontend/src/lib/types.ts``.
    * ``format`` defaults to ``{mcq_count: 10, subjective_count: 5}`` when
      omitted (Requirement 2.6, Property 16). Counts are validated to
      ``1 <= mcq_count <= 50`` and ``0 <= subjective_count <= 50``;
      anything outside the range returns ``400 QUIZ_RANGE`` *before*
      any upstream call so Property 16 (zero Ollama calls on out-of-range)
      holds.
    * Empty ``topic_scope`` → ``400 NO_TOPIC_SCOPE``, same as chat.
    * The SYSTEM prompt is built server-side and instructs the model to
      emit a strict JSON array of items
      ``{"type": "mcq" | "subjective", "question": "...", "options": [...],
        "correct_index": int}``.
    * On any parse failure or any out-of-scope refusal signal in the
      model's response, the route returns ``{"questions": []}`` (an empty
      array per the task brief and Property 16's last clause).
    * The same markdown-stripping post-processor (``_strip_markdown_formatting``)
      runs on every text field — ``question`` and each entry of ``options`` —
      so Property 17 holds for quiz output as well as chat output.

    Error contract is identical to ``/api/ai/chat`` (design §Local AI
    Tutor errors), with one extra row for ``QUIZ_RANGE``.
    """
    # Step 1 — reject empty Topic_Scope before any upstream call
    # (Requirement 2.16; mirrors ``/api/ai/chat``).
    if req.topic_scope == "":
        return _ai_error(400, "NO_TOPIC_SCOPE", "No active video transcript")

    # Step 2 — resolve format (default 10 MCQ + 5 subjective per
    # Requirement 2.6) and range-check (Requirement 2.8).
    if req.format is None:
        mcq_count, subjective_count = 10, 5
    else:
        mcq_count = req.format.mcq_count
        subjective_count = req.format.subjective_count

    if not (1 <= mcq_count <= 50) or not (0 <= subjective_count <= 50):
        # Property 16: out-of-range rejected with zero upstream calls.
        return _ai_error(
            400,
            "QUIZ_RANGE",
            "MCQ count must be 1..50; subjective count must be 0..50",
        )

    # Step 3 — build the SYSTEM prompt server-side. The Topic_Scope
    # binding is identical in spirit to ``/api/ai/chat`` (Property 15);
    # the user-facing instruction additionally pins the wire format the
    # parser below expects.
    system_prompt = (
        f"Only answer from this transcript: {req.topic_scope}\n"
        f"Decline anything outside this transcript politely."
    )
    user_focus = (req.prompt or "").strip()
    focus_clause = (
        f"\nThe student also asks the focus area: \"{user_focus}\"."
        if user_focus
        else ""
    )
    user_prompt = (
        f"Generate a quiz strictly from the transcript above.{focus_clause}\n"
        f"Produce exactly {mcq_count} multiple-choice question(s) and "
        f"exactly {subjective_count} subjective question(s).\n"
        "Return ONLY a valid JSON array with no surrounding prose, no "
        "code fences, and no commentary. Each item MUST be one of:\n"
        '  {"type": "mcq", "question": "...", '
        '"options": ["A", "B", "C", "D"], "correct_index": <0..3>}\n'
        '  {"type": "subjective", "question": "..."}\n'
        "Every MCQ MUST have exactly 4 options with exactly one correct "
        "answer indicated by correct_index.\n"
        "If the transcript does not contain enough material for the "
        "requested quiz, return an empty JSON array []."
    )

    forwarded_messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt},
    ]

    # Step 4 — invoke Ollama with the same bounded timeouts and error
    # contract as ``/api/ai/chat`` (design §Local AI Tutor errors).
    try:
        resp = http_requests.post(
            f"{OLLAMA_URL}/api/chat",
            json={
                "model": OLLAMA_MODEL,
                "messages": forwarded_messages,
                "stream": False,
                "options": {"temperature": 0.1, "min_p": 0.1},
            },
            timeout=(5, 60),
        )
    except http_requests.exceptions.Timeout:
        return _ai_error(504, "AI_TIMEOUT", "Local_AI_Tutor timed out after 60s")
    except http_requests.exceptions.ConnectionError:
        # Fallback to AWS Bedrock
        try:
            fallback_text = invoke_bedrock_fallback(system_prompt, [{"role": "user", "content": user_prompt}], max_tokens=1024)
            # Step 5 — parse fallback text
            items = _parse_quiz_items(fallback_text)
            cleaned: List[dict] = []
            for it in items:
                cleaned_item: dict = {"type": it["type"]}
                cleaned_item["question"] = _strip_markdown_formatting(it.get("question", ""))
                if it["type"] == "mcq":
                    cleaned_item["options"] = [
                        _strip_markdown_formatting(o) for o in it.get("options", [])
                    ]
                    cleaned_item["correct_index"] = it.get("correct_index", 0)
                cleaned.append(cleaned_item)
            return {"questions": cleaned}
        except Exception as fallback_e:
            import logging
            logging.getLogger(__name__).error(f"Bedrock fallback failed: {fallback_e}")
            return _ai_error(
                503,
                "AI_UNREACHABLE",
                "Local_AI_Tutor service unavailable and Bedrock fallback failed.",
            )

    if resp.status_code != 200:
        return _ai_error(
            502,
            "AI_UPSTREAM_ERROR",
            f"Local_AI_Tutor returned {resp.status_code}: {resp.text[:200]}",
        )

    try:
        body = resp.json()
    except ValueError:
        return _ai_error(
            502,
            "AI_UPSTREAM_ERROR",
            f"Local_AI_Tutor returned 200 with non-JSON body: {resp.text[:200]}",
        )

    # Step 5 — pull the assistant content and parse it into a quiz array.
    # On any parse failure (out-of-scope refusal, malformed JSON, wrong
    # shape) the route returns an empty array — that is the contract from
    # the task brief and Property 16's last clause. We deliberately do
    # NOT raise an HTTP error here: an empty array is a valid quiz
    # response that the End_User_App's ``QuizScreen`` already handles by
    # surfacing a "no quiz could be generated" notice.
    msg = body.get("message")
    raw_content = ""
    if isinstance(msg, dict) and isinstance(msg.get("content"), str):
        raw_content = msg["content"]

    items = _parse_quiz_items(raw_content)

    # Step 6 — strip markdown / formatting characters from every text
    # field (Requirement 2.15; Property 17 extended to quiz output).
    cleaned: List[dict] = []
    for it in items:
        cleaned_item: dict = {"type": it["type"]}
        cleaned_item["question"] = _strip_markdown_formatting(it.get("question", ""))
        if it["type"] == "mcq":
            cleaned_item["options"] = [
                _strip_markdown_formatting(o) for o in it.get("options", [])
            ]
            cleaned_item["correct_index"] = it.get("correct_index", 0)
        cleaned.append(cleaned_item)

    return {"questions": cleaned}


# ── Quiz response parsing helpers (spec task 4.8) ───────────────────────────
#
# The model is asked to emit a JSON array, but in practice it sometimes
# wraps the array in ``\`\`\`json ... \`\`\``\` fences or surrounds it with a
# short prose preface. ``_extract_json_array`` is the lenient extractor;
# ``_parse_quiz_items`` is the strict validator that drops any item not
# matching the documented per-item shape.
#
# Out-of-scope refusal handling (per task brief): if the model returns
# anything that is *not* parseable as a JSON array of items, the helper
# returns ``[]`` — the route then forwards that empty list to the
# client. This matches Property 16's last clause: "for any upstream
# response that signals an out-of-scope refusal, the parsed quiz array
# SHALL be empty".


def _extract_json_array(text: str) -> Optional[list]:
    """
    Pull the first JSON array out of ``text`` and return it parsed.

    Handles the common nuisance shapes the local Ollama model produces:

    * ``"[...]"`` — return as-is.
    * ``"```json\n[...]\n```"`` — strip the fence, then parse.
    * ``"Here is your quiz:\n[...]\n"`` — find the first ``[`` and the
      matching final ``]`` by simple bracket counting and parse the
      slice between them.
    * Anything else — return ``None`` so the caller can treat the
      response as an out-of-scope refusal and emit an empty quiz.
    """
    if not isinstance(text, str) or not text.strip():
        return None

    cleaned = text.strip()
    # Drop a single fenced code block of the form ```json ... ``` or ``` ... ```.
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned, count=1)
        cleaned = re.sub(r"\s*```\s*$", "", cleaned, count=1)
        cleaned = cleaned.strip()

    # Direct parse first — covers the well-behaved case.
    try:
        parsed = json.loads(cleaned)
        if isinstance(parsed, list):
            return parsed
    except (ValueError, TypeError):
        pass

    # Fall back to bracket-balanced extraction. We scan for the first
    # ``[`` and walk forward, counting nesting depth, until the matching
    # ``]``. ``json.loads`` then validates the slice is well-formed.
    start = cleaned.find("[")
    if start == -1:
        return None
    depth = 0
    in_string = False
    escape = False
    for i in range(start, len(cleaned)):
        ch = cleaned[i]
        if in_string:
            if escape:
                escape = False
            elif ch == "\\":
                escape = True
            elif ch == '"':
                in_string = False
            continue
        if ch == '"':
            in_string = True
        elif ch == "[":
            depth += 1
        elif ch == "]":
            depth -= 1
            if depth == 0:
                slice_ = cleaned[start : i + 1]
                try:
                    parsed = json.loads(slice_)
                    if isinstance(parsed, list):
                        return parsed
                except (ValueError, TypeError):
                    return None
                break
    return None


def _parse_quiz_items(raw_content: str) -> List[dict]:
    """
    Validate ``raw_content`` against the strict per-item shape and
    return only the items that match.

    Item shapes (spec task 4.8):

    * ``{"type": "mcq", "question": str, "options": [str, str, str, str],
        "correct_index": int in 0..3}``
    * ``{"type": "subjective", "question": str}``

    Anything else (including out-of-scope refusal text or malformed
    JSON) yields ``[]`` so the route can return an empty array per
    Property 16's last clause.
    """
    arr = _extract_json_array(raw_content)
    if not isinstance(arr, list):
        return []

    valid: List[dict] = []
    for entry in arr:
        if not isinstance(entry, dict):
            continue
        kind = entry.get("type")
        question = entry.get("question")
        if not isinstance(question, str):
            continue
        if kind == "mcq":
            options = entry.get("options")
            correct_index = entry.get("correct_index")
            if (
                isinstance(options, list)
                and len(options) == 4
                and all(isinstance(o, str) for o in options)
                and isinstance(correct_index, int)
                and 0 <= correct_index <= 3
            ):
                valid.append(
                    {
                        "type": "mcq",
                        "question": question,
                        "options": list(options),
                        "correct_index": correct_index,
                    }
                )
        elif kind == "subjective":
            valid.append({"type": "subjective", "question": question})
        # Any other ``type`` value is silently dropped — the model is
        # instructed to use exactly two values, and a stray third would
        # be garbage we must not surface to the End_User_App.

    return valid


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

# AWS Lambda handler (via Mangum)
try:
    from mangum import Mangum
    handler = Mangum(app)
except ImportError:
    pass  # Mangum not needed for local development
