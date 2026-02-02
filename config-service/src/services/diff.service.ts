/*
 * FreqHub Config Service
 * Copyright (C) 2025 - 2026  FreqHub Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import type { ConfigDiff } from '../types/models.js';
import type { FreqtradeConfig } from '../types/freqtrade.js';
import { SENSITIVE_FIELDS } from '../types/freqtrade.js';

/**
 * Flatten an object into dot-notation keys
 */
function flattenObject(obj: Record<string, unknown>, prefix = ''): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    const newKey = prefix ? `${prefix}.${key}` : key;

    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(result, flattenObject(value as Record<string, unknown>, newKey));
    } else {
      result[newKey] = value;
    }
  }

  return result;
}

/**
 * Check if a value is "empty" (null, undefined, empty string, empty array)
 */
function isEmpty(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string' && value.trim() === '') return true;
  if (Array.isArray(value) && value.length === 0) return true;
  return false;
}

/**
 * Redact a value if it's a sensitive field
 */
function redactIfSensitive(field: string, value: unknown): unknown {
  if (SENSITIVE_FIELDS.includes(field) && value && typeof value === 'string') {
    return '********';
  }
  return value;
}

/**
 * Compute diff between two configs
 */
export function computeDiff(oldConfig: FreqtradeConfig, newConfig: FreqtradeConfig): ConfigDiff[] {
  const diffs: ConfigDiff[] = [];

  const oldFlat = flattenObject(oldConfig as unknown as Record<string, unknown>);
  const newFlat = flattenObject(newConfig as unknown as Record<string, unknown>);

  const allKeys = new Set([...Object.keys(oldFlat), ...Object.keys(newFlat)]);

  for (const key of allKeys) {
    const oldValue = oldFlat[key];
    const newValue = newFlat[key];

    // Skip if both are empty
    if (isEmpty(oldValue) && isEmpty(newValue)) continue;

    // Compare values
    const oldStr = JSON.stringify(oldValue);
    const newStr = JSON.stringify(newValue);

    if (oldStr !== newStr) {
      let type: ConfigDiff['type'];

      if (isEmpty(oldValue) && !isEmpty(newValue)) {
        type = 'added';
      } else if (!isEmpty(oldValue) && isEmpty(newValue)) {
        type = 'removed';
      } else {
        type = 'changed';
      }

      diffs.push({
        field: key,
        oldValue: redactIfSensitive(key, oldValue),
        newValue: redactIfSensitive(key, newValue),
        type,
      });
    }
  }

  // Sort by field name for consistent output
  diffs.sort((a, b) => a.field.localeCompare(b.field));

  return diffs;
}

/**
 * Get a human-readable summary of changes
 */
export function summarizeDiff(diffs: ConfigDiff[]): string {
  if (diffs.length === 0) {
    return 'No changes';
  }

  const added = diffs.filter((d) => d.type === 'added').length;
  const removed = diffs.filter((d) => d.type === 'removed').length;
  const changed = diffs.filter((d) => d.type === 'changed').length;

  const parts: string[] = [];
  if (added > 0) parts.push(`${added} added`);
  if (removed > 0) parts.push(`${removed} removed`);
  if (changed > 0) parts.push(`${changed} changed`);

  return parts.join(', ');
}

/**
 * Check if a specific field changed
 */
export function fieldChanged(diffs: ConfigDiff[], field: string): boolean {
  return diffs.some((d) => d.field === field);
}

/**
 * Get the change for a specific field
 */
export function getFieldChange(diffs: ConfigDiff[], field: string): ConfigDiff | undefined {
  return diffs.find((d) => d.field === field);
}

/**
 * Filter diffs to only include specific fields
 */
export function filterDiffs(diffs: ConfigDiff[], fields: string[]): ConfigDiff[] {
  return diffs.filter((d) => fields.includes(d.field));
}

/**
 * Check if config has critical changes (runmode, exchange, etc.)
 */
export function hasCriticalChanges(diffs: ConfigDiff[]): { hasCritical: boolean; criticalFields: string[] } {
  const criticalFields = ['dry_run', 'exchange.name', 'exchange.key', 'exchange.secret', 'stake_currency'];

  const critical = diffs.filter((d) => criticalFields.some((cf) => d.field.startsWith(cf)));

  return {
    hasCritical: critical.length > 0,
    criticalFields: critical.map((d) => d.field),
  };
}
