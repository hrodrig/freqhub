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

import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  PORT: z.string().default('3001'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DATABASE_PATH: z.string().default('./data/freqhub.db'),
  ENCRYPTION_KEY: z.string().min(32, 'Encryption key must be at least 32 characters'),
  JWT_SECRET: z.string().min(32, 'JWT secret must be at least 32 characters').default('change-this-jwt-secret-in-production-min-32-chars'),
  JWT_EXPIRES_IN: z.string().default('24h'), // Token expiration (e.g., '24h', '7d', '30d')
  CORS_ORIGIN: z.string().default('http://localhost:3000'),
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  BASE_PATH: z.string().default('').transform((val) => {
    // Normalize base path: ensure it starts with / and doesn't end with /
    if (!val) return '';
    const normalized = val.startsWith('/') ? val : `/${val}`;
    return normalized.endsWith('/') ? normalized.slice(0, -1) : normalized;
  }),
  // Valkey/Redis configuration
  VALKEY_HOST: z.string().default('localhost'),
  VALKEY_PORT: z.string().default('6379').transform((val) => parseInt(val, 10)),
  VALKEY_PASSWORD: z.string().optional(),
  VALKEY_ENABLED: z.string().default('false').transform((val) => val === 'true'),
  // Polling service configuration
  POLLING_ENABLED: z.string().default('true').transform((val) => val === 'true'),
  POLLING_INTERVAL: z.string().default('10000').transform((val) => parseInt(val, 10)), // milliseconds
  // Rate limiting configuration
  RATE_LIMIT_ENABLED: z.string().default('true').transform((val) => val === 'true'),
  RATE_LIMIT_DEFAULT: z.string().default('60').transform((val) => parseInt(val, 10)), // requests per window
  RATE_LIMIT_WINDOW: z.string().default('60').transform((val) => parseInt(val, 10)), // seconds
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:');
  console.error(parsed.error.format());
  process.exit(1);
}

export const env = parsed.data;

