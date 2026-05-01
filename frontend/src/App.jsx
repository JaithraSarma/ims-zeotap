import { useState } from 'react';
import Dashboard from './pages/Dashboard';
import IncidentDetail from './pages/IncidentDetail';
import './App.css';

export default function App() {
  const [selectedIncident, setSelectedIncident] = useState(null);

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-content">
          <div className="header-brand" onClick={() => setSelectedIncident(null)} style={{ cursor: 'pointer' }}>
            <span className="header-icon">🚨</span>
            <h1>IMS</h1>
            <span className="header-subtitle">Incident Management System</span>
          </div>
          <div className="header-status">
            <span className="pulse-dot" />
            <span>Live</span>
          </div>
        </div>
      </header>

      <main className="app-main">
        {selectedIncident ? (
          <IncidentDetail
            incidentId={selectedIncident}
            onBack={() => setSelectedIncident(null)}
          />
        ) : (
          <Dashboard onSelectIncident={setSelectedIncident} />
        )}
      </main>
    </div>
  );
}
