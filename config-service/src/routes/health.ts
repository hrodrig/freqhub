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
import { getDb } from '../db/mongo.js';
import { getBotConfigsCollection, getConfigVersionsCollection, getDeploymentsCollection } from '../db/mongo.js';

const router = Router();

/**
 * @route GET /health
 * @desc Basic health check (no auth required)
 */
router.get('/', async (_req: Request, res: Response) => {
  try {
    // Check MongoDB connection
    const db = getDb();
    await db.command({ ping: 1 });

    res.json({
      status: 'ok',
      service: 'freqhub-config-service',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(503).json({
      status: 'error',
      service: 'freqhub-config-service',
      message: 'Database connection failed',
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * @route GET /health/detailed
 * @desc Detailed health check with stats
 */
router.get('/detailed', async (_req: Request, res: Response) => {
  try {
    const db = getDb();
    await db.command({ ping: 1 });

    // Get counts
    const [configCount, versionCount, deploymentCount] = await Promise.all([
      getBotConfigsCollection().countDocuments(),
      getConfigVersionsCollection().countDocuments(),
      getDeploymentsCollection().countDocuments(),
    ]);

    // Get recent deployment stats
    const recentDeployments = await getDeploymentsCollection()
      .find({})
      .sort({ deployedAt: -1 })
      .limit(100)
      .toArray();

    const successCount = recentDeployments.filter((d) => d.status === 'success').length;
    const failedCount = recentDeployments.filter((d) => d.status === 'failed').length;

    res.json({
      status: 'ok',
      service: 'freqhub-config-service',
      timestamp: new Date().toISOString(),
      stats: {
        configs: configCount,
        versions: versionCount,
        deployments: deploymentCount,
        recentDeployments: {
          total: recentDeployments.length,
          success: successCount,
          failed: failedCount,
          successRate: recentDeployments.length > 0 ? ((successCount / recentDeployments.length) * 100).toFixed(1) + '%' : 'N/A',
        },
      },
      uptime: process.uptime(),
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + ' MB',
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + ' MB',
      },
    });
  } catch (error) {
    res.status(503).json({
      status: 'error',
      service: 'freqhub-config-service',
      message: error instanceof Error ? error.message : 'Health check failed',
      timestamp: new Date().toISOString(),
    });
  }
});

export default router;
