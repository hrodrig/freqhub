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
import { config } from '../../config/env.js';

/**
 * Create axios instance with base configuration
 */
export function createApiClient(): AxiosInstance {
  const client = axios.create({
    baseURL: `${config.apiUrl}/api`,
    timeout: 30000,
    headers: {
      'Content-Type': 'application/json',
    },
  });

  // Request interceptor
  client.interceptors.request.use(
    (config) => {
      // Add auth token from localStorage if available
      const token = localStorage.getItem('auth_token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    },
    (error) => {
      return Promise.reject(error);
    }
  );

  // Response interceptor
  client.interceptors.response.use(
    (response) => response,
    (error) => {
      // Handle common errors
      if (error.response) {
        // Handle 401 Unauthorized - token expired or invalid
        if (error.response.status === 401) {
          // Remove invalid token
          localStorage.removeItem('auth_token');
          // Redirect to login if not already there
          if (window.location.pathname !== '/login') {
            window.location.href = '/login';
          }
        }
        
        // Server responded with error
        // Only log as error if it's not a 500 from Freqtrade (which is expected when bots are offline)
        const isFreqtradeError = error.response.data?.message?.includes('Freqtrade API error');
        if (error.response.status === 500 && isFreqtradeError) {
          // This is expected when Freqtrade bots are offline - log as warning instead
          console.warn('Freqtrade API unavailable:', error.response.data?.message);
        } else if (error.response.status !== 401) {
          // Don't log 401 errors as they're handled above
          console.error('API Error:', error.response.status, error.response.data);
        }
      } else if (error.request) {
        // Request made but no response
        console.error('Network Error:', error.request);
      } else {
        // Something else happened
        console.error('Error:', error.message);
      }
      return Promise.reject(error);
    }
  );

  return client;
}

export const apiClient = createApiClient();

