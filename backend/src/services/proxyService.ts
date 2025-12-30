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

import axios, { type AxiosInstance } from 'axios';
import { getBotWithCredentials, updateBotToken, invalidateBotCache } from './botService.js';
import { decryptPassword } from './encryptionService.js';
import { rateLimitService } from './rateLimit.service.js';
import { env } from '../config/env.js';

interface FreqtradeLoginResponse {
  access_token: string;
  token_type: string;
}

interface FreqtradePingResponse {
  status: string;
}

/**
 * Authenticate with Freqtrade and get token
 */
export async function authenticateBot(
  apiUrl: string,
  username: string,
  password: string
): Promise<{ token: string; expiresAt: number }> {
  try {
    // Freqtrade expects HTTP Basic Auth, not JSON body
    const loginResponse = await axios.post<FreqtradeLoginResponse>(
      `${apiUrl}/api/v1/token/login`,
      {}, // Empty body
      {
        timeout: 10000,
        auth: {
          username,
          password,
        },
      }
    );

    const token = loginResponse.data.access_token;
    const now = Date.now();
    const expiresAt = now + 50 * 60 * 1000; // 50 minutes

    return { token, expiresAt };
  } catch (error) {
    throw new Error(
      `Failed to authenticate: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Test connection to Freqtrade bot
 */
export async function testBotConnection(
  apiUrl: string,
  username: string,
  password: string
): Promise<boolean> {
  try {
    // First, try to ping
    const pingResponse = await axios.get<FreqtradePingResponse>(
      `${apiUrl}/api/v1/ping`,
      { timeout: 5000 }
    );

    if (pingResponse.data.status !== 'pong') {
      return false;
    }

    // Then, try to login (Freqtrade expects HTTP Basic Auth)
    const loginResponse = await axios.post<FreqtradeLoginResponse>(
      `${apiUrl}/api/v1/token/login`,
      {}, // Empty body
      {
        timeout: 5000,
        auth: {
          username,
          password,
        },
      }
    );

    return !!loginResponse.data.access_token;
  } catch (error) {
    console.error('Connection test failed:', error);
    return false;
  }
}

/**
 * Proxy request to Freqtrade bot
 */
export async function proxyRequest(
  botId: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  path: string,
  body?: unknown
): Promise<unknown> {
  const bot = getBotWithCredentials(botId);
  if (!bot) {
    throw new Error('Bot not found');
  }

  if (!bot.is_enabled) {
    throw new Error('Bot is disabled');
  }

  // Check rate limit
  const rateLimit = await rateLimitService.checkLimit(
    botId,
    env.RATE_LIMIT_DEFAULT,
    env.RATE_LIMIT_WINDOW
  );

  if (!rateLimit.allowed) {
    const error = new Error(
      `Rate limit exceeded: ${rateLimit.remaining}/${rateLimit.limit} requests remaining. Retry after ${rateLimit.retryAfter}s`
    ) as Error & { statusCode?: number; retryAfter?: number };
    error.statusCode = 429;
    error.retryAfter = rateLimit.retryAfter;
    throw error;
  }

  // Check if we have a valid token
  const now = Date.now();
  const hasValidToken =
    bot.access_token &&
    bot.token_expires_at &&
    bot.token_expires_at > now;

  let client: AxiosInstance;

  if (hasValidToken) {
    // Use existing token
    client = axios.create({
      baseURL: bot.api_url,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${bot.access_token}`,
      },
    });
  } else {
    // Need to re-authenticate
    const password = decryptPassword(bot.encrypted_password);
    const { token, expiresAt } = await authenticateBot(
      bot.api_url,
      bot.username,
      password
    );

    // Update token in database
    updateBotToken(bot.id, token, expiresAt);

    // Create client with new token
    client = axios.create({
      baseURL: bot.api_url,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });
  }

  try {
    let response;
    switch (method) {
      case 'GET':
        response = await client.get(path);
        break;
      case 'POST':
        response = await client.post(path, body);
        // Invalidate cache on write operations
        invalidateBotCache(botId);
        break;
      case 'PUT':
        response = await client.put(path, body);
        // Invalidate cache on write operations
        invalidateBotCache(botId);
        break;
      case 'DELETE':
        response = await client.delete(path);
        // Invalidate cache on write operations
        invalidateBotCache(botId);
        break;
      default:
        throw new Error(`Unsupported method: ${method}`);
    }

    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      // If 401, token might be expired, try to refresh
      if (error.response?.status === 401) {
        // Clear token and try to re-authenticate
        updateBotToken(botId, null, null);
        const refreshedBot = getBotWithCredentials(botId);
        if (refreshedBot) {
          const password = decryptPassword(refreshedBot.encrypted_password);
          const { token, expiresAt } = await authenticateBot(
            refreshedBot.api_url,
            refreshedBot.username,
            password
          );
          updateBotToken(botId, token, expiresAt);

          // Retry request with new token
          const retryClient = axios.create({
            baseURL: refreshedBot.api_url,
            timeout: 10000,
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
          });

          let retryResponse;
          switch (method) {
            case 'GET':
              retryResponse = await retryClient.get(path);
              break;
            case 'POST':
              retryResponse = await retryClient.post(path, body);
              invalidateBotCache(botId);
              break;
            case 'PUT':
              retryResponse = await retryClient.put(path, body);
              invalidateBotCache(botId);
              break;
            case 'DELETE':
              retryResponse = await retryClient.delete(path);
              invalidateBotCache(botId);
              break;
          }
          return retryResponse?.data;
        }
        throw new Error('Authentication failed after token refresh');
      }
      const status = error.response?.status;
      const message = (error.response?.data as { message?: string })?.message || error.message;
      throw new Error(
        `Freqtrade API error: ${status} - ${message}`
      );
    }
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Unknown error occurred');
  }
}
