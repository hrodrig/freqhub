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

import { randomUUID } from 'crypto';
import { getDatabase } from '../db/database.js';

/**
 * Check if a user owns a bot
 */
export function checkBotOwnership(botId: string, userId: string): boolean {
  const db = getDatabase();
  const ownership = db.prepare(`
    SELECT 1 FROM bot_ownership 
    WHERE bot_id = ? AND user_id = ?
  `).get(botId, userId) as { '1': number } | undefined;
  
  return !!ownership;
}

/**
 * Get all bot IDs owned by a user
 */
export function getBotsOwnedByUser(userId: string): string[] {
  const db = getDatabase();
  const bots = db.prepare(`
    SELECT bot_id FROM bot_ownership 
    WHERE user_id = ?
  `).all(userId) as Array<{ bot_id: string }>;
  
  return bots.map(b => b.bot_id);
}

/**
 * Assign bot ownership to a user
 */
export function assignBotOwnership(
  botId: string,
  userId: string,
  assignedBy: string | null = null
): void {
  const db = getDatabase();
  const id = randomUUID();
  const now = Date.now();
  
  // Check if ownership already exists
  const existing = checkBotOwnership(botId, userId);
  if (existing) {
    return; // Already assigned
  }
  
  db.prepare(`
    INSERT INTO bot_ownership (id, bot_id, user_id, created_at, created_by)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, botId, userId, now, assignedBy);
}

/**
 * Remove bot ownership from a user
 */
export function removeBotOwnership(botId: string, userId: string): void {
  const db = getDatabase();
  db.prepare(`
    DELETE FROM bot_ownership 
    WHERE bot_id = ? AND user_id = ?
  `).run(botId, userId);
}

/**
 * Get all users who own a bot
 */
export function getBotOwners(botId: string): string[] {
  const db = getDatabase();
  const owners = db.prepare(`
    SELECT user_id FROM bot_ownership 
    WHERE bot_id = ?
  `).all(botId) as Array<{ user_id: string }>;
  
  return owners.map(o => o.user_id);
}

