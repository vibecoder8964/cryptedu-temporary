# CryptEdu Platform

Welcome to the CryptEdu platform! This document is a complete, beginner-friendly guide to running, updating, and deploying the CryptEdu application.

The project is split into two main parts:
1. **Frontend**: The user interface (React/TypeScript).
2. **Backend**: The server and API (Python/FastAPI).

---

## 1. How to Run the App Locally

If you just want to test the app on your computer, follow these steps.

### A. Start the Backend
1. Open a terminal (Command Prompt, PowerShell, or VS Code terminal).
2. Navigate to the backend folder:
   ```bash
   cd admin_and_end_user_apps/backend
   ```
3. Install the required Python packages (you only need to do this once):
   ```bash
   pip install -r requirements.txt
   ```
4. Start the server:
   ```bash
   python main.py
   ```
   *The backend is now running at `http://localhost:8000`.*

### B. Start the Frontend
1. Open a **new, separate terminal window**.
2. Navigate to the frontend folder:
   ```bash
   cd admin_and_end_user_apps/frontend
   ```
3. Install the required Node packages (you only need to do this once):
   ```bash
   npm install
   ```
4. Start the development server:
   ```bash
   npm run dev
   ```
   *The terminal will show a local link (usually `http://localhost:5173`). Click it to open the app in your browser!*

---

## 2. Pushing Changes to the Frontend (AWS S3)

When you make changes to the React code in `frontend/src` and want the world to see them, you must deploy the frontend to your AWS S3 bucket.

### Option A: Using the Terminal (Recommended)
1. In your terminal, go to the frontend folder:
   ```bash
   cd admin_and_end_user_apps/frontend
   ```
2. Build the production-ready code:
   ```bash
   npm run build
   ```
   *This creates a `dist` folder containing the compiled website.*
3. Upload the `dist` folder to your AWS S3 bucket using the AWS CLI:
   ```bash
   aws s3 sync dist/ s3://<your-bucket-name> --delete
   ```
   *(Replace `<your-bucket-name>` with the actual name of your S3 bucket).*

### Option B: Doing it Manually via AWS Console
1. Run `npm run build` in the `frontend` folder to generate the `dist` folder.
2. Log in to the [AWS Management Console](https://console.aws.amazon.com/).
3. Search for **S3** and open the S3 dashboard.
4. Click on your bucket name.
5. Click **Upload**, then drag and drop all the files and folders from inside your local `dist` folder into the AWS window.
6. Click **Upload** at the bottom.

---

## 3. Pushing Changes to the Backend (AWS Lambda)

When you update your Python code in the `backend/` folder, you need to package it up and upload it to AWS Lambda.

### Option A: Using the Terminal
1. Open a terminal and navigate to the backend folder:
   ```bash
   cd admin_and_end_user_apps/backend
   ```
2. Create a temporary folder to package the dependencies:
   ```bash
   mkdir package
   pip install -r requirements.txt --target ./package
   ```
3. Zip everything together (this requires `zip` to be installed on your system, or you can use a PowerShell equivalent):
   ```bash
   cd package
   zip -r ../lambda_function.zip .
   cd ..
   zip -g lambda_function.zip main.py config.py seed.py
   zip -r -g lambda_function.zip engines/ data/
   ```
4. Upload the zip file to your AWS Lambda function using the AWS CLI:
   ```bash
   aws lambda update-function-code --function-name <your-lambda-function-name> --zip-file fileb://lambda_function.zip
   ```
   *(Replace `<your-lambda-function-name>` with the actual name of your Lambda function).*

### How to Fix the "File Too Large" Error (Using Docker/ECR)
AWS Lambda has a strict limit: your unzipped code and libraries cannot exceed **250MB**. Because your app uses heavy AI and Data libraries (`scikit-learn`, `numpy`, `openai-whisper`, `PyMuPDF`), the unzipped size easily exceeds 500MB.

**The Solution:** AWS Lambda allows you to upload **Docker Container Images** up to 10GB! I have already created a `Dockerfile` for you in the `backend/` folder. Here is how to use it:

1. **Install Docker:** Download and install [Docker Desktop](https://www.docker.com/products/docker-desktop) on your computer and make sure it is running.
2. **Log in to AWS ECR:** Open your terminal and log into Amazon Elastic Container Registry (ECR). Replace `<region>` and `<account-id>` with yours:
   ```bash
   aws ecr get-login-password --region <region> | docker login --username AWS --password-stdin <account-id>.dkr.ecr.<region>.amazonaws.com
   ```
3. **Create a Repository in AWS:**
   ```bash
   aws ecr create-repository --repository-name cryptedu-backend --region <region>
   ```
4. **Build the Docker Image:** Run this inside your `admin_and_end_user_apps/backend` folder:
   ```bash
   docker build -t cryptedu-backend .
   ```
5. **Tag the Image for AWS:**
   ```bash
   docker tag cryptedu-backend:latest <account-id>.dkr.ecr.<region>.amazonaws.com/cryptedu-backend:latest
   ```
6. **Push the Image to AWS:**
   ```bash
   docker push <account-id>.dkr.ecr.<region>.amazonaws.com/cryptedu-backend:latest
   ```
7. **Create the Lambda Function:**
   - Go to the AWS Lambda Console.
   - Click **Create function**.
   - Select **Container image** (instead of "Author from scratch").
   - Name the function `CryptEdu-Backend`.
   - Under Container Image URI, click **Browse images**, select your `cryptedu-backend` repository, and pick the `latest` image.
   - Click **Create function**.

*From here, proceed to Step C and Step D below to expose the URL and set environment variables!*

---

## 4. How to Get Your AWS API URL (For the Frontend .env File)

If you have already hosted your frontend on S3 but need to point it to your new AWS Lambda backend, you need your API URL:

1. Open the **AWS Lambda Console** and click on your function.
2. In the **Configuration** tab, click **Function URL** on the left menu.
3. If you haven't created one, click **Create function URL** (Choose "NONE" for Auth type, and check "Configure cross-origin resource sharing (CORS)").
4. Copy the **Function URL** (it looks like `https://xyz.lambda-url.us-east-1.on.aws/`).
5. Open your `frontend/.env.production` file and set it:
   ```env
   VITE_API_URL=https://xyz.lambda-url.us-east-1.on.aws
   ```
6. Re-run `npm run build` in your frontend and upload the new `dist/` folder to your S3 bucket!

---

## 5. Migrating the Database for AWS (SQLite -> Cloud)

By default, the backend uses a local SQLite database (`cryptedu.db`). When running on AWS Lambda, local files are deleted after execution, meaning your database will reset constantly. 

To fix this while keeping the same encryption/login logic and retaining the mocked `roshi` user, you should use **Supabase** (a cloud PostgreSQL database with a generous free tier) or **AWS DynamoDB**.

### Recommended: Using Supabase (Zero Code Changes Required)
The CryptEdu backend is already wired to sync data to Supabase!
1. Go to [Supabase](https://supabase.com) and create a free project.
2. Get your **Project URL** and **API Key**.
3. In your AWS Lambda console, go to **Configuration > Environment variables**.
4. Add these variables:
   - `SUPABASE_URL`: (Your Supabase URL)
   - `SUPABASE_KEY`: (Your Supabase anon key)
   - `SUPABASE_ENABLED`: `True`
5. *How it works:* The backend will automatically write to Supabase when hosted. For local development, it will continue using SQLite if those environment variables are absent.

### Alternative: AWS Elastic File System (EFS)
If you must strictly keep the SQLite file and stay 100% within AWS:
1. Create an **AWS EFS** file system.
2. Attach it to your Lambda function (in Configuration > File systems).
3. Set the Local mount path to `/mnt/efs`.
4. Add an Environment Variable in Lambda: `DB_PATH=/mnt/efs/cryptedu.db`.
5. *How it works:* Lambda will use the persistent EFS drive to store your SQLite file. The encryption and login logic remains identical, and it requires zero changes to the application code.

---

## 6. Pushing Code to GitHub

To save your code online so you don't lose it, you push it to GitHub. 

### Option A: Using the Terminal
1. Open a terminal in the root folder of your project (where this README is located).
2. Add all your changes to the staging area:
   ```bash
   git add .
   ```
3. Save (commit) your changes with a descriptive message:
   ```bash
   git commit -m "Describe what you changed here"
   ```
4. Push the changes to GitHub:
   ```bash
   git push origin main
   ```
   *(If your main branch is called `master`, use `git push origin master` instead).*

### Option B: Doing it Manually using VS Code
1. Open VS Code and click on the **Source Control** icon on the left sidebar (it looks like a branch with circles).
2. You will see a list of files you changed. Hover over the word **Changes** and click the `+` icon to stage all changes.
3. In the text box at the top, type a message describing what you did (e.g., "Updated README and Help Page").
4. Click the **Commit** button.
5. Finally, click the **Sync Changes** button (or "Push") that appears to send your code to GitHub.

---

## 7. Need Help?
If you are an admin or end-user of the application, please refer to the **Help** page within the application itself for a detailed breakdown of how to use every feature in the platform!
