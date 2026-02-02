/*
 * FreqHub - Multi-bot dashboard for Freqtrade
 * Copyright (C) 2025 - 2026  FreqHub Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import axios, { type AxiosInstance } from 'axios';
import { config as appConfig } from '../../config/env.js';

/**
 * Config Service API client
 * Connects to the FreqHub Config Service (separate from main backend)
 */

// Types
export interface FreqtradeConfig {
  dry_run: boolean;
  stake_currency: string;
  stake_amount: number | 'unlimited';
  strategy?: string;
  timeframe?: string;
  exchange?: {
    name: string;
    key?: string;
    secret?: string;
  };
  [key: string]: unknown;
}

export interface BotConfig {
  _id?: string;
  botId: string;
  botName: string;
  currentConfig: FreqtradeConfig;
  currentVersion: number;
  draftConfig?: FreqtradeConfig;
  hasPendingChanges: boolean;
  lastDeployedAt?: string;
  lastDeployedBy?: string;
  lastSyncedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ConfigVersion {
  _id?: string;
  botId: string;
  version: number;
  config: FreqtradeConfig;
  changedFields: string[];
  previousValues?: Record<string, unknown>;
  createdAt: string;
  createdBy?: string;
  comment?: string;
  source: 'manual' | 'import' | 'sync' | 'rollback';
}

export interface Deployment {
  _id?: string;
  botId: string;
  configVersion: number;
  status: 'pending' | 'deploying' | 'success' | 'failed' | 'rolled_back';
  method: 'agent' | 'api_reload' | 'manual';
  botResponse?: Record<string, unknown>;
  errorMessage?: string;
  deployedAt: string;
  deployedBy?: string;
  completedAt?: string;
  duration?: number;
}

export interface ConfigDiff {
  field: string;
  oldValue: unknown;
  newValue: unknown;
  type: 'added' | 'removed' | 'changed';
}

export interface ApiResponse<T = unknown> {
  status: 'success' | 'error';
  data?: T;
  message?: string;
  errors?: Array<{ field?: string; message: string }>;
}

// Create config service client
function createConfigServiceClient(): AxiosInstance {
  // Config service URL - defaults to same host, port 3005
  const configServiceUrl = appConfig.configServiceUrl;

  const client = axios.create({
    baseURL: `${configServiceUrl}/api`,
    timeout: 60000, // Longer timeout for sync operations
    headers: {
      'Content-Type': 'application/json',
    },
  });

  // Add API key from env or localStorage
  client.interceptors.request.use((request) => {
    const apiKey = appConfig.configServiceApiKey ||
      localStorage.getItem('config_service_api_key');
    if (apiKey) {
      request.headers['x-api-key'] = apiKey;
    }
    // Forward user ID if available
    const userId = localStorage.getItem('user_id');
    if (userId) {
      request.headers['x-user-id'] = userId;
    }
    return request;
  });

  return client;
}

const configClient = createConfigServiceClient();

// API Functions
export const configServiceApi = {
  // Health check
  async health(): Promise<{ status: string; service: string }> {
    const response = await axios.get(`${appConfig.configServiceUrl}/health`);
    return response.data;
  },

  // === Configs ===
  
  async listConfigs(): Promise<BotConfig[]> {
    const response = await configClient.get<ApiResponse<BotConfig[]>>('/configs');
    return response.data.data || [];
  },

  async getConfig(botId: string): Promise<BotConfig | null> {
    try {
      const response = await configClient.get<ApiResponse<BotConfig>>(`/configs/${botId}`);
      return response.data.data || null;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        return null;
      }
      throw error;
    }
  },

  async createConfig(data: {
    botId: string;
    botName: string;
    config: FreqtradeConfig;
  }): Promise<BotConfig> {
    const response = await configClient.post<ApiResponse<BotConfig>>('/configs', data);
    if (response.data.status === 'error') {
      throw new Error(response.data.message || 'Failed to create config');
    }
    return response.data.data!;
  },

  async updateConfig(
    botId: string,
    data: {
      config?: Partial<FreqtradeConfig>;
      botName?: string;
      applyImmediately?: boolean;
    }
  ): Promise<BotConfig> {
    const response = await configClient.put<ApiResponse<BotConfig>>(`/configs/${botId}`, data);
    if (response.data.status === 'error') {
      throw new Error(response.data.message || 'Failed to update config');
    }
    return response.data.data!;
  },

  async deleteConfig(botId: string): Promise<void> {
    await configClient.delete(`/configs/${botId}`);
  },

  // === Draft ===

  async getDraft(botId: string): Promise<{ draftConfig: FreqtradeConfig; hasPendingChanges: boolean } | null> {
    try {
      const response = await configClient.get<ApiResponse<{ draftConfig: FreqtradeConfig; hasPendingChanges: boolean }>>(
        `/configs/${botId}/draft`
      );
      return response.data.data || null;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        return null;
      }
      throw error;
    }
  },

  async applyDraft(botId: string, comment?: string): Promise<BotConfig> {
    const response = await configClient.post<ApiResponse<BotConfig>>(`/configs/${botId}/draft/apply`, { comment });
    return response.data.data!;
  },

  async discardDraft(botId: string): Promise<BotConfig> {
    const response = await configClient.delete<ApiResponse<BotConfig>>(`/configs/${botId}/draft`);
    return response.data.data!;
  },

  // === Quick Actions ===

  async setRunmode(botId: string, runmode: 'dry_run' | 'live', deploy = false): Promise<BotConfig> {
    const response = await configClient.post<ApiResponse<BotConfig>>(`/configs/${botId}/runmode`, {
      runmode,
      deploy,
    });
    return response.data.data!;
  },

  async quickEdit(botId: string, field: string, value: unknown, deploy = false): Promise<BotConfig> {
    const response = await configClient.post<ApiResponse<BotConfig>>(`/configs/${botId}/quick-edit`, {
      field,
      value,
      deploy,
    });
    return response.data.data!;
  },

  // === Versions ===

  async getVersions(botId: string, limit = 50): Promise<ConfigVersion[]> {
    const response = await configClient.get<ApiResponse<ConfigVersion[]>>(`/configs/${botId}/versions`, {
      params: { limit },
    });
    return response.data.data || [];
  },

  async getVersion(botId: string, version: number): Promise<ConfigVersion | null> {
    try {
      const response = await configClient.get<ApiResponse<ConfigVersion>>(`/configs/${botId}/versions/${version}`);
      return response.data.data || null;
    } catch {
      return null;
    }
  },

  async rollback(botId: string, version: number, deploy = false, comment?: string): Promise<ConfigVersion> {
    const response = await configClient.post<ApiResponse<ConfigVersion>>(`/configs/${botId}/rollback`, {
      version,
      deploy,
      comment,
    });
    return response.data.data!;
  },

  // === Diff ===

  async getDiff(botId: string): Promise<{ diffs: ConfigDiff[] }> {
    const response = await configClient.get<ApiResponse<{ diffs: ConfigDiff[] }>>(`/configs/${botId}/diff`);
    return response.data.data || { diffs: [] };
  },

  async compareVersions(botId: string, v1: number, v2: number): Promise<{ diffs: ConfigDiff[] }> {
    const response = await configClient.get<ApiResponse<{ diffs: ConfigDiff[] }>>(`/configs/${botId}/diff/${v1}/${v2}`);
    return response.data.data || { diffs: [] };
  },

  // === Deploy ===

  async deploy(botId: string, options?: { version?: number; force?: boolean; comment?: string }): Promise<{
    success: boolean;
    deployment: Deployment;
    error?: string;
  }> {
    const response = await configClient.post<ApiResponse<{ success: boolean; deployment: Deployment; error?: string }>>(
      `/configs/${botId}/deploy`,
      options || {}
    );
    return response.data.data!;
  },

  // === Sync (with Agent) ===

  async pull(botId: string, agentUrl: string): Promise<{
    botId: string;
    agentUrl: string;
    path: string;
    syncedAt: string;
    config: FreqtradeConfig;
  }> {
    const response = await configClient.post<ApiResponse<{
      botId: string;
      agentUrl: string;
      path: string;
      syncedAt: string;
      config: FreqtradeConfig;
    }>>(`/sync/${botId}/pull`, { agentUrl });
    if (response.data.status === 'error') {
      throw new Error(response.data.message || 'Failed to pull config');
    }
    return response.data.data!;
  },

  async push(botId: string, agentUrl: string, reload = true): Promise<{
    botId: string;
    agentUrl: string;
    path: string;
    reload: unknown;
    pushedAt: string;
  }> {
    const response = await configClient.post<ApiResponse<{
      botId: string;
      agentUrl: string;
      path: string;
      reload: unknown;
      pushedAt: string;
    }>>(`/sync/${botId}/push`, { agentUrl, reload });
    if (response.data.status === 'error') {
      throw new Error(response.data.message || 'Failed to push config');
    }
    return response.data.data!;
  },

  async checkAgentHealth(botId: string, agentUrl: string): Promise<{
    status: string;
    configExists: boolean;
    botReachable: boolean;
  } | null> {
    try {
      const response = await configClient.get<ApiResponse<{
        status: string;
        configExists: boolean;
        botReachable: boolean;
      }>>(`/sync/${botId}/agent-health`, { params: { agentUrl } });
      return response.data.data || null;
    } catch {
      return null;
    }
  },

  // === Deployments ===

  async listDeployments(limit = 100): Promise<Deployment[]> {
    const response = await configClient.get<ApiResponse<Deployment[]>>('/deployments', {
      params: { limit },
    });
    return response.data.data || [];
  },

  async getBotDeployments(botId: string, limit = 50): Promise<Deployment[]> {
    const response = await configClient.get<ApiResponse<Deployment[]>>(`/deployments/bot/${botId}`, {
      params: { limit },
    });
    return response.data.data || [];
  },
};

export default configServiceApi;
