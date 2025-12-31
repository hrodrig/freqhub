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

import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';

// Check if user is authenticated
const token = localStorage.getItem('auth_token');
const isAuthenticated = !!token;

const root = ReactDOM.createRoot(document.getElementById('root')!);

if (!isAuthenticated) {
  // Load only login page (lazy load) - but still need AuthProvider and Router
  Promise.all([
    import('./pages/Login.js'),
    import('./contexts/AuthContext.js'),
    import('react-router-dom'),
    import('./config/env.js')
  ]).then(([{ Login }, { AuthProvider }, { BrowserRouter }, { config }]) => {
    root.render(
      <React.StrictMode>
        <BrowserRouter basename={config.basePath}>
          <AuthProvider>
            <Login />
          </AuthProvider>
        </BrowserRouter>
      </React.StrictMode>
    );
  });
} else {
  // Load full application (lazy load)
  import('./App.js').then(({ default: App }) => {
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
  });
}

