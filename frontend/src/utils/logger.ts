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

type LogLevel = 'error' | 'warn' | 'info' | 'debug';

function formatMessage(level: LogLevel, message: string): string {
  const timestamp = new Date().toISOString();
  return `[${timestamp}] [${level.toUpperCase()}] ${message}`;
}

export const appLogger = {
  error: (message: string, ...args: unknown[]): void => {
    console.error(formatMessage('error', message), ...args);
  },
  warn: (message: string, ...args: unknown[]): void => {
    console.warn(formatMessage('warn', message), ...args);
  },
  info: (message: string, ...args: unknown[]): void => {
    console.info(formatMessage('info', message), ...args);
  },
  debug: (message: string, ...args: unknown[]): void => {
    console.debug(formatMessage('debug', message), ...args);
  },
};
