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

import { useState, useMemo, useEffect } from 'react';
import { TrendingUp, Activity, DollarSign, Bot, CheckCircle2, XCircle, AlertTriangle, Zap, BarChart3, Globe, Layers, ArrowUpDown, ArrowUp, ArrowDown, Calendar, ChevronDown, Play, Square, Trash2, Settings, Plus, X } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/Card';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';

// Mock data for demonstration
const mockPerformanceData = [
  { time: '00:00', profit: 0 },
  { time: '04:00', profit: 120.5 },
  { time: '08:00', profit: 245.3 },
  { time: '12:00', profit: 189.2 },
  { time: '16:00', profit: 312.8 },
  { time: '20:00', profit: 456.1 },
  { time: '24:00', profit: 523.4 },
];

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

export function DashboardMock() {
  const [sortField, setSortField] = useState<SortField>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('7d');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState<10 | 50 | 'all'>(10);
  const [selectedBots, setSelectedBots] = useState<Set<string>>(new Set());
  const [showActionsDropdown, setShowActionsDropdown] = useState(false);
  const [comparisonBots, setComparisonBots] = useState<Set<string>>(new Set());

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

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      // Toggle direction
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else if (sortDirection === 'desc') {
        setSortField(null);
        setSortDirection(null);
      } else {
        setSortDirection('asc');
      }
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

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

  // Pagination
  const effectiveItemsPerPage = itemsPerPage === 'all' ? sortedBotData.length : itemsPerPage;
  const totalPages = itemsPerPage === 'all' ? 1 : Math.ceil(sortedBotData.length / itemsPerPage);
  const startIndex = itemsPerPage === 'all' ? 0 : (currentPage - 1) * itemsPerPage;
  const endIndex = itemsPerPage === 'all' ? sortedBotData.length : startIndex + itemsPerPage;
  const paginatedBotData = sortedBotData.slice(startIndex, endIndex);

  // Reset to page 1 when sorting, filtering, or items per page changes
  useEffect(() => {
    setCurrentPage(1);
  }, [sortField, sortDirection, timePeriod, itemsPerPage]);

  // Selection handlers
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedBots(new Set(paginatedBotData.map((bot) => bot.name)));
    } else {
      setSelectedBots(new Set());
    }
  };

  const handleSelectBot = (botName: string, checked: boolean) => {
    const newSelected = new Set(selectedBots);
    if (checked) {
      newSelected.add(botName);
    } else {
      newSelected.delete(botName);
    }
    setSelectedBots(newSelected);
  };

  const isAllSelected = paginatedBotData.length > 0 && paginatedBotData.every((bot) => selectedBots.has(bot.name));
  const isSomeSelected = paginatedBotData.some((bot) => selectedBots.has(bot.name));
  const selectedCount = selectedBots.size;

  // Action handlers
  const handleBulkAction = (action: 'start' | 'stop') => {
    const selectedNames = Array.from(selectedBots);
    console.log(`Action: ${action}`, selectedNames);
    // Here you would implement the actual action logic
    alert(`${action} action for bots: ${selectedNames.join(', ')}`);
    setSelectedBots(new Set());
    setShowActionsDropdown(false);
  };

  // Comparison handlers
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
    setComparisonBots(newComparison);
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return <ArrowUpDown className="h-3 w-3 ml-1 text-muted-foreground" />;
    }
    if (sortDirection === 'asc') {
      return <ArrowUp className="h-3 w-3 ml-1 text-primary" />;
    }
    return <ArrowDown className="h-3 w-3 ml-1 text-primary" />;
  };

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

        {/* Charts Row */}
        <div className="grid gap-4 md:grid-cols-2 mb-8">
          {/* Performance Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Performance Overview</CardTitle>
              <CardDescription>24h profit evolution across all bots</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={mockPerformanceData}>
                  <defs>
                    <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="time" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="profit" 
                    stroke="#3b82f6" 
                    fillOpacity={1} 
                    fill="url(#colorProfit)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Bot Performance */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Bot Performance Comparison</CardTitle>
                  <CardDescription>
                    {comparisonBots.size > 0 
                      ? `Comparing ${comparisonBots.size} selected bot${comparisonBots.size > 1 ? 's' : ''}`
                      : 'Select bots to compare (click + icon in table)'
                    }
                  </CardDescription>
                </div>
                {comparisonBots.size > 0 && (
                  <button
                    onClick={() => setComparisonBots(new Set())}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Clear comparison
                  </button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {comparisonBots.size > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart 
                    data={mockBotData.filter((bot) => comparisonBots.has(bot.name)).map((bot) => ({
                      name: bot.name,
                      profit: bot.data[timePeriod].profit,
                    }))}
                    margin={{ top: 5, right: 30, left: 20, bottom: 80 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="name" className="text-xs" angle={-45} textAnchor="end" height={80} />
                    <YAxis className="text-xs" domain={['auto', 'auto']} />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                    />
                    <Bar 
                      dataKey="profit" 
                      shape={(props: any) => {
                        const { payload, x, y, width, height } = props;
                        const isPositive = payload.profit >= 0;
                        const barHeight = Math.abs(height);
                        const barY = isPositive ? y : y - barHeight;
                        
                        return (
                          <rect
                            x={x}
                            y={barY}
                            width={width}
                            height={barHeight}
                            fill={isPositive ? '#22c55e' : '#ef4444'}
                            rx={4}
                          />
                        );
                      }}
                    />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                  <div className="text-center">
                    <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p className="text-sm">No bots selected for comparison</p>
                    <p className="text-xs mt-2">Click the + icon in the table to add bots to comparison</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Bots Table */}
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
                        className="fixed inset-0 z-10"
                        onClick={() => setShowActionsDropdown(false)}
                      />
                      <div className="absolute top-full left-0 mt-2 w-48 bg-card border border-border rounded-lg shadow-lg z-20">
                        <button
                          onClick={() => handleBulkAction('start')}
                          className="w-full text-left px-4 py-2 text-sm hover:bg-muted transition-colors rounded-t-lg"
                        >
                          Start
                        </button>
                        <button
                          onClick={() => handleBulkAction('stop')}
                          className="w-full text-left px-4 py-2 text-sm hover:bg-muted transition-colors"
                        >
                          Stop
                        </button>
                      </div>
                    </>
                  )}
                </div>
                <button
                  onClick={() => setSelectedBots(new Set())}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Clear selection
                </button>
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
                        ref={(input) => {
                          if (input) input.indeterminate = isSomeSelected && !isAllSelected;
                        }}
                        onChange={(e) => handleSelectAll(e.target.checked)}
                        className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                      />
                    </th>
                    <th 
                      className="text-left p-4 text-sm font-medium text-muted-foreground cursor-pointer hover:text-foreground transition-colors select-none"
                      onClick={() => handleSort('name')}
                    >
                      <div className="flex items-center">
                        Bot Name
                        <SortIcon field="name" />
                      </div>
                    </th>
                    <th 
                      className="text-left p-4 text-sm font-medium text-muted-foreground cursor-pointer hover:text-foreground transition-colors select-none"
                      onClick={() => handleSort('status')}
                    >
                      <div className="flex items-center">
                        Status
                        <SortIcon field="status" />
                      </div>
                    </th>
                    <th 
                      className="text-right p-4 text-sm font-medium text-muted-foreground cursor-pointer hover:text-foreground transition-colors select-none"
                      onClick={() => handleSort('trades')}
                    >
                      <div className="flex items-center justify-end">
                        Trades
                        <SortIcon field="trades" />
                      </div>
                    </th>
                    <th 
                      className="text-right p-4 text-sm font-medium text-muted-foreground cursor-pointer hover:text-foreground transition-colors select-none"
                      onClick={() => handleSort('profit')}
                    >
                      <div className="flex items-center justify-end">
                        Profit
                        <SortIcon field="profit" />
                      </div>
                    </th>
                    <th 
                      className="text-right p-4 text-sm font-medium text-muted-foreground cursor-pointer hover:text-foreground transition-colors select-none"
                      onClick={() => handleSort('winRate')}
                    >
                      <div className="flex items-center justify-end">
                        Win Rate
                        <SortIcon field="winRate" />
                      </div>
                    </th>
                    <th className="text-right p-4 text-sm font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedBotData.map((bot, index) => {
                    const periodData = bot.data[timePeriod];
                    const isSelected = selectedBots.has(bot.name);
                    return (
                      <tr key={index} className={`group border-b border-border transition-colors cursor-pointer ${isSelected ? 'bg-primary/10 hover:bg-yellow-500/20' : 'hover:bg-yellow-500/20'}`}>
                        <td className="p-4">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => handleSelectBot(bot.name, e.target.checked)}
                            className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                          />
                        </td>
                        <td className="p-4">
                          <div className="font-medium">{bot.name}</div>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            {bot.status === 'online' ? (
                              <>
                                <CheckCircle2 className="h-4 w-4 text-green-500" />
                                <span className="text-sm text-green-500">Online</span>
                              </>
                            ) : (
                              <>
                                <XCircle className="h-4 w-4 text-red-500" />
                                <span className="text-sm text-red-500">Offline</span>
                              </>
                            )}
                          </div>
                        </td>
                        <td className="p-4 text-right">
                          <span className="font-medium">{periodData.trades}</span>
                        </td>
                        <td className="p-4 text-right">
                          <span className={`font-medium ${periodData.profit >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                            ${periodData.profit.toFixed(2)}
                          </span>
                        </td>
                        <td className="p-4 text-right">
                          <span className="font-medium">{periodData.winRate}%</span>
                        </td>
                        <td className="p-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {/* Comparison Toggle - Always visible */}
                            <button
                              className={`p-2 rounded-lg transition-colors ${
                                comparisonBots.has(bot.name)
                                  ? 'bg-primary/20 text-primary'
                                  : comparisonBots.size >= 10
                                  ? 'opacity-0 group-hover:opacity-50 cursor-not-allowed'
                                  : 'opacity-0 group-hover:opacity-100 hover:bg-primary/20 text-primary'
                              }`}
                              title={
                                comparisonBots.has(bot.name)
                                  ? 'Remove from comparison'
                                  : comparisonBots.size >= 10
                                  ? 'Maximum 10 bots allowed. Remove one first.'
                                  : 'Add to comparison'
                              }
                              disabled={comparisonBots.size >= 10 && !comparisonBots.has(bot.name)}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleToggleComparison(bot.name);
                              }}
                            >
                              {comparisonBots.has(bot.name) ? (
                                <X className="h-4 w-4" />
                              ) : (
                                <Plus className="h-4 w-4" />
                              )}
                            </button>
                            
                            {/* Action buttons - Only visible on hover */}
                            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              {bot.status === 'online' ? (
                                <button
                                  className="p-2 hover:bg-yellow-500/20 rounded-lg transition-colors"
                                  title="Stop Bot"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    console.log('Stop bot:', bot.name);
                                  }}
                                >
                                  <Square className="h-4 w-4 text-yellow-500" />
                                </button>
                              ) : (
                                <button
                                  className="p-2 hover:bg-green-500/20 rounded-lg transition-colors"
                                  title="Start Bot"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    console.log('Start bot:', bot.name);
                                  }}
                                >
                                  <Play className="h-4 w-4 text-green-500" />
                                </button>
                              )}
                              <button
                                className="p-2 hover:bg-red-500/20 rounded-lg transition-colors"
                                title="Delete Bot"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  console.log('Delete bot:', bot.name);
                                }}
                              >
                                <Trash2 className="h-4 w-4 text-red-500" />
                              </button>
                              <button
                                className="p-2 hover:bg-primary/20 rounded-lg transition-colors"
                                title="Configure Bot"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  console.log('Configure bot:', bot.name);
                                }}
                              >
                                <Settings className="h-4 w-4 text-primary" />
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            
            {/* Pagination Controls */}
            <div className="mt-6 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="text-sm text-muted-foreground">
                  Showing {startIndex + 1} to {Math.min(endIndex, sortedBotData.length)} of {sortedBotData.length} bots
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Show:</span>
                  <select
                    value={itemsPerPage}
                    onChange={(e) => setItemsPerPage(e.target.value === 'all' ? 'all' : Number(e.target.value) as 10 | 50)}
                    className="px-3 py-1.5 text-sm bg-background border border-border rounded-lg hover:bg-muted transition-colors focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value={10}>10</option>
                    <option value={50}>50</option>
                    <option value="all">All</option>
                  </select>
                </div>
              </div>
              {itemsPerPage !== 'all' && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1.5 text-sm border border-border rounded-lg hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        className={`px-3 py-1.5 text-sm border rounded-lg transition-colors ${
                          currentPage === page
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'border-border hover:bg-muted'
                        }`}
                      >
                        {page}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1.5 text-sm border border-border rounded-lg hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
