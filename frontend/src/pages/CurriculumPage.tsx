import { useState, useRef, useEffect } from "react";
import { UploadCloud, FileVideo, ShieldCheck, AlertTriangle, FileText, Info, Play, Pause } from "lucide-react";
import { useSettings } from "../lib/SettingsContext";

export default function CurriculumPage() {
  const { t } = useSettings();
  const [file, setFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [result, setResult] = useState<any>(() => {
    // Restore AI result from localStorage on mount
    try {
      const saved = localStorage.getItem('slm_curriculum_result');
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  });
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [showConfirmOverride, setShowConfirmOverride] = useState<"accept" | "reject" | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showRefreshWarning, setShowRefreshWarning] = useState(() => {
    // If we have a saved result but no file, user refreshed mid-flow
    try {
      const saved = localStorage.getItem('slm_curriculum_result');
      return !!saved;
    } catch { return false; }
  });

  // Optional metadata fields
  const [title, setTitle] = useState(() => localStorage.getItem('slm_curriculum_title') || "");
  const [description, setDescription] = useState(() => localStorage.getItem('slm_curriculum_desc') || "");

  const videoRef = useRef<HTMLVideoElement>(null);

  // Persist result to localStorage when it changes
  useEffect(() => {
    if (result) {
      localStorage.setItem('slm_curriculum_result', JSON.stringify(result));
    } else {
      localStorage.removeItem('slm_curriculum_result');
    }
  }, [result]);

  // Persist title/description
  useEffect(() => { localStorage.setItem('slm_curriculum_title', title); }, [title]);
  useEffect(() => { localStorage.setItem('slm_curriculum_desc', description); }, [description]);

  // Revoke old blob URL when file changes
  useEffect(() => {
    return () => {
      if (videoUrl) URL.revokeObjectURL(videoUrl);
    };
  }, [videoUrl]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const f = e.target.files[0];
      if (videoUrl) URL.revokeObjectURL(videoUrl);
      setFile(f);
      setVideoUrl(URL.createObjectURL(f));
      setResult(null);
      setUploadStatus(null);
      setShowConfirmOverride(null);
      // Default title to filename without extension
      if (!title) setTitle(f.name.replace(/\.[^/.]+$/, ""));
    }
  };

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play();
      setIsPlaying(true);
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  };

  const handleVerify = async () => {
    if (!file) return;
    setIsVerifying(true);
    setResult(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("/api/verify-video", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => null);
        const detail = errData?.detail || t('verification_failed');
        throw new Error(detail);
      }

      const data = await response.json();
      setResult(data);
    } catch (error: any) {
      console.error(error);
      alert(error?.message || t('error_verifying'));
    } finally {
      setIsVerifying(false);
    }
  };

  const handleConfirmUpload = async () => {
    if (!result?.pending_id) return;
    setIsUploading(true);
    setUploadStatus(null);
    setShowConfirmOverride(null);
    try {
      const formData = new FormData();
      formData.append("pending_id", result.pending_id);
      formData.append("title", title || file?.name || "Untitled");
      formData.append("description", description || "");
      const response = await fetch("/api/confirm-upload", {
        method: "POST",
        body: formData,
      });
      if (!response.ok) throw new Error("Upload failed");
      setUploadStatus(t('upload_success'));
      setResult({ ...result, status: t('published') });
      // Clear persisted state after successful upload
      localStorage.removeItem('slm_curriculum_result');
      localStorage.removeItem('slm_curriculum_title');
      localStorage.removeItem('slm_curriculum_desc');
    } catch (e) {
      setUploadStatus(t('upload_error'));
    } finally {
      setIsUploading(false);
    }
  };

  const handleConfirmReject = async () => {
    if (!result?.pending_id) return;
    setShowConfirmOverride(null);
    try {
      const formData = new FormData();
      formData.append("pending_id", result.pending_id);
      await fetch("/api/reject-upload", { method: "POST", body: formData });
      setResult(null);
      setFile(null);
      if (videoUrl) URL.revokeObjectURL(videoUrl);
      setVideoUrl(null);
      setTitle("");
      setDescription("");
      setShowRefreshWarning(false);
      localStorage.removeItem('slm_curriculum_result');
      localStorage.removeItem('slm_curriculum_title');
      localStorage.removeItem('slm_curriculum_desc');
      alert(t('video_rejected'));
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="p-8 max-w-6xl font-sans relative z-10">
      <h2 className="text-[25px] font-bold mb-2 text-[#111111]">{t('video_moderation_queue')}</h2>
      <p className="text-sm text-gray-600 mb-6">{t('video_moderation_desc')}</p>

      <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 mb-6 flex items-start gap-3">
        <Info className="text-emerald-600 mt-0.5 flex-shrink-0" size={20} />
        <div className="text-sm text-emerald-800">
          <p className="font-bold mb-1">{t('hitl_active')}</p>
          <p>{t('hitl_desc')}</p>
        </div>
      </div>

      {/* Refresh warning */}
      {showRefreshWarning && !file && result && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6 flex items-start gap-3">
          <AlertTriangle className="text-amber-600 flex-shrink-0 mt-0.5" size={18} />
          <div className="text-sm text-amber-800">
            <p className="font-bold">{t('session_restored_video')}</p>
            <p className="text-xs mt-1">{t('session_restored_video_desc')}</p>
          </div>
        </div>
      )}

      {/* Top row: upload panel + metadata */}
      <div className="grid grid-cols-3 gap-6 mb-6">
        {/* Upload panel */}
        <div className="col-span-1 bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex flex-col items-center">
          <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mb-4">
            <UploadCloud size={32} />
          </div>
          <h3 className="text-lg font-bold mb-2 text-[#111111]">{t('upload_video')}</h3>
          <p className="text-xs text-gray-500 mb-4 text-center">{t('supported_formats')}</p>

          <label className="cursor-pointer px-6 py-2 bg-gray-100 text-gray-700 font-semibold rounded-lg hover:bg-gray-200 transition-colors shadow-sm flex items-center gap-2 mb-3 border border-gray-300 w-full justify-center">
            <FileVideo size={18} />
            {file ? t('change_file') : t('select_video')}
            <input type="file" accept="video/*" className="hidden" onChange={handleFileChange} />
          </label>

          {file && (
            <p className="text-xs text-gray-500 text-center truncate w-full px-2 mb-3">{file.name}</p>
          )}

          <button
            onClick={handleVerify}
            disabled={!file || isVerifying}
            className={`w-full py-2.5 font-bold rounded-lg transition-colors shadow-sm flex items-center justify-center gap-2 ${
              !file || isVerifying
                ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                : "bg-blue-600 text-white hover:bg-blue-700"
            }`}
          >
            {isVerifying ? (
              <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full" />
            ) : (
              <ShieldCheck size={18} />
            )}
            {isVerifying ? t('verifying_content') : t('run_ai_moderation')}
          </button>
        </div>

        {/* Metadata fields */}
        <div className="col-span-2 bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex flex-col gap-4">
          <h3 className="text-xl font-bold text-[#111111] mb-6 flex items-center gap-2">
            <FileText className="text-blue-500" size={24} />
            {t('video_metadata')} <span className="text-sm font-normal text-gray-400">({t('optional_label')})</span>
          </h3>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">{t('title_label')}</label>
            <input 
              type="text" 
              placeholder={t('enter_video_title')}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">{t('description_label')}</label>
            <textarea 
              placeholder={t('video_description_placeholder')}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none resize-none"
            />
          </div>
        </div>
      </div>

      {/* Video preview + AI results side by side */}
      {(videoUrl || result) && (
        <div className="grid grid-cols-2 gap-6">

          {/* Video preview */}
          {videoUrl && (
            <div className="bg-black rounded-xl overflow-hidden border border-gray-800 shadow-lg flex flex-col">
              <div className="relative flex-1">
                <video
                  ref={videoRef}
                  src={videoUrl}
                  className="w-full max-h-[340px] object-contain bg-black"
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                  onEnded={() => setIsPlaying(false)}
                  controls
                />
              </div>
              <div className="p-3 bg-gray-900 flex items-center gap-3">
                <button
                  onClick={togglePlay}
                  className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors text-white"
                >
                  {isPlaying ? <Pause size={16} /> : <Play size={16} />}
                </button>
                <span className="text-xs text-gray-400 truncate">{file?.name}</span>
              </div>
            </div>
          )}

          {/* AI moderation results */}
          <div className="bg-gray-50 p-6 rounded-xl border border-gray-200 flex flex-col">
            <h3 className="font-bold text-[#111111] mb-4 flex items-center gap-2">
              <ShieldCheck className="text-gray-500" size={20} />
              {t('ai_moderation_results')}
            </h3>

            {!result ? (
              <div className="flex-1 flex items-center justify-center text-gray-400 italic text-sm text-center py-12">
                {t('ai_results_placeholder')}
              </div>
            ) : (
              <div className="space-y-4 animate-in fade-in duration-300">
                <div className="flex items-center gap-3">
                  <span className={`px-3 py-1 rounded-full text-sm font-bold border ${
                    result.status === "Approved" || result.status === "Published"
                      ? "bg-green-100 text-green-700 border-green-200"
                      : result.status === "Declined" || result.status === "Rejected"
                      ? "bg-red-100 text-red-700 border-red-200"
                      : "bg-yellow-100 text-yellow-700 border-yellow-200"
                  }`}>
                    {result.status}
                  </span>
                  <span className="text-sm text-gray-500 font-medium">
                    {t('confidence_label')}: {result.confidence}%
                  </span>
                </div>

                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                  <div className="flex items-center gap-2 text-emerald-700 mb-2 font-bold uppercase tracking-wider text-xs">
                    <AlertTriangle size={14} />
                    {t('summary_explanation')}
                  </div>
                  <p className="text-[14px] text-gray-700 leading-relaxed italic">
                    "{result.reason}"
                  </p>
                </div>

                {/* Moderation Controls */}
                {result.status === "Approved" && !showConfirmOverride && (
                  <div className="flex gap-3 pt-1">
                    <button
                      onClick={handleConfirmUpload}
                      disabled={isUploading}
                      className="flex-1 py-2.5 bg-[#163e2c] text-white font-bold rounded-xl hover:bg-[#1b4b35] transition-all shadow-md active:scale-[0.98] disabled:opacity-50 text-sm"
                    >
                      {isUploading ? t('uploading_aws') : t('confirm_upload')}
                    </button>
                    <button
                      onClick={() => setShowConfirmOverride("reject")}
                      disabled={isUploading}
                      className="flex-1 py-2.5 bg-white text-red-600 border border-red-100 font-bold rounded-xl hover:bg-red-50 transition-all shadow-sm text-sm"
                    >
                      {t('reject_anyways')}
                    </button>
                  </div>
                )}

                {result.status === "Declined" && !showConfirmOverride && (
                  <div className="flex gap-3 pt-1">
                    <button
                      onClick={handleConfirmReject}
                      className="flex-1 py-2.5 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition-all shadow-md active:scale-[0.98] text-sm"
                    >
                      {t('confirm_reject')}
                    </button>
                    <button
                      onClick={() => setShowConfirmOverride("accept")}
                      className="flex-1 py-2.5 bg-white text-emerald-600 border border-emerald-100 font-bold rounded-xl hover:bg-emerald-50 transition-all shadow-sm text-sm"
                    >
                      {t('accept_anyways')}
                    </button>
                  </div>
                )}

                {showConfirmOverride && (
                  <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl animate-in zoom-in-95 duration-200">
                    <p className="text-amber-900 font-bold mb-3 text-center text-sm">
                      {showConfirmOverride === "reject" ? t('confirm_reject_q') : t('confirm_accept_q')}
                    </p>
                    <div className="flex gap-3">
                      <button
                        onClick={showConfirmOverride === "reject" ? handleConfirmReject : handleConfirmUpload}
                        className="flex-1 py-2 bg-amber-600 text-white font-bold rounded-lg hover:bg-amber-700 transition-colors shadow-sm text-sm"
                      >
                        {t('yes')}
                      </button>
                      <button
                        onClick={() => setShowConfirmOverride(null)}
                        className="flex-1 py-2 bg-white text-amber-900 border border-amber-300 font-bold rounded-lg hover:bg-amber-100 transition-colors text-sm"
                      >
                        {t('no')}
                      </button>
                    </div>
                  </div>
                )}

                {uploadStatus && (
                  <div className={`text-sm font-bold p-3 rounded-lg text-center ${
                    uploadStatus.includes('Error') || uploadStatus.includes('error')
                      ? 'bg-red-50 text-red-700'
                      : 'bg-green-50 text-green-700'
                  }`}>
                    {uploadStatus}
                  </div>
                )}

                {/* Transcript */}
                <div className="bg-white p-4 rounded-lg border border-gray-200">
                  <div className="flex items-center gap-2 text-gray-700 mb-2 font-semibold text-sm">
                    <FileText size={15} />
                    {t('whisper_transcript')}
                  </div>
                  <div className="text-xs text-gray-600 max-h-28 overflow-y-auto pr-1 leading-relaxed">
                    {result.transcript || t('no_transcript')}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Placeholder when nothing uploaded yet */}
      {!videoUrl && !result && (
        <div className="bg-gray-50 rounded-xl border border-gray-200 p-12 flex flex-col items-center justify-center text-gray-400">
          <FileVideo size={48} className="mb-4 opacity-30" />
          <p className="text-sm italic">{t('ai_results_placeholder')}</p>
        </div>
      )}
    </div>
  );
}
