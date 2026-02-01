/*
 * FreqHub Config Agent - Sidecar for bot configuration management
 * Copyright (C) 2025 - 2026  FreqHub Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import express from 'express';
import cors from 'cors';
import { promises as fs } from 'fs';
import path from 'path';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

// Configuration
const PORT = process.env.PORT || '3010';
const CONFIG_PATH = process.env.CONFIG_PATH || '/freqtrade/user_data/config.json';
const BOT_API_URL = process.env.BOT_API_URL || 'http://localhost:8080';
const BOT_API_USERNAME = process.env.BOT_API_USERNAME || 'freqtrader';
const BOT_API_PASSWORD = process.env.BOT_API_PASSWORD || '';
const API_KEY = process.env.API_KEY || '';
const BACKUP_ENABLED = process.env.BACKUP_ENABLED !== 'false';
const BACKUP_COUNT = parseInt(process.env.BACKUP_COUNT || '5', 10);
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';

// Simple logger
const log = {
  info: (msg: string, ...args: unknown[]) => {
    if (['info', 'debug'].includes(LOG_LEVEL)) {
      console.log(`[${new Date().toISOString()}] [INFO ] ${msg}`, ...args);
    }
  },
  error: (msg: string, ...args: unknown[]) => {
    console.error(`[${new Date().toISOString()}] [ERROR] ${msg}`, ...args);
  },
  debug: (msg: string, ...args: unknown[]) => {
    if (LOG_LEVEL === 'debug') {
      console.log(`[${new Date().toISOString()}] [DEBUG] ${msg}`, ...args);
    }
  },
};

const app = express();
app.use(cors());
app.use(express.json({ limit: '5mb' }));

// Authentication middleware
const authenticate = (req: express.Request, res: express.Response, next: express.NextFunction): void => {
  // Skip auth for health endpoint
  if (req.path === '/health') {
    next();
    return;
  }

  const apiKey = req.headers['x-api-key'] as string;
  
  if (!API_KEY) {
    // No API key configured - allow all (development mode)
    log.debug('No API_KEY configured, allowing request');
    next();
    return;
  }

  if (!apiKey || apiKey !== API_KEY) {
    log.error('Unauthorized request from', req.ip);
    res.status(401).json({ status: 'error', message: 'Unauthorized' });
    return;
  }

  next();
};

app.use(authenticate);

// Bot API token cache
let botToken: string | null = null;
let tokenExpiry = 0;

/**
 * Get authentication token from bot API
 */
async function getBotToken(): Promise<string | null> {
  // Return cached token if still valid
  if (botToken && Date.now() < tokenExpiry) {
    return botToken;
  }

  if (!BOT_API_PASSWORD) {
    log.error('BOT_API_PASSWORD not configured');
    return null;
  }

  try {
    const response = await axios.post(
      `${BOT_API_URL}/api/v1/token/login`,
      {},
      {
        auth: {
          username: BOT_API_USERNAME,
          password: BOT_API_PASSWORD,
        },
        timeout: 10000,
      }
    );

    botToken = response.data.access_token;
    // Cache for 55 minutes (tokens typically last 1 hour)
    tokenExpiry = Date.now() + 55 * 60 * 1000;
    
    log.debug('Obtained new bot API token');
    return botToken;
  } catch (error) {
    log.error('Failed to get bot token:', error instanceof Error ? error.message : error);
    return null;
  }
}

/**
 * Create backup of config file
 */
async function createBackup(): Promise<void> {
  if (!BACKUP_ENABLED) return;

  try {
    const backupDir = path.dirname(CONFIG_PATH);
    const backupBase = path.basename(CONFIG_PATH, '.json');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(backupDir, `${backupBase}.backup.${timestamp}.json`);

    // Check if source exists
    try {
      await fs.access(CONFIG_PATH);
    } catch {
      log.debug('No existing config to backup');
      return;
    }

    // Create backup
    await fs.copyFile(CONFIG_PATH, backupPath);
    log.info(`Created backup: ${backupPath}`);

    // Cleanup old backups
    const files = await fs.readdir(backupDir);
    const backups = files
      .filter((f) => f.startsWith(`${backupBase}.backup.`) && f.endsWith('.json'))
      .sort()
      .reverse();

    for (let i = BACKUP_COUNT; i < backups.length; i++) {
      const oldBackup = path.join(backupDir, backups[i]);
      await fs.unlink(oldBackup);
      log.debug(`Deleted old backup: ${oldBackup}`);
    }
  } catch (error) {
    log.error('Failed to create backup:', error instanceof Error ? error.message : error);
  }
}

/**
 * GET /health - Health check
 */
app.get('/health', async (_req, res) => {
  let configExists = false;
  let botReachable = false;

  try {
    await fs.access(CONFIG_PATH);
    configExists = true;
  } catch {
    // Config doesn't exist yet
  }

  try {
    await axios.get(`${BOT_API_URL}/api/v1/ping`, { timeout: 5000 });
    botReachable = true;
  } catch {
    // Bot not reachable
  }

  res.json({
    status: 'ok',
    service: 'freqhub-config-agent',
    configPath: CONFIG_PATH,
    configExists,
    botApiUrl: BOT_API_URL,
    botReachable,
    timestamp: new Date().toISOString(),
  });
});

/**
 * GET /config - Read config.json from filesystem
 */
app.get('/config', async (_req, res) => {
  try {
    log.info('Reading config from', CONFIG_PATH);

    const content = await fs.readFile(CONFIG_PATH, 'utf-8');
    const config = JSON.parse(content);

    res.json({
      status: 'success',
      data: {
        config,
        path: CONFIG_PATH,
        readAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      log.error('Config file not found:', CONFIG_PATH);
      res.status(404).json({
        status: 'error',
        message: 'Config file not found',
        path: CONFIG_PATH,
      });
      return;
    }

    log.error('Failed to read config:', message);
    res.status(500).json({
      status: 'error',
      message: `Failed to read config: ${message}`,
    });
  }
});

/**
 * PUT /config - Write config.json to filesystem
 */
app.put('/config', async (req, res) => {
  try {
    const { config } = req.body;

    if (!config || typeof config !== 'object') {
      res.status(400).json({
        status: 'error',
        message: 'Invalid request: config object required',
      });
      return;
    }

    log.info('Writing config to', CONFIG_PATH);

    // Create backup before writing
    await createBackup();

    // Ensure directory exists
    const dir = path.dirname(CONFIG_PATH);
    await fs.mkdir(dir, { recursive: true });

    // Write to temp file first (atomic write)
    const tempPath = `${CONFIG_PATH}.tmp`;
    const content = JSON.stringify(config, null, 2);
    
    await fs.writeFile(tempPath, content, 'utf-8');
    await fs.rename(tempPath, CONFIG_PATH);

    log.info('Config written successfully');

    res.json({
      status: 'success',
      data: {
        path: CONFIG_PATH,
        writtenAt: new Date().toISOString(),
        size: content.length,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    log.error('Failed to write config:', message);
    
    res.status(500).json({
      status: 'error',
      message: `Failed to write config: ${message}`,
    });
  }
});

/**
 * POST /reload - Trigger bot's reload_config API
 */
app.post('/reload', async (_req, res) => {
  try {
    log.info('Triggering reload_config on bot');

    const token = await getBotToken();
    if (!token) {
      res.status(500).json({
        status: 'error',
        message: 'Failed to authenticate with bot API',
      });
      return;
    }

    const response = await axios.post(
      `${BOT_API_URL}/api/v1/reload_config`,
      {},
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        timeout: 30000,
      }
    );

    log.info('Bot reload_config response:', response.data);

    res.json({
      status: 'success',
      data: {
        botResponse: response.data,
        reloadedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    log.error('Failed to reload config:', message);

    // Check if it's an axios error with response
    if (axios.isAxiosError(error) && error.response) {
      res.status(error.response.status).json({
        status: 'error',
        message: `Bot API error: ${error.response.data?.detail || message}`,
      });
      return;
    }

    res.status(500).json({
      status: 'error',
      message: `Failed to reload config: ${message}`,
    });
  }
});

/**
 * POST /config/push - Write config AND reload (convenience endpoint)
 */
app.post('/config/push', async (req, res) => {
  try {
    const { config, reload = true } = req.body;

    if (!config || typeof config !== 'object') {
      res.status(400).json({
        status: 'error',
        message: 'Invalid request: config object required',
      });
      return;
    }

    log.info('Pushing config to', CONFIG_PATH);

    // Create backup
    await createBackup();

    // Ensure directory exists
    const dir = path.dirname(CONFIG_PATH);
    await fs.mkdir(dir, { recursive: true });

    // Write config
    const tempPath = `${CONFIG_PATH}.tmp`;
    const content = JSON.stringify(config, null, 2);
    await fs.writeFile(tempPath, content, 'utf-8');
    await fs.rename(tempPath, CONFIG_PATH);

    log.info('Config written successfully');

    // Reload if requested
    let reloadResult = null;
    if (reload) {
      try {
        const token = await getBotToken();
        if (token) {
          const reloadResponse = await axios.post(
            `${BOT_API_URL}/api/v1/reload_config`,
            {},
            {
              headers: { Authorization: `Bearer ${token}` },
              timeout: 30000,
            }
          );
          reloadResult = reloadResponse.data;
          log.info('Bot reloaded successfully');
        } else {
          reloadResult = { error: 'Failed to authenticate with bot' };
        }
      } catch (reloadError) {
        reloadResult = {
          error: reloadError instanceof Error ? reloadError.message : 'Reload failed',
        };
        log.error('Reload failed:', reloadResult.error);
      }
    }

    res.json({
      status: 'success',
      data: {
        path: CONFIG_PATH,
        writtenAt: new Date().toISOString(),
        size: content.length,
        reload: reload ? reloadResult : 'skipped',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    log.error('Failed to push config:', message);

    res.status(500).json({
      status: 'error',
      message: `Failed to push config: ${message}`,
    });
  }
});

/**
 * GET /backups - List available backups
 */
app.get('/backups', async (_req, res) => {
  try {
    const dir = path.dirname(CONFIG_PATH);
    const backupBase = path.basename(CONFIG_PATH, '.json');

    const files = await fs.readdir(dir);
    const backups = files
      .filter((f) => f.startsWith(`${backupBase}.backup.`) && f.endsWith('.json'))
      .sort()
      .reverse()
      .map((f) => ({
        name: f,
        path: path.join(dir, f),
      }));

    res.json({
      status: 'success',
      data: {
        backups,
        count: backups.length,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      status: 'error',
      message: `Failed to list backups: ${message}`,
    });
  }
});

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ status: 'error', message: 'Not found' });
});

// Start server
app.listen(parseInt(PORT), '0.0.0.0', () => {
  log.info(`FreqHub Config Agent started on port ${PORT}`);
  log.info(`Config path: ${CONFIG_PATH}`);
  log.info(`Bot API URL: ${BOT_API_URL}`);
});
