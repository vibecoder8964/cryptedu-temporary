import { useState, useEffect } from "react";
import { useSettings } from "../../../lib/SettingsContext";
import type { FileEntry, ExamPair, Page } from "../lib/types";
import Stepper from "./Stepper";
import TextbooksPage from "./TextbooksPage";
import ExamPage from "./ExamPage";
import ReadyPage from "./ReadyPage";
import { AlertTriangle } from "lucide-react";

const STORAGE_KEY_PAGE = "slm_training_page";
const STORAGE_KEY_TB_META = "slm_training_textbooks_meta";
const STORAGE_KEY_EXAM_META = "slm_training_exam_meta";

export default function TrainingPortal() {
  // Restore step from localStorage
  const savedPage = (localStorage.getItem(STORAGE_KEY_PAGE) || "textbooks") as Page;
  const [page, setPage] = useState<Page>(savedPage);
  const [textbooks, setTextbooks] = useState<FileEntry[]>([]);
  const [examPairs, setExamPairs] = useState<ExamPair[]>([]);
  const [showRefreshWarning, setShowRefreshWarning] = useState(false);

  const { t } = useSettings();

  // Check if we restored from a previous session (files lost but step preserved)
  useEffect(() => {
    const savedTbMeta = localStorage.getItem(STORAGE_KEY_TB_META);
    const savedExamMeta = localStorage.getItem(STORAGE_KEY_EXAM_META);
    if (savedPage !== "textbooks" && (savedTbMeta || savedExamMeta)) {
      // User was mid-progress but files are gone due to refresh
      setShowRefreshWarning(true);
    }
  }, []);

  // Persist step changes
  const changePage = (newPage: Page) => {
    setPage(newPage);
    localStorage.setItem(STORAGE_KEY_PAGE, newPage);
  };

  // Persist file metadata (names/sizes — not actual blobs)
  useEffect(() => {
    if (textbooks.length > 0) {
      const meta = textbooks.map(tb => ({ name: tb.name, size: tb.size, ext: tb.ext }));
      localStorage.setItem(STORAGE_KEY_TB_META, JSON.stringify(meta));
    }
  }, [textbooks]);

  useEffect(() => {
    if (examPairs.length > 0) {
      const meta = examPairs.map(p => ({
        pairId: p.pairId,
        question: { name: p.question.name, size: p.question.size, ext: p.question.ext },
        answer: { name: p.answer.name, size: p.answer.size, ext: p.answer.ext },
      }));
      localStorage.setItem(STORAGE_KEY_EXAM_META, JSON.stringify(meta));
    }
  }, [examPairs]);

  const handleReset = () => {
    setTextbooks([]);
    setExamPairs([]);
    changePage("textbooks");
    setShowRefreshWarning(false);
    localStorage.removeItem(STORAGE_KEY_PAGE);
    localStorage.removeItem(STORAGE_KEY_TB_META);
    localStorage.removeItem(STORAGE_KEY_EXAM_META);
  };

  // Get saved metadata for display in warning
  const savedTbCount = (() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY_TB_META) || "[]").length; } catch { return 0; }
  })();
  const savedExamCount = (() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY_EXAM_META) || "[]").length; } catch { return 0; }
  })();

  return (
    <div className="flex flex-col h-full">
      {/* Stepper bar */}
      <div className="bg-white border-b border-gray-200 px-8 py-4 flex items-center justify-between">
        <div>
          <h2 className="text-[25px] font-bold text-[#111111]">{t('nav_training')}</h2>
          <p className="text-sm text-gray-500 mt-1">{t('training_subtitle')}</p>
        </div>
        <Stepper current={page} />
      </div>

      {/* Refresh warning */}
      {showRefreshWarning && textbooks.length === 0 && examPairs.length === 0 && (
        <div className="mx-8 mt-6 p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
          <AlertTriangle className="text-amber-600 flex-shrink-0 mt-0.5" size={20} />
          <div className="flex-1">
            <p className="text-sm font-bold text-amber-800 mb-1">Session restored — files need re-upload</p>
            <p className="text-xs text-amber-700">
              You were on step "{page}" with {savedTbCount} textbook(s) and {savedExamCount} exam pair(s).
              File data cannot persist across browser refreshes — please re-upload your files to continue.
            </p>
            <div className="flex gap-3 mt-3">
              <button
                onClick={() => setShowRefreshWarning(false)}
                className="px-4 py-1.5 text-xs font-bold bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors"
              >
                Continue from Step {page === "exam" ? "2" : page === "ready" ? "3" : "1"}
              </button>
              <button
                onClick={handleReset}
                className="px-4 py-1.5 text-xs font-bold bg-white text-amber-800 border border-amber-300 rounded-lg hover:bg-amber-100 transition-colors"
              >
                Start Over
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="p-8 max-w-5xl flex-1 overflow-y-auto">
        {page === "textbooks" && (
          <TextbooksPage
            textbooks={textbooks}
            setTextbooks={setTextbooks}
            onNext={() => changePage("exam")}
          />
        )}
        {page === "exam" && (
          <ExamPage
            examPairs={examPairs}
            setExamPairs={setExamPairs}
            onBack={() => changePage("textbooks")}
            onTrain={() => changePage("ready")}
          />
        )}
        {page === "ready" && (
          <ReadyPage
            textbooks={textbooks}
            examPairs={examPairs}
            onBack={() => changePage("exam")}
            onReset={handleReset}
          />
        )}
      </div>
    </div>
  );
}
