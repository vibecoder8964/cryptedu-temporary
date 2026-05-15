// CryptEdu — screens/LessonPlayerScreen.jsx
// Video player + scrollable lesson notes + quiz trigger
// Ref: developer_skill.md §6 Screen 4

import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { lessons } from '../data/mockData';
import useAppStore from '../store/appStore';

const SUBJECT_STYLE = {
  Science:          { bg: '#E6F4ED', color: '#2D7A4F', emoji: '🔬' },
  Mathematics:      { bg: '#FDF3DC', color: '#E8A838', emoji: '📐' },
  'Bahasa Malaysia':{ bg: '#EEF2FF', color: '#4F46E5', emoji: '📖' },
  History:          { bg: '#FEF2F2', color: '#DC2626', emoji: '🏛️' },
  English:          { bg: '#F0FDF4', color: '#16A34A', emoji: '✍️' },
};

const VIDEO_MAP = {
  Science: '/science_demo.mp4',
  Mathematics: '/mathematic_demo.mp4',
  'Bahasa Malaysia': '/bahasa_demo.mp4',
  History: '/sejarah_demo.mp4',
  English: '/english_demo.mp4',
};

export default function LessonPlayerScreen() {
  const { id }      = useParams();
  const navigate    = useNavigate();
  const { setCurrentLesson, setProgress, getProgress } = useAppStore();

  const lesson      = lessons.find(l => l.id === id);
  const fillRef     = useRef(null);
  const videoRef    = useRef(null);
  const progressMap = useAppStore(state => state.progress);
  
  const watched     = progressMap[id] || lesson?.progress || 0;
  const [isPlaying, setIsPlaying] = useState(false);
  const style       = SUBJECT_STYLE[lesson?.subject] ?? { bg: '#F3F4F6', color: '#6B7280', emoji: '📚' };

  // Reset playing state when lesson changes
  useEffect(() => {
    setIsPlaying(false);
  }, [id]);

  useEffect(() => {
    if (lesson) setCurrentLesson(lesson);
  }, [lesson]);

  // Animate progress bar
  useEffect(() => {
    if (!fillRef.current) return;
    requestAnimationFrame(() => { fillRef.current.style.width = `${watched}%`; });
  }, [watched]);

  // Auto-save progress every 10s
  useEffect(() => {
    if (!lesson) return;
    const iv = setInterval(() => {
      const next = Math.min(100, watched + 2);
      setProgress(lesson.id, next);
    }, 10000);
    return () => clearInterval(iv);
  }, [lesson, watched, setProgress]);

  if (!lesson) return (
    <div className="screen" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
      <p style={{ fontFamily: 'Inter, sans-serif', color: '#6B7280' }}>Lesson not found.</p>
    </div>
  );

  return (
    <div className="screen">
      <div style={{ maxWidth: 900, margin: '0 auto' }}>

        {/* Breadcrumb */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
          <button className="btn-ghost" onClick={() => navigate('/lessons')}>← Lessons</button>
          <span style={{ color: '#E5E0D8' }}>/</span>
          <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: '#6B7280' }}>{lesson.subject}</span>
        </div>

        {/* Title row */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, marginBottom: 24 }}>
          <div style={{ width: 48, height: 48, borderRadius: '50%', background: style.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>
            {style.emoji}
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: '#6B7280', marginBottom: 4 }}>
              {lesson.subject} · {lesson.grade}
            </p>
            <h1 style={{ fontFamily: 'Inter, sans-serif', fontSize: 24, fontWeight: 800, color: '#1A1A1A', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
              {lesson.chapter}
            </h1>
          </div>
          <span className="badge--ready">Ready Without Data ✓</span>
        </div>

        {/* Progress */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: '#6B7280' }}>Your Progress</span>
            <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, fontWeight: 600, color: '#E8A838' }}>{watched}%</span>
          </div>
          <div className="progress-track">
            <div ref={fillRef} className="progress-fill" style={{ width: '0%' }} />
          </div>
        </div>

        {/* Video player */}
        {VIDEO_MAP[lesson.subject] ? (
          <div style={{ marginBottom: 8, borderRadius: 16, overflow: 'hidden', background: '#1B3A2D', position: 'relative', boxShadow: '0 4px 16px rgba(0,0,0,0.1)' }}>
            <video 
              ref={videoRef}
              src={VIDEO_MAP[lesson.subject]} 
              controls={isPlaying}
              style={{ width: '100%', aspectRatio: '16/9', display: 'block', objectFit: 'cover' }}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
            />
            
            {/* Custom Overlay */}
            {!isPlaying && (
              <div 
                style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', background: 'rgba(27, 58, 45, 0.5)', gap: 12, transition: 'background 200ms ease' }}
                onClick={() => {
                  if (videoRef.current) {
                    videoRef.current.play();
                    setIsPlaying(true);
                  }
                }}
              >
                <div style={{ position: 'absolute', inset: 0, backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='60' height='52' viewBox='0 0 60 52'%3E%3Cpolygon points='30,2 58,17 58,47 30,62 2,47 2,17' fill='none' stroke='%23FFFFFF' stroke-width='1'/%3E%3C/svg%3E")`, opacity: 0.04 }} />
                
                <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'rgba(232,168,56,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'transform 200ms ease', fontSize: 28, paddingLeft: 6, color: '#1A1A1A', boxShadow: '0 4px 12px rgba(232,168,56,0.4)', zIndex: 2 }}>▶</div>
                <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 16, fontWeight: 700, color: '#FFFFFF', zIndex: 2 }}>Play demo video</p>
                
                <span style={{ position: 'absolute', top: 16, right: 16, fontFamily: 'Inter, sans-serif', fontSize: 12, fontWeight: 600, color: '#FFFFFF', background: 'rgba(27,58,45,0.8)', padding: '6px 12px', borderRadius: 9999, border: '1px solid rgba(255,255,255,0.1)', backdropFilter: 'blur(4px)', zIndex: 2 }}>
                  {lesson.duration}
                </span>
              </div>
            )}
          </div>
        ) : (
          <div style={{
            width: '100%', aspectRatio: '16/9', background: '#1B3A2D',
            borderRadius: 16, marginBottom: 8,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            gap: 12, position: 'relative', overflow: 'hidden',
          }}>
            {/* Hex pattern */}
            <div style={{ position: 'absolute', inset: 0, backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='60' height='52' viewBox='0 0 60 52'%3E%3Cpolygon points='30,2 58,17 58,47 30,62 2,47 2,17' fill='none' stroke='%23FFFFFF' stroke-width='1'/%3E%3C/svg%3E")`, opacity: 0.04 }} />
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(232,168,56,0.2)', border: '2px solid #E8A838', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 200ms ease', fontSize: 24 }}>▶</div>
            <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 14, color: '#8BAF98' }}>Local Content — No data used</p>
            <span style={{ position: 'absolute', top: 16, right: 16, fontFamily: 'Inter, sans-serif', fontSize: 11, fontWeight: 600, color: '#2D7A4F', background: 'rgba(45,122,79,0.2)', padding: '4px 10px', borderRadius: 9999 }}>
              {lesson.duration}
            </span>
          </div>
        )}
        <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, color: '#6B7280', textAlign: 'center', marginBottom: 32 }}>
          Local Content — No data used · Preparing Lesson from Knowledge Mesh
        </p>

        {/* Lesson notes */}
        <div className="card" style={{ marginBottom: 32 }}>
          <h2 style={{ fontFamily: 'Inter, sans-serif', fontSize: 18, fontWeight: 700, color: '#1A1A1A', letterSpacing: '-0.01em', marginBottom: 16 }}>
            📝 Lesson Notes
          </h2>
          <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 15, color: '#1A1A1A', lineHeight: 1.8, whiteSpace: 'pre-line' }}>
            {lesson.notes}
          </div>
        </div>

        {/* Action */}
        <div style={{ display: 'flex', gap: 12 }}>
          <button className="btn-primary" style={{ flex: 1 }} onClick={() => navigate('/tutor')}>
            💬 Ask Local AI Tutor
          </button>
        </div>

      </div>
    </div>
  );
}
