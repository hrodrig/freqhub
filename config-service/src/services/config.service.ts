/*
 * FreqHub Config Service
 * Copyright (C) 2025 - 2026  FreqHub Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { getBotConfigsCollection } from '../db/mongo.js';
import { encryptConfig, redactConfig } from '../utils/encryption.js';
import { createVersion } from './version.service.js';
import { logger } from '../utils/logger.js';
import type { BotConfig, CreateBotConfigRequest, UpdateBotConfigRequest } from '../types/models.js';
import type { FreqtradeConfig } from '../types/freqtrade.js';

function stripAgentUrl(config: BotConfig): BotConfig {
  const { agentUrl: _agentUrl, ...rest } = config as BotConfig & { agentUrl?: string };
  return rest;
}

/**
 * Get all bot configs
 */
export async function getAllConfigs(redact = true): Promise<BotConfig[]> {
  const collection = getBotConfigsCollection();
  const configs = await collection.find({}).sort({ botName: 1 }).toArray();

  if (redact) {
    return configs.map((c) => stripAgentUrl({
      ...c,
      currentConfig: redactConfig(c.currentConfig),
      draftConfig: c.draftConfig ? redactConfig(c.draftConfig) : undefined,
    }));
  }

  return configs.map(stripAgentUrl);
}

/**
 * Get config by bot ID
 */
export async function getConfigByBotId(botId: string, redact = true): Promise<BotConfig | null> {
  const collection = getBotConfigsCollection();
  const config = await collection.findOne({ botId });

  if (!config) return null;

  if (redact) {
    return stripAgentUrl({
      ...config,
      currentConfig: redactConfig(config.currentConfig),
      draftConfig: config.draftConfig ? redactConfig(config.draftConfig) : undefined,
    });
  }

  return stripAgentUrl(config);
}

/**
 * Create a new bot config
 */
export async function createConfig(request: CreateBotConfigRequest, userId?: string): Promise<BotConfig> {
  const collection = getBotConfigsCollection();

  // Check if config already exists for this bot
  const existing = await collection.findOne({ botId: request.botId });
  if (existing) {
    throw new Error(`Config already exists for bot ${request.botId}`);
  }

  const now = new Date();
  const encryptedConfig = encryptConfig(request.config);

  const botConfig: BotConfig = {
    botId: request.botId,
    botName: request.botName,
    currentConfig: encryptedConfig,
    currentVersion: 1,
    hasPendingChanges: false,
    createdAt: now,
    updatedAt: now,
  };

  await collection.insertOne(botConfig);

  // Create initial version
  await createVersion(request.botId, request.config, {
    comment: 'Initial configuration',
    source: 'manual',
    userId,
  });

  logger.info(`Created config for bot ${request.botId} (${request.botName})`);

  return {
    ...stripAgentUrl(botConfig),
    currentConfig: redactConfig(botConfig.currentConfig),
  };
}

/**
 * Update bot config (creates draft or applies immediately)
 */
export async function updateConfig(
  botId: string,
  request: UpdateBotConfigRequest,
  userId?: string
): Promise<BotConfig> {
  const collection = getBotConfigsCollection();
  const existing = await collection.findOne({ botId });

  if (!existing) {
    throw new Error(`Config not found for bot ${botId}`);
  }

  const now = new Date();
  const updates: Partial<BotConfig> = { updatedAt: now };

  if (request.botName) {
    updates.botName = request.botName;
  }

  if (request.config) {
    // Merge with existing config
    const mergedConfig: FreqtradeConfig = {
      ...existing.currentConfig,
      ...request.config,
    };

    if (request.applyImmediately) {
      // Apply directly to current config
      const encryptedConfig = encryptConfig(mergedConfig);
      updates.currentConfig = encryptedConfig;
      updates.currentVersion = existing.currentVersion + 1;
      updates.draftConfig = undefined;
      updates.hasPendingChanges = false;

      // Create version
      await createVersion(botId, mergedConfig, {
        comment: 'Direct update',
        source: 'manual',
        userId,
        previousConfig: existing.currentConfig,
      });

      logger.info(`Applied config update directly for bot ${botId}`);
    } else {
      // Create draft
      updates.draftConfig = encryptConfig(mergedConfig);
      updates.hasPendingChanges = true;

      logger.info(`Created draft config for bot ${botId}`);
    }
  }

  await collection.updateOne({ botId }, { $set: updates });

  const updated = await getConfigByBotId(botId);
  if (!updated) {
    throw new Error('Failed to retrieve updated config');
  }

  return updated;
}

/**
 * Apply draft config to current
 */
export async function applyDraft(botId: string, userId?: string, comment?: string): Promise<BotConfig> {
  const collection = getBotConfigsCollection();
  const existing = await collection.findOne({ botId });

  if (!existing) {
    throw new Error(`Config not found for bot ${botId}`);
  }

  if (!existing.draftConfig || !existing.hasPendingChanges) {
    throw new Error('No pending changes to apply');
  }

  const now = new Date();
  const newVersion = existing.currentVersion + 1;

  // Create version from draft
  await createVersion(botId, existing.draftConfig, {
    comment: comment || 'Applied draft',
    source: 'manual',
    userId,
    previousConfig: existing.currentConfig,
  });

  await collection.updateOne(
    { botId },
    {
      $set: {
        currentConfig: existing.draftConfig,
        currentVersion: newVersion,
        hasPendingChanges: false,
        updatedAt: now,
      },
      $unset: { draftConfig: '' },
    }
  );

  logger.info(`Applied draft for bot ${botId}, now at version ${newVersion}`);

  const updated = await getConfigByBotId(botId);
  if (!updated) {
    throw new Error('Failed to retrieve updated config');
  }

  return updated;
}

/**
 * Discard draft config
 */
export async function discardDraft(botId: string): Promise<BotConfig> {
  const collection = getBotConfigsCollection();

  await collection.updateOne(
    { botId },
    {
      $set: {
        hasPendingChanges: false,
        updatedAt: new Date(),
      },
      $unset: { draftConfig: '' },
    }
  );

  logger.info(`Discarded draft for bot ${botId}`);

  const updated = await getConfigByBotId(botId);
  if (!updated) {
    throw new Error('Config not found');
  }

  return updated;
}

/**
 * Delete bot config
 */
export async function deleteConfig(botId: string): Promise<boolean> {
  const collection = getBotConfigsCollection();
  const result = await collection.deleteOne({ botId });

  if (result.deletedCount > 0) {
    logger.info(`Deleted config for bot ${botId}`);
    return true;
  }

  return false;
}

/**
 * Quick edit a specific field
 */
export async function quickEdit(
  botId: string,
  field: string,
  value: unknown,
  options: { deploy?: boolean; userId?: string } = {}
): Promise<BotConfig> {
  const collection = getBotConfigsCollection();
  const existing = await collection.findOne({ botId });

  if (!existing) {
    throw new Error(`Config not found for bot ${botId}`);
  }

  // Create partial config update
  const configUpdate: Partial<FreqtradeConfig> = {};

  // Block prototype-polluting keys (CodeQL: prototype-polluting function)
  const blockedKeys = new Set(['__proto__', 'constructor', 'prototype']);
  const keys = field.split('.');
  for (const k of keys) {
    if (blockedKeys.has(k)) {
      throw new Error(`Invalid field: ${k}`);
    }
  }

  // Handle nested fields (e.g., 'exchange.name')
  if (keys.length === 1) {
    (configUpdate as Record<string, unknown>)[field] = value;
  } else {
    let current: Record<string, unknown> = configUpdate as Record<string, unknown>;
    for (let i = 0; i < keys.length - 1; i++) {
      current[keys[i]] = {};
      current = current[keys[i]] as Record<string, unknown>;
    }
    current[keys[keys.length - 1]] = value;
  }

  return updateConfig(
    botId,
    {
      config: configUpdate,
      applyImmediately: options.deploy,
    },
    options.userId
  );
}

/**
 * Set runmode (dry_run or live)
 */
export async function setRunmode(
  botId: string,
  runmode: 'dry_run' | 'live',
  options: { deploy?: boolean; userId?: string } = {}
): Promise<BotConfig> {
  const dryRun = runmode === 'dry_run';

  logger.info(`Setting runmode for bot ${botId} to ${runmode}`);

  return quickEdit(botId, 'dry_run', dryRun, options);
}

/**
 * Import config from JSON
 */
export async function importConfig(
  botId: string,
  botName: string,
  config: FreqtradeConfig,
  userId?: string
): Promise<BotConfig> {
  const collection = getBotConfigsCollection();
  const existing = await collection.findOne({ botId });

  if (existing) {
    // Update existing
    return updateConfig(
      botId,
      {
        config,
        botName,
        applyImmediately: true,
      },
      userId
    );
  } else {
    // Create new
    return createConfig({ botId, botName, config }, userId);
  }
}

/**
 * Mark config as deployed
 */
export async function markAsDeployed(botId: string, userId?: string): Promise<void> {
  const collection = getBotConfigsCollection();

  await collection.updateOne(
    { botId },
    {
      $set: {
        lastDeployedAt: new Date(),
        lastDeployedBy: userId,
      },
    }
  );
}
