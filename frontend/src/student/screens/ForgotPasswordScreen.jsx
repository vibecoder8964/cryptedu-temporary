import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Eye, EyeOff, Loader2, ArrowLeft, WifiOff, BrainCircuit, Trophy } from 'lucide-react';
import { requestPasswordReset, confirmNewPassword } from '../services/authService';

export default function ForgotPasswordScreen() {
  const navigate = useNavigate();
  
  const [step, setStep] = useState(1); // 1: Request, 2: Confirm
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleRequestReset = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      await requestPasswordReset(email);
      setStep(2);
    } catch (err) {
      console.error('Password reset request error:', err);
      setError(err.message || 'Failed to request password reset. Please check your email and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmReset = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      await confirmNewPassword(email, code, newPassword);
      // Automatically redirect to login
      navigate('/login', { replace: true });
    } catch (err) {
      console.error('Password reset confirmation error:', err);
      setError(err.message || 'Failed to reset password. Please check your code and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-screen w-full font-inter">
      {/* Left Panel */}
      <div className="hidden lg:flex flex-col justify-between w-[45%] bg-[#1B3A2D] p-12 text-white relative overflow-hidden">
        {/* Dot grid texture */}
        <div className="absolute inset-0 opacity-[0.12] pointer-events-none" style={{ backgroundImage: 'radial-gradient(rgba(255, 255, 255, 0.4) 2px, transparent 2px)', backgroundSize: '32px 32px' }}></div>

        {/* TOP — Logo/brand */}
        <div className="relative z-10">
          <h1 className="text-[32px] font-[800] leading-none mb-1 tracking-tight text-white">CryptEdu</h1>
          <p className="text-[14px] text-[#8BAF98] font-medium tracking-wide">Offline Learning Hub</p>
        </div>

        {/* MIDDLE — Tagline + Feature list */}
        <div className="relative z-10 flex flex-col">
          <p style={{ fontSize: 12, color: 'rgba(245,240,232,0.4)', marginBottom: 16 }}>Built for every Malaysian classroom</p>
          <div style={{ marginBottom: 32 }}>
            <p className="text-[32px] font-[800] leading-tight tracking-tight text-white">Education for every student. Every village.</p>
            <p className="text-[32px] font-[800] leading-tight tracking-tight" style={{ color: '#e8a020' }}>No internet required.</p>
          </div>
          <div style={{ width: 40, height: 2, background: '#e8a020', marginBottom: 32, borderRadius: 1 }} />
          <div className="flex flex-col" style={{ gap: 16 }}>
            {[
              { Icon: WifiOff,      label: 'Ready Without Data',  desc: 'Works fully offline' },
              { Icon: BrainCircuit, label: 'Local AI Tutor',      desc: 'On-device, no cloud needed' },
              { Icon: Trophy,       label: 'Village Leaderboard', desc: 'Compete with your school node' },
            ].map(({ Icon, label, desc }) => (
              <div key={label} className="flex items-center" style={{ gap: 14 }}>
                <div style={{ width: 32, height: 32, flexShrink: 0, border: '1px solid rgba(232,160,32,0.35)', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon size={15} color="#e8a020" strokeWidth={1.8} />
                </div>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 600, color: '#f5f0e8', lineHeight: 1.3 }}>{label}</p>
                  <p style={{ fontSize: 11, color: 'rgba(245,240,232,0.4)', lineHeight: 1.4 }}>{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* BOTTOM — Copyright + Node status */}
        <div className="relative z-10 flex items-center justify-between">
          <p style={{ fontSize: 13, color: 'rgba(245,240,232,0.35)' }}>© 2026 CryptEdu</p>
          <div className="flex items-center" style={{ gap: 6 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#e8a020', animation: 'nodeActivePulse 2s ease-in-out infinite', display: 'inline-block' }} />
            <p style={{ fontSize: 10, color: 'rgba(245,240,232,0.35)' }}>Node active</p>
          </div>
        </div>
        <style>{`@keyframes nodeActivePulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }`}</style>
      </div>

      {/* Right Panel */}
      <div className="flex-1 flex items-center justify-center bg-[#F5F0E8] relative">
        {/* Back button */}
        <Link to="/login" className="absolute top-8 left-8 flex items-center gap-2 text-[#6B7280] hover:text-[#1A1A1A] transition-colors font-medium">
          <ArrowLeft size={20} />
          <span>Back to login</span>
        </Link>

        <div className="w-full max-w-[420px] px-6 py-8">
          {step === 1 ? (
            <>
              <h2 className="text-[28px] font-[800] text-[#1A1A1A] mb-2 tracking-tight">Reset Password</h2>
              <p className="text-[15px] text-[#6B7280] mb-8">Enter your email and we'll send you a verification code.</p>

              <form onSubmit={handleRequestReset} className="flex flex-col gap-5">
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-semibold text-[#374151]">Email</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-[#ffffff] border-[1px] border-[rgba(0,0,0,0.15)] rounded-[6px] px-4 py-3 text-[#1A1A1A] outline-none focus:border-[#E8A838] transition-all duration-200"
                    placeholder="student@school.edu.my"
                  />
                </div>

                {error && (
                  <p className="text-[#DC2626] text-[13px] mt-[-8px] font-medium">{error}</p>
                )}

                <button
                  type="submit"
                  disabled={isLoading || !email.trim()}
                  className="w-full h-[52px] bg-[#E8A838] hover:bg-[#D99A2D] active:bg-[#C98A1C] text-white font-semibold rounded-[8px] mt-2 flex items-center justify-center transition-all duration-200 disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {isLoading ? (
                    <span className="flex items-center gap-2">
                      <Loader2 size={18} className="animate-spin" />
                      Sending...
                    </span>
                  ) : (
                    'Send Code'
                  )}
                </button>
              </form>
            </>
          ) : (
            <>
              <h2 className="text-[28px] font-[800] text-[#1A1A1A] mb-2 tracking-tight">Create New Password</h2>
              <p className="text-[15px] text-[#6B7280] mb-8">Enter the verification code sent to your email.</p>

              <form onSubmit={handleConfirmReset} className="flex flex-col gap-5">
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-semibold text-[#374151]">Verification Code</label>
                  <input
                    type="text"
                    required
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    className="w-full bg-[#ffffff] border-[1px] border-[rgba(0,0,0,0.15)] rounded-[6px] px-4 py-3 text-[#1A1A1A] outline-none focus:border-[#E8A838] transition-all duration-200 text-center tracking-widest text-lg font-bold"
                    placeholder="123456"
                    maxLength={6}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-semibold text-[#374151]">New Password</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full bg-[#ffffff] border-[1px] border-[rgba(0,0,0,0.15)] rounded-[6px] pl-4 pr-11 py-3 text-[#1A1A1A] outline-none focus:border-[#E8A838] transition-all duration-200"
                      placeholder="••••••••"
                      minLength={8}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-[#D1D5DB] transition-colors"
                    >
                      {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  </div>
                </div>

                {error && (
                  <p className="text-[#DC2626] text-[13px] mt-[-8px] font-medium">{error}</p>
                )}

                <button
                  type="submit"
                  disabled={isLoading || !code.trim() || newPassword.length < 8}
                  className="w-full h-[52px] bg-[#E8A838] hover:bg-[#D99A2D] active:bg-[#C98A1C] text-white font-semibold rounded-[8px] mt-2 flex items-center justify-center transition-all duration-200 disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {isLoading ? (
                    <span className="flex items-center gap-2">
                      <Loader2 size={18} className="animate-spin" />
                      Resetting...
                    </span>
                  ) : (
                    'Reset Password'
                  )}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
