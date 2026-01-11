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
import { proxyRequest, testBotConnection } from '../services/proxyService.js';
import { getBotWithCredentials, getBotOpenTrades, getBotPing, getBotBalance, getBotTrades, getBotState } from '../services/botService.js';
import { decryptPassword } from '../services/encryptionService.js';
import { rateLimitService } from '../services/rateLimit.service.js';
import { env } from '../config/env.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { requireBotViewAccess, requireBotOwnershipOrSuperadmin } from '../middleware/authorize.middleware.js';
import { auditHelpers } from '../middleware/audit.middleware.js';

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

  // All routes require authentication
  router.use(authenticate);

  // Helper to detect action from path and apply appropriate audit middleware
  const auditProxyAction = (req: express.Request, res: express.Response, next: express.NextFunction): void => {
    const path = req.params[0] || '';
    const normalizedPath = path.toLowerCase().replace(/^\/+/, '');
    
    // Detect specific bot control actions
    let action: string | null = null;
    if (normalizedPath.includes('api/v1/start')) {
      action = 'start';
    } else if (normalizedPath.includes('api/v1/stop')) {
      action = 'stop';
    } else if (normalizedPath.includes('api/v1/pause')) {
      action = 'pause';
    } else if (normalizedPath.includes('api/v1/reload_config')) {
      action = 'reload_config';
    }
    
    // Apply audit middleware for bot control actions
    if (action) {
      auditHelpers.botSystemAction(action)(req, res, next);
      return;
    }
    
    // For other POST actions, continue without audit
    next();
  };

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
  router.post('/:id/test', requireBotViewAccess, async (req: Request, res: Response) => {
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
   * /api/bots/{id}/proxy/api/v1/profit:
   *   get:
   *     summary: Get profit summary (cached)
   *     description: Returns the profit summary for a Freqtrade bot. This endpoint uses intelligent caching (10s TTL).
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
   *         description: Profit summary
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *       500:
   *         description: Server error
   * /api/bots/{id}/proxy/api/v1/performance:
   *   get:
   *     summary: Get coin performance
   *     description: Returns the performance of different coins for a Freqtrade bot.
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
   *         description: Coin performance data
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *       500:
   *         description: Server error
   * /api/bots/{id}/proxy/api/v1/daily:
   *   get:
   *     summary: Get daily profits
   *     description: Returns the profits for each day and amount of trades.
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
   *         description: Daily profit data
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *       500:
   *         description: Server error
   * /api/bots/{id}/proxy/api/v1/weekly:
   *   get:
   *     summary: Get weekly profits
   *     description: Returns the profits for each week and amount of trades.
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
   *         description: Weekly profit data
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *       500:
   *         description: Server error
   * /api/bots/{id}/proxy/api/v1/monthly:
   *   get:
   *     summary: Get monthly profits
   *     description: Returns the profits for each month and amount of trades.
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
   *         description: Monthly profit data
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *       500:
   *         description: Server error
   * /api/bots/{id}/proxy/api/v1/stats:
   *   get:
   *     summary: Get statistics report
   *     description: Returns the stats report including durations and sell-reasons.
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
   *         description: Statistics report
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *       500:
   *         description: Server error
   * /api/bots/{id}/proxy/api/v1/whitelist:
   *   get:
   *     summary: Get trading whitelist
   *     description: Returns the current trading whitelist.
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
   *         description: Trading whitelist
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 type: string
   *       500:
   *         description: Server error
   * /api/bots/{id}/proxy/api/v1/blacklist:
   *   get:
   *     summary: Get trading blacklist
   *     description: Returns the current trading blacklist.
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
   *         description: Trading blacklist
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 type: string
   *       500:
   *         description: Server error
   * /api/bots/{id}/proxy/api/v1/locks:
   *   get:
   *     summary: Get locked pairs
   *     description: Returns currently locked pairs.
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
   *         description: Locked pairs
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *       500:
   *         description: Server error
   * /api/bots/{id}/proxy/api/v1/logs:
   *   get:
   *     summary: Get bot logs
   *     description: Returns the latest log messages from the bot.
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
   *         description: Limit number of log messages (optional)
   *     responses:
   *       200:
   *         description: Bot logs
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *       500:
   *         description: Server error
   * /api/bots/{id}/proxy/api/v1/version:
   *   get:
   *     summary: Get bot version
   *     description: Returns the version of the Freqtrade bot.
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
   *         description: Bot version information
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *       500:
   *         description: Server error
   * /api/bots/{id}/proxy/api/v1/strategies:
   *   get:
   *     summary: List available strategies
   *     description: Returns a list of available strategies.
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
   *         description: List of strategies
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *       500:
   *         description: Server error
   * /api/bots/{id}/proxy/api/v1/strategy:
   *   get:
   *     summary: Get strategy details
   *     description: Returns details for a specific strategy.
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
   *         name: strategy
   *         required: true
   *         schema:
   *           type: string
   *         description: Strategy class name
   *     responses:
   *       200:
   *         description: Strategy details
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *       500:
   *         description: Server error
   * /api/bots/{id}/proxy/api/v1/entries:
   *   get:
   *     summary: Get entry tag performance
   *     description: Returns performance statistics based on buy tags. Can be filtered by pair.
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
   *         name: pair
   *         schema:
   *           type: string
   *         description: Filter by specific pair (optional)
   *     responses:
   *       200:
   *         description: Entry tag performance data
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *       500:
   *         description: Server error
   * /api/bots/{id}/proxy/api/v1/exits:
   *   get:
   *     summary: Get exit reason performance
   *     description: Returns performance statistics based on exit reasons. Can be filtered by pair.
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
   *         name: pair
   *         schema:
   *           type: string
   *         description: Filter by specific pair (optional)
   *     responses:
   *       200:
   *         description: Exit reason performance data
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *       500:
   *         description: Server error
   * /api/bots/{id}/proxy/api/v1/mix_tags:
   *   get:
   *     summary: Get entry+exit tag performance
   *     description: Returns performance statistics based on entry_tag + exit_reason combinations. Can be filtered by pair.
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
   *         name: pair
   *         schema:
   *           type: string
   *         description: Filter by specific pair (optional)
   *     responses:
   *       200:
   *         description: Entry+Exit tag performance data
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *       500:
   *         description: Server error
   * /api/bots/{id}/proxy/api/v1/count:
   *   get:
   *     summary: Get open trades count
   *     description: Returns the amount of open trades.
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
   *         description: Open trades count
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *       500:
   *         description: Server error
   * /api/bots/{id}/proxy/api/v1/health:
   *   get:
   *     summary: Get bot health check
   *     description: Provides a quick health check of the running bot.
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
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *       500:
   *         description: Server error
   * /api/bots/{id}/proxy/api/v1/sysinfo:
   *   get:
   *     summary: Get system information
   *     description: Provides system information including CPU and RAM usage.
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
   *         description: System information
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *       500:
   *         description: Server error
   * /api/bots/{id}/proxy/api/v1/start:
   *   post:
   *     summary: Start the bot
   *     description: Starts the bot if it's in the stopped state.
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
   *         description: Bot started successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *       500:
   *         description: Server error
   * /api/bots/{id}/proxy/api/v1/stop:
   *   post:
   *     summary: Stop the bot
   *     description: Stops the bot. Use start to restart.
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
   *         description: Bot stopped successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *       500:
   *         description: Server error
   * /api/bots/{id}/proxy/api/v1/pause:
   *   post:
   *     summary: Pause the bot
   *     description: Pauses the bot (stops buying but handles sells gracefully). Use reload_config to reset.
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
   *         description: Bot paused successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *       500:
   *         description: Server error
   * /api/bots/{id}/proxy/api/v1/reload_config:
   *   post:
   *     summary: Reload configuration
   *     description: Reloads the configuration file without restarting the bot.
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
   *         description: Configuration reloaded successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *       500:
   *         description: Server error
   * /api/bots/{id}/proxy/api/v1/forceenter:
   *   post:
   *     summary: Force enter a trade
   *     description: Forces entering a trade with specified parameters.
   *     tags: [Proxy]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *         description: Bot ID
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - pair
   *             properties:
   *               pair:
   *                 type: string
   *                 example: "BTC/USDT"
   *                 description: Pair to buy
   *               side:
   *                 type: string
   *                 enum: [long, short]
   *                 description: Trade side (long or short)
   *               price:
   *                 type: number
   *                 description: Optional price to buy
   *               order_type:
   *                 type: string
   *                 enum: [limit, market]
   *                 description: Order type (limit or market)
   *               stake_amount:
   *                 type: number
   *                 description: Stake amount (as float)
   *               leverage:
   *                 type: number
   *                 description: Leverage (as float)
   *               enter_tag:
   *                 type: string
   *                 description: Entry tag (default is force_enter)
   *     responses:
   *       200:
   *         description: Trade entered successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *       500:
   *         description: Server error
   * /api/bots/{id}/proxy/api/v1/forceexit:
   *   post:
   *     summary: Force exit a trade
   *     description: Forces exiting a trade with specified parameters.
   *     tags: [Proxy]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *         description: Bot ID
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - tradeid
   *             properties:
   *               tradeid:
   *                 type: integer
   *                 description: ID of the trade (can be received via status command)
   *               ordertype:
   *                 type: string
   *                 enum: [market, limit]
   *                 description: Order type to use (must be market or limit)
   *               amount:
   *                 type: number
   *                 description: Amount to sell. Full sell if not given
   *     responses:
   *       200:
   *         description: Trade exited successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *       500:
   *         description: Server error
   * /api/bots/{id}/proxy/{path}:
   *   get:
   *     summary: Proxy GET request to Freqtrade (All endpoints supported)
   *     description: Proxies any GET request to the Freqtrade bot instance. All Freqtrade REST API GET endpoints are supported. Common endpoints like /api/v1/status, /api/v1/balance, /api/v1/trades, and /api/v1/show_config are automatically cached. Query parameters are automatically forwarded to Freqtrade. See Freqtrade REST API documentation for complete endpoint reference.
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
   *         description: Freqtrade API path (e.g., api/v1/status, api/v1/trades?limit=100)
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
  router.get('/:id/proxy/*', requireBotViewAccess, async (req: Request, res: Response) => {
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
        // Skip rate limit in proxyRequest since we already checked it above
        data = await proxyRequest(req.params.id, 'GET', finalPath, undefined, true);
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
   *     summary: Proxy POST request to Freqtrade (All endpoints supported)
   *     description: Proxies any POST request to the Freqtrade bot instance. All Freqtrade REST API POST endpoints are supported. Cache is automatically invalidated for the bot on write operations. Supported endpoints include /api/v1/start, /api/v1/stop, /api/v1/pause, /api/v1/reload_config, /api/v1/forceenter, /api/v1/forceexit, /api/v1/blacklist, /api/v1/locks, and more. Request body parameters are automatically forwarded to Freqtrade. See Freqtrade REST API documentation for complete endpoint reference.
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
   *         description: Freqtrade API path (e.g., api/v1/start, api/v1/forceenter)
   *     requestBody:
   *       description: Request body parameters to forward to Freqtrade (varies by endpoint)
   *       required: false
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             example:
   *               pair: "BTC/USDT"
   *               price: 50000
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
  router.post('/:id/proxy/*', 
    requireBotOwnershipOrSuperadmin,
    auditProxyAction,
    async (req: Request, res: Response) => {
    try {
      // Check rate limit before processing
      const rateLimitCheck = await checkRateLimit(req.params.id, res);
      if (!rateLimitCheck.allowed) {
        return; // Response already sent
      }

      const path = req.params[0] || '';
      const fullPath = path.startsWith('/') ? path : `/${path}`;

      // Skip rate limit in proxyRequest since we already checked it above
      const data = await proxyRequest(req.params.id, 'POST', fullPath, req.body, true);
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
   *     summary: Proxy PUT request to Freqtrade (All endpoints supported)
   *     description: Proxies any PUT request to the Freqtrade bot instance. All Freqtrade REST API PUT endpoints are supported. Cache is automatically invalidated for the bot on write operations. See Freqtrade REST API documentation for complete endpoint reference.
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
  router.put('/:id/proxy/*', requireBotOwnershipOrSuperadmin, async (req: Request, res: Response) => {
    try {
      // Check rate limit before processing
      const rateLimitCheck = await checkRateLimit(req.params.id, res);
      if (!rateLimitCheck.allowed) {
        return; // Response already sent
      }

      const path = req.params[0] || '';
      const fullPath = path.startsWith('/') ? path : `/${path}`;

      // Skip rate limit in proxyRequest since we already checked it above
      const data = await proxyRequest(req.params.id, 'PUT', fullPath, req.body, true);
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
   *     summary: Proxy DELETE request to Freqtrade (All endpoints supported)
   *     description: Proxies any DELETE request to the Freqtrade bot instance. All Freqtrade REST API DELETE endpoints are supported. Cache is automatically invalidated for the bot on write operations. Supported endpoints include /api/v1/trades/{trade_id}, /api/v1/trades/{trade_id}/open-order, /api/v1/locks, and more. See Freqtrade REST API documentation for complete endpoint reference.
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
   *         description: Freqtrade API path (e.g., api/v1/trades/123, api/v1/locks?lock_id=1)
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
  router.delete('/:id/proxy/*', requireBotOwnershipOrSuperadmin, async (req: Request, res: Response) => {
    try {
      // Check rate limit before processing
      const rateLimitCheck = await checkRateLimit(req.params.id, res);
      if (!rateLimitCheck.allowed) {
        return; // Response already sent
      }

      const path = req.params[0] || '';
      const fullPath = path.startsWith('/') ? path : `/${path}`;

      // Skip rate limit in proxyRequest since we already checked it above
      const data = await proxyRequest(req.params.id, 'DELETE', fullPath, undefined, true);
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

