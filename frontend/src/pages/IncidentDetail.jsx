import { useState, useEffect } from 'react';
import SignalTable from '../components/SignalTable';
import RCAForm from '../components/RCAForm';
import { getWorkItem, updateWorkItemStatus } from '../services/api';
import socket from '../services/socket';

const STATUS_FLOW = {
  OPEN: { next: 'INVESTIGATING', label: 'Start Investigation', icon: '🔍' },
  INVESTIGATING: { next: 'RESOLVED', label: 'Mark Resolved', icon: '✅' },
  RESOLVED: { next: 'CLOSED', label: 'Close Incident', icon: '🔒' },
  CLOSED: null,
};

export default function IncidentDetail({ incidentId, onBack }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [transitioning, setTransitioning] = useState(false);

  const fetchDetail = async () => {
    try {
      setError('');
      const detail = await getWorkItem(incidentId);
      setData(detail);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetail();

    socket.on('workItem:updated', (updated) => {
      if (updated.id === incidentId) fetchDetail();
    });
    socket.on('rca:submitted', (evt) => {
      if (evt.work_item_id === incidentId) fetchDetail();
    });

    return () => {
      socket.off('workItem:updated');
      socket.off('rca:submitted');
    };
  }, [incidentId]);

  const handleTransition = async () => {
    if (!data?.workItem) return;
    const flow = STATUS_FLOW[data.workItem.status];
    if (!flow) return;

    setTransitioning(true);
    setError('');
    try {
      await updateWorkItemStatus(incidentId, flow.next);
      await fetchDetail();
    } catch (err) {
      setError(err.message);
    } finally {
      setTransitioning(false);
    }
  };

  if (loading) return <div className="loading-spinner">Loading incident details...</div>;
  if (error && !data) return <div className="error-message">❌ {error}</div>;
  if (!data) return null;

  const { workItem, signals, rca } = data;
  const flow = STATUS_FLOW[workItem.status];

  return (
    <div className="incident-detail">
      <button className="btn btn-back" onClick={onBack}>← Back to Dashboard</button>

      {/* Header */}
      <div className="detail-header">
        <div className="detail-title-row">
          <h2>{workItem.component_id}</h2>
          <span className={`severity-badge severity-${workItem.severity.toLowerCase()}`}>
            {workItem.severity}
          </span>
        </div>
        <div className="detail-meta">
          <span className="meta-item">Type: <strong>{workItem.component_type}</strong></span>
          <span className="meta-item">Signals: <strong>{workItem.signal_count}</strong></span>
          <span className="meta-item">Created: <strong>{new Date(workItem.created_at).toLocaleString()}</strong></span>
        </div>
      </div>

      {/* Status Timeline */}
      <div className="status-timeline">
        {['OPEN', 'INVESTIGATING', 'RESOLVED', 'CLOSED'].map((status, i) => {
          const states = ['OPEN', 'INVESTIGATING', 'RESOLVED', 'CLOSED'];
          const currentIdx = states.indexOf(workItem.status);
          const isActive = i <= currentIdx;
          const isCurrent = status === workItem.status;

          return (
            <div key={status} className={`timeline-step ${isActive ? 'active' : ''} ${isCurrent ? 'current' : ''}`}>
              <div className="timeline-dot" />
              <span className="timeline-label">{status}</span>
              {i < 3 && <div className={`timeline-line ${isActive && i < currentIdx ? 'active' : ''}`} />}
            </div>
          );
        })}
      </div>

      {/* Error Message */}
      {error && <div className="error-message">⚠️ {error}</div>}

      {/* Status Transition Button */}
      {flow && (
        <div className="transition-section">
          <button
            className="btn btn-transition"
            onClick={handleTransition}
            disabled={transitioning}
          >
            {transitioning ? 'Processing...' : `${flow.icon} ${flow.label}`}
          </button>
          {workItem.status === 'RESOLVED' && !rca && (
            <span className="transition-hint">⚠️ Submit RCA below before closing</span>
          )}
        </div>
      )}

      {/* MTTR Display */}
      {rca?.mttr_seconds && (
        <div className="mttr-display">
          <span className="mttr-label">Mean Time To Repair (MTTR):</span>
          <span className="mttr-value">{formatMTTR(rca.mttr_seconds)}</span>
        </div>
      )}

      {/* RCA Section */}
      {(workItem.status === 'RESOLVED' || workItem.status === 'INVESTIGATING' || rca) && (
        <div className="rca-section">
          {rca && workItem.status === 'CLOSED' ? (
            <div className="rca-display">
              <h3>📝 Root Cause Analysis</h3>
              <div className="rca-fields">
                <div className="rca-field">
                  <label>Category:</label>
                  <span>{rca.root_cause_category}</span>
                </div>
                <div className="rca-field">
                  <label>Incident Window:</label>
                  <span>{new Date(rca.incident_start).toLocaleString()} → {new Date(rca.incident_end).toLocaleString()}</span>
                </div>
                <div className="rca-field">
                  <label>Fix Applied:</label>
                  <p>{rca.fix_applied}</p>
                </div>
                <div className="rca-field">
                  <label>Prevention Steps:</label>
                  <p>{rca.prevention_steps}</p>
                </div>
              </div>
            </div>
          ) : (
            <RCAForm
              workItemId={incidentId}
              existingRCA={rca}
              onSubmitted={() => fetchDetail()}
            />
          )}
        </div>
      )}

      {/* Raw Signals */}
      <SignalTable signals={signals} total={workItem.signal_count} />
    </div>
  );
}

function formatMTTR(seconds) {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}
