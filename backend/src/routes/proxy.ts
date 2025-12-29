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
import { getBotWithCredentials } from '../services/botService.js';
import { decryptPassword } from '../services/encryptionService.js';

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
   * Proxy GET request
   * GET /api/bots/:id/proxy/*
   */
  router.get('/:id/proxy/*', async (req: Request, res: Response) => {
    try {
      const path = req.params[0] || '';
      const fullPath = path.startsWith('/') ? path : `/${path}`;
      const queryString = req.url.includes('?') ? req.url.split('?')[1] : '';
      const finalPath = queryString ? `${fullPath}?${queryString}` : fullPath;

      const data = await proxyRequest(req.params.id, 'GET', finalPath);
      res.json(data);
    } catch (error) {
      res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Proxy request failed',
      });
    }
  });

  /**
   * Proxy POST request
   * POST /api/bots/:id/proxy/*
   */
  router.post('/:id/proxy/*', async (req: Request, res: Response) => {
    try {
      const path = req.params[0] || '';
      const fullPath = path.startsWith('/') ? path : `/${path}`;

      const data = await proxyRequest(req.params.id, 'POST', fullPath, req.body);
      res.json(data);
    } catch (error) {
      res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Proxy request failed',
      });
    }
  });

  /**
   * Proxy PUT request
   * PUT /api/bots/:id/proxy/*
   */
  router.put('/:id/proxy/*', async (req: Request, res: Response) => {
    try {
      const path = req.params[0] || '';
      const fullPath = path.startsWith('/') ? path : `/${path}`;

      const data = await proxyRequest(req.params.id, 'PUT', fullPath, req.body);
      res.json(data);
    } catch (error) {
      res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Proxy request failed',
      });
    }
  });

  /**
   * Proxy DELETE request
   * DELETE /api/bots/:id/proxy/*
   */
  router.delete('/:id/proxy/*', async (req: Request, res: Response) => {
    try {
      const path = req.params[0] || '';
      const fullPath = path.startsWith('/') ? path : `/${path}`;

      const data = await proxyRequest(req.params.id, 'DELETE', fullPath);
      res.json(data);
    } catch (error) {
      res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Proxy request failed',
      });
    }
  });

  return router;
}

