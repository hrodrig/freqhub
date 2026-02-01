/*
 * FreqHub Config Service
 * Copyright (C) 2025 - 2026  FreqHub Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { MongoClient, Db, Collection } from 'mongodb';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import type { BotConfig, ConfigVersion, Deployment } from '../types/models.js';

let client: MongoClient | null = null;
let db: Db | null = null;

export async function connectToMongo(): Promise<Db> {
  if (db) return db;

  try {
    client = new MongoClient(env.MONGODB_URI);
    await client.connect();

    db = client.db(env.MONGODB_DATABASE);

    // Create indexes
    await createIndexes(db);

    logger.info(`Connected to MongoDB: ${env.MONGODB_DATABASE}`);
    return db;
  } catch (error) {
    logger.error('Failed to connect to MongoDB:', error);
    throw error;
  }
}

export async function disconnectFromMongo(): Promise<void> {
  if (client) {
    await client.close();
    client = null;
    db = null;
    logger.info('Disconnected from MongoDB');
  }
}

export function getDb(): Db {
  if (!db) {
    throw new Error('Database not connected. Call connectToMongo() first.');
  }
  return db;
}

// Collection accessors
export function getBotConfigsCollection(): Collection<BotConfig> {
  return getDb().collection<BotConfig>('bot_configs');
}

export function getConfigVersionsCollection(): Collection<ConfigVersion> {
  return getDb().collection<ConfigVersion>('config_versions');
}

export function getDeploymentsCollection(): Collection<Deployment> {
  return getDb().collection<Deployment>('deployments');
}

async function createIndexes(database: Db): Promise<void> {
  // bot_configs indexes
  const botConfigs = database.collection('bot_configs');
  await botConfigs.createIndex({ botId: 1 }, { unique: true });
  await botConfigs.createIndex({ botName: 1 });
  await botConfigs.createIndex({ updatedAt: -1 });

  // config_versions indexes
  const configVersions = database.collection('config_versions');
  await configVersions.createIndex({ botId: 1, version: -1 });
  await configVersions.createIndex({ botId: 1, createdAt: -1 });

  // deployments indexes
  const deployments = database.collection('deployments');
  await deployments.createIndex({ botId: 1, deployedAt: -1 });
  await deployments.createIndex({ status: 1 });
  await deployments.createIndex({ deployedAt: -1 });

  logger.debug('MongoDB indexes created');
}
