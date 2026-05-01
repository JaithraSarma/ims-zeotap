import { useState } from 'react';

const SEVERITY_CONFIG = {
  P0: { label: 'P0 — Critical', color: '#ff4444', bg: 'rgba(255,68,68,0.15)' },
  P1: { label: 'P1 — High', color: '#ff9800', bg: 'rgba(255,152,0,0.15)' },
  P2: { label: 'P2 — Medium', color: '#2196f3', bg: 'rgba(33,150,243,0.15)' },
};

const STATUS_CONFIG = {
  OPEN: { color: '#ff4444', icon: '🔴' },
  INVESTIGATING: { color: '#ff9800', icon: '🔍' },
  RESOLVED: { color: '#4caf50', icon: '✅' },
  CLOSED: { color: '#9e9e9e', icon: '🔒' },
};

export default function IncidentCard({ incident, onClick }) {
  const [hovered, setHovered] = useState(false);
  const sev = SEVERITY_CONFIG[incident.severity] || SEVERITY_CONFIG.P1;
  const stat = STATUS_CONFIG[incident.status] || STATUS_CONFIG.OPEN;
  const timeAgo = getTimeAgo(incident.created_at);

  return (
    <div
      className="incident-card"
      onClick={() => onClick(incident.id)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        borderLeft: `4px solid ${sev.color}`,
        transform: hovered ? 'translateY(-2px)' : 'none',
        boxShadow: hovered
          ? `0 8px 25px rgba(0,0,0,0.3), 0 0 15px ${sev.color}30`
          : '0 2px 8px rgba(0,0,0,0.2)',
      }}
    >
      <div className="incident-card-header">
        <span className="severity-badge" style={{ background: sev.bg, color: sev.color }}>
          {incident.severity}
        </span>
        <span className="status-indicator">
          {stat.icon} {incident.status}
        </span>
      </div>

      <div className="incident-card-body">
        <h3 className="component-id">{incident.component_id}</h3>
        <span className="component-type">{incident.component_type}</span>
      </div>

      <div className="incident-card-footer">
        <span className="signal-count">{incident.signal_count} signals</span>
        <span className="time-ago">{timeAgo}</span>
      </div>
    </div>
  );
}

function getTimeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}
