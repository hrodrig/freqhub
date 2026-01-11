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

import { create } from 'zustand';
import type { Bot } from '../types/bot.js';
import { botApi } from '../services/api/endpoints.js';

interface BotStore {
  bots: Bot[];
  selectedBotId: string | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  fetchBots: () => Promise<void>;
  addBot: (bot: Bot) => void;
  updateBot: (id: string, updates: Partial<Bot>) => void;
  removeBot: (id: string) => void;
  selectBot: (id: string | null) => void;
  clearError: () => void;
}

export const useBotStore = create<BotStore>((set) => ({
  bots: [],
  selectedBotId: null,
  isLoading: false,
  error: null,

  fetchBots: async () => {
    set({ isLoading: true, error: null });
    try {
      const bots = await botApi.getAll();
      set({ bots, isLoading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to fetch bots',
        isLoading: false,
      });
    }
  },

  addBot: (bot: Bot) => {
    set((state) => ({
      bots: [...state.bots, bot],
    }));
  },

  updateBot: (id: string, updates: Partial<Bot>) => {
    set((state) => ({
      bots: state.bots.map((bot) => (bot.id === id ? { ...bot, ...updates } : bot)),
    }));
  },

  removeBot: (id: string) => {
    set((state) => ({
      bots: state.bots.filter((bot) => bot.id !== id),
      selectedBotId: state.selectedBotId === id ? null : state.selectedBotId,
    }));
  },

  selectBot: (id: string | null) => {
    set({ selectedBotId: id });
  },

  clearError: () => {
    set({ error: null });
  },
}));

