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
import { proxyRequest, testBotConnection } from '../services/proxyService.js';
import { getBotWithCredentials, getBotOpenTrades, getBotPing, getBotBalance, getBotTrades, getBotState } from '../services/botService.js';
import { decryptPassword } from '../services/encryptionService.js';
import { rateLimitService } from '../services/rateLimit.service.js';
import { env } from '../config/env.js';

/**
 * Helper function to check rate limit and set headers
 */
async function checkRateLimit(
  botId: string,
  res: Response
): Promise<{ allowed: boolean; retryAfter?: number }> {
  const rateLimit = await rateLimitService.checkLimit(
    botId,
    env.RATE_LIMIT_DEFAULT,
    env.RATE_LIMIT_WINDOW
  );

  // Add rate limit headers to response
  res.setHeader('X-RateLimit-Limit', rateLimit.limit.toString());
  res.setHeader('X-RateLimit-Remaining', rateLimit.remaining.toString());
  res.setHeader('X-RateLimit-Reset', rateLimit.reset.toString());

  if (!rateLimit.allowed) {
    const retryAfter = rateLimit.retryAfter || env.RATE_LIMIT_WINDOW;
    res.setHeader('Retry-After', retryAfter.toString());
    res.status(429).json({
      status: 'error',
      message: `Rate limit exceeded: ${rateLimit.remaining}/${rateLimit.limit} requests remaining. Retry after ${retryAfter}s`,
      retryAfter,
    });
    return { allowed: false, retryAfter };
  }

  return { allowed: true };
}

export function createProxyRouter(): Router {
  const router = express.Router();

  /**
   * @swagger
   * /api/bots/{id}/test:
   *   post:
   *     summary: Test bot connection
   *     description: Tests the connection to a Freqtrade bot instance
   *     tags: [Proxy]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *         description: Bot ID
   *     responses:
   *       200:
   *         description: Connection successful
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 status:
   *                   type: string
   *                   example: success
   *                 message:
   *                   type: string
   *                   example: Connection successful
   *       400:
   *         description: Connection failed
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   *       404:
   *         description: Bot not found
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   *       500:
   *         description: Server error
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   */
  router.post('/:id/test', async (req: Request, res: Response) => {
    try {
      const bot = getBotWithCredentials(req.params.id);
      if (!bot) {
        return res.status(404).json({
          status: 'error',
          message: 'Bot not found',
        });
      }

      const password = decryptPassword(bot.encrypted_password);
      const isConnected = await testBotConnection(
        bot.api_url,
        bot.username,
        password
      );

      if (isConnected) {
        return res.json({
          status: 'success',
          message: 'Connection successful',
        });
      } else {
        return res.status(400).json({
          status: 'error',
          message: 'Connection failed',
        });
      }
    } catch (error) {
      return res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to test connection',
      });
    }
  });

  /**
   * @swagger
   * /api/bots/{id}/proxy/api/v1/ping:
   *   get:
   *     summary: Ping bot (cached)
   *     description: Checks if the Freqtrade bot is alive and responding. This endpoint uses intelligent caching (10s TTL).
   *     tags: [Proxy]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *         description: Bot ID
   *     responses:
   *       200:
   *         description: Bot health status
   *         headers:
   *           X-Cache-Used:
   *             description: Indicates if response was served from cache
   *             schema:
   *               type: string
   *               example: "true"
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 status:
   *                   type: string
   *                   example: pong
   *       500:
   *         description: Server error
   * /api/bots/{id}/proxy/api/v1/status:
   *   get:
   *     summary: Get open trades (cached)
   *     description: Returns the list of currently open trades from Freqtrade (/status). This endpoint uses intelligent caching (5s TTL) to reduce API load.
   *     tags: [Proxy]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *         description: Bot ID
   *     responses:
   *       200:
   *         description: List of open trades
   *         headers:
   *           X-Cache-Used:
   *             description: Indicates if response was served from cache
   *             schema:
   *               type: string
   *               example: "true"
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 type: object
   *       500:
   *         description: Server error
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   * /api/bots/{id}/proxy/api/v1/balance:
   *   get:
   *     summary: Get bot balance (cached)
   *     description: Returns the current balance of a Freqtrade bot. This endpoint uses intelligent caching (10s TTL) to reduce API load.
   *     tags: [Proxy]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *         description: Bot ID
   *     responses:
   *       200:
   *         description: Bot balance
   *         headers:
   *           X-Cache-Used:
   *             description: Indicates if response was served from cache
   *             schema:
   *               type: string
   *               example: "true"
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *       500:
   *         description: Server error
   * /api/bots/{id}/proxy/api/v1/trades:
   *   get:
   *     summary: Get bot trades (cached)
   *     description: Returns trades for a Freqtrade bot. This endpoint uses intelligent caching (5s TTL) to reduce API load. Supports optional limit query parameter.
   *     tags: [Proxy]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *         description: Bot ID
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *           minimum: 1
   *         description: Limit number of trades returned
   *     responses:
   *       200:
   *         description: Bot trades
   *         headers:
   *           X-Cache-Used:
   *             description: Indicates if response was served from cache
   *             schema:
   *               type: string
   *               example: "true"
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *       500:
   *         description: Server error
   * /api/bots/{id}/proxy/api/v1/show_config:
   *   get:
   *     summary: Get bot configuration (cached)
   *     description: Returns the configuration of a Freqtrade bot. This endpoint uses intelligent caching (30s TTL) to reduce API load.
   *     tags: [Proxy]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *         description: Bot ID
   *     responses:
   *       200:
   *         description: Bot configuration
   *         headers:
   *           X-Cache-Used:
   *             description: Indicates if response was served from cache
   *             schema:
   *               type: string
   *               example: "true"
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *       500:
   *         description: Server error
   * /api/bots/{id}/proxy/{path}:
   *   get:
   *     summary: Proxy GET request to Freqtrade
   *     description: Proxies any GET request to the Freqtrade bot instance. Common endpoints like /api/v1/status, /api/v1/balance, /api/v1/trades, and /api/v1/show_config are automatically cached.
   *     tags: [Proxy]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *         description: Bot ID
   *       - in: path
   *         name: path
   *         required: true
   *         schema:
   *           type: string
   *         description: Freqtrade API path (e.g., api/v1/status, api/v1/balance)
   *     responses:
   *       200:
   *         description: Response from Freqtrade API
   *         headers:
   *           X-Cache-Used:
   *             description: Indicates if response was served from cache (only for cached endpoints)
   *             schema:
   *               type: string
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *       500:
   *         description: Server error
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   */
  router.get('/:id/proxy/*', async (req: Request, res: Response) => {
    try {
      // Check rate limit before processing
      const rateLimitCheck = await checkRateLimit(req.params.id, res);
      if (!rateLimitCheck.allowed) {
        return; // Response already sent
      }

      const path = req.params[0] || '';
      const fullPath = path.startsWith('/') ? path : `/${path}`;
      const queryString = req.url.includes('?') ? req.url.split('?')[1] : '';
      const finalPath = queryString ? `${fullPath}?${queryString}` : fullPath;

      // Use cached functions for common endpoints
      let data: unknown;
      let usesCache = false; // Whether this endpoint supports caching (may still be a MISS)

      // Normalize path (remove leading slash for comparison)
      const normalizedPath = fullPath.replace(/^\/+/, '');
      
      // Import logger
      const { appLogger } = await import('../utils/logger.js');
      appLogger.info(`[PROXY] GET ${normalizedPath} for bot ${req.params.id}`);

      let fromCache = false;

      if (normalizedPath === 'api/v1/status') {
        usesCache = true;
        appLogger.info('[PROXY] Using getBotOpenTrades (Freqtrade /status)');
        const result = await getBotOpenTrades(req.params.id);
        data = result.data;
        fromCache = result.fromCache;
      } else if (normalizedPath === 'api/v1/ping') {
        usesCache = true;
        appLogger.info('[PROXY] Using getBotPing');
        const result = await getBotPing(req.params.id);
        data = result.data;
        fromCache = result.fromCache;
      } else if (normalizedPath === 'api/v1/balance') {
        usesCache = true;
        appLogger.info('[PROXY] Using getBotBalance (with cache support)');
        const result = await getBotBalance(req.params.id);
        data = result.data;
        fromCache = result.fromCache;
      } else if (normalizedPath.startsWith('api/v1/trades')) {
        usesCache = true;
        appLogger.info('[PROXY] Using getBotTrades (with cache support)');
        // Extract limit from query string if present
        const limitMatch = queryString?.match(/limit=(\d+)/);
        const limit = limitMatch ? parseInt(limitMatch[1], 10) : undefined;
        const result = await getBotTrades(req.params.id, limit);
        data = result.data;
        fromCache = result.fromCache;
      } else if (normalizedPath === 'api/v1/show_config') {
        usesCache = true;
        appLogger.info('[PROXY] Using getBotState (with cache support)');
        const result = await getBotState(req.params.id);
        data = result.data;
        fromCache = result.fromCache;
      } else {
        appLogger.info(`[PROXY] Direct proxy (no cache) for path: ${normalizedPath}`);
        // For other endpoints, use direct proxy
        data = await proxyRequest(req.params.id, 'GET', finalPath);
      }

      // Add cache indicator headers
      if (usesCache) {
        res.setHeader('X-Cache-Supported', 'true');
        res.setHeader('X-Cache-Used', fromCache ? 'true' : 'false');
        
        // Add cache statistics
        const { cacheStatsService } = await import('../services/cacheStats.service.js');
        const stats = cacheStatsService.getStats();
        res.setHeader('X-Cache-Hit-Rate', `${stats.hitRate}%`);
        res.setHeader('X-Cache-Total-Hits', stats.total.hits.toString());
        res.setHeader('X-Cache-Total-Misses', stats.total.misses.toString());
      } else {
        res.setHeader('X-Cache-Supported', 'false');
      }

      res.json(data);
    } catch (error) {
      res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Proxy request failed',
      });
    }
  });

  /**
   * @swagger
   * /api/bots/{id}/proxy/{path}:
   *   post:
   *     summary: Proxy POST request to Freqtrade
   *     description: Proxies any POST request to the Freqtrade bot instance. Cache is automatically invalidated for the bot on write operations.
   *     tags: [Proxy]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *         description: Bot ID
   *       - in: path
   *         name: path
   *         required: true
   *         schema:
   *           type: string
   *         description: Freqtrade API path
   *     requestBody:
   *       description: Request body to forward to Freqtrade
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *     responses:
   *       200:
   *         description: Response from Freqtrade API
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *       500:
   *         description: Server error
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   */
  router.post('/:id/proxy/*', async (req: Request, res: Response) => {
    try {
      // Check rate limit before processing
      const rateLimitCheck = await checkRateLimit(req.params.id, res);
      if (!rateLimitCheck.allowed) {
        return; // Response already sent
      }

      const path = req.params[0] || '';
      const fullPath = path.startsWith('/') ? path : `/${path}`;

      const data = await proxyRequest(req.params.id, 'POST', fullPath, req.body);
      return res.json(data);
    } catch (error) {
      // Handle rate limit errors
      if (error instanceof Error && 'statusCode' in error && (error as any).statusCode === 429) {
        const retryAfter = (error as any).retryAfter || env.RATE_LIMIT_WINDOW;
        res.setHeader('Retry-After', retryAfter.toString());
        return res.status(429).json({
          status: 'error',
          message: error.message,
          retryAfter,
        });
      }

      return res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Proxy request failed',
      });
    }
  });

  /**
   * @swagger
   * /api/bots/{id}/proxy/{path}:
   *   put:
   *     summary: Proxy PUT request to Freqtrade
   *     description: Proxies any PUT request to the Freqtrade bot instance. Cache is automatically invalidated for the bot on write operations.
   *     tags: [Proxy]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *         description: Bot ID
   *       - in: path
   *         name: path
   *         required: true
   *         schema:
   *           type: string
   *         description: Freqtrade API path
   *     requestBody:
   *       description: Request body to forward to Freqtrade
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *     responses:
   *       200:
   *         description: Response from Freqtrade API
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *       500:
   *         description: Server error
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   */
  router.put('/:id/proxy/*', async (req: Request, res: Response) => {
    try {
      // Check rate limit before processing
      const rateLimitCheck = await checkRateLimit(req.params.id, res);
      if (!rateLimitCheck.allowed) {
        return; // Response already sent
      }

      const path = req.params[0] || '';
      const fullPath = path.startsWith('/') ? path : `/${path}`;

      const data = await proxyRequest(req.params.id, 'PUT', fullPath, req.body);
      return res.json(data);
    } catch (error) {
      // Handle rate limit errors
      if (error instanceof Error && 'statusCode' in error && (error as any).statusCode === 429) {
        const retryAfter = (error as any).retryAfter || env.RATE_LIMIT_WINDOW;
        res.setHeader('Retry-After', retryAfter.toString());
        return res.status(429).json({
          status: 'error',
          message: error.message,
          retryAfter,
        });
      }

      return res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Proxy request failed',
      });
    }
  });

  /**
   * @swagger
   * /api/bots/{id}/proxy/{path}:
   *   delete:
   *     summary: Proxy DELETE request to Freqtrade
   *     description: Proxies any DELETE request to the Freqtrade bot instance. Cache is automatically invalidated for the bot on write operations.
   *     tags: [Proxy]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *         description: Bot ID
   *       - in: path
   *         name: path
   *         required: true
   *         schema:
   *           type: string
   *         description: Freqtrade API path
   *     responses:
   *       200:
   *         description: Response from Freqtrade API
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *       500:
   *         description: Server error
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   */
  router.delete('/:id/proxy/*', async (req: Request, res: Response) => {
    try {
      // Check rate limit before processing
      const rateLimitCheck = await checkRateLimit(req.params.id, res);
      if (!rateLimitCheck.allowed) {
        return; // Response already sent
      }

      const path = req.params[0] || '';
      const fullPath = path.startsWith('/') ? path : `/${path}`;

      const data = await proxyRequest(req.params.id, 'DELETE', fullPath);
      return res.json(data);
    } catch (error) {
      // Handle rate limit errors
      if (error instanceof Error && 'statusCode' in error && (error as any).statusCode === 429) {
        const retryAfter = (error as any).retryAfter || env.RATE_LIMIT_WINDOW;
        res.setHeader('Retry-After', retryAfter.toString());
        return res.status(429).json({
          status: 'error',
          message: error.message,
          retryAfter,
        });
      }

      return res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Proxy request failed',
      });
    }
  });

  return router;
}

