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
import { eventBusService, type FreqHubEvent } from './eventBus.service.js';
import { getBotWithCredentials } from './botService.js';
import { getBotsOwnedByUser } from './botOwnershipService.js';
import { appLogger } from '../utils/logger.js';

/** Roles that may see/ack every alert (including bot_id NULL). */
function canAccessAllAlerts(role: string): boolean {
  return role === 'superadmin' || role === 'auditor';
}

export type AlertScope = {
  role: string;
  userId: string;
};

function ownedBotIdsForScope(scope: AlertScope): string[] | null {
  if (canAccessAllAlerts(scope.role)) return null; // null = unrestricted
  return getBotsOwnedByUser(scope.userId);
}

function alertVisibleToScope(alert: Alert, scope: AlertScope): boolean {
  const owned = ownedBotIdsForScope(scope);
  if (owned === null) return true;
  if (!alert.botId) return false;
  return owned.includes(alert.botId);
}

export type AlertSeverity = 'info' | 'warning' | 'critical';

export interface Alert {
  id: string;
  botId: string | null;
  botName: string | null;
  severity: AlertSeverity;
  type: string;
  message: string;
  details: unknown | null;
  isAcknowledged: boolean;
  createdAt: number;
  acknowledgedAt: number | null;
  acknowledgedBy: string | null;
}

interface AlertRow {
  id: string;
  bot_id: string | null;
  bot_name: string | null;
  severity: string;
  type: string;
  message: string;
  details: string | null;
  is_acknowledged: number;
  created_at: number;
  acknowledged_at: number | null;
  acknowledged_by: string | null;
}

function rowToAlert(row: AlertRow): Alert {
  return {
    id: row.id,
    botId: row.bot_id,
    botName: row.bot_name,
    severity: row.severity as AlertSeverity,
    type: row.type,
    message: row.message,
    details: row.details ? JSON.parse(row.details) : null,
    isAcknowledged: row.is_acknowledged === 1,
    createdAt: row.created_at,
    acknowledgedAt: row.acknowledged_at,
    acknowledgedBy: row.acknowledged_by,
  };
}

/**
 * Create and persist a new alert, then publish it on the event bus as an 'alert' event -
 * websocket.service.ts already has a hook (`event.type === 'alert'`) that broadcasts any such
 * event globally to all connected clients, so this rides on existing infrastructure rather
 * than needing new websocket wiring.
 */
export function createAlert(params: {
  botId?: string | null;
  botName?: string | null;
  severity: AlertSeverity;
  type: string;
  message: string;
  details?: unknown;
}): Alert {
  const db = getDatabase();
  const id = randomUUID();
  const createdAt = Date.now();

  db.prepare(
    `INSERT INTO alerts (id, bot_id, bot_name, severity, type, message, details, is_acknowledged, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)`
  ).run(
    id,
    params.botId ?? null,
    params.botName ?? null,
    params.severity,
    params.type,
    params.message,
    params.details !== undefined ? JSON.stringify(params.details) : null,
    createdAt
  );

  const alert: Alert = {
    id,
    botId: params.botId ?? null,
    botName: params.botName ?? null,
    severity: params.severity,
    type: params.type,
    message: params.message,
    details: params.details ?? null,
    isAcknowledged: false,
    createdAt,
    acknowledgedAt: null,
    acknowledgedBy: null,
  };

  eventBusService
    .publish({ type: 'alert', botId: params.botId ?? undefined, data: alert })
    .catch((err) => appLogger.error('Failed to publish alert event:', err));

  return alert;
}

export function getAlertById(id: string): Alert | null {
  const db = getDatabase();
  const row = db.prepare('SELECT * FROM alerts WHERE id = ?').get(id) as AlertRow | undefined;
  return row ? rowToAlert(row) : null;
}

export function listAlerts(
  params: { unacknowledgedOnly?: boolean; limit?: number } & AlertScope
): Alert[] {
  const db = getDatabase();
  const limit = Math.min(params.limit ?? 100, 500);
  const owned = ownedBotIdsForScope(params);

  if (owned !== null && owned.length === 0) {
    return [];
  }

  const clauses: string[] = [];
  const values: unknown[] = [];

  if (params.unacknowledgedOnly) {
    clauses.push('is_acknowledged = 0');
  }

  if (owned !== null) {
    const placeholders = owned.map(() => '?').join(', ');
    clauses.push(`bot_id IN (${placeholders})`);
    values.push(...owned);
  }

  const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
  values.push(limit);
  const rows = db
    .prepare(`SELECT * FROM alerts ${where} ORDER BY created_at DESC LIMIT ?`)
    .all(...values) as AlertRow[];
  return rows.map(rowToAlert);
}

export type AcknowledgeResult = 'ok' | 'not_found' | 'forbidden';

export function acknowledgeAlert(id: string, scope: AlertScope): AcknowledgeResult {
  const alert = getAlertById(id);
  if (!alert) return 'not_found';
  if (!alertVisibleToScope(alert, scope)) return 'forbidden';

  const db = getDatabase();
  const result = db
    .prepare('UPDATE alerts SET is_acknowledged = 1, acknowledged_at = ?, acknowledged_by = ? WHERE id = ?')
    .run(Date.now(), scope.userId, id);
  return result.changes > 0 ? 'ok' : 'not_found';
}

export function acknowledgeAllAlerts(scope: AlertScope): number {
  const db = getDatabase();
  const owned = ownedBotIdsForScope(scope);
  const now = Date.now();

  if (owned !== null && owned.length === 0) {
    return 0;
  }

  if (owned === null) {
    const result = db
      .prepare(
        'UPDATE alerts SET is_acknowledged = 1, acknowledged_at = ?, acknowledged_by = ? WHERE is_acknowledged = 0'
      )
      .run(now, scope.userId);
    return result.changes;
  }

  const placeholders = owned.map(() => '?').join(', ');
  const result = db
    .prepare(
      `UPDATE alerts SET is_acknowledged = 1, acknowledged_at = ?, acknowledged_by = ?
       WHERE is_acknowledged = 0 AND bot_id IN (${placeholders})`
    )
    .run(now, scope.userId, ...owned);
  return result.changes;
}

export function getUnacknowledgedCount(scope: AlertScope): number {
  const db = getDatabase();
  const owned = ownedBotIdsForScope(scope);

  if (owned !== null && owned.length === 0) {
    return 0;
  }

  if (owned === null) {
    const row = db.prepare('SELECT COUNT(*) as count FROM alerts WHERE is_acknowledged = 0').get() as {
      count: number;
    };
    return row.count;
  }

  const placeholders = owned.map(() => '?').join(', ');
  const row = db
    .prepare(
      `SELECT COUNT(*) as count FROM alerts WHERE is_acknowledged = 0 AND bot_id IN (${placeholders})`
    )
    .get(...owned) as { count: number };
  return row.count;
}

/**
 * Subscribe to the existing event bus (services/eventBus.service.ts) and turn a subset of
 * already-published events into persisted, user-facing alerts. This is deliberately additive -
 * it doesn't change what the event bus itself does, only listens to it.
 */
export function initializeAlertMonitoring(): void {
  eventBusService.on('event', (event: FreqHubEvent) => {
    try {
      if (event.type === 'bot_offline') {
        const bot = event.botId ? getBotWithCredentials(event.botId) : null;
        createAlert({
          botId: event.botId,
          botName: bot?.name,
          severity: 'critical',
          type: 'bot_offline',
          message: `${bot?.name || event.botId || 'A bot'} went offline`,
          details: event.data,
        });
      } else if (event.type === 'new_trade') {
        const bot = event.botId ? getBotWithCredentials(event.botId) : null;
        const pair = (event.data as { pair?: string } | undefined)?.pair;
        createAlert({
          botId: event.botId,
          botName: bot?.name,
          severity: 'info',
          type: 'new_trade',
          message: `${bot?.name || event.botId || 'A bot'} opened a new trade${pair ? ` on ${pair}` : ''}`,
          details: event.data,
        });
      }
      // bot_online is intentionally not alerted on its own - it would double up with the
      // bot_offline alert that already fired, and "recovered" isn't as actionable as "down".
    } catch (err) {
      appLogger.error('Failed to process event for alerting:', err);
    }
  });

  appLogger.info('AlertService: monitoring event bus for bot_offline/new_trade events');
}
