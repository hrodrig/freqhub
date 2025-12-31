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
import { getBotPing, getBotOpenTrades, getBotBalance, getBotState } from './botService.js';
import { cacheService } from './cache.service.js';
import { eventBusService } from './eventBus.service.js';

/**
 * Polling Service
 * Automatically polls enabled bots to keep cache fresh
 */
class PollingService {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;
  private lastPollTime: Map<string, number> = new Map();
  private botOnlineStatus: Map<string, boolean> = new Map(); // Track if bot was online in last poll

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

      // Initialize online status for bots that haven't been polled yet
      bots.forEach((bot) => {
        if (!this.botOnlineStatus.has(bot.id)) {
          // Initialize as unknown (will be determined on first poll)
          this.botOnlineStatus.set(bot.id, false);
        }
      });

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
      // Always check ping status first (even if cache is fresh) to detect online/offline changes
      // Check if bot was online in the last poll
      const wasOnline = this.botOnlineStatus.get(botId) ?? false;

      // Try to ping the bot first to check if it's online
      // This is critical for detecting online/offline state changes
      let isNowOnline = false;
      try {
        await getBotPing(botId);
        isNowOnline = true;
      } catch (err) {
        // Bot is offline
        this.handlePollError(botId, 'ping', err);
        isNowOnline = false;
      }

      // Update online status first to track changes
      const previousStatus = this.botOnlineStatus.get(botId);
      this.botOnlineStatus.set(botId, isNowOnline);
      
      // Log status change for debugging
      if (previousStatus !== undefined && previousStatus !== isNowOnline) {
        appLogger.info(`Bot ${botId} status changed: ${previousStatus ? 'online' : 'offline'} -> ${isNowOnline ? 'online' : 'offline'}`);
      }

      // If bot status changed from online to offline, publish event
      if (wasOnline && !isNowOnline) {
        appLogger.info(`Bot ${botId} went offline - publishing event`);
        eventBusService.publish({
          type: 'bot_offline',
          botId,
          data: { error: 'Bot is offline or unreachable' },
        }).catch((err) => {
          appLogger.error(`Failed to publish bot_offline event for ${botId}:`, err);
        });
      }

      // If bot status changed from offline to online, publish event
      if (!wasOnline && isNowOnline) {
        appLogger.info(`Bot ${botId} came back online - publishing event`);
        eventBusService.publish({
          type: 'bot_online',
          botId,
          data: { message: 'Bot is back online' },
        }).catch((err) => {
          appLogger.error(`Failed to publish bot_online event for ${botId}:`, err);
        });
      }

      // If bot is offline and we don't have a previous state (first poll), publish offline event
      // This ensures bots that start offline are immediately reported
      if (!isNowOnline && previousStatus === undefined) {
        appLogger.info(`Bot ${botId} is offline (initial state) - publishing event`);
        eventBusService.publish({
          type: 'bot_offline',
          botId,
          data: { error: 'Bot is offline or unreachable' },
        }).catch((err) => {
          appLogger.error(`Failed to publish bot_offline event for ${botId}:`, err);
        });
      }

      // Check if other data is already fresh in cache
      // We only poll other endpoints if cache is about to expire or already expired
      const openTradesKey = `bot:${botId}:open_trades`;
      const balanceKey = `bot:${botId}:balance`;
      const stateKey = `bot:${botId}:state`;

      const [tradesCached, balanceCached, stateCached] = await Promise.all([
        cacheService.get(openTradesKey),
        cacheService.get(balanceKey),
        cacheService.get(stateKey),
      ]);

      // If all data is fresh, skip polling other endpoints
      if (tradesCached !== null && balanceCached !== null && stateCached !== null) {
        appLogger.debug(`Skipping poll for bot ${botId} (cache is fresh, but ping status checked)`);
        return;
      }

      appLogger.debug(`Polling bot ${botId}`);

      // Only poll other endpoints if bot is online
      if (isNowOnline) {
        await Promise.allSettled([
          getBotOpenTrades(botId).catch((err) => {
            this.handlePollError(botId, 'open_trades', err);
          }),
          getBotBalance(botId).catch((err) => {
            this.handlePollError(botId, 'balance', err);
          }),
          getBotState(botId).catch((err) => {
            this.handlePollError(botId, 'state', err);
          }),
        ]);
      }

    } catch (error) {
      appLogger.error(`Error polling bot ${botId}:`, error);
    }
  }

  /**
   * Handle polling errors with appropriate log level
   */
  private handlePollError(botId: string, endpoint: string, error: unknown): void {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    // Common connection errors that are expected when bots are offline
    const isConnectionError = 
      errorMessage.includes('ECONNRESET') ||
      errorMessage.includes('socket hang up') ||
      errorMessage.includes('ETIMEDOUT') ||
      errorMessage.includes('ECONNREFUSED') ||
      errorMessage.includes('ENOTFOUND') ||
      errorMessage.includes('timeout');

    if (isConnectionError) {
      // Log connection errors at debug level (expected when bots are offline)
      appLogger.debug(`Bot ${botId} is unreachable (${endpoint}): ${errorMessage}`);
    } else {
      // Log other errors at warn level (unexpected errors)
      appLogger.warn(`Failed to poll ${endpoint} for bot ${botId}: ${errorMessage}`);
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

