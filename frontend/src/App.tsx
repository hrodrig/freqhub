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

import { BrowserRouter, Routes, Route, Navigate, Link } from 'react-router-dom';
import { config } from './config/env.js';
import { Dashboard } from './pages/Dashboard.js';
import { DashboardMock } from './pages/DashboardMock.js';
import { BotManagement } from './pages/BotManagement.js';
import { BotDetail } from './pages/BotDetail.js';
import { BotComparison } from './pages/BotComparison.js';

function App() {
  return (
    <BrowserRouter basename={config.basePath}>
      <div style={{ padding: '20px' }}>
        <nav style={{ marginBottom: '20px', borderBottom: '1px solid #333', paddingBottom: '10px' }}>
          <Link to="/dashboard" style={{ marginRight: '20px', color: '#e0e0e0' }}>
            Dashboard
          </Link>
          <Link to="/bots" style={{ marginRight: '20px', color: '#e0e0e0' }}>
            Bots
          </Link>
          <Link to="/compare" style={{ marginRight: '20px', color: '#e0e0e0' }}>
            Compare
          </Link>
          <Link to="/mock" style={{ color: '#e0e0e0' }}>
            Mock
          </Link>
        </nav>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/mock" element={<DashboardMock />} />
          <Route path="/bots" element={<BotManagement />} />
          <Route path="/bots/:id" element={<BotDetail />} />
          <Route path="/compare" element={<BotComparison />} />
          <Route path="*" element={<div>404 - Not Found</div>} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;
