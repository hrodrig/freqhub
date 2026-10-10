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

import { useEffect, useState, useRef, useCallback } from 'react';
import { useBotStore } from '../stores/botStore.js';
import { backtestApi, type BacktestStatus } from '../services/api/endpoints.js';
import { appLogger } from '../utils/logger.js';
import { FlaskConical, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/Card';

const POLL_INTERVAL_MS = 4000;

export function BacktestComparison() {
  const { bots, isLoading: botsLoading, fetchBots } = useBotStore();
  const [selectedBotIds, setSelectedBotIds] = useState<string[]>([]);
  const [timerange, setTimerange] = useState('');
  const [statuses, setStatuses] = useState<Record<string, BacktestStatus>>({});
  const [isStarting, setIsStarting] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    fetchBots();
  }, [fetchBots]);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const enabledBots = bots.filter((b) => b.isEnabled);

  const toggleBot = (botId: string) => {
    setSelectedBotIds((prev) =>
      prev.includes(botId) ? prev.filter((id) => id !== botId) : [...prev, botId]
    );
  };

  const pollStatuses = useCallback(async (botIds: string[]) => {
    const results = await Promise.allSettled(botIds.map((id) => backtestApi.status(id)));
    setStatuses((prev) => {
      const next = { ...prev };
      results.forEach((r, i) => {
        if (r.status === 'fulfilled') {
          next[botIds[i]] = r.value;
        }
      });
      return next;
    });

    const stillRunning = results.some((r) => r.status === 'fulfilled' && r.value.running);
    if (!stillRunning && pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const handleStart = async () => {
    if (selectedBotIds.length === 0) {
      alert('Select at least one bot first.');
      return;
    }
    setIsStarting(true);
    try {
      await Promise.allSettled(
        selectedBotIds.map((botId) =>
          backtestApi.start(botId, { timerange: timerange.trim() || undefined })
        )
      );
      // Start polling for progress/results
      if (pollRef.current) clearInterval(pollRef.current);
      pollStatuses(selectedBotIds);
      pollRef.current = setInterval(() => pollStatuses(selectedBotIds), POLL_INTERVAL_MS);
    } catch (err) {
      appLogger.error('Failed to start backtests:', err);
      alert(`Failed to start: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsStarting(false);
    }
  };

  const botName = (botId: string) => bots.find((b) => b.id === botId)?.name || botId;

  return (
    <div className="min-h-screen bg-background dark">
      <div className="container mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Backtest Comparison</h1>
          <p className="text-muted-foreground">
            Run each bot's own configured strategy through Freqtrade's backtest engine and compare results
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Select Bots</CardTitle>
              <CardDescription>Each bot backtests its own already-configured strategy</CardDescription>
            </CardHeader>
            <CardContent>
              {botsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                </div>
              ) : enabledBots.length === 0 ? (
                <p className="text-muted-foreground text-sm">No enabled bots found.</p>
              ) : (
                <div className="space-y-2">
                  {enabledBots.map((bot) => (
                    <label key={bot.id} className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedBotIds.includes(bot.id)}
                        onChange={() => toggleBot(bot.id)}
                      />
                      {bot.name}
                    </label>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Run</CardTitle>
              <CardDescription>
                {selectedBotIds.length} bot{selectedBotIds.length === 1 ? '' : 's'} selected
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-4">
                <label className="block text-xs text-muted-foreground mb-1">
                  Timerange (optional, e.g. 20260201-20260801 - Freqtrade's own format)
                </label>
                <input
                  type="text"
                  value={timerange}
                  onChange={(e) => setTimerange(e.target.value)}
                  placeholder="Full available history if empty"
                  className="w-full px-3 py-2 text-sm rounded border border-border bg-background"
                />
              </div>
              <button
                onClick={handleStart}
                disabled={isStarting || selectedBotIds.length === 0}
                className="px-4 py-2 text-sm font-medium rounded bg-primary text-primary-foreground disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isStarting ? 'Starting...' : `Run backtests on ${selectedBotIds.length} bot(s)`}
              </button>
            </CardContent>
          </Card>
        </div>

        {Object.keys(statuses).length > 0 && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FlaskConical className="h-5 w-5" /> Results
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left p-4">Bot</th>
                      <th className="text-left p-4">Strategy</th>
                      <th className="text-left p-4">Status</th>
                      <th className="text-right p-4">Trades</th>
                      <th className="text-right p-4">Win Rate</th>
                      <th className="text-right p-4">Profit %</th>
                      <th className="text-right p-4">Max Drawdown %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(statuses).map(([botId, status]) => (
                      <tr key={botId} className="border-b border-border">
                        <td className="p-4 font-medium">{botName(botId)}</td>
                        <td className="p-4 text-muted-foreground">{status.results?.strategy || '—'}</td>
                        <td className="p-4">
                          {status.running ? (
                            <span className="text-yellow-500 flex items-center gap-1">
                              <Loader2 className="h-3 w-3 animate-spin" />
                              {status.status || 'Running'}
                              {typeof status.progress === 'number' && ` (${(status.progress * 100).toFixed(0)}%)`}
                            </span>
                          ) : status.results ? (
                            <span className="text-green-500">Complete</span>
                          ) : (
                            <span className="text-muted-foreground">{status.error || 'No result yet'}</span>
                          )}
                        </td>
                        <td className="p-4 text-right">{status.results?.totalTrades ?? '—'}</td>
                        <td className="p-4 text-right">
                          {typeof status.results?.winRate === 'number' ? `${(status.results.winRate * 100).toFixed(1)}%` : '—'}
                        </td>
                        <td className="p-4 text-right">
                          {typeof status.results?.profitTotalPct === 'number' ? (
                            <span className={status.results.profitTotalPct >= 0 ? 'text-green-500' : 'text-red-500'}>
                              {status.results.profitTotalPct >= 0 ? '+' : ''}{status.results.profitTotalPct.toFixed(2)}%
                            </span>
                          ) : '—'}
                        </td>
                        <td className="p-4 text-right">
                          {typeof status.results?.maxDrawdownPct === 'number' ? `${status.results.maxDrawdownPct.toFixed(2)}%` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
