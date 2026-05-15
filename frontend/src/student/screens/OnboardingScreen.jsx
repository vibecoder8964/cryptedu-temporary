// CryptEdu — screens/OnboardingScreen.jsx
// 3-step onboarding: Student Details → Village & Parent → Hub Radar Scan
// Ref: design_guidelines.md §1 (full screen exception), developer_skill.md §6 Screen 1

import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import useAppStore from '../store/appStore';

const GRADES = [
  'Year 1','Year 2','Year 3','Year 4','Year 5','Year 6',
  'Tingkatan 1','Tingkatan 2','Tingkatan 3','Tingkatan 4','Tingkatan 5',
];

// ── Step indicators ───────────────────────────────────────────────────────────
function StepDots({ current, total }) {
  return (
    <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 32 }}>
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          style={{
            width: i === current ? 24 : 8, height: 8,
            borderRadius: 9999,
            background: i === current ? '#E8A838' : '#E5E0D8',
            transition: 'all 300ms ease',
          }}
        />
      ))}
    </div>
  );
}

// ── Step 1: Student Details ───────────────────────────────────────────────────
function Step1({ data, onChange, onNext }) {
  const valid = data.name.trim().length >= 2 && data.grade;
  return (
    <>
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🎓</div>
        <h1 style={{
          fontFamily: 'Inter, sans-serif', fontSize: 28, fontWeight: 800,
          color: '#1B3A2D', letterSpacing: '-0.02em', marginBottom: 8,
        }}>
          Welcome to CryptEdu
        </h1>
        <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 15, color: '#6B7280' }}>
          Your offline learning companion. Let's get you set up.
        </p>
      </div>

      <StepDots current={0} total={3} />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <label style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, fontWeight: 500, color: '#6B7280', display: 'block', marginBottom: 6 }}>
            Your full name
          </label>
          <input
            className="input-field"
            placeholder="e.g. Ahmad Firdaus bin Razali"
            value={data.name}
            onChange={e => onChange('name', e.target.value)}
            autoFocus
          />
        </div>

        <div>
          <label style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, fontWeight: 500, color: '#6B7280', display: 'block', marginBottom: 6 }}>
            Your grade
          </label>
          <select
            className="input-field"
            value={data.grade}
            onChange={e => onChange('grade', e.target.value)}
            style={{ appearance: 'none', cursor: 'pointer' }}
          >
            <option value="">Select your grade…</option>
            {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>

        <button
          className="btn-primary btn-primary--full"
          style={{ marginTop: 8 }}
          onClick={onNext}
          disabled={!valid}
        >
          Continue →
        </button>
      </div>
    </>
  );
}

// ── Step 2: Village & Parent ──────────────────────────────────────────────────
function Step2({ data, onChange, onNext, onBack }) {
  const valid = data.village.trim().length >= 2;
  return (
    <>
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>📍</div>
        <h1 style={{
          fontFamily: 'Inter, sans-serif', fontSize: 28, fontWeight: 800,
          color: '#1B3A2D', letterSpacing: '-0.02em', marginBottom: 8,
        }}>
          Your Location
        </h1>
        <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 15, color: '#6B7280' }}>
          So we can connect you to the right School Node.
        </p>
      </div>

      <StepDots current={1} total={3} />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <label style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, fontWeight: 500, color: '#6B7280', display: 'block', marginBottom: 6 }}>
            Village / School name
          </label>
          <input
            className="input-field"
            placeholder="e.g. Kampung Baru, Kelantan"
            value={data.village}
            onChange={e => onChange('village', e.target.value)}
            autoFocus
          />
        </div>

        <div>
          <label style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, fontWeight: 500, color: '#6B7280', display: 'block', marginBottom: 4 }}>
            Parent's phone number <span style={{ fontWeight: 400 }}>(optional)</span>
          </label>
          <input
            className="input-field"
            placeholder="e.g. 011-2345 6789"
            value={data.parentPhone}
            onChange={e => onChange('parentPhone', e.target.value)}
            type="tel"
          />
          <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, color: '#6B7280', marginTop: 6 }}>
            For weekly progress reports via SMS every Sunday.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
          <button className="btn-secondary" style={{ flex: 1 }} onClick={onBack}>← Back</button>
          <button className="btn-primary" style={{ flex: 2 }} onClick={onNext} disabled={!valid}>
            Continue →
          </button>
        </div>
      </div>
    </>
  );
}

// ── Step 3: Hub Radar Scan ────────────────────────────────────────────────────
function Step3({ onComplete }) {
  const [phase, setPhase] = useState('scanning'); // 'scanning' | 'found'
  const timerRef = useRef(null);

  useEffect(() => {
    // After 3s: snap to found
    timerRef.current = setTimeout(() => setPhase('found'), 3000);
    return () => clearTimeout(timerRef.current);
  }, []);

  useEffect(() => {
    if (phase !== 'found') return;
    // After 1.5s more: navigate to home
    timerRef.current = setTimeout(onComplete, 1500);
    return () => clearTimeout(timerRef.current);
  }, [phase, onComplete]);

  const ringColor = phase === 'found' ? '#2D7A4F' : '#E8A838';
  const textColor = phase === 'found' ? '#2D7A4F' : '#8BAF98';

  return (
    <div style={{
      minHeight: '100vh',
      background: '#1B3A2D',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      gap: 0, padding: 32,
    }}>
      {/* Radar animation */}
      <div style={{ position: 'relative', width: 200, height: 200, marginBottom: 48 }}>
        {/* Pulsing rings */}
        {[0, 1, 2, 3].map(i => (
          <div
            key={i}
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: '50%',
              border: `2px solid ${ringColor}`,
              animation: `radar-ring 2s ease-out ${i * 0.5}s infinite`,
              opacity: phase === 'found' ? 0 : undefined,
              transition: 'border-color 500ms ease',
            }}
          />
        ))}

        {/* Center dot */}
        <div style={{
          position: 'absolute',
          inset: '50%',
          transform: 'translate(-50%, -50%)',
          width: 16, height: 16,
          borderRadius: '50%',
          background: ringColor,
          transition: 'background 500ms ease',
          boxShadow: phase === 'found' ? `0 0 20px ${ringColor}` : 'none',
        }} />

        {/* Found: solid outer ring */}
        {phase === 'found' && (
          <div style={{
            position: 'absolute', inset: 0,
            borderRadius: '50%',
            border: `3px solid #2D7A4F`,
            animation: 'score-reveal 400ms ease forwards',
          }} />
        )}
      </div>

      {/* Status text */}
      <div style={{ textAlign: 'center' }}>
        {phase === 'scanning' ? (
          <>
            <p style={{
              fontFamily: 'Inter, sans-serif', fontSize: 20, fontWeight: 600,
              color: '#F0EDE8', letterSpacing: '-0.02em', marginBottom: 8,
            }}>
              Searching for School Node…
            </p>
            <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 14, color: '#8BAF98' }}>
              This will only take a moment
            </p>
          </>
        ) : (
          <>
            <p style={{
              fontFamily: 'Inter, sans-serif', fontSize: 28, fontWeight: 800,
              color: '#FFFFFF', letterSpacing: '-0.02em', marginBottom: 8,
              animation: 'score-reveal 400ms ease forwards',
            }}>
              CryptEdu Ready.
            </p>
            <p style={{
              fontFamily: 'Inter, sans-serif', fontSize: 18, fontWeight: 500,
              color: '#2D7A4F',
              animation: 'score-reveal 400ms ease 100ms forwards',
              opacity: 0,
            }}>
              No data required.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

// ── Root OnboardingScreen ─────────────────────────────────────────────────────
export default function OnboardingScreen() {
  const navigate  = useNavigate();
  const { setUser } = useAppStore();

  const [step, setStep] = useState(0);
  const [data, setData] = useState({
    name: '', grade: '', village: '', parentPhone: '', smsEnabled: false,
  });

  const onChange = (field, value) => setData(prev => ({ ...prev, [field]: value }));

  const handleComplete = () => {
    setUser(data);
    navigate('/home');
  };

  // Full dark screen for step 3
  if (step === 2) {
    return <Step3 onComplete={handleComplete} />;
  }

  return (
    <div className="onboarding-shell">
      <div className="onboarding-card">
        {step === 0 && (
          <Step1
            data={data}
            onChange={onChange}
            onNext={() => setStep(1)}
          />
        )}
        {step === 1 && (
          <Step2
            data={data}
            onChange={onChange}
            onNext={() => setStep(2)}
            onBack={() => setStep(0)}
          />
        )}
      </div>
    </div>
  );
}
