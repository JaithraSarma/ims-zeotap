/**
 * Strategy Pattern — Alert Severity Classification
 *
 * Different component failures require different alert types.
 * Each strategy encapsulates the alerting behavior for a severity level.
 * The factory maps component_type → appropriate strategy.
 */

// --- Strategy Interface (implemented by each concrete strategy) ---

class CriticalAlertStrategy {
  constructor() {
    this.severity = 'P0';
    this.label = 'CRITICAL';
    this.escalationMinutes = 5;
  }

  execute(componentId, signalCount) {
    const alert = {
      severity: this.severity,
      label: this.label,
      componentId,
      signalCount,
      escalationMinutes: this.escalationMinutes,
      message: `🚨 CRITICAL: ${componentId} is DOWN. ${signalCount} signals received. Immediate escalation required.`,
      timestamp: new Date().toISOString(),
    };
    console.log(`[ALERT][${this.severity}] ${alert.message}`);
    return alert;
  }
}

class HighAlertStrategy {
  constructor() {
    this.severity = 'P1';
    this.label = 'HIGH';
    this.escalationMinutes = 15;
  }

  execute(componentId, signalCount) {
    const alert = {
      severity: this.severity,
      label: this.label,
      componentId,
      signalCount,
      escalationMinutes: this.escalationMinutes,
      message: `⚠️ HIGH: ${componentId} degraded. ${signalCount} signals received. Escalation in ${this.escalationMinutes} min.`,
      timestamp: new Date().toISOString(),
    };
    console.log(`[ALERT][${this.severity}] ${alert.message}`);
    return alert;
  }
}

class MediumAlertStrategy {
  constructor() {
    this.severity = 'P2';
    this.label = 'MEDIUM';
    this.escalationMinutes = 60;
  }

  execute(componentId, signalCount) {
    const alert = {
      severity: this.severity,
      label: this.label,
      componentId,
      signalCount,
      escalationMinutes: this.escalationMinutes,
      message: `📋 MEDIUM: ${componentId} showing issues. ${signalCount} signals received. Monitor closely.`,
      timestamp: new Date().toISOString(),
    };
    console.log(`[ALERT][${this.severity}] ${alert.message}`);
    return alert;
  }
}

// --- Strategy Factory ---

const COMPONENT_STRATEGY_MAP = {
  RDBMS: CriticalAlertStrategy,
  MCP_HOST: CriticalAlertStrategy,
  API: HighAlertStrategy,
  ASYNC_QUEUE: HighAlertStrategy,
  CACHE: MediumAlertStrategy,
  NOSQL: MediumAlertStrategy,
};

/**
 * Get the alert strategy for a given component type.
 * Falls back to HighAlertStrategy for unknown component types.
 */
function getAlertStrategy(componentType) {
  const StrategyClass = COMPONENT_STRATEGY_MAP[componentType] || HighAlertStrategy;
  return new StrategyClass();
}

/**
 * Determine the severity for a component type without executing the alert.
 */
function getSeverity(componentType) {
  const strategy = getAlertStrategy(componentType);
  return strategy.severity;
}

module.exports = {
  CriticalAlertStrategy,
  HighAlertStrategy,
  MediumAlertStrategy,
  getAlertStrategy,
  getSeverity,
  COMPONENT_STRATEGY_MAP,
};
