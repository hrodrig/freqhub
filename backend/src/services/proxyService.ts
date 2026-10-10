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

import axios, { type AxiosInstance } from 'axios';
import { getBotWithCredentials, updateBotToken, invalidateBotCache } from './botService.js';
import { decryptPassword } from './encryptionService.js';
import { rateLimitService } from './rateLimit.service.js';
import { env } from '../config/env.js';
import { appLogger } from '../utils/logger.js';
import { assertBotApiUrlAllowed, validateProxyPath } from '../utils/urlSecurity.js';

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
    let detail = 'Unknown error';
    if (axios.isAxiosError(error)) {
      if (error.response?.status) {
        detail = `HTTP ${error.response.status}`;
      } else if (error.code) {
        detail = error.code;
      } else if (error.message) {
        detail = error.message;
      }
    } else if (error instanceof Error && error.message) {
      detail = error.message;
    }
    throw new Error(`Failed to authenticate: ${detail}`);
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
    appLogger.error('Connection test failed:', error);
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
  body?: unknown,
  skipRateLimit: boolean = false
): Promise<unknown> {
  const bot = getBotWithCredentials(botId);
  if (!bot) {
    throw new Error('Bot not found');
  }

  if (!bot.is_enabled) {
    throw new Error('Bot is disabled');
  }

  // SSRF defense-in-depth: block unsafe targets (especially in production),
  // even if a legacy DB entry exists.
  assertBotApiUrlAllowed(bot.api_url);
  validateProxyPath(path);

  // Check rate limit only if not skipped
  // Note: Routes apply rate limit before calling proxyRequest, so skipRateLimit should be true
  // when called from routes. When called from botService (polling), skipRateLimit is also true
  // to avoid double counting. Only direct calls to proxyRequest should apply rate limit.
  if (!skipRateLimit) {
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
  }

  // Check if we have a valid token
  const now = Date.now();
  const hasValidToken =
    bot.access_token &&
    bot.token_expires_at &&
    bot.token_expires_at > now;

  // Remove leading slash from path when using baseURL (axios requirement)
  // axios will add it automatically when concatenating with baseURL
  const cleanPath = path.startsWith('/') ? path.substring(1) : path;
  appLogger.info(`[PROXY] ${method} ${cleanPath} for bot ${botId} (hasValidToken: ${hasValidToken})`);

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
        response = await client.get(cleanPath);
        break;
      case 'POST':
        response = await client.post(cleanPath, body);
        // Invalidate cache on write operations
        invalidateBotCache(botId);
        break;
      case 'PUT':
        response = await client.put(cleanPath, body);
        // Invalidate cache on write operations
        invalidateBotCache(botId);
        break;
      case 'DELETE':
        response = await client.delete(cleanPath);
        // Invalidate cache on write operations
        invalidateBotCache(botId);
        break;
      default:
        throw new Error(`Unsupported method: ${method}`);
    }

    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      // Handle network errors (socket hang up, ECONNREFUSED, etc.)
      if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT' || 
          error.message?.includes('socket hang up') || 
          error.message?.includes('Network Error')) {
        throw new Error(
          `Network error connecting to Freqtrade bot at ${bot.api_url}: ${error.message || 'Connection closed unexpectedly'}`
        );
      }
      
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

          // Retry request with new token (use same validated cleanPath)
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
              retryResponse = await retryClient.get(cleanPath);
              break;
            case 'POST':
              retryResponse = await retryClient.post(cleanPath, body);
              invalidateBotCache(botId);
              break;
            case 'PUT':
              retryResponse = await retryClient.put(cleanPath, body);
              invalidateBotCache(botId);
              break;
            case 'DELETE':
              retryResponse = await retryClient.delete(cleanPath);
              invalidateBotCache(botId);
              break;
          }
          return retryResponse?.data;
        }
        throw new Error('Authentication failed after token refresh');
      }
      const status = error.response?.status;
      // For 502 errors, check if it's a valid error message from Freqtrade
      // Freqtrade sometimes returns 502 with error messages (e.g., "No open order for trade_id.")
      if (status === 502) {
        const errorData = error.response?.data as { error?: string; detail?: string; message?: string } | undefined;
        const errorMsg = errorData?.error || errorData?.detail || errorData?.message;
        
        // If there's a specific error message, it's likely a valid Freqtrade error response
        if (errorMsg && errorMsg.includes('Error querying')) {
          // Extract the actual error message after "Error querying ...: "
          // Format: "Error querying /api/v1/trades/5/open-order: No open order for trade_id."
          const match = errorMsg.match(/Error querying[^:]+:\s*(.+)/);
          if (match && match[1]) {
            throw new Error(match[1].trim());
          }
        }
        
        // If there's any error message, use it
        if (errorMsg) {
          throw new Error(errorMsg);
        }
        
        // Otherwise, it's a real gateway error
        throw new Error(
          `Bad Gateway: Unable to connect to Freqtrade bot at ${bot.api_url}. The bot may be offline or unreachable.`
        );
      }
      const message = (error.response?.data as { message?: string; detail?: string })?.message || 
                      (error.response?.data as { message?: string; detail?: string })?.detail || 
                      error.message;
      throw new Error(
        `Freqtrade API error: ${status || 'Network Error'} - ${message}`
      );
    }
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Unknown error occurred');
  }
}
