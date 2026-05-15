import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Eye, EyeOff, CheckCircle2, Loader2, ArrowLeft } from 'lucide-react';
import { registerUser } from '../services/authService';

const SCHOOL_NODES = [
  'SK Kg. Baru — Kuala Lipis, Pahang',
  'SK Kg. Orang Asli Sungai Siput',
  'SK Batu Melintang — Gua Musang',
  'SK Kg. Peta — Kota Tinggi, Johor',
  'SK Nanga Nitam — Kapit, Sarawak',
  'SK Long Lama — Baram, Sarawak',
  'SK Kg. Bundu — Ranau, Sabah'
];

const GRADES = ['Year 1', 'Year 2', 'Year 3', 'Year 4', 'Year 5', 'Year 6', 'Form 1', 'Form 2', 'Form 3', 'Form 4', 'Form 5'];
const SUBJECTS = ['Science', 'Mathematics', 'Bahasa Malaysia', 'History', 'English'];

export default function SignUpScreen() {
  const navigate = useNavigate();
  
  const [step, setStep] = useState(1);
  const [role, setRole] = useState(null); // 'student' or 'teacher'
  
  // Form State
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    grade: '',
    village: '',
    school_node: '',
    parent_phone: '',
    subject: '',
    teacherCode: ''
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleNextStep = () => {
    if (role) setStep(2);
  };

  const handleSignUp = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match.');
      setIsLoading(false);
      return;
    }

    if (role === 'teacher' && formData.teacherCode.length !== 8) {
      setError('Teacher Code must be exactly 8 characters.');
      setIsLoading(false);
      return;
    }

    try {
      await registerUser({ ...formData, role });
      localStorage.setItem('verificationEmail', formData.email);
      navigate('/verify');
    } catch (err) {
      console.error('Sign up error:', err);
      setError(err.message || 'An error occurred during sign up.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-screen w-full font-inter overflow-hidden">
      {/* Left Panel */}
      <div className="hidden lg:flex flex-col justify-between w-[40%] bg-[#1B3A2D] p-12 text-white">
        <div>
          <h1 className="text-[32px] font-[800] leading-none mb-1 tracking-tight">CryptEdu</h1>
          <p className="text-[14px] text-[#8BAF98] font-medium tracking-wide">Offline Learning Hub</p>
          
          <h2 className="text-[18px] font-medium leading-relaxed mt-[32px] max-w-sm">
            Education for every student. Every village. No internet required.
          </h2>

          <div className="flex flex-col gap-3 mt-8">
            <div className="inline-flex items-center gap-2 bg-white/10 w-fit px-4 py-2 rounded-full backdrop-blur-sm">
              <CheckCircle2 size={16} className="text-[#8BAF98]" />
              <span className="text-sm font-medium">Ready Without Data</span>
            </div>
            <div className="inline-flex items-center gap-2 bg-white/10 w-fit px-4 py-2 rounded-full backdrop-blur-sm">
              <CheckCircle2 size={16} className="text-[#8BAF98]" />
              <span className="text-sm font-medium">Local AI Tutor</span>
            </div>
            <div className="inline-flex items-center gap-2 bg-white/10 w-fit px-4 py-2 rounded-full backdrop-blur-sm">
              <CheckCircle2 size={16} className="text-[#8BAF98]" />
              <span className="text-sm font-medium">Village Leaderboard</span>
            </div>
          </div>
        </div>
        <div className="text-sm text-white/40">
          © 2026 CryptEdu
        </div>
      </div>

      {/* Right Panel */}
      <div className="flex-1 flex items-center justify-center bg-[#F5F0E8] p-6 overflow-y-auto">
        <div 
          className={`bg-white w-full max-w-[440px] rounded-[20px] p-[48px] shadow-sm transition-all duration-300 ease-out ${
            step === 2 ? 'translate-x-0 opacity-100' : ''
          }`}
          style={step === 1 ? {} : { animation: 'slideIn 300ms ease-out' }}
        >
          {step === 1 && (
            <>
              <h2 className="text-[28px] font-[800] text-[#1A1A1A] mb-2 tracking-tight">Join CryptEdu</h2>
              <p className="text-[15px] text-[#6B7280] mb-8">First, tell us who you are</p>

              <div className="flex flex-col gap-4 mb-8">
                <button
                  onClick={() => setRole('student')}
                  className={`flex flex-col items-start p-5 rounded-[12px] border-2 text-left transition-all duration-200 ${
                    role === 'student' ? 'border-[#E8A838] bg-[#FDF3DC]' : 'border-[#E5E0D8] bg-white hover:border-[#E8A838]/50'
                  }`}
                >
                  <span className="text-xl mb-1">🎓</span>
                  <span className="font-bold text-[#1A1A1A]">I am a Student</span>
                  <span className="text-sm text-[#6B7280] mt-1">Access lessons, quizzes and AI tutor</span>
                </button>

                <button
                  onClick={() => setRole('teacher')}
                  className={`flex flex-col items-start p-5 rounded-[12px] border-2 text-left transition-all duration-200 ${
                    role === 'teacher' ? 'border-[#E8A838] bg-[#FDF3DC]' : 'border-[#E5E0D8] bg-white hover:border-[#E8A838]/50'
                  }`}
                >
                  <span className="text-xl mb-1">👩‍🏫</span>
                  <span className="font-bold text-[#1A1A1A]">I am a Teacher</span>
                  <span className="text-sm text-[#6B7280] mt-1">Answer questions and support students</span>
                </button>
              </div>

              <button
                onClick={handleNextStep}
                disabled={!role}
                className="w-full h-[52px] bg-[#E8A838] hover:bg-[#D99A2D] active:bg-[#C98A1C] text-white font-semibold rounded-[10px] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Continue
              </button>

              <div className="mt-6 text-center">
                <span className="text-[#6B7280] text-sm">Already have an account? </span>
                <Link to="/signin" className="text-[#E8A838] hover:text-[#D99A2D] text-sm font-semibold transition-colors">
                  Sign in
                </Link>
              </div>
            </>
          )}

          {step === 2 && (
            <div className="animate-in slide-in-from-right-10 fade-in duration-300">
              <button 
                onClick={() => setStep(1)} 
                className="flex items-center gap-2 text-[#6B7280] hover:text-[#1A1A1A] transition-colors mb-6 -ml-2 p-2"
              >
                <ArrowLeft size={20} />
              </button>

              <div className="flex items-center gap-3 mb-6">
                <h2 className="text-[28px] font-[800] text-[#1A1A1A] tracking-tight">Details</h2>
                <div className={`px-3 py-1 rounded-full text-xs font-bold ${
                  role === 'student' ? 'bg-[#E6F4ED] text-[#2D7A4F]' : 'bg-[#FDF3DC] text-[#B45309]'
                }`}>
                  {role === 'student' ? 'Student' : 'Teacher'}
                </div>
              </div>

              <form onSubmit={handleSignUp} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-semibold text-[#374151]">Full Name</label>
                  <input required name="name" value={formData.name} onChange={handleInputChange} className="input-field" placeholder="Ahmad bin Ali" />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-semibold text-[#374151]">Email</label>
                  <input type="email" required name="email" value={formData.email} onChange={handleInputChange} className="input-field" placeholder="ahmad@school.edu.my" />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-semibold text-[#374151]">Password</label>
                  <div className="relative">
                    <input type={showPassword ? 'text' : 'password'} required name="password" value={formData.password} onChange={handleInputChange} className="input-field pr-11" placeholder="••••••••" />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]">
                      {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-semibold text-[#374151]">Confirm Password</label>
                  <div className="relative">
                    <input type={showConfirm ? 'text' : 'password'} required name="confirmPassword" value={formData.confirmPassword} onChange={handleInputChange} className="input-field pr-11" placeholder="••••••••" />
                    <button type="button" onClick={() => setShowConfirm(!showConfirm)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]">
                      {showConfirm ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  </div>
                </div>

                {role === 'student' && (
                  <>
                    <div className="flex gap-4">
                      <div className="flex flex-col gap-1.5 flex-1">
                        <label className="text-sm font-semibold text-[#374151]">Grade</label>
                        <select required name="grade" value={formData.grade} onChange={handleInputChange} className="input-field bg-white">
                          <option value="" disabled>Select Grade</option>
                          {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
                        </select>
                      </div>
                      <div className="flex flex-col gap-1.5 flex-1">
                        <label className="text-sm font-semibold text-[#374151]">Village/Area</label>
                        <input required name="village" value={formData.village} onChange={handleInputChange} className="input-field" placeholder="Kg. Baru" />
                      </div>
                    </div>
                  </>
                )}

                {role === 'teacher' && (
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-semibold text-[#374151]">Subject</label>
                    <select required name="subject" value={formData.subject} onChange={handleInputChange} className="input-field bg-white">
                      <option value="" disabled>Select Subject</option>
                      {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                )}

                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-semibold text-[#374151]">School Node</label>
                  <select required name="school_node" value={formData.school_node} onChange={handleInputChange} className="input-field bg-white">
                    <option value="" disabled>Select School Node</option>
                    {SCHOOL_NODES.map(node => <option key={node} value={node}>{node}</option>)}
                  </select>
                </div>

                {role === 'student' && (
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-semibold text-[#374151]">Parent Phone <span className="text-[#9CA3AF] font-normal">(optional)</span></label>
                    <input type="tel" name="parent_phone" value={formData.parent_phone} onChange={handleInputChange} className="input-field" placeholder="012-3456789" />
                    <p className="text-xs text-[#6B7280] mt-1">For weekly SMS progress reports</p>
                  </div>
                )}

                {role === 'teacher' && (
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-semibold text-[#374151]">Teacher Code</label>
                    <input required name="teacherCode" value={formData.teacherCode} onChange={handleInputChange} maxLength={8} className="input-field" placeholder="8 characters" />
                    <p className="text-xs text-[#6B7280] mt-1">Provided by your school administrator</p>
                  </div>
                )}

                {error && <p className="text-[#DC2626] text-[13px] font-medium mt-1">{error}</p>}

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full h-[52px] bg-[#E8A838] hover:bg-[#D99A2D] active:bg-[#C98A1C] text-white font-semibold rounded-[10px] mt-4 flex items-center justify-center transition-all duration-200 disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {isLoading ? (
                    <span className="flex items-center gap-2">
                      <Loader2 size={18} className="animate-spin" />
                      Creating account...
                    </span>
                  ) : (
                    'Create Account'
                  )}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        .input-field {
          width: 100%;
          background-color: white;
          border: 1.5px solid #E5E0D8;
          border-radius: 10px;
          padding: 12px 16px;
          color: #1A1A1A;
          outline: none;
          transition: all 200ms;
        }
        .input-field:focus {
          border-color: #E8A838;
          box-shadow: 0 0 0 1px #E8A838;
        }
        @keyframes slideIn {
          from { transform: translateX(40px); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}} />
    </div>
  );
}
