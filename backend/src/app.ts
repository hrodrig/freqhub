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

import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import { env } from './config/env.js';
import { logger } from './middleware/logger.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { createHealthRouter } from './routes/health.js';
import { createBotsRouter } from './routes/bots.js';
import { createProxyRouter } from './routes/proxy.js';
import { createTestRouter } from './routes/test.js';
import { createAuthRouter } from './routes/auth.js';
import { createAuditRouter } from './routes/audit.js';
import { getDatabase } from './db/database.js';
import { swaggerSpec } from './config/swagger.js';
import { valkeyService } from './services/valkey.service.js';
import { websocketService } from './services/websocket.service.js';
import { pollingService } from './services/polling.service.js';
import { initializeSystem } from './services/init.service.js';
import { appLogger } from './utils/logger.js';

// Initialize database
getDatabase();

// Initialize Valkey (will connect if VALKEY_ENABLED=true)
// The service initializes automatically on import
valkeyService.ping().then((connected) => {
  if (connected) {
    appLogger.info('✅ Valkey cache enabled and connected');
  } else if (env.VALKEY_ENABLED) {
    appLogger.warn('⚠️  Valkey is enabled but not connected (will use memory fallback)');
  }
}).catch(() => {
  // Silent fail - will use memory fallback
});

const app = express();
const httpServer = createServer(app);

// Initialize WebSockets
websocketService.initialize(httpServer);

// Middleware
app.use(cors({
  origin: env.CORS_ORIGIN,
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(logger);

// Base path configuration
// BASE_PATH can be set via:
// - Environment variable: BASE_PATH=/freqhub
// - .env file: BASE_PATH=/freqhub
// - Command line: BASE_PATH=/freqhub npm start
// The base path is prepended to all routes, e.g.:
//   BASE_PATH=/freqhub -> /freqhub/api/healthz, /freqhub/api/bots
//   BASE_PATH= (empty) -> /api/healthz, /api/bots
const basePath = env.BASE_PATH || '';

// Swagger UI - API Documentation
app.use(`${basePath}/api-docs`, swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'FreqHub API Documentation',
  swaggerOptions: {
    // Use the first server (development) by default
    defaultModelsExpandDepth: 1,
    defaultModelExpandDepth: 1,
    displayRequestDuration: true,
    docExpansion: 'list',
    filter: true,
    showExtensions: true,
    showCommonExtensions: true,
  },
}));

// Swagger JSON endpoint
app.get(`${basePath}/api-docs.json`, (_req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});

// Routes with configurable base path
app.use(`${basePath}/api/healthz`, createHealthRouter());
app.use(`${basePath}/api/auth`, createAuthRouter());
app.use(`${basePath}/api/audit`, createAuditRouter());
app.use(`${basePath}/api/bots`, createBotsRouter());
app.use(`${basePath}/api/bots`, createProxyRouter());

// Test routes (only in development)
if (env.NODE_ENV === 'development') {
  app.use(`${basePath}/api/test`, createTestRouter());
}

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

// Start server
const PORT = parseInt(env.PORT, 10);

// Initialize system (create superadmin if needed) before starting server
initializeSystem().then(() => {
  httpServer.listen(PORT, () => {
    console.log(`🚀 FreqHub Backend running on http://localhost:${PORT}`);
    console.log(`📊 Environment: ${env.NODE_ENV}`);
    console.log(`💾 Database: ${env.DATABASE_PATH}`);
    if (basePath) {
      console.log(`🔗 Base Path: ${basePath}`);
      console.log(`   Health: http://localhost:${PORT}${basePath}/api/healthz`);
      console.log(`   Bots: http://localhost:${PORT}${basePath}/api/bots`);
      console.log(`   Swagger: http://localhost:${PORT}${basePath}/api-docs`);
    } else {
      console.log(`🔗 Base Path: / (root)`);
      console.log(`   Health: http://localhost:${PORT}/api/healthz`);
      console.log(`   Bots: http://localhost:${PORT}/api/bots`);
      console.log(`   Swagger: http://localhost:${PORT}/api-docs`);
    }

    // Start polling service
    pollingService.start();
  });
}).catch((error) => {
  appLogger.error('Failed to initialize system:', error);
  process.exit(1);
});

export default app;

