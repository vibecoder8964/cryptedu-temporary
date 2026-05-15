// CryptEdu — components/HubBanner.jsx
// Hub connection status banner — used inside Home, Lessons, Tutor screens
// Ref: design_guidelines.md §5 Hub Status Banner, §9 Language Rules

import useAppStore from '../store/appStore';

export default function HubBanner() {
  const { hubStatus, hubName, lastSync } = useAppStore();

  if (hubStatus === 'checking') {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '12px 20px', borderRadius: 12, marginBottom: 24,
        background: 'rgba(232,168,56,0.08)', border: '1px solid #E5E0D8',
      }}>
        <span style={{ fontSize: 12, color: '#6B7280', fontFamily: 'Inter, sans-serif' }}>
          Checking node connection…
        </span>
      </div>
    );
  }

  if (hubStatus === 'connected') {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 20px', borderRadius: 12, marginBottom: 24,
        background: 'rgba(45,122,79,0.12)', borderLeft: '3px solid #2D7A4F',
      }}>
        {/* Left: status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="status-dot status-dot--green" />
          <div>
            <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, fontWeight: 600, color: '#2D7A4F' }}>
              Knowledge Mesh Active
            </p>
            <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, color: '#6B7280', marginTop: 1 }}>
              {hubName}
            </p>
          </div>
        </div>
        {/* Right: last sync */}
        <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, color: '#6B7280' }}>
          Content Up to Date · {lastSync}
        </p>
      </div>
    );
  }

  // Disconnected (Hidden as per request)
  return null;
}
