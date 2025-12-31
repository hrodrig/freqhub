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

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// Get base path from environment variable, default to '/'
// Ensure it starts with '/' and ends with '/' for Vite
const getBasePath = (): string => {
  const envBasePath = process.env.VITE_BASE_PATH;
  if (!envBasePath) {
    return '/';
  }
  // Normalize: ensure it starts with / and ends with /
  let basePath = envBasePath.trim();
  if (!basePath.startsWith('/')) {
    basePath = `/${basePath}`;
  }
  if (!basePath.endsWith('/')) {
    basePath = `${basePath}/`;
  }
  return basePath;
};

const basePath = getBasePath();

// Get API proxy target from environment variable, default to backend
const apiProxyTarget = process.env.VITE_API_PROXY_TARGET || 'http://localhost:3001';

// https://vitejs.dev/config/
export default defineConfig({
  base: basePath,
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    proxy: {
      // Proxy API calls to backend
      '/api': {
        target: apiProxyTarget,
        changeOrigin: true,
      },
      // Also proxy API calls from base path if configured
      ...(basePath !== '/' && {
        [`${basePath}api`]: {
          target: apiProxyTarget,
          changeOrigin: true,
          rewrite: (path: string) => path.replace(basePath, '/'),
        },
      }),
    },
    host: '127.0.0.1',
    port: 3000,
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});

