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
import { Profile } from './pages/Profile.js';
import { UserManagement } from './pages/UserManagement.js';
import { useUIStore } from './stores/uiStore.js';
import { Moon, Sun } from 'lucide-react';

function Navigation() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { theme, setTheme } = useUIStore();

  const handleLogout = () => {
    logout();
    navigate('/login');
    // Reload page to trigger lazy loading
    window.location.reload();
  };

  return (
    <nav style={{ marginBottom: '20px', borderBottom: '1px solid hsl(var(--border))', paddingBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <div>
        <Link to="/dashboard" style={{ marginRight: '20px', color: 'hsl(var(--foreground))', textDecoration: 'none' }}>
          Dashboard
        </Link>
        <Link to="/bots" style={{ marginRight: '20px', color: 'hsl(var(--foreground))', textDecoration: 'none' }}>
          Bots
        </Link>
        <Link to="/compare" style={{ marginRight: '20px', color: 'hsl(var(--foreground))', textDecoration: 'none' }}>
          Compare
        </Link>
        {(user?.role === 'superadmin' || user?.role === 'auditor') && (
          <Link to="/audit" style={{ marginRight: '20px', color: 'hsl(var(--foreground))', textDecoration: 'none' }}>
            Audit Logs
          </Link>
        )}
        {user?.role === 'superadmin' && (
          <Link to="/users" style={{ marginRight: '20px', color: 'hsl(var(--foreground))', textDecoration: 'none' }}>
            Users
          </Link>
        )}
        <Link to="/mock" style={{ color: 'hsl(var(--foreground))', textDecoration: 'none' }}>
          Mock
        </Link>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <button
          type="button"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          style={{
            padding: '0.5rem 0.75rem',
            backgroundColor: 'hsl(var(--secondary))',
            color: 'hsl(var(--secondary-foreground))',
            border: '1px solid hsl(var(--border))',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '0.875rem',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            transition: 'background-color 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'hsl(var(--muted))';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'hsl(var(--secondary))';
          }}
          title={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
          aria-label={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
        >
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          {theme === 'dark' ? 'Claro' : 'Oscuro'}
        </button>
        {user && (
          <Link
            to="/profile"
            style={{
              color: 'hsl(var(--muted-foreground))',
              fontSize: '0.875rem',
              textDecoration: 'none',
              cursor: 'pointer',
              padding: '0.25rem 0.5rem',
              borderRadius: '4px',
              transition: 'background-color 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'hsl(var(--muted))';
              e.currentTarget.style.color = 'hsl(var(--foreground))';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = 'hsl(var(--muted-foreground))';
            }}
          >
            {user.name || user.username} ({user.role})
          </Link>
        )}
        <button
          onClick={handleLogout}
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: 'hsl(var(--destructive))',
            color: 'hsl(var(--destructive-foreground))',
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
          <Route path="/profile" element={
            <PrivateRoute>
              <Profile />
            </PrivateRoute>
          } />
          <Route path="/users" element={
            <PrivateRoute requiredRole="superadmin">
              <UserManagement />
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
