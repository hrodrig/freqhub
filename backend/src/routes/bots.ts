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
import {
  getAllBots,
  getBotById,
  createBot,
  updateBot,
  deleteBot,
} from '../services/botService.js';
import { testBotConnection } from '../services/proxyService.js';
import { setBotRunmode, type BotRunmode } from '../services/runmodeEditor.service.js';
import { createAuditLog } from '../services/auditService.js';
import type { CreateBotRequest, UpdateBotRequest } from '../models/Bot.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { requireBotOwnershipOrSuperadmin, requireBotViewAccess } from '../middleware/authorize.middleware.js';
import { getBotsOwnedByUser } from '../services/botOwnershipService.js';
import { assignBotOwnership } from '../services/botOwnershipService.js';
import { validateBotApiUrl, validateBotWsUrl } from '../utils/urlSecurity.js';

const createBotSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  apiUrl: z.string().url('Invalid API URL').refine((val) => validateBotApiUrl(val).ok, {
    message: 'API URL is not allowed (security policy)',
  }),
  wsUrl: z
    .string()
    .url('Invalid WebSocket URL')
    .optional()
    .refine((val) => (val ? validateBotWsUrl(val).ok : true), {
      message: 'WebSocket URL is not allowed (security policy)',
    }),
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
  notes: z.string().optional(),
  configMapName: z.string().optional(),
  configPath: z.string().optional(),
}).superRefine((data, ctx) => {
  const hasConfigMap = Boolean(data.configMapName?.trim());
  const hasConfigPath = Boolean(data.configPath?.trim());
  if (hasConfigMap && hasConfigPath) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Provide either configMapName or configPath, not both',
      path: ['configMapName'],
    });
  }
});

const updateBotSchema = z.object({
  name: z.string().min(1).optional(),
  apiUrl: z
    .string()
    .url()
    .optional()
    .refine((val) => (val ? validateBotApiUrl(val).ok : true), {
      message: 'API URL is not allowed (security policy)',
    }),
  wsUrl: z
    .string()
    .url()
    .optional()
    .refine((val) => (val ? validateBotWsUrl(val).ok : true), {
      message: 'WebSocket URL is not allowed (security policy)',
    }),
  username: z.string().min(1).optional(),
  password: z.string().min(1).optional(),
  isEnabled: z.boolean().optional(),
  isSelected: z.boolean().optional(),
  notes: z.string().optional(),
  configMapName: z.string().optional(),
  configPath: z.string().optional(),
}).superRefine((data, ctx) => {
  const hasConfigMap = Boolean(data.configMapName?.trim());
  const hasConfigPath = Boolean(data.configPath?.trim());
  if (hasConfigMap && hasConfigPath) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Provide either configMapName or configPath, not both',
      path: ['configMapName'],
    });
  }
});

const runmodeSchema = z.object({
  runmode: z.enum(['dry_run', 'live']),
});

export function createBotsRouter(): Router {
  const router = express.Router();

  // All routes require authentication
  router.use(authenticate);

  /**
   * @swagger
   * /api/bots:
   *   get:
   *     summary: List all bots
   *     description: Returns a list of bots. Superadmin and Auditor see all bots, regular users see only their own bots.
   *     tags: [Bots]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: List of bots
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 status:
   *                   type: string
   *                   example: success
   *                 data:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/Bot'
   *       500:
   *         description: Server error
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   */
  router.get('/', async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ status: 'error', message: 'Unauthorized' });
      }

      let bots = getAllBots();

      // Filter bots based on user role
      if (req.user.role === 'superadmin' || req.user.role === 'auditor') {
        // Superadmin and Auditor can see all bots
        // No filtering needed
      } else {
        // Regular users can only see their own bots
        const ownedBotIds = getBotsOwnedByUser(req.user.id);
        bots = bots.filter(bot => ownedBotIds.includes(bot.id));
      }

      return res.json({ status: 'success', data: bots });
    } catch (error) {
      return res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to get bots',
      });
    }
  });

  /**
   * @swagger
   * /api/bots/{id}:
   *   get:
   *     summary: Get bot by ID
   *     description: Returns a specific bot by its ID
   *     tags: [Bots]
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
   *         description: Bot found
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 status:
   *                   type: string
   *                   example: success
   *                 data:
   *                   $ref: '#/components/schemas/Bot'
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
  router.get('/:id', requireBotViewAccess, async (req: Request, res: Response) => {
    try {
      const bot = getBotById(req.params.id);
      if (!bot) {
        return res.status(404).json({
          status: 'error',
          message: 'Bot not found',
        });
      }
      return res.json({ status: 'success', data: bot });
    } catch (error) {
      return res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to get bot',
      });
    }
  });

  /**
   * @swagger
   * /api/bots:
   *   post:
   *     summary: Create a new bot
   *     description: Creates a new bot configuration and tests the connection to Freqtrade
   *     tags: [Bots]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/CreateBotRequest'
   *     responses:
   *       201:
   *         description: Bot created successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 status:
   *                   type: string
   *                   example: success
   *                 data:
   *                   $ref: '#/components/schemas/Bot'
   *       400:
   *         description: Validation error or connection failed
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
  router.post('/', async (req: Request, res: Response) => {
    try {
      const validated = createBotSchema.parse(req.body);
      
      // Test connection before creating
      const isConnected = await testBotConnection(
        validated.apiUrl,
        validated.username,
        validated.password
      );

      if (!isConnected) {
        return res.status(400).json({
          status: 'error',
          message: 'Failed to connect to Freqtrade bot. Please check your credentials and API URL.',
        });
      }

      const bot = await createBot(validated as CreateBotRequest);
      
      // Assign ownership to the user who created it (unless superadmin)
      if (req.user && req.user.role !== 'superadmin') {
        assignBotOwnership(bot.id, req.user.id, req.user.id);
      }
      
      return res.status(201).json({ status: 'success', data: bot });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          status: 'error',
          message: 'Validation error',
          errors: error.errors,
        });
      }
      return res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to create bot',
      });
    }
  });

  /**
   * @swagger
   * /api/bots/{id}:
   *   put:
   *     summary: Update a bot
   *     description: Updates an existing bot configuration
   *     tags: [Bots]
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
   *             $ref: '#/components/schemas/UpdateBotRequest'
   *     responses:
   *       200:
   *         description: Bot updated successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 status:
   *                   type: string
   *                   example: success
   *                 data:
   *                   $ref: '#/components/schemas/Bot'
   *       400:
   *         description: Validation error
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
  router.put('/:id', requireBotOwnershipOrSuperadmin, async (req: Request, res: Response) => {
    try {
      const validated = updateBotSchema.parse(req.body);
      const bot = await updateBot(req.params.id, validated as UpdateBotRequest);
      if (!bot) {
        return res.status(404).json({
          status: 'error',
          message: 'Bot not found',
        });
      }
      return res.json({ status: 'success', data: bot });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          status: 'error',
          message: 'Validation error',
          errors: error.errors,
        });
      }
      return res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to update bot',
      });
    }
  });

  /**
   * @swagger
   * /api/bots/{id}/runmode:
   *   post:
   *     summary: Update bot runmode (dry_run/live)
   *     description: Updates bot runmode by editing config.json and reloading config
   *     tags: [Bots]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: Bot ID
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               runmode:
   *                 type: string
   *                 enum: [dry_run, live]
   *     responses:
   *       200:
   *         description: Runmode updated successfully
   *       400:
   *         description: Validation error
   *       500:
   *         description: Server error
   */
  router.post('/:id/runmode', requireBotOwnershipOrSuperadmin, async (req: Request, res: Response) => {
    try {
      const validated = runmodeSchema.parse(req.body);
      const result = await setBotRunmode(req.params.id, validated.runmode as BotRunmode);

      try {
        const userId = req.user?.id ?? 'system';
        createAuditLog({
          userId,
          action: 'runmode_change',
          actionCategory: 'system_action',
          resourceType: 'bot',
          resourceId: req.params.id,
          oldValue: { runmode: result.previousRunmode },
          newValue: { runmode: result.runmode },
          changedFields: ['runmode'],
          details: {
            configPath: result.configPath,
            method: req.method,
            path: req.path,
          },
          ipAddress: req.ip || req.socket.remoteAddress || undefined,
          userAgent: req.get('user-agent') || undefined,
        });
      } catch {
        // Don't fail the request if audit logging fails
      }

      return res.json({
        status: 'success',
        data: {
          runmode: result.runmode,
          previousRunmode: result.previousRunmode,
        },
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          status: 'error',
          message: 'Validation error',
          errors: error.errors,
        });
      }
      const message = error instanceof Error ? error.message : 'Failed to update runmode';
      const status = message.includes('disabled') ||
        message.includes('not set') ||
        message.includes('not allowed') ||
        message.includes('parse') ||
        message.includes('not found')
        ? 400
        : 500;
      return res.status(status).json({
        status: 'error',
        message,
      });
    }
  });

  /**
   * @swagger
   * /api/bots/{id}:
   *   delete:
   *     summary: Delete a bot
   *     description: Deletes a bot configuration
   *     tags: [Bots]
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
   *         description: Bot deleted successfully
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
   *                   example: Bot deleted
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
  router.delete('/:id', requireBotOwnershipOrSuperadmin, async (req: Request, res: Response) => {
    try {
      const deleted = deleteBot(req.params.id);
      if (!deleted) {
        return res.status(404).json({
          status: 'error',
          message: 'Bot not found',
        });
      }
      return res.json({ status: 'success', message: 'Bot deleted' });
    } catch (error) {
      return res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to delete bot',
      });
    }
  });

  return router;
}

