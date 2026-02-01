/*
 * FreqHub Config Service
 * Copyright (C) 2025 - 2026  FreqHub Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { getConfigVersionsCollection, getBotConfigsCollection } from '../db/mongo.js';
import { encryptConfig, redactConfig } from '../utils/encryption.js';
import { computeDiff } from './diff.service.js';
import { logger } from '../utils/logger.js';
import type { ConfigVersion } from '../types/models.js';
import type { FreqtradeConfig } from '../types/freqtrade.js';

interface CreateVersionOptions {
  comment?: string;
  source: 'manual' | 'import' | 'sync' | 'rollback';
  userId?: string;
  previousConfig?: FreqtradeConfig;
}

/**
 * Create a new config version
 */
export async function createVersion(
  botId: string,
  config: FreqtradeConfig,
  options: CreateVersionOptions
): Promise<ConfigVersion> {
  const collection = getConfigVersionsCollection();

  // Get the latest version number
  const latestVersion = await collection.findOne({ botId }, { sort: { version: -1 } });
  const newVersionNumber = (latestVersion?.version || 0) + 1;

  // Compute changed fields if we have previous config
  let changedFields: string[] = [];
  let previousValues: Record<string, unknown> | undefined;

  if (options.previousConfig) {
    const diffs = computeDiff(options.previousConfig, config);
    changedFields = diffs.map((d) => d.field);
    previousValues = {};
    for (const diff of diffs) {
      previousValues[diff.field] = diff.oldValue;
    }
  }

  const encryptedConfig = encryptConfig(config);

  const version: ConfigVersion = {
    botId,
    version: newVersionNumber,
    config: encryptedConfig,
    changedFields,
    previousValues,
    createdAt: new Date(),
    createdBy: options.userId,
    comment: options.comment,
    source: options.source,
  };

  await collection.insertOne(version);

  logger.debug(`Created version ${newVersionNumber} for bot ${botId}`);

  return {
    ...version,
    config: redactConfig(version.config),
  };
}

/**
 * Get all versions for a bot
 */
export async function getVersions(botId: string, limit = 50): Promise<ConfigVersion[]> {
  const collection = getConfigVersionsCollection();

  const versions = await collection.find({ botId }).sort({ version: -1 }).limit(limit).toArray();

  return versions.map((v) => ({
    ...v,
    config: redactConfig(v.config),
  }));
}

/**
 * Get a specific version
 */
export async function getVersion(botId: string, version: number, redact = true): Promise<ConfigVersion | null> {
  const collection = getConfigVersionsCollection();

  const versionDoc = await collection.findOne({ botId, version });

  if (!versionDoc) return null;

  if (redact) {
    return {
      ...versionDoc,
      config: redactConfig(versionDoc.config),
    };
  }

  return versionDoc;
}

/**
 * Get the latest version for a bot
 */
export async function getLatestVersion(botId: string, redact = true): Promise<ConfigVersion | null> {
  const collection = getConfigVersionsCollection();

  const version = await collection.findOne({ botId }, { sort: { version: -1 } });

  if (!version) return null;

  if (redact) {
    return {
      ...version,
      config: redactConfig(version.config),
    };
  }

  return version;
}

/**
 * Rollback to a specific version
 */
export async function rollbackToVersion(
  botId: string,
  targetVersion: number,
  options: { userId?: string; comment?: string } = {}
): Promise<ConfigVersion> {
  const collection = getConfigVersionsCollection();
  const botConfigsCollection = getBotConfigsCollection();

  // Get the target version
  const targetVersionDoc = await collection.findOne({ botId, version: targetVersion });
  if (!targetVersionDoc) {
    throw new Error(`Version ${targetVersion} not found for bot ${botId}`);
  }

  // Get current config
  const currentConfig = await botConfigsCollection.findOne({ botId });
  if (!currentConfig) {
    throw new Error(`Config not found for bot ${botId}`);
  }

  // Create new version from rollback
  const newVersion = await createVersion(botId, targetVersionDoc.config, {
    comment: options.comment || `Rollback to version ${targetVersion}`,
    source: 'rollback',
    userId: options.userId,
    previousConfig: currentConfig.currentConfig,
  });

  // Update current config
  await botConfigsCollection.updateOne(
    { botId },
    {
      $set: {
        currentConfig: targetVersionDoc.config,
        currentVersion: newVersion.version,
        hasPendingChanges: false,
        updatedAt: new Date(),
      },
      $unset: { draftConfig: '' },
    }
  );

  logger.info(`Rolled back bot ${botId} to version ${targetVersion}, created version ${newVersion.version}`);

  return newVersion;
}

/**
 * Compare two versions
 */
export async function compareVersions(
  botId: string,
  version1: number,
  version2: number
): Promise<{ diffs: ReturnType<typeof computeDiff>; version1Doc: ConfigVersion; version2Doc: ConfigVersion }> {
  const v1 = await getVersion(botId, version1, false);
  const v2 = await getVersion(botId, version2, false);

  if (!v1) throw new Error(`Version ${version1} not found`);
  if (!v2) throw new Error(`Version ${version2} not found`);

  const diffs = computeDiff(v1.config, v2.config);

  return {
    diffs,
    version1Doc: { ...v1, config: redactConfig(v1.config) },
    version2Doc: { ...v2, config: redactConfig(v2.config) },
  };
}

/**
 * Delete old versions (keep last N)
 */
export async function pruneVersions(botId: string, keepCount = 100): Promise<number> {
  const collection = getConfigVersionsCollection();

  // Get versions to keep
  const versionsToKeep = await collection
    .find({ botId })
    .sort({ version: -1 })
    .limit(keepCount)
    .project({ version: 1 })
    .toArray();

  const keepVersionNumbers = versionsToKeep.map((v) => v.version);

  if (keepVersionNumbers.length < keepCount) {
    // Not enough versions to prune
    return 0;
  }

  const minVersionToKeep = Math.min(...keepVersionNumbers);

  const result = await collection.deleteMany({
    botId,
    version: { $lt: minVersionToKeep },
  });

  if (result.deletedCount > 0) {
    logger.info(`Pruned ${result.deletedCount} old versions for bot ${botId}`);
  }

  return result.deletedCount;
}
