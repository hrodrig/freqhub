/*
 * FreqHub Config Service
 * Copyright (C) 2025 - 2026  FreqHub Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z
  .object({
    PORT: z.string().default('3005'),
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

    // MongoDB
    MONGODB_URI: z.string().default('mongodb://localhost:27017'),
    MONGODB_DATABASE: z.string().default('freqhub_config'),

    // FreqHub Backend Integration
    FREQHUB_BACKEND_URL: z.string().url().default('http://localhost:3001'),
    FREQHUB_BACKEND_API_KEY: z.string().optional(),

    // Security
    API_KEY: z.string().min(32, 'API key must be at least 32 characters'),
    ENCRYPTION_KEY: z.string().min(32, 'Encryption key must be at least 32 characters'),

    // Logging
    LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),

    // Agent URLs (optional)
    AGENT_URLS: z.string().optional(),
  })
  .superRefine((val, ctx) => {
    if (val.NODE_ENV !== 'production') return;

    const hasPlaceholder = (s: string) =>
      s.toLowerCase().includes('change-this') || s.toLowerCase().includes('change me');

    if (hasPlaceholder(val.API_KEY)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['API_KEY'],
        message: 'API_KEY must be set to a strong value in production',
      });
    }
    if (hasPlaceholder(val.ENCRYPTION_KEY)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['ENCRYPTION_KEY'],
        message: 'ENCRYPTION_KEY must be set to a strong value in production',
      });
    }
  });

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:');
  console.error(parsed.error.format());
  process.exit(1);
}

export const env = parsed.data;

// Parse agent URLs into a map
export function getAgentUrls(): Map<string, string> {
  const map = new Map<string, string>();
  if (!env.AGENT_URLS) return map;

  const pairs = env.AGENT_URLS.split(',');
  for (const pair of pairs) {
    const [botId, url] = pair.split('=');
    if (botId && url) {
      map.set(botId.trim(), url.trim());
    }
  }
  return map;
}
