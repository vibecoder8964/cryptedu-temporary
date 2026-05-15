import { useState } from "react";
import type { FileEntry, ExamPair } from "../lib/types";
import { buildFileEntry, makeId } from "../lib/utils";
import DropZone from "./DropZone";
import FileRow from "./FileRow";
import { useSettings } from "../../../lib/SettingsContext";

type Props = {
  examPairs: ExamPair[];
  setExamPairs: React.Dispatch<React.SetStateAction<ExamPair[]>>;
  onBack: () => void;
  onTrain: () => void;
};

export default function ExamPage({ examPairs, setExamPairs, onBack, onTrain }: Props) {
  const { t } = useSettings();
  const [stagedQ, setStagedQ] = useState<FileEntry | null>(null);
  const [stagedA, setStagedA] = useState<FileEntry | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2400);
  }

  function queuePair() {
    if (!stagedQ || !stagedA) return;
    const pair: ExamPair = { pairId: makeId(), question: stagedQ, answer: stagedA };
    setExamPairs((prev) => [...prev, pair]);
    setStagedQ(null);
    setStagedA(null);
    showToast(`Pair ${examPairs.length + 1} queued ✓`);
  }

  function removePair(id: string) {
    setExamPairs((prev) => prev.filter((p) => p.pairId !== id));
  }

  const canQueue = !!stagedQ && !!stagedA;
  const canTrain = examPairs.length > 0;

  return (
    <div>
      <h1 className="text-[25px] font-bold text-[#111111] mb-2">📝 {t('exam_papers_title')}</h1>
      <p className="text-sm text-gray-600 mb-8 leading-relaxed">
        {t('exam_papers_desc')}
      </p>

      {/* Warning alert */}
      <div className="flex gap-3 p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-[16px] mb-6 leading-relaxed">
        <span className="flex-shrink-0 mt-0.5">⚠️</span>
        <span>
          {t('exam_warning')}
        </span>
      </div>

      {/* Split upload */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {/* Left: Question */}
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-1 text-[18px] font-bold text-[#111111]">
            {t('question_paper')}
            <span className="text-[12px] font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-700">Q</span>
          </div>
          <div className="text-[14px] text-gray-500 mb-4">{t('question_paper_sub')}</div>
          {stagedQ ? (
            <div className="flex flex-col gap-2">
              <FileRow
                entry={stagedQ}
                onRemove={() => setStagedQ(null)}
                accentBorder="border-blue-300"
              />
              <p className="text-[14px] font-semibold text-blue-600">✓ {t('staged_question')}</p>
            </div>
          ) : (
            <DropZone
              label={t('question_paper')}
              sublabel={t('click_drag_one')}
              accept=".pdf,.docx,.doc,.txt"
              onFiles={(files) => setStagedQ(buildFileEntry(files[0], "question"))}
              accentClass="border-blue-400 bg-blue-50"
            />
          )}
        </div>

        {/* Right: Answer */}
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-1 text-[18px] font-bold text-[#111111]">
            {t('marking_scheme')}
            <span className="text-[12px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-[#10B981]">A</span>
          </div>
          <div className="text-[14px] text-gray-500 mb-4">{t('marking_scheme_sub')}</div>
          {stagedA ? (
            <div className="flex flex-col gap-2">
              <FileRow
                entry={stagedA}
                onRemove={() => setStagedA(null)}
                accentBorder="border-emerald-300"
              />
              <p className="text-[14px] font-semibold text-[#10B981]">✓ {t('staged_marking')}</p>
            </div>
          ) : (
            <DropZone
              label={t('marking_scheme')}
              sublabel={t('click_drag_one')}
              accept=".pdf,.docx,.doc,.txt"
              onFiles={(files) => setStagedA(buildFileEntry(files[0], "answer"))}
              accentClass="border-[#10B981] bg-emerald-50"
            />
          )}
        </div>
      </div>

      {/* Queue button */}
      <div className="flex items-center gap-4 mb-8">
        <button
          onClick={queuePair}
          disabled={!canQueue}
          className="px-6 py-3 rounded-xl text-[18px] font-bold bg-white border-2 border-gray-200 hover:border-gray-300 text-[#111111] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
        >
          ✚ {t('queue_pair')}
        </button>
        <span className="text-[16px] text-gray-500 font-medium">
          {canQueue
            ? "Both files ready"
            : t('queue_requirement')}
        </span>
      </div>

      {/* Queued pairs */}
      {examPairs.length > 0 && (
        <div className="mb-8">
          <div className="text-[16px] font-bold text-gray-500 uppercase tracking-wider mb-3">
            {t('total_exam_pairs')}{" "}
            <span className="text-[#10B981] ml-1">{examPairs.length}</span>
          </div>
          <div className="flex flex-col gap-3">
            {examPairs.map((pair, i) => (
              <div
                key={pair.pairId}
                className="bg-white border-2 border-gray-100 rounded-xl px-5 py-4 flex items-start gap-4 shadow-sm"
              >
                <span className="text-[14px] font-bold text-gray-500 bg-gray-100 border border-gray-200 rounded-md px-3 py-1 flex-shrink-0 mt-0.5">
                  #{i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-[16px] font-semibold text-blue-600 truncate mb-1">Q: {pair.question.name}</div>
                  <div className="text-[16px] font-semibold text-[#10B981] truncate">A: {pair.answer.name}</div>
                </div>
                <button
                  onClick={() => removePair(pair.pairId)}
                  className="text-gray-400 hover:text-red-500 text-[18px] font-bold flex-shrink-0 transition-colors px-2"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action row */}
      <div className="flex gap-4 flex-wrap border-t border-gray-200 pt-8">
        <button
          onClick={onBack}
          className="px-6 py-3 rounded-xl text-[18px] font-semibold bg-white border-2 border-gray-200 hover:border-gray-300 text-[#111111] transition-colors"
        >
          ← {t('back')}
        </button>
        <button
          onClick={() => { setStagedQ(null); setStagedA(null); showToast("Add your next pair"); }}
          className="px-6 py-3 rounded-xl text-[18px] font-semibold bg-blue-50 border border-blue-200 text-blue-600 hover:bg-blue-100 transition-colors"
        >
          📎 {t('more_exam_papers')}
        </button>
        <button
          onClick={onTrain}
          disabled={!canTrain}
          className="px-8 py-3 rounded-xl text-[18px] font-bold bg-[#10B981] text-white hover:bg-[#059669] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          🚀 {t('prepare_training')}
        </button>
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-8 right-8 bg-white border border-gray-200 rounded-xl px-6 py-4 text-[16px] font-bold text-[#111111] shadow-2xl z-50 animate-pulse">
          ✓ {toast}
        </div>
      )}
    </div>
  );
}
