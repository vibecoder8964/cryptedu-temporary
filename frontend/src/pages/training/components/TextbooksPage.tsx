import type { FileEntry } from "../lib/types";
import { buildFileEntry, formatBytes } from "../lib/utils";
import DropZone from "./DropZone";
import FileRow from "./FileRow";
import { useSettings } from "../../../lib/SettingsContext";

type Props = {
  textbooks: FileEntry[];
  setTextbooks: React.Dispatch<React.SetStateAction<FileEntry[]>>;
  onNext: () => void;
};

export default function TextbooksPage({ textbooks, setTextbooks, onNext }: Props) {
  const { t } = useSettings();

  function addFiles(files: File[]) {
    setTextbooks((prev) => {
      const existing = new Set(prev.map((e) => e.name + e.size));
      const fresh = files
        .filter((f) => !existing.has(f.name + f.size))
        .map((f) => buildFileEntry(f, "textbook"));
      return [...prev, ...fresh];
    });
  }

  function remove(id: string) {
    setTextbooks((prev) => prev.filter((e) => e.id !== id));
  }

  const totalSize = textbooks.reduce((s, f) => s + f.size, 0);
  const formats = [...new Set(textbooks.map((f) => f.ext.toUpperCase()))].join(", ");

  return (
    <div>
      <h1 className="text-[25px] font-bold text-[#111111] mb-2">📚 {t('upload_kpm_textbooks')}</h1>
      <p className="text-sm text-gray-600 mb-8 leading-relaxed">
        {t('textbooks_desc')}
      </p>

      {/* Info alert */}
      <div className="flex gap-3 p-4 rounded-xl bg-blue-50 border border-blue-200 text-blue-800 text-[16px] mb-6 leading-relaxed">
        <span className="flex-shrink-0 mt-0.5">💡</span>
        <span>
          {t('textbooks_tip')}
        </span>
      </div>

      <DropZone
        label={t('browse_drag')}
        sublabel={t('textbooks_sub')}
        accept=".pdf,.docx,.doc,.txt"
        multiple
        onFiles={addFiles}
        accentClass="border-[#10B981] bg-emerald-50"
      />

      {/* Stats bar */}
      {textbooks.length > 0 && (
        <div className="flex gap-8 mt-6 p-6 bg-gray-50 border border-gray-200 rounded-xl">
          <div>
            <div className="text-[24px] font-bold text-[#10B981]">{textbooks.length}</div>
            <div className="text-[14px] text-gray-500 uppercase tracking-wider font-semibold">{t('files_loaded')}</div>
          </div>
          <div>
            <div className="text-[24px] font-bold text-blue-600">{formatBytes(totalSize)}</div>
            <div className="text-[14px] text-gray-500 uppercase tracking-wider font-semibold">{t('total_size')}</div>
          </div>
          <div>
            <div className="text-[24px] font-bold text-amber-500">{formats || "—"}</div>
            <div className="text-[14px] text-gray-500 uppercase tracking-wider font-semibold">{t('formats')}</div>
          </div>
          <div>
            <div className="text-[24px] font-bold text-[#111111]">
              ~{(textbooks.length * 80).toLocaleString()}
            </div>
            <div className="text-[14px] text-gray-500 uppercase tracking-wider font-semibold">{t('est_training_samples')}</div>
          </div>
        </div>
      )}

      {/* File list */}
      {textbooks.length > 0 && (
        <div className="mt-6 flex flex-col gap-2">
          <div className="text-[16px] font-bold text-gray-500 uppercase tracking-wider mb-2">
            {t('uploaded_files')} ({textbooks.length})
          </div>
          {textbooks.map((entry) => (
            <FileRow key={entry.id} entry={entry} onRemove={() => remove(entry.id)} />
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-4 mt-10 flex-wrap">
        <button
          className="px-6 py-3 rounded-xl text-[18px] font-semibold bg-white text-[#111111] border-2 border-gray-200 hover:border-gray-300 transition-colors"
          onClick={() => document.querySelector<HTMLInputElement>('input[type="file"]')?.click()}
        >
          {t('add_more')}
        </button>
        <button
          className="px-8 py-3 rounded-xl text-[18px] font-bold bg-[#10B981] text-white hover:bg-[#059669] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          onClick={onNext}
          disabled={textbooks.length === 0}
        >
          {t('done_next_exam')}
        </button>
      </div>
    </div>
  );
}
