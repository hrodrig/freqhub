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

interface CacheEntry<T> {
  value: T;
  expiresAt: number | null;
}

/**
 * Cache Service with fallback to in-memory storage
 * Uses Valkey when available, falls back to memory otherwise
 */
class CacheService {
  private memoryCache: Map<string, CacheEntry<unknown>> = new Map();
  private timers: Map<string, NodeJS.Timeout> = new Map();

  /**
   * Get value from cache (Valkey or memory)
   */
  async get<T>(key: string): Promise<T | null> {
    // Try Valkey first
    if (valkeyService.isEnabled()) {
      try {
        const value = await valkeyService.get<T>(key);
        if (value !== null) {
          return value;
        }
      } catch (error) {
        appLogger.warn(`Valkey get failed for key ${key}, falling back to memory:`, error);
      }
    }

    // Fallback to memory
    const entry = this.memoryCache.get(key);
    if (!entry) {
      return null;
    }

    // Check expiration
    if (entry.expiresAt && entry.expiresAt < Date.now()) {
      this.memoryCache.delete(key);
      const timer = this.timers.get(key);
      if (timer) {
        clearTimeout(timer);
        this.timers.delete(key);
      }
      return null;
    }

    return entry.value as T;
  }

  /**
   * Set value in cache with optional TTL (in seconds)
   */
  async set(key: string, value: unknown, ttl?: number): Promise<void> {
    const expiresAt = ttl ? Date.now() + ttl * 1000 : null;

    // Try Valkey first
    if (valkeyService.isEnabled()) {
      try {
        await valkeyService.set(key, value, ttl);
        // Also store in memory as backup
        this.setInMemory(key, value, expiresAt);
        return;
      } catch (error) {
        appLogger.warn(`Valkey set failed for key ${key}, using memory only:`, error);
      }
    }

    // Fallback to memory
    this.setInMemory(key, value, expiresAt);
  }

  /**
   * Set value in memory cache
   */
  private setInMemory(key: string, value: unknown, expiresAt: number | null): void {
    // Clear existing timer if any
    const existingTimer = this.timers.get(key);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Store value
    this.memoryCache.set(key, { value, expiresAt });

    // Set expiration timer if TTL provided
    if (expiresAt) {
      const ttlMs = expiresAt - Date.now();
      if (ttlMs > 0) {
        const timer = setTimeout(() => {
          this.memoryCache.delete(key);
          this.timers.delete(key);
        }, ttlMs);
        this.timers.set(key, timer);
      } else {
        // Already expired
        this.memoryCache.delete(key);
      }
    }
  }

  /**
   * Delete a key from cache
   */
  async del(key: string): Promise<void> {
    // Delete from Valkey
    if (valkeyService.isEnabled()) {
      try {
        await valkeyService.del(key);
      } catch (error) {
        appLogger.warn(`Valkey delete failed for key ${key}:`, error);
      }
    }

    // Delete from memory
    this.memoryCache.delete(key);
    const timer = this.timers.get(key);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(key);
    }
  }

  /**
   * Delete multiple keys
   */
  async delMultiple(keys: string[]): Promise<void> {
    // Delete from Valkey
    if (valkeyService.isEnabled()) {
      try {
        await valkeyService.delMultiple(keys);
      } catch (error) {
        appLogger.warn('Valkey delete multiple failed:', error);
      }
    }

    // Delete from memory
    for (const key of keys) {
      this.memoryCache.delete(key);
      const timer = this.timers.get(key);
      if (timer) {
        clearTimeout(timer);
        this.timers.delete(key);
      }
    }
  }

  /**
   * Get multiple values in batch
   */
  async mget<T>(keys: string[]): Promise<(T | null)[]> {
    // Try Valkey first
    if (valkeyService.isEnabled()) {
      try {
        const values = await valkeyService.mget<T>(keys);
        // Check if all values were found
        const allFound = values.every((v) => v !== null);
        if (allFound) {
          return values;
        }
        // Some missing, fallback to memory for missing ones
        const result: (T | null)[] = [];
        for (let i = 0; i < keys.length; i++) {
          if (values[i] !== null) {
            result[i] = values[i];
          } else {
            result[i] = await this.get<T>(keys[i]);
          }
        }
        return result;
      } catch (error) {
        appLogger.warn('Valkey mget failed, falling back to memory:', error);
      }
    }

    // Fallback to memory
    return Promise.all(keys.map((key) => this.get<T>(key)));
  }

  /**
   * Set multiple values in batch
   */
  async mset(data: Record<string, unknown>, ttl?: number): Promise<void> {
    // Try Valkey first
    if (valkeyService.isEnabled()) {
      try {
        await valkeyService.mset(data, ttl);
        // Also store in memory
        const expiresAt = ttl ? Date.now() + ttl * 1000 : null;
        for (const [key, value] of Object.entries(data)) {
          this.setInMemory(key, value, expiresAt);
        }
        return;
      } catch (error) {
        appLogger.warn('Valkey mset failed, using memory only:', error);
      }
    }

    // Fallback to memory
    const expiresAt = ttl ? Date.now() + ttl * 1000 : null;
    for (const [key, value] of Object.entries(data)) {
      this.setInMemory(key, value, expiresAt);
    }
  }

  /**
   * Increment a key (useful for rate limiting)
   */
  async incr(key: string): Promise<number> {
    if (valkeyService.isEnabled()) {
      try {
        return await valkeyService.incr(key);
      } catch (error) {
        appLogger.warn(`Valkey incr failed for key ${key}, using memory:`, error);
      }
    }

    // Fallback to memory
    const current = await this.get<number>(key);
    const newValue = (current || 0) + 1;
    await this.set(key, newValue);
    return newValue;
  }

  /**
   * Set expiration on a key
   */
  async expire(key: string, seconds: number): Promise<boolean> {
    if (valkeyService.isEnabled()) {
      try {
        return await valkeyService.expire(key, seconds);
      } catch (error) {
        appLogger.warn(`Valkey expire failed for key ${key}:`, error);
      }
    }

    // Fallback to memory
    const entry = this.memoryCache.get(key);
    if (!entry) {
      return false;
    }

    const expiresAt = Date.now() + seconds * 1000;
    entry.expiresAt = expiresAt;

    // Update timer
    const existingTimer = this.timers.get(key);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    const timer = setTimeout(() => {
      this.memoryCache.delete(key);
      this.timers.delete(key);
    }, seconds * 1000);
    this.timers.set(key, timer);

    return true;
  }

  /**
   * Clear all cache (memory only, Valkey keys remain)
   */
  clearMemory(): void {
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    this.timers.clear();
    this.memoryCache.clear();
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    valkeyEnabled: boolean;
    valkeyConnected: boolean;
    memoryEntries: number;
    memoryTimers: number;
  } {
    return {
      valkeyEnabled: valkeyService.isEnabled(),
      valkeyConnected: valkeyService.isEnabled(),
      memoryEntries: this.memoryCache.size,
      memoryTimers: this.timers.size,
    };
  }
}

// Export singleton instance
export const cacheService = new CacheService();

