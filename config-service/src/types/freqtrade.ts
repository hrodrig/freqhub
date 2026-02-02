/*
 * FreqHub Config Service
 * Copyright (C) 2025 - 2026  FreqHub Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

/**
 * Freqtrade config.json structure
 * This is a subset of the full config - we only track fields we care about
 */
export interface FreqtradeConfig {
  // Core settings
  dry_run: boolean;
  stake_currency: string;
  stake_amount: number | 'unlimited';
  tradable_balance_ratio?: number;
  max_open_trades?: number;

  // Strategy
  strategy?: string;
  strategy_path?: string;
  timeframe?: string;

  // Exchange
  exchange?: {
    name: string;
    key?: string; // Encrypted when stored
    secret?: string; // Encrypted when stored
    password?: string; // Encrypted when stored
    ccxt_config?: Record<string, unknown>;
    ccxt_async_config?: Record<string, unknown>;
  };

  // Trading settings
  stoploss?: number;
  trailing_stop?: boolean;
  trailing_stop_positive?: number;
  trailing_stop_positive_offset?: number;
  trailing_only_offset_is_reached?: boolean;

  // Order types
  order_types?: {
    entry?: string;
    exit?: string;
    stoploss?: string;
    stoploss_on_exchange?: boolean;
  };

  // Pairlists
  pairlists?: Array<{
    method: string;
    [key: string]: unknown;
  }>;

  // API Server
  api_server?: {
    enabled?: boolean;
    listen_ip_address?: string;
    listen_port?: number;
    username?: string;
    password?: string; // Encrypted when stored
    jwt_secret_key?: string; // Encrypted when stored
  };

  // Telegram
  telegram?: {
    enabled?: boolean;
    token?: string; // Encrypted when stored
    chat_id?: string;
  };

  // Any other fields we don't explicitly track
  [key: string]: unknown;
}

/**
 * Sensitive fields that should be encrypted
 */
export const SENSITIVE_FIELDS = [
  'exchange.key',
  'exchange.secret',
  'exchange.password',
  'api_server.password',
  'api_server.jwt_secret_key',
  'telegram.token',
];

/**
 * Fields that are commonly changed via UI
 */
export const QUICK_EDIT_FIELDS = [
  'dry_run',
  'stake_amount',
  'max_open_trades',
  'stoploss',
  'trailing_stop',
  'trailing_stop_positive',
] as const;

export type QuickEditField = (typeof QUICK_EDIT_FIELDS)[number];
