/**
 * Metrics Service — Tracks and reports system throughput.
 * Prints signals/sec, active work items, buffer stats to console every 5 seconds.
 */
class MetricsService {
  constructor() {
    this.signalsIngested = 0;
    this.signalsProcessed = 0;
    this.workItemsCreated = 0;
    this.lastReportTime = Date.now();
    this.interval = null;
  }

  /**
   * Start printing metrics every 5 seconds.
   */
  start() {
    this.lastReportTime = Date.now();
    this.interval = setInterval(() => this.report(), 5000);
  }

  recordIngestion(count = 1) {
    this.signalsIngested += count;
  }

  recordProcessed(count = 1) {
    this.signalsProcessed += count;
  }

  recordWorkItem() {
    this.workItemsCreated++;
  }

  report() {
    const now = Date.now();
    const elapsed = (now - this.lastReportTime) / 1000;
    const ingestRate = (this.signalsIngested / elapsed).toFixed(1);
    const processRate = (this.signalsProcessed / elapsed).toFixed(1);

    console.log(
      `[Metrics] Signals/sec: ${ingestRate} ingested, ${processRate} processed | ` +
      `Total Work Items Created: ${this.workItemsCreated}`
    );

    // Reset counters
    this.signalsIngested = 0;
    this.signalsProcessed = 0;
    this.lastReportTime = now;
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }
}

// Singleton
module.exports = new MetricsService();
