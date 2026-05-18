import { useState, useEffect } from "react";
import type { FileEntry, ExamPair } from "../lib/types";
import { buildDataset, downloadJSON } from "../lib/utils";
import { useSettings } from "../../../lib/SettingsContext";

type Props = {
  textbooks: FileEntry[];
  examPairs: ExamPair[];
  onBack: () => void;
  onReset: () => void;
};

export default function ReadyPage({ textbooks, examPairs, onBack, onReset }: Props) {
  const { t } = useSettings();
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [credentialsOk, setCredentialsOk] = useState<boolean | null>(null);
  const [s3Bucket, setS3Bucket] = useState("cryptedu-training-data");

  const dataset = buildDataset(textbooks, examPairs);
  const estSamples = textbooks.length * 80 + examPairs.length * 200;
  const tbPct = Math.min(100, Math.round((textbooks.length / 200) * 100));
  const exPct = Math.min(100, Math.round((examPairs.length / 50) * 100));

  // Estimate training cost (rough Bedrock pricing)
  const estCostUsd = Math.max(1, (estSamples / 1000) * 8).toFixed(2);
  const costExceedsThreshold = parseFloat(estCostUsd) > 10;

  // Check if Google credentials are configured
  useEffect(() => {
    fetch("/api/v1/user/credentials/check", { credentials: 'include' })
      .then(res => {
        if (!res.ok) throw new Error('Auth failed');
        return res.json();
      })
      .then(data => {
        // Check all three required fields: email, private key, AND folder ID
        setCredentialsOk(data.has_google_email && data.has_google_key && !!data.google_drive_folder_id);
        if (data.google_drive_folder_id) setS3Bucket(data.google_drive_folder_id);
      })
      .catch(() => setCredentialsOk(false));
  }, []);

  const handleUploadToS3 = async () => {
    setIsUploading(true);
    setUploadStatus("Uploading training data to S3...");

    try {
      const formData = new FormData();
      const manifestBlob = new Blob([JSON.stringify(dataset, null, 2)], { type: "application/json" });
      formData.append("files", manifestBlob, "slm_manifest.json");

      textbooks.forEach(tb => {
        formData.append("files", tb.file, `textbooks/${tb.file.name}`);
      });

      examPairs.forEach(pair => {
        formData.append("files", pair.question.file, `exam_questions/${pair.question.file.name}`);
        formData.append("files", pair.answer.file, `exam_answers/${pair.answer.file.name}`);
      });

      const response = await fetch("/api/v1/training/upload", {
        method: "POST",
        body: formData,
        credentials: 'include',
      });

      if (!response.ok) throw new Error("Upload failed");
      const data = await response.json();
      setUploadStatus(`✅ ${t('export_success')}`);
    } catch (error: any) {
      setUploadStatus("❌ Error: " + error.message);
    } finally {
      setIsUploading(false);
    }
  };



  return (
    <div>
      <h1 className="text-[25px] font-bold text-[#111111] mb-2">✅ {t('ready_to_export')}</h1>
      <p className="text-sm text-gray-600 mb-8 leading-relaxed">
        {t('export_desc')}
      </p>

      {/* Credential Check */}
      {credentialsOk === false && (
        <div className="flex gap-3 p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm mb-6 leading-relaxed">
          <span className="flex-shrink-0">⚠️</span>
          <span>
            <strong>Google Drive not configured.</strong> Go to <strong>Admin Profile → Google Cloud & Drive Configuration</strong> and ensure you have saved:
            <ul className="list-disc ml-5 mt-2 space-y-1">
              <li>Service Account Email (from your JSON key file)</li>
              <li>Private Key (the full PEM block from your JSON key file)</li>
              <li>Google Drive Folder ID (the SLM_Training folder ID from the URL)</li>
            </ul>
            <p className="mt-2">Also make sure the folder is shared with your Service Account email (Editor permission).</p>
          </span>
        </div>
      )}

      {credentialsOk === true && (
        <div className="flex gap-3 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm mb-6 leading-relaxed">
          <span className="flex-shrink-0">✅</span>
          <span>
            <strong>Google Drive is configured.</strong> Files will be uploaded to folder ID: <code className="bg-emerald-100 px-1 rounded">{s3Bucket}</code>
            <p className="mt-1 text-xs text-emerald-600">Make sure this folder has subfolders: <code>textbooks</code>, <code>exam_questions</code>, <code>exam_answers</code></p>
          </span>
        </div>
      )}

      {/* Success alert */}
      <div className="flex gap-3 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-[16px] mb-6 leading-relaxed">
        <span className="flex-shrink-0 mt-0.5">🎉</span>
        <span>{t('manifest_compiled_tip')}</span>
      </div>

      {/* Summary card */}
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-8 mb-8">
        <div className="text-[18px] font-bold text-gray-500 uppercase tracking-wider mb-5">{t('dataset_summary')}</div>
        <div className="grid grid-cols-4 gap-6 mb-8">
          <div className="bg-white border border-gray-200 rounded-xl p-6 text-center shadow-sm">
            <div className="text-[30px] font-bold text-blue-600">{textbooks.length}</div>
            <div className="text-[14px] text-gray-500 font-semibold mt-2 uppercase tracking-wide">{t('textbooks')}</div>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-6 text-center shadow-sm">
            <div className="text-[30px] font-bold text-[#10B981]">{examPairs.length}</div>
            <div className="text-[14px] text-gray-500 font-semibold mt-2 uppercase tracking-wide">{t('qa_pairs')}</div>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-6 text-center shadow-sm">
            <div className="text-[30px] font-bold text-amber-500">~{estSamples.toLocaleString()}</div>
            <div className="text-[14px] text-gray-500 font-semibold mt-2 uppercase tracking-wide">{t('est_samples')}</div>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-6 text-center shadow-sm">
            <div className={`text-[30px] font-bold text-emerald-600`}>$0.00</div>
            <div className="text-[14px] text-gray-500 font-semibold mt-2 uppercase tracking-wide">Colab Free Tier</div>
          </div>
        </div>

        {/* Progress bars */}
        <div className="flex flex-col gap-5">
          <div>
            <div className="flex justify-between text-[14px] font-medium text-gray-500 mb-2">
              <span>{t('tb_coverage')}</span>
              <span>{tbPct}%</span>
            </div>
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${tbPct}%` }} />
            </div>
          </div>
          <div>
            <div className="flex justify-between text-[14px] font-medium text-gray-500 mb-2">
              <span>{t('ex_coverage')}</span>
              <span>{exPct}%</span>
            </div>
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div className="h-full bg-[#10B981] rounded-full transition-all" style={{ width: `${exPct}%` }} />
            </div>
          </div>
        </div>
      </div>

      {/* Steps */}
      <div className="flex flex-col gap-6">
        {/* Step 1: Send Data to Google Drive */}
        <StepCard num={1} title={t('step_drive_title')}>
          <p className="text-[16px] text-gray-600 mb-4">
            {t('step_drive_desc')}
          </p>
          <div className="flex gap-4 items-center mb-4">
            <button
              onClick={handleUploadToS3}
              disabled={isUploading || credentialsOk === false}
              className="px-6 py-3 rounded-xl text-[18px] font-bold bg-[#10B981] text-white hover:bg-[#059669] disabled:opacity-50 transition-colors"
            >
              {isUploading ? t('exporting') : `⬆ ${t('export_to_drive')}`}
            </button>
            <button
              onClick={() => downloadJSON(dataset, "slm_manifest.json")}
              className="px-6 py-3 rounded-xl text-[18px] font-bold bg-white text-gray-600 border border-gray-300 hover:bg-gray-50 transition-colors"
            >
              ⬇ {t('download_manifest')}
            </button>
          </div>
          {uploadStatus && (
            <div className={`p-4 rounded-lg font-medium ${uploadStatus.startsWith("❌") ? "bg-red-50 text-red-700" : uploadStatus.startsWith("✅") ? "bg-emerald-50 text-[#10B981]" : "bg-blue-50 text-blue-700"}`}>
              {uploadStatus}
            </div>
          )}
        </StepCard>

        {/* Step 2: Prepare Google Colab */}
        <StepCard num={2} title={t('download_open_colab')}>
          <p className="text-[16px] text-gray-600 mb-4">
            Download the notebook template below, then open Google Colab and upload it. Configure the GPU runtime and run all cells.
          </p>
          <div className="flex gap-4 items-center mb-4 flex-wrap">
            <a
              href="/notebook.ipynb"
              download
              className="px-6 py-3 rounded-xl text-[18px] font-bold bg-white text-gray-600 border border-gray-300 hover:bg-gray-50 transition-colors"
            >
              ⬇ 1. Download notebook.ipynb
            </a>
            <button
              onClick={() => {
                fetch('/api/v1/training/notebook', { credentials: 'include' })
                  .then(res => {
                    if (!res.ok) throw new Error('Notebook not found');
                    return res.blob();
                  })
                  .then(blob => {
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'notebook.ipynb';
                    a.click();
                    URL.revokeObjectURL(url);
                  })
                  .catch(err => alert('Download failed: ' + err.message));
              }}
              className="px-6 py-3 rounded-xl text-[18px] font-bold bg-gray-100 text-gray-600 border border-gray-300 hover:bg-gray-200 transition-colors"
            >
              ⬇ Download via API
            </button>
            <a
              href="https://colab.research.google.com/"
              target="_blank"
              rel="noreferrer"
              className="px-6 py-3 rounded-xl text-[18px] font-bold bg-[#4285F4] text-white hover:bg-[#3367D6] transition-colors"
            >
              🚀 2. Open Google Colab
            </a>
          </div>
          {/* Fine-tuning notice (Requirement 4.8) */}
          <div className="p-4 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm mb-4">
            <p className="font-bold mb-2">📋 Fine-tuning runs in Google Colab</p>
            <ol className="list-decimal pl-5 space-y-1">
              <li>Open <code>notebook.ipynb</code> in Colab</li>
              <li>Mount your Google Drive when prompted</li>
              <li>Run all cells in order — the notebook handles everything automatically</li>
            </ol>
          </div>
          <div className="text-sm text-gray-500 italic mt-2 bg-blue-50 p-4 rounded-lg border border-blue-100">
            <p className="font-bold text-blue-800 mb-2">{t('how_to_configure_colab')}</p>
            <ol className="list-decimal pl-5 space-y-1 text-blue-700">
              <li>{t('colab_instruction_1')}</li>
              <li>{t('colab_instruction_2')}</li>
              <li>{t('colab_instruction_3')}</li>
              <li>{t('colab_instruction_4')}</li>
              <li>{t('colab_instruction_5')}</li>
              <li>{t('colab_instruction_6')}</li>
            </ol>
          </div>
        </StepCard>

        {/* Step 3: Run Training Automatically */}
        <StepCard num={3} title={t('run_training_colab')}>
          <div className="text-[16px] text-gray-600 leading-8 space-y-2 mb-4">
            <div>🚀 <span className="font-bold text-[#111111]">{t('run_all_cells')}</span> — {t('run_all_cells_desc')}</div>
            <div>⏱️ <span className="font-bold text-[#111111]">{t('wait_for_gpu')}</span> — {t('wait_for_gpu_desc')}</div>
            <div>💾 <span className="font-bold text-[#111111]">{t('auto_save_drive')}</span> — {t('auto_save_drive_desc')}</div>
            <div>⚡ <span className="font-bold text-[#111111]">{t('ready_for_hubs')}</span> — {t('ready_for_hubs_desc')}</div>
          </div>
        </StepCard>
      </div>

      <div className="flex gap-4 flex-wrap mt-10">
        <button
          onClick={onBack}
          className="px-6 py-3 rounded-xl text-[18px] font-bold bg-white border-2 border-gray-200 hover:border-gray-300 text-[#111111] transition-colors"
        >
          ← {t('edit_exam_papers')}
        </button>
        <button
          onClick={onReset}
          className="px-6 py-3 rounded-xl text-[18px] font-bold bg-amber-50 border border-amber-200 text-amber-600 hover:bg-amber-100 transition-colors"
        >
          🔄 {t('start_over_btn')}
        </button>
      </div>
    </div>
  );
}

function StepCard({ num, title, children }: { num: number; title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border-2 border-gray-100 rounded-xl p-8 shadow-sm">
      <div className="flex items-center gap-4 mb-5">
        <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center text-[18px] font-bold text-[#10B981] flex-shrink-0">
          {num}
        </div>
        <div className="text-[24px] font-bold text-[#111111]">{title}</div>
      </div>
      {children}
    </div>
  );
}
