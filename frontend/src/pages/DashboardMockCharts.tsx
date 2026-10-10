/*
 * FreqHub - Lazy-loaded charts for DashboardMock (recharts code-splitting)
 * Copyright (C) 2025 - 2026  FreqHub Contributors
 */

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/Card.js';
import { BarChart3 } from 'lucide-react';

const performanceData = [
  { time: '00:00', profit: 0 },
  { time: '04:00', profit: 120.5 },
  { time: '08:00', profit: 245.3 },
  { time: '12:00', profit: 189.2 },
  { time: '16:00', profit: 312.8 },
  { time: '20:00', profit: 456.1 },
  { time: '24:00', profit: 523.4 },
];

export interface ComparisonBarDatum {
  name: string;
  profit: number;
}

export function DashboardMockCharts({
  comparisonBarData,
  onClearComparison,
  hasComparisonSelection,
}: {
  comparisonBarData: ComparisonBarDatum[];
  onClearComparison: () => void;
  hasComparisonSelection: boolean;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2 mb-8">
      <Card>
        <CardHeader>
          <CardTitle>Performance Overview</CardTitle>
          <CardDescription>24h profit evolution across all bots</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={performanceData}>
              <defs>
                <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="time" className="text-xs" />
              <YAxis className="text-xs" />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                }}
              />
              <Area type="monotone" dataKey="profit" stroke="#3b82f6" fillOpacity={1} fill="url(#colorProfit)" />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Bot Performance Comparison</CardTitle>
              <CardDescription>
                {hasComparisonSelection
                  ? `Comparing ${comparisonBarData.length} selected bot${comparisonBarData.length > 1 ? 's' : ''}`
                  : 'Select bots to compare (click + icon in table)'}
              </CardDescription>
            </div>
            {hasComparisonSelection && (
              <button
                type="button"
                onClick={onClearComparison}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onClearComparison();
                  }
                }}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Clear comparison"
              >
                Clear comparison
              </button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {hasComparisonSelection ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={comparisonBarData} margin={{ top: 5, right: 30, left: 20, bottom: 80 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="name" className="text-xs" angle={-45} textAnchor="end" height={80} />
                <YAxis className="text-xs" domain={['auto', 'auto']} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                />
                <Bar
                  dataKey="profit"
                  shape={(props: { payload?: { profit: number }; x?: number; y?: number; width?: number; height?: number }) => {
                    const { payload, x = 0, y = 0, width = 0, height = 0 } = props;
                    const isPositive = (payload?.profit ?? 0) >= 0;
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
  );
}
