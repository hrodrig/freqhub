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
import { z } from 'zod';
import { proxyRequest } from '../services/proxyService.js';
import { getBotWithCredentials } from '../services/botService.js';
import { checkBotOwnership } from '../services/botOwnershipService.js';
import { createAuditLog } from '../services/auditService.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { appLogger } from '../utils/logger.js';

/**
 * Trade Management routes - execute trades (force-enter / force-exit-all) across multiple
 * bots at once. Mounted at its own top-level path (not nested under /api/bots) specifically
 * to avoid any ambiguity with /api/bots/:id/* patterns.
 *
 * Freqtrade's own REST API (proxied per-bot elsewhere via routes/proxy.ts) already supports
 * single-bot /api/v1/forceenter and /api/v1/forceexit - what's missing, and what this file
 * adds, is fanning either call out across a user-selected set of bots in one request, with
 * per-bot ownership checks and a per-bot audit trail (a bulk action still needs individual
 * accountability, not one combined log line).
 */

interface BotActionResult {
  botId: string;
  botName: string;
  success: boolean;
  error?: string;
  result?: unknown;
}

function requireBotAccessOrCollect(
  botId: string,
  userId: string,
  role: string,
  failures: BotActionResult[],
  botName: string
): boolean {
  if (role === 'superadmin') return true;
  const isOwner = checkBotOwnership(botId, userId);
  if (!isOwner) {
    failures.push({ botId, botName, success: false, error: 'Forbidden: you do not own this bot' });
    return false;
  }
  return true;
}

const forceEnterSchema = z.object({
  botIds: z.array(z.string().min(1)).min(1, 'At least one bot must be selected'),
  pair: z.string().min(1, 'Pair is required'),
  side: z.enum(['long', 'short']).optional(),
  ordertype: z.enum(['limit', 'market']).optional(),
  price: z.number().positive().optional(),
  stakeamount: z.number().positive().optional(),
  entryTag: z.string().optional(),
});

const forceExitAllSchema = z.object({
  botIds: z.array(z.string().min(1)).min(1, 'At least one bot must be selected'),
  ordertype: z.enum(['limit', 'market']).optional(),
});

export function createTradeManagementRouter(): Router {
  const router = express.Router();

  router.use(authenticate);

  /**
   * @swagger
   * /api/trade-management/force-enter:
   *   post:
   *     summary: Force-enter a position across multiple bots
   *     description: Fans out Freqtrade's /api/v1/forceenter call across a selected set of bots. Each bot is checked for ownership independently; a bot the caller doesn't own/isn't superadmin for is reported as a per-bot failure rather than failing the whole request.
   *     tags: [Trade Management]
   */
  router.post('/force-enter', async (req: Request, res: Response) => {
    const parsed = forceEnterSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ status: 'error', message: 'Invalid request', errors: parsed.error.errors });
      return;
    }
    if (!req.user) {
      res.status(401).json({ status: 'error', message: 'Unauthorized' });
      return;
    }
    const { botIds, pair, side, ordertype, price, stakeamount, entryTag } = parsed.data;

    const results: BotActionResult[] = [];
    for (const botId of botIds) {
      const bot = getBotWithCredentials(botId);
      const botName = bot?.name || botId;

      if (!bot) {
        results.push({ botId, botName, success: false, error: 'Bot not found' });
        continue;
      }
      if (!requireBotAccessOrCollect(botId, req.user.id, req.user.role, results, botName)) {
        continue;
      }

      const body: Record<string, unknown> = { pair };
      if (side) body.side = side;
      if (ordertype) body.ordertype = ordertype;
      if (price) body.price = price;
      if (stakeamount) body.stakeamount = stakeamount;
      if (entryTag) body.entry_tag = entryTag;

      try {
        const result = await proxyRequest(botId, 'POST', 'api/v1/forceenter', body, true);
        results.push({ botId, botName, success: true, result });
        createAuditLog({
          userId: req.user.id,
          action: 'trade_force_enter',
          actionCategory: 'system_action',
          resourceType: 'bot',
          resourceId: botId,
          details: { pair, side, ordertype, price, stakeamount, entryTag },
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Force-enter failed';
        appLogger.error(`Force-enter failed for bot ${botId}:`, err);
        results.push({ botId, botName, success: false, error: message });
      }
    }

    const allFailed = results.every((r) => !r.success);
    res.status(allFailed ? 502 : 200).json({ status: allFailed ? 'error' : 'success', data: results });
  });

  /**
   * @swagger
   * /api/trade-management/force-exit-all:
   *   post:
   *     summary: Force-exit ALL open positions across multiple bots
   *     description: Fans out Freqtrade's /api/v1/forceexit (tradeid "all") across a selected set of bots, closing every open position on each. For closing a single specific trade within one bot, use that bot's own detail page/proxy call instead.
   *     tags: [Trade Management]
   */
  router.post('/force-exit-all', async (req: Request, res: Response) => {
    const parsed = forceExitAllSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ status: 'error', message: 'Invalid request', errors: parsed.error.errors });
      return;
    }
    if (!req.user) {
      res.status(401).json({ status: 'error', message: 'Unauthorized' });
      return;
    }
    const { botIds, ordertype } = parsed.data;

    const results: BotActionResult[] = [];
    for (const botId of botIds) {
      const bot = getBotWithCredentials(botId);
      const botName = bot?.name || botId;

      if (!bot) {
        results.push({ botId, botName, success: false, error: 'Bot not found' });
        continue;
      }
      if (!requireBotAccessOrCollect(botId, req.user.id, req.user.role, results, botName)) {
        continue;
      }

      const body: Record<string, unknown> = { tradeid: 'all' };
      if (ordertype) body.ordertype = ordertype;

      try {
        const result = await proxyRequest(botId, 'POST', 'api/v1/forceexit', body, true);
        results.push({ botId, botName, success: true, result });
        createAuditLog({
          userId: req.user.id,
          action: 'trade_force_exit_all',
          actionCategory: 'system_action',
          resourceType: 'bot',
          resourceId: botId,
          details: { ordertype },
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Force-exit failed';
        appLogger.error(`Force-exit-all failed for bot ${botId}:`, err);
        results.push({ botId, botName, success: false, error: message });
      }
    }

    const allFailed = results.every((r) => !r.success);
    res.status(allFailed ? 502 : 200).json({ status: allFailed ? 'error' : 'success', data: results });
  });

  return router;
}
