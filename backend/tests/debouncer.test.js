const Debouncer = require('../src/ingestion/debouncer');

// Override config for tests
jest.mock('../src/config', () => ({
  ingestion: {
    debounceThreshold: 5,   // Lower threshold for testing
    debounceWindowMs: 500,  // 500ms window for testing
  },
}));

describe('Debouncer', () => {
  let debouncer;
  let flushed;

  beforeEach(() => {
    flushed = [];
    debouncer = new Debouncer((workItemId, componentId, componentType, signals) => {
      flushed.push({ workItemId, componentId, componentType, signals });
    });
  });

  afterEach(() => {
    debouncer.destroy();
  });

  test('creates a single work item for multiple signals from same component', (done) => {
    // Send 5 signals (threshold) for same component
    for (let i = 0; i < 5; i++) {
      debouncer.addSignal({
        signal_id: `sig-${i}`,
        component_id: 'CACHE_CLUSTER_01',
        component_type: 'CACHE',
      });
    }

    // Should flush immediately on reaching threshold
    setTimeout(() => {
      expect(flushed.length).toBe(1);
      expect(flushed[0].componentId).toBe('CACHE_CLUSTER_01');
      expect(flushed[0].signals.length).toBe(5);
      done();
    }, 50);
  });

  test('flushes after window expires even if threshold not reached', (done) => {
    // Send 2 signals (below threshold of 5)
    debouncer.addSignal({
      signal_id: 'sig-1',
      component_id: 'API_GW_01',
      component_type: 'API',
    });
    debouncer.addSignal({
      signal_id: 'sig-2',
      component_id: 'API_GW_01',
      component_type: 'API',
    });

    // Wait for window to expire (500ms + buffer)
    setTimeout(() => {
      expect(flushed.length).toBe(1);
      expect(flushed[0].signals.length).toBe(2);
      done();
    }, 700);
  });

  test('handles multiple component IDs independently', (done) => {
    // Signals for two different components
    for (let i = 0; i < 5; i++) {
      debouncer.addSignal({
        signal_id: `cache-${i}`,
        component_id: 'CACHE_01',
        component_type: 'CACHE',
      });
    }
    for (let i = 0; i < 5; i++) {
      debouncer.addSignal({
        signal_id: `db-${i}`,
        component_id: 'DB_01',
        component_type: 'RDBMS',
      });
    }

    setTimeout(() => {
      expect(flushed.length).toBe(2);
      const ids = flushed.map((f) => f.componentId).sort();
      expect(ids).toEqual(['CACHE_01', 'DB_01']);
      done();
    }, 50);
  });

  test('getStats reports active buckets', () => {
    debouncer.addSignal({
      signal_id: 'sig-1',
      component_id: 'MCP_01',
      component_type: 'MCP_HOST',
    });

    const stats = debouncer.getStats();
    expect(stats['MCP_01']).toBeDefined();
    expect(stats['MCP_01'].signalCount).toBe(1);
  });
});
