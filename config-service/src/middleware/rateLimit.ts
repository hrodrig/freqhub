/*
 * FreqHub Config Service - Rate limiting (CodeQL: missing rate limiting)
 * Copyright (C) 2025 - 2026  FreqHub Contributors
 */

import rateLimit from 'express-rate-limit';

const WINDOW_MS = 60 * 1000;

export const configsRateLimiter = rateLimit({
  windowMs: WINDOW_MS,
  max: 120,
  message: { status: 'error', message: 'Too many requests' },
  standardHeaders: true,
  legacyHeaders: false,
});

export const syncRateLimiter = rateLimit({
  windowMs: WINDOW_MS,
  max: 60,
  message: { status: 'error', message: 'Too many requests' },
  standardHeaders: true,
  legacyHeaders: false,
});

export const healthRateLimiter = rateLimit({
  windowMs: WINDOW_MS,
  max: 60,
  message: { status: 'error', message: 'Too many requests' },
  standardHeaders: true,
  legacyHeaders: false,
});

export const deploymentsRateLimiter = rateLimit({
  windowMs: WINDOW_MS,
  max: 60,
  message: { status: 'error', message: 'Too many requests' },
  standardHeaders: true,
  legacyHeaders: false,
});
