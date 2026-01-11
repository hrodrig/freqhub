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

import { BrowserRouter, Routes, Route, Navigate, Link, useNavigate } from 'react-router-dom';
import { config } from './config/env.js';
import { AuthProvider, useAuth } from './contexts/AuthContext.js';
import { PrivateRoute } from './components/PrivateRoute.js';
import { Dashboard } from './pages/Dashboard.js';
import { DashboardMock } from './pages/DashboardMock.js';
import { BotManagement } from './pages/BotManagement.js';
import { BotDetail } from './pages/BotDetail.js';
import { BotComparison } from './pages/BotComparison.js';
import { Login } from './pages/Login.js';
import { AuditLogs } from './pages/AuditLogs.js';

function Navigation() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
    // Reload page to trigger lazy loading
    window.location.reload();
  };

  return (
    <nav style={{ marginBottom: '20px', borderBottom: '1px solid #333', paddingBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <div>
        <Link to="/dashboard" style={{ marginRight: '20px', color: '#e0e0e0', textDecoration: 'none' }}>
          Dashboard
        </Link>
        <Link to="/bots" style={{ marginRight: '20px', color: '#e0e0e0', textDecoration: 'none' }}>
          Bots
        </Link>
        <Link to="/compare" style={{ marginRight: '20px', color: '#e0e0e0', textDecoration: 'none' }}>
          Compare
        </Link>
        {(user?.role === 'superadmin' || user?.role === 'auditor') && (
          <Link to="/audit" style={{ marginRight: '20px', color: '#e0e0e0', textDecoration: 'none' }}>
            Audit Logs
          </Link>
        )}
        <Link to="/mock" style={{ color: '#e0e0e0', textDecoration: 'none' }}>
          Mock
        </Link>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        {user && (
          <span style={{ color: '#a0a0a0', fontSize: '0.875rem' }}>
            {user.username} ({user.role})
          </span>
        )}
        <button
          onClick={handleLogout}
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: '#dc2626',
            color: '#ffffff',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '0.875rem',
          }}
        >
          Logout
        </button>
      </div>
    </nav>
  );
}

function AppRoutes() {
  return (
    <BrowserRouter basename={config.basePath}>
      <div style={{ padding: '20px' }}>
        <PrivateRoute>
          <Navigation />
        </PrivateRoute>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={
            <PrivateRoute>
              <Navigate to="/dashboard" replace />
            </PrivateRoute>
          } />
          <Route path="/dashboard" element={
            <PrivateRoute>
              <Dashboard />
            </PrivateRoute>
          } />
          <Route path="/mock" element={
            <PrivateRoute>
              <DashboardMock />
            </PrivateRoute>
          } />
          <Route path="/bots" element={
            <PrivateRoute>
              <BotManagement />
            </PrivateRoute>
          } />
          <Route path="/bots/:id" element={
            <PrivateRoute>
              <BotDetail />
            </PrivateRoute>
          } />
          <Route path="/compare" element={
            <PrivateRoute>
              <BotComparison />
            </PrivateRoute>
          } />
          <Route path="/audit" element={
            <PrivateRoute requiredRole="auditor">
              <AuditLogs />
            </PrivateRoute>
          } />
          <Route path="*" element={<div>404 - Not Found</div>} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}

export default App;
