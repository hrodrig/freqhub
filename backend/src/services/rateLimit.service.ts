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
import { valkeyService } from './valkey.service.js';

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  reset: number; // Unix timestamp when the limit resets
  retryAfter?: number; // Seconds to wait before retrying
}

export interface RateLimitStats {
  botId: string;
  current: number;
  limit: number;
  reset: number;
}

/**
 * Rate Limit Service
 * Protects Freqtrade APIs from being overwhelmed by too many requests
 */
class RateLimitService {
  private readonly DEFAULT_LIMIT = 60; // requests per window
  private readonly DEFAULT_WINDOW = 60; // seconds
  private readonly ENABLED = env.RATE_LIMIT_ENABLED ?? true;
  
  // In-memory fallback when Valkey is not available
  private memoryStore: Map<string, { count: number; resetAt: number }> = new Map();

  /**
   * Check if rate limiting is enabled
   */
  isEnabled(): boolean {
    return this.ENABLED;
  }

  /**
   * Check rate limit for a bot
   * @param botId Bot identifier
   * @param limit Optional custom limit (default: 60 requests)
   * @param window Optional custom window in seconds (default: 60 seconds)
   * @returns Rate limit result with headers information
   */
  async checkLimit(
    botId: string,
    limit?: number,
    window?: number
  ): Promise<RateLimitResult> {
    if (!this.isEnabled()) {
      return {
        allowed: true,
        limit: limit || this.DEFAULT_LIMIT,
        remaining: limit || this.DEFAULT_LIMIT,
        reset: Math.floor(Date.now() / 1000) + (window || this.DEFAULT_WINDOW),
      };
    }

    const actualLimit = limit || this.DEFAULT_LIMIT;
    const actualWindow = window || this.DEFAULT_WINDOW;
    const key = `ratelimit:${botId}`;
    const now = Math.floor(Date.now() / 1000);
    const reset = now + actualWindow;

    // Try Valkey first
    if (valkeyService.isEnabled()) {
      try {
        // Use INCR which atomically increments and returns the new value
        const current = await valkeyService.incr(key);
        
        // Set expiration on first request (when count is 1)
        if (current === 1) {
          await valkeyService.expire(key, actualWindow);
        }

        const remaining = Math.max(0, actualLimit - current);
        const allowed = current <= actualLimit;

        if (!allowed) {
          appLogger.warn(
            `Rate limit exceeded for bot ${botId}: ${current}/${actualLimit} requests in ${actualWindow}s`
          );

          return {
            allowed: false,
            limit: actualLimit,
            remaining: 0,
            reset,
            retryAfter: actualWindow,
          };
        }

        return {
          allowed: true,
          limit: actualLimit,
          remaining,
          reset,
        };
      } catch (error) {
        appLogger.error('Valkey rate limit error, falling back to memory:', error);
        // Fall through to memory fallback
      }
    }

    // Memory fallback
    return this.checkLimitMemory(botId, actualLimit, actualWindow);
  }

  /**
   * Memory-based rate limiting (fallback)
   */
  private checkLimitMemory(
    botId: string,
    limit: number,
    window: number
  ): RateLimitResult {
    const key = botId;
    const now = Math.floor(Date.now() / 1000);
    const reset = now + window;

    const stored = this.memoryStore.get(key);
    
    if (!stored || stored.resetAt <= now) {
      // First request or window expired, reset
      this.memoryStore.set(key, {
        count: 1,
        resetAt: reset,
      });

      return {
        allowed: true,
        limit,
        remaining: limit - 1,
        reset,
      };
    }

    // Increment counter
    stored.count += 1;

    if (stored.count > limit) {
      const retryAfter = stored.resetAt - now;
      
      appLogger.warn(
        `Rate limit exceeded for bot ${botId}: ${stored.count}/${limit} requests in ${window}s`
      );

      return {
        allowed: false,
        limit,
        remaining: 0,
        reset: stored.resetAt,
        retryAfter,
      };
    }

    return {
      allowed: true,
      limit,
      remaining: limit - stored.count,
      reset: stored.resetAt,
    };
  }

  /**
   * Get current rate limit stats for a bot
   */
  async getStats(botId: string): Promise<RateLimitStats | null> {
    if (!this.isEnabled()) {
      return null;
    }

    const key = `ratelimit:${botId}`;
    
    if (valkeyService.isEnabled()) {
      try {
        // Get current count without incrementing
        const stored = await valkeyService.get(key);
        const current = stored ? parseInt(stored as string, 10) : 0;

        // Get TTL to calculate reset time
        // Note: ioredis doesn't have a direct TTL getter, so we estimate
        const now = Math.floor(Date.now() / 1000);
        const reset = now + this.DEFAULT_WINDOW; // Approximate

        return {
          botId,
          current,
          limit: this.DEFAULT_LIMIT,
          reset,
        };
      } catch (error) {
        appLogger.error('Error getting rate limit stats:', error);
      }
    }

    // Memory fallback
    const stored = this.memoryStore.get(botId);
    if (stored) {
      return {
        botId,
        current: stored.count,
        limit: this.DEFAULT_LIMIT,
        reset: stored.resetAt,
      };
    }

    return null;
  }

  /**
   * Reset rate limit for a bot (useful for testing)
   */
  async reset(botId: string): Promise<void> {
    const key = `ratelimit:${botId}`;
    
    if (valkeyService.isEnabled()) {
      try {
        await valkeyService.del(key);
      } catch (error) {
        appLogger.error('Error resetting rate limit:', error);
      }
    }

    this.memoryStore.delete(botId);
  }

  /**
   * Get all rate limit stats
   */
  async getAllStats(): Promise<RateLimitStats[]> {
    if (!this.isEnabled()) {
      return [];
    }

    // For Valkey, we'd need to scan keys, which is expensive
    // For now, return memory store stats
    const stats: RateLimitStats[] = [];
    const now = Math.floor(Date.now() / 1000);

    for (const [botId, stored] of this.memoryStore.entries()) {
      if (stored.resetAt > now) {
        stats.push({
          botId,
          current: stored.count,
          limit: this.DEFAULT_LIMIT,
          reset: stored.resetAt,
        });
      }
    }

    return stats;
  }
}

// Export singleton instance
export const rateLimitService = new RateLimitService();

