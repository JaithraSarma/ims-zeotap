const {
  validateTransition,
  getState,
} = require('../src/patterns/workItemState');

describe('Work Item State Transitions', () => {
  const mockWorkItem = {
    id: 'test-id',
    status: 'OPEN',
    first_signal_at: '2024-01-01T00:00:00Z',
  };

  // --- Valid transitions ---
  test('OPEN → INVESTIGATING is valid', () => {
    const result = validateTransition('OPEN', 'INVESTIGATING', mockWorkItem);
    expect(result.valid).toBe(true);
  });

  test('INVESTIGATING → RESOLVED is valid', () => {
    const result = validateTransition('INVESTIGATING', 'RESOLVED', mockWorkItem);
    expect(result.valid).toBe(true);
  });

  test('RESOLVED → CLOSED is valid when RCA is complete', () => {
    const rca = {
      incident_start: '2024-01-01T00:00:00Z',
      incident_end: '2024-01-01T01:00:00Z',
      root_cause_category: 'Infrastructure',
      fix_applied: 'Restarted the database cluster',
      prevention_steps: 'Add health check monitoring',
    };
    const result = validateTransition('RESOLVED', 'CLOSED', mockWorkItem, rca);
    expect(result.valid).toBe(true);
    expect(result.mttrSeconds).toBe(3600); // 1 hour
  });

  // --- Invalid transitions ---
  test('OPEN → RESOLVED is invalid (must go through INVESTIGATING)', () => {
    const result = validateTransition('OPEN', 'RESOLVED', mockWorkItem);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Invalid transition');
  });

  test('OPEN → CLOSED is invalid', () => {
    const result = validateTransition('OPEN', 'CLOSED', mockWorkItem);
    expect(result.valid).toBe(false);
  });

  test('INVESTIGATING → CLOSED is invalid (must go through RESOLVED)', () => {
    const result = validateTransition('INVESTIGATING', 'CLOSED', mockWorkItem);
    expect(result.valid).toBe(false);
  });

  test('CLOSED → any state is invalid (terminal state)', () => {
    const result = validateTransition('CLOSED', 'OPEN', mockWorkItem);
    expect(result.valid).toBe(false);
  });

  // --- RCA validation ---
  test('RESOLVED → CLOSED is rejected when RCA is missing', () => {
    const result = validateTransition('RESOLVED', 'CLOSED', mockWorkItem, null);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('RCA record is missing');
  });

  test('RESOLVED → CLOSED is rejected when RCA has empty fix_applied', () => {
    const incompleteRCA = {
      incident_start: '2024-01-01T00:00:00Z',
      incident_end: '2024-01-01T01:00:00Z',
      root_cause_category: 'Infrastructure',
      fix_applied: '',
      prevention_steps: 'Add monitoring',
    };
    const result = validateTransition('RESOLVED', 'CLOSED', mockWorkItem, incompleteRCA);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('fix_applied');
  });

  test('RESOLVED → CLOSED is rejected when RCA has empty prevention_steps', () => {
    const incompleteRCA = {
      incident_start: '2024-01-01T00:00:00Z',
      incident_end: '2024-01-01T01:00:00Z',
      root_cause_category: 'Code Bug',
      fix_applied: 'Fixed the null pointer',
      prevention_steps: '   ',
    };
    const result = validateTransition('RESOLVED', 'CLOSED', mockWorkItem, incompleteRCA);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('prevention_steps');
  });

  test('RESOLVED → CLOSED is rejected when RCA missing root_cause_category', () => {
    const incompleteRCA = {
      incident_start: '2024-01-01T00:00:00Z',
      incident_end: '2024-01-01T01:00:00Z',
      root_cause_category: '',
      fix_applied: 'Fixed it',
      prevention_steps: 'Monitor it',
    };
    const result = validateTransition('RESOLVED', 'CLOSED', mockWorkItem, incompleteRCA);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('root_cause_category');
  });

  // --- MTTR Calculation ---
  test('MTTR is correctly calculated on close', () => {
    const rca = {
      incident_start: '2024-01-01T00:00:00Z',
      incident_end: '2024-01-01T02:30:00Z',
      root_cause_category: 'Capacity',
      fix_applied: 'Scaled up instances',
      prevention_steps: 'Set up auto-scaling',
    };
    const result = validateTransition('RESOLVED', 'CLOSED', mockWorkItem, rca);
    expect(result.valid).toBe(true);
    expect(result.mttrSeconds).toBe(9000); // 2.5 hours = 9000 seconds
  });
});

describe('State objects', () => {
  test('getState returns correct state for known statuses', () => {
    expect(getState('OPEN').name).toBe('OPEN');
    expect(getState('INVESTIGATING').name).toBe('INVESTIGATING');
    expect(getState('RESOLVED').name).toBe('RESOLVED');
    expect(getState('CLOSED').name).toBe('CLOSED');
  });

  test('getState throws for unknown status', () => {
    expect(() => getState('INVALID')).toThrow('Unknown state');
  });
});
