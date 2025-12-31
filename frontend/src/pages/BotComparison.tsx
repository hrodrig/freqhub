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

import { BarChart3 } from 'lucide-react';
import { Card, CardContent } from '../components/ui/Card';

export function BotComparison() {
  return (
    <div className="min-h-screen bg-background dark">
      <div className="container mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Bot Comparison</h1>
          <p className="text-muted-foreground">Compare performance across multiple bots</p>
        </div>

        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <BarChart3 className="h-16 w-16 text-muted-foreground mb-4 opacity-50" />
            <h2 className="text-2xl font-semibold text-foreground mb-2">Coming soon...</h2>
            <p className="text-muted-foreground text-center max-w-md">
              This feature will allow you to compare performance metrics, strategies, and results across multiple bots side by side.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

