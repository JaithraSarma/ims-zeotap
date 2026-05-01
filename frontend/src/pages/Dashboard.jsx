import { useState, useEffect } from 'react';
import IncidentCard from '../components/IncidentCard';
import SignalSimulator from '../components/SignalSimulator';
import { getWorkItems, getDashboardStats } from '../services/api';
import socket from '../services/socket';

export default function Dashboard({ onSelectIncident }) {
  const [workItems, setWorkItems] = useState([]);
  const [stats, setStats] = useState(null);
  const [filter, setFilter] = useState({ status: '', severity: '' });
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const params = {};
      if (filter.status) params.status = filter.status;
      if (filter.severity) params.severity = filter.severity;

      const [items, dashStats] = await Promise.all([
        getWorkItems(params),
        getDashboardStats(),
      ]);
      setWorkItems(items);
      setStats(dashStats);
    } catch (err) {
      console.error('Failed to fetch dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    // Live updates via Socket.IO
    socket.on('workItem:created', () => fetchData());
    socket.on('workItem:updated', () => fetchData());
    socket.on('dashboard:update', (data) => setStats(data));

    return () => {
      socket.off('workItem:created');
      socket.off('workItem:updated');
      socket.off('dashboard:update');
    };
  }, [filter.status, filter.severity]);

  const statCards = stats ? [
    { label: 'Open', value: stats.open_count || 0, color: '#ff4444', icon: '🔴' },
    { label: 'Investigating', value: stats.investigating_count || 0, color: '#ff9800', icon: '🔍' },
    { label: 'Resolved', value: stats.resolved_count || 0, color: '#4caf50', icon: '✅' },
    { label: 'Closed', value: stats.closed_count || 0, color: '#9e9e9e', icon: '🔒' },
  ] : [];

  const severityCards = stats ? [
    { label: 'P0 Critical', value: stats.p0_count || 0, color: '#ff4444' },
    { label: 'P1 High', value: stats.p1_count || 0, color: '#ff9800' },
    { label: 'P2 Medium', value: stats.p2_count || 0, color: '#2196f3' },
  ] : [];

  return (
    <div className="dashboard">
      {/* Stats Overview */}
      <section className="stats-section">
        <h2>System Status</h2>
        <div className="stats-grid">
          {statCards.map((s) => (
            <div key={s.label} className="stat-card" style={{ borderTop: `3px solid ${s.color}` }}>
              <span className="stat-icon">{s.icon}</span>
              <span className="stat-value">{s.value}</span>
              <span className="stat-label">{s.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Severity Breakdown */}
      <section className="severity-section">
        <h2>Severity Breakdown</h2>
        <div className="severity-bars">
          {severityCards.map((s) => (
            <div key={s.label} className="severity-bar-item">
              <div className="severity-bar-label">
                <span>{s.label}</span>
                <span className="severity-bar-value">{s.value}</span>
              </div>
              <div className="severity-bar-track">
                <div
                  className="severity-bar-fill"
                  style={{
                    width: `${Math.min(100, (s.value / Math.max(1, stats?.total || 1)) * 100)}%`,
                    background: s.color,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Signal Simulator (Creative Bonus) */}
      <SignalSimulator />

      {/* Filters */}
      <section className="filter-section">
        <h2>Live Incident Feed</h2>
        <div className="filters">
          <select
            id="filter-status"
            value={filter.status}
            onChange={(e) => setFilter({ ...filter, status: e.target.value })}
          >
            <option value="">All Statuses</option>
            <option value="OPEN">Open</option>
            <option value="INVESTIGATING">Investigating</option>
            <option value="RESOLVED">Resolved</option>
            <option value="CLOSED">Closed</option>
          </select>
          <select
            id="filter-severity"
            value={filter.severity}
            onChange={(e) => setFilter({ ...filter, severity: e.target.value })}
          >
            <option value="">All Severities</option>
            <option value="P0">P0 — Critical</option>
            <option value="P1">P1 — High</option>
            <option value="P2">P2 — Medium</option>
          </select>
        </div>
      </section>

      {/* Incident List */}
      <section className="incidents-section">
        {loading ? (
          <div className="loading-spinner">Loading...</div>
        ) : workItems.length === 0 ? (
          <div className="empty-state">
            <span className="empty-icon">📡</span>
            <p>No incidents found. Use the Signal Simulator above to create test data.</p>
          </div>
        ) : (
          <div className="incidents-grid">
            {workItems.map((item) => (
              <IncidentCard
                key={item.id}
                incident={item}
                onClick={onSelectIncident}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
