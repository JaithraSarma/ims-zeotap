const { v4: uuidv4 } = require('uuid');
const RingBuffer = require('../ingestion/ringBuffer');
const Debouncer = require('../ingestion/debouncer');
const { Signal } = require('../db/mongo');
const { queryWithRetry } = require('../db/postgres');
const { updateDashboardCache } = require('../db/redis');
const { getAlertStrategy, getSeverity } = require('../patterns/alertStrategy');
const metricsService = require('./metricsService');
const config = require('../config');

let io = null;
const ringBuffer = new RingBuffer(config.ingestion.ringBufferSize);

/**
 * Flush callback — invoked by the Debouncer when a component_id bucket is ready.
 * Creates a Work Item in PostgreSQL, stores raw signals in MongoDB, updates Redis cache.
 */
async function handleFlush(workItemId, componentId, componentType, signals) {
  try {
    const severity = getSeverity(componentType);
    const firstSignalAt = signals[0].timestamp || new Date().toISOString();
    const lastSignalAt = signals[signals.length - 1].timestamp || new Date().toISOString();

    // 1. Create Work Item in PostgreSQL (transactional source of truth)
    await queryWithRetry(
      `INSERT INTO work_items (id, component_id, component_type, severity, status, signal_count, first_signal_at, last_signal_at)
       VALUES ($1, $2, $3, $4, 'OPEN', $5, $6, $7)
       ON CONFLICT (id) DO UPDATE SET
         signal_count = work_items.signal_count + $5,
         last_signal_at = $7,
         updated_at = NOW()`,
      [workItemId, componentId, componentType, severity, signals.length, firstSignalAt, lastSignalAt]
    );

    // 2. Store raw signals in MongoDB (audit log / data lake)
    const signalDocs = signals.map((s) => ({
      signal_id: s.signal_id || uuidv4(),
      component_id: s.component_id,
      component_type: s.component_type,
      severity: s.severity || severity,
      message: s.message || '',
      payload: s.payload || {},
      work_item_id: workItemId,
      timestamp: s.timestamp || new Date(),
    }));

    await Signal.insertMany(signalDocs, { ordered: false }).catch((err) => {
      console.error('[SignalProcessor] MongoDB insertMany error:', err.message);
    });

    // 3. Execute alert strategy
    const strategy = getAlertStrategy(componentType);
    const alert = strategy.execute(componentId, signals.length);

    // 4. Update Redis dashboard cache
    await refreshDashboardCache();

    // 5. Emit live event via Socket.IO
    if (io) {
      io.emit('workItem:created', {
        id: workItemId,
        component_id: componentId,
        component_type: componentType,
        severity,
        status: 'OPEN',
        signal_count: signals.length,
        first_signal_at: firstSignalAt,
        last_signal_at: lastSignalAt,
        alert,
      });
    }

    metricsService.recordWorkItem();
    metricsService.recordProcessed(signals.length);
  } catch (err) {
    console.error('[SignalProcessor] Flush error:', err.message);
  }
}

const debouncer = new Debouncer(handleFlush);

/**
 * Ingest a single signal into the ring buffer, then feed to debouncer.
 */
function ingestSignal(signal) {
  ringBuffer.enqueue(signal);
  metricsService.recordIngestion();
}

/**
 * Async drain loop — processes signals from the ring buffer through the debouncer.
 * Runs continuously, draining in batches for efficiency.
 */
let drainRunning = false;

async function startDrainLoop() {
  if (drainRunning) return;
  drainRunning = true;

  const drainInterval = setInterval(() => {
    const batch = ringBuffer.drainBatch(500);
    for (const signal of batch) {
      debouncer.addSignal(signal);
    }
  }, 50); // Drain every 50ms

  // Store interval for cleanup
  startDrainLoop._interval = drainInterval;
}

/**
 * Refresh the dashboard cache in Redis.
 */
async function refreshDashboardCache() {
  try {
    const result = await queryWithRetry(
      `SELECT
        COUNT(*) FILTER (WHERE status = 'OPEN') AS open_count,
        COUNT(*) FILTER (WHERE status = 'INVESTIGATING') AS investigating_count,
        COUNT(*) FILTER (WHERE status = 'RESOLVED') AS resolved_count,
        COUNT(*) FILTER (WHERE status = 'CLOSED') AS closed_count,
        COUNT(*) FILTER (WHERE severity = 'P0') AS p0_count,
        COUNT(*) FILTER (WHERE severity = 'P1') AS p1_count,
        COUNT(*) FILTER (WHERE severity = 'P2') AS p2_count,
        COUNT(*) AS total
      FROM work_items`
    );

    const stats = result.rows[0];
    await updateDashboardCache(stats);

    if (io) {
      io.emit('dashboard:update', stats);
    }
  } catch (err) {
    console.error('[SignalProcessor] Dashboard cache refresh failed:', err.message);
  }
}

function setSocketIO(socketIO) {
  io = socketIO;
}

function getRingBuffer() {
  return ringBuffer;
}

function getDebouncer() {
  return debouncer;
}

function stopDrainLoop() {
  drainRunning = false;
  if (startDrainLoop._interval) {
    clearInterval(startDrainLoop._interval);
  }
  debouncer.destroy();
}

module.exports = {
  ingestSignal,
  startDrainLoop,
  stopDrainLoop,
  refreshDashboardCache,
  setSocketIO,
  getRingBuffer,
  getDebouncer,
};
