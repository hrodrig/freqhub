/*
 * FreqHub Config Service - Agent Communication
 * Copyright (C) 2025 - 2026  FreqHub Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import axios from 'axios';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import type { FreqtradeConfig } from '../types/freqtrade.js';

export interface AgentHealthResponse {
  status: string;
  service: string;
  configPath: string;
  configExists: boolean;
  botApiUrl: string;
  botReachable: boolean;
  timestamp: string;
}

export interface PullResult {
  success: boolean;
  config?: FreqtradeConfig;
  path?: string;
  error?: string;
}

export interface PushResult {
  success: boolean;
  path?: string;
  reloadResult?: unknown;
  error?: string;
}

/**
 * Check if agent is healthy
 */
export async function checkAgentHealth(agentUrl: string): Promise<AgentHealthResponse | null> {
  try {
    const response = await axios.get(`${agentUrl}/health`, {
      timeout: 5000,
    });
    return response.data;
  } catch (error) {
    logger.debug(`Agent at ${agentUrl} not reachable:`, error instanceof Error ? error.message : error);
    return null;
  }
}

/**
 * Pull config from agent (read from bot's filesystem)
 */
export async function pullConfigFromAgent(agentUrl: string): Promise<PullResult> {
  try {
    logger.info(`Pulling config from agent at ${agentUrl}`);

    const response = await axios.get(`${agentUrl}/config`, {
      headers: {
        'x-api-key': env.API_KEY,
      },
      timeout: 30000,
    });

    if (response.data.status === 'success') {
      return {
        success: true,
        config: response.data.data.config,
        path: response.data.data.path,
      };
    }

    return {
      success: false,
      error: response.data.message || 'Unknown error',
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    
    if (axios.isAxiosError(error) && error.response) {
      return {
        success: false,
        error: error.response.data?.message || message,
      };
    }

    logger.error(`Failed to pull config from agent:`, message);
    return {
      success: false,
      error: message,
    };
  }
}

/**
 * Push config to agent (write to bot's filesystem + optional reload)
 */
export async function pushConfigToAgent(
  agentUrl: string,
  config: FreqtradeConfig,
  options: { reload?: boolean } = { reload: true }
): Promise<PushResult> {
  try {
    logger.info(`Pushing config to agent at ${agentUrl} (reload: ${options.reload})`);

    const response = await axios.post(
      `${agentUrl}/config/push`,
      {
        config,
        reload: options.reload,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': env.API_KEY,
        },
        timeout: 60000, // Longer timeout for reload
      }
    );

    if (response.data.status === 'success') {
      return {
        success: true,
        path: response.data.data.path,
        reloadResult: response.data.data.reload,
      };
    }

    return {
      success: false,
      error: response.data.message || 'Unknown error',
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';

    if (axios.isAxiosError(error) && error.response) {
      return {
        success: false,
        error: error.response.data?.message || message,
      };
    }

    logger.error(`Failed to push config to agent:`, message);
    return {
      success: false,
      error: message,
    };
  }
}

/**
 * Trigger reload_config on bot via agent
 */
export async function reloadViaAgent(agentUrl: string): Promise<{ success: boolean; result?: unknown; error?: string }> {
  try {
    logger.info(`Triggering reload via agent at ${agentUrl}`);

    const response = await axios.post(
      `${agentUrl}/reload`,
      {},
      {
        headers: {
          'x-api-key': env.API_KEY,
        },
        timeout: 30000,
      }
    );

    if (response.data.status === 'success') {
      return {
        success: true,
        result: response.data.data,
      };
    }

    return {
      success: false,
      error: response.data.message || 'Unknown error',
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    
    if (axios.isAxiosError(error) && error.response) {
      return {
        success: false,
        error: error.response.data?.message || message,
      };
    }

    return {
      success: false,
      error: message,
    };
  }
}

/**
 * List backups available on agent
 */
export async function listAgentBackups(agentUrl: string): Promise<{ success: boolean; backups?: Array<{ name: string; path: string }>; error?: string }> {
  try {
    const response = await axios.get(`${agentUrl}/backups`, {
      headers: {
        'x-api-key': env.API_KEY,
      },
      timeout: 10000,
    });

    if (response.data.status === 'success') {
      return {
        success: true,
        backups: response.data.data.backups,
      };
    }

    return {
      success: false,
      error: response.data.message || 'Unknown error',
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
