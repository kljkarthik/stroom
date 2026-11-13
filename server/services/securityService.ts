import { Response } from 'express';
import { config } from '../config/env';

/**
 * Validates that a user-supplied or admin-supplied media/image URL uses an allowed
 * safe protocol (https://, http://, or root-relative /...) and never dangerous
 * schemes like javascript:, vbscript:, data:text/html, or data:image/svg+xml.
 */
export function validateSafeMediaUrl(url: unknown, fieldName = 'URL'): { valid: boolean; value?: string; error?: string } {
  if (url === undefined || url === null || url === '') {
    return { valid: true, value: undefined };
  }
  if (typeof url !== 'string') {
    return { valid: false, error: `${fieldName} must be a valid URL string.` };
  }
  const trimmed = url.trim();
  if (!trimmed) {
    return { valid: true, value: undefined };
  }
  if (trimmed.length > 2048) {
    return { valid: false, error: `${fieldName} exceeds maximum length of 2048 characters.` };
  }

  // Allow safe root-relative app asset paths (e.g. /brand/logo.png)
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) {
    return { valid: true, value: trimmed };
  }

  // Strictly permit http(s) URLs; block javascript:, data:, file:, vbscript:
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      return { valid: true, value: trimmed };
    }
    return { valid: false, error: `${fieldName} must use https:// or http://.` };
  } catch {
    return { valid: false, error: `${fieldName} is not a valid URL.` };
  }
}

/**
 * Strips raw SQL/stack internals from unexpected 500 errors in production
 * while logging full context on the server.
 */
export function sendSafeServerError(res: Response, err: any, fallbackMessage = 'An unexpected server error occurred') {
  console.error('[STROOM Server Error]', err);
  if (config.isProduction) {
    return res.status(500).json({ error: fallbackMessage });
  }
  return res.status(500).json({ error: err?.message || fallbackMessage });
}
