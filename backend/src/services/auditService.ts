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

import { randomUUID } from 'crypto';
import { getDatabase } from '../db/database.js';
import type { AuditLogDB } from '../db/schema.js';
import type { AuditLog, CreateAuditLogRequest } from '../models/AuditLog.js';
import { auditLogDBToAuditLog, createAuditLogRequestToAuditLogDB } from '../models/AuditLog.js';

/**
 * Create an audit log entry
 */
export function createAuditLog(request: CreateAuditLogRequest): AuditLog {
  const db = getDatabase();
  const id = randomUUID();
  const timestamp = Date.now();
  
  const auditLogDB = createAuditLogRequestToAuditLogDB(request, id, timestamp);
  
  db.prepare(`
    INSERT INTO audit_logs (
      id, user_id, action, action_category, resource_type, resource_id,
      old_value, new_value, changed_fields, details,
      ip_address, user_agent, timestamp
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    auditLogDB.id,
    auditLogDB.user_id,
    auditLogDB.action,
    auditLogDB.action_category,
    auditLogDB.resource_type,
    auditLogDB.resource_id,
    auditLogDB.old_value,
    auditLogDB.new_value,
    auditLogDB.changed_fields,
    auditLogDB.details,
    auditLogDB.ip_address,
    auditLogDB.user_agent,
    auditLogDB.timestamp
  );
  
  // For createAuditLog, we don't have username yet (it's inserted, not queried)
  // We'll fetch it separately if needed, but for now return with null username
  return auditLogDBToAuditLog(auditLogDB, null);
}

/**
 * Get audit logs with filters
 */
export function getAuditLogs(filters: {
  userId?: string;
  action?: string;
  actionCategory?: string;
  resourceType?: string;
  resourceId?: string;
  startDate?: number;
  endDate?: number;
  limit?: number;
  offset?: number;
}): AuditLog[] {
  const db = getDatabase();
  const conditions: string[] = [];
  const values: unknown[] = [];
  
  if (filters.userId) {
    conditions.push('user_id = ?');
    values.push(filters.userId);
  }
  if (filters.action) {
    conditions.push('action = ?');
    values.push(filters.action);
  }
  if (filters.actionCategory) {
    conditions.push('action_category = ?');
    values.push(filters.actionCategory);
  }
  if (filters.resourceType) {
    conditions.push('resource_type = ?');
    values.push(filters.resourceType);
  }
  if (filters.resourceId) {
    conditions.push('resource_id = ?');
    values.push(filters.resourceId);
  }
  if (filters.startDate) {
    conditions.push('timestamp >= ?');
    values.push(filters.startDate);
  }
  if (filters.endDate) {
    conditions.push('timestamp <= ?');
    values.push(filters.endDate);
  }
  
  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const limitClause = filters.limit ? `LIMIT ${filters.limit}` : '';
  const offsetClause = filters.offset ? `OFFSET ${filters.offset}` : '';
  
  // Join with users table to get username
  const query = `
    SELECT 
      audit_logs.*,
      users.username
    FROM audit_logs
    LEFT JOIN users ON audit_logs.user_id = users.id
    ${whereClause}
    ORDER BY audit_logs.timestamp DESC
    ${limitClause}
    ${offsetClause}
  `;
  
  const logs = db.prepare(query).all(...values) as (AuditLogDB & { username?: string | null })[];
  return logs.map((log) => auditLogDBToAuditLog(log, log.username ?? null));
}

/**
 * Get audit log by ID
 */
export function getAuditLogById(id: string): AuditLog | null {
  const db = getDatabase();
  const log = db.prepare(`
    SELECT 
      audit_logs.*,
      users.username
    FROM audit_logs
    LEFT JOIN users ON audit_logs.user_id = users.id
    WHERE audit_logs.id = ?
  `).get(id) as (AuditLogDB & { username?: string | null }) | undefined;
  return log ? auditLogDBToAuditLog(log, log.username ?? null) : null;
}

/**
 * Get audit logs for a specific resource
 */
export function getResourceHistory(resourceType: string, resourceId: string): AuditLog[] {
  return getAuditLogs({
    resourceType,
    resourceId,
  });
}

/**
 * Get count of audit logs matching filters
 */
export function getAuditLogCount(filters: {
  userId?: string;
  action?: string;
  actionCategory?: string;
  resourceType?: string;
  resourceId?: string;
  startDate?: number;
  endDate?: number;
}): number {
  const db = getDatabase();
  const conditions: string[] = [];
  const values: unknown[] = [];
  
  if (filters.userId) {
    conditions.push('user_id = ?');
    values.push(filters.userId);
  }
  if (filters.action) {
    conditions.push('action = ?');
    values.push(filters.action);
  }
  if (filters.actionCategory) {
    conditions.push('action_category = ?');
    values.push(filters.actionCategory);
  }
  if (filters.resourceType) {
    conditions.push('resource_type = ?');
    values.push(filters.resourceType);
  }
  if (filters.resourceId) {
    conditions.push('resource_id = ?');
    values.push(filters.resourceId);
  }
  if (filters.startDate) {
    conditions.push('timestamp >= ?');
    values.push(filters.startDate);
  }
  if (filters.endDate) {
    conditions.push('timestamp <= ?');
    values.push(filters.endDate);
  }
  
  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const query = `SELECT COUNT(*) as count FROM audit_logs ${whereClause}`;
  
  const result = db.prepare(query).get(...values) as { count: number };
  return result.count;
}

