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
import type { BotDB } from '../db/schema.js';
import { encryptPassword } from './encryptionService.js';
import { botDBToBot, type Bot, type CreateBotRequest, type UpdateBotRequest } from '../models/Bot.js';
import { cacheService } from './cache.service.js';
import { proxyRequest } from './proxyService.js';
import { cacheStatsService } from './cacheStats.service.js';
import { eventBusService } from './eventBus.service.js';
import { appLogger } from '../utils/logger.js';
import { assertBotApiUrlAllowed, validateBotWsUrl } from '../utils/urlSecurity.js';

/**
 * Get all bots
 */
export function getAllBots(): Bot[] {
  try {
    const db = getDatabase();
    const bots = db.prepare('SELECT * FROM bots ORDER BY created_at DESC').all() as BotDB[];
    return bots.map(botDBToBot);
  } catch (error) {
    appLogger.error('Error getting all bots:', error);
    throw error;
  }
}

/**
 * Get bot by ID
 */
export function getBotById(id: string): Bot | null {
  try {
    const db = getDatabase();
    const bot = db.prepare('SELECT * FROM bots WHERE id = ?').get(id) as BotDB | undefined;
    if (!bot) {
      return null;
    }
    return botDBToBot(bot);
  } catch (error) {
    appLogger.error(`Error getting bot by ID ${id}:`, error);
    throw error;
  }
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

  // SSRF defense-in-depth: validate bot URLs at the service layer as well.
  assertBotApiUrlAllowed(data.apiUrl);
  if (data.wsUrl) {
    const wsValidation = validateBotWsUrl(data.wsUrl);
    if (!wsValidation.ok) {
      throw new Error(wsValidation.reason);
    }
  }
  
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
    notes: data.notes || null,
    configmap_name: data.configMapName?.trim() || null,
    config_path: data.configPath?.trim() || null,
    created_by: null,
    updated_by: null,
    created_at: now,
    updated_at: now,
  };

  const stmt = db.prepare(`
    INSERT INTO bots (
      id, name, api_url, ws_url, username, encrypted_password,
      access_token, token_expires_at, is_enabled, is_selected, notes,
      configmap_name, config_path, created_by, updated_by, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
    botDB.notes,
    botDB.configmap_name,
    botDB.config_path,
    botDB.created_by,
    botDB.updated_by,
    botDB.created_at,
    botDB.updated_at
  );

  const bot = botDBToBot(botDB);
  
  // Publish event
  eventBusService.publish({
    type: 'bot_created',
    botId: bot.id,
    data: bot,
  }).catch(() => {});

  return bot;
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
    assertBotApiUrlAllowed(data.apiUrl);
    updates.push('api_url = ?');
    values.push(data.apiUrl);
  }
  if (data.wsUrl !== undefined) {
    if (data.wsUrl) {
      const wsValidation = validateBotWsUrl(data.wsUrl);
      if (!wsValidation.ok) {
        throw new Error(wsValidation.reason);
      }
    }
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
  if (data.notes !== undefined) {
    updates.push('notes = ?');
    values.push(data.notes || null);
  }
  if (data.configMapName !== undefined) {
    updates.push('configmap_name = ?');
    values.push(data.configMapName?.trim() || null);
  }
  if (data.configPath !== undefined) {
    updates.push('config_path = ?');
    values.push(data.configPath?.trim() || null);
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
  const bot = updated ? botDBToBot(updated) : null;

  if (bot) {
    // Publish event
    eventBusService.publish({
      type: 'bot_updated',
      botId: bot.id,
      data: bot,
    }).catch(() => {});
  }

  return bot;
}

/**
 * Delete a bot
 */
export function deleteBot(id: string): boolean {
  const db = getDatabase();
  const stmt = db.prepare('DELETE FROM bots WHERE id = ?');
  const result = stmt.run(id);
  
  if (result.changes > 0) {
    // Publish event
    eventBusService.publish({
      type: 'bot_deleted',
      botId: id,
      data: { id },
    }).catch(() => {});
  }

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
function getBotOpenTradesCacheKey(botId: string): string {
  return `bot:${botId}:open_trades`;
}

function getBotPingCacheKey(botId: string): string {
  return `bot:${botId}:ping`;
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
    getBotOpenTradesCacheKey(botId),
    getBotPingCacheKey(botId),
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
 * Get bot open trades (Freqtrade /status) with cache (TTL: 5 seconds)
 */
export async function getBotOpenTrades(botId: string): Promise<{ data: unknown; fromCache: boolean }> {
  const cacheKey = getBotOpenTradesCacheKey(botId);
  
  // Try cache first
  const cached = await cacheService.get(cacheKey);
  if (cached !== null) {
    cacheStatsService.recordHit(cacheKey);
    appLogger.info(`[CACHE] HIT: ${cacheKey}`);
    return { data: cached, fromCache: true };
  }
  
  cacheStatsService.recordMiss(cacheKey);
  appLogger.info(`[CACHE] MISS: ${cacheKey} - fetching from API`);
  
  // Fetch from API (skip rate limit for polling service)
  const status = await proxyRequest(botId, 'GET', 'api/v1/status', undefined, true);
  
  // Cache for 5 seconds
  await cacheService.set(cacheKey, status, 5);
  
  // Publish event for real-time updates
  eventBusService.publish({
    type: 'bot_open_trades_update',
    botId,
    data: status,
  }).catch(() => {});
  
  return { data: status, fromCache: false };
}

/**
 * Ping bot to check if it's alive (TTL: 10 seconds)
 */
export async function getBotPing(botId: string): Promise<{ data: unknown; fromCache: boolean }> {
  const cacheKey = getBotPingCacheKey(botId);
  
  // Try cache first
  const cached = await cacheService.get(cacheKey);
  if (cached !== null) {
    cacheStatsService.recordHit(cacheKey);
    appLogger.info(`[CACHE] HIT: ${cacheKey}`);
    return { data: cached, fromCache: true };
  }
  
  cacheStatsService.recordMiss(cacheKey);
  appLogger.info(`[CACHE] MISS: ${cacheKey} - fetching from API`);
  
  // Fetch from API (skip rate limit for polling service)
  const ping = await proxyRequest(botId, 'GET', 'api/v1/ping', undefined, true);
  
  // Cache for 10 seconds
  await cacheService.set(cacheKey, ping, 10);
  
  // Publish event for real-time updates
  eventBusService.publish({
    type: 'bot_ping_update',
    botId,
    data: ping,
  }).catch(() => {});
  
  return { data: ping, fromCache: false };
}

/**
 * Get bot balance with cache (TTL: 10 seconds)
 */
export async function getBotBalance(botId: string): Promise<{ data: unknown; fromCache: boolean }> {
  const cacheKey = getBotBalanceCacheKey(botId);
  
  // Try cache first
  const cached = await cacheService.get(cacheKey);
  if (cached !== null) {
    cacheStatsService.recordHit(cacheKey);
    appLogger.info(`[CACHE] HIT: ${cacheKey}`);
    return { data: cached, fromCache: true };
  }
  
  cacheStatsService.recordMiss(cacheKey);
  appLogger.info(`[CACHE] MISS: ${cacheKey} - fetching from API`);
  
  // Fetch from API (skip rate limit for polling service)
  const balance = await proxyRequest(botId, 'GET', 'api/v1/balance', undefined, true);
  
  // Cache for 10 seconds
  await cacheService.set(cacheKey, balance, 10);
  
  // Publish event for real-time updates
  eventBusService.publish({
    type: 'bot_balance_update',
    botId,
    data: balance,
  }).catch(() => {});
  
  return { data: balance, fromCache: false };
}

/**
 * Get bot trades with cache (TTL: 5 seconds)
 */
export async function getBotTrades(botId: string, limit?: number): Promise<{ data: unknown; fromCache: boolean }> {
  const cacheKey = `${getBotTradesCacheKey(botId)}:${limit || 'all'}`;
  
  // Try cache first
  const cached = await cacheService.get(cacheKey);
  if (cached !== null) {
    cacheStatsService.recordHit(cacheKey);
    appLogger.info(`[CACHE] HIT: ${cacheKey}`);
    return { data: cached, fromCache: true };
  }
  
  cacheStatsService.recordMiss(cacheKey);
  appLogger.info(`[CACHE] MISS: ${cacheKey} - fetching from API`);
  
  // Fetch from API (skip rate limit for polling service)
  const path = limit ? `api/v1/trades?limit=${limit}` : 'api/v1/trades';
  const trades = await proxyRequest(botId, 'GET', path, undefined, true);
  
  // Cache for 5 seconds
  await cacheService.set(cacheKey, trades, 5);
  
  // Publish event for real-time updates
  eventBusService.publish({
    type: 'bot_trades_update',
    botId,
    data: trades,
  }).catch(() => {});
  
  return { data: trades, fromCache: false };
}

/**
 * Get bot state/config with cache (TTL: 30 seconds)
 */
export async function getBotState(botId: string): Promise<{ data: unknown; fromCache: boolean }> {
  const cacheKey = getBotStateCacheKey(botId);
  
  // Try cache first
  const cached = await cacheService.get(cacheKey);
  if (cached !== null) {
    cacheStatsService.recordHit(cacheKey);
    appLogger.info(`[CACHE] HIT: ${cacheKey}`);
    return { data: cached, fromCache: true };
  }
  
  cacheStatsService.recordMiss(cacheKey);
  appLogger.info(`[CACHE] MISS: ${cacheKey} - fetching from API`);
  
  // Fetch from API (skip rate limit for polling service)
  const state = await proxyRequest(botId, 'GET', 'api/v1/show_config', undefined, true);
  
  // Cache for 30 seconds (config changes less frequently)
  await cacheService.set(cacheKey, state, 30);
  
  // Publish event for real-time updates
  eventBusService.publish({
    type: 'bot_state_update',
    botId,
    data: state,
  }).catch(() => {});
  
  return { data: state, fromCache: false };
}

/**
 * Get multiple bot health summary in batch
 */
export async function getMultipleBotStatuses(botIds: string[]): Promise<Map<string, any>> {
  const results = new Map<string, any>();
  
  if (botIds.length === 0) {
    return results;
  }

  const fetchPromises = botIds.map(async (id) => {
    try {
      const [pingResult, openTradesResult] = await Promise.all([
        getBotPing(id),
        getBotOpenTrades(id)
      ]);
      
      return { 
        id, 
        health: pingResult.data, 
        open_trades_count: Array.isArray(openTradesResult.data) ? openTradesResult.data.length : 0,
        status: 'online'
      };
    } catch (error) {
      return { 
        id, 
        status: 'offline', 
        error: error instanceof Error ? error.message : 'Unreachable' 
      };
    }
  });
  
  const summary = await Promise.all(fetchPromises);
  summary.forEach((item) => {
    results.set(item.id, item);
  });
  
  return results;
}

