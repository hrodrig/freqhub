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
import * as deployService from '../services/deploy.service.js';
import { logger } from '../utils/logger.js';

const router = Router();

interface BotIdParams {
  botId: string;
}

interface IdParams {
  id: string;
}

type AuthRequest = Request & { userId?: string };

const bulkDeploySchema = z.object({
  botIds: z.array(z.string().uuid()).min(1),
  comment: z.string().optional(),
});

/**
 * @route GET /api/deployments
 * @desc Get all recent deployments
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 100;
    const deployments = await deployService.getAllDeployments(limit);
    res.json({ status: 'success', data: deployments });
  } catch (error) {
    logger.error('Failed to get deployments:', error);
    res.status(500).json({
      status: 'error',
      message: error instanceof Error ? error.message : 'Failed to get deployments',
    });
  }
});

/**
 * @route GET /api/deployments/bot/:botId
 * @desc Get deployments for a specific bot
 */
router.get('/bot/:botId', async (req: Request<BotIdParams>, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const deployments = await deployService.getDeployments(req.params.botId, limit);
    res.json({ status: 'success', data: deployments });
  } catch (error) {
    logger.error('Failed to get bot deployments:', error);
    res.status(500).json({
      status: 'error',
      message: error instanceof Error ? error.message : 'Failed to get deployments',
    });
  }
});

/**
 * @route GET /api/deployments/:id
 * @desc Get a specific deployment
 */
router.get('/:id', async (req: Request<IdParams>, res: Response) => {
  try {
    const deployment = await deployService.getDeploymentById(req.params.id);
    if (!deployment) {
      return res.status(404).json({ status: 'error', message: 'Deployment not found' });
    }
    return res.json({ status: 'success', data: deployment });
  } catch (error) {
    logger.error('Failed to get deployment:', error);
    return res.status(500).json({
      status: 'error',
      message: error instanceof Error ? error.message : 'Failed to get deployment',
    });
  }
});

/**
 * @route POST /api/deployments/bulk
 * @desc Deploy to multiple bots
 */
router.post('/bulk', async (req: AuthRequest, res: Response) => {
  try {
    const validated = bulkDeploySchema.parse(req.body);

    const results = await deployService.bulkDeploy(validated.botIds, {
      userId: req.userId,
      comment: validated.comment,
    });

    // Convert Map to object for JSON response
    const resultsObj: Record<string, ReturnType<typeof results.get>> = {};
    for (const [botId, result] of results) {
      resultsObj[botId] = result;
    }

    const successCount = Array.from(results.values()).filter((r) => r.success).length;
    const failureCount = results.size - successCount;

    res.json({
      status: failureCount === 0 ? 'success' : 'partial',
      data: {
        results: resultsObj,
        summary: {
          total: results.size,
          success: successCount,
          failed: failureCount,
        },
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
    logger.error('Failed to bulk deploy:', error);
    return res.status(500).json({
      status: 'error',
      message: error instanceof Error ? error.message : 'Failed to bulk deploy',
    });
  }
});

export default router;
