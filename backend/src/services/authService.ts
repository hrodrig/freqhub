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

import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { env } from '../config/env.js';
import { getUserByUsername, getUserByIdDB, updateLastLogin, incrementFailedLoginAttempts, resetFailedLoginAttempts, isUserAccountLocked, lockUserAccount, updateUser } from './userService.js';
import type { UserDB } from '../db/schema.js';
import { createAuditLog } from './auditService.js';
import { appLogger } from '../utils/logger.js';

export interface JWTPayload {
  userId: string;
  username: string;
  role: 'superadmin' | 'auditor' | 'user';
  iat?: number;
  exp?: number;
}

export interface LoginRequest {
  username: string;
  password: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface LoginResponse {
  token: string;
  user: {
    id: string;
    username: string;
    email: string;
    role: 'superadmin' | 'auditor' | 'user';
    mustChangePassword: boolean;
  };
}

/**
 * Generate JWT token for a user
 */
export function generateToken(user: UserDB): string {
  const payload: JWTPayload = {
    userId: user.id,
    username: user.username,
    role: user.role,
  };

  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });
}

/**
 * Verify and decode JWT token
 */
export function verifyToken(token: string): JWTPayload | null {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as JWTPayload;
    return decoded;
  } catch (error) {
    appLogger.debug('Token verification failed:', error);
    return null;
  }
}

/**
 * Login user with username and password
 */
export async function login(request: LoginRequest): Promise<LoginResponse> {
  const { username, password, ipAddress, userAgent } = request;

  // Find user by username
  const user = getUserByUsername(username);
  if (!user) {
    // Log failed attempt (but don't reveal if user exists)
    appLogger.warn(`Failed login attempt for username: ${username}`);
    throw new Error('Invalid username or password');
  }

  // Check if account is locked
  if (isUserAccountLocked(user)) {
    appLogger.warn(`Login attempt for locked account: ${username}`);
    throw new Error('Account is locked. Please try again later.');
  }

  // Verify password
  const passwordValid = await bcrypt.compare(password, user.password_hash);
  if (!passwordValid) {
    // Increment failed login attempts
    incrementFailedLoginAttempts(user.id);

    // Lockout policy (defense-in-depth)
    const nextAttempts = (user.failed_login_attempts || 0) + 1;
    if (nextAttempts >= env.AUTH_LOCKOUT_THRESHOLD) {
      const lockUntil = Date.now() + env.AUTH_LOCKOUT_DURATION_SECONDS * 1000;
      lockUserAccount(user.id, lockUntil);
      appLogger.warn(`User account locked due to failed logins: ${username} until ${new Date(lockUntil).toISOString()}`);
      createAuditLog({
        userId: user.id,
        action: 'account_locked',
        actionCategory: 'auth',
        resourceType: 'user',
        resourceId: user.id,
        details: {
          reason: 'Too many failed login attempts',
          username,
          lockUntil,
        },
        ipAddress,
        userAgent,
      });
    }
    
    // Log failed attempt
    createAuditLog({
      userId: user.id,
      action: 'login_failed',
      actionCategory: 'auth',
      resourceType: 'user',
      resourceId: user.id,
      details: {
        reason: 'Invalid password',
        username,
        failedLoginAttempts: nextAttempts,
      },
      ipAddress,
      userAgent,
    });

    appLogger.warn(`Failed login attempt for username: ${username} (invalid password)`);
    throw new Error('Invalid username or password');
  }

  // Check if user is active
  if (user.is_active === 0) {
    appLogger.warn(`Login attempt for inactive account: ${username}`);
    throw new Error('Account is inactive. Please contact an administrator.');
  }

  // Reset failed login attempts on successful login
  resetFailedLoginAttempts(user.id);

  // Update last login
  updateLastLogin(user.id, ipAddress || null, userAgent || null);

  // Generate token
  const token = generateToken(user);

  // Log successful login
  createAuditLog({
    userId: user.id,
    action: 'login',
    actionCategory: 'auth',
    resourceType: 'user',
    resourceId: user.id,
    details: {
      username,
      ipAddress,
      userAgent,
    },
    ipAddress,
    userAgent,
  });

  appLogger.info(`User ${username} logged in successfully`);

  return {
    token,
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      mustChangePassword: user.must_change_password === 1,
    },
  };
}

/**
 * Logout user (logs the action)
 */
export function logout(userId: string, ipAddress?: string, userAgent?: string): void {
  // Log logout action
  createAuditLog({
    userId,
    action: 'logout',
    actionCategory: 'auth',
    resourceType: 'user',
    resourceId: userId,
    details: {
      ipAddress,
      userAgent,
    },
    ipAddress,
    userAgent,
  });

  appLogger.info(`User ${userId} logged out`);
}

/**
 * Change user password
 */
export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  const user = getUserByIdDB(userId);
  if (!user) {
    throw new Error('User not found');
  }

  // Verify current password
  const passwordValid = await bcrypt.compare(currentPassword, user.password_hash);
  if (!passwordValid) {
    throw new Error('Current password is incorrect');
  }

  // Hash new password
  const newPasswordHash = await bcrypt.hash(newPassword, 10);

  // Update password
  updateUser(userId, { password: newPasswordHash }, userId);

  // Log password change
  createAuditLog({
    userId,
    action: 'password_change',
    actionCategory: 'auth',
    resourceType: 'user',
    resourceId: userId,
    details: {
      ipAddress,
      userAgent,
    },
    ipAddress,
    userAgent,
  });

  appLogger.info(`User ${user.username} changed password`);
}

