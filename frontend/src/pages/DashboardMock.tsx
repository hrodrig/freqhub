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

import { useState, useReducer, useMemo, lazy, Suspense } from 'react';
import { TrendingUp, Activity, DollarSign, Bot, CheckCircle2, XCircle, ArrowUpDown, ArrowUp, ArrowDown, Calendar, ChevronDown, Play, Square, Trash2, Settings, Plus, X } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/Card';
import { appLogger } from '../utils/logger.js';

const DashboardMockCharts = lazy(() => import('./DashboardMockCharts.js').then((m) => ({ default: m.DashboardMockCharts })));

// Mock data for demonstration
type TimePeriod = '24h' | '7d' | '30d' | 'all';

interface BotData {
  name: string;
  status: 'online' | 'offline';
  data: {
    [key in TimePeriod]: {
      trades: number;
      profit: number;
      winRate: number;
    };
  };
}

const mockBotData: BotData[] = [
  {
    name: 'EMAC-RSI-EMA200',
    status: 'online',
    data: {
      '24h': { trades: 12, profit: 45.2, winRate: 75 },
      '7d': { trades: 45, profit: 523.4, winRate: 68 },
      '30d': { trades: 180, profit: 2150.8, winRate: 65 },
      'all': { trades: 1245, profit: 15230.5, winRate: 62 },
    },
  },
  {
    name: 'BB-RSI-MACD',
    status: 'online',
    data: {
      '24h': { trades: 8, profit: 28.5, winRate: 87 },
      '7d': { trades: 32, profit: 312.8, winRate: 72 },
      '30d': { trades: 145, profit: 1890.3, winRate: 70 },
      'all': { trades: 980, profit: 12340.2, winRate: 68 },
    },
  },
  {
    name: 'ADX-CCI-Trend',
    status: 'online',
    data: {
      '24h': { trades: 5, profit: 18.3, winRate: 80 },
      '7d': { trades: 28, profit: 189.2, winRate: 65 },
      '30d': { trades: 120, profit: 1450.6, winRate: 63 },
      'all': { trades: 756, profit: 9870.4, winRate: 60 },
    },
  },
  {
    name: 'Stochastic-RSI-EMA',
    status: 'offline',
    data: {
      '24h': { trades: 0, profit: 0, winRate: 0 },
      '7d': { trades: 15, profit: -45.3, winRate: 58 },
      '30d': { trades: 65, profit: -120.5, winRate: 55 },
      'all': { trades: 420, profit: 2340.8, winRate: 58 },
    },
  },
  {
    name: 'RSI-Overbought-Oversold',
    status: 'online',
    data: {
      '24h': { trades: 15, profit: 62.4, winRate: 73 },
      '7d': { trades: 58, profit: 678.9, winRate: 71 },
      '30d': { trades: 235, profit: 2890.1, winRate: 69 },
      'all': { trades: 1520, profit: 18750.3, winRate: 67 },
    },
  },
  {
    name: 'MACD-Crossover-EMA',
    status: 'online',
    data: {
      '24h': { trades: 9, profit: 38.7, winRate: 78 },
      '7d': { trades: 38, profit: 412.5, winRate: 74 },
      '30d': { trades: 165, profit: 1980.2, winRate: 72 },
      'all': { trades: 1120, profit: 14560.8, winRate: 70 },
    },
  },
  {
    name: 'Bollinger-Bands-Squeeze',
    status: 'online',
    data: {
      '24h': { trades: 6, profit: 24.1, winRate: 83 },
      '7d': { trades: 25, profit: 298.6, winRate: 76 },
      '30d': { trades: 98, profit: 1234.5, winRate: 74 },
      'all': { trades: 680, profit: 8920.4, winRate: 72 },
    },
  },
  {
    name: 'Ichimoku-Cloud',
    status: 'online',
    data: {
      '24h': { trades: 11, profit: 52.3, winRate: 82 },
      '7d': { trades: 42, profit: 489.2, winRate: 79 },
      '30d': { trades: 178, profit: 2120.7, winRate: 77 },
      'all': { trades: 890, profit: 11230.6, winRate: 75 },
    },
  },
  {
    name: 'Fibonacci-Retracement',
    status: 'offline',
    data: {
      '24h': { trades: 0, profit: 0, winRate: 0 },
      '7d': { trades: 18, profit: -32.1, winRate: 61 },
      '30d': { trades: 72, profit: -98.4, winRate: 59 },
      'all': { trades: 450, profit: 3450.2, winRate: 61 },
    },
  },
  {
    name: 'Volume-Profile-Support',
    status: 'online',
    data: {
      '24h': { trades: 13, profit: 58.9, winRate: 77 },
      '7d': { trades: 48, profit: 567.3, winRate: 73 },
      '30d': { trades: 195, profit: 2340.8, winRate: 71 },
      'all': { trades: 1250, profit: 15670.5, winRate: 69 },
    },
  },
  {
    name: 'Momentum-Oscillator',
    status: 'online',
    data: {
      '24h': { trades: 7, profit: 31.2, winRate: 71 },
      '7d': { trades: 29, profit: 345.7, winRate: 68 },
      '30d': { trades: 118, profit: 1678.9, winRate: 66 },
      'all': { trades: 720, profit: 9870.3, winRate: 64 },
    },
  },
  {
    name: 'Support-Resistance-Breakout',
    status: 'online',
    data: {
      '24h': { trades: 10, profit: 41.8, winRate: 84 },
      '7d': { trades: 35, profit: 423.1, winRate: 80 },
      '30d': { trades: 142, profit: 1890.5, winRate: 78 },
      'all': { trades: 980, profit: 12340.7, winRate: 76 },
    },
  },
  {
    name: 'Mean-Reversion-RSI',
    status: 'online',
    data: {
      '24h': { trades: 14, profit: 67.5, winRate: 79 },
      '7d': { trades: 52, profit: 612.4, winRate: 75 },
      '30d': { trades: 210, profit: 2567.8, winRate: 73 },
      'all': { trades: 1380, profit: 17230.9, winRate: 71 },
    },
  },
  {
    name: 'Trend-Following-ADX',
    status: 'offline',
    data: {
      '24h': { trades: 0, profit: 0, winRate: 0 },
      '7d': { trades: 22, profit: -28.5, winRate: 64 },
      '30d': { trades: 88, profit: -145.2, winRate: 62 },
      'all': { trades: 560, profit: 4560.1, winRate: 63 },
    },
  },
  {
    name: 'Scalping-EMA-Cross',
    status: 'online',
    data: {
      '24h': { trades: 18, profit: 89.3, winRate: 88 },
      '7d': { trades: 68, profit: 789.2, winRate: 85 },
      '30d': { trades: 275, profit: 3120.4, winRate: 83 },
      'all': { trades: 1850, profit: 21340.6, winRate: 81 },
    },
  },
];

type SortField = 'name' | 'status' | 'trades' | 'profit' | 'winRate' | null;
type SortDirection = 'asc' | 'desc' | null;

type DashboardMockState = {
  sortField: SortField;
  sortDirection: SortDirection;
  timePeriod: TimePeriod;
  itemsPerPage: 10 | 50 | 'all';
  selectedBots: Set<string>;
  showActionsDropdown: boolean;
  comparisonBots: Set<string>;
};

type DashboardMockAction =
  | { type: 'SORT'; field: SortField }
  | { type: 'SET_TIME_PERIOD'; payload: TimePeriod }
  | { type: 'SET_ITEMS_PER_PAGE'; payload: 10 | 50 | 'all' }
  | { type: 'SET_SELECTED_BOTS'; payload: Set<string> }
  | { type: 'SET_SHOW_ACTIONS_DROPDOWN'; payload: boolean }
  | { type: 'SET_COMPARISON_BOTS'; payload: Set<string> };

function dashboardMockReducer(state: DashboardMockState, action: DashboardMockAction): DashboardMockState {
  switch (action.type) {
    case 'SORT': {
      const { field } = action;
      if (state.sortField === field) {
        if (state.sortDirection === 'asc') return { ...state, sortDirection: 'desc' };
        if (state.sortDirection === 'desc') return { ...state, sortField: null, sortDirection: null };
        return { ...state, sortDirection: 'asc' };
      }
      return { ...state, sortField: field, sortDirection: 'asc' };
    }
    case 'SET_TIME_PERIOD':
      return { ...state, timePeriod: action.payload };
    case 'SET_ITEMS_PER_PAGE':
      return { ...state, itemsPerPage: action.payload };
    case 'SET_SELECTED_BOTS':
      return { ...state, selectedBots: action.payload };
    case 'SET_SHOW_ACTIONS_DROPDOWN':
      return { ...state, showActionsDropdown: action.payload };
    case 'SET_COMPARISON_BOTS':
      return { ...state, comparisonBots: action.payload };
    default:
      return state;
  }
}

const initialDashboardMockState: DashboardMockState = {
  sortField: null,
  sortDirection: null,
  timePeriod: '7d',
  itemsPerPage: 10,
  selectedBots: new Set(),
  showActionsDropdown: false,
  comparisonBots: new Set(),
};

function SortIcon({ field, sortField, sortDirection }: { field: SortField; sortField: SortField; sortDirection: SortDirection }) {
  if (sortField !== field) {
    return <ArrowUpDown className="h-3 w-3 ml-1 text-muted-foreground" />;
  }
  if (sortDirection === 'asc') {
    return <ArrowUp className="h-3 w-3 ml-1 text-primary" />;
  }
  return <ArrowDown className="h-3 w-3 ml-1 text-primary" />;
}

interface DashboardMockTableCardProps {
  sortedBotData: BotData[];
  timePeriod: TimePeriod;
  setTimePeriod: (v: TimePeriod) => void;
  itemsPerPage: 10 | 50 | 'all';
  setItemsPerPage: (v: 10 | 50 | 'all') => void;
  sortField: SortField;
  sortDirection: SortDirection;
  handleSort: (field: SortField) => void;
  selectedBots: Set<string>;
  setSelectedBots: React.Dispatch<React.SetStateAction<Set<string>>>;
  comparisonBots: Set<string>;
  handleToggleComparison: (botName: string) => void;
  showActionsDropdown: boolean;
  setShowActionsDropdown: (v: boolean) => void;
  handleBulkAction: (action: 'start' | 'stop') => void;
}

function DashboardMockTableCard(props: DashboardMockTableCardProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const {
    sortedBotData,
    timePeriod,
    setTimePeriod,
    itemsPerPage,
    setItemsPerPage,
    sortField,
    sortDirection,
    handleSort,
    selectedBots,
    setSelectedBots,
    comparisonBots,
    handleToggleComparison,
    showActionsDropdown,
    setShowActionsDropdown,
    handleBulkAction,
  } = props;
  const totalPages = itemsPerPage === 'all' ? 1 : Math.ceil(sortedBotData.length / itemsPerPage);
  const startIndex = itemsPerPage === 'all' ? 0 : (currentPage - 1) * itemsPerPage;
  const endIndex = itemsPerPage === 'all' ? sortedBotData.length : startIndex + itemsPerPage;
  const paginatedBotData = sortedBotData.slice(startIndex, endIndex);
  const isAllSelected = paginatedBotData.length > 0 && paginatedBotData.every((bot) => selectedBots.has(bot.name));
  const isSomeSelected = paginatedBotData.some((bot) => selectedBots.has(bot.name));
  const selectedCount = selectedBots.size;
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedBots(new Set(paginatedBotData.map((bot) => bot.name)));
    } else {
      setSelectedBots(new Set());
    }
  };
  const handleSelectBot = (botName: string, checked: boolean) => {
    const newSelected = new Set(selectedBots);
    if (checked) newSelected.add(botName);
    else newSelected.delete(botName);
    setSelectedBots(newSelected);
  };
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Bot Status - All Bots in One View</CardTitle>
            <CardDescription>Real-time status of all your trading bots</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <select
              value={timePeriod}
              onChange={(e) => setTimePeriod(e.target.value as TimePeriod)}
              className="px-3 py-1.5 text-sm bg-background border border-border rounded-lg hover:bg-muted transition-colors focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="24h">Last 24 hours</option>
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="all">All time</option>
            </select>
          </div>
        </div>
        {selectedCount > 0 && (
          <div className="mt-4 flex items-center gap-3 p-3 bg-primary/10 border border-primary/20 rounded-lg">
            <span className="text-sm font-medium text-foreground">
              {selectedCount} bot{selectedCount > 1 ? 's' : ''} selected
            </span>
            <div className="relative">
              <button
                onClick={() => setShowActionsDropdown(!showActionsDropdown)}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
              >
                For selected bots:
                <ChevronDown className={`h-4 w-4 transition-transform ${showActionsDropdown ? 'rotate-180' : ''}`} />
              </button>
                  {showActionsDropdown && (
                    <>
                      <div
                        role="button"
                        tabIndex={0}
                        className="fixed inset-0 z-10"
                        onClick={() => setShowActionsDropdown(false)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            setShowActionsDropdown(false);
                          }
                        }}
                        aria-label="Close menu"
                      />
                  <div className="absolute top-full left-0 mt-2 w-48 bg-card border border-border rounded-lg shadow-lg z-20">
                    <button onClick={() => handleBulkAction('start')} className="w-full text-left px-4 py-2 text-sm hover:bg-muted transition-colors rounded-t-lg">Start</button>
                    <button onClick={() => handleBulkAction('stop')} className="w-full text-left px-4 py-2 text-sm hover:bg-muted transition-colors">Stop</button>
                  </div>
                </>
              )}
            </div>
            <button onClick={() => setSelectedBots(new Set())} className="text-sm text-muted-foreground hover:text-foreground transition-colors">Clear selection</button>
          </div>
        )}
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="w-12 p-4">
                  <input
                    type="checkbox"
                    checked={isAllSelected}
                    ref={(input) => { if (input) input.indeterminate = isSomeSelected && !isAllSelected; }}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                  />
                </th>
                <th
                  role="button"
                  tabIndex={0}
                  className="text-left p-4 text-sm font-medium text-muted-foreground cursor-pointer hover:text-foreground transition-colors select-none"
                  onClick={() => handleSort('name')}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleSort('name'); } }}
                  aria-sort={sortField === 'name' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : undefined}
                >
                  <div className="flex items-center">Bot Name <SortIcon field="name" sortField={sortField} sortDirection={sortDirection} /></div>
                </th>
                <th
                  role="button"
                  tabIndex={0}
                  className="text-left p-4 text-sm font-medium text-muted-foreground cursor-pointer hover:text-foreground transition-colors select-none"
                  onClick={() => handleSort('status')}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleSort('status'); } }}
                  aria-sort={sortField === 'status' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : undefined}
                >
                  <div className="flex items-center">Status <SortIcon field="status" sortField={sortField} sortDirection={sortDirection} /></div>
                </th>
                <th
                  role="button"
                  tabIndex={0}
                  className="text-right p-4 text-sm font-medium text-muted-foreground cursor-pointer hover:text-foreground transition-colors select-none"
                  onClick={() => handleSort('trades')}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleSort('trades'); } }}
                  aria-sort={sortField === 'trades' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : undefined}
                >
                  <div className="flex items-center justify-end">Trades <SortIcon field="trades" sortField={sortField} sortDirection={sortDirection} /></div>
                </th>
                <th
                  role="button"
                  tabIndex={0}
                  className="text-right p-4 text-sm font-medium text-muted-foreground cursor-pointer hover:text-foreground transition-colors select-none"
                  onClick={() => handleSort('profit')}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleSort('profit'); } }}
                  aria-sort={sortField === 'profit' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : undefined}
                >
                  <div className="flex items-center justify-end">Profit <SortIcon field="profit" sortField={sortField} sortDirection={sortDirection} /></div>
                </th>
                <th
                  role="button"
                  tabIndex={0}
                  className="text-right p-4 text-sm font-medium text-muted-foreground cursor-pointer hover:text-foreground transition-colors select-none"
                  onClick={() => handleSort('winRate')}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleSort('winRate'); } }}
                  aria-sort={sortField === 'winRate' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : undefined}
                >
                  <div className="flex items-center justify-end">Win Rate <SortIcon field="winRate" sortField={sortField} sortDirection={sortDirection} /></div>
                </th>
                <th className="text-right p-4 text-sm font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedBotData.map((bot) => {
                const periodData = bot.data[timePeriod];
                const isSelected = selectedBots.has(bot.name);
                return (
                  <tr key={bot.name} className={`group border-b border-border transition-colors cursor-pointer ${isSelected ? 'bg-primary/10 hover:bg-yellow-500/20' : 'hover:bg-yellow-500/20'}`}>
                    <td className="p-4">
                      <input type="checkbox" checked={isSelected} onChange={(e) => handleSelectBot(bot.name, e.target.checked)} className="w-4 h-4 rounded border-border text-primary focus:ring-primary" />
                    </td>
                    <td className="p-4"><div className="font-medium">{bot.name}</div></td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        {bot.status === 'online' ? (<> <CheckCircle2 className="h-4 w-4 text-green-500" /><span className="text-sm text-green-500">Online</span></>) : (<> <XCircle className="h-4 w-4 text-red-500" /><span className="text-sm text-red-500">Offline</span></>)}
                      </div>
                    </td>
                    <td className="p-4 text-right"><span className="font-medium">{periodData.trades}</span></td>
                    <td className="p-4 text-right"><span className={`font-medium ${periodData.profit >= 0 ? 'text-green-500' : 'text-red-500'}`}>${periodData.profit.toFixed(2)}</span></td>
                    <td className="p-4 text-right"><span className="font-medium">{periodData.winRate}%</span></td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          className={`p-2 rounded-lg transition-colors ${comparisonBots.has(bot.name) ? 'bg-primary/20 text-primary' : comparisonBots.size >= 10 ? 'opacity-0 group-hover:opacity-50 cursor-not-allowed' : 'opacity-0 group-hover:opacity-100 hover:bg-primary/20 text-primary'}`}
                          title={comparisonBots.has(bot.name) ? 'Remove from comparison' : comparisonBots.size >= 10 ? 'Maximum 10 bots allowed.' : 'Add to comparison'}
                          disabled={comparisonBots.size >= 10 && !comparisonBots.has(bot.name)}
                          onClick={(e) => { e.stopPropagation(); handleToggleComparison(bot.name); }}
                        >
                          {comparisonBots.has(bot.name) ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                        </button>
                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          {bot.status === 'online' ? (
                            <button className="p-2 hover:bg-yellow-500/20 rounded-lg transition-colors" title="Stop Bot" onClick={(e) => { e.stopPropagation(); appLogger.info(`Stop bot: ${bot.name}`); }}><Square className="h-4 w-4 text-yellow-500" /></button>
                          ) : (
                            <button className="p-2 hover:bg-green-500/20 rounded-lg transition-colors" title="Start Bot" onClick={(e) => { e.stopPropagation(); appLogger.info(`Start bot: ${bot.name}`); }}><Play className="h-4 w-4 text-green-500" /></button>
                          )}
                          <button className="p-2 hover:bg-red-500/20 rounded-lg transition-colors" title="Delete Bot" onClick={(e) => { e.stopPropagation(); appLogger.info(`Delete bot: ${bot.name}`); }}><Trash2 className="h-4 w-4 text-red-500" /></button>
                          <button className="p-2 hover:bg-primary/20 rounded-lg transition-colors" title="Configure Bot" onClick={(e) => { e.stopPropagation(); appLogger.info(`Configure bot: ${bot.name}`); }}><Settings className="h-4 w-4 text-primary" /></button>
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="mt-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="text-sm text-muted-foreground">Showing {startIndex + 1} to {Math.min(endIndex, sortedBotData.length)} of {sortedBotData.length} bots</div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Show:</span>
              <select value={itemsPerPage} onChange={(e) => setItemsPerPage(e.target.value === 'all' ? 'all' : Number(e.target.value) as 10 | 50)} className="px-3 py-1.5 text-sm bg-background border border-border rounded-lg hover:bg-muted transition-colors focus:outline-none focus:ring-2 focus:ring-primary">
                <option value={10}>10</option>
                <option value={50}>50</option>
                <option value="all">All</option>
              </select>
            </div>
          </div>
          {itemsPerPage !== 'all' && (
            <div className="flex items-center gap-2">
              <button onClick={() => setCurrentPage((p: number) => Math.max(1, p - 1))} disabled={currentPage === 1} className="px-3 py-1.5 text-sm border border-border rounded-lg hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed">Previous</button>
              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                  <button key={page} onClick={() => setCurrentPage(page)} className={`px-3 py-1.5 text-sm border rounded-lg transition-colors ${currentPage === page ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted'}`}>{page}</button>
                ))}
              </div>
              <button onClick={() => setCurrentPage((p: number) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="px-3 py-1.5 text-sm border border-border rounded-lg hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed">Next</button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function DashboardMock() {
  const [state, dispatch] = useReducer(dashboardMockReducer, initialDashboardMockState);
  const { sortField, sortDirection, timePeriod, itemsPerPage, selectedBots, showActionsDropdown, comparisonBots } = state;

  const setTimePeriod = (v: TimePeriod) => dispatch({ type: 'SET_TIME_PERIOD', payload: v });
  const setItemsPerPage = (v: 10 | 50 | 'all') => dispatch({ type: 'SET_ITEMS_PER_PAGE', payload: v });
  const setSelectedBots = (payload: Set<string> | ((prev: Set<string>) => Set<string>)) => {
    dispatch({
      type: 'SET_SELECTED_BOTS',
      payload: typeof payload === 'function' ? payload(selectedBots) : payload,
    });
  };
  const setShowActionsDropdown = (v: boolean) => dispatch({ type: 'SET_SHOW_ACTIONS_DROPDOWN', payload: v });
  const setComparisonBots = (payload: Set<string>) => dispatch({ type: 'SET_COMPARISON_BOTS', payload });

  // Calculate totals based on selected time period
  const totals = useMemo(() => {
    const data = mockBotData.reduce(
      (acc, bot) => {
        const periodData = bot.data[timePeriod];
        acc.trades += periodData.trades;
        acc.profit += periodData.profit;
        acc.totalWinRate += periodData.winRate;
        acc.count++;
        return acc;
      },
      { trades: 0, profit: 0, totalWinRate: 0, count: 0 }
    );
    return {
      trades: data.trades,
      profit: data.profit,
      winRate: data.count > 0 ? data.totalWinRate / data.count : 0,
    };
  }, [timePeriod]);

  const totalProfit = totals.profit;
  const totalTrades = totals.trades;
  const winRate = totals.winRate;
  const activeBots = mockBotData.filter((bot) => bot.status === 'online').length;
  const totalBots = mockBotData.length;

  const handleSort = (field: SortField) => dispatch({ type: 'SORT', field });

  const sortedBotData = useMemo(() => {
    let sorted = [...mockBotData];

    if (sortField && sortDirection) {
      sorted = sorted.sort((a, b) => {
        let aValue: string | number;
        let bValue: string | number;

        switch (sortField) {
          case 'name':
            aValue = a.name;
            bValue = b.name;
            break;
          case 'status':
            aValue = a.status;
            bValue = b.status;
            break;
          case 'trades':
            aValue = a.data[timePeriod].trades;
            bValue = b.data[timePeriod].trades;
            break;
          case 'profit':
            aValue = a.data[timePeriod].profit;
            bValue = b.data[timePeriod].profit;
            break;
          case 'winRate':
            aValue = a.data[timePeriod].winRate;
            bValue = b.data[timePeriod].winRate;
            break;
          default:
            return 0;
        }

        if (typeof aValue === 'string' && typeof bValue === 'string') {
          return sortDirection === 'asc'
            ? aValue.localeCompare(bValue)
            : bValue.localeCompare(aValue);
        } else {
          return sortDirection === 'asc'
            ? (aValue as number) - (bValue as number)
            : (bValue as number) - (aValue as number);
        }
      });
    }

    return sorted;
  }, [sortField, sortDirection, timePeriod]);

  const handleBulkAction = (action: 'start' | 'stop') => {
    const selectedNames = Array.from(selectedBots);
    appLogger.info(`Action: ${action}`, selectedNames);
    alert(`${action} action for bots: ${selectedNames.join(', ')}`);
    dispatch({ type: 'SET_SELECTED_BOTS', payload: new Set() });
    dispatch({ type: 'SET_SHOW_ACTIONS_DROPDOWN', payload: false });
  };

  const handleToggleComparison = (botName: string) => {
    const newComparison = new Set(comparisonBots);
    if (comparisonBots.has(botName)) {
      newComparison.delete(botName);
    } else {
      if (comparisonBots.size >= 10) {
        alert('Maximum 10 bots can be compared at once. Please remove a bot first.');
        return;
      }
      newComparison.add(botName);
    }
    dispatch({ type: 'SET_COMPARISON_BOTS', payload: newComparison });
  };

  const tableKey = `${sortField}-${sortDirection}-${timePeriod}-${itemsPerPage}`;
  return (
    <div className="min-h-screen bg-background dark">

      {/* Dashboard Section - The Solution in Action */}
      <section className="container mx-auto px-6 py-8">
        <div className="mb-8 text-center">
          <h2 className="text-3xl font-bold text-foreground mb-2">FreqHub</h2>
          <p className="text-muted-foreground">Complete view of all your bots in real-time</p>
        </div>

        {/* Time Period Selector for Metrics */}
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-foreground">Dashboard Metrics</h2>
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <select
              value={timePeriod}
              onChange={(e) => setTimePeriod(e.target.value as TimePeriod)}
              className="px-3 py-1.5 text-sm bg-background border border-border rounded-lg hover:bg-muted transition-colors focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="24h">Last 24 hours</option>
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="all">All time</option>
            </select>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Profit</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${totalProfit.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground flex items-center mt-1">
                <TrendingUp className="h-3 w-3 text-green-500 mr-1" />
                <span className="text-green-500">+12.5%</span>{' '}
                {timePeriod === '24h' 
                  ? 'from yesterday' 
                  : timePeriod === '7d' 
                  ? 'from last week' 
                  : timePeriod === '30d' 
                  ? 'from last month' 
                  : 'from previous period'}
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
              <p className="text-xs text-muted-foreground mt-1">
                {timePeriod === '24h' ? 'Last 24h' : timePeriod === '7d' ? 'Last 7 days' : timePeriod === '30d' ? 'Last 30 days' : 'All time'}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Win Rate</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{winRate.toFixed(1)}%</div>
              <p className="text-xs text-muted-foreground flex items-center mt-1">
                <TrendingUp className="h-3 w-3 text-green-500 mr-1" />
                <span className="text-green-500">+2.3%</span>{' '}
                {timePeriod === '24h' 
                  ? 'from yesterday' 
                  : timePeriod === '7d' 
                  ? 'from last week' 
                  : timePeriod === '30d' 
                  ? 'from last month' 
                  : 'from previous period'}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Bots</CardTitle>
              <Bot className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{activeBots}/{totalBots}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {totalBots - activeBots} offline
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Charts Row (recharts loaded lazily for code-splitting) */}
        <Suspense fallback={<div className="grid gap-4 md:grid-cols-2 mb-8 h-[340px] animate-pulse bg-muted/20 rounded-lg" />}>
          <DashboardMockCharts
            comparisonBarData={mockBotData
              .filter((bot) => comparisonBots.has(bot.name))
              .map((bot) => ({ name: bot.name, profit: bot.data[timePeriod].profit }))}
            hasComparisonSelection={comparisonBots.size > 0}
            onClearComparison={() => setComparisonBots(new Set())}
          />
        </Suspense>

        <DashboardMockTableCard
          key={tableKey}
          sortedBotData={sortedBotData}
          timePeriod={timePeriod}
          setTimePeriod={setTimePeriod}
          itemsPerPage={itemsPerPage}
          setItemsPerPage={setItemsPerPage}
          sortField={sortField}
          sortDirection={sortDirection}
          handleSort={handleSort}
          selectedBots={selectedBots}
          setSelectedBots={setSelectedBots}
          comparisonBots={comparisonBots}
          handleToggleComparison={handleToggleComparison}
          showActionsDropdown={showActionsDropdown}
          setShowActionsDropdown={setShowActionsDropdown}
          handleBulkAction={handleBulkAction}
        />
      </section>
    </div>
  );
}
