CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS nodes (
  id TEXT PRIMARY KEY,
  node_id TEXT UNIQUE NOT NULL,
  name TEXT,
  location TEXT,
  is_active INTEGER DEFAULT 1,
  valve_position INTEGER DEFAULT 50,
  valve_mode TEXT DEFAULT 'auto',
  target_position REAL DEFAULT 0,
  last_command_id TEXT,
  last_valve_update TEXT,
  status TEXT DEFAULT 'offline',
  last_seen TEXT,
  api_key TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS telemetry (
  id TEXT PRIMARY KEY,
  node_id TEXT NOT NULL,
  pressure REAL NOT NULL,
  flow_rate REAL,
  temperature REAL,
  battery_level REAL,
  valve_position INTEGER,
  timestamp TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (node_id) REFERENCES nodes(node_id)
);

CREATE TABLE IF NOT EXISTS decisions (
  id TEXT PRIMARY KEY,
  node_id TEXT NOT NULL,
  telemetry_id TEXT,
  risk_level TEXT NOT NULL,
  action TEXT NOT NULL,
  requires_alert INTEGER NOT NULL,
  confidence REAL DEFAULT 0.5,
  reason TEXT DEFAULT '',
  recommended_valve_position INTEGER DEFAULT 0,
  alert_severity TEXT DEFAULT 'ok',
  engine TEXT DEFAULT 'rule',
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (node_id) REFERENCES nodes(node_id)
);

CREATE TABLE IF NOT EXISTS alerts (
  id TEXT PRIMARY KEY,
  node_id TEXT NOT NULL,
  message TEXT NOT NULL,
  risk_level TEXT NOT NULL,
  sent INTEGER DEFAULT 0,
  sent_at TEXT,
  acknowledged INTEGER DEFAULT 0,
  acknowledged_at TEXT,
  acknowledged_by TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (node_id) REFERENCES nodes(node_id)
);

CREATE TABLE IF NOT EXISTS commands (
  id TEXT PRIMARY KEY,
  node_id TEXT NOT NULL,
  command TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  priority TEXT DEFAULT 'normal',
  target_position INTEGER,
  executed_position INTEGER,
  sent_at TEXT,
  acknowledged_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (node_id) REFERENCES nodes(node_id)
);

CREATE TABLE IF NOT EXISTS pressure_readings (
  id TEXT PRIMARY KEY,
  dma_id TEXT NOT NULL,
  pressure_bar REAL NOT NULL,
  source_node_id TEXT,
  timestamp TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS household_connections (
  household_id TEXT PRIMARY KEY,
  dma_id TEXT NOT NULL,
  consumer_id TEXT NOT NULL,
  address TEXT NOT NULL,
  pipe_diameter_mm INTEGER NOT NULL,
  pipe_area_m2 REAL NOT NULL,
  warn_threshold_lps REAL NOT NULL DEFAULT 0.08,
  alert_threshold_lps REAL NOT NULL DEFAULT 0.15,
  confirm_window_sec INTEGER NOT NULL DEFAULT 120,
  cooldown_sec INTEGER NOT NULL DEFAULT 600,
  api_key_hash TEXT NOT NULL,
  registered_at TEXT DEFAULT (datetime('now')),
  is_active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS household_flow_readings (
  id TEXT PRIMARY KEY,
  time TEXT NOT NULL,
  household_id TEXT NOT NULL,
  dma_id TEXT NOT NULL,
  flow_rate_lps REAL NOT NULL,
  q_theoretical_lps REAL NOT NULL,
  q_excess_lps REAL NOT NULL,
  detection_state TEXT NOT NULL,
  severity_score REAL NOT NULL,
  signal_quality TEXT NOT NULL,
  pressure_source_bar REAL NOT NULL,
  rssi_dbm INTEGER,
  firmware_version TEXT,
  FOREIGN KEY (household_id) REFERENCES household_connections(household_id)
);

CREATE TABLE IF NOT EXISTS illegal_extraction_events (
  id TEXT PRIMARY KEY,
  household_id TEXT NOT NULL,
  dma_id TEXT NOT NULL,
  onset_time TEXT NOT NULL,
  resolved_time TEXT,
  q_excess_lps REAL NOT NULL,
  severity TEXT NOT NULL,
  severity_score REAL NOT NULL,
  webhook_fired INTEGER NOT NULL DEFAULT 0,
  webhook_attempts INTEGER NOT NULL DEFAULT 0,
  webhook_status TEXT,
  resolved INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (household_id) REFERENCES household_connections(household_id)
);

CREATE INDEX IF NOT EXISTS idx_pressure_readings_dma_time
  ON pressure_readings(dma_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_household_flow_household_time
  ON household_flow_readings(household_id, time DESC);

CREATE INDEX IF NOT EXISTS idx_household_flow_dma_time
  ON household_flow_readings(dma_id, time DESC);

CREATE INDEX IF NOT EXISTS idx_illegal_events_household_time
  ON illegal_extraction_events(household_id, onset_time DESC);

CREATE TABLE IF NOT EXISTS integration_events (
  event_id TEXT PRIMARY KEY,
  correlation_id TEXT NOT NULL,
  source_module TEXT NOT NULL,
  event_type TEXT NOT NULL,
  integration_risk_state TEXT NOT NULL,
  risk_level TEXT,
  confidence REAL,
  node_id TEXT,
  dma_id TEXT,
  household_id TEXT,
  timestamp TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS integration_zone_snapshots (
  dma_id TEXT PRIMARY KEY,
  last_updated TEXT NOT NULL,
  integration_risk_state TEXT NOT NULL,
  risk_score REAL NOT NULL,
  contributors_json TEXT NOT NULL,
  advisory_json TEXT,
  correlation_id TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_integration_events_dma_time
  ON integration_events(dma_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_integration_events_risk_time
  ON integration_events(integration_risk_state, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_integration_events_source_time
  ON integration_events(source_module, timestamp DESC);

CREATE TRIGGER IF NOT EXISTS trg_telemetry_to_pressure_readings
AFTER INSERT ON telemetry
BEGIN
  INSERT INTO pressure_readings (id, dma_id, pressure_bar, source_node_id, timestamp)
  VALUES (lower(hex(randomblob(16))), NEW.node_id, NEW.pressure, NEW.node_id, NEW.timestamp);
END;

CREATE TABLE IF NOT EXISTS mpc_hydraulic_model (
  id TEXT PRIMARY KEY,
  pump_head_bar REAL NOT NULL DEFAULT 6.0,
  coupling_matrix_json TEXT NOT NULL,
  elevation_head_json TEXT NOT NULL,
  base_loss_json TEXT NOT NULL,
  is_calibrated INTEGER DEFAULT 0,
  last_calibrated TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS mpc_calibration_log (
  id TEXT PRIMARY KEY,
  timestamp TEXT NOT NULL,
  source_node TEXT NOT NULL,
  target_node TEXT NOT NULL,
  k_ij_measured REAL NOT NULL,
  method TEXT DEFAULT 'step_test'
);

CREATE INDEX IF NOT EXISTS idx_mpc_calibration_nodes
  ON mpc_calibration_log(source_node, target_node);
