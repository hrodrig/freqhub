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

import { valkeyService } from './valkey.service.js';
import { appLogger } from '../utils/logger.js';
import { EventEmitter } from 'events';

export interface FreqHubEvent {
  type: string;
  botId?: string;
  data: any;
  timestamp: number;
}

/**
 * Event Bus Service
 * Centralizes all system events and distributes them via Valkey Pub/Sub
 */
class EventBusService extends EventEmitter {
  private readonly MAIN_CHANNEL = 'freqhub:events';

  constructor() {
    super();
    this.initializeSubscriber();
  }

  private initializeSubscriber(): void {
    const subscriber = valkeyService.getSubscriber();
    if (!subscriber) {
      appLogger.warn('EventBus: Valkey subscriber not available. Events will be local only.');
      return;
    }

    subscriber.subscribe(this.MAIN_CHANNEL, (err) => {
      if (err) {
        appLogger.error(`EventBus: Failed to subscribe to ${this.MAIN_CHANNEL}:`, err);
        return;
      }
      appLogger.info(`EventBus: Subscribed to Valkey channel ${this.MAIN_CHANNEL}`);
    });

    subscriber.on('message', (channel, message) => {
      if (channel === this.MAIN_CHANNEL) {
        try {
          const event: FreqHubEvent = JSON.parse(message);
          // Emit locally so internal services can listen
          this.emit('event', event);
          if (event.botId) {
            this.emit(`bot:${event.botId}`, event);
          }
          this.emit(event.type, event);
        } catch (error) {
          appLogger.error('EventBus: Failed to parse event message:', error);
        }
      }
    });
  }

  /**
   * Publish an event to the bus
   */
  async publish(event: Omit<FreqHubEvent, 'timestamp'>): Promise<void> {
    const fullEvent: FreqHubEvent = {
      ...event,
      timestamp: Date.now(),
    };

    // 1. Emit locally first
    this.emit('event', fullEvent);
    if (fullEvent.botId) {
      this.emit(`bot:${fullEvent.botId}`, fullEvent);
    }
    this.emit(fullEvent.type, fullEvent);

    // 2. Publish to Valkey for other instances/services
    try {
      await valkeyService.publish(this.MAIN_CHANNEL, fullEvent);
    } catch (error) {
      appLogger.error('EventBus: Failed to publish event to Valkey:', error);
    }
  }

  /**
   * Helper to publish bot status change
   */
  async publishBotStatus(botId: string, status: any): Promise<void> {
    await this.publish({
      type: 'bot_status_update',
      botId,
      data: status,
    });
  }

  /**
   * Helper to publish new trade
   */
  async publishTrade(botId: string, trade: any): Promise<void> {
    await this.publish({
      type: 'new_trade',
      botId,
      data: trade,
    });
  }
}

// Export singleton instance
export const eventBusService = new EventBusService();

