import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { verifyUser, resendCode } from '../services/authService';

export default function VerifyScreen() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [shake, setShake] = useState(false);
  const [cooldown, setCooldown] = useState(60);
  
  const inputRefs = [useRef(null), useRef(null), useRef(null), useRef(null), useRef(null), useRef(null)];

  useEffect(() => {
    const savedEmail = localStorage.getItem('verificationEmail');
    if (!savedEmail) {
      navigate('/signup');
    } else {
      setEmail(savedEmail);
    }
  }, [navigate]);

  useEffect(() => {
    if (cooldown > 0) {
      const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldown]);

  const handleChange = (index, value) => {
    if (!/^[0-9]*$/.test(value)) return;

    const newCode = [...code];
    newCode[index] = value;
    setCode(newCode);

    if (value && index < 5) {
      inputRefs[index + 1].current.focus();
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs[index - 1].current.focus();
    }
  };

  const handleVerify = async (e) => {
    e?.preventDefault();
    const fullCode = code.join('');
    if (fullCode.length !== 6) return;

    setIsLoading(true);
    setError('');
    setShake(false);

    try {
      await verifyUser(email, fullCode);
      localStorage.removeItem('verificationEmail');
      navigate('/signin', { state: { message: 'Account created! Please sign in.' } });
    } catch (err) {
      console.error('Verify error:', err);
      setError('Invalid code. Please try again.');
      setShake(true);
      setTimeout(() => setShake(false), 500);
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-submit when all 6 filled
  useEffect(() => {
    if (code.every(c => c !== '')) {
      handleVerify();
    }
  }, [code]);

  const handleResend = async () => {
    if (cooldown > 0) return;
    try {
      await resendCode(email);
      setCooldown(60);
    } catch (err) {
      setError('Failed to resend code.');
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-[#F5F0E8] font-inter p-6">
      <div className="bg-white w-full max-w-[440px] rounded-[20px] p-[48px] shadow-sm text-center flex flex-col items-center">
        
        <div className="w-16 h-16 bg-[#E6F4ED] rounded-full flex items-center justify-center mb-6">
          <CheckCircle2 size={32} className="text-[#2D7A4F]" />
        </div>

        <h2 className="text-[28px] font-[800] text-[#1A1A1A] mb-2 tracking-tight">Check your email</h2>
        <p className="text-[15px] text-[#6B7280] mb-8">
          We sent a 6-digit verification code to <br/>
          <strong className="text-[#1A1A1A]">{email}</strong>
        </p>

        <form onSubmit={handleVerify} className="w-full flex flex-col gap-6 items-center">
          
          <div className={`flex gap-3 justify-center ${shake ? 'animate-shake' : ''}`}>
            {code.map((digit, index) => (
              <input
                key={index}
                ref={inputRefs[index]}
                type="text"
                maxLength={1}
                value={digit}
                onChange={(e) => handleChange(index, e.target.value)}
                onKeyDown={(e) => handleKeyDown(index, e)}
                className="w-[40px] h-[52px] text-center text-xl font-bold bg-white border-[1.5px] border-[#E5E0D8] rounded-[10px] text-[#1A1A1A] outline-none focus:border-[#E8A838] focus:ring-1 focus:ring-[#E8A838] transition-all duration-200"
              />
            ))}
          </div>

          {error && <p className="text-[#DC2626] text-[13px] font-medium">{error}</p>}

          <button
            type="submit"
            disabled={isLoading || code.includes('')}
            className="w-full h-[52px] bg-[#E8A838] hover:bg-[#D99A2D] active:bg-[#C98A1C] text-white font-semibold rounded-[10px] mt-2 flex items-center justify-center transition-all duration-200 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <Loader2 size={18} className="animate-spin" />
                Verifying...
              </span>
            ) : (
              'Verify'
            )}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button 
            onClick={handleResend}
            disabled={cooldown > 0}
            className={`text-sm font-semibold transition-colors ${
              cooldown > 0 ? 'text-[#9CA3AF] cursor-not-allowed' : 'text-[#E8A838] hover:text-[#D99A2D]'
            }`}
          >
            {cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'}
          </button>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-5px); }
          75% { transform: translateX(5px); }
        }
        .animate-shake {
          animation: shake 0.2s ease-in-out 0s 2;
        }
      `}} />
    </div>
  );
}
