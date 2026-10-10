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
import {
  listAlerts,
  acknowledgeAlert,
  acknowledgeAllAlerts,
  getUnacknowledgedCount,
  type AlertScope,
} from '../services/alertService.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { alertsRateLimiter } from '../middleware/rateLimit.middleware.js';

function scopeFromRequest(req: Request): AlertScope | null {
  if (!req.user) return null;
  return { role: req.user.role, userId: req.user.id };
}

/**
 * Alert System routes - centralized alerts aggregated from all bot instances' events
 * (see services/alertService.ts, which subscribes to the existing event bus).
 *
 * Visibility: superadmin/auditor see all alerts; other roles only alerts for bots they own.
 * Alerts with null bot_id are visible only to superadmin/auditor.
 */
export function createAlertsRouter(): Router {
  const router = express.Router();

  router.use(alertsRateLimiter);
  router.use(authenticate);

  /**
   * @swagger
   * /api/alerts:
   *   get:
   *     summary: List alerts (scoped by bot ownership unless superadmin/auditor)
   */
  router.get('/', (req: Request, res: Response) => {
    const scope = scopeFromRequest(req);
    if (!scope) {
      res.status(401).json({ status: 'error', message: 'Unauthorized' });
      return;
    }
    const unacknowledgedOnly = req.query.unacknowledgedOnly === 'true';
    const parsedLimit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;
    const limit = typeof parsedLimit === 'number' && Number.isFinite(parsedLimit) ? parsedLimit : undefined;
    const alerts = listAlerts({ unacknowledgedOnly, limit, ...scope });
    res.json({ status: 'success', data: alerts });
  });

  /**
   * @swagger
   * /api/alerts/unacknowledged-count:
   *   get:
   *     summary: Get the count of unacknowledged alerts visible to the caller
   */
  router.get('/unacknowledged-count', (req: Request, res: Response) => {
    const scope = scopeFromRequest(req);
    if (!scope) {
      res.status(401).json({ status: 'error', message: 'Unauthorized' });
      return;
    }
    res.json({ status: 'success', data: { count: getUnacknowledgedCount(scope) } });
  });

  /**
   * @swagger
   * /api/alerts/{id}/acknowledge:
   *   post:
   *     summary: Acknowledge a single alert (must be visible to caller)
   */
  router.post('/:id/acknowledge', (req: Request, res: Response) => {
    const scope = scopeFromRequest(req);
    if (!scope) {
      res.status(401).json({ status: 'error', message: 'Unauthorized' });
      return;
    }
    const result = acknowledgeAlert(req.params.id, scope);
    if (result === 'not_found') {
      res.status(404).json({ status: 'error', message: 'Alert not found' });
      return;
    }
    if (result === 'forbidden') {
      res.status(403).json({ status: 'error', message: 'Forbidden: you do not have access to this alert' });
      return;
    }
    res.json({ status: 'success' });
  });

  /**
   * @swagger
   * /api/alerts/acknowledge-all:
   *   post:
   *     summary: Acknowledge all unacknowledged alerts visible to the caller
   */
  router.post('/acknowledge-all', (req: Request, res: Response) => {
    const scope = scopeFromRequest(req);
    if (!scope) {
      res.status(401).json({ status: 'error', message: 'Unauthorized' });
      return;
    }
    const count = acknowledgeAllAlerts(scope);
    res.json({ status: 'success', data: { acknowledgedCount: count } });
  });

  return router;
}
