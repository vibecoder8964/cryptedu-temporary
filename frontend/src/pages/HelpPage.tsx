import { MapPin, ServerCog, FileVideo, Bot, Key, Network, BookOpen, Upload, Play, ShieldAlert } from "lucide-react";

export default function HelpPage() {
  return (
    <div className="p-8 max-w-6xl font-sans animate-in fade-in duration-300 relative z-10">
      <h2 className="text-[32px] font-bold mb-4 text-[#111111]">Platform Manual & Guide</h2>
      <p className="text-gray-600 mb-8 text-lg leading-relaxed">
        Welcome to the CryptEdu Admin Dashboard! This guide will walk you through every single page and feature in a simple, step-by-step manner. Whether you are setting up servers or moderating videos, you will find everything you need here.
      </p>

      <div className="space-y-8">

        {/* 1. Admin Profile Page */}
        <section className="bg-white p-8 rounded-xl border border-gray-200 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 left-0 w-2 h-full bg-amber-500"></div>
          <div className="flex items-center gap-3 mb-6 pl-4">
            <div className="p-2 bg-amber-50 text-amber-600 rounded-lg"><Key size={28} /></div>
            <h3 className="text-2xl font-bold text-[#111111]">1. Admin Profile (Credentials Setup)</h3>
          </div>
          <div className="pl-4 space-y-4 text-gray-700">
            <p><strong>What is this page for?</strong> This is the most important page to visit first. It connects the platform to the cloud services (AWS and Google Drive) so the platform can store videos and train AI models.</p>
            <h4 className="font-bold text-gray-900 mt-4">Step-by-Step Instructions:</h4>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong>AWS Credentials:</strong> Enter your <code>AWS Access Key ID</code> and <code>AWS Secret Access Key</code>. You can get these from your AWS IAM console. You must also enter the name of your <strong>AWS S3 Bucket</strong> where videos will be stored, and the AWS Region (e.g., <code>us-east-1</code>).</li>
              <li><strong>AWS Bedrock:</strong> Make sure your AWS account has access to the "Claude 3 Sonnet" model in Amazon Bedrock, as this is used for grading and moderation.</li>
              <li><strong>Google Drive Credentials:</strong> You need a Google Service Account. Upload the `.json` key file, and enter the ID of the main Google Drive folder where you want to store textbooks and exams.</li>
              <li><strong>Google Drive Subfolders:</strong> You must also provide the exact Folder IDs for three subfolders located inside your main folder: <code>Textbooks Folder ID</code>, <code>Exam Questions Folder ID</code>, and <code>Exam Answers Folder ID</code>.</li>
              <li><strong>HuggingFace Token:</strong> Enter your HuggingFace Read token so the AI training system can download base models like Qwen2.5.</li>
              <li><strong>Save!</strong> Click the "Save Credentials" button. Your keys are encrypted and stored safely in the database.</li>
            </ul>
          </div>
        </section>

        {/* 2. Hub Placement Page */}
        <section className="bg-white p-8 rounded-xl border border-gray-200 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 left-0 w-2 h-full bg-emerald-500"></div>
          <div className="flex items-center gap-3 mb-6 pl-4">
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg"><MapPin size={28} /></div>
            <h3 className="text-2xl font-bold text-[#111111]">2. Hub Placement Engine</h3>
          </div>
          <div className="pl-4 space-y-4 text-gray-700">
            <p><strong>What is this page for?</strong> This tool helps you figure out the absolute best physical locations to build "Master Hubs" (servers) for rural schools that don't have internet access.</p>
            <h4 className="font-bold text-gray-900 mt-4">Step-by-Step Instructions:</h4>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong>Select an Area:</strong> Look at the map and click on a general region (like a district in Malaysia).</li>
              <li><strong>Define the Radius:</strong> Use the slider to set how large the coverage area should be (e.g., 50 kilometers).</li>
              <li><strong>Set Number of Hubs:</strong> Choose how many Master Hubs you have the budget to build.</li>
              <li><strong>Analyze:</strong> Click "Calculate Optimal Placement". The system will download real-world population data and terrain elevation to find the smartest spots to build.</li>
              <li><strong>View Results:</strong> The map will update with markers. You will also see a financial dashboard showing how much money this infrastructure saves compared to buying commercial satellite internet for every school.</li>
            </ul>
          </div>
        </section>

        {/* 3. Hub Architecture Page */}
        <section className="bg-white p-8 rounded-xl border border-gray-200 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 left-0 w-2 h-full bg-blue-500"></div>
          <div className="flex items-center gap-3 mb-6 pl-4">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><Network size={28} /></div>
            <h3 className="text-2xl font-bold text-[#111111]">3. Hub Architecture Planner</h3>
          </div>
          <div className="pl-4 space-y-4 text-gray-700">
            <p><strong>What is this page for?</strong> Once you know <em>where</em> to put the hubs, this page tells you exactly <em>what equipment</em> to buy to build them.</p>
            <h4 className="font-bold text-gray-900 mt-4">Step-by-Step Instructions:</h4>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong>Select a Hub Type:</strong> Choose between a "Master Hub" (the central server) or a "Sub-Hub" (a smaller receiver at a school).</li>
              <li><strong>Check the Distance:</strong> If a Sub-Hub is very far away (over 5km), check the "Extreme Range" box.</li>
              <li><strong>Generate Bill of Materials (BoM):</strong> The page will automatically generate a shopping list of routers, antennas, solar panels, and servers needed for that exact setup.</li>
              <li><strong>Follow the Diagram:</strong> Use the interactive network diagram to see how the Master Hub connects to the Sub-Hubs via point-to-point wireless bridges.</li>
            </ul>
          </div>
        </section>

        {/* 4. Curriculum & Moderation Page */}
        <section className="bg-white p-8 rounded-xl border border-gray-200 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 left-0 w-2 h-full bg-purple-500"></div>
          <div className="flex items-center gap-3 mb-6 pl-4">
            <div className="p-2 bg-purple-50 text-purple-600 rounded-lg"><ShieldAlert size={28} /></div>
            <h3 className="text-2xl font-bold text-[#111111]">4. Curriculum / Video Moderation</h3>
          </div>
          <div className="pl-4 space-y-4 text-gray-700">
            <p><strong>What is this page for?</strong> Before educational videos are sent to the rural offline hubs, they must be checked by AI to ensure they don't contain inappropriate or culturally insensitive content.</p>
            <h4 className="font-bold text-gray-900 mt-4">Step-by-Step Instructions:</h4>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong>Upload a Video:</strong> Click the upload box and select an `.mp4` educational video. Enter the Title and Description.</li>
              <li><strong>Wait for Transcription:</strong> The system will extract the audio and turn it into text automatically.</li>
              <li><strong>AI Moderation:</strong> AWS Bedrock (Claude 3) will read the transcript and decide if the video is "Approved" or "Rejected" based on strict educational guidelines.</li>
              <li><strong>Final Decision:</strong> If approved, click "Confirm & Sync to Hubs". The video and its metadata will be permanently saved to your AWS S3 bucket.</li>
            </ul>
          </div>
        </section>

        {/* 5. AI Training Page */}
        <section className="bg-white p-8 rounded-xl border border-gray-200 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 left-0 w-2 h-full bg-indigo-500"></div>
          <div className="flex items-center gap-3 mb-6 pl-4">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg"><Bot size={28} /></div>
            <h3 className="text-2xl font-bold text-[#111111]">5. Local AI Training Setup</h3>
          </div>
          <div className="pl-4 space-y-4 text-gray-700">
            <p><strong>What is this page for?</strong> We use a specialized AI tutor on the offline hubs. This page prepares the textbooks and exams so you can train (fine-tune) the AI model.</p>
            <h4 className="font-bold text-gray-900 mt-4">Step-by-Step Instructions:</h4>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong>Upload Documents:</strong> Use the three upload boxes to upload your Textbooks, Exam Questions, and Exam Answers (PDF or DOCX).</li>
              <li><strong>Wait for Sync:</strong> The files will be securely sent to your Google Drive folders.</li>
              <li><strong>Download Training Notebook:</strong> Once files are uploaded, a button will appear to download the <code>notebook.ipynb</code> file.</li>
              <li><strong>Train on Google Colab:</strong> 
                <ol className="list-decimal pl-5 mt-2 space-y-1">
                  <li>Go to <a href="https://colab.research.google.com" className="text-blue-600 underline" target="_blank" rel="noreferrer">Google Colab</a> and upload the notebook you just downloaded.</li>
                  <li>Go to <strong>Runtime &gt; Change runtime type</strong> and select <strong>T4 GPU</strong> (or better).</li>
                  <li>Run all the cells in the notebook top-to-bottom.</li>
                  <li>The script will automatically grab the files from your Google Drive, train the AI, and save the finished model (<code>cryptedu-ai</code>) back to your Google Drive!</li>
                </ol>
              </li>
            </ul>
          </div>
        </section>

        {/* Contact */}
        <div className="mt-12 p-8 bg-white rounded-xl border-2 border-emerald-100 shadow-sm text-center">
          <h4 className="text-lg font-bold text-gray-800 mb-4">Need Technical Support?</h4>
          <div className="space-y-2 text-lg font-medium text-gray-600">
            <p>Phone: <span className="text-emerald-700">012-732 3069</span></p>
            <p>Email: <span className="text-emerald-700">weesheng2007@gmail.com</span></p>
            <p className="text-sm font-normal text-gray-500 mt-4">Built for the CryptEdu Sovereign Learning Mesh Project.</p>
          </div>
        </div>

      </div>
    </div>
  );
}
