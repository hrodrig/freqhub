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

import { randomInt } from 'crypto';
import { getDatabase } from '../db/database.js';
import { createUser } from './userService.js';
import { createAuditLog } from './auditService.js';
import { appLogger } from '../utils/logger.js';
import bcrypt from 'bcrypt';
import { env } from '../config/env.js';

/**
 * Initialize system on startup
 * Creates default superadmin if none exists
 */
export async function initializeSystem(): Promise<void> {
  const db = getDatabase();
  
  try {
    // Check if users table exists (might not exist on first run before migrations)
    const tableInfo = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='users'").get();
    if (!tableInfo) {
      appLogger.warn('Users table does not exist yet. Migrations will create it.');
      return;
    }
    
    // Verify if there's at least one superadmin
    const superadmins = db.prepare(`
      SELECT COUNT(*) as count 
      FROM users 
      WHERE role = 'superadmin' AND is_active = 1
    `).get() as { count: number };
    
    if (superadmins.count === 0) {
      const adminUsername = env.DEFAULT_ADMIN_USERNAME;
      const adminEmail = env.DEFAULT_ADMIN_EMAIL;

      // In production, require an operator-provided bootstrap password.
      // Never print it to logs (K8s logs are centralized and long-lived).
      if (env.NODE_ENV === 'production' && !env.DEFAULT_ADMIN_PASSWORD) {
        appLogger.error('❌ No superadmin exists yet and DEFAULT_ADMIN_PASSWORD is not set.');
        appLogger.error('Set DEFAULT_ADMIN_PASSWORD via environment/Kubernetes Secret and restart.');
        // Fail fast: otherwise the generated password would be unknown and login would be impossible.
        process.exit(1);
      }

      // Generate secure random password for non-production
      const bootstrapPassword = env.DEFAULT_ADMIN_PASSWORD || generateSecurePassword();
      const passwordHash = await bcrypt.hash(bootstrapPassword, 10);
      
      // Create superadmin user (password_hash is set directly)
      const user = createUser(
        {
          username: adminUsername,
          email: adminEmail,
          password: passwordHash, // Already hashed
          role: 'superadmin',
          isActive: true,
          mustChangePassword: true,
        },
        null // created_by = null (system-created)
      );
      
      // Display credentials in logs only in non-production.
      // In production: log username/email only, never the password.
      appLogger.warn('\n' + '='.repeat(80));
      appLogger.warn('⚠️  SUPERADMIN CREATED AUTOMATICALLY');
      appLogger.warn('='.repeat(80));
      appLogger.warn(`👤 Username: ${adminUsername}`);
      if (env.NODE_ENV !== 'production') {
        appLogger.warn(`🔑 Password: ${bootstrapPassword}`);
        appLogger.warn('⚠️  These credentials are only shown ONCE');
      } else {
        appLogger.warn('🔑 Password: (not logged in production)');
        appLogger.warn('⚠️  Provide DEFAULT_ADMIN_PASSWORD via Secret/ENV to bootstrap.');
      }
      appLogger.warn(`📧 Email: ${adminEmail}`);
      appLogger.warn('='.repeat(80));
      appLogger.warn('⚠️  IMPORTANT: Change the password after the first login');
      appLogger.warn('='.repeat(80) + '\n');
      
      // Log audit event (use the created user's ID as the actor)
      try {
        createAuditLog({
          userId: user.id, // Use the created user's ID
          action: 'create',
          actionCategory: 'system_action',
          resourceType: 'user',
          resourceId: user.id,
          details: {
            note: 'Initial superadmin created automatically on system startup',
            username: adminUsername,
          },
        });
      } catch (auditError) {
        // If audit log fails, don't fail the initialization
        appLogger.warn('Failed to create audit log for superadmin creation:', auditError);
      }
    }
  } catch (error) {
    appLogger.error('Error during system initialization:', error);
    // Don't throw - allow server to start even if initialization fails
  }
}

/**
 * Generate a secure random password
 */
function generateSecurePassword(): string {
  const length = 16;
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
  let password = '';
  for (let i = 0; i < length; i++) {
    password += charset[randomInt(0, charset.length)];
  }
  return password;
}

