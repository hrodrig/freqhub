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

/**
 * Script to create an example database with sample data
 * This database is included in the repository for new users to get started
 */

import Database from 'better-sqlite3';
import { randomUUID, createCipheriv, randomBytes } from 'crypto';
import { createBotsTable } from '../src/db/schema.js';
import { dirname } from 'path';
import { mkdirSync, existsSync, unlinkSync } from 'fs';

// Use a fixed encryption key for the example database
// This ensures the example DB can be used by anyone who clones the repo
// In production, users should use their own ENCRYPTION_KEY
const EXAMPLE_ENCRYPTION_KEY = 'example-encryption-key-min-32-chars-for-demo';

// Simple encryption function for example database
// Uses the same algorithm as encryptionService but with a fixed key
function encryptPasswordForExample(password: string): string {
  const ALGORITHM = 'aes-256-cbc';
  const IV_LENGTH = 16;
  
  // Generate a key from the fixed encryption key (32 bytes for AES-256)
  const keyBuffer = Buffer.alloc(32);
  Buffer.from(EXAMPLE_ENCRYPTION_KEY).copy(keyBuffer);
  
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, keyBuffer, iv);
  
  let encrypted = cipher.update(password, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  // Prepend IV to encrypted data
  return iv.toString('hex') + ':' + encrypted;
}

const exampleDbPath = './data/freqhub.db.example';

// Ensure data directory exists
const dbDir = dirname(exampleDbPath);
try {
  mkdirSync(dbDir, { recursive: true });
} catch (error) {
  // Directory might already exist
}

// Remove existing example DB if it exists
if (existsSync(exampleDbPath)) {
  unlinkSync(exampleDbPath);
}

// Create new database
const db = new Database(exampleDbPath);

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Initialize schema
db.exec(createBotsTable);

// Insert example bots
const now = Date.now();

// Example Bot 1: Local Freqtrade instance
const bot1Id = randomUUID();
const bot1Password = encryptPasswordForExample('SuperSecret1!');
db.prepare(`
  INSERT INTO bots (id, name, api_url, ws_url, username, encrypted_password, is_enabled, is_selected, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`).run(
  bot1Id,
  'Freqtrade Bot 1',
  'http://localhost:8080',
  'ws://localhost:8080',
  'freqtrader',
  bot1Password,
  1, // enabled
  0, // not selected
  now,
  now
);

// Example Bot 2: Another local instance
const bot2Id = randomUUID();
const bot2Password = encryptPasswordForExample('SuperSecret2!');
db.prepare(`
  INSERT INTO bots (id, name, api_url, ws_url, username, encrypted_password, is_enabled, is_selected, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`).run(
  bot2Id,
  'Freqtrade Bot 2',
  'http://localhost:8081',
  'ws://localhost:8081',
  'freqtrader',
  bot2Password,
  1, // enabled
  0, // not selected
  now,
  now
);

// Example Bot 3: Disabled bot (for demonstration)
const bot3Id = randomUUID();
const bot3Password = encryptPasswordForExample('SuperSecret3!');
db.prepare(`
  INSERT INTO bots (id, name, api_url, ws_url, username, encrypted_password, is_enabled, is_selected, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`).run(
  bot3Id,
 'Freqtrade Bot 3 (Disabled)',
  'http://localhost:8082',
  null,
  'freqtrader',
  bot3Password,
  0, // disabled
  0, // not selected
  now,
  now
);

db.close();

console.log('✅ Example database created successfully!');
console.log(`📁 Location: ${exampleDbPath}`);
console.log('');
console.log('📝 Example bots included:');
console.log('  1. Freqtrade Bot 1 (http://localhost:8080) - Enabled');
console.log('  2. Freqtrade Bot 2 (http://localhost:8081) - Enabled');
console.log('  3. Freqtrade Bot 3 (http://localhost:8082) - Disabled');
console.log('');
console.log('⚠️  Note: These are example bots with placeholder credentials.');
console.log('   Update the credentials in the database or via the API after cloning.');
console.log('');
console.log('💡 To use this example database:');
console.log('   cp data/freqhub.db.example data/freqhub.db');

