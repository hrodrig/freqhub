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

/**
 * Environment configuration
 */

export const config = {
  basePath: import.meta.env.BASE_URL || '/',
  // In production (Kubernetes/Docker), use relative URL so Nginx can proxy to backend
  // In development, use localhost:3001
  // If VITE_API_PROXY_TARGET is explicitly set and not empty, use that value
  // Otherwise, use relative URL in production, localhost in development
  apiUrl: (import.meta.env.VITE_API_PROXY_TARGET && import.meta.env.VITE_API_PROXY_TARGET.trim() !== '') 
    ? import.meta.env.VITE_API_PROXY_TARGET 
    : (import.meta.env.PROD ? '' : 'http://localhost:3001'),
};

