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
import { websocketService, type FreqHubEvent } from '../services/websocket.service.js';
import { Link } from 'react-router-dom';
import { Bot, Activity, CheckCircle2, XCircle, Loader2, Calendar, Play, Square, Pause, RefreshCw, Settings } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/Card';
import { SparklineChart } from '../components/SparklineChart';

type TimePeriod = '24h' | '7d' | '30d' | 'all';
type TradingMode = 'live' | 'dry_run';

interface BotStatus {
  botId: string;
  status: {
    state?: string; // RUNNING, STOPPED, PAUSED, etc.
    runmode?: string; // dry_run or live
    exchange?: string; // Exchange name
    strategy?: string; // Strategy name
    timeframe?: string; // Timeframe (e.g., 5m, 1h)
    stoploss?: number; // Stoploss percentage
    trade_count?: number;
    profit_closed_coin?: number;
    profit_closed_percent?: number;
    winrate?: number; // Win rate as ratio (0.0 to 1.0)
    open_trades?: Array<{ pair: string; open_date: string; amount: number }>; // Details of open trades
  } | null;
  error?: string;
  isOnline?: boolean; // Whether bot responds to ping
  dailyData?: Array<{ date: string; profit: number }>; // Historical data for sparkline
}

export function Dashboard() {
  const { bots, isLoading, error, fetchBots } = useBotStore();
  const [botStatuses, setBotStatuses] = useState<BotStatus[]>([]);
  const [isLoadingStatus, setIsLoadingStatus] = useState(false);
  const [profitTimePeriod, setProfitTimePeriod] = useState<TimePeriod>('all');
  const [actionLoading, setActionLoading] = useState<Record<string, string | null>>({});
  const [activeTab, setActiveTab] = useState<TradingMode>('live'); // Default to Live Trading

  useEffect(() => {
    fetchBots();
  }, [fetchBots]);

  // Connect to WebSocket on mount
  useEffect(() => {
    websocketService.connect();
    return () => {
      websocketService.disconnect();
    };
  }, []);

  // Subscribe to bot events when bots change
  useEffect(() => {
    if (bots.length === 0) return;

    const enabledBotIds = bots.filter((b) => b.isEnabled).map((b) => b.id);
    
    // Subscribe to all enabled bots
    enabledBotIds.forEach((botId) => {
      websocketService.subscribeToBot(botId);
    });

    // Cleanup: unsubscribe when component unmounts or bots change
    return () => {
      enabledBotIds.forEach((botId) => {
        websocketService.unsubscribeFromBot(botId);
      });
    };
  }, [bots]);

  // Helper function to add timeout to a promise
  const withTimeout = <T,>(promise: Promise<T>, timeoutMs: number): Promise<T> => {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error('Request timeout')), timeoutMs)
      ),
    ]);
  };

  // Function to load daily profit data for sparkline (last 7 days)
  const loadDailyData = useCallback(async (botId: string): Promise<Array<{ date: string; profit: number }>> => {
    try {
      const dailyData = await withTimeout(
        proxyApi.get(botId, 'api/v1/daily') as Promise<Array<{ date: string; profit: number }>>,
        5000
      ).catch(() => null);

      if (!dailyData || !Array.isArray(dailyData)) {
        return [];
      }

      // Get last 7 days, sorted by date
      const sorted = dailyData
        .map((item) => ({
          date: item.date,
          profit: typeof item.profit === 'number' ? item.profit : 0,
        }))
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        .slice(-7);

      return sorted;
    } catch (err) {
      console.error(`Failed to load daily data for bot ${botId}:`, err);
      return [];
    }
  }, []);

  // Function to load bot statuses (reusable)
  // If updateProgressively is true, updates are applied as they complete (non-blocking)
  const loadBotStatuses = useCallback(
    async (specificBotId?: string, updateProgressively: boolean = false) => {
      const botsToLoad = specificBotId
        ? bots.filter((b) => b.id === specificBotId && b.isEnabled)
        : bots.filter((b) => b.isEnabled);

      if (botsToLoad.length === 0) return;

      if (!specificBotId && !updateProgressively) {
        setIsLoadingStatus(true);
      }

      const statusPromises = botsToLoad.map(async (bot) => {
        try {
          // First check if bot is alive with ping (short timeout: 3 seconds)
          const pingResult = await withTimeout(
            proxyApi.get(bot.id, 'api/v1/ping').catch(() => null),
            3000
          ).catch(() => null);
          const isOnline = pingResult !== null;

          if (!isOnline) {
            return {
              botId: bot.id,
              status: null,
              error: 'Bot is offline or unreachable',
              isOnline: false,
            };
          }

          // Get bot state, open trades, profit, and daily data in parallel (only if bot is online)
          // Use shorter timeout (5 seconds) for these requests
          const [configData, openTrades, profit, dailyData] = await Promise.allSettled([
            withTimeout(proxyApi.get(bot.id, 'api/v1/show_config'), 5000).catch(() => null),
            withTimeout(proxyApi.get(bot.id, 'api/v1/status'), 5000).catch(() => []),
            withTimeout(proxyApi.get(bot.id, 'api/v1/profit'), 5000).catch(() => null),
            loadDailyData(bot.id).catch(() => []),
          ]).then((results) =>
            results.map((r) => (r.status === 'fulfilled' ? r.value : null))
          );

          const tradesArray = Array.isArray(openTrades) ? openTrades : [];
          const profitData = profit as { profit_closed_coin?: number; profit_closed_percent?: number; winrate?: number } | null;
          const historicalData = dailyData as Array<{ date: string; profit: number }> | null;
          
          // Extract bot configuration data
          const config = configData && typeof configData === 'object' ? configData as {
            state?: string;
            runmode?: string;
            dry_run?: boolean;
            exchange?: string;
            strategy?: string;
            timeframe?: string;
            stoploss?: number;
          } : null;
          
          const botState = config?.state;
          const runmode = config?.runmode || (config?.dry_run !== undefined ? (config.dry_run ? 'dry_run' : 'live') : undefined);
          const exchange = config?.exchange;
          const strategy = config?.strategy;
          const timeframe = config?.timeframe;
          const stoploss = config?.stoploss;

          // Extract open trades details for display
          const openTradesDetails = tradesArray
            .filter((t: any) => t.is_open !== false) // Filter only open trades
            .map((t: any) => ({
              pair: t.pair || 'Unknown',
              open_date: t.open_date || 'Unknown',
              amount: t.amount || 0,
            }));

          const status = {
            state: botState, // RUNNING, STOPPED, PAUSED, etc.
            runmode: runmode, // dry_run or live
            exchange: exchange,
            strategy: strategy,
            timeframe: timeframe,
            stoploss: stoploss,
            trade_count: tradesArray.length,
            open_trades: openTradesDetails, // Store trade details
            profit_closed_coin: profitData?.profit_closed_coin,
            profit_closed_percent: profitData?.profit_closed_percent,
            winrate: profitData?.winrate, // Win rate as ratio (0.0 to 1.0)
          };
          return { botId: bot.id, status, isOnline: true, dailyData: historicalData || [] };
        } catch (err) {
          return {
            botId: bot.id,
            status: null,
            error: err instanceof Error ? err.message : 'Failed to load status',
            isOnline: false,
          };
        }
      });

      // If updating progressively, handle each promise as it resolves
      if (updateProgressively && !specificBotId) {
        statusPromises.forEach(async (promise) => {
          try {
            const status = await promise;
            setBotStatuses((prev) => {
              const existing = prev.find((s) => s.botId === status.botId);
              if (existing) {
                return prev.map((s) => (s.botId === status.botId ? status : s));
              } else {
                return [...prev, status];
              }
            });
          } catch (err) {
            // Individual failures are already handled in the promise
          }
        });
        // Wait for all to complete to hide loading indicator
        Promise.allSettled(statusPromises).then(() => {
          setIsLoadingStatus(false);
        });
        return;
      }

      // Use Promise.allSettled to not block on individual failures
      const results = await Promise.allSettled(statusPromises);
      const statuses = results.map((result, index) =>
        result.status === 'fulfilled' ? result.value : {
          botId: botsToLoad[index]?.id || 'unknown',
          status: null,
          error: result.reason instanceof Error ? result.reason.message : 'Failed to load status',
          isOnline: false,
        }
      );
      
      if (specificBotId) {
        // Update only the specific bot
        setBotStatuses((prev) =>
          prev.map((s) => {
            const updated = statuses.find((ns) => ns.botId === s.botId);
            return updated || s;
          })
        );
      } else {
        // Update all statuses
        setBotStatuses(statuses);
        setIsLoadingStatus(false);
      }
    },
    [bots, loadDailyData]
  );

  // Load initial statuses only (WebSockets handle real-time updates)
  useEffect(() => {
    loadBotStatuses();
  }, [loadBotStatuses]);

  // Handle bot control actions
  const handleBotAction = async (botId: string, action: 'start' | 'stop' | 'pause' | 'reload_config') => {
    setActionLoading((prev) => ({ ...prev, [botId]: action }));
    try {
      const response = await proxyApi.post(botId, `api/v1/${action}`, {});
      
        // Show success message if Freqtrade returned a status message
      if (response && typeof response === 'object' && 'status' in response) {
        const statusMessage = (response as { status?: string }).status;
        if (statusMessage) {
          // For reload_config, show a brief visual feedback
          if (action === 'reload_config') {
            // The status will be updated automatically via loadBotStatuses
          }
        }
      }
      
      // Reload status after action (wait 1.5 seconds for bot to process the command)
      setTimeout(() => {
        loadBotStatuses(botId);
      }, 1500);
    } catch (err) {
      console.error(`Failed to ${action} bot ${botId}:`, err);
      const errorMessage = err instanceof Error ? err.message : `Failed to ${action} bot`;
      alert(`❌ ${errorMessage}`);
    } finally {
      setActionLoading((prev) => ({ ...prev, [botId]: null }));
    }
  };

  // Manual refresh function - updates progressively (non-blocking)
  const handleRefresh = async () => {
    await loadBotStatuses(undefined, true);
  };


  // Listen to WebSocket events for real-time updates
  useEffect(() => {
    const handleBotEvent = (event: FreqHubEvent) => {
      if (!event.botId) return;

      // Handle different event types
      if (event.type === 'bot_open_trades_update') {
        // Update bot status from open trades data (Freqtrade /status endpoint)
        // The data is an array of open trades
        const trades = Array.isArray(event.data) ? event.data : [];
        const status = {
          trade_count: trades.length,
        };

        setBotStatuses((prev) => {
          const existing = prev.find((s) => s.botId === event.botId);
          if (existing) {
            // Update existing status, preserving profit if available
            return prev.map((s) =>
              s.botId === event.botId
                ? {
                    ...s,
                    status: {
                      ...existing.status,
                      ...status,
                      // Preserve profit from existing status
                      profit_closed_coin: existing.status?.profit_closed_coin,
                      profit_closed_percent: existing.status?.profit_closed_percent,
                    },
                    error: undefined,
                  }
                : s
            );
          } else {
            // Add new status
            return [...prev, { botId: event.botId!, status }];
          }
        });
      } else if (event.type === 'bot_ping_update' || event.type === 'bot_online') {
        // Ping updates or online events indicate bot is alive - mark as online
        setBotStatuses((prev) => {
          const existing = prev.find((s) => s.botId === event.botId);
          if (existing) {
            return prev.map((s) =>
              s.botId === event.botId
                ? {
                    ...s,
                    isOnline: true,
                    error: undefined,
                  }
                : s
            );
          } else {
            return [...prev, { botId: event.botId!, status: null, isOnline: true }];
          }
        });
        // If bot came back online, trigger a refresh of its status
        if (event.type === 'bot_online' && event.botId) {
          setTimeout(() => {
            loadBotStatuses(event.botId);
          }, 500);
        }
      } else if (event.type === 'bot_offline') {
        // Bot went offline - update status
        const offlineData = event.data as { error?: string };
        setBotStatuses((prev) => {
          const existing = prev.find((s) => s.botId === event.botId);
          if (existing) {
            return prev.map((s) =>
              s.botId === event.botId
                ? {
                    ...s,
                    isOnline: false,
                    error: offlineData.error || 'Bot is offline or unreachable',
                    status: null, // Clear status when offline
                  }
                : s
            );
          } else {
            return [...prev, {
              botId: event.botId!,
              status: null,
              isOnline: false,
              error: offlineData.error || 'Bot is offline or unreachable',
            }];
          }
        });
      } else if (event.type === 'bot_balance_update') {
        // Balance updates don't contain profit, but we could refresh profit if needed
        // For now, we'll keep the existing profit
      } else if (event.type === 'bot_state_update') {
        // State updates from /api/v1/show_config endpoint
        const stateData = event.data as {
          state?: string;
          runmode?: string;
          dry_run?: boolean;
          exchange?: string;
          strategy?: string;
          timeframe?: string;
          stoploss?: number;
        };
        const runmode = stateData.runmode || (stateData.dry_run !== undefined ? (stateData.dry_run ? 'dry_run' : 'live') : undefined);
        
        setBotStatuses((prev) => {
          const existing = prev.find((s) => s.botId === event.botId);
          if (existing) {
            // Update existing status with new state and config data
            return prev.map((s) =>
              s.botId === event.botId
                ? {
                    ...s,
                    status: {
                      ...existing.status,
                      state: stateData.state,
                      runmode: runmode,
                      exchange: stateData.exchange,
                      strategy: stateData.strategy,
                      timeframe: stateData.timeframe,
                      stoploss: stateData.stoploss,
                    },
                  }
                : s
            );
          } else {
            // Add new status with state and config data
            return [...prev, {
              botId: event.botId!,
              status: {
                state: stateData.state,
                runmode: runmode,
                exchange: stateData.exchange,
                strategy: stateData.strategy,
                timeframe: stateData.timeframe,
                stoploss: stateData.stoploss,
              },
              isOnline: true
            }];
          }
        });
      } else if (event.type === 'bot_profit_update') {
        // Profit updates from /api/v1/profit endpoint
        const profitData = event.data as { profit_closed_coin?: number; profit_closed_percent?: number; winrate?: number };
        
        setBotStatuses((prev) => {
          const existing = prev.find((s) => s.botId === event.botId);
          if (existing && existing.status) {
            return prev.map((s) =>
              s.botId === event.botId
                ? {
                    ...s,
                    status: {
                      ...existing.status,
                      profit_closed_coin: profitData.profit_closed_coin,
                      profit_closed_percent: profitData.profit_closed_percent,
                      winrate: profitData.winrate,
                    },
                  }
                : s
            );
          } else if (existing) {
            // Bot exists but no status yet, create one with profit
            return prev.map((s) =>
              s.botId === event.botId
                ? {
                    ...s,
                    status: {
                      trade_count: 0,
                      profit_closed_coin: profitData.profit_closed_coin,
                      profit_closed_percent: profitData.profit_closed_percent,
                      winrate: profitData.winrate,
                    },
                  }
                : s
            );
          }
          return prev;
        });
      }
    };

    // Subscribe to bot events
    const unsubscribe = websocketService.on('bot_event', handleBotEvent);

    return () => {
      unsubscribe();
    };
  }, []);

  // Helper function to normalize bot state (Freqtrade returns lowercase, but we compare uppercase)
  const normalizeState = (state?: string): string | undefined => {
    if (!state) return undefined;
    return state.toUpperCase();
  };

  // Helper function to get connectivity status (Online/Offline)
  const getConnectivityStatus = (status: BotStatus | undefined) => {
    if (!status || status.error || !status.isOnline) {
      return { text: 'Offline', color: 'text-gray-500', icon: XCircle };
    }
    return { text: 'Online', color: 'text-green-500', icon: CheckCircle2 };
  };

  // Helper function to get bot operational state display info
  const getBotStateDisplay = (status: BotStatus | undefined) => {
    if (!status || status.error || !status.isOnline) {
      return null; // Don't show operational state if offline
    }
    const state = normalizeState(status.status?.state);
    if (state === 'RUNNING') {
      return { text: 'Running', color: 'text-green-500', icon: CheckCircle2 };
    }
    if (state === 'STOPPED') {
      return { text: 'Stopped', color: 'text-red-500', icon: Square };
    }
    if (state === 'PAUSED') {
      return { text: 'Paused', color: 'text-yellow-500', icon: Pause };
    }
    // Default: online but state unknown
    return { text: 'Unknown', color: 'text-blue-500', icon: CheckCircle2 };
  };

  // All hooks and calculations must be before any early returns
  const enabledBots = useMemo(() => bots.filter((b) => b.isEnabled), [bots]);
  
  // Filter bots by trading mode
  const filteredBots = useMemo(() => {
    return enabledBots.filter((bot) => {
      const status = botStatuses.find((s) => s.botId === bot.id);
      const runmode = status?.status?.runmode;
      if (activeTab === 'live') {
        return runmode === 'live' || runmode === undefined; // Default to live if unknown
      } else {
        return runmode === 'dry_run';
      }
    });
  }, [enabledBots, botStatuses, activeTab]);

  const totalTrades = useMemo(() => {
    return botStatuses.reduce((sum, s) => {
      return sum + (s.status?.trade_count || 0);
    }, 0);
  }, [botStatuses]);
  const totalProfit = useMemo(() => {
    return botStatuses.reduce((sum, s) => {
      return sum + (s.status?.profit_closed_coin || 0);
    }, 0);
  }, [botStatuses]);
  
  const profitPeriodLabel = useMemo(() => {
    return profitTimePeriod === '24h' 
      ? 'Last 24 hours' 
      : profitTimePeriod === '7d' 
      ? 'Last 7 days' 
      : profitTimePeriod === '30d' 
      ? 'Last 30 days' 
      : 'All time';
  }, [profitTimePeriod]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background dark flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background dark flex items-center justify-center">
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive">Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-destructive">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background dark">
      <div className="container mx-auto px-6 py-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">Dashboard</h1>
            <p className="text-muted-foreground">Overview of all your trading bots</p>
          </div>
          <button
            onClick={handleRefresh}
            disabled={isLoadingStatus}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title="Refresh all bot data"
          >
            <RefreshCw className={`h-4 w-4 ${isLoadingStatus ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Bots</CardTitle>
              <Bot className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{bots.length}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {enabledBots.length} enabled
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Enabled Bots</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{enabledBots.length}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {bots.length - enabledBots.length} disabled
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Trades</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalTrades}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Across all bots
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Profit</CardTitle>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <select
                  value={profitTimePeriod}
                  onChange={(e) => setProfitTimePeriod(e.target.value as TimePeriod)}
                  onClick={(e) => e.stopPropagation()}
                  className="text-xs bg-background border border-border rounded px-2 py-1 hover:bg-muted transition-colors focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="24h">24h</option>
                  <option value="7d">7d</option>
                  <option value="30d">30d</option>
                  <option value="all">All</option>
                </select>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${totalProfit.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {profitPeriodLabel}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Closed profit
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Bot Status with Tabs */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Bot Status</CardTitle>
                <CardDescription>Real-time status of all enabled bots</CardDescription>
              </div>
            </div>
            {/* Tabs */}
            <div className="flex gap-2 mt-4 border-b border-border">
              <button
                onClick={() => setActiveTab('live')}
                className={`px-4 py-2 font-medium text-sm transition-colors border-b-2 ${
                  activeTab === 'live'
                    ? 'border-green-500 text-green-500'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                💰 Live Trading
              </button>
              <button
                onClick={() => setActiveTab('dry_run')}
                className={`px-4 py-2 font-medium text-sm transition-colors border-b-2 ${
                  activeTab === 'dry_run'
                    ? 'border-yellow-500 text-yellow-500'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                🔶 Dry Run
              </button>
            </div>
          </CardHeader>
          <CardContent>
            {isLoadingStatus ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary mr-2" />
                <span className="text-muted-foreground">Loading statuses...</span>
              </div>
            ) : filteredBots.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>No {activeTab === 'live' ? 'live trading' : 'dry run'} bots found.</p>
                <Link to="/bots" className="text-primary hover:underline mt-2 inline-block">
                  Manage bots
                </Link>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Strategy</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Status</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Exchange</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Pair/Timeframe</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Trades</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">P&L</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Win Rate</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Last Week</th>
                      <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredBots.map((bot) => {
                      const status = botStatuses.find((s) => s.botId === bot.id);
                      const connectivity = status ? getConnectivityStatus(status) : null;
                      const ConnectivityIcon = connectivity?.icon || XCircle;
                      const stateDisplay = status ? getBotStateDisplay(status) : null;

                      return (
                        <tr
                          key={bot.id}
                          className="border-b border-border hover:bg-muted/50 transition-colors"
                        >
                          <td className="py-3 px-4">
                            <Link
                              to={`/bots/${bot.id}`}
                              className="font-semibold text-foreground hover:text-primary transition-colors"
                            >
                              {bot.name}
                            </Link>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              {status ? (
                                <>
                                  <span className={`flex items-center gap-1 text-xs ${connectivity?.color || 'text-gray-500'}`}>
                                    <ConnectivityIcon className="h-3 w-3" />
                                    {connectivity?.text || 'Unknown'}
                                  </span>
                                  {stateDisplay && (
                                    <>
                                      <span className="text-xs text-muted-foreground">•</span>
                                      <span className={`flex items-center gap-1 text-xs ${stateDisplay.color}`}>
                                        <stateDisplay.icon className="h-3 w-3" />
                                        {stateDisplay.text}
                                      </span>
                                    </>
                                  )}
                                </>
                              ) : (
                                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                  Loading...
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-sm">
                            {status?.status?.exchange || '-'}
                          </td>
                          <td className="py-3 px-4 text-sm">
                            <div className="font-mono text-xs">
                              {status?.status?.timeframe || '-'}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-sm">
                            <div className="flex flex-col gap-1">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold">{status?.status?.trade_count || 0}</span>
                                {status?.status?.trade_count && status.status.trade_count > 0 && (
                                  <span 
                                    className="text-xs text-muted-foreground cursor-help" 
                                    title="Open trades according to Freqtrade. May differ from exchange if not synchronized. Click to see details."
                                  >
                                    ⓘ
                                  </span>
                                )}
                              </div>
                              {status?.status?.open_trades && status.status.open_trades.length > 0 && (
                                <div className="text-xs text-muted-foreground">
                                  {status.status.open_trades.slice(0, 2).map((t, idx) => (
                                    <div key={idx} className="truncate max-w-[150px]" title={`${t.pair} - ${t.open_date}`}>
                                      {t.pair}
                                    </div>
                                  ))}
                                  {status.status.open_trades.length > 2 && (
                                    <div className="text-xs">+{status.status.open_trades.length - 2} more</div>
                                  )}
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            {status?.status?.profit_closed_coin !== undefined ? (
                              <span
                                className={`font-semibold ${
                                  status.status.profit_closed_coin >= 0
                                    ? 'text-green-500'
                                    : 'text-red-500'
                                }`}
                              >
                                ${status.status.profit_closed_coin.toFixed(2)}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-sm">
                            {status?.status?.winrate !== undefined && status.status.winrate !== null ? (
                              <span className="font-semibold">
                                {(status.status.winrate * 100).toFixed(1)}%
                              </span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <SparklineChart data={status?.dailyData || []} width={150} height={40} />
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => handleBotAction(bot.id, 'start')}
                                disabled={!!actionLoading[bot.id] || !status?.isOnline || normalizeState(status?.status?.state) === 'RUNNING'}
                                className="p-1.5 text-green-500 hover:bg-green-500/20 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                title="Start bot"
                              >
                                {actionLoading[bot.id] === 'start' ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <Play className="h-3 w-3" />
                                )}
                              </button>
                              <button
                                onClick={() => handleBotAction(bot.id, 'stop')}
                                disabled={!!actionLoading[bot.id] || !status?.isOnline || normalizeState(status?.status?.state) === 'STOPPED'}
                                className="p-1.5 text-red-500 hover:bg-red-500/20 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                title="Stop bot"
                              >
                                {actionLoading[bot.id] === 'stop' ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <Square className="h-3 w-3" />
                                )}
                              </button>
                              <button
                                onClick={() => handleBotAction(bot.id, 'pause')}
                                disabled={!!actionLoading[bot.id] || !status?.isOnline || normalizeState(status?.status?.state) !== 'RUNNING'}
                                className="p-1.5 text-yellow-500 hover:bg-yellow-500/20 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                title="Pause bot"
                              >
                                {actionLoading[bot.id] === 'pause' ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <Pause className="h-3 w-3" />
                                )}
                              </button>
                              <Link
                                to={`/bots/${bot.id}`}
                                className="p-1.5 text-muted-foreground hover:bg-muted rounded transition-colors"
                                title="View details"
                              >
                                <Settings className="h-3 w-3" />
                              </Link>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
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
