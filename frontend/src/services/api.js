const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

async function request(path, options = {}) {
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(error.error || `HTTP ${res.status}`);
  }

  return res.json();
}

// Work Items
export const getWorkItems = (params = {}) => {
  const query = new URLSearchParams(params).toString();
  return request(`/api/work-items${query ? `?${query}` : ''}`);
};

export const getWorkItem = (id) => request(`/api/work-items/${id}`);

export const getWorkItemSignals = (id, params = {}) => {
  const query = new URLSearchParams(params).toString();
  return request(`/api/work-items/${id}/signals${query ? `?${query}` : ''}`);
};

export const updateWorkItemStatus = (id, status) =>
  request(`/api/work-items/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });

// RCA
export const submitRCA = (workItemId, rca) =>
  request(`/api/work-items/${workItemId}/rca`, {
    method: 'POST',
    body: JSON.stringify(rca),
  });

export const getRCA = (workItemId) =>
  request(`/api/work-items/${workItemId}/rca`);

// Dashboard
export const getDashboardStats = () => request('/api/dashboard/stats');

export const getTimeseries = (params = {}) => {
  const query = new URLSearchParams(params).toString();
  return request(`/api/dashboard/timeseries${query ? `?${query}` : ''}`);
};

// Health
export const getHealth = () => request('/health');

// Signals (for simulator)
export const sendSignal = (signal) =>
  request('/api/signals', {
    method: 'POST',
    body: JSON.stringify(signal),
  });

export const sendSignalBatch = (signals) =>
  request('/api/signals/batch', {
    method: 'POST',
    body: JSON.stringify({ signals }),
  });
