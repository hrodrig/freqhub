/*
 * FreqHub - Multi-bot dashboard for Freqtrade
 * Copyright (C) 2025  FreqHub Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

/**
 * Database schema definitions
 */

export interface BotDB {
  id: string;
  name: string;
  api_url: string;
  ws_url: string | null;
  username: string;
  encrypted_password: string;
  access_token: string | null;
  token_expires_at: number | null;
  is_enabled: number; // 1 = true, 0 = false
  is_selected: number; // 1 = true, 0 = false
  created_at: number;
  updated_at: number;
}

export const createBotsTable = `
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
`;

