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

import Database from 'better-sqlite3';
import { env } from '../config/env.js';
import { createBotsTable } from './schema.js';
import { mkdirSync, readdirSync, readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

let db: Database.Database | null = null;

export function getDatabase(): Database.Database {
  if (db) {
    return db;
  }

  // Ensure data directory exists
  const dbPath = env.DATABASE_PATH;
  const dbDir = dirname(dbPath);
  try {
    mkdirSync(dbDir, { recursive: true });
  } catch (error) {
    // Directory might already exist
  }

  db = new Database(dbPath);
  
  // Enable foreign keys
  db.pragma('foreign_keys = ON');
  
  // Initialize schema
  db.exec(createBotsTable);
  
  // Apply migrations
  applyMigrations(db);

  return db;
}

/**
 * Apply all database migrations in order
 */
function applyMigrations(db: Database.Database): void {
  try {
    // Get migrations directory
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const migrationsPath = join(__dirname, 'migrations');
    
    // Read all migration files and sort them
    const migrationFiles = readdirSync(migrationsPath)
      .filter((file) => file.endsWith('.sql'))
      .sort();
    
    // Apply each migration
    for (const migrationFile of migrationFiles) {
      try {
        const migrationSql = readFileSync(join(migrationsPath, migrationFile), 'utf8');
        
        // For ALTER TABLE ADD COLUMN, check if column exists first (SQLite limitation)
        if (migrationFile === '002_add_notes.sql') {
          const tableInfo = db.prepare("PRAGMA table_info(bots)").all() as Array<{ name: string }>;
          const hasNotes = tableInfo.some(col => col.name === 'notes');
          
          if (!hasNotes) {
            db.exec('ALTER TABLE bots ADD COLUMN notes TEXT');
          }
        } else if (migrationFile === '006_add_ownership_to_bots.sql') {
          const tableInfo = db.prepare("PRAGMA table_info(bots)").all() as Array<{ name: string }>;
          const hasCreatedBy = tableInfo.some(col => col.name === 'created_by');
          const hasUpdatedBy = tableInfo.some(col => col.name === 'updated_by');
          
          if (!hasCreatedBy) {
            db.exec('ALTER TABLE bots ADD COLUMN created_by TEXT');
          }
          if (!hasUpdatedBy) {
            db.exec('ALTER TABLE bots ADD COLUMN updated_by TEXT');
          }
        } else {
          // Execute migration SQL
          db.exec(migrationSql);
        }
      } catch (error) {
        // Migration might have already been applied or failed
        // Log warning but continue
        console.warn(`Migration warning for ${migrationFile}:`, error);
      }
    }
  } catch (error) {
    // Migrations directory might not exist or be inaccessible
    console.warn('Migration directory error:', error);
  }
}

export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
  }
}

// Close database on process exit
process.on('exit', () => {
  closeDatabase();
});

process.on('SIGINT', () => {
  closeDatabase();
  process.exit(0);
});

process.on('SIGTERM', () => {
  closeDatabase();
  process.exit(0);
});

