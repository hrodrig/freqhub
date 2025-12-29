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

import Redis from 'ioredis';
import { env } from '../config/env.js';
import { appLogger } from '../utils/logger.js';

/**
 * Valkey Service
 * Provides caching, pub/sub, and session storage using Valkey (Redis-compatible)
 */
class ValkeyService {
  private client: Redis | null = null;
  private subscriber: Redis | null = null;
  private isConnected = false;

  constructor() {
    if (env.VALKEY_ENABLED) {
      this.initialize();
    } else {
      appLogger.info('Valkey is disabled (VALKEY_ENABLED=false)');
    }
  }

  private initialize(): void {
    try {
      this.client = new Redis({
        host: env.VALKEY_HOST,
        port: env.VALKEY_PORT,
        password: env.VALKEY_PASSWORD,
        retryStrategy: (times) => {
          const delay = Math.min(times * 50, 2000);
          return delay;
        },
        maxRetriesPerRequest: 3,
        lazyConnect: true,
      });

      this.client.on('error', (err) => {
        appLogger.error('Valkey connection error:', err);
        this.isConnected = false;
      });

      this.client.on('connect', () => {
        appLogger.info('Connected to Valkey');
        this.isConnected = true;
      });

      this.client.on('close', () => {
        appLogger.warn('Valkey connection closed');
        this.isConnected = false;
      });

      // Connect asynchronously
      this.client.connect().catch((err) => {
        appLogger.error('Failed to connect to Valkey:', err);
        this.isConnected = false;
      });
    } catch (error) {
      appLogger.error('Failed to initialize Valkey:', error);
      this.isConnected = false;
    }
  }

  /**
   * Check if Valkey is enabled and connected
   */
  isEnabled(): boolean {
    return env.VALKEY_ENABLED && this.isConnected && this.client !== null;
  }

  /**
   * Get value from cache
   */
  async get<T>(key: string): Promise<T | null> {
    if (!this.isEnabled() || !this.client) {
      return null;
    }

    try {
      const data = await this.client.get(key);
      return data ? (JSON.parse(data) as T) : null;
    } catch (error) {
      appLogger.error(`Error getting key ${key} from Valkey:`, error);
      return null;
    }
  }

  /**
   * Set value in cache with optional TTL
   */
  async set(key: string, value: unknown, ttl?: number): Promise<void> {
    if (!this.isEnabled() || !this.client) {
      return;
    }

    try {
      const serialized = JSON.stringify(value);
      if (ttl) {
        await this.client.setex(key, ttl, serialized);
      } else {
        await this.client.set(key, serialized);
      }
    } catch (error) {
      appLogger.error(`Error setting key ${key} in Valkey:`, error);
    }
  }

  /**
   * Delete a key from cache
   */
  async del(key: string): Promise<void> {
    if (!this.isEnabled() || !this.client) {
      return;
    }

    try {
      await this.client.del(key);
    } catch (error) {
      appLogger.error(`Error deleting key ${key} from Valkey:`, error);
    }
  }

  /**
   * Delete multiple keys
   */
  async delMultiple(keys: string[]): Promise<void> {
    if (!this.isEnabled() || !this.client || keys.length === 0) {
      return;
    }

    try {
      await this.client.del(...keys);
    } catch (error) {
      appLogger.error(`Error deleting keys from Valkey:`, error);
    }
  }

  /**
   * Get multiple values in batch
   */
  async mget<T>(keys: string[]): Promise<(T | null)[]> {
    if (!this.isEnabled() || !this.client || keys.length === 0) {
      return keys.map(() => null);
    }

    try {
      const values = await this.client.mget(...keys);
      return values.map((v) => (v ? (JSON.parse(v) as T) : null));
    } catch (error) {
      appLogger.error('Error getting multiple keys from Valkey:', error);
      return keys.map(() => null);
    }
  }

  /**
   * Set multiple values in batch
   */
  async mset(data: Record<string, unknown>, ttl?: number): Promise<void> {
    if (!this.isEnabled() || !this.client || Object.keys(data).length === 0) {
      return;
    }

    try {
      const pipeline = this.client.pipeline();
      for (const [key, value] of Object.entries(data)) {
        const serialized = JSON.stringify(value);
        if (ttl) {
          pipeline.setex(key, ttl, serialized);
        } else {
          pipeline.set(key, serialized);
        }
      }
      await pipeline.exec();
    } catch (error) {
      appLogger.error('Error setting multiple keys in Valkey:', error);
    }
  }

  /**
   * Increment a key (useful for rate limiting)
   */
  async incr(key: string): Promise<number> {
    if (!this.isEnabled() || !this.client) {
      return 0;
    }

    try {
      return await this.client.incr(key);
    } catch (error) {
      appLogger.error(`Error incrementing key ${key} in Valkey:`, error);
      return 0;
    }
  }

  /**
   * Set expiration on a key
   */
  async expire(key: string, seconds: number): Promise<boolean> {
    if (!this.isEnabled() || !this.client) {
      return false;
    }

    try {
      const result = await this.client.expire(key, seconds);
      return result === 1;
    } catch (error) {
      appLogger.error(`Error setting expiration on key ${key} in Valkey:`, error);
      return false;
    }
  }

  /**
   * Publish message to a channel (Pub/Sub)
   */
  async publish(channel: string, message: unknown): Promise<void> {
    if (!this.isEnabled() || !this.client) {
      return;
    }

    try {
      await this.client.publish(channel, JSON.stringify(message));
    } catch (error) {
      appLogger.error(`Error publishing to channel ${channel} in Valkey:`, error);
    }
  }

  /**
   * Get subscriber instance for Pub/Sub
   * Note: Requires a separate connection for subscribing
   */
  getSubscriber(): Redis | null {
    if (!env.VALKEY_ENABLED) {
      return null;
    }

    if (!this.subscriber) {
      try {
        this.subscriber = new Redis({
          host: env.VALKEY_HOST,
          port: env.VALKEY_PORT,
          password: env.VALKEY_PASSWORD,
          retryStrategy: (times) => {
            const delay = Math.min(times * 50, 2000);
            return delay;
          },
          maxRetriesPerRequest: 3,
        });

        this.subscriber.on('error', (err) => {
          appLogger.error('Valkey subscriber error:', err);
        });

        this.subscriber.on('connect', () => {
          appLogger.info('Valkey subscriber connected');
        });
      } catch (error) {
        appLogger.error('Failed to create Valkey subscriber:', error);
        return null;
      }
    }

    return this.subscriber;
  }

  /**
   * Health check - ping Valkey
   */
  async ping(): Promise<boolean> {
    if (!this.isEnabled() || !this.client) {
      return false;
    }

    try {
      const result = await this.client.ping();
      return result === 'PONG';
    } catch (error) {
      appLogger.error('Valkey ping failed:', error);
      return false;
    }
  }

  /**
   * Get Valkey info
   */
  async getInfo(section?: string): Promise<string | null> {
    if (!this.isEnabled() || !this.client) {
      return null;
    }

    try {
      if (section) {
        return await this.client.info(section);
      }
      return await this.client.info();
    } catch (error) {
      appLogger.error('Error getting Valkey info:', error);
      return null;
    }
  }

  /**
   * Get metrics
   */
  async getMetrics(): Promise<{
    connected: boolean;
    totalCommands?: number;
    connectedClients?: number;
    usedMemory?: string;
    keyspace?: string;
  }> {
    const connected = await this.ping();
    if (!connected) {
      return { connected: false };
    }

    try {
      const stats = await this.getInfo('stats');
      const memory = await this.getInfo('memory');
      const keyspace = await this.getInfo('keyspace');

      const parseInfo = (info: string | null, key: string): string | undefined => {
        if (!info) return undefined;
        const match = info.match(new RegExp(`${key}:(.+)`));
        return match ? match[1].trim() : undefined;
      };

      return {
        connected: true,
        totalCommands: stats ? parseInt(parseInfo(stats, 'total_commands_processed') || '0', 10) : undefined,
        connectedClients: stats ? parseInt(parseInfo(stats, 'connected_clients') || '0', 10) : undefined,
        usedMemory: parseInfo(memory, 'used_memory_human'),
        keyspace: keyspace || undefined,
      };
    } catch (error) {
      appLogger.error('Error getting Valkey metrics:', error);
      return { connected: true };
    }
  }

  /**
   * Close connections
   */
  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.quit();
      this.client = null;
    }
    if (this.subscriber) {
      await this.subscriber.quit();
      this.subscriber = null;
    }
    this.isConnected = false;
  }
}

// Export singleton instance
export const valkeyService = new ValkeyService();

