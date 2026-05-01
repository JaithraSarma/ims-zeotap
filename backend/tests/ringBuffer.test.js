const RingBuffer = require('../src/ingestion/ringBuffer');

describe('RingBuffer', () => {
  test('enqueue and dequeue work correctly', () => {
    const rb = new RingBuffer(5);
    rb.enqueue('a');
    rb.enqueue('b');
    rb.enqueue('c');

    expect(rb.getSize()).toBe(3);
    expect(rb.dequeue()).toBe('a');
    expect(rb.dequeue()).toBe('b');
    expect(rb.getSize()).toBe(1);
  });

  test('returns null when dequeuing from empty buffer', () => {
    const rb = new RingBuffer(5);
    expect(rb.dequeue()).toBeNull();
  });

  test('drops oldest when buffer is full', () => {
    const rb = new RingBuffer(3);
    rb.enqueue('a');
    rb.enqueue('b');
    rb.enqueue('c');
    rb.enqueue('d'); // Should drop 'a'

    expect(rb.getDropped()).toBe(1);
    expect(rb.getSize()).toBe(3);
    expect(rb.dequeue()).toBe('b'); // 'a' was dropped
    expect(rb.dequeue()).toBe('c');
    expect(rb.dequeue()).toBe('d');
  });

  test('drainBatch returns correct batch size', () => {
    const rb = new RingBuffer(100);
    for (let i = 0; i < 10; i++) rb.enqueue(i);

    const batch = rb.drainBatch(5);
    expect(batch).toEqual([0, 1, 2, 3, 4]);
    expect(rb.getSize()).toBe(5);
  });

  test('drainBatch returns all items when fewer than batch size', () => {
    const rb = new RingBuffer(100);
    rb.enqueue('x');
    rb.enqueue('y');

    const batch = rb.drainBatch(10);
    expect(batch).toEqual(['x', 'y']);
    expect(rb.getSize()).toBe(0);
  });

  test('isFull returns correct value', () => {
    const rb = new RingBuffer(2);
    expect(rb.isFull()).toBe(false);
    rb.enqueue('a');
    rb.enqueue('b');
    expect(rb.isFull()).toBe(true);
  });

  test('handles high volume without crashing', () => {
    const rb = new RingBuffer(1000);
    for (let i = 0; i < 50000; i++) {
      rb.enqueue({ id: i, data: 'test' });
    }
    // Buffer should contain last 1000 items
    expect(rb.getSize()).toBe(1000);
    expect(rb.getDropped()).toBe(49000);

    const first = rb.dequeue();
    expect(first.id).toBe(49000);
  });
});
