import { useState, useEffect, useCallback } from "react";
import { X, User } from "lucide-react";
import { useLocation } from "react-router-dom";
import { useSettings } from "../lib/SettingsContext";

export default function WelcomeChatbox() {
  const { t } = useSettings();
  const location = useLocation();
  const [isVisible, setIsVisible] = useState(false);

  const handleDismiss = useCallback(() => {
    setIsVisible(false);
    sessionStorage.setItem("slm_has_seen_welcome", "true");
  }, []);

  useEffect(() => {
    if (location.pathname === "/help" && isVisible) {
      handleDismiss();
    }
  }, [location.pathname, isVisible, handleDismiss]);

  useEffect(() => {
    const hasSeenWelcome = sessionStorage.getItem("slm_has_seen_welcome");
    if (!hasSeenWelcome) {
      const timer = setTimeout(() => {
        setIsVisible(true);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, []);

  if (!isVisible) return null;

  return (
    <div 
      className="absolute left-[220px] top-[-150px] z-[1000] animate-in slide-in-from-left-4 fade-in duration-500 w-[280px]"
    >
      <div className="relative bg-white text-gray-900 p-5 rounded-2xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)] border border-emerald-100">
        {/* Pointer (Speech Bubble Tail) pointing towards the center of the menu item */}
        <div className="absolute -left-2 top-[165px] w-4 h-4 bg-white border-l border-b border-emerald-100 rotate-45"></div>
        
        <button 
          onClick={handleDismiss}
          className="absolute top-2 right-2 p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-all"
        >
          <X size={14} />
        </button>

        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center text-white shadow-md shadow-emerald-200">
              <User size={18} fill="currentColor" />
            </div>
            <span className="text-xs font-black uppercase tracking-tighter text-emerald-800">System Assistant</span>
          </div>

          <div className="space-y-2">
            <h4 className="text-sm font-bold leading-tight">{t('welcome_title')}</h4>
            <p className="text-xs text-gray-600 leading-relaxed font-medium">
              {t('welcome_message')}
            </p>
          </div>

          <button 
            onClick={handleDismiss}
            className="mt-1 w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold rounded-xl transition-all shadow-lg shadow-emerald-100 active:scale-95"
          >
            {t('got_it')}
          </button>
        </div>
      </div>
    </div>
  );
}
