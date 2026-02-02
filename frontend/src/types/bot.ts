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
 * Bot type for frontend (without sensitive data)
 */
export interface Bot {
  id: string;
  name: string;
  apiUrl: string;
  wsUrl: string | null;
  agentUrl?: string | null;
  username: string;
  notes?: string;
  isEnabled: boolean;
  isSelected: boolean;
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
  agentUrl?: string;
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
  agentUrl?: string;
  username?: string;
  password?: string;
  notes?: string;
  isEnabled?: boolean;
  isSelected?: boolean;
  configMapName?: string;
  configPath?: string;
}

export interface BotImportError {
  row: number;
  message: string;
  identifier?: string;
}

export interface BotImportResult {
  total: number;
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  errors: BotImportError[];
}

