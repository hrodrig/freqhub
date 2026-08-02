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

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useBotStore } from '../stores/botStore.js';
import { proxyApi } from '../services/api/endpoints.js';
import { appLogger } from '../utils/logger.js';
import { BarChart3, Loader2, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { Card, CardContent } from '../components/ui/Card';

interface BotComparisonRow {
  botId: string;
  name: string;
  isOnline: boolean;
  strategy?: string;
  timeframe?: string;
  runmode?: string;
  state?: string;
  totalTrades: number;
  openTrades: number;
  winrate?: number; // 0.0 - 1.0
  profitClosedPercent?: number;
  profitClosedCoin?: number;
  error?: string;
}

type SortKey = 'name' | 'totalTrades' | 'openTrades' | 'winrate' | 'profitClosedPercent';

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('Request timeout')), timeoutMs)),
  ]);
}

export function BotComparison() {
  const { bots, isLoading: botsLoading, fetchBots } = useBotStore();
  const [rows, setRows] = useState<BotComparisonRow[]>([]);
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  useEffect(() => {
    fetchBots();
  }, [fetchBots]);

  const loadComparisonData = useCallback(async () => {
    const enabledBots = bots.filter((b) => b.isEnabled);
    if (enabledBots.length === 0) {
      setRows([]);
      return;
    }
    setIsLoadingStats(true);

    const results = await Promise.allSettled(
      enabledBots.map(async (bot): Promise<BotComparisonRow> => {
        try {
          const pingResult = await withTimeout(
            proxyApi.get(bot.id, 'api/v1/ping').catch(() => null),
            3000
          ).catch(() => null);

          if (pingResult === null) {
            return { botId: bot.id, name: bot.name, isOnline: false, totalTrades: 0, openTrades: 0, error: 'Bot is offline or unreachable' };
          }

          const [configResult, statusResult, profitResult, tradesResult] = await Promise.allSettled([
            withTimeout(proxyApi.get(bot.id, 'api/v1/show_config'), 5000).catch(() => null),
            withTimeout(proxyApi.get(bot.id, 'api/v1/status'), 5000).catch(() => []),
            withTimeout(proxyApi.get(bot.id, 'api/v1/profit'), 5000).catch(() => null),
            // Real historical trade count via total_trades - NOT api/v1/status, which is
            // open-trades-only (see Dashboard.tsx's 2026-08-02 bug fix for the same issue).
            withTimeout(proxyApi.get(bot.id, 'api/v1/trades?limit=1'), 5000).catch(() => null),
          ]).then((r) => r.map((x) => (x.status === 'fulfilled' ? x.value : null)));

          const config = configResult as {
            runmode?: string;
            dry_run?: boolean;
            strategy?: string;
            timeframe?: string;
            state?: string;
          } | null;
          const runmode = config?.runmode || (config?.dry_run !== undefined ? (config.dry_run ? 'dry_run' : 'live') : undefined);
          const openTrades = Array.isArray(statusResult) ? statusResult.length : 0;
          const profit = profitResult as { profit_closed_percent?: number; profit_closed_coin?: number; winrate?: number } | null;
          const tradeHistory = tradesResult as { total_trades?: number } | null;
          const totalTrades = typeof tradeHistory?.total_trades === 'number' ? tradeHistory.total_trades : openTrades;

          return {
            botId: bot.id,
            name: bot.name,
            isOnline: true,
            strategy: config?.strategy,
            timeframe: config?.timeframe,
            runmode,
            state: config?.state,
            totalTrades,
            openTrades,
            winrate: profit?.winrate,
            profitClosedPercent: profit?.profit_closed_percent,
            profitClosedCoin: profit?.profit_closed_coin,
          };
        } catch (err) {
          appLogger.error(`Failed to load comparison data for bot ${bot.id}:`, err);
          return {
            botId: bot.id,
            name: bot.name,
            isOnline: false,
            totalTrades: 0,
            openTrades: 0,
            error: err instanceof Error ? err.message : 'Failed to load data',
          };
        }
      })
    );

    setRows(results.map((r) => (r.status === 'fulfilled' ? r.value : { botId: 'unknown', name: 'Unknown', isOnline: false, totalTrades: 0, openTrades: 0, error: 'Failed to load' })));
    setIsLoadingStats(false);
  }, [bots]);

  useEffect(() => {
    if (!botsLoading && bots.length > 0) {
      loadComparisonData();
    }
  }, [botsLoading, bots.length, loadComparisonData]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const sortedRows = useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) => {
      const aVal: string | number = a[sortKey] ?? (sortKey === 'name' ? '' : -Infinity);
      const bVal: string | number = b[sortKey] ?? (sortKey === 'name' ? '' : -Infinity);
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return sortDir === 'asc' ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
    });
    return copy;
  }, [rows, sortKey, sortDir]);

  const sortIcon = (key: SortKey) => {
    if (sortKey !== key) return <ArrowUpDown className="h-3 w-3 inline ml-1 opacity-40" />;
    return sortDir === 'asc' ? <ArrowUp className="h-3 w-3 inline ml-1" /> : <ArrowDown className="h-3 w-3 inline ml-1" />;
  };

  const isLoading = botsLoading || isLoadingStats;

  return (
    <div className="min-h-screen bg-background dark">
      <div className="container mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Bot Comparison</h1>
          <p className="text-muted-foreground">Compare performance metrics and strategies across all bots</p>
        </div>

        <Card>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-6 w-6 animate-spin text-primary mr-2" />
                <span className="text-muted-foreground">Loading comparison data...</span>
              </div>
            ) : sortedRows.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16">
                <BarChart3 className="h-16 w-16 text-muted-foreground mb-4 opacity-50" />
                <h2 className="text-2xl font-semibold text-foreground mb-2">No bots to compare</h2>
                <p className="text-muted-foreground text-center max-w-md">
                  Register and enable at least one bot to see a comparison.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left p-4 cursor-pointer select-none" onClick={() => handleSort('name')}>
                        Bot {sortIcon('name')}
                      </th>
                      <th className="text-left p-4">Strategy</th>
                      <th className="text-left p-4">Timeframe</th>
                      <th className="text-left p-4">Mode</th>
                      <th className="text-left p-4">Status</th>
                      <th className="text-right p-4 cursor-pointer select-none" onClick={() => handleSort('totalTrades')}>
                        Total Trades {sortIcon('totalTrades')}
                      </th>
                      <th className="text-right p-4 cursor-pointer select-none" onClick={() => handleSort('openTrades')}>
                        Open {sortIcon('openTrades')}
                      </th>
                      <th className="text-right p-4 cursor-pointer select-none" onClick={() => handleSort('winrate')}>
                        Win Rate {sortIcon('winrate')}
                      </th>
                      <th className="text-right p-4 cursor-pointer select-none" onClick={() => handleSort('profitClosedPercent')}>
                        Profit % {sortIcon('profitClosedPercent')}
                      </th>
                      <th className="text-right p-4">Profit (coin)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedRows.map((row) => (
                      <tr key={row.botId} className="border-b border-border hover:bg-muted/50 transition-colors">
                        <td className="p-4 font-medium">{row.name}</td>
                        <td className="p-4 text-muted-foreground">{row.strategy || '—'}</td>
                        <td className="p-4 text-muted-foreground">{row.timeframe || '—'}</td>
                        <td className="p-4">
                          {row.runmode ? (
                            <span className={row.runmode === 'live' ? 'text-green-500' : 'text-yellow-500'}>
                              {row.runmode === 'live' ? '💰 Live' : '🔶 Dry Run'}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">Unknown</span>
                          )}
                        </td>
                        <td className="p-4">
                          {row.isOnline ? (
                            <span className="text-green-500">● Online</span>
                          ) : (
                            <span className="text-red-500" title={row.error}>● Offline</span>
                          )}
                        </td>
                        <td className="p-4 text-right">{row.isOnline ? row.totalTrades : '—'}</td>
                        <td className="p-4 text-right">{row.isOnline ? row.openTrades : '—'}</td>
                        <td className="p-4 text-right">
                          {row.isOnline && typeof row.winrate === 'number' ? `${(row.winrate * 100).toFixed(1)}%` : '—'}
                        </td>
                        <td className="p-4 text-right">
                          {row.isOnline && typeof row.profitClosedPercent === 'number' ? (
                            <span className={row.profitClosedPercent >= 0 ? 'text-green-500' : 'text-red-500'}>
                              {row.profitClosedPercent >= 0 ? '+' : ''}{row.profitClosedPercent.toFixed(2)}%
                            </span>
                          ) : '—'}
                        </td>
                        <td className="p-4 text-right">
                          {row.isOnline && typeof row.profitClosedCoin === 'number' ? row.profitClosedCoin.toFixed(4) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
