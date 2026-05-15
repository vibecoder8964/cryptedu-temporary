# CryptEdu — Sovereign Learning Mesh

A unified education platform combining an **Admin Dashboard** (hub placement, curriculum management, video moderation, AI training) and a **Student App** (offline-first lessons, AI tutor, quizzes, community Q&A).

## Architecture

```
admin_and_end_user_apps/
├── frontend/          React (Vite) — port 5173
│   ├── src/pages/     Admin dashboard pages (TypeScript)
│   ├── src/student/   Student app screens (JSX)
│   └── src/App.tsx    Unified router with role selector
├── backend/           FastAPI (uvicorn) — port 8000
│   ├── main.py        All API endpoints (admin + student + AI)
│   └── engines/       Auth, database, AWS pipeline, AI proxy
└── README.md
```

## Components

| Component | Function |
|-----------|----------|
| **Role Selector** | First page — choose Admin or Student portal |
| **Admin Login** | AWS Cognito authentication (user pool: `ap-southeast-5_KI27lU59V`) |
| **Student Login** | Local SQLite + bcrypt + JWT cookie via backend |
| **Hub Placement** | K-Means analysis for optimal mesh hub locations |
| **Curriculum** | RAG pipeline for curriculum content |
| **Video Moderation** | Whisper transcription → Bedrock/Lambda AI moderation → S3 upload |
| **User Account Setup** | Bulk-create student accounts from CSV/Excel |
| **AI Tutor** | Ollama-powered educational chatbot (backend endpoint) |
| **Quiz Generator** | AI-generated MCQ questions aligned to KPM syllabus |
| **Essay Grading** | AI-powered essay assessment with KPM rubric |

## Default Credentials

| Portal | Username | Password |
|--------|----------|----------|
| Admin (Cognito) | `admin` | `123456` |
| Student (Local DB) | `roshi` | `012345` |

## Local Development Setup

### Prerequisites

- **Node.js** 18+ and npm
- **Python** 3.10+
- **Ollama** (for AI tutor) — https://ollama.com
- **ffmpeg** (for video transcription)

### 1. Backend

```bash
cd admin_and_end_user_apps/backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

The database (`data/cryptedu.db`) is auto-created on first run with default users seeded.

### 2. Frontend

```bash
cd admin_and_end_user_apps/frontend
npm install
npm run dev
```

Open http://localhost:5173 — you'll see the role selector.

### 3. AI Tutor (Optional)

```bash
ollama pull cryptedu-ai
# Or use any model:
OLLAMA_MODEL=gemma2:2b uvicorn main:app --reload --port 8000
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/auth/login` | POST | Admin session login (legacy) |
| `/api/end-users/login` | POST | Student login (JWT) |
| `/api/end-users/bulk-create` | POST | Bulk-create student accounts |
| `/api/ai/chat` | POST | AI tutor chat (Ollama proxy) |
| `/api/ai/grade-essay` | POST | Essay grading |
| `/api/ai/generate-quiz` | POST | Quiz question generation |
| `/api/verify-video` | POST | Video moderation pipeline |
| `/api/confirm-upload` | POST | Confirm approved video → S3 |
| `/api/placement` | POST | Hub placement analysis |
| `/api/analyze-hubs` | POST | Full hub analysis with map |


## Deploying to AWS (S3 + Lambda)

### Frontend → S3 Static Hosting

1. **Build the frontend:**
   ```bash
   cd admin_and_end_user_apps/frontend
   npm run build
   ```
   This creates a `dist/` folder with the production build.

2. **Create an S3 bucket:**
   ```bash
   aws s3 mb s3://cryptedu-app --region ap-southeast-1
   ```

3. **Enable static website hosting:**
   ```bash
   aws s3 website s3://cryptedu-app --index-document index.html --error-document index.html
   ```

4. **Upload the build:**
   ```bash
   aws s3 sync dist/ s3://cryptedu-app --delete
   ```

5. **Set bucket policy for public access:**
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [{
       "Sid": "PublicReadGetObject",
       "Effect": "Allow",
       "Principal": "*",
       "Action": "s3:GetObject",
       "Resource": "arn:aws:s3:::cryptedu-app/*"
     }]
   }
   ```

6. **Access your app at:**
   `http://cryptedu-app.s3-website-ap-southeast-1.amazonaws.com`

   For HTTPS, set up CloudFront in front of the S3 bucket.

### Backend → AWS Lambda + API Gateway

1. **Package the backend:**
   ```bash
   cd admin_and_end_user_apps/backend
   pip install -r requirements.txt -t ./package
   cp -r engines package/
   cp main.py config.py package/
   cd package && zip -r ../lambda.zip . && cd ..
   ```

2. **Create Lambda function:**
   ```bash
   aws lambda create-function \
     --function-name cryptedu-backend \
     --runtime python3.11 \
     --handler main.handler \
     --zip-file fileb://lambda.zip \
     --role arn:aws:iam::YOUR_ACCOUNT:role/lambda-execution-role \
     --timeout 300 \
     --memory-size 512
   ```

3. **Add Mangum adapter** (Lambda ↔ FastAPI bridge):
   Add `mangum` to `requirements.txt`, then add to `main.py`:
   ```python
   from mangum import Mangum
   handler = Mangum(app)
   ```

4. **Create API Gateway:**
   ```bash
   aws apigatewayv2 create-api \
     --name cryptedu-api \
     --protocol-type HTTP \
     --target arn:aws:lambda:ap-southeast-1:YOUR_ACCOUNT:function:cryptedu-backend
   ```

5. **Update frontend API base URL:**
   In `vite.config.ts`, update the proxy target for production, or set `VITE_API_URL` environment variable pointing to your API Gateway URL.

### Pushing Updates

**To S3 (frontend):**
```bash
cd admin_and_end_user_apps/frontend
npm run build
aws s3 sync dist/ s3://cryptedu-app --delete
```

**To Lambda (backend):**
```bash
cd admin_and_end_user_apps/backend
pip install -r requirements.txt -t ./package
cp -r engines package/
cp main.py config.py package/
cd package && zip -r ../lambda.zip . && cd ..
aws lambda update-function-code --function-name cryptedu-backend --zip-file fileb://lambda.zip
```

## Pushing to GitHub

```bash
cd c:\Users\WS TAN\Desktop\CryptEdu
git add .
git commit -m "feat: merged admin + student apps"
git push origin master
```

Repository: `https://github.com/YOUR_USERNAME/CryptEdu.git`

## Live App

🔗 **[CryptEdu Live App](http://cryptedu-app.s3-website-ap-southeast-1.amazonaws.com)** *(update this URL after deployment)*

---

© 2026 CryptEdu — Sovereign Learning Mesh
