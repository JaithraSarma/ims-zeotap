/**
 * RingBuffer — Fixed-size circular buffer for backpressure handling.
 *
 * When the persistence layer is slow, signals are held in memory.
 * If the buffer fills up, the oldest signals are overwritten (drop-oldest policy).
 * This ensures the system never crashes under burst load.
 */
class RingBuffer {
  constructor(capacity = 50000) {
    this.buffer = new Array(capacity);
    this.capacity = capacity;
    this.head = 0;      // Next write position
    this.tail = 0;      // Next read position
    this.size = 0;       // Current number of items
    this.dropped = 0;    // Count of dropped signals (for observability)
  }

  /**
   * Enqueue a signal. Non-blocking — O(1).
   * If buffer is full, overwrites oldest entry and increments dropped counter.
   */
  enqueue(item) {
    if (this.size === this.capacity) {
      // Buffer full: drop oldest (advance tail)
      this.tail = (this.tail + 1) % this.capacity;
      this.dropped++;
    } else {
      this.size++;
    }
    this.buffer[this.head] = item;
    this.head = (this.head + 1) % this.capacity;
    return true;
  }

  /**
   * Dequeue a signal. Returns null if empty.
   */
  dequeue() {
    if (this.size === 0) return null;
    const item = this.buffer[this.tail];
    this.buffer[this.tail] = null; // Allow GC
    this.tail = (this.tail + 1) % this.capacity;
    this.size--;
    return item;
  }

  /**
   * Drain up to `batchSize` signals into an array for batch processing.
   */
  drainBatch(batchSize = 500) {
    const batch = [];
    const count = Math.min(batchSize, this.size);
    for (let i = 0; i < count; i++) {
      batch.push(this.dequeue());
    }
    return batch;
  }

  getSize() {
    return this.size;
  }

  getDropped() {
    return this.dropped;
  }

  isFull() {
    return this.size === this.capacity;
  }
}

module.exports = RingBuffer;
