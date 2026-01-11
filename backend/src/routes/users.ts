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

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import bcrypt from 'bcrypt';
import {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  usernameExists,
  emailExists,
  userExists,
} from '../services/userService.js';
import { assignBotOwnership, removeBotOwnership, getBotsOwnedByUser } from '../services/botOwnershipService.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { requireSuperadmin } from '../middleware/authorize.middleware.js';
import { audit } from '../middleware/audit.middleware.js';
import { getBotById } from '../services/botService.js';
import { appLogger } from '../utils/logger.js';
import type { CreateUserRequest, UpdateUserRequest } from '../models/User.js';

const router = Router();

// All routes require authentication and superadmin role
router.use(authenticate);
router.use(requireSuperadmin);

// Validation schemas
const createUserSchema = z.object({
  username: z.string().min(1, 'Username is required').max(100, 'Username too long'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  role: z.enum(['superadmin', 'auditor', 'user']).optional(),
  isActive: z.boolean().optional(),
  mustChangePassword: z.boolean().optional(),
});

const updateUserSchema = z.object({
  username: z.string().min(1).max(100).optional(),
  name: z.string().max(100).nullable().optional(),
  email: z.string().email().optional(),
  password: z.string().min(8).optional(),
  role: z.enum(['superadmin', 'auditor', 'user']).optional(),
  isActive: z.boolean().optional(),
  mustChangePassword: z.boolean().optional(),
});

/**
 * @swagger
 * /api/users:
 *   get:
 *     summary: List all users
 *     description: Returns a list of all users. Only superadmin can access.
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of users
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - insufficient permissions
 */
router.get(
  '/',
  audit({
    action: 'view',
    actionCategory: 'data_access',
    resourceType: 'user',
  }),
  async (_req: Request, res: Response) => {
    try {
      const users = getAllUsers();
      return res.json({ status: 'success', data: users });
    } catch (error) {
      appLogger.error('Get all users error:', error);
      return res.status(500).json({ error: 'Failed to get users' });
    }
  }
);

/**
 * @swagger
 * /api/users/{id}:
 *   get:
 *     summary: Get user by ID
 *     description: Returns a specific user by its ID. Only superadmin can access.
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: User ID
 *     responses:
 *       200:
 *         description: User found
 *       404:
 *         description: User not found
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - insufficient permissions
 */
router.get(
  '/:id',
  audit({
    action: 'view',
    actionCategory: 'data_access',
    resourceType: 'user',
    getResourceId: (req) => req.params.id,
  }),
  async (req: Request, res: Response) => {
    try {
      const user = getUserById(req.params.id);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      return res.json({ status: 'success', data: user });
    } catch (error) {
      appLogger.error('Get user error:', error);
      return res.status(500).json({ error: 'Failed to get user' });
    }
  }
);

/**
 * @swagger
 * /api/users:
 *   post:
 *     summary: Create a new user
 *     description: Creates a new user. Only superadmin can access.
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - email
 *               - password
 *             properties:
 *               username:
 *                 type: string
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *               role:
 *                 type: string
 *                 enum: [superadmin, auditor, user]
 *               isActive:
 *                 type: boolean
 *               mustChangePassword:
 *                 type: boolean
 *     responses:
 *       201:
 *         description: User created successfully
 *       400:
 *         description: Validation error or username/email already exists
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - insufficient permissions
 */
router.post(
  '/',
  audit({
    action: 'create',
    actionCategory: 'data_change',
    resourceType: 'user',
    getNewValue: (_req, res) => {
      const response = res as Response & { responseData?: unknown };
      if (response.responseData && typeof response.responseData === 'object') {
        const data = response.responseData as { data?: unknown; status?: string };
        if (data.status === 'success' && data.data) {
          return data.data;
        }
      }
      return null;
    },
  }),
  async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const validated = createUserSchema.parse(req.body);

      // Check if username already exists
      if (usernameExists(validated.username)) {
        return res.status(400).json({ error: 'Username already exists' });
      }

      // Check if email already exists
      if (emailExists(validated.email)) {
        return res.status(400).json({ error: 'Email already exists' });
      }

      // Hash password
      const passwordHash = await bcrypt.hash(validated.password, 10);

      // Create user
      const userRequest: CreateUserRequest = {
        username: validated.username,
        email: validated.email,
        password: passwordHash, // Already hashed
        role: validated.role || 'user',
        isActive: validated.isActive !== false,
        mustChangePassword: validated.mustChangePassword || false,
      };

      const user = createUser(userRequest, req.user.id);

      return res.status(201).json({ status: 'success', data: user });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation error', details: error.errors });
      }

      appLogger.error('Create user error:', error);
      return res.status(500).json({ error: 'Failed to create user' });
    }
  }
);

/**
 * @swagger
 * /api/users/{id}:
 *   put:
 *     summary: Update a user
 *     description: Updates an existing user. Only superadmin can access.
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: User ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               username:
 *                 type: string
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *               role:
 *                 type: string
 *                 enum: [superadmin, auditor, user]
 *               isActive:
 *                 type: boolean
 *               mustChangePassword:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: User updated successfully
 *       400:
 *         description: Validation error
 *       404:
 *         description: User not found
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - insufficient permissions
 */
router.put(
  '/:id',
  audit({
    action: 'update',
    actionCategory: 'data_change',
    resourceType: 'user',
    getResourceId: (req) => req.params.id,
    getOldValue: async (req) => {
      const user = getUserById(req.params.id);
      return user || null;
    },
    getNewValue: (_req, res) => {
      const response = res as Response & { responseData?: unknown };
      if (response.responseData && typeof response.responseData === 'object') {
        const data = response.responseData as { data?: unknown; status?: string };
        if (data.status === 'success' && data.data) {
          return data.data;
        }
      }
      return null;
    },
  }),
  async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const validated = updateUserSchema.parse(req.body);

      // Check if user exists
      if (!userExists(req.params.id)) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Check if username already exists (excluding current user)
      if (validated.username && usernameExists(validated.username, req.params.id)) {
        return res.status(400).json({ error: 'Username already exists' });
      }

      // Check if email already exists (excluding current user)
      if (validated.email && emailExists(validated.email, req.params.id)) {
        return res.status(400).json({ error: 'Email already exists' });
      }

      // Prepare update request
      const updateRequest: UpdateUserRequest = { ...validated };

      // Hash password if provided
      if (validated.password) {
        updateRequest.password = await bcrypt.hash(validated.password, 10);
      }

      const user = updateUser(req.params.id, updateRequest, req.user.id);

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      return res.json({ status: 'success', data: user });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation error', details: error.errors });
      }

      appLogger.error('Update user error:', error);
      return res.status(500).json({ error: 'Failed to update user' });
    }
  }
);

/**
 * @swagger
 * /api/users/{id}:
 *   delete:
 *     summary: Delete a user
 *     description: Deletes a user. Only superadmin can access.
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: User ID
 *     responses:
 *       200:
 *         description: User deleted successfully
 *       404:
 *         description: User not found
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - insufficient permissions
 */
router.delete(
  '/:id',
  audit({
    action: 'delete',
    actionCategory: 'data_change',
    resourceType: 'user',
    getResourceId: (req) => req.params.id,
    getOldValue: async (req) => {
      const user = getUserById(req.params.id);
      return user || null;
    },
  }),
  async (req: Request, res: Response) => {
    try {
      // Prevent deleting yourself
      if (req.user && req.params.id === req.user.id) {
        return res.status(400).json({ error: 'Cannot delete your own account' });
      }

      // Check if user exists
      if (!userExists(req.params.id)) {
        return res.status(404).json({ error: 'User not found' });
      }

      const deleted = deleteUser(req.params.id);

      if (!deleted) {
        return res.status(404).json({ error: 'User not found' });
      }

      return res.json({ status: 'success', message: 'User deleted successfully' });
    } catch (error) {
      appLogger.error('Delete user error:', error);
      return res.status(500).json({ error: 'Failed to delete user' });
    }
  }
);

/**
 * @swagger
 * /api/users/{id}/bots/{botId}:
 *   post:
 *     summary: Assign bot to user
 *     description: Assigns a bot to a user. Only superadmin can access.
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: User ID
 *       - in: path
 *         name: botId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Bot ID
 *     responses:
 *       200:
 *         description: Bot assigned successfully
 *       404:
 *         description: User or bot not found
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - insufficient permissions
 */
router.post(
  '/:id/bots/:botId',
  audit({
    action: 'assign_bot',
    actionCategory: 'data_change',
    resourceType: 'bot_ownership',
    getResourceId: (req) => req.params.botId,
    getNewValue: (req) => ({ userId: req.params.id, botId: req.params.botId }),
  }),
  async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      // Check if user exists
      if (!userExists(req.params.id)) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Check if bot exists
      const bot = getBotById(req.params.botId);
      if (!bot) {
        return res.status(404).json({ error: 'Bot not found' });
      }

      // Assign bot ownership
      assignBotOwnership(req.params.botId, req.params.id, req.user.id);

      return res.json({ status: 'success', message: 'Bot assigned successfully' });
    } catch (error) {
      appLogger.error('Assign bot to user error:', error);
      return res.status(500).json({ error: 'Failed to assign bot to user' });
    }
  }
);

/**
 * @swagger
 * /api/users/{id}/bots/{botId}:
 *   delete:
 *     summary: Remove bot from user
 *     description: Removes a bot from a user. Only superadmin can access.
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: User ID
 *       - in: path
 *         name: botId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Bot ID
 *     responses:
 *       200:
 *         description: Bot removed successfully
 *       404:
 *         description: User or bot not found
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - insufficient permissions
 */
router.delete(
  '/:id/bots/:botId',
  audit({
    action: 'unassign_bot',
    actionCategory: 'data_change',
    resourceType: 'bot_ownership',
    getResourceId: (req) => req.params.botId,
    getOldValue: (req) => ({ userId: req.params.id, botId: req.params.botId }),
  }),
  async (req: Request, res: Response) => {
    try {
      // Check if user exists
      if (!userExists(req.params.id)) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Check if bot exists
      const bot = getBotById(req.params.botId);
      if (!bot) {
        return res.status(404).json({ error: 'Bot not found' });
      }

      // Remove bot ownership
      removeBotOwnership(req.params.botId, req.params.id);

      return res.json({ status: 'success', message: 'Bot removed successfully' });
    } catch (error) {
      appLogger.error('Remove bot from user error:', error);
      return res.status(500).json({ error: 'Failed to remove bot from user' });
    }
  }
);

/**
 * @swagger
 * /api/users/{id}/bots:
 *   get:
 *     summary: Get user's bots
 *     description: Returns all bots assigned to a user. Only superadmin can access.
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: User ID
 *     responses:
 *       200:
 *         description: List of bots assigned to user
 *       404:
 *         description: User not found
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - insufficient permissions
 */
router.get(
  '/:id/bots',
  audit({
    action: 'view',
    actionCategory: 'data_access',
    resourceType: 'bot_ownership',
    getResourceId: (req) => req.params.id,
  }),
  async (req: Request, res: Response) => {
    try {
      // Check if user exists
      if (!userExists(req.params.id)) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Get bot IDs owned by user
      const botIds = getBotsOwnedByUser(req.params.id);

      // Get full bot objects
      const bots = botIds.map(botId => getBotById(botId)).filter(bot => bot !== null);

      return res.json({ status: 'success', data: bots });
    } catch (error) {
      appLogger.error('Get user bots error:', error);
      return res.status(500).json({ error: 'Failed to get user bots' });
    }
  }
);

export function createUsersRouter(): Router {
  return router;
}

