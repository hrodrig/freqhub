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
 * Trade type from Freqtrade API
 */
export interface Trade {
  trade_id: number;
  pair: string;
  is_open: boolean;
  amount: number;
  stake_amount: number;
  open_rate: number;
  close_rate?: number;
  profit_abs?: number;
  profit_ratio?: number;
  open_date: string;
  close_date?: string;
  strategy?: string;
  enter_tag?: string;
  exit_reason?: string;
}

