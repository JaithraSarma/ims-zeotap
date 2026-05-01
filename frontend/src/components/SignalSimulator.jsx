import { useState } from 'react';
import { sendSignal, sendSignalBatch } from '../services/api';

const SCENARIOS = [
  {
    name: 'RDBMS Outage',
    icon: '🔥',
    signals: Array.from({ length: 20 }, (_, i) => ({
      component_id: 'DB_PRIMARY_01',
      component_type: 'RDBMS',
      message: `Connection timeout on query ${i}`,
      payload: { error_code: 'ETIMEOUT', latency_ms: 30000 + Math.random() * 5000 },
    })),
  },
  {
    name: 'Cache Failure',
    icon: '🌊',
    signals: Array.from({ length: 15 }, (_, i) => ({
      component_id: 'CACHE_CLUSTER_01',
      component_type: 'CACHE',
      message: `Cache miss - key evicted ${i}`,
      payload: { hit_rate: 0.1, key: `user:${Math.floor(Math.random() * 10000)}` },
    })),
  },
  {
    name: 'API Errors',
    icon: '⚠️',
    signals: Array.from({ length: 10 }, (_, i) => ({
      component_id: 'API_GATEWAY_01',
      component_type: 'API',
      message: `HTTP 503 Service Unavailable`,
      payload: { endpoint: '/api/users', status_code: 503 },
    })),
  },
  {
    name: 'MCP Host Down',
    icon: '💀',
    signals: Array.from({ length: 12 }, (_, i) => ({
      component_id: 'MCP_HOST_01',
      component_type: 'MCP_HOST',
      message: `Tool execution failed ${i}`,
      payload: { tool: 'db_query', error: 'upstream_timeout' },
    })),
  },
];

export default function SignalSimulator() {
  const [status, setStatus] = useState('');
  const [sending, setSending] = useState(false);

  const runScenario = async (scenario) => {
    setSending(true);
    setStatus(`Sending ${scenario.signals.length} signals for ${scenario.name}...`);
    try {
      await sendSignalBatch(scenario.signals);
      setStatus(`✅ Sent ${scenario.signals.length} signals for ${scenario.name}`);
    } catch (err) {
      setStatus(`❌ Failed: ${err.message}`);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="signal-simulator">
      <h3>🧪 Signal Simulator</h3>
      <p className="simulator-desc">Trigger failure scenarios to test the system</p>
      <div className="scenario-buttons">
        {SCENARIOS.map((s) => (
          <button
            key={s.name}
            className="btn btn-scenario"
            onClick={() => runScenario(s)}
            disabled={sending}
          >
            {s.icon} {s.name}
          </button>
        ))}
      </div>
      {status && <div className="simulator-status">{status}</div>}
    </div>
  );
}
