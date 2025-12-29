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
import { cacheService } from './cache.service.js';
import { proxyRequest } from './proxyService.js';
import { cacheStatsService } from './cacheStats.service.js';
import { appLogger } from '../utils/logger.js';

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
  
  // Invalidate cache when token changes
  invalidateBotCache(id);
}

/**
 * Cache key helpers
 */
function getBotStatusCacheKey(botId: string): string {
  return `bot:${botId}:status`;
}

function getBotBalanceCacheKey(botId: string): string {
  return `bot:${botId}:balance`;
}

function getBotTradesCacheKey(botId: string): string {
  return `bot:${botId}:trades`;
}

function getBotStateCacheKey(botId: string): string {
  return `bot:${botId}:state`;
}

/**
 * Invalidate all cache for a bot
 */
export function invalidateBotCache(botId: string): void {
  const keys = [
    getBotStatusCacheKey(botId),
    getBotBalanceCacheKey(botId),
    getBotTradesCacheKey(botId),
    getBotStateCacheKey(botId),
  ];
  keys.forEach((key) => cacheStatsService.recordInvalidation(key));
  appLogger.debug(`Cache INVALIDATED for bot ${botId}: ${keys.join(', ')}`);
  cacheService.delMultiple(keys).catch(() => {
    // Silent fail - cache is optional
  });
}

/**
 * Get bot status with cache (TTL: 5 seconds)
 */
export async function getBotStatus(botId: string): Promise<unknown> {
  const cacheKey = getBotStatusCacheKey(botId);
  
  // Try cache first
  const cached = await cacheService.get(cacheKey);
  if (cached !== null) {
    cacheStatsService.recordHit(cacheKey);
    appLogger.debug(`Cache HIT: ${cacheKey}`);
    return cached;
  }
  
  cacheStatsService.recordMiss(cacheKey);
  appLogger.debug(`Cache MISS: ${cacheKey} - fetching from API`);
  
  // Fetch from API
  const status = await proxyRequest(botId, 'GET', 'api/v1/status');
  
  // Cache for 5 seconds
  await cacheService.set(cacheKey, status, 5);
  
  return status;
}

/**
 * Get bot balance with cache (TTL: 10 seconds)
 */
export async function getBotBalance(botId: string): Promise<unknown> {
  const cacheKey = getBotBalanceCacheKey(botId);
  
  // Try cache first
  const cached = await cacheService.get(cacheKey);
  if (cached !== null) {
    cacheStatsService.recordHit(cacheKey);
    appLogger.debug(`Cache HIT: ${cacheKey}`);
    return cached;
  }
  
  cacheStatsService.recordMiss(cacheKey);
  appLogger.debug(`Cache MISS: ${cacheKey} - fetching from API`);
  
  // Fetch from API
  const balance = await proxyRequest(botId, 'GET', 'api/v1/balance');
  
  // Cache for 10 seconds
  await cacheService.set(cacheKey, balance, 10);
  
  return balance;
}

/**
 * Get bot trades with cache (TTL: 5 seconds)
 */
export async function getBotTrades(botId: string, limit?: number): Promise<unknown> {
  const cacheKey = `${getBotTradesCacheKey(botId)}:${limit || 'all'}`;
  
  // Try cache first
  const cached = await cacheService.get(cacheKey);
  if (cached !== null) {
    cacheStatsService.recordHit(cacheKey);
    appLogger.debug(`Cache HIT: ${cacheKey}`);
    return cached;
  }
  
  cacheStatsService.recordMiss(cacheKey);
  appLogger.debug(`Cache MISS: ${cacheKey} - fetching from API`);
  
  // Fetch from API
  const path = limit ? `api/v1/trades?limit=${limit}` : 'api/v1/trades';
  const trades = await proxyRequest(botId, 'GET', path);
  
  // Cache for 5 seconds
  await cacheService.set(cacheKey, trades, 5);
  
  return trades;
}

/**
 * Get bot state/config with cache (TTL: 30 seconds)
 */
export async function getBotState(botId: string): Promise<unknown> {
  const cacheKey = getBotStateCacheKey(botId);
  
  // Try cache first
  const cached = await cacheService.get(cacheKey);
  if (cached !== null) {
    cacheStatsService.recordHit(cacheKey);
    appLogger.debug(`Cache HIT: ${cacheKey}`);
    return cached;
  }
  
  cacheStatsService.recordMiss(cacheKey);
  appLogger.debug(`Cache MISS: ${cacheKey} - fetching from API`);
  
  // Fetch from API
  const state = await proxyRequest(botId, 'GET', 'api/v1/show_config');
  
  // Cache for 30 seconds (config changes less frequently)
  await cacheService.set(cacheKey, state, 30);
  
  return state;
}

/**
 * Get multiple bot statuses in batch (with cache)
 */
export async function getMultipleBotStatuses(botIds: string[]): Promise<Map<string, unknown>> {
  const results = new Map<string, unknown>();
  const cacheKeys = botIds.map((id) => getBotStatusCacheKey(id));
  
  // Try to get all from cache
  const cached = await cacheService.mget<unknown>(cacheKeys);
  
  // Fetch missing ones
  const missing: string[] = [];
  botIds.forEach((id, index) => {
    if (cached[index] !== null) {
      results.set(id, cached[index]);
    } else {
      missing.push(id);
    }
  });
  
  // Fetch missing statuses
  if (missing.length > 0) {
    const fetchPromises = missing.map(async (id) => {
      try {
        const status = await getBotStatus(id);
        return { id, status };
      } catch (error) {
        return { id, status: null, error };
      }
    });
    
    const fetched = await Promise.all(fetchPromises);
    fetched.forEach(({ id, status }) => {
      if (status !== null) {
        results.set(id, status);
      }
    });
  }
  
  return results;
}

