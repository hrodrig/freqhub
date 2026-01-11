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

import type { AuditLogDB } from '../db/schema.js';

/**
 * Audit log model for frontend/API
 */
export interface AuditLog {
  id: string;
  userId: string;
  username: string | null; // Username of the user who performed the action
  action: string;
  actionCategory: 'data_change' | 'data_access' | 'system_action' | 'auth';
  resourceType: string;
  resourceId: string | null;
  oldValue: unknown | null; // Parsed JSON
  newValue: unknown | null; // Parsed JSON
  changedFields: string[] | null;
  details: unknown | null; // Parsed JSON
  ipAddress: string | null;
  userAgent: string | null;
  timestamp: number;
}

/**
 * Request to create an audit log entry
 */
export interface CreateAuditLogRequest {
  userId: string;
  action: string;
  actionCategory: 'data_change' | 'data_access' | 'system_action' | 'auth';
  resourceType: string;
  resourceId?: string | null;
  oldValue?: unknown | null;
  newValue?: unknown | null;
  changedFields?: string[] | null;
  details?: unknown | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

/**
 * Convert AuditLogDB to AuditLog (parses JSON fields)
 * @param auditLogDB - The audit log database record
 * @param username - Optional username to include (obtained from JOIN with users table)
 */
export function auditLogDBToAuditLog(auditLogDB: AuditLogDB, username: string | null = null): AuditLog {
  return {
    id: auditLogDB.id,
    userId: auditLogDB.user_id,
    username,
    action: auditLogDB.action,
    actionCategory: auditLogDB.action_category,
    resourceType: auditLogDB.resource_type,
    resourceId: auditLogDB.resource_id,
    oldValue: auditLogDB.old_value ? JSON.parse(auditLogDB.old_value) : null,
    newValue: auditLogDB.new_value ? JSON.parse(auditLogDB.new_value) : null,
    changedFields: auditLogDB.changed_fields ? JSON.parse(auditLogDB.changed_fields) : null,
    details: auditLogDB.details ? JSON.parse(auditLogDB.details) : null,
    ipAddress: auditLogDB.ip_address,
    userAgent: auditLogDB.user_agent,
    timestamp: auditLogDB.timestamp,
  };
}

/**
 * Convert CreateAuditLogRequest to AuditLogDB (stringifies JSON fields)
 */
export function createAuditLogRequestToAuditLogDB(
  request: CreateAuditLogRequest,
  id: string,
  timestamp: number
): AuditLogDB {
  return {
    id,
    user_id: request.userId,
    action: request.action,
    action_category: request.actionCategory,
    resource_type: request.resourceType,
    resource_id: request.resourceId || null,
    old_value: request.oldValue ? JSON.stringify(request.oldValue) : null,
    new_value: request.newValue ? JSON.stringify(request.newValue) : null,
    changed_fields: request.changedFields ? JSON.stringify(request.changedFields) : null,
    details: request.details ? JSON.stringify(request.details) : null,
    ip_address: request.ipAddress || null,
    user_agent: request.userAgent || null,
    timestamp,
  };
}

