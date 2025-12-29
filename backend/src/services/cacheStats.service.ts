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

/**
 * Cache Statistics Service
 * Tracks cache hits and misses for monitoring and debugging
 */
class CacheStatsService {
  private hits = 0;
  private misses = 0;
  private invalidations = 0;
  private keyStats: Map<string, { hits: number; misses: number }> = new Map();

  /**
   * Record a cache hit
   */
  recordHit(key: string): void {
    this.hits++;
    const stats = this.keyStats.get(key) || { hits: 0, misses: 0 };
    stats.hits++;
    this.keyStats.set(key, stats);
  }

  /**
   * Record a cache miss
   */
  recordMiss(key: string): void {
    this.misses++;
    const stats = this.keyStats.get(key) || { hits: 0, misses: 0 };
    stats.misses++;
    this.keyStats.set(key, stats);
  }

  /**
   * Record a cache invalidation
   */
  recordInvalidation(_key: string): void {
    this.invalidations++;
  }

  /**
   * Get statistics
   */
  getStats(): {
    total: { hits: number; misses: number; invalidations: number };
    hitRate: number;
    keyStats: Array<{ key: string; hits: number; misses: number; hitRate: number }>;
  } {
    const total = this.hits + this.misses;
    const hitRate = total > 0 ? (this.hits / total) * 100 : 0;

    const keyStatsArray = Array.from(this.keyStats.entries())
      .map(([key, stats]) => {
        const keyTotal = stats.hits + stats.misses;
        const keyHitRate = keyTotal > 0 ? (stats.hits / keyTotal) * 100 : 0;
        return {
          key,
          hits: stats.hits,
          misses: stats.misses,
          hitRate: keyHitRate,
        };
      })
      .sort((a, b) => b.hits - a.hits) // Sort by hits descending
      .slice(0, 20); // Top 20 keys

    return {
      total: {
        hits: this.hits,
        misses: this.misses,
        invalidations: this.invalidations,
      },
      hitRate: Math.round(hitRate * 100) / 100,
      keyStats: keyStatsArray,
    };
  }

  /**
   * Reset statistics
   */
  reset(): void {
    this.hits = 0;
    this.misses = 0;
    this.invalidations = 0;
    this.keyStats.clear();
  }
}

// Export singleton instance
export const cacheStatsService = new CacheStatsService();

