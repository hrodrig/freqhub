-- Migration: Create bot_ownership table
-- Description: Creates the bot_ownership table to track which users own which bots

CREATE TABLE IF NOT EXISTS bot_ownership (
  id TEXT PRIMARY KEY,
  bot_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  created_by TEXT,
  FOREIGN KEY (bot_id) REFERENCES bots(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id),
  UNIQUE(bot_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_bot_ownership_bot_id ON bot_ownership(bot_id);
CREATE INDEX IF NOT EXISTS idx_bot_ownership_user_id ON bot_ownership(user_id);

