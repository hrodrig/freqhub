/*
 * FreqHub Config Service - Request/URL security for SSRF mitigation
 * Copyright (C) 2025 - 2026  FreqHub Contributors
 */

/**
 * Safe identifier for use in URLs (e.g. botId).
 * Allows only alphanumeric, hyphen, underscore; no path traversal or URL injection.
 */
export function validateSafeId(id: string): void {
  if (typeof id !== 'string' || id.length === 0 || id.length > 128) {
    throw new Error('Invalid id: must be a non-empty string up to 128 characters');
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(id)) {
    throw new Error('Invalid id: only letters, digits, hyphen and underscore allowed');
  }
}

/**
 * Validate agent/base URL before using in outgoing requests (SSRF mitigation).
 * Allows http/https only; no credentials in URL; no path/query/hash (base URL only).
 */
export function validateAgentUrl(rawUrl: string): void {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error('Invalid agent URL');
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('Agent URL must use http or https');
  }
  if (parsed.username || parsed.password) {
    throw new Error('Agent URL must not include credentials');
  }
  if (parsed.pathname && parsed.pathname !== '/' && parsed.pathname !== '') {
    throw new Error('Agent URL must be a base URL without path');
  }
  if (parsed.search || parsed.hash) {
    throw new Error('Agent URL must not include query or hash');
  }
}
