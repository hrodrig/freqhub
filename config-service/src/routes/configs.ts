/*
 * FreqHub Config Service
 * Copyright (C) 2025 - 2026  FreqHub Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import * as configService from '../services/config.service.js';
import * as versionService from '../services/version.service.js';
import * as deployService from '../services/deploy.service.js';
import { computeDiff } from '../services/diff.service.js';
import { getBotConfigsCollection } from '../db/mongo.js';
import { logger } from '../utils/logger.js';

const router = Router();

// Typed params
interface BotIdParams {
  botId: string;
}

interface VersionParams extends BotIdParams {
  version: string;
}

interface DiffParams extends BotIdParams {
  v1: string;
  v2: string;
}

// Request with userId
type AuthRequest<P = Record<string, string>> = Request<P> & { userId?: string };

// Validation schemas
const createConfigSchema = z.object({
  botId: z.string().uuid(),
  botName: z.string().min(1),
  config: z.record(z.unknown()),
});

const updateConfigSchema = z.object({
  config: z.record(z.unknown()).optional(),
  botName: z.string().min(1).optional(),
  applyImmediately: z.boolean().optional(),
});

const quickEditSchema = z.object({
  field: z.string().min(1),
  value: z.unknown(),
  deploy: z.boolean().optional(),
});

const runmodeSchema = z.object({
  runmode: z.enum(['dry_run', 'live']),
  deploy: z.boolean().optional(),
});

const deploySchema = z.object({
  version: z.number().int().positive().optional(),
  force: z.boolean().optional(),
  comment: z.string().optional(),
});

const rollbackSchema = z.object({
  version: z.number().int().positive(),
  deploy: z.boolean().optional(),
  comment: z.string().optional(),
});

/**
 * @route GET /api/configs
 * @desc List all bot configs
 */
router.get('/', async (_req: Request, res: Response) => {
  try {
    const configs = await configService.getAllConfigs();
    res.json({ status: 'success', data: configs });
  } catch (error) {
    logger.error('Failed to get configs:', error);
    res.status(500).json({
      status: 'error',
      message: error instanceof Error ? error.message : 'Failed to get configs',
    });
  }
});

/**
 * @route GET /api/configs/:botId
 * @desc Get config for a specific bot
 */
router.get('/:botId', async (req: Request<BotIdParams>, res: Response) => {
  try {
    const config = await configService.getConfigByBotId(req.params.botId);
    if (!config) {
      return res.status(404).json({
        status: 'error',
        message: 'Config not found',
      });
    }
    return res.json({ status: 'success', data: config });
  } catch (error) {
    logger.error('Failed to get config:', error);
    return res.status(500).json({
      status: 'error',
      message: error instanceof Error ? error.message : 'Failed to get config',
    });
  }
});

/**
 * @route POST /api/configs
 * @desc Create a new bot config
 */
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const validated = createConfigSchema.parse(req.body);
    const config = await configService.createConfig(
      {
        botId: validated.botId,
        botName: validated.botName,
        config: validated.config as Parameters<typeof configService.createConfig>[0]['config'],
      },
      req.userId
    );
    res.status(201).json({ status: 'success', data: config });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        status: 'error',
        message: 'Validation error',
        errors: error.errors,
      });
    }
    logger.error('Failed to create config:', error);
    return res.status(500).json({
      status: 'error',
      message: error instanceof Error ? error.message : 'Failed to create config',
    });
  }
});

/**
 * @route PUT /api/configs/:botId
 * @desc Update bot config (creates draft by default)
 */
router.put('/:botId', async (req: AuthRequest<BotIdParams>, res: Response) => {
  try {
    const validated = updateConfigSchema.parse(req.body);
    const config = await configService.updateConfig(
      req.params.botId,
      {
        config: validated.config as Parameters<typeof configService.updateConfig>[1]['config'],
        botName: validated.botName,
        applyImmediately: validated.applyImmediately,
      },
      req.userId
    );
    res.json({ status: 'success', data: config });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        status: 'error',
        message: 'Validation error',
        errors: error.errors,
      });
    }
    logger.error('Failed to update config:', error);
    return res.status(500).json({
      status: 'error',
      message: error instanceof Error ? error.message : 'Failed to update config',
    });
  }
});

/**
 * @route DELETE /api/configs/:botId
 * @desc Delete bot config
 */
router.delete('/:botId', async (req: Request<BotIdParams>, res: Response) => {
  try {
    const deleted = await configService.deleteConfig(req.params.botId);
    if (!deleted) {
      return res.status(404).json({
        status: 'error',
        message: 'Config not found',
      });
    }
    return res.json({ status: 'success', message: 'Config deleted' });
  } catch (error) {
    logger.error('Failed to delete config:', error);
    return res.status(500).json({
      status: 'error',
      message: error instanceof Error ? error.message : 'Failed to delete config',
    });
  }
});

/**
 * @route GET /api/configs/:botId/draft
 * @desc Get draft config
 */
router.get('/:botId/draft', async (req: Request<BotIdParams>, res: Response) => {
  try {
    const config = await configService.getConfigByBotId(req.params.botId);
    if (!config) {
      return res.status(404).json({ status: 'error', message: 'Config not found' });
    }
    if (!config.draftConfig) {
      return res.status(404).json({ status: 'error', message: 'No draft found' });
    }
    return res.json({
      status: 'success',
      data: {
        draftConfig: config.draftConfig,
        hasPendingChanges: config.hasPendingChanges,
      },
    });
  } catch (error) {
    return res.status(500).json({
      status: 'error',
      message: error instanceof Error ? error.message : 'Failed to get draft',
    });
  }
});

/**
 * @route POST /api/configs/:botId/draft/apply
 * @desc Apply draft to current config
 */
router.post('/:botId/draft/apply', async (req: AuthRequest<BotIdParams>, res: Response) => {
  try {
    const comment = req.body.comment as string | undefined;
    const config = await configService.applyDraft(req.params.botId, req.userId, comment);
    res.json({ status: 'success', data: config });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error instanceof Error ? error.message : 'Failed to apply draft',
    });
  }
});

/**
 * @route DELETE /api/configs/:botId/draft
 * @desc Discard draft
 */
router.delete('/:botId/draft', async (req: Request<BotIdParams>, res: Response) => {
  try {
    const config = await configService.discardDraft(req.params.botId);
    res.json({ status: 'success', data: config });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error instanceof Error ? error.message : 'Failed to discard draft',
    });
  }
});

/**
 * @route POST /api/configs/:botId/quick-edit
 * @desc Quick edit a specific field
 */
router.post('/:botId/quick-edit', async (req: AuthRequest<BotIdParams>, res: Response) => {
  try {
    const validated = quickEditSchema.parse(req.body);
    const config = await configService.quickEdit(req.params.botId, validated.field, validated.value, {
      deploy: validated.deploy,
      userId: req.userId,
    });
    res.json({ status: 'success', data: config });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        status: 'error',
        message: 'Validation error',
        errors: error.errors,
      });
    }
    return res.status(500).json({
      status: 'error',
      message: error instanceof Error ? error.message : 'Failed to quick edit',
    });
  }
});

/**
 * @route POST /api/configs/:botId/runmode
 * @desc Set runmode (dry_run or live)
 */
router.post('/:botId/runmode', async (req: AuthRequest<BotIdParams>, res: Response) => {
  try {
    const validated = runmodeSchema.parse(req.body);
    const config = await configService.setRunmode(req.params.botId, validated.runmode, {
      deploy: validated.deploy,
      userId: req.userId,
    });
    res.json({ status: 'success', data: config });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        status: 'error',
        message: 'Validation error',
        errors: error.errors,
      });
    }
    return res.status(500).json({
      status: 'error',
      message: error instanceof Error ? error.message : 'Failed to set runmode',
    });
  }
});

/**
 * @route POST /api/configs/:botId/deploy
 * @desc Deploy config to bot
 */
router.post('/:botId/deploy', async (req: AuthRequest<BotIdParams>, res: Response) => {
  try {
    const validated = deploySchema.parse(req.body);
    const result = await deployService.deployConfig(
      req.params.botId,
      {
        version: validated.version,
        force: validated.force,
        comment: validated.comment,
      },
      req.userId
    );
    res.json({
      status: result.success ? 'success' : 'error',
      data: result,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        status: 'error',
        message: 'Validation error',
        errors: error.errors,
      });
    }
    return res.status(500).json({
      status: 'error',
      message: error instanceof Error ? error.message : 'Failed to deploy',
    });
  }
});

/**
 * @route POST /api/configs/:botId/rollback
 * @desc Rollback to a previous version
 */
router.post('/:botId/rollback', async (req: AuthRequest<BotIdParams>, res: Response) => {
  try {
    const validated = rollbackSchema.parse(req.body);
    const version = await versionService.rollbackToVersion(req.params.botId, validated.version, {
      userId: req.userId,
      comment: validated.comment,
    });

    // Deploy if requested
    if (validated.deploy) {
      await deployService.deployConfig(req.params.botId, {}, req.userId);
    }

    res.json({ status: 'success', data: version });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        status: 'error',
        message: 'Validation error',
        errors: error.errors,
      });
    }
    return res.status(500).json({
      status: 'error',
      message: error instanceof Error ? error.message : 'Failed to rollback',
    });
  }
});

/**
 * @route GET /api/configs/:botId/versions
 * @desc Get version history
 */
router.get('/:botId/versions', async (req: Request<BotIdParams>, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const versions = await versionService.getVersions(req.params.botId, limit);
    res.json({ status: 'success', data: versions });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error instanceof Error ? error.message : 'Failed to get versions',
    });
  }
});

/**
 * @route GET /api/configs/:botId/versions/:version
 * @desc Get a specific version
 */
router.get('/:botId/versions/:version', async (req: Request<VersionParams>, res: Response) => {
  try {
    const version = await versionService.getVersion(req.params.botId, parseInt(req.params.version));
    if (!version) {
      return res.status(404).json({ status: 'error', message: 'Version not found' });
    }
    return res.json({ status: 'success', data: version });
  } catch (error) {
    return res.status(500).json({
      status: 'error',
      message: error instanceof Error ? error.message : 'Failed to get version',
    });
  }
});

/**
 * @route GET /api/configs/:botId/diff
 * @desc Get diff between current and draft
 */
router.get('/:botId/diff', async (req: Request<BotIdParams>, res: Response) => {
  try {
    const config = await getBotConfigsCollection().findOne({ botId: req.params.botId });
    if (!config) {
      return res.status(404).json({ status: 'error', message: 'Config not found' });
    }
    if (!config.draftConfig) {
      return res.json({ status: 'success', data: { diffs: [], message: 'No draft to compare' } });
    }

    const diffs = computeDiff(config.currentConfig, config.draftConfig);
    return res.json({ status: 'success', data: { diffs } });
  } catch (error) {
    return res.status(500).json({
      status: 'error',
      message: error instanceof Error ? error.message : 'Failed to compute diff',
    });
  }
});

/**
 * @route GET /api/configs/:botId/diff/:v1/:v2
 * @desc Get diff between two versions
 */
router.get('/:botId/diff/:v1/:v2', async (req: Request<DiffParams>, res: Response) => {
  try {
    const result = await versionService.compareVersions(
      req.params.botId,
      parseInt(req.params.v1),
      parseInt(req.params.v2)
    );
    res.json({ status: 'success', data: result });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error instanceof Error ? error.message : 'Failed to compare versions',
    });
  }
});

export default router;
