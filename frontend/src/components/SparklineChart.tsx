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

import { LineChart, Line, ResponsiveContainer } from 'recharts';

interface SparklineChartProps {
  data: Array<{ date: string; profit: number }>;
  width?: number;
  height?: number;
}

export function SparklineChart({ data, width = 150, height = 40 }: SparklineChartProps) {
  if (!data || data.length === 0) {
    return (
      <div 
        className="flex items-center justify-center text-muted-foreground text-xs"
        style={{ width, height }}
      >
        No data
      </div>
    );
  }

  // Calculate cumulative profit for the line
  let cumulative = 0;
  const chartData = data.map((item) => {
    cumulative += item.profit || 0;
    return {
      date: item.date,
      profit: cumulative,
    };
  });

  // Determine color based on final profit
  const finalProfit = cumulative;
  const color = finalProfit >= 0 ? '#22c55e' : '#ef4444';

  return (
    <ResponsiveContainer width={width} height={height}>
      <LineChart data={chartData} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
        <Line
          type="monotone"
          dataKey="profit"
          stroke={color}
          strokeWidth={2}
          dot={false}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
