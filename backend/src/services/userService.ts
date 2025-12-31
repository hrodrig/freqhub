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

import { randomUUID } from 'crypto';
import { getDatabase } from '../db/database.js';
import type { UserDB } from '../db/schema.js';
import type { User, CreateUserRequest, UpdateUserRequest } from '../models/User.js';
import { userDBToUser } from '../models/User.js';

/**
 * Get all users
 */
export function getAllUsers(): User[] {
  const db = getDatabase();
  const users = db.prepare('SELECT * FROM users ORDER BY created_at DESC').all() as UserDB[];
  return users.map(userDBToUser);
}

/**
 * Get user by ID
 */
export function getUserById(id: string): User | null {
  const db = getDatabase();
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as UserDB | undefined;
  return user ? userDBToUser(user) : null;
}

/**
 * Get user by username
 */
export function getUserByUsername(username: string): UserDB | null {
  const db = getDatabase();
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username) as UserDB | undefined;
  return user || null;
}

/**
 * Get user by email
 */
export function getUserByEmail(email: string): UserDB | null {
  const db = getDatabase();
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as UserDB | undefined;
  return user || null;
}

/**
 * Create a new user
 */
export function createUser(request: CreateUserRequest, createdBy: string | null = null): User {
  const db = getDatabase();
  const id = randomUUID();
  const now = Date.now();
  
  const userDB: UserDB = {
    id,
    username: request.username,
    email: request.email,
    password_hash: '', // Will be set by caller after hashing
    role: request.role || 'user',
    is_active: request.isActive !== false ? 1 : 0,
    totp_secret: null,
    totp_enabled: 0,
    failed_login_attempts: 0,
    account_locked_until: null,
    last_login: null,
    last_login_ip: null,
    last_login_device: null,
    password_changed_at: null,
    must_change_password: request.mustChangePassword ? 1 : 0,
    created_at: now,
    updated_at: now,
    created_by: createdBy,
  };
  
  db.prepare(`
    INSERT INTO users (
      id, username, email, password_hash, role, is_active,
      totp_secret, totp_enabled, failed_login_attempts, account_locked_until,
      last_login, last_login_ip, last_login_device, password_changed_at,
      must_change_password, created_at, updated_at, created_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    userDB.id,
    userDB.username,
    userDB.email,
    userDB.password_hash,
    userDB.role,
    userDB.is_active,
    userDB.totp_secret,
    userDB.totp_enabled,
    userDB.failed_login_attempts,
    userDB.account_locked_until,
    userDB.last_login,
    userDB.last_login_ip,
    userDB.last_login_device,
    userDB.password_changed_at,
    userDB.must_change_password,
    userDB.created_at,
    userDB.updated_at,
    userDB.created_by
  );
  
  return userDBToUser(userDB);
}

/**
 * Update user
 */
export function updateUser(id: string, request: UpdateUserRequest, updatedBy: string | null = null): User | null {
  const db = getDatabase();
  const existing = getUserById(id);
  if (!existing) {
    return null;
  }
  
  const updates: string[] = [];
  const values: unknown[] = [];
  
  if (request.username !== undefined) {
    updates.push('username = ?');
    values.push(request.username);
  }
  if (request.email !== undefined) {
    updates.push('email = ?');
    values.push(request.email);
  }
  if (request.password !== undefined) {
    // Password will be hashed by caller
    updates.push('password_hash = ?');
    values.push(request.password);
    updates.push('password_changed_at = ?');
    values.push(Date.now());
  }
  if (request.role !== undefined) {
    updates.push('role = ?');
    values.push(request.role);
  }
  if (request.isActive !== undefined) {
    updates.push('is_active = ?');
    values.push(request.isActive ? 1 : 0);
  }
  if (request.mustChangePassword !== undefined) {
    updates.push('must_change_password = ?');
    values.push(request.mustChangePassword ? 1 : 0);
  }
  
  if (updates.length === 0) {
    return existing;
  }
  
  updates.push('updated_at = ?');
  values.push(Date.now());
  
  if (updatedBy !== null) {
    updates.push('updated_by = ?');
    values.push(updatedBy);
  }
  
  values.push(id);
  
  db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...values);
  
  return getUserById(id);
}

/**
 * Delete user
 */
export function deleteUser(id: string): boolean {
  const db = getDatabase();
  const result = db.prepare('DELETE FROM users WHERE id = ?').run(id);
  return result.changes > 0;
}

/**
 * Check if user exists
 */
export function userExists(id: string): boolean {
  const db = getDatabase();
  const result = db.prepare('SELECT 1 FROM users WHERE id = ?').get(id);
  return !!result;
}

/**
 * Check if username exists
 */
export function usernameExists(username: string, excludeId?: string): boolean {
  const db = getDatabase();
  if (excludeId) {
    const result = db.prepare('SELECT 1 FROM users WHERE username = ? AND id != ?').get(username, excludeId);
    return !!result;
  }
  const result = db.prepare('SELECT 1 FROM users WHERE username = ?').get(username);
  return !!result;
}

/**
 * Check if email exists
 */
export function emailExists(email: string, excludeId?: string): boolean {
  const db = getDatabase();
  if (excludeId) {
    const result = db.prepare('SELECT 1 FROM users WHERE email = ? AND id != ?').get(email, excludeId);
    return !!result;
  }
  const result = db.prepare('SELECT 1 FROM users WHERE email = ?').get(email);
  return !!result;
}

/**
 * Update user's last login information
 */
export function updateLastLogin(
  id: string,
  ipAddress: string | null = null,
  device: string | null = null
): void {
  const db = getDatabase();
  db.prepare(`
    UPDATE users 
    SET last_login = ?, last_login_ip = ?, last_login_device = ?
    WHERE id = ?
  `).run(Date.now(), ipAddress, device, id);
}

/**
 * Increment failed login attempts
 */
export function incrementFailedLoginAttempts(id: string): void {
  const db = getDatabase();
  db.prepare(`
    UPDATE users 
    SET failed_login_attempts = failed_login_attempts + 1
    WHERE id = ?
  `).run(id);
}

/**
 * Reset failed login attempts
 */
export function resetFailedLoginAttempts(id: string): void {
  const db = getDatabase();
  db.prepare(`
    UPDATE users 
    SET failed_login_attempts = 0, account_locked_until = NULL
    WHERE id = ?
  `).run(id);
}

/**
 * Lock user account
 */
export function lockUserAccount(id: string, lockUntil: number): void {
  const db = getDatabase();
  db.prepare(`
    UPDATE users 
    SET account_locked_until = ?
    WHERE id = ?
  `).run(lockUntil, id);
}

/**
 * Check if user account is locked
 */
export function isUserAccountLocked(user: UserDB): boolean {
  if (!user.account_locked_until) {
    return false;
  }
  return user.account_locked_until > Date.now();
}

