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

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { apiClient } from '../services/api/client.js';

export interface User {
  id: string;
  username: string;
  name: string | null; // Display name (optional)
  email: string;
  role: 'superadmin' | 'auditor' | 'user';
  mustChangePassword: boolean;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const TOKEN_KEY = 'auth_token';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load token from localStorage on mount
  useEffect(() => {
    const storedToken = localStorage.getItem(TOKEN_KEY);
    if (storedToken) {
      setToken(storedToken);
      // Verify token and load user
      verifyToken(storedToken);
    } else {
      setIsLoading(false);
    }
  }, []);

  const verifyToken = async (tokenToVerify: string) => {
    try {
      const response = await apiClient.get('/auth/me', {
        headers: {
          Authorization: `Bearer ${tokenToVerify}`,
        },
      });
      setUser(response.data);
      setToken(tokenToVerify);
    } catch (error) {
      console.error('Token verification failed:', error);
      // Token invalid, remove it
      localStorage.removeItem(TOKEN_KEY);
      setToken(null);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  const login = useCallback(async (username: string, password: string) => {
    try {
      const response = await apiClient.post('/auth/login', {
        username,
        password,
      });

      if (!response.data || !response.data.token || !response.data.user) {
        console.error('Invalid response structure:', response.data);
        throw new Error('Invalid response from server');
      }

      const { token: newToken, user: userData } = response.data;
      
      localStorage.setItem(TOKEN_KEY, newToken);
      setToken(newToken);
      setUser(userData);
    } catch (error: unknown) {
      console.error('Login error:', error);
      if (error && typeof error === 'object' && 'response' in error) {
        const axiosError = error as { response?: { data?: { error?: string } } };
        throw new Error(axiosError.response?.data?.error || 'Login failed');
      }
      throw new Error('Login failed');
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
    // Call logout endpoint (optional, token is removed client-side)
    apiClient.post('/auth/logout').catch(() => {
      // Ignore errors on logout
    });
  }, []);

  const refreshUser = useCallback(async () => {
    if (!token) return;
    
    try {
      const response = await apiClient.get('/auth/me', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      setUser(response.data);
    } catch (error) {
      // Token invalid, logout
      logout();
    }
  }, [token, logout]);

  const value: AuthContextType = {
    user,
    token,
    isLoading,
    isAuthenticated: !!user && !!token,
    login,
    logout,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

