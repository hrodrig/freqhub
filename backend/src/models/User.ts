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

import type { UserDB } from '../db/schema.js';

/**
 * User model for frontend/API
 */
export interface User {
  id: string;
  username: string;
  email: string;
  role: 'superadmin' | 'auditor' | 'user';
  isActive: boolean;
  totpEnabled: boolean;
  lastLogin: number | null;
  lastLoginIp: string | null;
  lastLoginDevice: string | null;
  passwordChangedAt: number | null;
  mustChangePassword: boolean;
  createdAt: number;
  updatedAt: number;
  createdBy: string | null;
}

/**
 * User model for creation (password is plain text, will be hashed)
 */
export interface CreateUserRequest {
  username: string;
  email: string;
  password: string;
  role?: 'superadmin' | 'auditor' | 'user';
  isActive?: boolean;
  mustChangePassword?: boolean;
}

/**
 * User model for updates
 */
export interface UpdateUserRequest {
  username?: string;
  email?: string;
  password?: string; // If provided, will be hashed
  role?: 'superadmin' | 'auditor' | 'user';
  isActive?: boolean;
  mustChangePassword?: boolean;
}

/**
 * Convert UserDB to User (excludes sensitive fields)
 */
export function userDBToUser(userDB: UserDB): User {
  return {
    id: userDB.id,
    username: userDB.username,
    email: userDB.email,
    role: userDB.role,
    isActive: userDB.is_active === 1,
    totpEnabled: userDB.totp_enabled === 1,
    lastLogin: userDB.last_login,
    lastLoginIp: userDB.last_login_ip,
    lastLoginDevice: userDB.last_login_device,
    passwordChangedAt: userDB.password_changed_at,
    mustChangePassword: userDB.must_change_password === 1,
    createdAt: userDB.created_at,
    updatedAt: userDB.updated_at,
    createdBy: userDB.created_by,
  };
}

/**
 * Convert User to UserDB (for database operations)
 */
export function userToUserDB(user: Partial<User>): Partial<UserDB> {
  const userDB: Partial<UserDB> = {};
  
  if (user.id !== undefined) userDB.id = user.id;
  if (user.username !== undefined) userDB.username = user.username;
  if (user.email !== undefined) userDB.email = user.email;
  if (user.role !== undefined) userDB.role = user.role;
  if (user.isActive !== undefined) userDB.is_active = user.isActive ? 1 : 0;
  if (user.totpEnabled !== undefined) userDB.totp_enabled = user.totpEnabled ? 1 : 0;
  if (user.lastLogin !== undefined) userDB.last_login = user.lastLogin;
  if (user.lastLoginIp !== undefined) userDB.last_login_ip = user.lastLoginIp;
  if (user.lastLoginDevice !== undefined) userDB.last_login_device = user.lastLoginDevice;
  if (user.passwordChangedAt !== undefined) userDB.password_changed_at = user.passwordChangedAt;
  if (user.mustChangePassword !== undefined) userDB.must_change_password = user.mustChangePassword ? 1 : 0;
  if (user.createdAt !== undefined) userDB.created_at = user.createdAt;
  if (user.updatedAt !== undefined) userDB.updated_at = user.updatedAt;
  if (user.createdBy !== undefined) userDB.created_by = user.createdBy;
  
  return userDB;
}

