import React from 'react';
import useAppStore from '../store/appStore';
import { leaderboard } from '../data/mockData';

export default function VillageLeaderboard() {
  const { user } = useAppStore();
  const myFullName = user?.name;
  
  // Calculate max score for progress bars relative to #1 spot
  const maxScore = Math.max(...leaderboard.map(e => e.score), 1);

  return (
    <div style={{
      background: 'linear-gradient(135deg, #F8FAFC 0%, #E2E8F0 100%)',
      borderRadius: 24,
      padding: '28px 24px',
      boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.7), 0 4px 20px rgba(0,0,0,0.04)',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Soft background mesh gradient blobs */}
      <div style={{
        position: 'absolute', top: -100, left: -100, width: 300, height: 300,
        background: 'radial-gradient(circle, rgba(219,234,254,0.6) 0%, transparent 70%)',
        pointerEvents: 'none'
      }} />
      <div style={{
        position: 'absolute', bottom: -100, right: -100, width: 300, height: 300,
        background: 'radial-gradient(circle, rgba(226,232,240,0.8) 0%, transparent 70%)',
        pointerEvents: 'none'
      }} />

      <div style={{ position: 'relative', zIndex: 1 }}>
        <h2 style={{ fontFamily: 'Inter, sans-serif', fontSize: 18, fontWeight: 700, color: '#0F172A', letterSpacing: '-0.01em', marginBottom: 4 }}>
          Village Rankings
        </h2>
        <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: '#64748B', marginBottom: 24 }}>
          SK Kg. Baru Node · Updates weekly
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {leaderboard.map(entry => {
            const isMe = entry.name === myFullName;
            const isFirst = entry.rank === 1;
            const isSecond = entry.rank === 2;
            const isThird = entry.rank === 3;
            
            let bg = 'rgba(255, 255, 255, 0.7)';
            let border = '1px solid rgba(255, 255, 255, 0.9)';
            let accent = '#94A3B8'; // Slate-400
            
            if (isFirst) {
              bg = 'linear-gradient(145deg, rgba(253,246,227,0.95) 0%, rgba(255,255,255,0.85) 100%)';
              border = '1px solid rgba(232,168,56,0.3)';
              accent = '#E8A838'; // Gold
            } else if (isSecond) {
              bg = 'linear-gradient(145deg, rgba(248,250,252,0.95) 0%, rgba(255,255,255,0.85) 100%)';
              border = '1px solid rgba(148,163,184,0.3)';
              accent = '#94A3B8'; // Silver/Slate
            } else if (isThird) {
              bg = 'linear-gradient(145deg, rgba(255,247,242,0.95) 0%, rgba(255,255,255,0.85) 100%)';
              border = '1px solid rgba(217,119,6,0.2)';
              accent = '#D97706'; // Bronze
            }

            const pct = (entry.score / maxScore) * 100;

            return (
              <div key={entry.rank} style={{
                background: bg,
                backdropFilter: 'blur(12px)',
                borderRadius: 16,
                padding: isFirst ? '18px 20px' : '16px',
                border: border,
                boxShadow: isFirst ? '0 8px 24px rgba(232,168,56,0.12)' : '0 2px 10px rgba(0,0,0,0.02)',
                display: 'flex',
                flexDirection: 'column',
                gap: 14,
                transform: isFirst ? 'scale(1.02)' : 'none',
                transformOrigin: 'left center',
                transition: 'transform 200ms ease'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  {/* Geometric Badge */}
                  <div style={{
                    width: isFirst ? 32 : 26,
                    height: isFirst ? 32 : 26,
                    borderRadius: isFirst ? 10 : 8,
                    transform: 'rotate(45deg)',
                    background: isFirst || isSecond || isThird ? accent : '#F1F5F9',
                    color: isFirst || isSecond || isThird ? '#FFF' : '#64748B',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: (isFirst || isSecond || isThird) ? `0 4px 12px ${accent}40` : 'inset 0 0 0 1px rgba(0,0,0,0.05)',
                    marginLeft: 4, marginRight: 4,
                    flexShrink: 0
                  }}>
                    <span style={{ transform: 'rotate(-45deg)', fontSize: isFirst ? 14 : 12, fontWeight: 800, fontFamily: 'Inter, sans-serif' }}>
                      {entry.rank}
                    </span>
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ 
                      fontFamily: 'Inter, sans-serif', 
                      fontSize: isFirst ? 16 : 14, 
                      fontWeight: 600,
                      color: isMe ? '#1B3A2D' : '#0F172A', 
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      lineHeight: 1.2
                    }}>
                      {entry.name} {isMe && <span style={{ fontSize: 12, color: '#E8A838' }}>(You)</span>}
                    </p>
                    <p style={{ 
                      fontFamily: 'Inter, sans-serif', 
                      fontSize: 12, 
                      color: '#64748B',
                      marginTop: 4,
                      fontWeight: 400
                    }}>
                      {entry.streak} day streak
                    </p>
                  </div>
                  
                  <span style={{ 
                    fontFamily: 'Inter, sans-serif', 
                    fontSize: isFirst ? 20 : 16, 
                    fontWeight: 700,
                    color: '#E8A838',
                    flexShrink: 0 
                  }}>
                    {entry.score}
                  </span>
                </div>

                {/* Progress bar */}
                <div style={{ width: '100%', height: 4, background: 'rgba(0,0,0,0.04)', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ 
                    width: `${pct}%`, 
                    height: '100%', 
                    background: accent,
                    borderRadius: 2,
                    transition: 'width 1s cubic-bezier(0.16, 1, 0.3, 1)'
                  }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
