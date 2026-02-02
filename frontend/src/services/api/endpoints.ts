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

import { apiClient } from './client.js';
import type { Bot, BotImportResult, CreateBotRequest, UpdateBotRequest } from '../../types/bot.js';

/**
 * API endpoints for bots
 */
export const botApi = {
  /**
   * Get all bots
   */
  getAll: async (): Promise<Bot[]> => {
    const response = await apiClient.get<{ status: string; data: Bot[] }>('/bots');
    return response.data.data;
  },

  /**
   * Get bot by ID
   */
  getById: async (id: string): Promise<Bot> => {
    const response = await apiClient.get<{ status: string; data: Bot }>(`/bots/${id}`);
    return response.data.data;
  },

  /**
   * Create a new bot
   */
  create: async (data: CreateBotRequest): Promise<Bot> => {
    const response = await apiClient.post<{ status: string; data: Bot }>('/bots', data);
    return response.data.data;
  },

  /**
   * Update a bot
   */
  update: async (id: string, data: UpdateBotRequest): Promise<Bot> => {
    const response = await apiClient.put<{ status: string; data: Bot }>(`/bots/${id}`, data);
    return response.data.data;
  },

  /**
   * Delete a bot
   */
  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/bots/${id}`);
  },

  /**
   * Test bot connection
   */
  testConnection: async (id: string): Promise<{ status: string; message: string }> => {
    const response = await apiClient.post<{ status: string; message: string }>(
      `/bots/${id}/test`
    );
    return response.data;
  },

  /**
   * Update bot runmode (dry_run/live)
   */
  setRunmode: async (id: string, runmode: 'dry_run' | 'live'): Promise<{ runmode: string; previousRunmode: string | null }> => {
    const response = await apiClient.post<{ status: string; data: { runmode: string; previousRunmode: string | null } }>(
      `/bots/${id}/runmode`,
      { runmode }
    );
    return response.data.data;
  },

  /**
   * Import bots from XLSX
   */
  importBots: async (file: File): Promise<BotImportResult> => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await apiClient.post<{ status: string; data: BotImportResult }>(
      '/bots/import',
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    );
    return response.data.data;
  },

  /**
   * Export bots to XLSX
   */
  exportBots: async (): Promise<Blob> => {
    const response = await apiClient.get('/bots/export', { responseType: 'blob' });
    return response.data as Blob;
  },
};

/**
 * Proxy API endpoints (for Freqtrade API)
 */
export const proxyApi = {
  /**
   * Proxy GET request to Freqtrade
   */
  get: async (botId: string, path: string): Promise<unknown> => {
    const response = await apiClient.get(`/bots/${botId}/proxy/${path}`);
    return response.data;
  },

  /**
   * Proxy POST request to Freqtrade
   */
  post: async (botId: string, path: string, data?: unknown): Promise<unknown> => {
    const response = await apiClient.post(`/bots/${botId}/proxy/${path}`, data);
    return response.data;
  },

  /**
   * Proxy PUT request to Freqtrade
   */
  put: async (botId: string, path: string, data?: unknown): Promise<unknown> => {
    const response = await apiClient.put(`/bots/${botId}/proxy/${path}`, data);
    return response.data;
  },

  /**
   * Proxy DELETE request to Freqtrade
   */
  delete: async (botId: string, path: string): Promise<unknown> => {
    const response = await apiClient.delete(`/bots/${botId}/proxy/${path}`);
    return response.data;
  },
};

/**
 * Health check endpoint
 */
export const healthApi = {
  check: async (): Promise<{ status: string; timestamp: string; uptime: number; database: string }> => {
    const response = await apiClient.get('/health/health');
    return response.data;
  },
};
