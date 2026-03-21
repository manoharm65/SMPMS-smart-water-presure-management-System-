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
  engine TEXT DEFAULT 'rule',
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (node_id) REFERENCES nodes(node_id)
);

-- For each column, use a transaction + exception approach that SQLite sql.js handles
-- These ALTER statements run on every start but are only applied if the column is new

ALTER TABLE decisions ADD COLUMN confidence REAL DEFAULT 0.5;
ALTER TABLE decisions ADD COLUMN reason TEXT DEFAULT '';
ALTER TABLE decisions ADD COLUMN recommended_valve_position INTEGER DEFAULT 0;
ALTER TABLE decisions ADD COLUMN alert_severity TEXT DEFAULT 'ok';

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
