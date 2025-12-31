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

import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, AlertCircle, Play, Square, Pause, RotateCcw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card.js';
import { botApi, proxyApi } from '../services/api/endpoints.js';
import type { Bot } from '../types/bot.js';
import type { Trade } from '../types/trade.js';
import type { BalanceResponse } from '../types/balance.js';

interface BotStatus {
  state?: string;
  dry_run?: boolean;
  strategy?: string;
  stake_currency?: string;
}

interface ShowConfigResponse {
  state?: string;
  dry_run?: boolean;
  strategy?: string;
  stake_currency?: string;
  [key: string]: unknown;
}

export function BotDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [bot, setBot] = useState<Bot | null>(null);
  const [status, setStatus] = useState<BotStatus | null>(null);
  const [openTrades, setOpenTrades] = useState<Trade[]>([]);
  const [closedTrades, setClosedTrades] = useState<Trade[]>([]);
  const [balance, setBalance] = useState<BalanceResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;

    const loadBot = async () => {
      try {
        setIsLoading(true);
        const botData = await botApi.getById(id);
        setBot(botData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load bot');
      } finally {
        setIsLoading(false);
      }
    };

    loadBot();
  }, [id]);

  // Helper to normalize Freqtrade states (e.g., "running" to "RUNNING")
  const normalizeState = (state?: string | null) => {
    return state ? state.toUpperCase() : undefined;
  };

  const loadData = useCallback(async () => {
    if (!id) return;

    try {
      // Load bot config/state (this gives us strategy, stake_currency, etc.)
      try {
        const configData = (await proxyApi.get(id, 'api/v1/show_config')) as ShowConfigResponse;
        if (configData) {
          setStatus({
            state: configData.state || 'unknown',
            dry_run: configData.dry_run || false,
            strategy: configData.strategy || 'Unknown',
            stake_currency: configData.stake_currency || 'Unknown',
          });
        }
      } catch (err) {
        console.error('Failed to load config:', err);
        setStatus(null);
      }

      // Load open trades
      try {
        const tradesData = (await proxyApi.get(id, 'api/v1/status')) as Trade[];
        const open = tradesData.filter((t) => t.is_open);
        const closed = tradesData.filter((t) => !t.is_open);
        setOpenTrades(open);
        setClosedTrades(closed.slice(0, 100)); // Last 100 closed trades
      } catch (err) {
        console.error('Failed to load trades:', err);
        setOpenTrades([]);
        setClosedTrades([]);
      }

      // Load balance
      try {
        const balanceData = (await proxyApi.get(id, 'api/v1/balance')) as BalanceResponse;
        setBalance(balanceData);
      } catch (err) {
        console.error('Failed to load balance:', err);
        setBalance(null);
      }
    } catch (err) {
      console.error('Failed to load data:', err);
    }
  }, [id]);

  const handleControl = async (action: 'start' | 'stop' | 'pause' | 'reload_config') => {
    if (!id) return;

    setActionLoading(action);
    try {
      await proxyApi.post(id, `api/v1/${action}`);
      // Reload config after action to get updated state
      setTimeout(() => {
        loadData();
      }, 1500);
    } catch (err) {
      console.error(`Failed to ${action} bot:`, err);
      alert(err instanceof Error ? err.message : `Failed to ${action} bot`);
    } finally {
      setActionLoading(null);
    }
  };

  useEffect(() => {
    if (!id || !bot) return;

    loadData();
    // Refresh every 10 seconds (reduced from 5 to avoid overwhelming the API)
    const interval = setInterval(loadData, 10000);
    return () => clearInterval(interval);
  }, [id, bot, loadData]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background dark flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">Loading bot details...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background dark flex items-center justify-center">
        <div className="text-center">
          <p className="text-destructive mb-4">Error: {error}</p>
          <button
            onClick={() => navigate('/bots')}
            className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90"
          >
            Back to Bots
          </button>
        </div>
      </div>
    );
  }

  if (!bot) {
    return (
      <div className="min-h-screen bg-background dark flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Bot not found</p>
          <button
            onClick={() => navigate('/bots')}
            className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90"
          >
            Back to Bots
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background dark">
      <div className="container mx-auto px-6 py-8">
        <div className="mb-6">
          <button
            onClick={() => navigate('/bots')}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-4"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Bots
          </button>
          <h1 className="text-3xl font-bold text-foreground">{bot.name}</h1>
          <p className="text-muted-foreground mt-2">Bot ID: {bot.id}</p>
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>
                <span className="font-medium">API URL:</span> {bot.apiUrl}
              </p>
              <p>
                <span className="font-medium">WebSocket URL:</span>{' '}
                {bot.wsUrl || 'Not configured'}
              </p>
              <p>
                <span className="font-medium">Username:</span> {bot.username}
              </p>
              <p>
                <span className="font-medium">Status:</span>{' '}
                <span className={bot.isEnabled ? 'text-green-500' : 'text-red-500'}>
                  {bot.isEnabled ? 'Enabled' : 'Disabled'}
                </span>
              </p>
              <p>
                <span className="font-medium">Created:</span>{' '}
                {new Date(bot.createdAt).toLocaleString()}
              </p>
              <p>
                <span className="font-medium">Updated:</span>{' '}
                {new Date(bot.updatedAt).toLocaleString()}
              </p>
            </CardContent>
          </Card>

          {status && (
            <Card>
              <CardHeader>
                <CardTitle>Bot Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2 text-sm">
                  <p>
                    <span className="font-medium">State:</span> {status.state || 'Unknown'}
                  </p>
                  <p>
                    <span className="font-medium">Mode:</span>{' '}
                    <span className={status.dry_run ? 'text-yellow-500' : 'text-green-500'}>
                      {status.dry_run ? 'Dry Run' : 'Live'}
                    </span>
                  </p>
                  <p>
                    <span className="font-medium">Strategy:</span> {status.strategy || 'Unknown'}
                  </p>
                  <p>
                    <span className="font-medium">Stake Currency:</span>{' '}
                    {status.stake_currency || 'Unknown'}
                  </p>
                </div>

                <div className="pt-4 border-t border-border">
                  <h3 className="font-medium mb-3">Controls</h3>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleControl('start')}
                      disabled={!!actionLoading || normalizeState(status?.state) === 'RUNNING'}
                      className="p-2 text-green-500 hover:bg-green-500/20 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Start bot"
                    >
                      {actionLoading === 'start' ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Play className="h-4 w-4" />
                      )}
                    </button>
                    <button
                      onClick={() => handleControl('stop')}
                      disabled={!!actionLoading || normalizeState(status?.state) === 'STOPPED'}
                      className="p-2 text-red-500 hover:bg-red-500/20 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Stop bot"
                    >
                      {actionLoading === 'stop' ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Square className="h-4 w-4" />
                      )}
                    </button>
                    <button
                      onClick={() => handleControl('pause')}
                      disabled={!!actionLoading || normalizeState(status?.state) === 'PAUSED' || normalizeState(status?.state) === 'STOPPED'}
                      className="p-2 text-yellow-500 hover:bg-yellow-500/20 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Pause bot"
                    >
                      {actionLoading === 'pause' ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Pause className="h-4 w-4" />
                      )}
                    </button>
                    <button
                      onClick={() => handleControl('reload_config')}
                      disabled={!!actionLoading || normalizeState(status?.state) === 'STOPPED'}
                      className="p-2 text-blue-500 hover:bg-blue-500/20 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Reload configuration (only available when bot is running)"
                    >
                      {actionLoading === 'reload_config' ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <RotateCcw className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="mt-6 grid gap-6 md:grid-cols-2">
          {balance ? (
            <Card>
              <CardHeader>
                <CardTitle>Balance</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2 text-sm">
                  <p>
                    <span className="font-medium">Total:</span>{' '}
                    {balance.total?.toFixed(8) || '0'}
                  </p>
                  <p>
                    <span className="font-medium">Stake Currency:</span> {balance.stake || 'Unknown'}
                  </p>
                  <p>
                    <span className="font-medium">Value:</span> {balance.value?.toFixed(2) || '0'}
                  </p>
                </div>
                {balance.currencies && balance.currencies.length > 0 && (
                  <div className="pt-4 border-t border-border">
                    <h3 className="font-medium mb-2">Currencies</h3>
                    <ul className="space-y-1 text-sm">
                      {balance.currencies.map((curr) => (
                        <li key={curr.currency}>
                          <span className="font-medium">{curr.currency}:</span>{' '}
                          {(curr.free ?? 0).toFixed(8)} free, {(curr.used ?? 0).toFixed(8)} used,{' '}
                          {(curr.total ?? 0).toFixed(8)} total
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Balance</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <AlertCircle className="h-4 w-4" />
                  <p>Unable to load balance. The bot may be offline or unreachable.</p>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Open Trades ({openTrades.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {openTrades.length === 0 ? (
                <p className="text-muted-foreground">No open trades</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {openTrades.map((trade) => (
                    <li key={trade.trade_id} className="p-2 border border-border rounded">
                      <div className="font-medium">{trade.pair}</div>
                      <div className="text-muted-foreground">
                        Amount: {trade.amount} | Open Rate: {trade.open_rate}
                      </div>
                      <div
                        className={
                          (trade.profit_abs || 0) >= 0 ? 'text-green-500' : 'text-red-500'
                        }
                      >
                        Profit: {trade.profit_abs?.toFixed(8) || '0'} (
                        {trade.profit_ratio?.toFixed(2) || '0'}%)
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Recent Closed Trades ({closedTrades.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {closedTrades.length === 0 ? (
              <p className="text-muted-foreground">No closed trades</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {closedTrades.map((trade) => (
                  <li key={trade.trade_id} className="p-2 border border-border rounded">
                    <div className="font-medium">{trade.pair}</div>
                    <div className="text-muted-foreground">
                      Closed: {trade.close_date || 'Unknown'}
                      {trade.exit_reason && ` | Exit: ${trade.exit_reason}`}
                    </div>
                    <div
                      className={
                        (trade.profit_abs || 0) >= 0 ? 'text-green-500' : 'text-red-500'
                      }
                    >
                      Profit: {trade.profit_abs?.toFixed(8) || '0'} (
                      {trade.profit_ratio?.toFixed(2) || '0'}%)
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
