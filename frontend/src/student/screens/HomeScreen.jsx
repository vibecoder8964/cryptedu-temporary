// CryptEdu — screens/HomeScreen.jsx
// Knowledge Feed — Bento grid layout (Layout A)
// Ref: design_guidelines.md §7 Home Screen Bento, §6 Lesson Cards

import { useNavigate } from 'react-router-dom';
import useAppStore from '../store/appStore';
import { lessons, leaderboard } from '../data/mockData';
import HubBanner from '../components/HubBanner';
import LessonCard from '../components/LessonCard';
import StatCard from '../components/StatCard';
import VillageLeaderboard from '../components/VillageLeaderboard';

// ── Greeting helper ───────────────────────────────────────────────────────────
function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}


// ── HomeScreen ────────────────────────────────────────────────────────────────
export default function HomeScreen() {
  const { user, streak, progress } = useAppStore();
  const navigate = useNavigate();

  const name  = user?.name?.split(' ')[0] ?? 'Student';
  const today  = new Date().toLocaleDateString('en-MY', { weekday: 'long', day: 'numeric', month: 'long' });
  const lessonsStarted = lessons.filter(l => (progress?.[l.id] ?? l.progress ?? 0) > 0).length;

  return (
    <div className="screen">
      {/* Hub banner */}
      <HubBanner />

      {/* ── Row 1: Welcome banner (2/3) + Hub stat card (1/3) ─────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 24, marginBottom: 24 }}>

        {/* Welcome card */}
        <div
          className="card"
          style={{
            background: '#1B3A2D',
            border: 'none',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Subtle hex mesh */}
          <div style={{
            position: 'absolute', inset: 0,
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='60' height='52' viewBox='0 0 60 52'%3E%3Cpolygon points='30,2 58,17 58,47 30,62 2,47 2,17' fill='none' stroke='%23FFFFFF' stroke-width='1'/%3E%3C/svg%3E")`,
            opacity: 0.04,
            pointerEvents: 'none',
          }} />
          <div style={{ position: 'relative' }}>
            <p style={{
              fontFamily: 'Inter, sans-serif', fontSize: 13, fontWeight: 500,
              color: '#8BAF98', marginBottom: 4,
            }}>
              {today}
            </p>
            <h1 style={{
              fontFamily: 'Inter, sans-serif', fontSize: 28, fontWeight: 800,
              color: '#FFFFFF', letterSpacing: '-0.02em', marginBottom: 8,
            }}>
              {greeting()}, {name}! 👋
            </h1>
            <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 15, color: '#8BAF98', marginBottom: 24 }}>
              <strong style={{ color: '#E8A838' }}>{lessonsStarted}</strong> of {lessons.length} lessons in progress.
              Keep up the great work!
            </p>
            <button
              className="btn-primary btn-primary--sm"
              onClick={() => navigate('/lessons')}
            >
              Browse All Lessons →
            </button>
          </div>
        </div>

        {/* Quick stats column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <StatCard value={streak} label="Day streak 🔥" icon="🔥" iconBg="#FDF3DC" />
          <StatCard value={leaderboard[0]?.score ?? 98} label="Top score this week" icon="🏆" iconBg="#E6F4ED" />
        </div>
      </div>

      {/* ── Row 2: Lesson list (2/3) + Leaderboard preview (1/3) ──────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 24, marginBottom: 24 }}>

        {/* Today's lessons */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '20px 24px 16px',
            borderBottom: '1px solid #E5E0D8',
          }}>
            <h2 style={{
              fontFamily: 'Inter, sans-serif', fontSize: 16, fontWeight: 700,
              color: '#1A1A1A', letterSpacing: '-0.01em',
            }}>
              Your Lessons
            </h2>
            <button className="btn-ghost" onClick={() => navigate('/lessons')}>
              View all →
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {lessons.map((lesson, i) => (
              <div
                key={lesson.id}
                style={{ borderBottom: i < lessons.length - 1 ? '1px solid #E5E0D8' : 'none' }}
              >
                <LessonCard lesson={lesson} />
              </div>
            ))}
          </div>
        </div>

        {/* Village leaderboard */}
        <VillageLeaderboard />
      </div>

      {/* ── Row 3: Community CTA + Quick Actions ───────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>

        {/* Community quick-link */}
        <div
          className="card"
          style={{ background: '#1B3A2D', border: 'none', cursor: 'pointer' }}
          onClick={() => navigate('/community')}
        >
          <div style={{ fontSize: 32, marginBottom: 12 }}>💬</div>
          <h2 style={{ fontFamily: 'Inter, sans-serif', fontSize: 18, fontWeight: 700, color: '#FFFFFF', letterSpacing: '-0.01em', marginBottom: 6 }}>
            Community Q&amp;A
          </h2>
          <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 14, color: '#8BAF98', marginBottom: 20 }}>
            Ask questions, share answers, and learn from your classmates on the Knowledge Mesh.
          </p>
          <button className="btn-primary btn-primary--sm" onClick={() => navigate('/community')}>
            Go to Community →
          </button>
        </div>

        {/* Local AI Tutor quick-link */}
        <div
          className="card"
          style={{ cursor: 'pointer' }}
          onClick={() => navigate('/tutor')}
        >
          <div style={{ fontSize: 32, marginBottom: 12 }}>🤖</div>
          <h2 style={{ fontFamily: 'Inter, sans-serif', fontSize: 18, fontWeight: 700, color: '#1A1A1A', letterSpacing: '-0.01em', marginBottom: 6 }}>
            Local AI Tutor
          </h2>
          <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 14, color: '#6B7280', marginBottom: 20 }}>
            Ask questions, clarify doubts, or submit your essays for instant marking using the KPM rubric.
          </p>
          <button className="btn-primary btn-primary--sm" onClick={() => navigate('/tutor')}>
            Ask the Tutor →
          </button>
        </div>

      </div>
    </div>
  );
}
