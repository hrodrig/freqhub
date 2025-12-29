-- Initial migration: Create bots table
-- This migration is applied automatically on first run via schema.ts

CREATE TABLE IF NOT EXISTS bots (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    api_url TEXT NOT NULL,
    ws_url TEXT,
    username TEXT NOT NULL,
    encrypted_password TEXT NOT NULL,
    access_token TEXT,
    token_expires_at INTEGER,
    is_enabled INTEGER DEFAULT 1,
    is_selected INTEGER DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_bots_enabled ON bots(is_enabled);
CREATE INDEX IF NOT EXISTS idx_bots_selected ON bots(is_selected);

