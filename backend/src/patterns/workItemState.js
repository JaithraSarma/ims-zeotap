/**
 * State Pattern — Work Item Lifecycle Management
 *
 * States: OPEN → INVESTIGATING → RESOLVED → CLOSED
 *
 * Each state is a class that defines:
 *   - Which transitions are allowed
 *   - Validation logic before transitioning
 *   - Side effects (e.g., MTTR calculation on close)
 *
 * The ResolvedState enforces mandatory RCA before transitioning to CLOSED.
 */

class OpenState {
  constructor() {
    this.name = 'OPEN';
  }

  getAllowedTransitions() {
    return ['INVESTIGATING'];
  }

  canTransitionTo(targetState) {
    return this.getAllowedTransitions().includes(targetState);
  }

  validate(_workItem) {
    return { valid: true };
  }
}

class InvestigatingState {
  constructor() {
    this.name = 'INVESTIGATING';
  }

  getAllowedTransitions() {
    return ['RESOLVED'];
  }

  canTransitionTo(targetState) {
    return this.getAllowedTransitions().includes(targetState);
  }

  validate(_workItem) {
    return { valid: true };
  }
}

class ResolvedState {
  constructor() {
    this.name = 'RESOLVED';
  }

  getAllowedTransitions() {
    return ['CLOSED'];
  }

  canTransitionTo(targetState) {
    return this.getAllowedTransitions().includes(targetState);
  }

  /**
   * RESOLVED → CLOSED requires a complete RCA.
   */
  validate(workItem, rcaRecord) {
    if (!rcaRecord) {
      return {
        valid: false,
        error: 'Cannot close Work Item: RCA record is missing. Submit an RCA before closing.',
      };
    }

    const requiredFields = ['incident_start', 'incident_end', 'root_cause_category', 'fix_applied', 'prevention_steps'];
    for (const field of requiredFields) {
      if (!rcaRecord[field] || (typeof rcaRecord[field] === 'string' && rcaRecord[field].trim() === '')) {
        return {
          valid: false,
          error: `Cannot close Work Item: RCA field "${field}" is missing or empty.`,
        };
      }
    }

    return { valid: true };
  }
}

class ClosedState {
  constructor() {
    this.name = 'CLOSED';
  }

  getAllowedTransitions() {
    return []; // Terminal state
  }

  canTransitionTo() {
    return false;
  }

  validate() {
    return { valid: false, error: 'Work Item is already CLOSED. No further transitions allowed.' };
  }
}

// --- State Factory ---

const STATE_MAP = {
  OPEN: OpenState,
  INVESTIGATING: InvestigatingState,
  RESOLVED: ResolvedState,
  CLOSED: ClosedState,
};

/**
 * Get the state object for a given status string.
 */
function getState(status) {
  const StateClass = STATE_MAP[status];
  if (!StateClass) {
    throw new Error(`Unknown state: ${status}`);
  }
  return new StateClass();
}

/**
 * Attempt to transition a work item from its current state to a new state.
 * Returns { valid, error?, mttrSeconds? }
 */
function validateTransition(currentStatus, targetStatus, workItem, rcaRecord) {
  const currentState = getState(currentStatus);

  if (!currentState.canTransitionTo(targetStatus)) {
    return {
      valid: false,
      error: `Invalid transition: ${currentStatus} → ${targetStatus}. Allowed: [${currentState.getAllowedTransitions().join(', ')}]`,
    };
  }

  // For RESOLVED → CLOSED, validate RCA
  if (currentStatus === 'RESOLVED' && targetStatus === 'CLOSED') {
    const validation = currentState.validate(workItem, rcaRecord);
    if (!validation.valid) return validation;

    // Calculate MTTR (Mean Time To Repair)
    const firstSignalAt = new Date(workItem.first_signal_at);
    const incidentEnd = new Date(rcaRecord.incident_end);
    const mttrSeconds = Math.round((incidentEnd - firstSignalAt) / 1000);

    return { valid: true, mttrSeconds };
  }

  return currentState.validate(workItem);
}

module.exports = {
  OpenState,
  InvestigatingState,
  ResolvedState,
  ClosedState,
  getState,
  validateTransition,
  STATE_MAP,
};
