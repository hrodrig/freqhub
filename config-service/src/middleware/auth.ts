/*
 * FreqHub Config Service
 * Copyright (C) 2025 - 2026  FreqHub Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import type { Request, Response, NextFunction } from 'express';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

/**
 * API Key authentication middleware
 */
export function authenticateApiKey(req: Request, res: Response, next: NextFunction): void {
  const apiKey = req.headers['x-api-key'] as string | undefined;

  if (!apiKey) {
    logger.warn(`Missing API key from ${req.ip}`);
    res.status(401).json({
      status: 'error',
      message: 'API key required',
    });
    return;
  }

  if (apiKey !== env.API_KEY) {
    logger.warn(`Invalid API key from ${req.ip}`);
    res.status(403).json({
      status: 'error',
      message: 'Invalid API key',
    });
    return;
  }

  next();
}

/**
 * Optional: Extract user ID from headers (if forwarded from FreqHub Backend)
 */
export function extractUserId(req: Request, _res: Response, next: NextFunction): void {
  const userId = req.headers['x-user-id'] as string | undefined;
  if (userId) {
    (req as Request & { userId?: string }).userId = userId;
  }
  next();
}
