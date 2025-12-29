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

import { randomUUID } from 'crypto';
import { getDatabase } from '../db/database.js';
import type { BotDB } from '../db/schema.js';
import { encryptPassword } from './encryptionService.js';
import { botDBToBot, type Bot, type CreateBotRequest, type UpdateBotRequest } from '../models/Bot.js';

/**
 * Get all bots
 */
export function getAllBots(): Bot[] {
  const db = getDatabase();
  const bots = db.prepare('SELECT * FROM bots ORDER BY created_at DESC').all() as BotDB[];
  return bots.map(botDBToBot);
}

/**
 * Get bot by ID
 */
export function getBotById(id: string): Bot | null {
  const db = getDatabase();
  const bot = db.prepare('SELECT * FROM bots WHERE id = ?').get(id) as BotDB | undefined;
  return bot ? botDBToBot(bot) : null;
}

/**
 * Get bot with credentials (for internal use only)
 */
export function getBotWithCredentials(id: string): BotDB | null {
  const db = getDatabase();
  const bot = db.prepare('SELECT * FROM bots WHERE id = ?').get(id) as BotDB | undefined;
  return bot || null;
}

/**
 * Create a new bot
 */
export async function createBot(data: CreateBotRequest): Promise<Bot> {
  const db = getDatabase();
  const id = randomUUID();
  const now = Date.now();
  
  // Encrypt password (reversible encryption for re-authentication)
  const encryptedPassword = encryptPassword(data.password);
  
  const botDB: BotDB = {
    id,
    name: data.name,
    api_url: data.apiUrl,
    ws_url: data.wsUrl || null,
    username: data.username,
    encrypted_password: encryptedPassword,
    access_token: null,
    token_expires_at: null,
    is_enabled: 1,
    is_selected: 0,
    created_at: now,
    updated_at: now,
  };

  const stmt = db.prepare(`
    INSERT INTO bots (
      id, name, api_url, ws_url, username, encrypted_password,
      access_token, token_expires_at, is_enabled, is_selected,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    botDB.id,
    botDB.name,
    botDB.api_url,
    botDB.ws_url,
    botDB.username,
    botDB.encrypted_password,
    botDB.access_token,
    botDB.token_expires_at,
    botDB.is_enabled,
    botDB.is_selected,
    botDB.created_at,
    botDB.updated_at
  );

  return botDBToBot(botDB);
}

/**
 * Update a bot
 */
export async function updateBot(id: string, data: UpdateBotRequest): Promise<Bot | null> {
  const db = getDatabase();
  const existing = getBotWithCredentials(id);
  
  if (!existing) {
    return null;
  }

  const updates: string[] = [];
  const values: unknown[] = [];

  if (data.name !== undefined) {
    updates.push('name = ?');
    values.push(data.name);
  }
  if (data.apiUrl !== undefined) {
    updates.push('api_url = ?');
    values.push(data.apiUrl);
  }
  if (data.wsUrl !== undefined) {
    updates.push('ws_url = ?');
    values.push(data.wsUrl);
  }
  if (data.username !== undefined) {
    updates.push('username = ?');
    values.push(data.username);
  }
  if (data.password !== undefined) {
    const encryptedPassword = encryptPassword(data.password);
    updates.push('encrypted_password = ?');
    values.push(encryptedPassword);
  }
  if (data.isEnabled !== undefined) {
    updates.push('is_enabled = ?');
    values.push(data.isEnabled ? 1 : 0);
  }
  if (data.isSelected !== undefined) {
    updates.push('is_selected = ?');
    values.push(data.isSelected ? 1 : 0);
  }

  if (updates.length === 0) {
    return botDBToBot(existing);
  }

  updates.push('updated_at = ?');
  values.push(Date.now());
  values.push(id);

  const stmt = db.prepare(`
    UPDATE bots SET ${updates.join(', ')} WHERE id = ?
  `);

  stmt.run(...values);

  const updated = getBotWithCredentials(id);
  return updated ? botDBToBot(updated) : null;
}

/**
 * Delete a bot
 */
export function deleteBot(id: string): boolean {
  const db = getDatabase();
  const stmt = db.prepare('DELETE FROM bots WHERE id = ?');
  const result = stmt.run(id);
  return result.changes > 0;
}

/**
 * Update bot token
 */
export function updateBotToken(id: string, token: string | null, expiresAt: number | null): void {
  const db = getDatabase();
  const stmt = db.prepare(`
    UPDATE bots 
    SET access_token = ?, token_expires_at = ?, updated_at = ?
    WHERE id = ?
  `);
  stmt.run(token, expiresAt, Date.now(), id);
}

