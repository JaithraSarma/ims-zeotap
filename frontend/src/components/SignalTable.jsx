export default function SignalTable({ signals, total }) {
  if (!signals || signals.length === 0) {
    return <div className="signal-table-empty">No signals found</div>;
  }

  return (
    <div className="signal-table-wrapper">
      <div className="signal-table-header">
        <h3>📡 Raw Signals</h3>
        <span className="signal-total">{total || signals.length} total</span>
      </div>
      <div className="signal-table-container">
        <table className="signal-table">
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Component</th>
              <th>Message</th>
              <th>Payload</th>
            </tr>
          </thead>
          <tbody>
            {signals.map((sig, i) => (
              <tr key={sig.signal_id || sig._id || i}>
                <td className="signal-time">
                  {new Date(sig.timestamp).toLocaleString()}
                </td>
                <td>
                  <span className="component-badge">{sig.component_type}</span>
                </td>
                <td className="signal-message">{sig.message || '—'}</td>
                <td className="signal-payload">
                  {sig.payload ? (
                    <details>
                      <summary>View</summary>
                      <pre>{JSON.stringify(sig.payload, null, 2)}</pre>
                    </details>
                  ) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
