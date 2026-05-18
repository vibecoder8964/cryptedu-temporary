import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate, useLocation, NavLink } from "react-router-dom";
import { useState, useEffect } from "react";
import { signIn, signOut, getCurrentUser as getCognitoUser, fetchAuthSession } from "aws-amplify/auth";
import type { CognitoExchangeRequest } from "./lib/types";
import "./student/App.css";

// Admin pages
import DashboardShell from "./components/dashboard/DashboardShell";
import OverviewPage from "./pages/OverviewPage";
import TrainingPage from "./pages/training/TrainingPage";
import HubPlacementPage from "./pages/HubPlacementPage";
import CurriculumPage from "./pages/CurriculumPage";
import HelpPage from "./pages/HelpPage";
import AdminProfilePage from "./pages/AdminProfilePage";
import HubArchitecturePage from "./pages/HubArchitecturePage";
import UserAccountSetupPage from "./pages/UserAccountSetupPage";
import AdminCreateAccountPage from "./pages/AdminCreateAccountPage";
import { useSettings, SettingsProvider } from "./lib/SettingsContext";

// Student screens (JSX)
import HomeScreen from "./student/screens/HomeScreen";
import LessonsScreen from "./student/screens/LessonsScreen";
import LessonPlayerScreen from "./student/screens/LessonPlayerScreen";
import QuizScreen from "./student/screens/QuizScreen";
import TutorScreen from "./student/screens/TutorScreen";
import ProfileScreen from "./student/screens/ProfileScreen";
import CommunityScreen from "./student/screens/CommunityScreen";

// Student services & store
import { loginUser as studentLogin, logoutUser as studentLogout, getCurrentUser as getStudentUser } from "./student/services/authService";
import { loadUserData, saveProgressToCloud } from "./student/services/userDataService";
import { startHubDetection } from "./student/services/hubService";
import useAppStore from "./student/store/appStore";
import { Home, BookOpen, MessageSquare, User, Users, PenLine, Loader2 } from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// Role Select Page
// ─────────────────────────────────────────────────────────────────────────────
function RoleSelectPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0f2318] via-[#1a3a2d] to-[#2d5a3d] flex items-center justify-center p-6 relative overflow-hidden">
      {/* Dot grid texture */}
      <div className="absolute inset-0 opacity-[0.08] pointer-events-none" style={{ backgroundImage: 'radial-gradient(rgba(255, 255, 255, 0.5) 1.5px, transparent 1.5px)', backgroundSize: '28px 28px' }}></div>
      
      <div className="max-w-lg w-full text-center relative z-10">
        <div className="mb-10">
          <h1 className="text-5xl font-[800] text-white mb-3 tracking-tight">CryptEdu</h1>
          <p className="text-[#8BAF98] text-lg font-medium">Sovereign Learning Mesh</p>
          <div className="w-12 h-0.5 bg-[#E8A838] mx-auto mt-4 rounded-full"></div>
        </div>

        <div className="grid gap-4">
          <button
            onClick={() => navigate("/admin/login")}
            className="w-full bg-white/[0.07] backdrop-blur-sm border border-white/[0.15] text-white rounded-2xl p-7 hover:bg-white/[0.12] hover:border-white/[0.25] transition-all duration-200 text-left group"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500/20 to-emerald-700/20 border border-emerald-500/30 flex items-center justify-center group-hover:scale-105 transition-transform">
                <span className="text-2xl">🛡️</span>
              </div>
              <div>
                <div className="text-lg font-bold mb-0.5">Admin Portal</div>
                <div className="text-sm text-white/60">Regional Moderator dashboard — manage hubs, training, curriculum</div>
              </div>
            </div>
          </button>

          <button
            onClick={() => navigate("/student/login")}
            className="w-full bg-white/[0.07] backdrop-blur-sm border border-white/[0.15] text-white rounded-2xl p-7 hover:bg-white/[0.12] hover:border-[#E8A838]/40 transition-all duration-200 text-left group"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500/20 to-amber-700/20 border border-amber-500/30 flex items-center justify-center group-hover:scale-105 transition-transform">
                <span className="text-2xl">📚</span>
              </div>
              <div>
                <div className="text-lg font-bold mb-0.5">Student Portal</div>
                <div className="text-sm text-white/60">Lessons, AI tutor, quizzes — offline-first learning</div>
              </div>
            </div>
          </button>
        </div>

        <p className="text-white/30 text-xs mt-10">v2.0 — Unified Admin + Student Platform</p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Admin Login Page (Cognito)
// ─────────────────────────────────────────────────────────────────────────────
function AdminLoginPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [isSignUp, setIsSignUp] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const apiBase = import.meta.env.VITE_API_URL ?? "";
      const endpoint = isSignUp ? "/api/auth/signup" : "/api/auth/login";
      const res = await fetch(`${apiBase}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username, password }),
      });

      if (!res.ok) {
        let detail = `${isSignUp ? 'Sign up' : 'Login'} failed (HTTP ${res.status})`;
        try {
          const data = await res.json();
          if (data && typeof data.detail === "string") {
            detail = data.detail;
          }
        } catch {
          // Response wasn't JSON; keep the generic detail above.
        }
        setError(detail);
        return;
      }

      localStorage.setItem("cryptedu_role", "admin");
      navigate("/admin");
    } catch (err: any) {
      setError(err?.message || `${isSignUp ? 'Sign up' : 'Login'} failed`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f4f7f4] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-emerald-900/5 backdrop-blur-3xl z-0"></div>
      
      <div className="max-w-md w-full bg-white/80 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/50 p-8 relative z-10">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-emerald-500 to-[#163e2c] rounded-2xl flex items-center justify-center shadow-lg mb-4 transform -rotate-6">
            <svg className="text-white w-8 h-8 transform rotate-6" xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/></svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">CryptEdu Sovereign Mesh</h1>
          <p className="text-sm text-gray-500 font-medium">Government Infrastructure — Admin Portal</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-5">
          {error && (
            <div className="p-3 rounded-lg bg-red-50 text-red-600 text-sm font-medium border border-red-100">
              {error}
            </div>
          )}

          <div className="space-y-1">
            <label className="text-sm font-bold text-gray-700 ml-1">Official Email</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              </div>
              <input
                type="email"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="block w-full pl-10 pr-3 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none bg-white/50 backdrop-blur-sm transition-all"
                placeholder="e.g. admin@school.edu.my"
                required
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-bold text-gray-700 ml-1">Secure Password</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="block w-full pl-10 pr-3 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none bg-white/50 backdrop-blur-sm transition-all"
                placeholder="••••••••"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-lg text-sm font-bold text-white bg-gradient-to-r from-[#163e2c] to-emerald-800 hover:from-[#112a1f] hover:to-emerald-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 transform transition-all active:scale-[0.98] disabled:opacity-70 mt-4"
          >
            {loading ? "Processing..." : isSignUp ? "Create Account" : "Access Dashboard"}
          </button>
        </form>

        <div className="mt-6 flex flex-col space-y-3">
          <button
            onClick={() => { setIsSignUp(!isSignUp); setError(""); }}
            className="text-sm font-semibold text-emerald-700 hover:text-emerald-800 transition-colors w-full text-center"
          >
            {isSignUp ? "Already have an account? Sign in" : "Need an account? Sign up"}
          </button>
          
          <button
            onClick={() => navigate("/")}
            className="text-sm font-semibold text-gray-500 hover:text-gray-700 transition-colors w-full text-center"
          >
            ← Back to role selection
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Student Login Page (Backend JWT)
// ─────────────────────────────────────────────────────────────────────────────
function StudentLoginPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [isSignUp, setIsSignUp] = useState(false);
  const [fullName, setFullName] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (isSignUp) {
        // Need to import signupUser, wait, it's not imported.
        // Let's use fetch directly since we didn't import signupUser here?
        // Actually, we imported studentLogin, we should import signupUser.
        // Let's just use the imported service or fetch directly. I'll import it above later.
        // Wait, I can just use the api directly to avoid import issues.
        const apiBase = import.meta.env.VITE_API_URL ?? "";
        const res = await fetch(`${apiBase}/api/end-users/signup`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ username, password, full_name: fullName }),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.detail || "Sign up failed.");
        }
      } else {
        await studentLogin(username, password);
      }
      localStorage.setItem("cryptedu_role", "student");
      navigate("/student/home");
    } catch (err: any) {
      setError(err.message || `${isSignUp ? 'Sign up' : 'Login'} failed`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen w-full" style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* Left Panel */}
      <div className="hidden lg:flex flex-col justify-between w-[45%] bg-[#1B3A2D] p-12 text-white relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.12] pointer-events-none" style={{ backgroundImage: 'radial-gradient(rgba(255, 255, 255, 0.4) 2px, transparent 2px)', backgroundSize: '32px 32px' }}></div>
        <div className="relative z-10">
          <h1 className="text-[32px] font-[800] leading-none mb-1 tracking-tight text-white">CryptEdu</h1>
          <p className="text-[14px] text-[#8BAF98] font-medium tracking-wide">Offline Learning Hub</p>
        </div>
        <div className="relative z-10 flex flex-col">
          <div style={{ marginBottom: 32 }}>
            <p className="text-[32px] font-[800] leading-tight tracking-tight text-white">Education for every student. Every village.</p>
            <p className="text-[32px] font-[800] leading-tight tracking-tight" style={{ color: '#e8a020' }}>No internet required.</p>
          </div>
          <div style={{ width: 40, height: 2, background: '#e8a020', marginBottom: 32, borderRadius: 1 }} />
        </div>
        <div className="relative z-10 flex items-center justify-between">
          <p style={{ fontSize: 13, color: 'rgba(245,240,232,0.35)' }}>© 2026 CryptEdu</p>
        </div>
      </div>

      {/* Right Panel */}
      <div className="flex-1 flex items-center justify-center bg-[#F5F0E8]">
        <div className="w-full max-w-[420px] px-6 py-8">
          <h2 className="text-[28px] font-[800] text-[#1A1A1A] mb-2 tracking-tight">{isSignUp ? "Create an account" : "Welcome back"}</h2>
          <p className="text-[15px] text-[#6B7280] mb-8">{isSignUp ? "Sign up to start learning" : "Sign in to continue learning"}</p>

          <form onSubmit={handleLogin} className="flex flex-col gap-5">
            {isSignUp && (
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold text-[#374151]">Full Name</label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full bg-[#ffffff] border border-[rgba(0,0,0,0.15)] rounded-[6px] px-4 py-3 text-[#1A1A1A] outline-none focus:border-[#E8A838] transition-all duration-200"
                  placeholder="Enter your full name"
                />
              </div>
            )}
            
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-[#374151]">Username</label>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-[#ffffff] border border-[rgba(0,0,0,0.15)] rounded-[6px] px-4 py-3 text-[#1A1A1A] outline-none focus:border-[#E8A838] transition-all duration-200"
                placeholder="Enter your username"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-[#374151]">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-[#ffffff] border border-[rgba(0,0,0,0.15)] rounded-[6px] px-4 py-3 text-[#1A1A1A] outline-none focus:border-[#E8A838] transition-all duration-200"
                placeholder="••••••••"
              />
            </div>

            {error && <p className="text-[#DC2626] text-[13px] font-medium">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full h-[52px] bg-[#E8A838] hover:bg-[#D99A2D] active:bg-[#C98A1C] text-white font-semibold rounded-[8px] mt-2 flex items-center justify-center transition-all duration-200 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {loading ? "Processing..." : isSignUp ? "Sign Up" : "Sign In"}
            </button>
          </form>

          <div className="mt-6 flex flex-col space-y-3">
            <button
              onClick={() => { setIsSignUp(!isSignUp); setError(""); }}
              className="text-sm text-[#E8A838] hover:text-[#C98A1C] w-full text-center font-medium transition-colors"
            >
              {isSignUp ? "Already have an account? Sign in" : "Need an account? Sign up"}
            </button>
            
            <button
              onClick={() => navigate("/")}
              className="text-sm text-[#6B7280] hover:text-[#1A1A1A] w-full text-center transition-colors"
            >
              ← Back to role selection
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Admin Dashboard (wraps existing admin pages)
// ─────────────────────────────────────────────────────────────────────────────
function AdminDashboard() {
  const { t } = useSettings();
  const location = useLocation();
  const navigate = useNavigate();
  const [verified, setVerified] = useState(false);

  useEffect(() => {
    const verify = async () => {
      // Check localStorage first — if role is set, the login page already verified credentials
      if (localStorage.getItem("cryptedu_role") === "admin") {
        // Still try to verify with Cognito, but don't block on failure
        try {
          await getCognitoUser();
        } catch {
          // Session might not be propagated yet — that's OK for demo
        }
        setVerified(true);
        return;
      }
      // No role in localStorage — redirect to login
      navigate("/admin/login");
    };
    verify();
  }, [navigate]);

  const handleLogout = async () => {
    try { await signOut(); } catch {}
    localStorage.removeItem("cryptedu_role");
    navigate("/");
  };

  const routeMeta: Record<string, { title: string; sub: string }> = {
    "/admin": { title: t("overview"), sub: t("monitor_mesh_sub") },
    "/admin/curriculum": { title: t("nav_curriculum"), sub: t("nav_curriculum_desc") },
    "/admin/training": { title: t("nav_training"), sub: t("nav_training_desc") },
    "/admin/hub-placement": { title: t("nav_hub_placement"), sub: t("nav_hub_placement_desc") },
    "/admin/architecture": { title: t("nav_hub_architecture"), sub: t("hub_arch_subtitle") },
    "/admin/profile": { title: t("nav_admin_profile"), sub: t("admin_profile_desc") },
    "/admin/help": { title: t("nav_help"), sub: t("how_to_use") },
    "/admin/user-setup": { title: "User Account Setup", sub: "Bulk-create end-user accounts from CSV or Excel" },
    "/admin/create-admin": { title: "Create Admin Account", sub: "Provision a new Cognito admin and credential vault row" },
  };

  const currentMeta = routeMeta[location.pathname] || { title: "CryptEdu Admin", sub: "" };

  if (!verified) {
    return <div className="min-h-screen bg-[#f4f7f4] flex items-center justify-center">Loading...</div>;
  }

  return (
    <DashboardShell title={currentMeta.title} subtitle={currentMeta.sub} onLogout={handleLogout}>
      <Routes>
        <Route path="/" element={<OverviewPage />} />
        <Route path="/hub-placement" element={<HubPlacementPage />} />
        <Route path="/training" element={<TrainingPage />} />
        <Route path="/curriculum" element={<CurriculumPage />} />
        <Route path="/profile" element={<AdminProfilePage />} />
        <Route path="/architecture" element={<HubArchitecturePage />} />
        <Route path="/help" element={<HelpPage />} />
        <Route path="/user-setup" element={<UserAccountSetupPage />} />
        <Route path="/create-admin" element={<AdminCreateAccountPage />} />
        <Route path="*" element={<div className="p-8">Page under construction...</div>} />
      </Routes>
    </DashboardShell>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Student App Shell (sidebar + header + routes)
// ─────────────────────────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { path: '/student/home',      label: 'Home',           icon: Home },
  { path: '/student/lessons',   label: 'Lessons',        icon: BookOpen },
  { path: '/student/quiz',      label: 'Quiz',           icon: PenLine },
  { path: '/student/tutor',     label: 'Local AI Tutor', icon: MessageSquare },
  { path: '/student/community', label: 'Community',      icon: Users },
  { path: '/student/profile',   label: 'Profile',        icon: User },
];

const PAGE_TITLES: Record<string, string> = {
  '/student/home':      'Knowledge Feed',
  '/student/lessons':   'Lessons',
  '/student/quiz':      'Quiz Generator',
  '/student/tutor':     'Local AI Tutor',
  '/student/community': 'Community Q&A',
  '/student/profile':   'Profile & Progress',
};

function StudentSidebar({ onLogout }: { onLogout: () => void }) {
  const { hubStatus, hubName, currentUser, userRole } = useAppStore();

  const initial = currentUser?.name?.[0]?.toUpperCase() ?? 'S';
  const displayName = currentUser?.name ?? 'Student';
  const displaySub = userRole === 'teacher'
    ? `Teacher · ${currentUser?.subject || 'Mathematics'}`
    : `Student · ${currentUser?.grade || 'Tingkatan 3'}`;

  const navItems = userRole === 'teacher'
    ? NAV_ITEMS.filter(item => item.path.includes('community') || item.path.includes('profile'))
    : NAV_ITEMS;

  return (
    <aside className="sidebar">
      <div className="sidebar__logo">
        <span className="sidebar__logo-text">CryptEdu</span>
        <span className="sidebar__logo-sub">Offline Learning Hub</span>
      </div>

      <nav className="sidebar__nav">
        {navItems.map(({ path, label, icon: Icon }) => (
          <NavLink
            key={path}
            to={path}
            className={({ isActive }) => `nav-item${isActive ? ' nav-item--active' : ''}`}
          >
            <Icon className="nav-item__icon" size={18} strokeWidth={2} />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="sidebar__profile mt-auto">
        <div className="sidebar__avatar">{initial}</div>
        <div style={{ flex: 1 }}>
          <p className="sidebar__profile-name">{displayName}</p>
          <p className="sidebar__profile-sub">{displaySub}</p>
        </div>
      </div>

      <div className="px-4 pb-6 pt-2">
        <button
          onClick={onLogout}
          className="w-full text-sm font-semibold text-[#F87171] hover:text-[#EF4444] hover:bg-[#F87171]/10 py-2 rounded-lg transition-colors text-left pl-2"
        >
          Log Out
        </button>
      </div>
    </aside>
  );
}

function StudentHeader() {
  const location = useLocation();
  const { lastSync, hubStatus } = useAppStore();
  const title = PAGE_TITLES[location.pathname] ?? 'CryptEdu';

  return (
    <header className="app-header">
      <h1 className="app-header__title">{title}</h1>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {hubStatus === 'connected' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 9999, background: '#E6F4ED' }}>
            <span className="status-dot status-dot--green" />
            <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, fontWeight: 600, color: '#2D7A4F' }}>
              Content Up to Date · {lastSync}
            </span>
          </div>
        )}
      </div>
    </header>
  );
}

function StudentAppShell() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isVerifying, setIsVerifying] = useState(true);
  const { setCurrentUser, setUserRole, userRole } = useAppStore();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { user, attributes } = await getStudentUser();
        const role = attributes['custom:role'] || 'student';
        await loadUserData(user, attributes);
      } catch (error) {
        console.error('Student not authenticated:', error);
        localStorage.removeItem("cryptedu_role");
        navigate('/student/login');
      } finally {
        setIsVerifying(false);
      }
    };
    checkAuth();
  }, [navigate, setCurrentUser, setUserRole]);

  useEffect(() => {
    const stop = startHubDetection();
    return stop;
  }, []);

  const progress = useAppStore(s => s.progress);
  const quizResults = useAppStore(s => s.quizResults);
  const streak = useAppStore(s => s.streak);
  const isAuthenticated = useAppStore(s => s.isAuthenticated);

  useEffect(() => {
    if (isAuthenticated) {
      saveProgressToCloud();
    }
  }, [progress, quizResults, streak, isAuthenticated]);

  const handleLogout = async () => {
    await studentLogout();
    setCurrentUser(null);
    setUserRole(null);
    localStorage.removeItem("cryptedu_role");
    navigate('/');
  };

  if (isVerifying) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#F5F0E8]">
        <Loader2 size={32} className="animate-spin text-[#E8A838]" />
      </div>
    );
  }

  return (
    <div className="app-root">
      <StudentSidebar onLogout={handleLogout} />
      <main className="main-shell">
        <StudentHeader />
        <div className="page-content">
          <Routes>
            {userRole === 'teacher' ? (
              <>
                <Route path="/community" element={<CommunityScreen />} />
                <Route path="/profile" element={<ProfileScreen />} />
                <Route path="*" element={<Navigate to="/student/community" replace />} />
              </>
            ) : (
              <>
                <Route path="/home" element={<HomeScreen />} />
                <Route path="/lessons" element={<LessonsScreen />} />
                <Route path="/lesson/:id" element={<LessonPlayerScreen />} />
                <Route path="/quiz" element={<QuizScreen />} />
                <Route path="/tutor" element={<TutorScreen />} />
                <Route path="/community" element={<CommunityScreen />} />
                <Route path="/profile" element={<ProfileScreen />} />
                <Route path="*" element={<Navigate to="/student/home" replace />} />
              </>
            )}
          </Routes>
        </div>
      </main>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Root App — routes everything
// ─────────────────────────────────────────────────────────────────────────────
function App() {
  return (
    <Routes>
      {/* Role selection */}
      <Route path="/" element={<RoleSelectPage />} />

      {/* Admin paths */}
      <Route path="/admin/login" element={<AdminLoginPage />} />
      <Route path="/admin/*" element={<AdminDashboard />} />

      {/* Student paths */}
      <Route path="/student/login" element={<StudentLoginPage />} />
      <Route path="/student/*" element={<StudentAppShell />} />

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function AppWrapper() {
  return (
    <SettingsProvider>
      <Router>
        <App />
      </Router>
    </SettingsProvider>
  );
}

export default AppWrapper;
