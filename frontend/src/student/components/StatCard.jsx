// CryptEdu — components/StatCard.jsx
// Bento grid stat card (streak, score, rank, etc.)
// Ref: design_guidelines.md §6 Stat Cards (Bento)

export default function StatCard({ value, label, icon, iconBg = '#FDF3DC', suffix = '' }) {
  return (
    <div className="card" style={{ position: 'relative' }}>
      {/* Accent icon — top right */}
      {icon && (
        <div style={{
          position: 'absolute', top: 20, right: 20,
          width: 40, height: 40, borderRadius: '50%',
          background: iconBg,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 18,
        }}>
          {icon}
        </div>
      )}

      {/* Large number */}
      <p style={{
        fontFamily: 'Inter, sans-serif',
        fontSize: 48, fontWeight: 800,
        color: '#1A1A1A', lineHeight: 1,
        letterSpacing: '-0.02em',
        marginBottom: 8,
      }}>
        {value}{suffix}
      </p>

      {/* Label */}
      <p style={{
        fontFamily: 'Inter, sans-serif',
        fontSize: 13, fontWeight: 500,
        color: '#6B7280',
      }}>
        {label}
      </p>
    </div>
  );
}
