const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { ingestSignal } = require('../services/signalProcessor');
const { signalRateLimiter } = require('../ingestion/rateLimiter');

const router = express.Router();

/**
 * POST /api/signals — Ingest a single signal.
 * Rate-limited to prevent cascading failures.
 */
router.post('/', signalRateLimiter, (req, res) => {
  const { component_id, component_type, message, payload } = req.body;

  if (!component_id || !component_type) {
    return res.status(400).json({ error: 'component_id and component_type are required' });
  }

  const signal = {
    signal_id: uuidv4(),
    component_id,
    component_type: component_type.toUpperCase(),
    message: message || '',
    payload: payload || {},
    timestamp: new Date().toISOString(),
  };

  ingestSignal(signal);

  res.status(202).json({ accepted: true, signal_id: signal.signal_id });
});

/**
 * POST /api/signals/batch — Ingest multiple signals at once.
 * Rate-limited to prevent cascading failures.
 */
router.post('/batch', signalRateLimiter, (req, res) => {
  const { signals } = req.body;

  if (!Array.isArray(signals) || signals.length === 0) {
    return res.status(400).json({ error: 'signals array is required and must not be empty' });
  }

  const accepted = [];
  for (const s of signals) {
    if (!s.component_id || !s.component_type) continue;

    const signal = {
      signal_id: uuidv4(),
      component_id: s.component_id,
      component_type: s.component_type.toUpperCase(),
      message: s.message || '',
      payload: s.payload || {},
      timestamp: s.timestamp || new Date().toISOString(),
    };

    ingestSignal(signal);
    accepted.push(signal.signal_id);
  }

  res.status(202).json({ accepted: true, count: accepted.length });
});

module.exports = router;
