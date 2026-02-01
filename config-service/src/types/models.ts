/*
 * FreqHub Config Service
 * Copyright (C) 2025 - 2026  FreqHub Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import type { ObjectId } from 'mongodb';
import type { FreqtradeConfig } from './freqtrade.js';

/**
 * Bot configuration stored in MongoDB
 */
export interface BotConfig {
  _id?: ObjectId;
  botId: string; // UUID from FreqHub backend
  botName: string; // For quick reference

  // Current deployed config
  currentConfig: FreqtradeConfig;
  currentVersion: number;

  // Draft config (pending changes)
  draftConfig?: FreqtradeConfig;
  hasPendingChanges: boolean;

  // Agent URL for direct deploy (optional)
  agentUrl?: string;

  // Metadata
  lastDeployedAt?: Date;
  lastDeployedBy?: string; // userId
  lastSyncedAt?: Date; // Last time we synced from bot
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Config version history
 */
export interface ConfigVersion {
  _id?: ObjectId;
  botId: string;
  version: number;
  config: FreqtradeConfig;

  // Changes from previous version
  changedFields: string[];
  previousValues?: Record<string, unknown>;

  // Metadata
  createdAt: Date;
  createdBy?: string; // userId
  comment?: string; // e.g., "Changed to live trading"
  source: 'manual' | 'import' | 'sync' | 'rollback';
}

/**
 * Deployment record (audit trail)
 */
export interface Deployment {
  _id?: ObjectId;
  botId: string;
  configVersion: number;

  // Deployment status
  status: 'pending' | 'deploying' | 'success' | 'failed' | 'rolled_back';

  // Method used
  method: 'agent' | 'api_reload' | 'manual';

  // Results
  botResponse?: Record<string, unknown>;
  errorMessage?: string;

  // Metadata
  deployedAt: Date;
  deployedBy?: string; // userId
  completedAt?: Date;
  duration?: number; // ms
}

/**
 * Create BotConfig request
 */
export interface CreateBotConfigRequest {
  botId: string;
  botName: string;
  config: FreqtradeConfig;
  agentUrl?: string;
}

/**
 * Update BotConfig request (creates draft)
 */
export interface UpdateBotConfigRequest {
  config?: Partial<FreqtradeConfig>;
  botName?: string;
  agentUrl?: string;
  applyImmediately?: boolean; // If true, skip draft and apply directly
}

/**
 * Quick edit request (common fields)
 */
export interface QuickEditRequest {
  field: string;
  value: unknown;
  deploy?: boolean; // If true, deploy immediately after edit
}

/**
 * Deploy request
 */
export interface DeployRequest {
  version?: number; // If not specified, deploy current version
  force?: boolean; // Deploy even if bot is running
  comment?: string;
}

/**
 * Rollback request
 */
export interface RollbackRequest {
  version: number;
  deploy?: boolean; // If true, deploy after rollback
  comment?: string;
}

/**
 * Diff result
 */
export interface ConfigDiff {
  field: string;
  oldValue: unknown;
  newValue: unknown;
  type: 'added' | 'removed' | 'changed';
}

/**
 * Bulk operation request
 */
export interface BulkOperationRequest {
  botIds: string[];
  operation: 'deploy' | 'runmode' | 'sync';
  params?: Record<string, unknown>;
}

/**
 * API Response wrapper
 */
export interface ApiResponse<T = unknown> {
  status: 'success' | 'error';
  data?: T;
  message?: string;
  errors?: Array<{ field?: string; message: string }>;
}
