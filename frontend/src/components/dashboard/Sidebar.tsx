import { Link, useLocation, useNavigate } from "react-router-dom";
import { Network, BookOpen, Bot, MapPin, User, HelpCircle, Server, Search, Users, LogOut } from "lucide-react";
import { signOut } from "aws-amplify/auth";
import { useSettings } from "../../lib/SettingsContext";
import logo from "../../assets/Project_logo.png";
import WelcomeChatbox from "../WelcomeChatbox";

export default function Sidebar() {
  const { t } = useSettings();
  const location = useLocation();
  const navigate = useNavigate();
  const path = location.pathname;

  const NAV = [
    { href: "/admin", icon: Network, label: t("nav_mesh_network"), sub: "Active" },
    { href: "/admin/curriculum", icon: BookOpen, label: t("nav_curriculum"), sub: null },
    { href: "/admin/training", icon: Bot, label: t("nav_training"), sub: null },
    { href: "/admin/hub-placement", icon: MapPin, label: t("nav_hub_placement"), sub: "(Map)" },
    { href: "/admin/architecture", icon: Server, label: t("nav_hub_architecture"), sub: null },
    { href: "/admin/user-setup", icon: Users, label: "User Account Setup", sub: null },
    { href: "/admin/profile", icon: User, label: t("nav_admin_profile"), sub: null },
    { href: "/admin/help", icon: HelpCircle, label: t("nav_help"), sub: null },
  ];

  return (
    <aside className="flex flex-col w-[240px] min-h-screen shrink-0 bg-[#163e2c] border-r border-[#1b4b35]">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-[#1b4b35]">
        <div className="w-10 h-10 rounded-lg overflow-hidden flex items-center justify-center bg-white shadow-sm">
          <img src={logo} alt="CryptEdu Logo" className="w-full h-full object-cover" />
        </div>
        <span className="font-bold text-lg text-white tracking-wide">CryptEdu-Admin</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4">
        {NAV.map((item) => {
          const active = path === item.href || (item.href !== "/admin" && path.startsWith(item.href));
          const Icon = item.icon;
          const isHelp = item.href === "/help";

          return (
            <Link key={item.href} to={item.href}
              id={isHelp ? "nav-help" : undefined}
              className={`flex items-center gap-3 px-5 py-3 mx-3 my-1 rounded-lg transition-all duration-150 group ${isHelp ? 'relative' : ''}`}
              style={{
                background: active ? "#ffffff" : "transparent",
                color: active ? "#000000" : "#d1e7dd",
              }}
              onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.1)"; }}
              onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = "transparent"; }}>
              <Icon size={20} strokeWidth={active ? 2.5 : 2} className={active ? "text-black" : "text-[#d1e7dd] group-hover:text-white"} />
              <div className="flex flex-col leading-tight">
                <span className={`text-[14px] ${active ? 'font-bold' : 'font-medium group-hover:text-white'}`}>{item.label}</span>
                {item.sub && (
                  <span className="text-[11px]" style={{ color: active ? "#163e2c" : "rgba(209,231,221,0.6)" }}>
                    {item.sub}
                  </span>
                )}
              </div>
              {isHelp && <WelcomeChatbox />}
            </Link>
          );
        })}
      </nav>

      {/* Sidebar Search (New) */}
      <div className="px-5 mb-4 mt-auto">
        <div className="relative group">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#d1e7dd] opacity-50 group-focus-within:opacity-100 transition-opacity" />
          <input 
            type="text" 
            placeholder={t('search_mesh')}
            className="w-full bg-[#1b4b35] border border-[#2d5a2d] rounded-lg py-2 pl-10 pr-4 text-xs text-white placeholder:text-[#d1e7dd]/40 focus:outline-none focus:ring-1 focus:ring-white/20"
          />
        </div>
      </div>

      {/* Logout */}
      <div className="px-5 mb-2">
        <button
          onClick={async () => {
            try { await signOut(); } catch {}
            localStorage.removeItem("cryptedu_role");
            navigate("/");
          }}
          className="flex items-center gap-2 w-full px-3 py-2 text-sm font-semibold text-[#F87171] hover:text-[#EF4444] hover:bg-[#F87171]/10 rounded-lg transition-colors"
        >
          <LogOut size={16} />
          Log Out
        </button>
      </div>

      {/* Footer */}
      <div className="border-t border-[#1b4b35] px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-sm text-[#163e2c] font-bold">
            K
          </div>
          <div>
            <div className="text-[12px] font-bold text-white">{t('kpm_admin')}</div>
            <div className="text-[11px] text-[#d1e7dd] opacity-80">{t('mesh_version')} 1.1</div>
          </div>
        </div>
      </div>
    </aside>
  );
}
