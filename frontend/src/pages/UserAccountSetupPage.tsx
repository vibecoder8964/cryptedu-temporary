import { useState, useRef } from "react";
import { Upload, Users, CheckCircle, AlertCircle, FileSpreadsheet, X } from "lucide-react";
import Papa from "papaparse";

interface AccountRow {
  username: string;
  password: string;
}

interface UploadResult {
  accounts_parsed: number;
  created: number;
  skipped: number;
  errors: string[];
}

export default function UserAccountSetupPage() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<AccountRow[]>([]);
  const [parseError, setParseError] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = (f: File) => {
    setFile(f);
    setResult(null);
    setParseError("");
    setPreview([]);

    const name = f.name.toLowerCase();
    if (name.endsWith(".csv")) {
      Papa.parse(f, {
        complete: (res) => {
          const rows: AccountRow[] = [];
          let start = 0;
          const data = res.data as string[][];
          if (data[0] && data[0][0]?.toLowerCase().match(/user|email/)) start = 1;
          for (let i = start; i < data.length; i++) {
            const row = data[i];
            if (row[0]?.trim() && row[1]?.trim()) {
              rows.push({ username: row[0].trim(), password: row[1].trim() });
            }
          }
          if (rows.length === 0) {
            setParseError("No valid rows found. Ensure column 1 = username, column 2 = password.");
          } else {
            setPreview(rows);
          }
        },
        error: () => setParseError("Failed to parse CSV file."),
      });
    } else if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
      // For Excel, we'll let the backend parse it — just show filename
      setPreview([]);
      setParseError("");
    } else {
      setParseError("Only .csv and .xlsx files are supported.");
      setFile(null);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  const handleSubmit = async () => {
    if (!file) return;
    setIsUploading(true);
    setResult(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/end-users/bulk-create", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Upload failed");
      }
      const data = await res.json();
      setResult(data);
    } catch (e: unknown) {
      setParseError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setIsUploading(false);
    }
  };

  const clearFile = () => {
    setFile(null);
    setPreview([]);
    setParseError("");
    setResult(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-[#163e2c] mb-1">User Account Setup</h2>
        <p className="text-sm text-gray-500">
          Upload a CSV or Excel file to bulk-create end-user accounts. Column 1: username, Column 2: password.
        </p>
      </div>

      {/* Upload Zone */}
      {!file && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all ${
            dragOver ? "border-[#163e2c] bg-[#f0f7f4]" : "border-gray-300 hover:border-[#163e2c] hover:bg-[#f9fdf9]"
          }`}
        >
          <FileSpreadsheet size={48} className="mx-auto mb-4 text-[#163e2c] opacity-60" />
          <p className="text-lg font-semibold text-gray-700 mb-1">Drop your file here or click to browse</p>
          <p className="text-sm text-gray-400">Supports .csv and .xlsx files</p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            className="hidden"
            onChange={(e) => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }}
          />
        </div>
      )}

      {/* File selected */}
      {file && !result && (
        <div className="border border-gray-200 rounded-xl p-4 bg-white shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <FileSpreadsheet size={24} className="text-[#163e2c]" />
              <div>
                <p className="font-semibold text-gray-800">{file.name}</p>
                <p className="text-xs text-gray-400">{(file.size / 1024).toFixed(1)} KB</p>
              </div>
            </div>
            <button onClick={clearFile} className="text-gray-400 hover:text-red-500 transition-colors">
              <X size={20} />
            </button>
          </div>

          {parseError && (
            <div className="flex items-center gap-2 text-red-600 bg-red-50 rounded-lg p-3 mb-4 text-sm">
              <AlertCircle size={16} />
              {parseError}
            </div>
          )}

          {preview.length > 0 && (
            <div className="mb-4">
              <p className="text-sm font-semibold text-gray-600 mb-2">
                Preview — {preview.length} account{preview.length !== 1 ? "s" : ""} found
              </p>
              <div className="overflow-auto max-h-64 rounded-lg border border-gray-100">
                <table className="w-full text-sm">
                  <thead className="bg-[#f0f7f4] sticky top-0">
                    <tr>
                      <th className="text-left px-4 py-2 text-[#163e2c] font-semibold">#</th>
                      <th className="text-left px-4 py-2 text-[#163e2c] font-semibold">Username</th>
                      <th className="text-left px-4 py-2 text-[#163e2c] font-semibold">Password</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.slice(0, 50).map((row, i) => (
                      <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                        <td className="px-4 py-2 text-gray-400">{i + 1}</td>
                        <td className="px-4 py-2 text-gray-800 font-medium">{row.username}</td>
                        <td className="px-4 py-2 text-gray-400">{"•".repeat(Math.min(row.password.length, 8))}</td>
                      </tr>
                    ))}
                    {preview.length > 50 && (
                      <tr>
                        <td colSpan={3} className="px-4 py-2 text-center text-gray-400 text-xs">
                          ... and {preview.length - 50} more
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {file.name.toLowerCase().endsWith('.xlsx') && preview.length === 0 && !parseError && (
            <div className="mb-4 p-3 bg-blue-50 rounded-lg text-sm text-blue-700">
              Excel file selected. The server will parse it on upload.
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={handleSubmit}
              disabled={isUploading || !!parseError}
              className="flex items-center gap-2 px-6 py-2.5 bg-[#163e2c] text-white rounded-lg font-semibold hover:bg-[#1b4b35] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isUploading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Creating accounts...
                </>
              ) : (
                <>
                  <Upload size={16} />
                  Create Accounts
                </>
              )}
            </button>
            <button
              onClick={clearFile}
              className="px-6 py-2.5 border border-gray-300 text-gray-600 rounded-lg font-semibold hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="border border-gray-200 rounded-xl p-6 bg-white shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <CheckCircle size={28} className="text-green-500" />
            <h3 className="text-lg font-bold text-gray-800">Upload Complete</h3>
          </div>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="bg-green-50 rounded-lg p-4 text-center">
              <p className="text-3xl font-bold text-green-600">{result.created}</p>
              <p className="text-sm text-green-700 font-medium mt-1">Created</p>
            </div>
            <div className="bg-yellow-50 rounded-lg p-4 text-center">
              <p className="text-3xl font-bold text-yellow-600">{result.skipped}</p>
              <p className="text-sm text-yellow-700 font-medium mt-1">Skipped (duplicate)</p>
            </div>
            <div className="bg-blue-50 rounded-lg p-4 text-center">
              <p className="text-3xl font-bold text-blue-600">{result.accounts_parsed}</p>
              <p className="text-sm text-blue-700 font-medium mt-1">Total Parsed</p>
            </div>
          </div>
          {result.errors.length > 0 && (
            <div className="bg-red-50 rounded-lg p-3 mb-4">
              <p className="text-sm font-semibold text-red-700 mb-1">Errors:</p>
              {result.errors.map((e, i) => (
                <p key={i} className="text-xs text-red-600">{e}</p>
              ))}
            </div>
          )}
          <button
            onClick={clearFile}
            className="flex items-center gap-2 px-6 py-2.5 bg-[#163e2c] text-white rounded-lg font-semibold hover:bg-[#1b4b35] transition-colors"
          >
            <Users size={16} />
            Upload Another File
          </button>
        </div>
      )}

      {/* Info box */}
      <div className="mt-6 bg-[#f0f7f4] rounded-xl p-4 border border-[#d1e7dd]">
        <h4 className="font-semibold text-[#163e2c] mb-2 flex items-center gap-2">
          <Users size={16} />
          How it works
        </h4>
        <ul className="text-sm text-gray-600 space-y-1 list-disc list-inside">
          <li>Prepare a CSV or Excel file with exactly 2 columns: username and password</li>
          <li>The first row can optionally be a header (it will be skipped automatically)</li>
          <li>Accounts are created in the system and can be used to log in to the end-user app</li>
          <li>Duplicate usernames are skipped without error</li>
          <li>Passwords are securely hashed before storage</li>
        </ul>
      </div>
    </div>
  );
}
