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

import { env } from '../config/env.js';
import { appLogger } from '../utils/logger.js';
import { getAllBots } from './botService.js';
import { getBotPing, getBotOpenTrades, getBotBalance } from './botService.js';
import { cacheService } from './cache.service.js';

/**
 * Polling Service
 * Automatically polls enabled bots to keep cache fresh
 */
class PollingService {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;
  private lastPollTime: Map<string, number> = new Map();

  /**
   * Start the polling service
   */
  start(): void {
    if (!env.POLLING_ENABLED) {
      appLogger.info('Polling service is disabled (POLLING_ENABLED=false)');
      return;
    }

    if (this.isRunning) {
      appLogger.warn('Polling service is already running');
      return;
    }

    const interval = env.POLLING_INTERVAL;
    appLogger.info(`Starting polling service (interval: ${interval}ms)`);

    // Initial poll after a short delay to let the server fully start
    setTimeout(() => {
      this.pollAllBots();
    }, 2000);

    // Set up periodic polling
    this.intervalId = setInterval(() => {
      this.pollAllBots();
    }, interval);

    this.isRunning = true;
  }

  /**
   * Stop the polling service
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    appLogger.info('Polling service stopped');
  }

  /**
   * Poll all enabled bots
   */
  private async pollAllBots(): Promise<void> {
    try {
      const bots = getAllBots().filter((bot) => bot.isEnabled);
      
      if (bots.length === 0) {
        appLogger.debug('No enabled bots to poll');
        return;
      }

      appLogger.debug(`Polling ${bots.length} enabled bot(s)`);

      // Poll bots in parallel, but with a small delay between each to avoid overwhelming APIs
      const pollPromises = bots.map((bot, index) => 
        this.pollBot(bot.id, index * 100) // Stagger requests by 100ms
      );

      await Promise.allSettled(pollPromises);
      
      const now = Date.now();
      bots.forEach((bot) => {
        this.lastPollTime.set(bot.id, now);
      });

    } catch (error) {
      appLogger.error('Error in polling service:', error);
    }
  }

  /**
   * Poll a single bot
   */
  private async pollBot(botId: string, delay: number = 0): Promise<void> {
    // Wait for stagger delay
    if (delay > 0) {
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    try {
      // Check if data is already fresh in cache
      // We only poll if cache is about to expire or already expired
      const pingKey = `bot:${botId}:ping`;
      const openTradesKey = `bot:${botId}:open_trades`;
      const balanceKey = `bot:${botId}:balance`;

      const [pingCached, tradesCached, balanceCached] = await Promise.all([
        cacheService.get(pingKey),
        cacheService.get(openTradesKey),
        cacheService.get(balanceKey),
      ]);

      // If all data is fresh, skip polling this bot
      if (pingCached !== null && tradesCached !== null && balanceCached !== null) {
        appLogger.debug(`Skipping poll for bot ${botId} (cache is fresh)`);
        return;
      }

      appLogger.debug(`Polling bot ${botId}`);

      // Poll the bot (this will update cache and publish events)
      // We use Promise.allSettled to continue even if one fails
      await Promise.allSettled([
        getBotPing(botId).catch((err) => {
          appLogger.warn(`Failed to poll ping for bot ${botId}:`, err instanceof Error ? err.message : err);
        }),
        getBotOpenTrades(botId).catch((err) => {
          appLogger.warn(`Failed to poll open trades for bot ${botId}:`, err instanceof Error ? err.message : err);
        }),
        getBotBalance(botId).catch((err) => {
          appLogger.warn(`Failed to poll balance for bot ${botId}:`, err instanceof Error ? err.message : err);
        }),
      ]);

    } catch (error) {
      appLogger.error(`Error polling bot ${botId}:`, error);
    }
  }

  /**
   * Get polling statistics
   */
  getStats(): {
    enabled: boolean;
    running: boolean;
    interval: number;
    lastPollTimes: Record<string, number>;
  } {
    return {
      enabled: env.POLLING_ENABLED,
      running: this.isRunning,
      interval: env.POLLING_INTERVAL,
      lastPollTimes: Object.fromEntries(this.lastPollTime),
    };
  }

  /**
   * Manually trigger a poll for all bots (useful for testing)
   */
  async pollNow(): Promise<void> {
    if (!this.isRunning) {
      appLogger.warn('Polling service is not running. Use start() first.');
      return;
    }
    appLogger.info('Manual poll triggered');
    await this.pollAllBots();
  }
}

// Export singleton instance
export const pollingService = new PollingService();

