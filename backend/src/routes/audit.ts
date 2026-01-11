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
import { getAuditLogs, getResourceHistory, getAuditLogCount, createAuditLog } from '../services/auditService.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { requireRole } from '../middleware/authorize.middleware.js';
import { appLogger } from '../utils/logger.js';

const router = Router();

// All routes require authentication and superadmin/auditor role
router.use(authenticate);
router.use(requireRole('superadmin', 'auditor'));

// Validation schema
const auditFiltersSchema = z.object({
  userId: z.string().uuid().optional(),
  action: z.string().optional(),
  actionCategory: z.enum(['data_change', 'data_access', 'system_action', 'auth']).optional(),
  resourceType: z.string().optional(),
  resourceId: z.string().optional(),
  startDate: z.string().transform((val) => parseInt(val, 10)).optional(),
  endDate: z.string().transform((val) => parseInt(val, 10)).optional(),
  limit: z.string().transform((val) => parseInt(val, 10)).optional(),
  offset: z.string().transform((val) => parseInt(val, 10)).optional(),
});

/**
 * @swagger
 * /api/audit:
 *   get:
 *     summary: Get audit logs
 *     description: Returns audit logs with optional filters. Only superadmin and auditor can access.
 *     tags: [Audit]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: userId
 *         schema:
 *           type: string
 *         description: Filter by user ID
 *       - in: query
 *         name: action
 *         schema:
 *           type: string
 *         description: Filter by action type
 *       - in: query
 *         name: actionCategory
 *         schema:
 *           type: string
 *           enum: [data_change, data_access, system_action, auth]
 *         description: Filter by action category
 *       - in: query
 *         name: resourceType
 *         schema:
 *           type: string
 *         description: Filter by resource type
 *       - in: query
 *         name: resourceId
 *         schema:
 *           type: string
 *         description: Filter by resource ID
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: integer
 *         description: Start date timestamp
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: integer
 *         description: End date timestamp
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Maximum number of results
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *         description: Offset for pagination
 *     responses:
 *       200:
 *         description: List of audit logs
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - insufficient permissions
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const filters = auditFiltersSchema.parse(req.query);
    const logs = getAuditLogs(filters);
    const total = getAuditLogCount(filters);

    // Audit the access to audit logs (with meta flag to prevent loops)
    try {
      createAuditLog({
        userId: req.user.id,
        action: 'view',
        actionCategory: 'data_access',
        resourceType: 'audit_log',
        resourceId: null,
        details: {
          method: req.method,
          path: req.path,
          filters: filters,
          resultCount: logs.length,
          isMetaAudit: true, // Flag to indicate this is auditing the audit system itself
        },
        ipAddress: req.ip || req.socket.remoteAddress || undefined,
        userAgent: req.get('user-agent') || undefined,
      });
    } catch (auditError) {
      // Don't fail the request if audit logging fails
      appLogger.warn('Failed to audit audit log access:', auditError);
    }

    return res.json({
      status: 'success',
      data: logs,
      pagination: {
        total,
        limit: filters.limit || 100,
        offset: filters.offset || 0,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid filters', details: error.errors });
      return;
    }

    appLogger.error('Get audit logs error:', error);
    return res.status(500).json({ error: 'Failed to get audit logs' });
  }
});

/**
 * @swagger
 * /api/audit/resource/{resourceType}/{resourceId}:
 *   get:
 *     summary: Get resource history
 *     description: Returns audit logs for a specific resource. Only superadmin and auditor can access.
 *     tags: [Audit]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: resourceType
 *         required: true
 *         schema:
 *           type: string
 *         description: Resource type (e.g., 'bot', 'user')
 *       - in: path
 *         name: resourceId
 *         required: true
 *         schema:
 *           type: string
 *         description: Resource ID
 *     responses:
 *       200:
 *         description: Resource history
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - insufficient permissions
 */
router.get('/resource/:resourceType/:resourceId', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { resourceType, resourceId } = req.params;
    const history = getResourceHistory(resourceType, resourceId);

    // Audit the access to resource history (with meta flag)
    try {
      createAuditLog({
        userId: req.user.id,
        action: 'view',
        actionCategory: 'data_access',
        resourceType: 'audit_log',
        resourceId: null,
        details: {
          method: req.method,
          path: req.path,
          resourceType,
          resourceId,
          resultCount: history.length,
          isMetaAudit: true, // Flag to indicate this is auditing the audit system itself
        },
        ipAddress: req.ip || req.socket.remoteAddress || undefined,
        userAgent: req.get('user-agent') || undefined,
      });
    } catch (auditError) {
      // Don't fail the request if audit logging fails
      appLogger.warn('Failed to audit resource history access:', auditError);
    }

    return res.json({
      status: 'success',
      data: history,
    });
  } catch (error) {
    appLogger.error('Get resource history error:', error);
    return res.status(500).json({ error: 'Failed to get resource history' });
  }
});

export function createAuditRouter(): Router {
  return router;
}

