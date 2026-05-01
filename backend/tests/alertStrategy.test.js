const {
  getAlertStrategy,
  getSeverity,
  CriticalAlertStrategy,
  HighAlertStrategy,
  MediumAlertStrategy,
} = require('../src/patterns/alertStrategy');

describe('Alert Strategy Pattern', () => {
  test('RDBMS maps to P0 CRITICAL', () => {
    const strategy = getAlertStrategy('RDBMS');
    expect(strategy).toBeInstanceOf(CriticalAlertStrategy);
    expect(strategy.severity).toBe('P0');
  });

  test('MCP_HOST maps to P0 CRITICAL', () => {
    const strategy = getAlertStrategy('MCP_HOST');
    expect(strategy).toBeInstanceOf(CriticalAlertStrategy);
    expect(strategy.severity).toBe('P0');
  });

  test('API maps to P1 HIGH', () => {
    const strategy = getAlertStrategy('API');
    expect(strategy).toBeInstanceOf(HighAlertStrategy);
    expect(strategy.severity).toBe('P1');
  });

  test('ASYNC_QUEUE maps to P1 HIGH', () => {
    const strategy = getAlertStrategy('ASYNC_QUEUE');
    expect(strategy).toBeInstanceOf(HighAlertStrategy);
    expect(strategy.severity).toBe('P1');
  });

  test('CACHE maps to P2 MEDIUM', () => {
    const strategy = getAlertStrategy('CACHE');
    expect(strategy).toBeInstanceOf(MediumAlertStrategy);
    expect(strategy.severity).toBe('P2');
  });

  test('NOSQL maps to P2 MEDIUM', () => {
    expect(getSeverity('NOSQL')).toBe('P2');
  });

  test('Unknown component type defaults to P1 HIGH', () => {
    const strategy = getAlertStrategy('UNKNOWN_SERVICE');
    expect(strategy).toBeInstanceOf(HighAlertStrategy);
    expect(strategy.severity).toBe('P1');
  });

  test('execute() returns alert object with correct fields', () => {
    const strategy = getAlertStrategy('RDBMS');
    const alert = strategy.execute('DB_PRIMARY_01', 50);

    expect(alert.severity).toBe('P0');
    expect(alert.componentId).toBe('DB_PRIMARY_01');
    expect(alert.signalCount).toBe(50);
    expect(alert.message).toContain('CRITICAL');
    expect(alert.timestamp).toBeDefined();
  });
});
