/*
 * FreqHub - Multi-bot dashboard for Freqtrade
 * Copyright (C) 2025 - 2026  FreqHub Contributors
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
import { eventBusService } from '../services/eventBus.service.js';
import { websocketService } from '../services/websocket.service.js';
import { pollingService } from '../services/polling.service.js';
import { rateLimitService } from '../services/rateLimit.service.js';
import { testRateLimiter } from '../middleware/rateLimit.middleware.js';
import { appLogger } from '../utils/logger.js';

export function createTestRouter(): Router {
  const router = express.Router();
  router.use(testRateLimiter);

  /**
   * @swagger
   * /api/test/event:
   *   post:
   *     summary: Publish a test event (for development/testing)
   *     description: Manually publish an event to the EventBus. Useful for testing WebSocket connections.
   *     tags: [Testing]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - type
   *             properties:
   *               type:
   *                 type: string
   *                 example: "test_event"
   *               botId:
   *                 type: string
   *                 example: "bot-123"
   *               data:
   *                 type: object
   *                 example: { message: "Hello from test endpoint" }
   *     responses:
   *       200:
   *         description: Event published successfully
   *       400:
   *         description: Invalid request body
   */
  router.post('/event', async (req: Request, res: Response) => {
    try {
      const { type, botId, data } = req.body;

      if (!type || typeof type !== 'string') {
        return res.status(400).json({
          error: 'Missing or invalid "type" field',
        });
      }

      await eventBusService.publish({
        type,
        botId,
        data: data || {},
      });

      appLogger.info(`Test event published: ${type}${botId ? ` (bot: ${botId})` : ''}`);

      return res.json({
        success: true,
        message: 'Event published successfully',
        event: {
          type,
          botId,
          data,
          timestamp: Date.now(),
        },
        websocket: {
          connectedClients: websocketService.getConnectedCount(),
        },
      });
    } catch (error) {
      appLogger.error('Error publishing test event:', error);
      return res.status(500).json({
        error: 'Failed to publish event',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * @swagger
   * /api/test/websocket:
   *   get:
   *     summary: Get WebSocket connection info (for testing)
   *     description: Returns current WebSocket statistics and connection details
   *     tags: [Testing]
   *     responses:
   *       200:
   *         description: WebSocket information
   */
  router.get('/websocket', (_req: Request, res: Response) => {
    const stats = websocketService.getStats();
    res.json({
      websocket: stats,
      info: {
        endpoint: '/socket.io',
        events: {
          subscribe: 'subscribe:bot',
          unsubscribe: 'unsubscribe:bot',
          system: 'subscribe:system',
        },
        receivedEvents: [
          'bot_event',
          'system_event',
          'broadcast_event',
          'subscribed',
          'unsubscribed',
        ],
      },
      timestamp: new Date().toISOString(),
    });
  });

  /**
   * @swagger
   * /api/test/polling:
   *   post:
   *     summary: Manually trigger polling (for testing)
   *     description: Forces an immediate poll of all enabled bots, bypassing the normal interval
   *     tags: [Testing]
   *     responses:
   *       200:
   *         description: Polling triggered successfully
   */
  router.post('/polling', async (_req: Request, res: Response) => {
    try {
      await pollingService.pollNow();
      const stats = pollingService.getStats();
      res.json({
        success: true,
        message: 'Polling triggered successfully',
        stats,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      appLogger.error('Error triggering polling:', error);
      res.status(500).json({
        error: 'Failed to trigger polling',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * @swagger
   * /api/test/polling:
   *   get:
   *     summary: Get polling service status (for testing)
   *     description: Returns current polling service statistics and configuration
   *     tags: [Testing]
   *     responses:
   *       200:
   *         description: Polling service information
   */
  router.get('/polling', (_req: Request, res: Response) => {
    const stats = pollingService.getStats();
    res.json({
      polling: stats,
      info: {
        description: 'Automatic polling service keeps bot data fresh in cache',
        behavior: {
          enabled: 'Only polls enabled bots',
          smart: 'Skips bots with fresh cache data',
          staggered: 'Staggers requests to avoid overwhelming APIs',
          events: 'Publishes events when data changes',
        },
      },
      timestamp: new Date().toISOString(),
    });
  });

  /**
   * @swagger
   * /api/test/ratelimit:
   *   get:
   *     summary: Get rate limit status (for testing)
   *     description: Returns current rate limit statistics for all bots
   *     tags: [Testing]
   *     responses:
   *       200:
   *         description: Rate limit information
   */
  router.get('/ratelimit', async (_req: Request, res: Response) => {
    const stats = await rateLimitService.getAllStats();
    const { env } = await import('../config/env.js');
    res.json({
      ratelimit: {
        enabled: rateLimitService.isEnabled(),
        defaultLimit: env.RATE_LIMIT_DEFAULT,
        defaultWindow: env.RATE_LIMIT_WINDOW,
        stats,
      },
      info: {
        description: 'Rate limiting protects Freqtrade APIs from being overwhelmed',
        behavior: {
          perBot: 'Each bot has its own rate limit counter',
          window: 'Sliding window resets after the configured time',
          headers: 'All responses include X-RateLimit-* headers',
          fallback: 'Uses in-memory storage if Valkey is unavailable',
        },
      },
      timestamp: new Date().toISOString(),
    });
  });

  /**
   * @swagger
   * /api/test/ratelimit/reset:
   *   post:
   *     summary: Reset rate limit for a bot (for testing)
   *     description: Clears the rate limit counter for a specific bot
   *     tags: [Testing]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - botId
   *             properties:
   *               botId:
   *                 type: string
   *                 example: "bot-123"
   *     responses:
   *       200:
   *         description: Rate limit reset successfully
   */
  router.post('/ratelimit/reset', async (req: Request, res: Response) => {
    try {
      const { botId } = req.body;
      if (!botId || typeof botId !== 'string') {
        return res.status(400).json({
          error: 'Missing or invalid "botId" field',
        });
      }

      await rateLimitService.reset(botId);
      appLogger.info(`Rate limit reset for bot: ${botId}`);

      return res.json({
        success: true,
        message: `Rate limit reset for bot ${botId}`,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      appLogger.error('Error resetting rate limit:', error);
      return res.status(500).json({
        error: 'Failed to reset rate limit',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  return router;
}

