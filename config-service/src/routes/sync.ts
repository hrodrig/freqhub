/*
 * FreqHub Config Service - Sync Routes
 * Copyright (C) 2025 - 2026  FreqHub Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { getBotConfigsCollection } from '../db/mongo.js';
import * as agentService from '../services/agent.service.js';
import { encryptConfig, redactConfig } from '../utils/encryption.js';
import { createVersion } from '../services/version.service.js';
import { logger } from '../utils/logger.js';

const router = Router();

interface BotIdParams {
  botId: string;
}

type AuthRequest<P = Record<string, string>> = Request<P> & { userId?: string };

const syncSchema = z.object({
  agentUrl: z.string().url(),
});

/**
 * @route POST /api/sync/:botId/pull
 * @desc Pull config from bot via agent and save to MongoDB
 */
router.post('/:botId/pull', async (req: AuthRequest<BotIdParams>, res: Response) => {
  try {
    const { botId } = req.params;
    const { agentUrl } = syncSchema.parse(req.body);

    logger.info(`Pulling config for bot ${botId} from agent at ${agentUrl}`);

    // Pull config from agent
    const pullResult = await agentService.pullConfigFromAgent(agentUrl);

    if (!pullResult.success || !pullResult.config) {
      return res.status(500).json({
        status: 'error',
        message: pullResult.error || 'Failed to pull config from agent',
      });
    }

    // Check if we have existing config
    const collection = getBotConfigsCollection();
    const existing = await collection.findOne({ botId });

    const encryptedConfig = encryptConfig(pullResult.config);
    const now = new Date();

    if (existing) {
      // Update existing config
      await createVersion(botId, pullResult.config, {
        comment: 'Synced from bot',
        source: 'sync',
        userId: req.userId,
        previousConfig: existing.currentConfig,
      });

      await collection.updateOne(
        { botId },
        {
          $set: {
            currentConfig: encryptedConfig,
            currentVersion: existing.currentVersion + 1,
            lastSyncedAt: now,
            updatedAt: now,
            agentUrl,
          },
        }
      );

      logger.info(`Updated config for bot ${botId} from agent`);
    } else {
      // Create new config entry
      await collection.insertOne({
        botId,
        botName: botId, // Will be updated later
        currentConfig: encryptedConfig,
        currentVersion: 1,
        hasPendingChanges: false,
        agentUrl,
        lastSyncedAt: now,
        createdAt: now,
        updatedAt: now,
      });

      await createVersion(botId, pullResult.config, {
        comment: 'Initial sync from bot',
        source: 'sync',
        userId: req.userId,
      });

      logger.info(`Created config for bot ${botId} from agent`);
    }

    return res.json({
      status: 'success',
      data: {
        botId,
        agentUrl,
        path: pullResult.path,
        syncedAt: now.toISOString(),
        config: redactConfig(pullResult.config),
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        status: 'error',
        message: 'Validation error',
        errors: error.errors,
      });
    }
    logger.error('Failed to pull config:', error);
    return res.status(500).json({
      status: 'error',
      message: error instanceof Error ? error.message : 'Failed to pull config',
    });
  }
});

/**
 * @route POST /api/sync/:botId/push
 * @desc Push config from MongoDB to bot via agent
 */
router.post('/:botId/push', async (req: AuthRequest<BotIdParams>, res: Response) => {
  try {
    const { botId } = req.params;
    const { agentUrl, reload = true } = req.body as { agentUrl?: string; reload?: boolean };

    if (!agentUrl) {
      return res.status(400).json({
        status: 'error',
        message: 'agentUrl required',
      });
    }

    logger.info(`Pushing config for bot ${botId} to agent at ${agentUrl}`);

    // Get config from MongoDB
    const collection = getBotConfigsCollection();
    const botConfig = await collection.findOne({ botId });

    if (!botConfig) {
      return res.status(404).json({
        status: 'error',
        message: 'Config not found for this bot',
      });
    }

    // Import decrypt function
    const { decryptConfig } = await import('../utils/encryption.js');
    const decryptedConfig = decryptConfig(botConfig.currentConfig);

    // Push to agent
    const pushResult = await agentService.pushConfigToAgent(agentUrl, decryptedConfig, { reload });

    if (!pushResult.success) {
      return res.status(500).json({
        status: 'error',
        message: pushResult.error || 'Failed to push config to agent',
      });
    }

    // Update last deployed timestamp
    await collection.updateOne(
      { botId },
      {
        $set: {
          lastDeployedAt: new Date(),
          lastDeployedBy: req.userId,
          agentUrl,
        },
      }
    );

    return res.json({
      status: 'success',
      data: {
        botId,
        agentUrl,
        path: pushResult.path,
        reload: pushResult.reloadResult,
        pushedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    logger.error('Failed to push config:', error);
    return res.status(500).json({
      status: 'error',
      message: error instanceof Error ? error.message : 'Failed to push config',
    });
  }
});

/**
 * @route GET /api/sync/:botId/agent-health
 * @desc Check agent health for a bot
 */
router.get('/:botId/agent-health', async (req: Request<BotIdParams>, res: Response) => {
  try {
    const { botId } = req.params;
    const agentUrl = req.query.agentUrl as string | undefined;

    if (!agentUrl) {
      // Try to get from stored config
      const collection = getBotConfigsCollection();
      const botConfig = await collection.findOne({ botId });

      if (!botConfig?.agentUrl) {
        return res.status(400).json({
          status: 'error',
          message: 'agentUrl required (not stored for this bot)',
        });
      }

      const health = await agentService.checkAgentHealth(botConfig.agentUrl);
      return res.json({
        status: health ? 'success' : 'error',
        data: health,
        agentUrl: botConfig.agentUrl,
      });
    }

    const health = await agentService.checkAgentHealth(agentUrl);
    return res.json({
      status: health ? 'success' : 'error',
      data: health,
      agentUrl,
    });
  } catch (error) {
    return res.status(500).json({
      status: 'error',
      message: error instanceof Error ? error.message : 'Failed to check agent health',
    });
  }
});

/**
 * @route GET /api/sync/:botId/backups
 * @desc List backups on agent
 */
router.get('/:botId/backups', async (req: Request<BotIdParams>, res: Response) => {
  try {
    const { botId } = req.params;
    const agentUrl = req.query.agentUrl as string | undefined;

    if (!agentUrl) {
      const collection = getBotConfigsCollection();
      const botConfig = await collection.findOne({ botId });

      if (!botConfig?.agentUrl) {
        return res.status(400).json({
          status: 'error',
          message: 'agentUrl required',
        });
      }

      const result = await agentService.listAgentBackups(botConfig.agentUrl);
      return res.json({
        status: result.success ? 'success' : 'error',
        data: result.backups,
        error: result.error,
      });
    }

    const result = await agentService.listAgentBackups(agentUrl);
    return res.json({
      status: result.success ? 'success' : 'error',
      data: result.backups,
      error: result.error,
    });
  } catch (error) {
    return res.status(500).json({
      status: 'error',
      message: error instanceof Error ? error.message : 'Failed to list backups',
    });
  }
});

export default router;
