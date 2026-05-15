import type { FileEntry } from "../lib/types";
import { formatBytes } from "../lib/utils";

const extColors: Record<string, string> = {
  pdf: "bg-red-50 text-red-700 border border-red-200",
  docx: "bg-blue-50 text-blue-700 border border-blue-200",
  doc: "bg-blue-50 text-blue-700 border border-blue-200",
  txt: "bg-gray-100 text-gray-700 border border-gray-300",
};

const extIcons: Record<string, string> = {
  pdf: "📕",
  docx: "📘",
  doc: "📘",
  txt: "📄",
};

type Props = {
  entry: FileEntry;
  onRemove: () => void;
  accentBorder?: string;
};

export default function FileRow({ entry, onRemove, accentBorder }: Props) {
  return (
    <div
      className={`flex items-center gap-4 rounded-xl px-5 py-3 text-[16px] bg-white border-2 shadow-sm ${
        accentBorder ?? "border-gray-200"
      }`}
    >
      <span className="text-[20px] flex-shrink-0">{extIcons[entry.ext] ?? "📄"}</span>
      <span className="flex-1 min-w-0 truncate text-[#111111] font-semibold">{entry.name}</span>
      <span
        className={`text-[12px] font-bold px-3 py-1 rounded-md flex-shrink-0 uppercase tracking-wide ${
          extColors[entry.ext] ?? "bg-gray-100 text-gray-700 border border-gray-300"
        }`}
      >
        {entry.ext.toUpperCase()}
      </span>
      <span className="text-[14px] text-gray-500 font-medium flex-shrink-0 min-w-[60px] text-right">{formatBytes(entry.size)}</span>
      <button
        onClick={onRemove}
        className="text-gray-400 hover:text-red-500 text-[20px] font-bold flex-shrink-0 transition-colors pl-2"
        title="Remove"
      >
        ✕
      </button>
    </div>
  );
}
