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

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useBotStore } from '../stores/botStore.js';
import { proxyApi, tradeManagementApi, type BotActionResult } from '../services/api/endpoints.js';
import { appLogger } from '../utils/logger.js';
import { TrendingUp, TrendingDown, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/Card';

type Runmode = 'live' | 'dry_run' | 'unknown';

function resolveRunmode(config: { runmode?: string; dry_run?: boolean } | null): Runmode {
  if (!config) return 'unknown';
  if (config.runmode === 'live' || config.runmode === 'dry_run') return config.runmode;
  if (config.dry_run === true) return 'dry_run';
  if (config.dry_run === false) return 'live';
  return 'unknown';
}

export function TradeManagement() {
  const { bots, isLoading: botsLoading, fetchBots } = useBotStore();
  const [selectedBotIds, setSelectedBotIds] = useState<string[]>([]);
  const [isExecuting, setIsExecuting] = useState(false);
  const [lastResults, setLastResults] = useState<BotActionResult[] | null>(null);
  const [runmodes, setRunmodes] = useState<Record<string, Runmode>>({});
  const [runmodesLoading, setRunmodesLoading] = useState(false);

  // Force-enter form state
  const [pair, setPair] = useState('');
  const [side, setSide] = useState<'long' | 'short' | ''>('');
  const [ordertype, setOrdertype] = useState<'limit' | 'market' | ''>('');
  const [price, setPrice] = useState('');
  const [stakeamount, setStakeamount] = useState('');

  useEffect(() => {
    fetchBots();
  }, [fetchBots]);

  const enabledBots = useMemo(() => bots.filter((b) => b.isEnabled), [bots]);
  const enabledBotIdsKey = useMemo(
    () => enabledBots.map((b) => b.id).sort().join(','),
    [enabledBots]
  );

  const loadRunmodes = useCallback(async (botList: typeof enabledBots) => {
    if (botList.length === 0) {
      setRunmodes({});
      return;
    }
    setRunmodesLoading(true);
    const entries = await Promise.all(
      botList.map(async (bot) => {
        try {
          const config = (await proxyApi.get(bot.id, 'api/v1/show_config')) as {
            runmode?: string;
            dry_run?: boolean;
          } | null;
          return [bot.id, resolveRunmode(config)] as const;
        } catch {
          return [bot.id, 'unknown' as Runmode] as const;
        }
      })
    );
    setRunmodes(Object.fromEntries(entries));
    setRunmodesLoading(false);
  }, []);

  useEffect(() => {
    if (!botsLoading) {
      void loadRunmodes(enabledBots);
    }
  }, [botsLoading, enabledBotIdsKey, enabledBots, loadRunmodes]);

  const toggleBot = (botId: string) => {
    setSelectedBotIds((prev) =>
      prev.includes(botId) ? prev.filter((id) => id !== botId) : [...prev, botId]
    );
  };

  const toggleAll = () => {
    setSelectedBotIds((prev) =>
      prev.length === enabledBots.length ? [] : enabledBots.map((b) => b.id)
    );
  };

  const handleForceEnter = async () => {
    if (selectedBotIds.length === 0) {
      alert('Select at least one bot first.');
      return;
    }
    if (!pair.trim()) {
      alert('A pair is required (e.g. BTC/USD).');
      return;
    }
    const selected = enabledBots.filter((b) => selectedBotIds.includes(b.id));
    const liveCount = selected.filter((b) => runmodes[b.id] === 'live').length;
    const botLines = selected
      .map((b) => {
        const mode = runmodes[b.id] ?? 'unknown';
        const label = mode === 'live' ? 'LIVE' : mode === 'dry_run' ? 'dry run' : 'mode unknown';
        return `- ${b.name} (${label})`;
      })
      .join('\n');
    if (
      !confirm(
        `Force-enter ${pair} on ${selectedBotIds.length} bot(s)?\n\n${botLines}\n\n${
          liveCount > 0
            ? `⚠️ ${liveCount} bot(s) are LIVE — real orders may be placed.`
            : 'Orders follow each bot dry_run/live setting.'
        }`
      )
    ) {
      return;
    }

    setIsExecuting(true);
    setLastResults(null);
    try {
      const results = await tradeManagementApi.forceEnter({
        botIds: selectedBotIds,
        pair: pair.trim(),
        side: side || undefined,
        ordertype: ordertype || undefined,
        price: price ? parseFloat(price) : undefined,
        stakeamount: stakeamount ? parseFloat(stakeamount) : undefined,
      });
      setLastResults(results);
    } catch (err) {
      appLogger.error('Force-enter failed:', err);
      alert(`Failed to execute: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsExecuting(false);
    }
  };

  const handleForceExitAll = async () => {
    if (selectedBotIds.length === 0) {
      alert('Select at least one bot first.');
      return;
    }
    const selected = enabledBots.filter((b) => selectedBotIds.includes(b.id));
    const liveCount = selected.filter((b) => runmodes[b.id] === 'live').length;
    const botLines = selected
      .map((b) => {
        const mode = runmodes[b.id] ?? 'unknown';
        const label = mode === 'live' ? 'LIVE' : mode === 'dry_run' ? 'dry run' : 'mode unknown';
        return `- ${b.name} (${label})`;
      })
      .join('\n');
    if (
      !confirm(
        `Force-exit ALL open positions on ${selectedBotIds.length} bot(s)?\n\n${botLines}\n\n${
          liveCount > 0
            ? `⚠️ ${liveCount} bot(s) are LIVE — real exits may be placed.`
            : 'Closes every open trade on each selected bot.'
        }`
      )
    ) {
      return;
    }

    setIsExecuting(true);
    setLastResults(null);
    try {
      const results = await tradeManagementApi.forceExitAll({
        botIds: selectedBotIds,
        ordertype: ordertype || undefined,
      });
      setLastResults(results);
    } catch (err) {
      appLogger.error('Force-exit-all failed:', err);
      alert(`Failed to execute: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background dark">
      <div className="container mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Trade Management</h1>
          <p className="text-muted-foreground">Execute a trade across multiple bots at once</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Bot selection */}
          <Card>
            <CardHeader>
              <CardTitle>Select Bots</CardTitle>
              <CardDescription>Choose which bots this action applies to</CardDescription>
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
                  <label className="flex items-center gap-2 text-sm font-medium border-b border-border pb-2 mb-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedBotIds.length === enabledBots.length}
                      onChange={toggleAll}
                    />
                    Select all ({enabledBots.length})
                  </label>
                  {runmodesLoading && (
                    <p className="text-xs text-muted-foreground mb-2">Loading live/dry status…</p>
                  )}
                  {enabledBots.map((bot) => {
                    const mode = runmodes[bot.id] ?? 'unknown';
                    return (
                      <label key={bot.id} className="flex items-center gap-2 text-sm cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedBotIds.includes(bot.id)}
                          onChange={() => toggleBot(bot.id)}
                        />
                        <span className="flex-1">{bot.name}</span>
                        {mode === 'live' ? (
                          <span className="text-xs text-green-500">💰 Live</span>
                        ) : mode === 'dry_run' ? (
                          <span className="text-xs text-yellow-500">🔶 Dry</span>
                        ) : (
                          <span className="text-xs text-muted-foreground">Unknown</span>
                        )}
                      </label>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Action forms */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Execute</CardTitle>
              <CardDescription>
                {selectedBotIds.length} bot{selectedBotIds.length === 1 ? '' : 's'} selected
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-green-500" /> Force Enter
                  </h3>
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div>
                      <label className="block text-xs text-muted-foreground mb-1">Pair *</label>
                      <input
                        type="text"
                        value={pair}
                        onChange={(e) => setPair(e.target.value)}
                        placeholder="BTC/USD"
                        className="w-full px-3 py-2 text-sm rounded border border-border bg-background"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-muted-foreground mb-1">Side</label>
                      <select
                        value={side}
                        onChange={(e) => setSide(e.target.value as 'long' | 'short' | '')}
                        className="w-full px-3 py-2 text-sm rounded border border-border bg-background"
                      >
                        <option value="">Default (long)</option>
                        <option value="long">Long</option>
                        <option value="short">Short</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-muted-foreground mb-1">Order type</label>
                      <select
                        value={ordertype}
                        onChange={(e) => setOrdertype(e.target.value as 'limit' | 'market' | '')}
                        className="w-full px-3 py-2 text-sm rounded border border-border bg-background"
                      >
                        <option value="">Bot default</option>
                        <option value="limit">Limit</option>
                        <option value="market">Market</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-muted-foreground mb-1">Price (optional)</label>
                      <input
                        type="number"
                        value={price}
                        onChange={(e) => setPrice(e.target.value)}
                        placeholder="Market price if empty"
                        className="w-full px-3 py-2 text-sm rounded border border-border bg-background"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-muted-foreground mb-1">Stake amount (optional)</label>
                      <input
                        type="number"
                        value={stakeamount}
                        onChange={(e) => setStakeamount(e.target.value)}
                        placeholder="Bot default if empty"
                        className="w-full px-3 py-2 text-sm rounded border border-border bg-background"
                      />
                    </div>
                  </div>
                  <button
                    onClick={handleForceEnter}
                    disabled={isExecuting || selectedBotIds.length === 0}
                    className="px-4 py-2 text-sm font-medium rounded bg-green-600 hover:bg-green-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isExecuting ? 'Executing...' : `Force Enter on ${selectedBotIds.length} bot(s)`}
                  </button>
                </div>

                <div className="border-t border-border pt-6">
                  <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <TrendingDown className="h-4 w-4 text-red-500" /> Force Exit All
                  </h3>
                  <p className="text-xs text-muted-foreground mb-3">
                    Closes every open position on each selected bot. Uses the order type selected above.
                  </p>
                  <button
                    onClick={handleForceExitAll}
                    disabled={isExecuting || selectedBotIds.length === 0}
                    className="px-4 py-2 text-sm font-medium rounded bg-red-600 hover:bg-red-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isExecuting ? 'Executing...' : `Force Exit All on ${selectedBotIds.length} bot(s)`}
                  </button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {lastResults && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Results</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {lastResults.map((r) => (
                  <div
                    key={r.botId}
                    className="flex items-center gap-2 text-sm p-2 rounded border border-border"
                  >
                    {r.success ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
                    )}
                    <span className="font-medium">{r.botName}</span>
                    {!r.success && <span className="text-red-500">— {r.error}</span>}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
