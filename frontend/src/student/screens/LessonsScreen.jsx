// CryptEdu — screens/LessonsScreen.jsx
// Subject browser grid with grade filter chips
// Ref: developer_skill.md §6 Screen 3

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { lessons, subjects } from '../data/mockData';
import HubBanner from '../components/HubBanner';
import useAppStore from '../store/appStore';

const FILTERS = ['All', 'Primary', 'Secondary'];

const PRIMARY_GRADES  = ['Year 1','Year 2','Year 3','Year 4','Year 5','Year 6'];
const SECONDARY_GRADES = ['Tingkatan 1','Tingkatan 2','Tingkatan 3','Tingkatan 4','Tingkatan 5'];

const SUBJECT_STYLE = {
  Mathematics:      { bg: '#FDF3DC', color: '#E8A838', emoji: '📐' },
  Science:          { bg: '#E6F4ED', color: '#2D7A4F', emoji: '🔬' },
  'Bahasa Malaysia':{ bg: '#EEF2FF', color: '#4F46E5', emoji: '📖' },
  History:          { bg: '#FEF2F2', color: '#DC2626', emoji: '🏛️' },
  English:          { bg: '#F0FDF4', color: '#16A34A', emoji: '✍️' },
};

export default function LessonsScreen() {
  const navigate   = useNavigate();
  const [filter, setFilter] = useState('All');
  const progressMap = useAppStore(state => state.progress);

  const filtered = lessons.filter(l => {
    if (filter === 'All') return true;
    if (filter === 'Primary') return PRIMARY_GRADES.includes(l.grade);
    return SECONDARY_GRADES.includes(l.grade);
  });

  return (
    <div className="screen">
      <HubBanner />

      {/* Filter chips */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
        {FILTERS.map(f => (
          <button
            key={f}
            className={`chip${filter === f ? ' chip--active' : ''}`}
            onClick={() => setFilter(f)}
          >
            {f}
          </button>
        ))}
        <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: '#6B7280', padding: '8px 4px' }}>
          {filtered.length} lesson{filtered.length !== 1 ? 's' : ''} ready
        </span>
      </div>

      {/* Subject cards grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 20 }}>
        {filtered.map(lesson => {
          const style  = SUBJECT_STYLE[lesson.subject] ?? { bg: '#F3F4F6', color: '#6B7280', emoji: '📚' };
          const pct    = progressMap[lesson.id] || lesson.progress || 0;
          return (
            <div
              key={lesson.id}
              className="card"
              style={{ cursor: 'pointer' }}
              onClick={() => navigate(`/lesson/${lesson.id}`)}
            >
              {/* Subject icon + badge */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
                <div style={{ width: 48, height: 48, borderRadius: 12, background: style.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>
                  {style.emoji}
                </div>
                <span className="badge--ready">Ready ✓</span>
              </div>

              {/* Title */}
              <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 16, fontWeight: 600, color: '#1A1A1A', marginBottom: 4 }}>
                {lesson.subject}
              </p>
              <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: '#6B7280', marginBottom: 4 }}>
                {lesson.chapter}
              </p>
              <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, color: '#6B7280', marginBottom: 16 }}>
                {lesson.grade} · {lesson.duration}
              </p>

              {/* Progress */}
              <div style={{ marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, color: '#6B7280' }}>Progress</span>
                  <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, fontWeight: 600, color: '#E8A838' }}>{pct}%</span>
                </div>
                <div className="progress-track">
                  <div
                    className="progress-fill"
                    style={{ width: `${pct}%`, transition: 'width 600ms ease' }}
                  />
                </div>
              </div>

              <button
                className="btn-primary btn-primary--full btn-primary--sm"
                style={{ marginTop: 8 }}
                onClick={e => { e.stopPropagation(); navigate(`/lesson/${lesson.id}`); }}
              >
                {pct > 0 ? 'Continue' : 'Start Lesson'}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
