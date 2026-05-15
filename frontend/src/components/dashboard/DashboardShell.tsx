import { useState, useEffect } from "react";
import Sidebar from "./Sidebar";
import { useSettings } from "../../lib/SettingsContext";

export default function DashboardShell({
  title,
  subtitle,
  children,
  onLogout,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  onLogout?: () => void;
}) {
  const { t, isTranslating } = useSettings();
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    const checkBackend = async () => {
      try {
        const res = await fetch("http://localhost:8000/");
        setIsOnline(res.ok);
      } catch (e) {
        setIsOnline(false);
      }
    };
    checkBackend();
    const interval = setInterval(checkBackend, 10000);
    return () => clearInterval(interval);
  }, []);

  const gmtDate = new Date().toLocaleDateString("en-GB", {
    timeZone: "GMT",
    day: "2-digit",
    month: "short",
    year: "numeric"
  }) + " (GMT +0:00)";

  return (
    <div className="flex min-h-screen bg-[#f4f7f4] font-sans">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top header bar */}
        <header className="flex items-center justify-between px-8 py-5 border-b border-[#e2eae2] bg-white shrink-0 relative z-20">
          <div>
            <h1 className="text-[25px] font-bold leading-tight text-[#111111]">
              {title}
            </h1>
            {subtitle && (
              <p className="text-sm mt-1 text-gray-500">
                {subtitle}
              </p>
            )}
          </div>
          <div className="flex items-center gap-4">
            <div className={`text-xs px-4 py-1.5 rounded-full font-bold transition-all duration-500 border flex items-center gap-2 ${
              isOnline 
                ? "bg-[#e8f5e9] text-[#2d5a2d] border-[#c8e6c9] shadow-sm" 
                : "bg-red-50 text-red-700 border-red-200 shadow-sm"
            }`}>
              <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-[#2d5a2d] animate-pulse' : 'bg-red-600'}`}></span>
              {isOnline ? t("system_online") : "System Offline"}
            </div>
            {isTranslating && (
              <div className="flex items-center gap-2 px-4 py-1.5 bg-blue-50 text-blue-700 border border-blue-100 rounded-full text-xs font-bold animate-pulse">
                <div className="w-2 h-2 bg-blue-600 rounded-full animate-ping"></div>
                Translating UI...
              </div>
            )}
            <div className="text-sm font-bold text-gray-500 bg-gray-50 px-4 py-1.5 rounded-xl border border-gray-100 shadow-inner">
              {gmtDate}
            </div>
          </div>
        </header>

        {/* Background Decorative Widgets */}
        <div className="fixed inset-0 pointer-events-none overflow-hidden z-0 opacity-[0.05]">
          {/* Pile of Books */}
          <div className="absolute top-[10%] left-[5%] animate-float-slow">
            <svg width="120" height="120" viewBox="0 0 24 24" fill="none" stroke="#2d6a4f" strokeWidth="0.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z"/><path d="M12 6v10"/></svg>
          </div>
          {/* Lightbulb */}
          <div className="absolute top-[15%] right-[8%] animate-float-delayed">
            <svg width="140" height="140" viewBox="0 0 24 24" fill="none" stroke="#2d6a4f" strokeWidth="0.8" strokeLinecap="round" strokeLinejoin="round"><path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A5 5 0 0 0 8 8c0 1.3.5 2.6 1.5 3.5.8.8 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/></svg>
          </div>
          {/* Graduation Cap */}
          <div className="absolute top-[45%] left-[12%] animate-float">
            <svg width="110" height="110" viewBox="0 0 24 24" fill="none" stroke="#2d6a4f" strokeWidth="0.8" strokeLinecap="round" strokeLinejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2v-5"/></svg>
          </div>
          {/* Calendar */}
          <div className="absolute bottom-[15%] right-[15%] animate-float-slow">
            <svg width="130" height="130" viewBox="0 0 24 24" fill="none" stroke="#2d6a4f" strokeWidth="0.8" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>
          </div>
          {/* Pencil and Ruler */}
          <div className="absolute bottom-[20%] left-[18%] animate-float-delayed">
            <svg width="100" height="100" viewBox="0 0 24 24" fill="none" stroke="#2d6a4f" strokeWidth="0.8" strokeLinecap="round" strokeLinejoin="round"><path d="m15 5 4 4"/><path d="M13 7 8.7 2.7a2.4 2.4 0 1 0-3.4 3.4L9.6 10.4"/><path d="m8 11 9 9 3-3-9-9"/><path d="M19 15V9"/></svg>
          </div>
          {/* School/University */}
          <div className="absolute top-[65%] right-[5%] animate-float">
            <svg width="120" height="120" viewBox="0 0 24 24" fill="none" stroke="#2d6a4f" strokeWidth="0.8" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3 10 9H2l10-9z"/><path d="M2 21h20"/><path d="M10 12v9"/><path d="M14 12v9"/><path d="M4 21v-9"/><path d="M20 21v-9"/></svg>
          </div>
        </div>

        {/* Page content */}
        <main className="flex-1 overflow-auto relative z-10">
          {children}
        </main>
      </div>
    </div>
  );
}
