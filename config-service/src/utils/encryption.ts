/*
 * FreqHub Config Service
 * Copyright (C) 2025 - 2026  FreqHub Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import crypto from 'crypto';
import { env } from '../config/env.js';
import { SENSITIVE_FIELDS } from '../types/freqtrade.js';
import type { FreqtradeConfig } from '../types/freqtrade.js';

const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16;

function getKey(): Buffer {
  return crypto.scryptSync(env.ENCRYPTION_KEY, 'salt', 32);
}

export function encrypt(text: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

export function decrypt(encryptedText: string): string {
  const parts = encryptedText.split(':');
  if (parts.length !== 2) {
    throw new Error('Invalid encrypted format');
  }
  const iv = Buffer.from(parts[0], 'hex');
  const encryptedData = parts[1];
  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv);
  let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

/**
 * Get nested value from object using dot notation
 */
function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce((current, key) => {
    return current && typeof current === 'object' ? (current as Record<string, unknown>)[key] : undefined;
  }, obj as unknown);
}

/**
 * Set nested value in object using dot notation
 */
function setNestedValue(obj: Record<string, unknown>, path: string, value: unknown): void {
  const keys = path.split('.');
  const lastKey = keys.pop();
  if (!lastKey) return;

  let current = obj;
  for (const key of keys) {
    if (!(key in current) || typeof current[key] !== 'object') {
      current[key] = {};
    }
    current = current[key] as Record<string, unknown>;
  }
  current[lastKey] = value;
}

/**
 * Encrypt sensitive fields in config before storing
 */
export function encryptConfig(config: FreqtradeConfig): FreqtradeConfig {
  const encrypted = JSON.parse(JSON.stringify(config)) as FreqtradeConfig;

  for (const field of SENSITIVE_FIELDS) {
    const value = getNestedValue(encrypted as unknown as Record<string, unknown>, field);
    if (value && typeof value === 'string' && value.length > 0) {
      // Only encrypt if not already encrypted (doesn't contain ':' pattern)
      if (!value.includes(':') || value.length < 40) {
        setNestedValue(encrypted as unknown as Record<string, unknown>, field, encrypt(value));
      }
    }
  }

  return encrypted;
}

/**
 * Decrypt sensitive fields in config before sending to bot
 */
export function decryptConfig(config: FreqtradeConfig): FreqtradeConfig {
  const decrypted = JSON.parse(JSON.stringify(config)) as FreqtradeConfig;

  for (const field of SENSITIVE_FIELDS) {
    const value = getNestedValue(decrypted as unknown as Record<string, unknown>, field);
    if (value && typeof value === 'string' && value.includes(':')) {
      try {
        setNestedValue(decrypted as unknown as Record<string, unknown>, field, decrypt(value));
      } catch {
        // Value might not be encrypted, leave as is
      }
    }
  }

  return decrypted;
}

/**
 * Redact sensitive fields for display (replace with ****)
 */
export function redactConfig(config: FreqtradeConfig): FreqtradeConfig {
  const redacted = JSON.parse(JSON.stringify(config)) as FreqtradeConfig;

  for (const field of SENSITIVE_FIELDS) {
    const value = getNestedValue(redacted as unknown as Record<string, unknown>, field);
    if (value && typeof value === 'string' && value.length > 0) {
      setNestedValue(redacted as unknown as Record<string, unknown>, field, '********');
    }
  }

  return redacted;
}
