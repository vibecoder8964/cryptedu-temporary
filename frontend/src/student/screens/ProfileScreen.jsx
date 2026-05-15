// CryptEdu — screens/ProfileScreen.jsx
// Student profile, streak, leaderboard, subject progress, quiz history, parent settings
// Ref: developer_skill.md §6 Screen 9, design_guidelines.md §7 Profile Screen Bento

import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageCircle, Users, MessageSquare, BookOpen, ChevronDown, Edit2 } from 'lucide-react';
import useAppStore from '../store/appStore';
import { leaderboard, lessons } from '../data/mockData';
import VillageLeaderboard from '../components/VillageLeaderboard';

// ── Animated circular progress ring ───────────────────────────────────────────
function ProgressRing({ pct, size = 56, stroke = 6 }) {
  const r   = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const [offset, setOffset] = useState(circ);

  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      setOffset(circ - (pct / 100) * circ);
    });
    return () => cancelAnimationFrame(raf);
  }, [pct, circ]);

  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#E5E0D8" strokeWidth={stroke} />
      <circle
        cx={size/2} cy={size/2} r={r}
        fill="none" stroke="#E8A838" strokeWidth={stroke}
        strokeDasharray={circ}
        strokeDashoffset={offset}
        strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset 800ms ease' }}
      />
      <text
        x={size/2} y={size/2}
        textAnchor="middle" dominantBaseline="central"
        style={{ transform: `rotate(90deg)`, transformOrigin: `${size/2}px ${size/2}px` }}
        fontSize="12" fontWeight="700" fontFamily="Inter, sans-serif" fill="#1A1A1A"
      >
        {pct}%
      </text>
    </svg>
  );
}

// ── Subject progress bar row ───────────────────────────────────────────────────
function SubjectProgressRow({ lesson, pct }) {
  const fillRef = useRef(null);
  useEffect(() => {
    if (!fillRef.current) return;
    requestAnimationFrame(() => { fillRef.current.style.width = `${pct}%`; });
  }, [pct]);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 14, fontWeight: 500, color: '#1A1A1A', width: 140, flexShrink: 0 }}>
        {lesson.subject}
      </p>
      <div className="progress-track" style={{ flex: 1 }}>
        <div ref={fillRef} className="progress-fill" style={{ width: '0%' }} />
      </div>
      <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, fontWeight: 600, color: '#E8A838', width: 36, textAlign: 'right', flexShrink: 0 }}>
        {pct}%
      </span>
    </div>
  );
}

// ── Teacher Profile ───────────────────────────────────────────────────────────
function TeacherProfile() {
  const navigate = useNavigate();
  const { currentUser } = useAppStore();

  const DEMO_TEACHER = {
    name: currentUser?.name || 'Cikgu Tan Wei Ming',
    email: currentUser?.email || 'tan.weiming@school.edu.my',
    subject: currentUser?.subject || 'Mathematics',
    schoolNode: currentUser?.school_node || 'SK Kg. Peta — Kota Tinggi, Johor',
    questionsAnswered: 0,
    studentsHelped: 0,
    recentAnswers: []
  };

  const initial = DEMO_TEACHER.name[0]?.toUpperCase() ?? 'T';

  const [editName, setEditName] = useState(DEMO_TEACHER.name);
  const [editSubject, setEditSubject] = useState(DEMO_TEACHER.subject);
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="screen">
      {/* ── Row 1: Teacher Info Cards (3 cols) ──────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: 20, marginBottom: 24 }}>
        
        {/* Card 1: Identity */}
        <div className="card" style={{ background: '#1B3A2D', border: 'none', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: -40, right: -40, width: 120, height: 120, background: 'radial-gradient(circle, rgba(255,255,255,0.05) 0%, transparent 70%)', borderRadius: '50%' }} />
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#2D7A4F', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, fontWeight: 800, color: '#FFFFFF', flexShrink: 0 }}>
              {initial}
            </div>
            <div>
              <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 20, fontWeight: 700, color: '#FFFFFF', letterSpacing: '-0.01em', marginBottom: 6 }}>{DEMO_TEACHER.name}</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, fontWeight: 600, color: '#1A1A1A', background: '#E8A838', padding: '4px 10px', borderRadius: 9999 }}>
                  👩‍🏫 Teacher
                </span>
                <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: '#8BAF98' }}>{DEMO_TEACHER.subject}</span>
              </div>
              <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: '#8BAF98' }}>{DEMO_TEACHER.schoolNode}</p>
            </div>
          </div>
          <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.1)', display: 'flex', gap: 8 }}>
            <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, fontWeight: 600, color: '#8BAF98', background: 'rgba(255,255,255,0.1)', padding: '4px 10px', borderRadius: 9999 }}>
              Knowledge Mesh Active ✓
            </span>
          </div>
        </div>

        {/* Card 2: Questions Answered */}
        <div className="card" style={{ position: 'relative' }}>
          <div style={{ position: 'absolute', top: 24, right: 24, width: 40, height: 40, borderRadius: '50%', background: '#FDF3DC', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <MessageCircle size={20} color="#E8A838" />
          </div>
          <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 48, fontWeight: 800, color: '#1A1A1A', lineHeight: 1, letterSpacing: '-0.02em', marginBottom: 12 }}>
            {DEMO_TEACHER.questionsAnswered}
          </p>
          <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 15, fontWeight: 600, color: '#1A1A1A', marginBottom: 4 }}>Questions Answered</p>
          <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: '#6B7280' }}>Help a student today</p>
        </div>

        {/* Card 3: Students Helped */}
        <div className="card" style={{ position: 'relative' }}>
          <div style={{ position: 'absolute', top: 24, right: 24, width: 40, height: 40, borderRadius: '50%', background: '#E6F4ED', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Users size={20} color="#2D7A4F" />
          </div>
          <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 48, fontWeight: 800, color: '#1A1A1A', lineHeight: 1, letterSpacing: '-0.02em', marginBottom: 12 }}>
            {DEMO_TEACHER.studentsHelped}
          </p>
          <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 15, fontWeight: 600, color: '#1A1A1A', marginBottom: 4 }}>Students Helped</p>
          <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: '#6B7280' }}>This month</p>
        </div>
      </div>

      {/* ── Row 2: Recent Activity ────────────────────────────────────────────── */}
      <div className="card" style={{ marginBottom: 24 }}>
        <h2 style={{ fontFamily: 'Inter, sans-serif', fontSize: 18, fontWeight: 700, color: '#1A1A1A', letterSpacing: '-0.01em', marginBottom: 4 }}>
          My Recent Answers
        </h2>
        <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: '#6B7280', marginBottom: 24 }}>
          Your contributions to the community
        </p>

        {DEMO_TEACHER.recentAnswers.length > 0 ? (
          <div>
            {/* List would go here */}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 0' }}>
            <MessageSquare size={64} color="#D1D5DB" strokeWidth={1.5} style={{ marginBottom: 16 }} />
            <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 16, fontWeight: 600, color: '#374151', marginBottom: 8 }}>
              You haven't answered any questions yet
            </p>
            <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 14, color: '#6B7280', marginBottom: 24 }}>
              Head to Community to help students
            </p>
            <button 
              onClick={() => navigate('/community')}
              className="btn-primary"
            >
              Go to Community
            </button>
          </div>
        )}
      </div>

      {/* ── Row 3: Subject & Node Info (2 cols) ──────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '60% 40%', gap: 20, marginBottom: 24 }}>
        
        {/* Left: Subject Focus */}
        <div className="card">
          <h2 style={{ fontFamily: 'Inter, sans-serif', fontSize: 18, fontWeight: 700, color: '#1A1A1A', letterSpacing: '-0.01em', marginBottom: 20 }}>
            My Subject
          </h2>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 20 }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#FDF3DC', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <BookOpen size={32} color="#E8A838" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 24, fontWeight: 700, color: '#1A1A1A', letterSpacing: '-0.02em' }}>
                  {DEMO_TEACHER.subject}
                </p>
                <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 11, fontWeight: 600, color: '#E8A838', background: '#FDF3DC', padding: '4px 10px', borderRadius: 9999 }}>
                  Primary Subject
                </span>
              </div>
              <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 14, color: '#6B7280', lineHeight: 1.5 }}>
                All questions tagged with this subject are highlighted for you in the Community feed.
              </p>
            </div>
          </div>
        </div>

        {/* Right: Node Info */}
        <div className="card">
          <h2 style={{ fontFamily: 'Inter, sans-serif', fontSize: 18, fontWeight: 700, color: '#1A1A1A', letterSpacing: '-0.01em', marginBottom: 20 }}>
            My Node
          </h2>
          <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 18, fontWeight: 600, color: '#1A1A1A', marginBottom: 16 }}>
            {DEMO_TEACHER.schoolNode}
          </p>
          <div style={{ height: 1, background: '#E5E0D8', margin: '16px 0' }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 16 }}>👥</span>
              <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 14, color: '#374151', fontWeight: 500 }}>47 Active Students</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 16 }}>❓</span>
              <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 14, color: '#374151', fontWeight: 500 }}>12 Unanswered Questions</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 16 }}>✅</span>
              <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 14, color: '#374151', fontWeight: 500 }}>Knowledge Mesh Active</p>
            </div>
          </div>
          <button 
            onClick={() => navigate('/community')}
            className="w-full h-[44px] bg-transparent border-2 border-[#E8A838] text-[#E8A838] hover:bg-[#FDF3DC] font-semibold rounded-[8px] transition-all duration-200"
          >
            View Community
          </button>
        </div>
      </div>

      {/* ── Row 4: Settings ──────────────────────────────────────────────────── */}
      <div className="card">
        <h2 style={{ fontFamily: 'Inter, sans-serif', fontSize: 18, fontWeight: 700, color: '#1A1A1A', letterSpacing: '-0.01em', marginBottom: 24 }}>
          Account Settings
        </h2>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 40 }}>
          
          {/* Left Col */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div>
              <label style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 8 }}>
                Display Name
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  className="w-full bg-[#ffffff] border-[1px] border-[rgba(0,0,0,0.15)] rounded-[6px] px-4 py-3 text-[#1A1A1A] outline-none focus:border-[#E8A838] transition-all duration-200"
                />
                <Edit2 size={16} color="#9CA3AF" style={{ position: 'absolute', right: 14, top: 14, pointerEvents: 'none' }} />
              </div>
            </div>

            <div>
              <label style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 8 }}>
                Email
              </label>
              <input
                type="text"
                value={DEMO_TEACHER.email}
                disabled
                className="w-full bg-[#F3F4F6] border-[1px] border-[rgba(0,0,0,0.05)] rounded-[6px] px-4 py-3 text-[#6B7280] outline-none cursor-not-allowed"
              />
            </div>

            <div>
              <label style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 8 }}>
                Subject
              </label>
              <div className="relative">
                <select
                  value={editSubject}
                  onChange={e => setEditSubject(e.target.value)}
                  className="w-full bg-[#ffffff] border-[1px] border-[rgba(0,0,0,0.15)] rounded-[6px] px-4 py-3 text-[#1A1A1A] outline-none focus:border-[#E8A838] transition-all duration-200 appearance-none"
                >
                  <option>Mathematics</option>
                  <option>Science</option>
                  <option>English</option>
                  <option>Bahasa Melayu</option>
                  <option>Sejarah</option>
                </select>
                <ChevronDown size={16} color="#9CA3AF" style={{ position: 'absolute', right: 14, top: 14, pointerEvents: 'none' }} />
              </div>
            </div>
          </div>

          {/* Right Col */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div>
              <label style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 8 }}>
                School Node
              </label>
              <input
                type="text"
                value={DEMO_TEACHER.schoolNode}
                disabled
                className="w-full bg-[#F3F4F6] border-[1px] border-[rgba(0,0,0,0.05)] rounded-[6px] px-4 py-3 text-[#6B7280] outline-none cursor-not-allowed"
              />
              <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, color: '#9CA3AF', marginTop: 6 }}>
                Contact node administrator to change your primary node.
              </p>
            </div>

            <div>
              <label style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 8 }}>
                Teacher Verification Code
              </label>
              <input
                type="password"
                value="secret123"
                disabled
                className="w-full bg-[#F3F4F6] border-[1px] border-[rgba(0,0,0,0.05)] rounded-[6px] px-4 py-3 text-[#6B7280] outline-none cursor-not-allowed tracking-widest"
              />
            </div>

            <div style={{ marginTop: 'auto', paddingTop: 20 }}>
              <button
                onClick={handleSave}
                className="h-[44px] px-6 bg-[#E8A838] hover:bg-[#D99A2D] text-white font-semibold rounded-[8px] transition-all duration-200"
              >
                {saved ? '✓ Changes Saved' : 'Save Changes'}
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

// ── Student Profile ───────────────────────────────────────────────────────────
function StudentProfile() {
  const { user, streak, quizResults, progress, updateUser } = useAppStore();
  const [phone, setPhone]       = useState(user?.parentPhone ?? '');
  const [sms,   setSms]         = useState(user?.smsEnabled ?? false);
  const [saved, setSaved]       = useState(false);

  const name    = user?.name ?? 'Student';
  const grade   = user?.grade ?? 'Tingkatan 3';
  const village = user?.village ?? 'SK Kg. Baru';
  const initial = name[0]?.toUpperCase() ?? 'S';

  const subjectProgress = lessons.map(l => ({
    lesson: l,
    pct: progress[l.id] ?? l.progress ?? 0,
  }));

  const overallPct = subjectProgress.length
    ? Math.round(subjectProgress.reduce((a, b) => a + b.pct, 0) / subjectProgress.length)
    : 0;

  const handleSave = () => {
    updateUser({ parentPhone: phone, smsEnabled: sms });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const ACHIEVEMENTS = [
    { icon: '🔥', title: 'Week Warrior', desc: '7-day streak', bg: '#FDF3DC', earned: streak >= 7 },
    { icon: '🧠', title: 'Quiz Master', desc: '5 quizzes completed', bg: '#EEF2FF', earned: quizResults.length >= 5 },
    { icon: '📚', title: 'Lesson Explorer', desc: 'All subjects started', bg: '#E6F4ED', earned: true },
    { icon: '💬', title: 'Curious Learner', desc: 'Asked the Local AI Tutor', bg: '#FEF2F2', earned: true },
    { icon: '🌟', title: 'Knowledge Mesh Pioneer', desc: 'Connected to School Node', bg: '#F0FDF4', earned: false },
  ];

  return (
    <div className="screen">

      {/* ── Row 1: Profile card + Streak + Overall (3 cols) ─────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20, marginBottom: 24 }}>

        {/* Student card */}
        <div className="card" style={{ background: '#1B3A2D', border: 'none' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#2D7A4F', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, fontWeight: 800, color: '#FFFFFF', flexShrink: 0 }}>
              {initial}
            </div>
            <div>
              <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 18, fontWeight: 700, color: '#FFFFFF', letterSpacing: '-0.01em' }}>{name}</p>
              <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: '#8BAF98', marginTop: 2 }}>{grade}</p>
              <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, color: '#8BAF98' }}>{village}</p>
            </div>
          </div>
          <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.1)', display: 'flex', gap: 8 }}>
            <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, fontWeight: 600, color: '#8BAF98', background: 'rgba(255,255,255,0.1)', padding: '4px 10px', borderRadius: 9999 }}>
              Knowledge Mesh Active ✓
            </span>
          </div>
        </div>

        {/* Streak card */}
        <div className="card" style={{ textAlign: 'center', position: 'relative' }}>
          <div style={{ position: 'absolute', top: 16, right: 16, fontSize: 28, animation: 'flame-pulse 3s ease-in-out infinite' }}>🔥</div>
          <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 56, fontWeight: 800, color: '#1A1A1A', lineHeight: 1, letterSpacing: '-0.02em', marginBottom: 8 }}>
            {streak}
          </p>
          <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: '#6B7280' }}>
            {streak === 1 ? 'Day streak' : 'Days in a row!'}
          </p>
          <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, color: '#E8A838', marginTop: 8, fontWeight: 500 }}>
            You've studied {streak} days in a row 🎉
          </p>
        </div>

        {/* Overall progress */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <ProgressRing pct={overallPct} size={80} stroke={8} />
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 16, fontWeight: 700, color: '#1A1A1A' }}>Overall Progress</p>
            <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: '#6B7280' }}>Across {lessons.length} subjects</p>
          </div>
        </div>
      </div>

      {/* ── Row 2: Subject progress (2/3) + Leaderboard (1/3) ───────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20, marginBottom: 24 }}>

        {/* Subject progress */}
        <div className="card">
          <h2 style={{ fontFamily: 'Inter, sans-serif', fontSize: 16, fontWeight: 700, color: '#1A1A1A', letterSpacing: '-0.01em', marginBottom: 20 }}>
            Subject Progress
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {subjectProgress.map(({ lesson, pct }) => (
              <SubjectProgressRow key={lesson.id} lesson={lesson} pct={pct} />
            ))}
          </div>
        </div>

        {/* Village leaderboard */}
        <VillageLeaderboard />
      </div>

      {/* ── Row 3: Achievement badges ─────────────────────────────────────────── */}
      <div className="card" style={{ marginBottom: 24, padding: '20px 24px' }}>
        <h2 style={{ fontFamily: 'Inter, sans-serif', fontSize: 16, fontWeight: 700, color: '#1A1A1A', letterSpacing: '-0.01em', marginBottom: 16 }}>
          Achievements
        </h2>
        <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 4 }}>
          {ACHIEVEMENTS.map((a, i) => (
            <div
              key={i}
              style={{
                minWidth: 140, flexShrink: 0,
                background: a.earned ? '#FFFFFF' : '#F9F9F9',
                border: `1px solid ${a.earned ? '#E5E0D8' : '#F0EDE8'}`,
                borderRadius: 12, padding: 16,
                opacity: a.earned ? 1 : 0.5,
                animation: a.earned ? 'achievement-unlock 400ms ease both' : 'none',
              }}
            >
              <div style={{ width: 48, height: 48, borderRadius: '50%', background: a.earned ? a.bg : '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, marginBottom: 10 }}>
                {a.icon}
              </div>
              <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, fontWeight: 600, color: '#1A1A1A', marginBottom: 2 }}>{a.title}</p>
              <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 11, color: '#6B7280' }}>{a.desc}</p>
              {!a.earned && <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 11, color: '#E8A838', marginTop: 4 }}>Locked</p>}
            </div>
          ))}
        </div>
      </div>

      {/* ── Row 4: Quiz history ───────────────────────────────────────────────── */}
      <div className="card" style={{ marginBottom: 24 }}>
        <h2 style={{ fontFamily: 'Inter, sans-serif', fontSize: 16, fontWeight: 700, color: '#1A1A1A', letterSpacing: '-0.01em', marginBottom: 16 }}>
          Quiz History
        </h2>
        {quizResults.length === 0 ? (
          <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 14, color: '#6B7280', textAlign: 'center', padding: '24px 0' }}>
            No quizzes completed yet. Start a lesson to take your first quiz!
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {quizResults.map((r, i) => {
              const pct = Math.round((r.score / r.total) * 100);
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: i < quizResults.length - 1 ? '1px solid #E5E0D8' : 'none' }}>
                  <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, fontWeight: 600, color: '#FFFFFF', background: '#1B3A2D', padding: '4px 10px', borderRadius: 9999, flexShrink: 0 }}>
                    {r.subject}
                  </span>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: '#1A1A1A' }}>{r.score}/{r.total} correct</p>
                    <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 11, color: '#6B7280' }}>{r.date}</p>
                  </div>
                  <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, fontWeight: 700, color: pct >= 70 ? '#2D7A4F' : '#E8A838', background: pct >= 70 ? '#E6F4ED' : '#FDF3DC', padding: '4px 10px', borderRadius: 9999 }}>
                    {pct}%
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Row 5: Parent settings ────────────────────────────────────────────── */}
      <div className="card">
        <h2 style={{ fontFamily: 'Inter, sans-serif', fontSize: 16, fontWeight: 700, color: '#1A1A1A', letterSpacing: '-0.01em', marginBottom: 4 }}>
          Parent Settings
        </h2>
        <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: '#6B7280', marginBottom: 20 }}>
          Parent receives study hours, quiz scores, and rank every Sunday.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, fontWeight: 500, color: '#6B7280', display: 'block', marginBottom: 6 }}>
              Parent's phone number
            </label>
            <input
              className="input-field"
              placeholder="e.g. 011-2345 6789"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              type="tel"
              style={{ maxWidth: 320 }}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              onClick={() => setSms(v => !v)}
              style={{
                width: 44, height: 24, borderRadius: 9999,
                background: sms ? '#2D7A4F' : '#E5E0D8',
                border: 'none', cursor: 'pointer',
                position: 'relative', transition: 'background 200ms ease',
              }}
            >
              <span style={{
                position: 'absolute', top: 3, left: sms ? 22 : 3,
                width: 18, height: 18, borderRadius: '50%', background: '#FFFFFF',
                transition: 'left 200ms ease',
              }} />
            </button>
            <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 14, color: '#1A1A1A' }}>
              Enable weekly SMS report
            </span>
          </div>
          <button
            className="btn-primary"
            style={{ alignSelf: 'flex-start' }}
            onClick={handleSave}
          >
            {saved ? '✓ Saved!' : 'Save Settings'}
          </button>
        </div>
      </div>

    </div>
  );
}

// ── ProfileScreen Root ────────────────────────────────────────────────────────
export default function ProfileScreen() {
  const { userRole } = useAppStore();
  
  if (userRole === 'teacher') {
    return <TeacherProfile />;
  }
  
  return <StudentProfile />;
}
