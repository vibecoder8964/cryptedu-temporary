// CryptEdu — screens/QuizScreen.jsx
// Prompt-style AI Quiz Generator — type what you want, get MCQs, marked instantly
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getQuizBank, SUGGESTED_TOPICS } from '../data/quizData';
import useAppStore from '../store/appStore';
import { generateQuizQuestions } from '../services/aiService';

// ── Score ring ─────────────────────────────────────────────────────────────────
function ScoreRing({ correct, total }) {
  const pct   = total ? Math.round((correct / total) * 100) : 0;
  const size  = 140, stroke = 10, r = (size - stroke) / 2, circ = 2 * Math.PI * r;
  const [offset, setOffset] = useState(circ);
  useEffect(() => {
    const t = setTimeout(() => setOffset(circ - (pct / 100) * circ), 100);
    return () => clearTimeout(t);
  }, [pct, circ]);
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#E5E0D8" strokeWidth={stroke}/>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#E8A838" strokeWidth={stroke}
        strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset 1s ease' }}/>
      <text x={size/2} y={size/2} textAnchor="middle" dominantBaseline="central"
        style={{ transform: `rotate(90deg)`, transformOrigin: `${size/2}px ${size/2}px` }}
        fontSize="28" fontWeight="800" fontFamily="Inter,sans-serif" fill="#1A1A1A">
        {pct}%
      </text>
    </svg>
  );
}

// ── Sidebar ────────────────────────────────────────────────────────────────────
function QuizSidebar({ onSuggest }) {
  const { quizResults } = useAppStore();
  const history = quizResults.map(r => ({
    topic: r.subject || 'Quiz',
    date:  r.date,
    score: r.total ? Math.round((r.score / r.total) * 100) : r.score,
  }));
  const scores = history.map(h => h.score);
  const avg    = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
  const chipColor = s => s >= 70
    ? { bg: '#E6F4ED', color: '#2D7A4F' }
    : s >= 50
    ? { bg: '#FDF3DC', color: '#92650A' }
    : { bg: '#FEE2E2', color: '#DC2626' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* History */}
      <div className="card">
        <h3 style={{ fontFamily: 'Inter,sans-serif', fontSize: 15, fontWeight: 700, color: '#1A1A1A', marginBottom: 14 }}>
          Quiz History
        </h3>
        {history.length === 0 ? (
          <p style={{ fontFamily: 'Inter,sans-serif', fontSize: 13, color: '#6B7280', textAlign: 'center' }}>No quizzes yet.</p>
        ) : history.slice(0, 5).map((h, i) => {
          const c = chipColor(h.score);
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: i < 4 ? '1px solid #E5E0D8' : 'none' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontFamily: 'Inter,sans-serif', fontSize: 13, fontWeight: 500, color: '#1A1A1A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.topic}</p>
                <p style={{ fontFamily: 'Inter,sans-serif', fontSize: 11, color: '#6B7280' }}>{h.date}</p>
              </div>
              <span style={{ fontFamily: 'Inter,sans-serif', fontSize: 12, fontWeight: 700, color: c.color, background: c.bg, padding: '3px 10px', borderRadius: 9999, flexShrink: 0 }}>{h.score}%</span>
            </div>
          );
        })}
      </div>

      {/* Suggested topics */}
      <div className="card">
        <h3 style={{ fontFamily: 'Inter,sans-serif', fontSize: 15, fontWeight: 700, color: '#1A1A1A', marginBottom: 12 }}>
          Try These Topics
        </h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {SUGGESTED_TOPICS.map(t => (
            <button key={t} className="chip" style={{ fontSize: 12 }} onClick={() => onSuggest(t)}>{t}</button>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div className="card">
        <h3 style={{ fontFamily: 'Inter,sans-serif', fontSize: 15, fontWeight: 700, color: '#1A1A1A', marginBottom: 14 }}>Your Stats</h3>
        {[
          { label: 'Quizzes taken', value: history.length },
          { label: 'Average score',  value: `${avg}%` },
        ].map(s => (
          <div key={s.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #E5E0D8' }}>
            <span style={{ fontFamily: 'Inter,sans-serif', fontSize: 13, color: '#6B7280' }}>{s.label}</span>
            <span style={{ fontFamily: 'Inter,sans-serif', fontSize: 13, fontWeight: 700, color: '#1A1A1A' }}>{s.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Fallback: pull 5 MCQs from static bank ────────────────────────────────────
function buildFallbackQuiz(promptText) {
  // Detect subject hint from the prompt
  const lower = promptText.toLowerCase();
  let subject = 'Science';
  if (lower.includes('math') || lower.includes('algebra') || lower.includes('calculus') || lower.includes('equation')) subject = 'Mathematics';
  else if (lower.includes('sejarah') || lower.includes('history'))  subject = 'History';
  else if (lower.includes('english') || lower.includes('essay'))     subject = 'English';
  else if (lower.includes('bahasa') || lower.includes('bm'))         subject = 'Bahasa Malaysia';

  const { getQuizBank } = require('../data/quizData');
  const bank = getQuizBank(subject);
  return bank.mcq.slice(0, 5).map(q => ({ ...q, type: 'mcq' }));
}

// ── Main Screen ────────────────────────────────────────────────────────────────
export default function QuizScreen() {
  const navigate = useNavigate();
  const { addQuizResult } = useAppStore();

  // ── State ──────────────────────────────────────────────────────────────────
  const [userPrompt,  setUserPrompt]  = useState('');
  const [generating,  setGenerating]  = useState(false);
  const [genError,    setGenError]    = useState('');

  const [quizState,   setQuizState]   = useState('setup'); // setup | active | results
  const [questions,   setQuestions]   = useState([]);
  const [qIndex,      setQIndex]      = useState(0);

  // Per-question: which option the student clicked (null = not yet answered)
  const [selected,    setSelected]    = useState(null);

  // Track score across questions
  const [correctCount, setCorrectCount] = useState(0);

  // Timer
  const [seconds,  setSeconds]  = useState(0);
  const [finalSec, setFinalSec] = useState(0);
  const timerRef = useRef(null);

  const promptRef = useRef(null);

  useEffect(() => {
    if (quizState === 'active') {
      timerRef.current = setInterval(() => setSeconds(s => s + 1), 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [quizState]);

  const fmt = s => `${Math.floor(s / 60)}m ${s % 60}s`;

  // ── Generate quiz ──────────────────────────────────────────────────────────
  const handleGenerate = async () => {
    if (!userPrompt.trim()) return;
    setGenerating(true);
    setGenError('');
    try {
      const aiQuestions = await generateQuizQuestions(userPrompt.trim());
      if (aiQuestions && aiQuestions.length > 0) {
        setQuestions(aiQuestions);
        setSelected(null);
        setQIndex(0);
        setSeconds(0);
        setCorrectCount(0);
        setQuizState('active');
      } else {
        setGenError('AI did not return valid questions. Please try again.');
      }
    } catch (err) {
      setGenError(err.message || 'Could not connect to AI.');
    } finally {
      setGenerating(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleGenerate(); }
  };

  // ── Answer selection — mark instantly ─────────────────────────────────────
  const handleSelect = (optionIndex) => {
    if (selected !== null) return; // already answered
    setSelected(optionIndex);
    if (optionIndex === questions[qIndex].correct) {
      setCorrectCount(c => c + 1);
    }
  };

  // ── Next question ──────────────────────────────────────────────────────────
  const handleNext = () => {
    if (qIndex + 1 >= questions.length) {
      setFinalSec(seconds);
      const finalCorrect = selected === questions[qIndex].correct ? correctCount : correctCount;
      addQuizResult({
        lessonId: 'quiz',
        score:    correctCount + (selected === questions[qIndex].correct ? 0 : 0), // already counted in handleSelect
        total:    questions.length,
        subject:  userPrompt.slice(0, 40),
      });
      setQuizState('results');
    } else {
      setQIndex(i => i + 1);
      setSelected(null);
    }
  };

  const cur = questions[qIndex] ?? null;

  // ── Option button style ────────────────────────────────────────────────────
  const optionStyle = (i) => {
    const base = {
      fontFamily: 'Inter,sans-serif', fontSize: 15, fontWeight: 500,
      textAlign: 'left', padding: '13px 18px', borderRadius: 12,
      width: '100%', cursor: selected !== null ? 'default' : 'pointer',
      display: 'flex', alignItems: 'center', gap: 12,
      transition: 'all 200ms ease',
    };
    if (selected === null) {
      return { ...base, background: '#FFFFFF', border: '2px solid #E5E0D8', color: '#1A1A1A' };
    }
    if (i === questions[qIndex].correct) {
      return { ...base, background: '#E6F4ED', border: '2px solid #2D7A4F', color: '#1A1A1A' };
    }
    if (i === selected) {
      return { ...base, background: '#FEE2E2', border: '2px solid #DC2626', color: '#1A1A1A' };
    }
    return { ...base, background: '#FFFFFF', border: '2px solid #E5E0D8', color: '#9CA3AF' };
  };

  const optionLabel = (i) => {
    if (selected === null) return null;
    if (i === questions[qIndex].correct) return ' ✓';
    if (i === selected) return ' ✗';
    return null;
  };

  const encouragement = () => {
    const pct = questions.length ? Math.round((correctCount / questions.length) * 100) : 0;
    if (pct >= 90) return 'Outstanding! You have mastered this topic! 🏆';
    if (pct >= 70) return 'Great work! Keep it up! 🌟';
    if (pct >= 50) return 'Good effort! Review the weak areas below 📚';
    return 'Keep practising! You will get there! 💪';
  };

  return (
    <div className="screen">
      <h1 style={{ fontFamily: 'Inter,sans-serif', fontSize: 28, fontWeight: 800, color: '#1A1A1A', letterSpacing: '-0.02em', marginBottom: 4 }}>
        Quiz Generator
      </h1>
      <p style={{ fontFamily: 'Inter,sans-serif', fontSize: 15, color: '#6B7280', marginBottom: 28 }}>
        Tell the AI what you want to be tested on
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 24, alignItems: 'start' }}>

        {/* ── LEFT ──────────────────────────────────────────────────────────── */}
        <div>

          {/* STATE 1: Setup — prompt input */}
          {quizState === 'setup' && (
            <div className="card">
              <h2 style={{ fontFamily: 'Inter,sans-serif', fontSize: 20, fontWeight: 700, color: '#1A1A1A', letterSpacing: '-0.01em', marginBottom: 8 }}>
                What would you like to be tested on?
              </h2>
              <p style={{ fontFamily: 'Inter,sans-serif', fontSize: 13, color: '#6B7280', marginBottom: 20 }}>
                Type your topic, subject, or a specific request. Be as specific or broad as you like.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {genError && (
                  <div style={{ padding: '12px 16px', background: '#FEF2F2', border: '1px solid #F87171', borderRadius: 8, color: '#B91C1C', fontFamily: 'Inter,sans-serif', fontSize: 13, fontWeight: 500 }}>
                    {genError}
                  </div>
                )}
                <textarea
                  ref={promptRef}
                  className="input-field input-field--textarea"
                  placeholder={`e.g. "Quiz me on photosynthesis"\n"1 SPM-level question on quadratic equations"\n"Test me on World War 2 causes"`}
                  value={userPrompt}
                  onChange={e => setUserPrompt(e.target.value)}
                  onKeyDown={handleKeyDown}
                  rows={4}
                  style={{ resize: 'none', lineHeight: 1.6 }}
                />

                <button
                  className="btn-primary btn-primary--full"
                  style={{ height: 52, fontSize: 16 }}
                  onClick={handleGenerate}
                  disabled={generating || !userPrompt.trim()}
                >
                  {generating ? (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'center' }}>
                      <span style={{ width: 18, height: 18, border: '2px solid rgba(0,0,0,0.2)', borderTopColor: '#1A1A1A', borderRadius: '50%', animation: 'spin 0.7s linear infinite', display: 'inline-block' }}/>
                      AI is generating your quiz…
                    </span>
                  ) : 'Generate Quiz →'}
                </button>

                <p style={{ fontFamily: 'Inter,sans-serif', fontSize: 12, color: '#9CA3AF', textAlign: 'center' }}>
                  {generating
                    ? 'This may take 15–40 seconds. The AI is crafting your questions…'
                    : 'Powered by a fine-tuned KPM curriculum AI model · Press Enter to generate'}
                </p>
              </div>
            </div>
          )}

          {/* STATE 2: Active Quiz — one MCQ at a time, marked instantly */}
          {quizState === 'active' && cur && (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              {/* Header */}
              <div style={{ padding: '16px 24px', borderBottom: '1px solid #E5E0D8', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontFamily: 'Inter,sans-serif', fontSize: 13, fontWeight: 600, color: '#4F46E5', background: '#EEF2FF', padding: '3px 10px', borderRadius: 9999 }}>
                    {userPrompt.length > 40 ? userPrompt.slice(0, 40) + '…' : userPrompt}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <span style={{ fontFamily: 'Inter,sans-serif', fontSize: 13, color: '#6B7280' }}>⏱ {fmt(seconds)}</span>
                  <span style={{ fontFamily: 'Inter,sans-serif', fontSize: 13, fontWeight: 600, color: '#2D7A4F' }}>✓ {correctCount}</span>
                  <span style={{ fontFamily: 'Inter,sans-serif', fontSize: 13, fontWeight: 600, color: '#1A1A1A' }}>Q {qIndex + 1} / {questions.length}</span>
                </div>
              </div>

              {/* Progress bar */}
              <div className="progress-track" style={{ borderRadius: 0, height: 4 }}>
                <div className="progress-fill" style={{ width: `${(qIndex / questions.length) * 100}%`, borderRadius: 0, transition: 'width 400ms ease' }}/>
              </div>

              <div style={{ padding: 24 }}>
                <p style={{ fontFamily: 'Inter,sans-serif', fontSize: 12, fontWeight: 600, color: '#6B7280', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Multiple Choice
                </p>
                <h2 style={{ fontFamily: 'Inter,sans-serif', fontSize: 18, fontWeight: 600, color: '#1A1A1A', lineHeight: 1.5, marginBottom: 20 }}>
                  {cur.question}
                </h2>

                {/* Options */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
                  {cur.options.map((opt, i) => (
                    <button key={i} onClick={() => handleSelect(i)} style={optionStyle(i)}>
                      <span style={{
                        width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 13, fontWeight: 700,
                        background: selected !== null && i === cur.correct ? '#2D7A4F'
                                  : selected === i && i !== cur.correct ? '#DC2626'
                                  : 'rgba(0,0,0,0.07)',
                        color: selected !== null && (i === cur.correct || (selected === i && i !== cur.correct)) ? '#fff' : 'inherit',
                        transition: 'all 200ms ease',
                      }}>
                        {String.fromCharCode(65 + i)}
                      </span>
                      <span style={{ flex: 1 }}>{opt}</span>
                      {optionLabel(i) && (
                        <span style={{ fontWeight: 700, fontSize: 16 }}>{optionLabel(i)}</span>
                      )}
                    </button>
                  ))}
                </div>

                {/* Explanation — appears after answering */}
                {selected !== null && (
                  <div style={{
                    background: selected === cur.correct ? '#E6F4ED' : '#FEF3C7',
                    border: `1px solid ${selected === cur.correct ? '#86EFAC' : '#FDE68A'}`,
                    borderRadius: 10, padding: '12px 16px', marginBottom: 20,
                    animation: 'screen-enter 250ms ease both',
                  }}>
                    <p style={{ fontFamily: 'Inter,sans-serif', fontSize: 13, fontWeight: 700, color: selected === cur.correct ? '#2D7A4F' : '#92650A', marginBottom: 4 }}>
                      {selected === cur.correct ? '✓ Correct!' : `✗ Incorrect — Correct answer: ${cur.options[cur.correct]}`}
                    </p>
                    <p style={{ fontFamily: 'Inter,sans-serif', fontSize: 13, color: selected === cur.correct ? '#1A5C38' : '#78350F', lineHeight: 1.5 }}>
                      {cur.explanation}
                    </p>
                  </div>
                )}

                {/* Next button — only shown after answering */}
                {selected !== null && (
                  <button className="btn-primary btn-primary--full" onClick={handleNext} style={{ animation: 'screen-enter 250ms ease both' }}>
                    {qIndex + 1 >= questions.length ? 'See Results →' : 'Next Question →'}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* STATE 3: Results */}
          {quizState === 'results' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20, animation: 'screen-enter 300ms ease both' }}>
              <div className="card" style={{ textAlign: 'center', padding: 40 }}>
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
                  <ScoreRing correct={correctCount} total={questions.length} />
                </div>
                <p style={{ fontFamily: 'Inter,sans-serif', fontSize: 20, fontWeight: 600, color: '#1A1A1A', marginBottom: 4 }}>
                  {correctCount} / {questions.length} correct
                </p>
                <p style={{ fontFamily: 'Inter,sans-serif', fontSize: 15, color: '#6B7280', marginBottom: 20 }}>
                  {encouragement()}
                </p>
                <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
                  <span style={{ fontFamily: 'Inter,sans-serif', fontSize: 13, fontWeight: 600, color: '#2D7A4F', background: '#E6F4ED', padding: '6px 16px', borderRadius: 9999 }}>
                    ⏱ {fmt(finalSec)}
                  </span>
                  <span style={{ fontFamily: 'Inter,sans-serif', fontSize: 13, fontWeight: 600, color: '#92650A', background: '#FDF3DC', padding: '6px 16px', borderRadius: 9999 }}>
                    📝 {questions.length} Questions
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 12 }}>
                <button
                  className="btn-primary"
                  style={{ flex: 1 }}
                  onClick={() => { setQuizState('setup'); setQuestions([]); setQIndex(0); setSelected(null); setCorrectCount(0); }}
                >
                  Try Another Topic
                </button>
                <button className="btn-secondary" onClick={() => navigate('/tutor')}>
                  Ask the AI Tutor
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── RIGHT: Sidebar ──────────────────────────────────────────────── */}
        <QuizSidebar onSuggest={t => { setUserPrompt(t); if (quizState !== 'setup') { setQuizState('setup'); setQuestions([]); } }} />
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  );
}
