// CryptEdu — components/LessonCard.jsx
// Horizontal lesson card with subject icon, progress bar, badge, Start button
// Ref: design_guidelines.md §6 Lesson Cards, Subject Icon Colours

import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import useAppStore from '../store/appStore';

// Subject icon config — design_guidelines.md §6 Subject Icon Colours
const SUBJECT_STYLE = {
  Science:         { bg: '#E6F4ED', color: '#2D7A4F', emoji: '🔬' },
  Mathematics:     { bg: '#FDF3DC', color: '#E8A838', emoji: '📐' },
  'Bahasa Malaysia':{ bg: '#EEF2FF', color: '#4F46E5', emoji: '📖' },
  History:         { bg: '#FEF2F2', color: '#DC2626', emoji: '🏛️' },
  English:         { bg: '#F0FDF4', color: '#16A34A', emoji: '✍️' },
};

const DEFAULT_STYLE = { bg: '#F3F4F6', color: '#6B7280', emoji: '📚' };

export default function LessonCard({ lesson, showSubject = true }) {
  const navigate   = useNavigate();
  const { setCurrentLesson, getProgress } = useAppStore();
  const fillRef    = useRef(null);

  const style    = SUBJECT_STYLE[lesson.subject] ?? DEFAULT_STYLE;
  // Use stored progress if available, fall back to lesson default
  const progress = getProgress(lesson.id) || lesson.progress || 0;

  // Animate progress bar on mount (design_guidelines.md §8)
  useEffect(() => {
    if (!fillRef.current) return;
    const raf = requestAnimationFrame(() => {
      fillRef.current.style.width = `${progress}%`;
    });
    return () => cancelAnimationFrame(raf);
  }, [progress]);

  const handleStart = () => {
    setCurrentLesson(lesson);
    navigate(`/lesson/${lesson.id}`);
  };

  return (
    <div
      className="card"
      style={{
        display: 'flex', alignItems: 'center', gap: 16,
        padding: '16px 20px', cursor: 'default',
      }}
    >
      {/* Subject icon circle */}
      <div style={{
        width: 44, height: 44, borderRadius: '50%',
        background: style.bg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 20, flexShrink: 0,
      }}>
        {style.emoji}
      </div>

      {/* Center content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          fontFamily: 'Inter, sans-serif', fontSize: 15, fontWeight: 600,
          color: '#1A1A1A', marginBottom: 2,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {showSubject ? lesson.subject : lesson.chapter}
        </p>
        <p style={{
          fontFamily: 'Inter, sans-serif', fontSize: 13, color: '#6B7280',
          marginBottom: 8,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {showSubject ? lesson.chapter : lesson.grade}
        </p>

        {/* Progress bar */}
        <div className="progress-track" style={{ marginBottom: 8 }}>
          <div
            ref={fillRef}
            className="progress-fill"
            style={{ width: '0%' }} // starts at 0, animated via useEffect
          />
        </div>

        {/* Badge + meta */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {lesson.isReady && (
            <span className="badge--ready">Ready Without Data ✓</span>
          )}
          <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, color: '#6B7280' }}>
            {progress}% complete
          </span>
          {lesson.duration && (
            <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, color: '#6B7280' }}>
              · {lesson.duration}
            </span>
          )}
        </div>
      </div>

      {/* Start button */}
      <button
        className="btn-primary btn-primary--sm"
        onClick={handleStart}
        style={{ flexShrink: 0 }}
      >
        {progress > 0 ? 'Continue' : 'Start'}
      </button>
    </div>
  );
}
