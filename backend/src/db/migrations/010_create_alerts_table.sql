-- Migration: Create alerts table
-- Description: Centralized alerts aggregated from all bot instances' events (bot offline/online,
-- new trades, etc. - see services/eventBus.service.ts) for the Alert System feature.

CREATE TABLE IF NOT EXISTS alerts (
  id TEXT PRIMARY KEY,
  bot_id TEXT,
  bot_name TEXT,
  severity TEXT NOT NULL,
  type TEXT NOT NULL,
  message TEXT NOT NULL,
  details TEXT,
  is_acknowledged INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  acknowledged_at INTEGER,
  acknowledged_by TEXT,
  FOREIGN KEY (bot_id) REFERENCES bots(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_alerts_bot_id ON alerts(bot_id);
CREATE INDEX IF NOT EXISTS idx_alerts_is_acknowledged ON alerts(is_acknowledged);
CREATE INDEX IF NOT EXISTS idx_alerts_created_at ON alerts(created_at);
CREATE INDEX IF NOT EXISTS idx_alerts_severity ON alerts(severity);
