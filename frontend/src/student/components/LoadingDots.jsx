// CryptEdu — components/LoadingDots.jsx
// 3-dot AI typing indicator
// Ref: design_guidelines.md §8 Animation Rules

export default function LoadingDots({ label = 'Local AI Tutor is thinking…' }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start' }}>
      {label && (
        <p style={{
          fontFamily: 'Inter, sans-serif', fontSize: 12, fontWeight: 600,
          color: '#E8A838', marginBottom: 2,
        }}>
          {label}
        </p>
      )}
      <div className="typing-indicator">
        <div className="typing-indicator__dot" />
        <div className="typing-indicator__dot" />
        <div className="typing-indicator__dot" />
      </div>
    </div>
  );
}
