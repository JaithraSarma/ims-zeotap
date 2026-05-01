const { v4: uuidv4 } = require('uuid');
const config = require('../config');

/**
 * Debouncer — Collapses multiple signals for the same component_id into a single Work Item.
 *
 * Rule: If 100 signals arrive for the same component_id within 10 seconds,
 * only one Work Item is created. All signals are linked to that Work Item.
 *
 * Uses an in-memory Map. Safe in Node.js single-threaded event loop (no race conditions).
 */
class Debouncer {
  constructor(onFlush) {
    this.buckets = new Map(); // component_id -> { signals, timer, workItemId }
    this.threshold = config.ingestion.debounceThreshold;
    this.windowMs = config.ingestion.debounceWindowMs;
    this.onFlush = onFlush; // Callback: (workItemId, componentId, componentType, signals) => void
  }

  /**
   * Add a signal to the debounce bucket for its component_id.
   * Triggers flush if threshold is reached or after window expires.
   */
  addSignal(signal) {
    const key = signal.component_id;

    if (!this.buckets.has(key)) {
      const workItemId = uuidv4();
      const bucket = {
        workItemId,
        componentType: signal.component_type,
        signals: [signal],
        timer: setTimeout(() => this._flush(key), this.windowMs),
        createdAt: Date.now(),
      };
      this.buckets.set(key, bucket);
    } else {
      const bucket = this.buckets.get(key);
      bucket.signals.push(signal);

      // Flush immediately if threshold reached
      if (bucket.signals.length >= this.threshold) {
        clearTimeout(bucket.timer);
        this._flush(key);
      }
    }
  }

  /**
   * Flush a bucket — calls the onFlush callback with the accumulated signals.
   */
  _flush(componentId) {
    const bucket = this.buckets.get(componentId);
    if (!bucket) return;

    this.buckets.delete(componentId);

    if (this.onFlush) {
      this.onFlush(
        bucket.workItemId,
        componentId,
        bucket.componentType,
        bucket.signals
      );
    }
  }

  /**
   * Get current debounce state for observability.
   */
  getStats() {
    const stats = {};
    for (const [key, bucket] of this.buckets) {
      stats[key] = {
        signalCount: bucket.signals.length,
        ageMs: Date.now() - bucket.createdAt,
      };
    }
    return stats;
  }

  /**
   * Cleanup all pending timers (for graceful shutdown).
   */
  destroy() {
    for (const [, bucket] of this.buckets) {
      clearTimeout(bucket.timer);
    }
    this.buckets.clear();
  }
}

module.exports = Debouncer;
