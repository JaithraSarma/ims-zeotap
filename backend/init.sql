CREATE TABLE IF NOT EXISTS work_items (
  id UUID PRIMARY KEY,
  component_id VARCHAR(100) NOT NULL,
  component_type VARCHAR(50) NOT NULL,
  severity VARCHAR(10) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'OPEN',
  signal_count INTEGER DEFAULT 0,
  first_signal_at TIMESTAMPTZ NOT NULL,
  last_signal_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS rca_records (
  id UUID PRIMARY KEY,
  work_item_id UUID NOT NULL REFERENCES work_items(id),
  incident_start TIMESTAMPTZ NOT NULL,
  incident_end TIMESTAMPTZ NOT NULL,
  root_cause_category VARCHAR(50) NOT NULL,
  fix_applied TEXT NOT NULL,
  prevention_steps TEXT NOT NULL,
  mttr_seconds INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_work_items_status ON work_items(status);
CREATE INDEX IF NOT EXISTS idx_work_items_severity ON work_items(severity);
CREATE INDEX IF NOT EXISTS idx_work_items_component ON work_items(component_id);
CREATE INDEX IF NOT EXISTS idx_rca_work_item ON rca_records(work_item_id);
