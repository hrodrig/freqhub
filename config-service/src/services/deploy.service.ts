/*
 * FreqHub Config Service
 * Copyright (C) 2025 - 2026  FreqHub Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import axios from 'axios';
import { getBotConfigsCollection, getDeploymentsCollection } from '../db/mongo.js';
import { decryptConfig } from '../utils/encryption.js';
import { markAsDeployed } from './config.service.js';
import { getVersion } from './version.service.js';
import { env, getAgentUrls } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { validateSafeId, validateAgentUrl } from '../utils/requestSecurity.js';
import type { Deployment, DeployRequest } from '../types/models.js';
import type { FreqtradeConfig } from '../types/freqtrade.js';

interface BotCredentials {
  apiUrl: string;
  username: string;
  password: string;
}

interface DeployResult {
  success: boolean;
  deployment: Deployment;
  botResponse?: Record<string, unknown>;
  error?: string;
}

/**
 * Get bot credentials from FreqHub Backend
 */
async function getBotCredentials(botId: string): Promise<BotCredentials | null> {
  validateSafeId(botId);
  try {
    const response = await axios.get(`${env.FREQHUB_BACKEND_URL}/api/bots/${botId}/credentials`, {
      headers: {
        'x-api-key': env.FREQHUB_BACKEND_API_KEY || '',
      },
      timeout: 5000,
    });

    return response.data.data;
  } catch (error) {
    logger.error(`Failed to get credentials for bot ${botId}:`, error);
    return null;
  }
}

/**
 * Authenticate with Freqtrade bot and get token
 */
async function authenticateWithBot(apiUrl: string, username: string, password: string): Promise<string | null> {
  validateAgentUrl(apiUrl);
  try {
    const response = await axios.post(
      `${apiUrl}/api/v1/token/login`,
      {},
      {
        auth: { username, password },
        timeout: 10000,
      }
    );

    return response.data.access_token;
  } catch (error) {
    logger.error(`Failed to authenticate with bot at ${apiUrl}:`, error);
    return null;
  }
}

/**
 * Deploy config to bot via agent
 */
async function deployViaAgent(
  agentUrl: string,
  botName: string,
  config: FreqtradeConfig
): Promise<{ success: boolean; response?: Record<string, unknown>; error?: string }> {
  validateAgentUrl(agentUrl);
  validateSafeId(botName);
  try {
    const response = await axios.put(`${agentUrl}/bots/${botName}/config`, config, {
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': env.API_KEY,
      },
      timeout: 30000,
    });

    return { success: true, response: response.data };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: message };
  }
}

/**
 * Trigger reload_config on the bot
 */
async function triggerReloadConfig(
  apiUrl: string,
  token: string
): Promise<{ success: boolean; response?: Record<string, unknown>; error?: string }> {
  validateAgentUrl(apiUrl);
  try {
    const response = await axios.post(
      `${apiUrl}/api/v1/reload_config`,
      {},
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        timeout: 30000,
      }
    );

    return { success: true, response: response.data };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: message };
  }
}

/**
 * Deploy config to a bot
 */
export async function deployConfig(botId: string, request: DeployRequest, userId?: string): Promise<DeployResult> {
  validateSafeId(botId);
  const deploymentsCollection = getDeploymentsCollection();
  const botConfigsCollection = getBotConfigsCollection();

  const startTime = Date.now();

  // Get bot config
  const botConfig = await botConfigsCollection.findOne({ botId });
  if (!botConfig) {
    throw new Error(`Config not found for bot ${botId}`);
  }

  // Determine which version to deploy
  let configToDeploy: FreqtradeConfig;
  let versionNumber: number;

  if (request.version) {
    const version = await getVersion(botId, request.version, false);
    if (!version) {
      throw new Error(`Version ${request.version} not found`);
    }
    configToDeploy = version.config;
    versionNumber = version.version;
  } else {
    configToDeploy = botConfig.currentConfig;
    versionNumber = botConfig.currentVersion;
  }

  // Decrypt config for deployment
  const decryptedConfig = decryptConfig(configToDeploy);

  // Create deployment record
  const deployment: Deployment = {
    botId,
    configVersion: versionNumber,
    status: 'pending',
    method: 'api_reload',
    deployedAt: new Date(),
    deployedBy: userId,
  };

  const insertResult = await deploymentsCollection.insertOne(deployment);
  deployment._id = insertResult.insertedId;

  // Update status to deploying
  await deploymentsCollection.updateOne({ _id: deployment._id }, { $set: { status: 'deploying' } });

  try {
    // Check for agent URL
    const agentUrls = getAgentUrls();
    const agentUrl = agentUrls.get(botId);

    let deployResult: { success: boolean; response?: Record<string, unknown>; error?: string };

    if (agentUrl) {
      // Deploy via agent
      deployment.method = 'agent';
      logger.info(`Deploying config to bot ${botId} via agent at ${agentUrl}`);

      deployResult = await deployViaAgent(agentUrl, botConfig.botName, decryptedConfig);

      if (deployResult.success) {
        // Also trigger reload_config via API
        const credentials = await getBotCredentials(botId);
        if (credentials) {
          const token = await authenticateWithBot(credentials.apiUrl, credentials.username, credentials.password);
          if (token) {
            await triggerReloadConfig(credentials.apiUrl, token);
          }
        }
      }
    } else {
      // No agent - just trigger reload_config (assumes config is already on filesystem)
      logger.info(`Triggering reload_config for bot ${botId} (no agent)`);

      const credentials = await getBotCredentials(botId);
      if (!credentials) {
        throw new Error('Could not get bot credentials');
      }

      const token = await authenticateWithBot(credentials.apiUrl, credentials.username, credentials.password);
      if (!token) {
        throw new Error('Could not authenticate with bot');
      }

      deployResult = await triggerReloadConfig(credentials.apiUrl, token);
    }

    const duration = Date.now() - startTime;

    if (deployResult.success) {
      // Update deployment as successful
      await deploymentsCollection.updateOne(
        { _id: deployment._id },
        {
          $set: {
            status: 'success',
            botResponse: deployResult.response,
            completedAt: new Date(),
            duration,
          },
        }
      );

      // Mark config as deployed
      await markAsDeployed(botId, userId);

      logger.info(`Successfully deployed config to bot ${botId} in ${duration}ms`);

      return {
        success: true,
        deployment: {
          ...deployment,
          status: 'success',
          botResponse: deployResult.response,
          duration,
        },
        botResponse: deployResult.response,
      };
    } else {
      // Update deployment as failed
      await deploymentsCollection.updateOne(
        { _id: deployment._id },
        {
          $set: {
            status: 'failed',
            errorMessage: deployResult.error,
            completedAt: new Date(),
            duration,
          },
        }
      );

      logger.error(`Failed to deploy config to bot ${botId}: ${deployResult.error}`);

      return {
        success: false,
        deployment: {
          ...deployment,
          status: 'failed',
          errorMessage: deployResult.error,
          duration,
        },
        error: deployResult.error,
      };
    }
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    await deploymentsCollection.updateOne(
      { _id: deployment._id },
      {
        $set: {
          status: 'failed',
          errorMessage,
          completedAt: new Date(),
          duration,
        },
      }
    );

    logger.error(`Deploy failed for bot ${botId}: ${errorMessage}`);

    return {
      success: false,
      deployment: {
        ...deployment,
        status: 'failed',
        errorMessage,
        duration,
      },
      error: errorMessage,
    };
  }
}

/**
 * Get deployment history for a bot
 */
export async function getDeployments(botId: string, limit = 50): Promise<Deployment[]> {
  const collection = getDeploymentsCollection();

  return collection.find({ botId }).sort({ deployedAt: -1 }).limit(limit).toArray();
}

/**
 * Get all recent deployments
 */
export async function getAllDeployments(limit = 100): Promise<Deployment[]> {
  const collection = getDeploymentsCollection();

  return collection.find({}).sort({ deployedAt: -1 }).limit(limit).toArray();
}

/**
 * Get deployment by ID
 */
export async function getDeploymentById(deploymentId: string): Promise<Deployment | null> {
  const collection = getDeploymentsCollection();
  const { ObjectId } = await import('mongodb');

  return collection.findOne({ _id: new ObjectId(deploymentId) });
}

/**
 * Bulk deploy to multiple bots
 */
export async function bulkDeploy(
  botIds: string[],
  options: { userId?: string; comment?: string } = {}
): Promise<Map<string, DeployResult>> {
  const results = new Map<string, DeployResult>();

  // Deploy sequentially to avoid overwhelming the bots
  for (const botId of botIds) {
    try {
      const result = await deployConfig(botId, { comment: options.comment }, options.userId);
      results.set(botId, result);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      results.set(botId, {
        success: false,
        deployment: {
          botId,
          configVersion: 0,
          status: 'failed',
          method: 'api_reload',
          errorMessage,
          deployedAt: new Date(),
          deployedBy: options.userId,
        },
        error: errorMessage,
      });
    }

    // Small delay between deployments
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  return results;
}
