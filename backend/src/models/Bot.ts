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

import type { BotDB } from '../db/schema.js';

/**
 * Bot model for frontend (without sensitive data)
 */
export interface Bot {
  id: string;
  name: string;
  apiUrl: string;
  wsUrl: string | null;
  username: string;
  isEnabled: boolean;
  isSelected: boolean;
  notes?: string | null;
  configMapName?: string | null;
  configPath?: string | null;
  createdAt: number;
  updatedAt: number;
}

/**
 * Create Bot request
 */
export interface CreateBotRequest {
  name: string;
  apiUrl: string;
  wsUrl?: string;
  username: string;
  password: string;
  notes?: string;
  configMapName?: string;
  configPath?: string;
}

/**
 * Update Bot request
 */
export interface UpdateBotRequest {
  name?: string;
  apiUrl?: string;
  wsUrl?: string;
  username?: string;
  password?: string;
  isEnabled?: boolean;
  isSelected?: boolean;
  notes?: string;
  configMapName?: string;
  configPath?: string;
}

/**
 * Convert BotDB to Bot (remove sensitive data)
 */
export function botDBToBot(botDB: BotDB): Bot {
  return {
    id: botDB.id,
    name: botDB.name,
    apiUrl: botDB.api_url,
    wsUrl: botDB.ws_url,
    username: botDB.username,
    isEnabled: botDB.is_enabled === 1,
    isSelected: botDB.is_selected === 1,
    // Handle notes field - it might not exist in older databases
    notes: 'notes' in botDB ? (botDB.notes || null) : null,
    configMapName: 'configmap_name' in botDB ? (botDB.configmap_name || null) : null,
    configPath: 'config_path' in botDB ? (botDB.config_path || null) : null,
    createdAt: botDB.created_at,
    updatedAt: botDB.updated_at,
  };
}

/**
 * Convert Bot to BotDB format
 */
export function botToBotDB(bot: Partial<Bot>): Partial<BotDB> {
  const botDB: Partial<BotDB> = {};
  
  if (bot.name !== undefined) botDB.name = bot.name;
  if (bot.apiUrl !== undefined) botDB.api_url = bot.apiUrl;
  if (bot.wsUrl !== undefined) botDB.ws_url = bot.wsUrl;
  if (bot.username !== undefined) botDB.username = bot.username;
  if (bot.isEnabled !== undefined) botDB.is_enabled = bot.isEnabled ? 1 : 0;
  if (bot.isSelected !== undefined) botDB.is_selected = bot.isSelected ? 1 : 0;
  if (bot.notes !== undefined) botDB.notes = bot.notes || null;
  if (bot.configMapName !== undefined) botDB.configmap_name = bot.configMapName || null;
  if (bot.configPath !== undefined) botDB.config_path = bot.configPath || null;
  
  return botDB;
}

