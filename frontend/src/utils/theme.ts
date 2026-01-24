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

export type ThemeMode = 'light' | 'dark';

const THEME_STORAGE_KEY = 'freqhub.theme';
const LEGACY_THEME_STORAGE_KEY = 'theme';

function safeGetItem(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSetItem(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // ignore (private mode / storage disabled)
  }
}

export function getStoredTheme(): ThemeMode | null {
  const stored = safeGetItem(THEME_STORAGE_KEY) ?? safeGetItem(LEGACY_THEME_STORAGE_KEY);
  if (stored === 'light' || stored === 'dark') return stored;
  return null;
}

export function setStoredTheme(theme: ThemeMode): void {
  safeSetItem(THEME_STORAGE_KEY, theme);
  // Keep legacy key in sync for backward compatibility
  safeSetItem(LEGACY_THEME_STORAGE_KEY, theme);
}

export function getSystemTheme(): ThemeMode {
  if (typeof window === 'undefined' || !window.matchMedia) return 'dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function applyTheme(theme: ThemeMode): void {
  if (typeof document === 'undefined') return;
  document.documentElement.classList.toggle('dark', theme === 'dark');
  document.documentElement.dataset.theme = theme;
}

export function getInitialTheme(): ThemeMode {
  return getStoredTheme() ?? getSystemTheme();
}

/**
 * Initialize theme early (before React renders) so the login screen and app
 * render with the correct theme without flashes.
 *
 * Returns:
 * - theme: the theme applied
 * - hasUserOverride: whether a stored preference exists
 */
export function initTheme(): { theme: ThemeMode; hasUserOverride: boolean } {
  const stored = getStoredTheme();
  const hasUserOverride = stored !== null;
  const theme = stored ?? getSystemTheme();
  applyTheme(theme);

  // If the user has NOT explicitly chosen a theme, follow system changes.
  if (!hasUserOverride && typeof window !== 'undefined' && window.matchMedia) {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => {
      // Only react if the user still has no stored override
      if (getStoredTheme() === null) {
        applyTheme(media.matches ? 'dark' : 'light');
      }
    };

    if (typeof media.addEventListener === 'function') {
      media.addEventListener('change', onChange);
    } else if (typeof media.addListener === 'function') {
      // Safari legacy
      media.addListener(onChange);
    }
  }

  return { theme, hasUserOverride };
}

