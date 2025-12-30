/*
 * FreqHub - Multi-bot dashboard for Freqtrade
 * Copyright (C) 2025  FreqHub Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

import express, { type Router, type Request, type Response } from 'express';
import { getDatabase } from '../db/database.js';
import { cacheService } from '../services/cache.service.js';
import { cacheStatsService } from '../services/cacheStats.service.js';
import { valkeyService } from '../services/valkey.service.js';
import { websocketService } from '../services/websocket.service.js';
import { pollingService } from '../services/polling.service.js';
import { rateLimitService } from '../services/rateLimit.service.js';

export function createHealthRouter(): Router {
  const router = express.Router();

  /**
   * @swagger
   * /api/healthz:
   *   get:
   *     summary: Health check endpoint
   *     description: Returns the health status of the API and database connection. Follows Kubernetes healthz convention.
   *     tags: [Health]
   *     responses:
   *       200:
   *         description: Service is healthy
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/HealthResponse'
   *       503:
   *         description: Service is unhealthy
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   */
  router.get('/', (_req: Request, res: Response) => {
    try {
      const db = getDatabase();
      // Simple query to check database connection
      db.prepare('SELECT 1').get();
      
      res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        database: 'connected',
      });
    } catch (error) {
      res.status(503).json({
        status: 'error',
        timestamp: new Date().toISOString(),
        database: 'disconnected',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * @swagger
   * /api/healthz/cache:
   *   get:
   *     summary: Cache statistics and health
   *     description: Returns cache statistics including hit rate, Valkey connection status, and top cached keys
   *     tags: [Health]
   *     responses:
   *       200:
   *         description: Cache statistics
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 valkey:
   *                   type: object
   *                   properties:
   *                     enabled:
   *                       type: boolean
   *                     connected:
   *                       type: boolean
   *                     metrics:
   *                       type: object
   *                 cache:
   *                   type: object
   *                   properties:
   *                     stats:
   *                       type: object
   *                     memory:
   *                       type: object
   */
  router.get('/cache', async (_req: Request, res: Response) => {
    try {
      const valkeyConnected = await valkeyService.ping();
      const valkeyMetrics = valkeyConnected ? await valkeyService.getMetrics() : null;
      const cacheStats = cacheStatsService.getStats();
      const cacheMemoryStats = cacheService.getStats();

      res.json({
        valkey: {
          enabled: valkeyService.isEnabled(),
          connected: valkeyConnected,
          metrics: valkeyMetrics || null,
        },
        cache: {
          stats: {
            total: cacheStats.total,
            hitRate: `${cacheStats.hitRate}%`,
            topKeys: cacheStats.keyStats.slice(0, 10), // Top 10 keys
          },
          memory: cacheMemoryStats,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(500).json({
        status: 'error',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * @swagger
   * /api/healthz/websocket:
   *   get:
   *     summary: WebSocket service health and statistics
   *     description: Returns WebSocket connection status and client statistics
   *     tags: [Health]
   *     responses:
   *       200:
   *         description: WebSocket statistics
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 websocket:
   *                   type: object
   *                   properties:
   *                     initialized:
   *                       type: boolean
   *                     connectedClients:
   *                       type: number
   *                     rooms:
   *                       type: number
   *                 timestamp:
   *                   type: string
   */
  router.get('/websocket', (_req: Request, res: Response) => {
    try {
      const stats = websocketService.getStats();
      res.json({
        websocket: stats,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(500).json({
        status: 'error',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * @swagger
   * /api/healthz/polling:
   *   get:
   *     summary: Polling service health and statistics
   *     description: Returns polling service status, configuration, and last poll times for each bot
   *     tags: [Health]
   *     responses:
   *       200:
   *         description: Polling service statistics
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 polling:
   *                   type: object
   *                   properties:
   *                     enabled:
   *                       type: boolean
   *                     running:
   *                       type: boolean
   *                     interval:
   *                       type: number
   *                     lastPollTimes:
   *                       type: object
   *                 timestamp:
   *                   type: string
   */
  router.get('/polling', (_req: Request, res: Response) => {
    try {
      const stats = pollingService.getStats();
      res.json({
        polling: stats,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(500).json({
        status: 'error',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * @swagger
   * /api/healthz/ratelimit:
   *   get:
   *     summary: Rate limiting service health and statistics
   *     description: Returns rate limiting service status and current limits for all bots
   *     tags: [Health]
   *     responses:
   *       200:
   *         description: Rate limiting statistics
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 ratelimit:
   *                   type: object
   *                   properties:
   *                     enabled:
   *                       type: boolean
   *                     defaultLimit:
   *                       type: number
   *                     defaultWindow:
   *                       type: number
   *                     stats:
   *                       type: array
   */
  router.get('/ratelimit', async (_req: Request, res: Response) => {
    try {
      const stats = await rateLimitService.getAllStats();
      const { env } = await import('../config/env.js');
      res.json({
        ratelimit: {
          enabled: rateLimitService.isEnabled(),
          defaultLimit: env.RATE_LIMIT_DEFAULT,
          defaultWindow: env.RATE_LIMIT_WINDOW,
          stats,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(500).json({
        status: 'error',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  return router;
}

