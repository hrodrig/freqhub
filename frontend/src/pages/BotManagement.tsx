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

import { useState, useEffect, useCallback } from 'react';
import { Plus, X, Edit, Trash2, TestTube, CheckCircle2, XCircle, Loader2, Play, Square, Pause, RotateCcw, Settings, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useBotStore } from '../stores/botStore.js';
import { botApi, proxyApi } from '../services/api/endpoints.js';
import { websocketService, type FreqHubEvent } from '../services/websocket.service.js';
import type { CreateBotRequest, UpdateBotRequest } from '../types/bot.js';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/Card';

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
  } | null;
  error?: string;
  isOnline?: boolean; // Whether bot responds to ping
}

export function BotManagement() {
  const { bots, fetchBots, removeBot, updateBot: updateBotInStore } = useBotStore();
  const [showForm, setShowForm] = useState(false);
  const [editingBot, setEditingBot] = useState<string | null>(null);
  const [formData, setFormData] = useState<CreateBotRequest & { isEnabled: boolean }>({
    name: '',
    apiUrl: '',
    username: '',
    password: '',
    notes: '',
    isEnabled: true,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [botStatuses, setBotStatuses] = useState<BotStatus[]>([]);
  const [isLoadingStatus, setIsLoadingStatus] = useState(false);
  const [actionLoading, setActionLoading] = useState<Record<string, string | null>>({});

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

  // Helper to normalize Freqtrade states (e.g., "running" to "RUNNING")
  const normalizeState = (state?: string | null) => {
    return state ? state.toUpperCase() : undefined;
  };

  // Helper function to add timeout to a promise
  const withTimeout = <T,>(promise: Promise<T>, timeoutMs: number): Promise<T> => {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error('Request timeout')), timeoutMs)
      ),
    ]);
  };

  // Function to load bot statuses (reusable)
  const loadBotStatuses = useCallback(
    async (specificBotId?: string) => {
      const botsToLoad = specificBotId
        ? bots.filter((b) => b.id === specificBotId && b.isEnabled)
        : bots.filter((b) => b.isEnabled);

      if (botsToLoad.length === 0) return;

      if (!specificBotId) {
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

          // Get bot state, open trades, and profit in parallel (only if bot is online)
          // Use shorter timeout (5 seconds) for these requests
          const [configData, openTrades, profit] = await Promise.allSettled([
            withTimeout(proxyApi.get(bot.id, 'api/v1/show_config'), 5000).catch(() => null),
            withTimeout(proxyApi.get(bot.id, 'api/v1/status'), 5000).catch(() => []),
            withTimeout(proxyApi.get(bot.id, 'api/v1/profit'), 5000).catch(() => null),
          ]).then((results) =>
            results.map((r) => (r.status === 'fulfilled' ? r.value : null))
          );

          const tradesArray = Array.isArray(openTrades) ? openTrades : [];
          const profitData = profit as { profit_closed_coin?: number; profit_closed_percent?: number } | null;
          
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

          const status = {
            state: botState,
            runmode: runmode,
            exchange: exchange,
            strategy: strategy,
            timeframe: timeframe,
            stoploss: stoploss,
            trade_count: tradesArray.length,
            profit_closed_coin: profitData?.profit_closed_coin,
            profit_closed_percent: profitData?.profit_closed_percent,
          };
          return { botId: bot.id, status, isOnline: true };
        } catch (err) {
          return {
            botId: bot.id,
            status: null,
            error: err instanceof Error ? err.message : 'Failed to load status',
            isOnline: false,
          };
        }
      });

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
    [bots]
  );

  // Handle individual bot refresh
  const handleRefreshBot = async (botId: string) => {
    setActionLoading((prev) => ({ ...prev, [botId]: 'refresh' }));
    try {
      await loadBotStatuses(botId);
    } finally {
      setActionLoading((prev) => {
        const next = { ...prev };
        delete next[botId];
        return next;
      });
    }
  };

  // Load initial statuses only (WebSockets handle real-time updates)
  useEffect(() => {
    loadBotStatuses();
  }, [loadBotStatuses]);

  // Listen to WebSocket events for real-time updates
  useEffect(() => {
    const handleBotEvent = (event: FreqHubEvent) => {
      if (!event.botId) return;

      // Handle different event types
      if (event.type === 'bot_open_trades_update') {
        const trades = Array.isArray(event.data) ? event.data : [];
        const status = {
          trade_count: trades.length,
        };

        setBotStatuses((prev) => {
          const existing = prev.find((s) => s.botId === event.botId);
          if (existing) {
            return prev.map((s) =>
              s.botId === event.botId
                ? {
                    ...s,
                    status: {
                      ...existing.status,
                      ...status,
                    },
                    error: undefined,
                  }
                : s
            );
          } else {
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
      } else if (event.type === 'bot_state_update') {
        const stateData = event.data as { state?: string; runmode?: string; dry_run?: boolean; exchange?: string; strategy?: string; timeframe?: string; stoploss?: number };
        const runmode = stateData.runmode || (stateData.dry_run !== undefined ? (stateData.dry_run ? 'dry_run' : 'live') : undefined);
        
        setBotStatuses((prev) => {
          const existing = prev.find((s) => s.botId === event.botId);
          if (existing) {
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
            return [...prev, { botId: event.botId!, status: { state: stateData.state, runmode: runmode, exchange: stateData.exchange, strategy: stateData.strategy, timeframe: stateData.timeframe, stoploss: stateData.stoploss }, isOnline: true }];
          }
        });
      } else if (event.type === 'bot_profit_update') {
        const profitData = event.data as { profit_closed_coin?: number; profit_closed_percent?: number };
        
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

  // Handle bot control actions
  const handleBotAction = async (botId: string, action: 'start' | 'stop' | 'pause' | 'reload_config') => {
    setActionLoading((prev) => ({ ...prev, [botId]: action }));
    try {
      const response = await proxyApi.post(botId, `api/v1/${action}`, {});
      
      // Show success message if Freqtrade returned a status message
      if (response && typeof response === 'object' && 'status' in response) {
        const statusMessage = (response as { status?: string }).status;
        if (statusMessage && action === 'reload_config') {
          // Status will be updated automatically via refresh
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      if (editingBot) {
        // Update existing bot
        const updateData: UpdateBotRequest = {
          name: formData.name,
          apiUrl: formData.apiUrl,
          username: formData.username,
          notes: formData.notes,
          isEnabled: formData.isEnabled,
        };
        if (formData.password) {
          updateData.password = formData.password;
        }
        const updated = await botApi.update(editingBot, updateData);
        updateBotInStore(editingBot, updated);
        setEditingBot(null);
      } else {
        // Create new bot
        const createData: CreateBotRequest = {
          name: formData.name,
          apiUrl: formData.apiUrl,
          username: formData.username,
          password: formData.password,
          notes: formData.notes,
        };
        await botApi.create(createData);
        await fetchBots();
      }
      setShowForm(false);
      setFormData({ name: '', apiUrl: '', username: '', password: '', notes: '', isEnabled: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save bot');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (bot: { id: string; name: string; apiUrl: string; username: string; notes?: string; isEnabled: boolean }) => {
    // Check if bot is running
    const status = botStatuses.find((s) => s.botId === bot.id);
    const botState = normalizeState(status?.status?.state);
    
    if (botState === 'RUNNING') {
      alert('❌ Cannot edit a bot that is currently running. Please stop the bot first.');
      return;
    }
    
    setEditingBot(bot.id);
    setFormData({
      name: bot.name,
      apiUrl: bot.apiUrl,
      username: bot.username,
      password: '', // Don't pre-fill password
      notes: bot.notes || '',
      isEnabled: bot.isEnabled,
    });
    setShowForm(true);
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingBot(null);
    setFormData({ name: '', apiUrl: '', username: '', password: '', notes: '', isEnabled: true });
  };

  const handleDelete = async (id: string) => {
    // Check if bot is running
    const status = botStatuses.find((s) => s.botId === id);
    const botState = normalizeState(status?.status?.state);
    
    if (botState === 'RUNNING') {
      alert('❌ Cannot delete a bot that is currently running. Please stop the bot first.');
      return;
    }
    
    if (confirm('Are you sure you want to delete this bot?')) {
      try {
        await botApi.delete(id);
        removeBot(id);
      } catch (err) {
        alert(err instanceof Error ? err.message : 'Failed to delete bot');
      }
    }
  };

  const handleTest = async (id: string) => {
    try {
      const result = await botApi.testConnection(id);
      alert(result.message);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to test connection');
    }
  };

  return (
    <div className="min-h-screen bg-background dark">
      <div className="container mx-auto px-6 py-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Bot Management</h1>
            <p className="text-muted-foreground mt-2">Manage your Freqtrade bot connections</p>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
          >
            {showForm ? (
              <>
                <X className="h-4 w-4" />
                Cancel
              </>
            ) : (
              <>
                <Plus className="h-4 w-4" />
                Add Bot
              </>
            )}
          </button>
        </div>

        {showForm && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>{editingBot ? 'Edit Bot' : 'Add New Bot'}</CardTitle>
              <CardDescription>
                {editingBot ? 'Update bot configuration' : 'Configure a new Freqtrade bot connection'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Name
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="e.g., EMAC-RSI-EMA200"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    API URL
                  </label>
                  <input
                    type="url"
                    value={formData.apiUrl}
                    onChange={(e) => setFormData({ ...formData, apiUrl: e.target.value })}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="http://localhost:8080"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Username
                  </label>
                  <input
                    type="text"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="freqtrader"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Password
                  </label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder={editingBot ? 'Leave empty to keep current password' : 'Enter password'}
                    required={!editingBot}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Notes
                  </label>
                  <textarea
                    value={formData.notes || ''}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                    placeholder="Add notes about this bot (e.g., strategy, configuration, etc.)"
                    rows={3}
                  />
                </div>
                <div className="flex items-center justify-between p-4 border border-border rounded-lg bg-muted/30">
                  <div className="flex items-center gap-3">
                    {formData.isEnabled ? (
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-500" />
                    )}
                    <div>
                      <label htmlFor="isEnabled" className="text-sm font-medium text-foreground cursor-pointer block">
                        Bot Status
                      </label>
                      <p className="text-xs text-muted-foreground">
                        {formData.isEnabled ? 'Bot will be enabled' : 'Bot will be disabled'}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, isEnabled: !formData.isEnabled })}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      formData.isEnabled ? 'bg-green-500' : 'bg-gray-500'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        formData.isEnabled ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
                {error && (
                  <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm">
                    {error}
                  </div>
                )}
                <div className="flex gap-2 justify-end">
                  {editingBot && (
                    <button
                      type="button"
                      onClick={handleCancel}
                      className="px-4 py-2 border border-border rounded-lg hover:bg-muted transition-colors"
                    >
                      Cancel
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                  >
                    {isSubmitting ? 'Saving...' : editingBot ? 'Update Bot' : 'Create Bot'}
                  </button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Bots</CardTitle>
            <CardDescription>List of all configured Freqtrade bots</CardDescription>
          </CardHeader>
          <CardContent>
            {bots.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>No bots configured yet.</p>
                <p className="text-sm mt-2">Click "Add Bot" to get started.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {isLoadingStatus && (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-primary mr-2" />
                    <span className="text-muted-foreground">Loading statuses...</span>
                  </div>
                )}
                {bots.map((bot) => {
                  const status = botStatuses.find((s) => s.botId === bot.id);
                  const currentAction = actionLoading[bot.id];
                  const botState = normalizeState(status?.status?.state);
                  
                  return (
                    <div
                      key={bot.id}
                      className="p-4 border border-border rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <div>
                              <Link
                                to={`/bots/${bot.id}`}
                                className="text-lg font-semibold text-foreground hover:text-primary transition-colors"
                              >
                                {bot.name}
                              </Link>
                              <p className="text-xs text-muted-foreground font-mono mt-0.5">{bot.id}</p>
                            </div>
                            {bot.isEnabled ? (
                              <>
                                {(() => {
                                  if (!status) {
                                    return (
                                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        Loading...
                                      </span>
                                    );
                                  }
                                  const connectivity = getConnectivityStatus(status);
                                  const ConnectivityIcon = connectivity.icon;
                                  const stateDisplay = getBotStateDisplay(status);
                                  const runmode = status.status?.runmode;
                                  return (
                                    <div className="flex items-center gap-2">
                                      <span className={`flex items-center gap-1 text-xs ${connectivity.color}`}>
                                        <ConnectivityIcon className="h-4 w-4" />
                                        {connectivity.text}
                                      </span>
                                      {stateDisplay && (
                                        <>
                                          <span className="text-xs text-muted-foreground">•</span>
                                          <span className={`flex items-center gap-1 text-xs ${stateDisplay.color}`}>
                                            <stateDisplay.icon className="h-4 w-4" />
                                            {stateDisplay.text}
                                          </span>
                                        </>
                                      )}
                                      {runmode && (
                                        <span
                                          className={`text-xs px-2 py-0.5 rounded ${
                                            runmode === 'dry_run'
                                              ? 'bg-yellow-500/20 text-yellow-500 border border-yellow-500/30'
                                              : 'bg-green-500/20 text-green-500 border border-green-500/30'
                                          }`}
                                        >
                                          {runmode === 'dry_run' ? '🔶 Dry Run' : '💰 Live Trading'}
                                        </span>
                                      )}
                                    </div>
                                  );
                                })()}
                              </>
                            ) : (
                              <span className="flex items-center gap-1 text-xs text-red-500">
                                <XCircle className="h-4 w-4" />
                                Disabled
                              </span>
                            )}
                          </div>
                          <div className="text-sm text-muted-foreground space-y-1">
                            <p>
                              <span className="font-medium">URL:</span> {bot.apiUrl}
                            </p>
                            <p>
                              <span className="font-medium">Username:</span> {bot.username}
                            </p>
                            {status?.error ? (
                              <p className="text-red-500">Error: {status.error}</p>
                            ) : status?.status && bot.isEnabled ? (
                              <>
                                {status.status.state && (
                                  <p>
                                    <span className="font-medium">State:</span>{' '}
                                    <span className="font-mono text-xs">{status.status.state}</span>
                                  </p>
                                )}
                                {status.status.runmode && (
                                  <p>
                                    <span className="font-medium">Mode:</span>{' '}
                                    <span
                                      className={
                                        status.status.runmode === 'dry_run'
                                          ? 'text-yellow-500 font-semibold'
                                          : 'text-green-500 font-semibold'
                                      }
                                    >
                                      {status.status.runmode === 'dry_run' ? '🔶 Dry Run' : '💰 Live Trading'}
                                    </span>
                                  </p>
                                )}
                                {status.status.exchange && (
                                  <p>
                                    <span className="font-medium">Exchange:</span>{' '}
                                    <span className="font-semibold">{status.status.exchange}</span>
                                  </p>
                                )}
                                {status.status.strategy && (
                                  <p>
                                    <span className="font-medium">Strategy:</span>{' '}
                                    <span className="font-mono text-sm">{status.status.strategy}</span>
                                  </p>
                                )}
                                {status.status.timeframe && (
                                  <p>
                                    <span className="font-medium">Timeframe:</span>{' '}
                                    <span className="font-mono text-sm">{status.status.timeframe}</span>
                                  </p>
                                )}
                                {status.status.stoploss !== undefined && (
                                  <p>
                                    <span className="font-medium">Stoploss:</span>{' '}
                                    <span
                                      className={
                                        status.status.stoploss >= 0 ? 'text-green-500' : 'text-red-500'
                                      }
                                    >
                                      {status.status.stoploss.toFixed(2)}%
                                    </span>
                                  </p>
                                )}
                                <p>
                                  <span className="font-medium">Open Trades:</span>{' '}
                                  {status.status.trade_count || 0}
                                </p>
                                {status.status.profit_closed_coin !== undefined && (
                                  <p>
                                    <span className="font-medium">Profit:</span>{' '}
                                    <span
                                      className={
                                        status.status.profit_closed_coin >= 0
                                          ? 'text-green-500'
                                          : 'text-red-500'
                                      }
                                    >
                                      ${status.status.profit_closed_coin.toFixed(2)}
                                    </span>
                                  </p>
                                )}
                              </>
                            ) : null}
                            {bot.notes && (
                              <p className="mt-2 pt-2 border-t border-border">
                                <span className="font-medium">Notes:</span>{' '}
                                <span className="text-foreground">{bot.notes}</span>
                              </p>
                            )}
                          </div>
                        </div>
                        
                        {/* Quick Actions */}
                        <div className="flex items-center gap-1">
                          {bot.isEnabled && (
                            <>
                              <button
                                onClick={() => handleBotAction(bot.id, 'start')}
                                disabled={!!currentAction || !status?.isOnline || botState === 'RUNNING'}
                                className="p-2 text-green-500 hover:bg-green-500/20 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                title="Start bot"
                              >
                                {currentAction === 'start' ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Play className="h-4 w-4" />
                                )}
                              </button>
                              <button
                                onClick={() => handleBotAction(bot.id, 'stop')}
                                disabled={!!currentAction || !status?.isOnline || botState === 'STOPPED'}
                                className="p-2 text-red-500 hover:bg-red-500/20 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                title="Stop bot"
                              >
                                {currentAction === 'stop' ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Square className="h-4 w-4" />
                                )}
                              </button>
                              <button
                                onClick={() => handleBotAction(bot.id, 'pause')}
                                disabled={!!currentAction || !status?.isOnline || botState === 'PAUSED' || botState === 'STOPPED'}
                                className="p-2 text-yellow-500 hover:bg-yellow-500/20 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                title="Pause bot"
                              >
                                {currentAction === 'pause' ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Pause className="h-4 w-4" />
                                )}
                              </button>
                              <button
                                onClick={() => handleBotAction(bot.id, 'reload_config')}
                                disabled={!!currentAction || !status?.isOnline || botState === 'STOPPED'}
                                className="p-2 text-blue-500 hover:bg-blue-500/20 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                title="Reload configuration"
                              >
                                {currentAction === 'reload_config' ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <RotateCcw className="h-4 w-4" />
                                )}
                              </button>
                            </>
                          )}
                          <button
                            onClick={() => handleRefreshBot(bot.id)}
                            disabled={!!actionLoading[bot.id]}
                            className="p-2 text-blue-500 hover:bg-blue-500/20 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Refresh this bot"
                          >
                            {actionLoading[bot.id] === 'refresh' ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <RefreshCw className="h-4 w-4" />
                            )}
                          </button>
                          <Link
                            to={`/bots/${bot.id}`}
                            className="p-2 text-muted-foreground hover:bg-muted rounded transition-colors"
                            title="View details"
                          >
                            <Settings className="h-4 w-4" />
                          </Link>
                          <button
                            onClick={() => handleEdit(bot)}
                            disabled={normalizeState(botStatuses.find((s) => s.botId === bot.id)?.status?.state) === 'RUNNING'}
                            className="p-2 text-primary hover:bg-primary/20 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            title={normalizeState(botStatuses.find((s) => s.botId === bot.id)?.status?.state) === 'RUNNING' ? 'Cannot edit a running bot. Stop it first.' : 'Edit Bot'}
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleTest(bot.id)}
                            className="p-2 text-blue-500 hover:bg-blue-500/20 rounded transition-colors"
                            title="Test Connection"
                          >
                            <TestTube className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(bot.id)}
                            disabled={normalizeState(botStatuses.find((s) => s.botId === bot.id)?.status?.state) === 'RUNNING'}
                            className="p-2 text-red-500 hover:bg-red-500/20 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            title={normalizeState(botStatuses.find((s) => s.botId === bot.id)?.status?.state) === 'RUNNING' ? 'Cannot delete a running bot. Stop it first.' : 'Delete Bot'}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
