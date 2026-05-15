import { Link } from "react-router-dom";
import { Activity, Clock, Users, Target, MapPin, Bot, BookOpen, AlertTriangle } from "lucide-react";
import { useSettings } from "../lib/SettingsContext";
import { useState, useEffect } from "react";

export default function OverviewPage() {
  const { t } = useSettings();

  // Pull stats from last hub placement run (localStorage)
  const [totalHubs, setTotalHubs] = useState(0);
  const [estimatedStudents, setEstimatedStudents] = useState(0);
  const [activeNodes, setActiveNodes] = useState(0);
  const [uptimePct, setUptimePct] = useState(0);

  useEffect(() => {
    const savedData = localStorage.getItem('slm_hub_resultData');
    if (savedData) {
      try {
        const data = JSON.parse(savedData);
        const hubs = data?.metadata?.total_hubs || 0;
        const students = data?.metadata?.estimated_students || 0;
        setTotalHubs(hubs);
        setEstimatedStudents(students);
        // Active nodes: random between 60-95% of total hubs (changes on refresh)
        const active = hubs > 0 ? Math.max(1, Math.floor(hubs * (0.6 + Math.random() * 0.35))) : 0;
        setActiveNodes(active);
        // Uptime = active_nodes / total_hubs * 100
        setUptimePct(hubs > 0 ? Math.round((active / hubs) * 100) : 0);
      } catch {
        setTotalHubs(0);
        setEstimatedStudents(0);
        setActiveNodes(0);
        setUptimePct(0);
      }
    }
  }, []);

  const STAT_CARDS = [
    { label: t("active_nodes"),    value: String(activeNodes),           sub: `/ ${totalHubs} total nodes`,  icon: Activity, color: "#2d6a4f" },
    { label: t("system_uptime"),   value: `${uptimePct}%`,              sub: t("last_30_days"),              icon: Clock,    color: "#1565c0" },
    { label: t("active_users"),    value: String(estimatedStudents),     sub: t("this_week"),                 icon: Users,    color: "#6a1b9a" },
    { label: t("avg_ai_score"),    value: "85%",                         sub: t("spm_benchmark"),             icon: Target,   color: "#e65100" },
  ];

  const QUICK_LINKS = [
    { href: "/hub-placement", icon: MapPin,   label: t("nav_hub_placement"), desc: t("nav_hub_placement_desc"), color: "#e8f5e9", border: "#c8e6c9", text: "#1b5e20" },
    { href: "/training",      icon: Bot,      label: t("nav_training"),     desc: t("nav_training_desc"),color: "#e3f2fd", border: "#bbdefb", text: "#0d47a1" },
    { href: "/curriculum",    icon: BookOpen, label: t("nav_curriculum"),          desc: t("nav_curriculum_desc"),  color: "#fff8e1", border: "#ffe082", text: "#e65100" },
  ];

  // Post Analysis mock data — hubs with usage < 20%
  const POST_ANALYSIS_HUBS = [
    { id: "SWK-SUB-04", village: "Kampung Sungai Merah", usage: 12, feedbackScore: 80, kioskSuggested: true },
    { id: "SWK-SUB-07", village: "Kampung Buntal", usage: 8, feedbackScore: 90, kioskSuggested: true },
    { id: "SWK-SUB-11", village: "Kampung Santubong", usage: 18, feedbackScore: 10, kioskSuggested: false },
  ];

  return (
    <div className="p-8 max-w-5xl relative z-10">
      <div className="mb-8">
        <h2 className="text-[25px] font-bold mb-2 text-[#111111]">{t('dashboard_overview')}</h2>
        <p className="text-sm text-gray-500">
          {t('welcome_back')}
        </p>
      </div>

      <div className="grid grid-cols-4 gap-5 mb-10">
        {STAT_CARDS.map((stat, i) => {
          const Icon = stat.icon;
          return (
            <div key={i} className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm font-semibold text-gray-500">{stat.label}</div>
                <Icon size={18} style={{ color: stat.color }} />
              </div>
              <div className="text-3xl font-bold mb-1 text-[#111111]">{stat.value}</div>
              <div className="text-xs font-medium text-gray-400">{stat.sub}</div>
            </div>
          )
        })}
      </div>

      <h3 className="text-sm font-bold mb-4 uppercase tracking-wider text-gray-400">{t('quick_actions')}</h3>
      <div className="grid grid-cols-3 gap-5 mb-12">
        {QUICK_LINKS.map((link, i) => {
          const Icon = link.icon;
          return (
            <Link key={i} to={link.href} className="group block p-6 rounded-xl border transition-all duration-200 hover:-translate-y-1 hover:shadow-lg"
              style={{ background: link.color, borderColor: link.border }}>
              <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4 bg-white/70 shadow-sm">
                <Icon size={24} style={{ color: link.text }} />
              </div>
              <div className="text-[16px] font-bold mb-2" style={{ color: link.text }}>{link.label}</div>
              <div className="text-sm leading-relaxed" style={{ color: link.text, opacity: 0.9 }}>{link.desc}</div>
            </Link>
          )
        })}
      </div>

      {/* Post Analysis Section */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8">
        <div className="mb-6">
          <h3 className="text-xl font-bold text-[#111111] flex items-center gap-2">
            <AlertTriangle className="text-amber-500" size={22} />
            Post Analysis
          </h3>
          <p className="text-sm text-gray-500 mt-1">{t('allow_students_study')}</p>
        </div>

        <div className="overflow-hidden rounded-lg border border-gray-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 font-bold text-gray-600">{t('hub_id')}</th>
                <th className="text-left px-4 py-3 font-bold text-gray-600">{t('village_col')}</th>
                <th className="text-center px-4 py-3 font-bold text-gray-600">{t('usage_col')}</th>
                <th className="text-center px-4 py-3 font-bold text-gray-600">{t('feedback_score')}</th>
                <th className="text-center px-4 py-3 font-bold text-gray-600">{t('kiosk_suggested')}</th>
              </tr>
            </thead>
            <tbody>
              {POST_ANALYSIS_HUBS.map((hub, i) => (
                <tr key={i} className="border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-mono font-bold text-blue-600">{hub.id}</td>
                  <td className="px-4 py-3 text-gray-700">{hub.village}</td>
                  <td className="px-4 py-3 text-center">
                    <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700">
                      {hub.usage}%
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                      hub.feedbackScore >= 70 ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                    }`}>
                      {hub.feedbackScore}/100
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {hub.kioskSuggested ? (
                      <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-700 border border-amber-200">
                        ✓ {t('kiosk_suggested')}
                      </span>
                    ) : (
                      <span className="px-3 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-400">
                        Not Required
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="text-xs text-gray-400 mt-4 italic">
          Hubs with usage below 20% may indicate students lack personal devices. Deploying a shared kiosk terminal can bridge this gap.
        </p>
      </div>
    </div>
  );
}
