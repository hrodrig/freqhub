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
import { listAlerts, acknowledgeAlert, acknowledgeAllAlerts, getUnacknowledgedCount } from '../services/alertService.js';
import { authenticate } from '../middleware/auth.middleware.js';

/**
 * Alert System routes - centralized alerts aggregated from all bot instances' events
 * (see services/alertService.ts, which subscribes to the existing event bus).
 */
export function createAlertsRouter(): Router {
  const router = express.Router();

  router.use(authenticate);

  /**
   * @swagger
   * /api/alerts:
   *   get:
   *     summary: List alerts
   */
  router.get('/', (req: Request, res: Response) => {
    const unacknowledgedOnly = req.query.unacknowledgedOnly === 'true';
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;
    const alerts = listAlerts({ unacknowledgedOnly, limit });
    res.json({ status: 'success', data: alerts });
  });

  /**
   * @swagger
   * /api/alerts/unacknowledged-count:
   *   get:
   *     summary: Get the count of unacknowledged alerts
   */
  router.get('/unacknowledged-count', (_req: Request, res: Response) => {
    res.json({ status: 'success', data: { count: getUnacknowledgedCount() } });
  });

  /**
   * @swagger
   * /api/alerts/{id}/acknowledge:
   *   post:
   *     summary: Acknowledge a single alert
   */
  router.post('/:id/acknowledge', (req: Request, res: Response) => {
    if (!req.user) {
      res.status(401).json({ status: 'error', message: 'Unauthorized' });
      return;
    }
    const found = acknowledgeAlert(req.params.id, req.user.id);
    if (!found) {
      res.status(404).json({ status: 'error', message: 'Alert not found' });
      return;
    }
    res.json({ status: 'success' });
  });

  /**
   * @swagger
   * /api/alerts/acknowledge-all:
   *   post:
   *     summary: Acknowledge all currently-unacknowledged alerts
   */
  router.post('/acknowledge-all', (req: Request, res: Response) => {
    if (!req.user) {
      res.status(401).json({ status: 'error', message: 'Unauthorized' });
      return;
    }
    const count = acknowledgeAllAlerts(req.user.id);
    res.json({ status: 'success', data: { acknowledgedCount: count } });
  });

  return router;
}
