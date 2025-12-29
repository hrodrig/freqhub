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

type LogLevel = 'error' | 'warn' | 'info' | 'debug';

const LOG_LEVELS: Record<LogLevel, number> = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

const currentLogLevel = LOG_LEVELS[env.LOG_LEVEL] ?? LOG_LEVELS.info;

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] <= currentLogLevel;
}

export const appLogger = {
  error: (message: string, ...args: unknown[]): void => {
    if (shouldLog('error')) {
      console.error(`[ERROR] ${message}`, ...args);
    }
  },
  warn: (message: string, ...args: unknown[]): void => {
    if (shouldLog('warn')) {
      console.warn(`[WARN]  ${message}`, ...args);
    }
  },
  info: (message: string, ...args: unknown[]): void => {
    if (shouldLog('info')) {
      console.info(`[INFO]  ${message}`, ...args);
    }
  },
  debug: (message: string, ...args: unknown[]): void => {
    if (shouldLog('debug')) {
      console.debug(`[DEBUG] ${message}`, ...args);
    }
  },
};

