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

import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z
  .object({
  PORT: z.string().default('3001'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DATABASE_PATH: z.string().default('./data/freqhub.db'),
  ENCRYPTION_KEY: z.string().min(32, 'Encryption key must be at least 32 characters'),
  JWT_SECRET: z.string().min(32, 'JWT secret must be at least 32 characters'),
  JWT_EXPIRES_IN: z.string().default('24h'), // Token expiration (e.g., '24h', '7d', '30d')
  CORS_ORIGIN: z.string().default('http://localhost:3000'),
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  // Swagger / API docs
  SWAGGER_ENABLED: z
    .string()
    .default('false')
    .transform((val) => val === 'true'),
  // Bootstrap admin (first startup)
  DEFAULT_ADMIN_USERNAME: z.string().default('freqhub'),
  DEFAULT_ADMIN_EMAIL: z.string().email().default('admin@freqhub.local'),
  // In production, this MUST be provided if no superadmin exists yet (and will NOT be logged).
  DEFAULT_ADMIN_PASSWORD: z.string().min(12).optional(),
  // Auth hardening
  AUTH_LOCKOUT_THRESHOLD: z.string().default('10').transform((val) => parseInt(val, 10)),
  AUTH_LOCKOUT_DURATION_SECONDS: z.string().default('900').transform((val) => parseInt(val, 10)),
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
  // Runmode editor (optional, for config.json editing + reload)
  RUNMODE_EDITOR_ENABLED: z.string().default('false').transform((val) => val === 'true'),
  RUNMODE_CONFIG_BASE_DIR: z
    .string()
    .optional()
    .transform((val) => (val && val.trim().length > 0 ? val : undefined)),
})
  .superRefine((val, ctx) => {
    if (val.NODE_ENV !== 'production') return;

    // Prevent shipping with placeholder secrets in production.
    const jwtLower = val.JWT_SECRET.toLowerCase();
    const encLower = val.ENCRYPTION_KEY.toLowerCase();
    const hasPlaceholder = (s: string) => s.includes('change-this') || s.includes('change me');

    if (hasPlaceholder(jwtLower)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['JWT_SECRET'],
        message: 'JWT_SECRET must be set to a strong value in production (do not use placeholder/default)',
      });
    }
    if (hasPlaceholder(encLower)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['ENCRYPTION_KEY'],
        message: 'ENCRYPTION_KEY must be set to a strong value in production (do not use placeholder/default)',
      });
    }
  });

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const timestamp = new Date().toISOString();
  const levelTag = 'ERROR'.padEnd(5, ' ');
  console.error(`[${timestamp}] [${levelTag}] ❌ Invalid environment variables:`);
  console.error(`[${timestamp}] [${levelTag}]`, parsed.error.format());
  process.exit(1);
}

export const env = parsed.data;

