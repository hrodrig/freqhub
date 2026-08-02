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
import { authenticate } from '../middleware/auth.middleware.js';
import { requireBotOwnershipOrSuperadmin, requireBotViewAccess } from '../middleware/authorize.middleware.js';
import { appLogger } from '../utils/logger.js';

/**
 * Backtest Comparison routes - trigger and poll each bot's own Freqtrade backtest engine
 * (POST/GET /api/v1/backtest, confirmed present in Freqtrade's REST API - see
 * freqtrade/rpc/api_server/api_backtest.py) against its OWN currently-configured strategy, so
 * results can be compared side by side across bots.
 *
 * Mounted at /api/backtest/:id/* (top-level, not nested under /api/bots) for the same reason
 * as trade-management: avoids any ambiguity with /api/bots/:id/* patterns. Uses :id (not
 * :botId) specifically so the existing requireBotOwnershipOrSuperadmin/requireBotViewAccess
 * middleware - which reads req.params.id - works unmodified.
 *
 * Not yet live-verified against a real deployed bot (built directly against Freqtrade's
 * confirmed API schema/source, same discipline as everything else in this fork - see this
 * repo's TODO.md).
 */

const startBacktestSchema = z.object({
  timerange: z.string().optional(),
  timeframe: z.string().optional(),
});

interface FreqtradeBacktestResponse {
  status: string;
  running: boolean;
  status_msg?: string;
  step?: string;
  progress?: number;
  trade_count?: number | null;
  backtest_result?: {
    strategy?: Record<
      string,
      {
        total_trades?: number;
        profit_total_pct?: number;
        profit_total_abs?: number;
        wins?: number;
        losses?: number;
        max_drawdown_account?: number;
        backtest_start?: string;
        backtest_end?: string;
      }
    >;
  } | null;
}

function summarizeBacktestResult(
  data: FreqtradeBacktestResponse,
  strategyName: string | undefined
) {
  const strategyResults = strategyName ? data.backtest_result?.strategy?.[strategyName] : undefined;
  if (!strategyResults) return null;
  const wins = strategyResults.wins ?? 0;
  const losses = strategyResults.losses ?? 0;
  const totalTrades = strategyResults.total_trades ?? wins + losses;
  return {
    strategy: strategyName,
    totalTrades,
    profitTotalPct: strategyResults.profit_total_pct,
    profitTotalAbs: strategyResults.profit_total_abs,
    winRate: totalTrades > 0 ? wins / totalTrades : undefined,
    maxDrawdownPct: strategyResults.max_drawdown_account,
    backtestStart: strategyResults.backtest_start,
    backtestEnd: strategyResults.backtest_end,
  };
}

export function createBacktestRouter(): Router {
  const router = express.Router();

  router.use(authenticate);

  /**
   * @swagger
   * /api/backtest/{id}/start:
   *   post:
   *     summary: Start a backtest on a single bot, against its own configured strategy
   */
  router.post('/:id/start', requireBotOwnershipOrSuperadmin, async (req: Request, res: Response) => {
    const parsed = startBacktestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ status: 'error', message: 'Invalid request', errors: parsed.error.errors });
      return;
    }
    const botId = req.params.id;

    try {
      // Each bot only ever runs one strategy (confirmed - no supported multi-strategy mode),
      // so the strategy to backtest is always whatever this bot is already configured with.
      const config = (await proxyRequest(botId, 'GET', 'api/v1/show_config', undefined, true)) as {
        strategy?: string;
      } | null;
      if (!config?.strategy) {
        res.status(502).json({ status: 'error', message: "Could not determine this bot's configured strategy" });
        return;
      }

      const body = {
        strategy: config.strategy,
        timerange: parsed.data.timerange,
        timeframe: parsed.data.timeframe,
        enable_protections: true,
      };
      const result = await proxyRequest(botId, 'POST', 'api/v1/backtest', body, true);
      res.json({ status: 'success', data: result });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to start backtest';
      appLogger.error(`Failed to start backtest for bot ${botId}:`, err);
      res.status(502).json({ status: 'error', message });
    }
  });

  /**
   * @swagger
   * /api/backtest/{id}/status:
   *   get:
   *     summary: Poll a bot's current/last backtest status and results
   */
  router.get('/:id/status', requireBotViewAccess, async (req: Request, res: Response) => {
    const botId = req.params.id;
    try {
      const [configResult, backtestResult] = await Promise.allSettled([
        proxyRequest(botId, 'GET', 'api/v1/show_config', undefined, true),
        proxyRequest(botId, 'GET', 'api/v1/backtest', undefined, true),
      ]);

      const config = configResult.status === 'fulfilled' ? (configResult.value as { strategy?: string } | null) : null;
      const backtest =
        backtestResult.status === 'fulfilled' ? (backtestResult.value as FreqtradeBacktestResponse) : null;

      if (!backtest) {
        const reason = backtestResult.status === 'rejected' ? backtestResult.reason : null;
        res.status(502).json({
          status: 'error',
          message: reason instanceof Error ? reason.message : 'Failed to fetch backtest status',
        });
        return;
      }

      res.json({
        status: 'success',
        data: {
          botId,
          running: !!backtest.running,
          progress: backtest.progress,
          status: backtest.status_msg || backtest.status,
          results: summarizeBacktestResult(backtest, config?.strategy),
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch backtest status';
      appLogger.error(`Failed to fetch backtest status for bot ${botId}:`, err);
      res.status(502).json({ status: 'error', message });
    }
  });

  /**
   * @swagger
   * /api/backtest/{id}/abort:
   *   post:
   *     summary: Abort a running backtest on a bot
   *     description: Freqtrade's own abort endpoint is (unusually) a GET, not a POST - proxied here as documented upstream rather than "corrected", since this just forwards to Freqtrade's real API surface.
   */
  router.post('/:id/abort', requireBotOwnershipOrSuperadmin, async (req: Request, res: Response) => {
    const botId = req.params.id;
    try {
      await proxyRequest(botId, 'GET', 'api/v1/backtest/abort', undefined, true);
      res.json({ status: 'success' });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to abort backtest';
      appLogger.error(`Failed to abort backtest for bot ${botId}:`, err);
      res.status(502).json({ status: 'error', message });
    }
  });

  return router;
}
