/*
 * FreqHub - Multi-bot dashboard for Freqtrade
 * Copyright (C) 2025 - 2026  FreqHub Contributors
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
  notes: string | null;
  configmap_name?: string | null;
  config_path?: string | null;
  created_by: string | null;
  updated_by: string | null;
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
    notes TEXT,
    configmap_name TEXT,
    config_path TEXT,
    created_by TEXT,
    updated_by TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (created_by) REFERENCES users(id),
    FOREIGN KEY (updated_by) REFERENCES users(id)
  );

  CREATE INDEX IF NOT EXISTS idx_bots_enabled ON bots(is_enabled);
  CREATE INDEX IF NOT EXISTS idx_bots_selected ON bots(is_selected);
`;

export interface UserDB {
  id: string;
  username: string;
  name: string | null; // Display name (optional)
  email: string;
  password_hash: string;
  role: 'superadmin' | 'auditor' | 'user';
  is_active: number; // 1 = true, 0 = false
  totp_secret: string | null;
  totp_enabled: number; // 1 = true, 0 = false
  failed_login_attempts: number;
  account_locked_until: number | null;
  last_login: number | null;
  last_login_ip: string | null;
  last_login_device: string | null;
  password_changed_at: number | null;
  must_change_password: number; // 1 = true, 0 = false
  created_at: number;
  updated_at: number;
  created_by: string | null;
}

export interface BotOwnershipDB {
  id: string;
  bot_id: string;
  user_id: string;
  created_at: number;
  created_by: string | null;
}

export interface AuditLogDB {
  id: string;
  user_id: string;
  action: string;
  action_category: 'data_change' | 'data_access' | 'system_action' | 'auth';
  resource_type: string;
  resource_id: string | null;
  old_value: string | null; // JSON string
  new_value: string | null; // JSON string
  changed_fields: string | null; // JSON array
  details: string | null; // JSON string
  ip_address: string | null;
  user_agent: string | null;
  timestamp: number;
}

