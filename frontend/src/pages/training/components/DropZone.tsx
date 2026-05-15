import { useRef, useState } from "react";
import { useSettings } from "../../../lib/SettingsContext";

type Props = {
  label: string;
  sublabel: string;
  accept: string;
  multiple?: boolean;
  onFiles: (files: File[]) => void;
  accentClass?: string;
};

export default function DropZone({
  label,
  sublabel,
  accept,
  multiple = false,
  onFiles,
  accentClass = "border-emerald-400 bg-emerald-500/10",
}: Props) {
  const { t } = useSettings();
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const files = Array.from(e.dataTransfer.files).filter((f) =>
      accept
        .split(",")
        .some((a) => f.name.toLowerCase().endsWith(a.trim().replace(".", "")))
    );
    if (files.length) onFiles(files);
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length) onFiles(files);
    // reset so same file can be re-added after removal
    e.target.value = "";
  }

  return (
    <div
      className={`relative rounded-xl border-2 border-dashed border-gray-300 bg-white p-10 text-center cursor-pointer transition-all duration-200 ${
        dragging ? accentClass : "hover:border-[#10B981] hover:bg-emerald-50"
      }`}
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        className="hidden"
        onChange={handleChange}
      />
      <div className="text-4xl mb-4">📂</div>
      <div className="text-[20px] font-bold text-[#111111] mb-1">{label}</div>
      <div className="text-[16px] text-gray-500">{sublabel}</div>
      <div className="flex gap-2 justify-center mt-4 flex-wrap">
        {accept.split(",").map((a) => (
          <span
            key={a}
            className="text-[12px] font-bold px-3 py-1 rounded-full bg-gray-100 border border-gray-200 text-gray-600 uppercase tracking-wide"
          >
            {a.trim().toUpperCase().replace(".", "")}
          </span>
        ))}
        {multiple && (
          <span className="text-[12px] font-bold px-3 py-1 rounded-full bg-gray-100 border border-gray-200 text-gray-600 uppercase tracking-wide">
            {t('multifile')}
          </span>
        )}
      </div>
    </div>
  );
}
