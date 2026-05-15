import { useState } from "react";
import { Shield, Lock, User, Loader2 } from "lucide-react";
import { useSettings } from "../lib/SettingsContext";

export default function AuthPage({ onLogin }: { onLogin: () => void }) {
  const { t } = useSettings();
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [govId, setGovId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      if (isLogin) {
        const res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, password })
        });
        const data = await res.json();
        if (res.ok) {
          onLogin();
        } else {
          setError(data.detail || "Login failed");
        }
      } else {
        // Signup logic would go here if implemented in backend, 
        // For now we just show an error that only pre-approved gov accounts can be used
        setError("Self-registration is disabled. Please contact your KPM administrator.");
      }
    } catch (err) {
      setError("Network error. Please check your connection.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f4f7f4] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-emerald-900/5 backdrop-blur-3xl z-0"></div>
      
      <div className="max-w-md w-full bg-white/80 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/50 p-8 relative z-10 animate-in fade-in zoom-in duration-500">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-emerald-500 to-[#163e2c] rounded-2xl flex items-center justify-center shadow-lg mb-4 transform -rotate-6">
            <Shield className="text-white w-8 h-8 transform rotate-6" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">{t('cryptedu_sovereign')}</h1>
          <p className="text-sm text-gray-500 font-medium">{t('gov_infra_mesh')}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="p-3 rounded-lg bg-red-50 text-red-600 text-sm font-medium border border-red-100 animate-in slide-in-from-top-2">
              {error}
            </div>
          )}

          <div className="space-y-1">
            <label className="text-sm font-bold text-gray-700 ml-1">{t('official_username')}</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <User className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                className="block w-full pl-10 pr-3 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none bg-white/50 backdrop-blur-sm transition-all"
                placeholder="e.g. admin"
                required
              />
            </div>
          </div>

          {!isLogin && (
            <div className="space-y-1 animate-in slide-in-from-top-2">
              <label className="text-sm font-bold text-gray-700 ml-1">Government ID</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Shield className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  value={govId}
                  onChange={e => setGovId(e.target.value)}
                  className="block w-full pl-10 pr-3 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none bg-white/50 backdrop-blur-sm transition-all"
                  placeholder="KPM-MY-XXXX"
                  required={!isLogin}
                />
              </div>
            </div>
          )}

          <div className="space-y-1">
            <label className="text-sm font-bold text-gray-700 ml-1">{t('secure_password')}</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Lock className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
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
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (isLogin ? "Access Dashboard" : "Request Authorization")}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button 
            type="button"
            onClick={() => setIsLogin(!isLogin)}
            className="text-sm font-semibold text-emerald-700 hover:text-emerald-800 transition-colors"
          >
            {isLogin ? "Register new government ID" : "Return to secure login"}
          </button>
        </div>
      </div>
    </div>
  );
}
