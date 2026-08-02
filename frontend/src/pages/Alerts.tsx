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

import { useEffect, useState, useCallback } from 'react';
import { alertsApi, type Alert } from '../services/api/endpoints.js';
import { appLogger } from '../utils/logger.js';
import { Bell, AlertTriangle, AlertOctagon, Info, CheckCircle2, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';

const REFRESH_INTERVAL_MS = 30000;

function severityIcon(severity: Alert['severity']) {
  switch (severity) {
    case 'critical':
      return <AlertOctagon className="h-4 w-4 text-red-500 flex-shrink-0" />;
    case 'warning':
      return <AlertTriangle className="h-4 w-4 text-yellow-500 flex-shrink-0" />;
    default:
      return <Info className="h-4 w-4 text-blue-500 flex-shrink-0" />;
  }
}

export function Alerts() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [unacknowledgedOnly, setUnacknowledgedOnly] = useState(true);
  const [isLoading, setIsLoading] = useState(true);

  const loadAlerts = useCallback(async () => {
    try {
      const data = await alertsApi.list({ unacknowledgedOnly, limit: 100 });
      setAlerts(data);
    } catch (err) {
      appLogger.error('Failed to load alerts:', err);
    } finally {
      setIsLoading(false);
    }
  }, [unacknowledgedOnly]);

  useEffect(() => {
    loadAlerts();
    const interval = setInterval(loadAlerts, REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [loadAlerts]);

  const handleAcknowledge = async (id: string) => {
    try {
      await alertsApi.acknowledge(id);
      setAlerts((prev) => (unacknowledgedOnly ? prev.filter((a) => a.id !== id) : prev.map((a) => (a.id === id ? { ...a, isAcknowledged: true } : a))));
    } catch (err) {
      appLogger.error('Failed to acknowledge alert:', err);
    }
  };

  const handleAcknowledgeAll = async () => {
    if (!confirm('Acknowledge all currently-unacknowledged alerts?')) return;
    try {
      await alertsApi.acknowledgeAll();
      await loadAlerts();
    } catch (err) {
      appLogger.error('Failed to acknowledge all alerts:', err);
    }
  };

  return (
    <div className="min-h-screen bg-background dark">
      <div className="container mx-auto px-6 py-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2 flex items-center gap-2">
              <Bell className="h-7 w-7" /> Alerts
            </h1>
            <p className="text-muted-foreground">Centralized alerts from all bot instances</p>
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={unacknowledgedOnly}
                onChange={(e) => setUnacknowledgedOnly(e.target.checked)}
              />
              Unacknowledged only
            </label>
            <button
              onClick={handleAcknowledgeAll}
              className="px-3 py-1.5 text-sm rounded border border-border hover:bg-muted transition-colors"
            >
              Acknowledge all
            </button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{alerts.length} alert{alerts.length === 1 ? '' : 's'}</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-6 w-6 animate-spin text-primary mr-2" />
                <span className="text-muted-foreground">Loading alerts...</span>
              </div>
            ) : alerts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16">
                <CheckCircle2 className="h-16 w-16 text-green-500 mb-4 opacity-50" />
                <p className="text-muted-foreground">
                  {unacknowledgedOnly ? 'No unacknowledged alerts.' : 'No alerts yet.'}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {alerts.map((alert) => (
                  <div
                    key={alert.id}
                    className={`flex items-start gap-3 p-3 rounded border border-border ${
                      alert.isAcknowledged ? 'opacity-60' : ''
                    }`}
                  >
                    {severityIcon(alert.severity)}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm">
                        {alert.botName && <span className="font-medium">{alert.botName}: </span>}
                        {alert.message}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(alert.createdAt).toLocaleString()}
                      </p>
                    </div>
                    {!alert.isAcknowledged && (
                      <button
                        onClick={() => handleAcknowledge(alert.id)}
                        className="text-xs px-2 py-1 rounded border border-border hover:bg-muted transition-colors flex-shrink-0"
                      >
                        Acknowledge
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
