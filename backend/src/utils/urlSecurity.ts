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

import { isIP } from 'net';
import { env } from '../config/env.js';

type UrlValidationResult = { ok: true } | { ok: false; reason: string };

function isBlockedHostnameInProduction(hostname: string): boolean {
  const h = hostname.toLowerCase();
  return (
    h === 'localhost' ||
    h === 'metadata.google.internal' ||
    h === 'metadata' // common in some environments
  );
}

function parseIPv4(ip: string): [number, number, number, number] | null {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  const nums = parts.map((p) => Number(p));
  if (nums.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return null;
  return [nums[0]!, nums[1]!, nums[2]!, nums[3]!];
}

function isBlockedIPv4InProduction(ip: string): boolean {
  const p = parseIPv4(ip);
  if (!p) return false;
  const [a, b] = p;

  // Unspecified / loopback
  if (a === 0) return true; // 0.0.0.0/8 (includes 0.0.0.0)
  if (a === 127) return true; // 127.0.0.0/8

  // Link-local (includes cloud metadata IP)
  if (a === 169 && b === 254) return true; // 169.254.0.0/16

  // Multicast / reserved
  if (a >= 224) return true;

  return false;
}

function isBlockedIPv6InProduction(ip: string): boolean {
  const v = ip.toLowerCase();
  if (v === '::' || v === '::1') return true; // unspecified / loopback
  if (v.startsWith('fe80:')) return true; // link-local fe80::/10 (rough)
  return false;
}

function validateBaseUrl(
  rawUrl: string,
  opts: { allowedProtocols: string[]; purpose: string }
): UrlValidationResult {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return { ok: false, reason: `Invalid ${opts.purpose} URL` };
  }

  if (!opts.allowedProtocols.includes(parsed.protocol)) {
    return {
      ok: false,
      reason: `${opts.purpose} URL must use ${opts.allowedProtocols.join(' or ')}`,
    };
  }

  // Avoid embedding credentials in the URL
  if (parsed.username || parsed.password) {
    return { ok: false, reason: `${opts.purpose} URL must not include credentials` };
  }

  // Keep the base URL clean/predictable for proxying.
  // Allow "/" (trailing slash) but disallow any other path/query/hash.
  if (parsed.pathname && parsed.pathname !== '/' && parsed.pathname !== '') {
    return { ok: false, reason: `${opts.purpose} URL must not include a path` };
  }
  if (parsed.search) {
    return { ok: false, reason: `${opts.purpose} URL must not include query parameters` };
  }
  if (parsed.hash) {
    return { ok: false, reason: `${opts.purpose} URL must not include a hash fragment` };
  }

  // Production SSRF hardening: block obvious dangerous targets.
  if (env.NODE_ENV === 'production') {
    const hostname = parsed.hostname;
    if (!hostname) {
      return { ok: false, reason: `${opts.purpose} URL must include a hostname` };
    }

    if (isBlockedHostnameInProduction(hostname)) {
      return { ok: false, reason: `${opts.purpose} URL hostname is not allowed in production` };
    }

    const ipType = isIP(hostname);
    if (ipType === 4 && isBlockedIPv4InProduction(hostname)) {
      return { ok: false, reason: `${opts.purpose} URL IP is not allowed in production` };
    }
    if (ipType === 6 && isBlockedIPv6InProduction(hostname)) {
      return { ok: false, reason: `${opts.purpose} URL IP is not allowed in production` };
    }
  }

  return { ok: true };
}

export function validateBotApiUrl(rawUrl: string): UrlValidationResult {
  return validateBaseUrl(rawUrl, { allowedProtocols: ['http:', 'https:'], purpose: 'API' });
}

export function validateBotWsUrl(rawUrl: string): UrlValidationResult {
  return validateBaseUrl(rawUrl, { allowedProtocols: ['ws:', 'wss:'], purpose: 'WebSocket' });
}

export function assertBotApiUrlAllowed(rawUrl: string): void {
  const result = validateBotApiUrl(rawUrl);
  if (!result.ok) {
    throw new Error(result.reason);
  }
}

