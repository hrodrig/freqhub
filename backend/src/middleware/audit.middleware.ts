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

import { Request, Response, NextFunction } from 'express';
import { createAuditLog } from '../services/auditService.js';
import { appLogger } from '../utils/logger.js';

export interface AuditOptions {
  action: string;
  actionCategory: 'data_change' | 'data_access' | 'system_action' | 'auth';
  resourceType: string;
  getResourceId?: (req: Request) => string | null;
  getOldValue?: (req: Request) => unknown | null;
  getNewValue?: (req: Request, res: Response) => unknown | null;
  getChangedFields?: (oldValue: unknown, newValue: unknown) => string[] | null;
  sanitizeSensitiveData?: (data: unknown) => unknown;
}

/**
 * Fields that should be sanitized in audit logs
 */
const SENSITIVE_FIELDS = [
  'password',
  'password_hash',
  'encrypted_password',
  'access_token',
  'token',
  'secret',
  'api_key',
  'api_secret',
];

/**
 * Sanitize sensitive fields from an object
 */
function sanitizeSensitiveFields(data: unknown): unknown {
  if (!data || typeof data !== 'object') {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map(item => sanitizeSensitiveFields(item));
  }

  const sanitized = { ...data as Record<string, unknown> };
  for (const key in sanitized) {
    if (SENSITIVE_FIELDS.some(field => key.toLowerCase().includes(field.toLowerCase()))) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
      sanitized[key] = sanitizeSensitiveFields(sanitized[key]);
    }
  }

  return sanitized;
}

/**
 * Get changed fields between old and new values
 */
function getChangedFields(oldValue: unknown, newValue: unknown): string[] | null {
  if (!oldValue || !newValue || typeof oldValue !== 'object' || typeof newValue !== 'object') {
    return null;
  }

  const old = oldValue as Record<string, unknown>;
  const new_ = newValue as Record<string, unknown>;
  const changed: string[] = [];

  // Check all keys in both objects
  const allKeys = new Set([...Object.keys(old), ...Object.keys(new_)]);
  for (const key of allKeys) {
    if (JSON.stringify(old[key]) !== JSON.stringify(new_[key])) {
      changed.push(key);
    }
  }

  return changed.length > 0 ? changed : null;
}

/**
 * Middleware to audit requests
 * Should be used after authentication and authorization middlewares
 */
export function audit(options: AuditOptions) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // Store original json method to capture response
    const originalJson = res.json.bind(res);
    let responseData: unknown = null;

    // Override res.json to capture response data
    res.json = function (body?: unknown) {
      responseData = body;
      return originalJson(body);
    };

    // Continue with the request
    next();

    // After response is sent, log the audit event
    // We need to wait for the response to be sent to capture the status code
    res.on('finish', () => {
      try {
        // Only log successful requests (2xx) or specific error cases
        if (res.statusCode >= 200 && res.statusCode < 300) {
          const userId = req.user?.id || 'system';
          const resourceId = options.getResourceId ? options.getResourceId(req) : null;
          const oldValue = options.getOldValue ? options.getOldValue(req) : null;
          const newValue = options.getNewValue ? options.getNewValue(req, res) : responseData;
          const changedFields = options.getChangedFields
            ? options.getChangedFields(oldValue, newValue)
            : getChangedFields(oldValue, newValue);

          // Sanitize sensitive data
          const sanitizedOldValue = oldValue ? sanitizeSensitiveFields(oldValue) : null;
          const sanitizedNewValue = newValue ? sanitizeSensitiveFields(newValue) : null;

          // Create audit log
          createAuditLog({
            userId,
            action: options.action,
            actionCategory: options.actionCategory,
            resourceType: options.resourceType,
            resourceId: resourceId || null,
            oldValue: sanitizedOldValue,
            newValue: sanitizedNewValue,
            changedFields: changedFields,
            details: {
              method: req.method,
              path: req.path,
              responseStatus: res.statusCode,
            },
            ipAddress: req.ip || req.socket.remoteAddress || undefined,
            userAgent: req.get('user-agent') || undefined,
          });
        }
      } catch (error) {
        // Don't fail the request if audit logging fails
        appLogger.error('Failed to create audit log:', error);
      }
    });
  };
}

/**
 * Helper to create audit middleware for common operations
 */
export const auditHelpers = {
  /**
   * Audit bot creation
   */
  botCreate: audit({
    action: 'create',
    actionCategory: 'data_change',
    resourceType: 'bot',
    getResourceId: () => {
      // Response should contain the created bot with id
      return null; // Will be set from response
    },
    getNewValue: (_req, res) => {
      // Get bot from response
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

  /**
   * Audit bot update
   */
  botUpdate: audit({
    action: 'update',
    actionCategory: 'data_change',
    resourceType: 'bot',
    getResourceId: (req) => req.params.id,
    getOldValue: async () => {
      // Would need to fetch old value from database
      // For now, return null and let the route handler provide it
      return null;
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

  /**
   * Audit bot deletion
   */
  botDelete: audit({
    action: 'delete',
    actionCategory: 'data_change',
    resourceType: 'bot',
    getResourceId: (req) => req.params.id,
    getOldValue: async () => {
      // Would need to fetch old value from database
      return null;
    },
  }),

  /**
   * Audit bot system actions (start, stop, pause, etc.)
   */
  botSystemAction: (action: string) => audit({
    action,
    actionCategory: 'system_action',
    resourceType: 'bot',
    getResourceId: (req) => req.params.id,
  }),
};

