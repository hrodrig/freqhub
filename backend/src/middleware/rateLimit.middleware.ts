/*
 * FreqHub - Multi-bot dashboard for Freqtrade
 * Copyright (C) 2025 - 2026  FreqHub Contributors
 *
 * Rate limiting middleware for auth, audit, and health routes (CodeQL: missing rate limiting).
 */

import rateLimit from 'express-rate-limit';

const WINDOW_MS = 60 * 1000; // 1 minute

/** Auth routes: login, logout, profile, change-password — limit per IP to reduce brute-force risk */
export const authRateLimiter = rateLimit({
  windowMs: WINDOW_MS,
  max: 30,
  message: { error: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

/** Audit routes: read-only but can be heavy — limit per IP */
export const auditRateLimiter = rateLimit({
  windowMs: WINDOW_MS,
  max: 60,
  message: { error: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

/** Health routes: often polled — limit per IP */
export const healthRateLimiter = rateLimit({
  windowMs: WINDOW_MS,
  max: 60,
  message: { error: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

/** Proxy routes: per-bot rate limit exists; add global cap per IP */
export const proxyRateLimiter = rateLimit({
  windowMs: WINDOW_MS,
  max: 120,
  message: { error: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

/** Bots CRUD routes */
export const botsRateLimiter = rateLimit({
  windowMs: WINDOW_MS,
  max: 60,
  message: { error: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

/** Users routes (superadmin) */
export const usersRateLimiter = rateLimit({
  windowMs: WINDOW_MS,
  max: 60,
  message: { error: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

/** Test routes (development only) — limit per IP */
export const testRateLimiter = rateLimit({
  windowMs: WINDOW_MS,
  max: 60,
  message: { error: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});
