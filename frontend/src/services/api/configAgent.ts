/*
 * FreqHub - Config Agent API client
 * Copyright (C) 2025 - 2026  FreqHub Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import axios, { type AxiosInstance } from 'axios';
import { config } from '../../config/env.js';

interface AgentApiResponse<T = unknown> {
  status: 'success' | 'error';
  data?: T;
  message?: string;
  path?: string;
}

interface AgentConfigPayload {
  config: Record<string, unknown>;
  path: string;
  readAt?: string;
}

interface AgentPushPayload {
  path: string;
  writtenAt: string;
  size: number;
  reload: unknown;
}

function normalizeAgentUrl(url: string): string {
  return url.replace(/\/+$/, '');
}

function getAgentApiKey(): string {
  return (
    localStorage.getItem('config_agent_api_key') ||
    localStorage.getItem('config_service_api_key') ||
    config.configServiceApiKey ||
    ''
  ).trim();
}

function createAgentClient(agentUrl: string): AxiosInstance {
  const baseURL = normalizeAgentUrl(agentUrl);
  const client = axios.create({
    baseURL,
    timeout: 60000,
    headers: {
      'Content-Type': 'application/json',
    },
  });

  client.interceptors.request.use((request) => {
    const apiKey = getAgentApiKey();
    if (apiKey) {
      request.headers['x-api-key'] = apiKey;
    }
    return request;
  });

  return client;
}

export const configAgentApi = {
  async health(agentUrl: string): Promise<{ status: string; service: string; configExists: boolean; botReachable: boolean } | null> {
    try {
      const client = createAgentClient(agentUrl);
      const response = await client.get<AgentApiResponse<{
        status: string;
        service: string;
        configExists: boolean;
        botReachable: boolean;
      }>>('/health');
      return response.data.data || null;
    } catch {
      return null;
    }
  },

  async readConfig(agentUrl: string): Promise<AgentConfigPayload> {
    const client = createAgentClient(agentUrl);
    const response = await client.get<AgentApiResponse<AgentConfigPayload>>('/config');
    if (response.data.status === 'error') {
      throw new Error(response.data.message || 'Failed to read config');
    }
    return response.data.data!;
  },

  async writeConfig(agentUrl: string, configData: Record<string, unknown>): Promise<{ path: string; writtenAt: string; size: number }> {
    const client = createAgentClient(agentUrl);
    const response = await client.put<AgentApiResponse<{ path: string; writtenAt: string; size: number }>>('/config', {
      config: configData,
    });
    if (response.data.status === 'error') {
      throw new Error(response.data.message || 'Failed to write config');
    }
    return response.data.data!;
  },

  async pushConfig(agentUrl: string, configData: Record<string, unknown>, reload = true): Promise<AgentPushPayload> {
    const client = createAgentClient(agentUrl);
    const response = await client.post<AgentApiResponse<AgentPushPayload>>('/config/push', {
      config: configData,
      reload,
    });
    if (response.data.status === 'error') {
      throw new Error(response.data.message || 'Failed to push config');
    }
    return response.data.data!;
  },
};
