/*
 * FreqHub Config Service
 * Copyright (C) 2025 - 2026  FreqHub Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import express from 'express';
import cors from 'cors';
import { env } from './config/env.js';
import { connectToMongo, disconnectFromMongo } from './db/mongo.js';
import { authenticateApiKey, extractUserId } from './middleware/auth.js';
import { logger } from './utils/logger.js';

// Routes
import configsRouter from './routes/configs.js';
import deploymentsRouter from './routes/deployments.js';
import syncRouter from './routes/sync.js';
import healthRouter from './routes/health.js';
import { configsRateLimiter, syncRateLimiter, healthRateLimiter, deploymentsRateLimiter } from './middleware/rateLimit.js';

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' })); // Large limit for config files

// Request logging
app.use((req, _res, next) => {
  logger.debug(`${req.method} ${req.path}`);
  next();
});

// Health routes (no auth, rate limited)
app.use('/health', healthRateLimiter, healthRouter);

// API routes (with auth, rate limited)
app.use('/api/configs', configsRateLimiter, authenticateApiKey, extractUserId, configsRouter);
app.use('/api/deployments', deploymentsRateLimiter, authenticateApiKey, extractUserId, deploymentsRouter);
app.use('/api/sync', syncRateLimiter, authenticateApiKey, extractUserId, syncRouter);

// 404 handler
app.use((_req, res) => {
  res.status(404).json({
    status: 'error',
    message: 'Not found',
  });
});

// Error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({
    status: 'error',
    message: env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
  });
});

// Startup
async function start(): Promise<void> {
  try {
    // Connect to MongoDB
    await connectToMongo();

    // Start server
    const server = app.listen(parseInt(env.PORT), () => {
      logger.info(`FreqHub Config Service started on port ${env.PORT}`);
      logger.info(`Environment: ${env.NODE_ENV}`);
    });

    // Graceful shutdown
    const shutdown = async (signal: string) => {
      logger.info(`Received ${signal}, shutting down...`);

      server.close(async () => {
        await disconnectFromMongo();
        logger.info('Server closed');
        process.exit(0);
      });

      // Force shutdown after 10 seconds
      setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

start();

export default app;
