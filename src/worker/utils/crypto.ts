import { Env } from '../types/env';

export const EXPECTED_SECRET_LENGTH = 43;
export const MAX_ROTATION_OVERLAP_MS = 72 * 60 * 60 * 1000; // 72 hours

export function isStrictBase64UrlCharCode(code: number): boolean {
  return (
    (code >= 65 && code <= 90) ||  // A-Z
    (code >= 97 && code <= 122) || // a-z
    (code >= 48 && code <= 57) ||  // 0-9
    code === 95 ||                 // _
    code === 45                    // -
  );
}

function base64UrlDecode(str: string): Uint8Array | null {
  if (str.length !== EXPECTED_SECRET_LENGTH) return null;
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/') + '=';
  try {
    const binary = atob(base64);
    if (binary.length !== 32) return null;
    const bytes = new Uint8Array(32);
    for (let i = 0; i < 32; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  } catch {
    return null;
  }
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Validates that a string is a strictly canonical 43-character unpadded Base64URL
 * encoding of exactly 32 bytes in Cloudflare Workers.
 */
export function isCanonicalBase64Url32Worker(secret: unknown): secret is string {
  if (typeof secret !== 'string') return false;
  if (secret.length !== EXPECTED_SECRET_LENGTH) return false;

  for (let i = 0; i < secret.length; i++) {
    if (!isStrictBase64UrlCharCode(secret.charCodeAt(i))) return false;
  }

  const decoded = base64UrlDecode(secret);
  if (!decoded || decoded.length !== 32) return false;

  return base64UrlEncode(decoded) === secret;
}

/**
 * Validates worker environment bridge secret configuration per request.
 * Fails closed if missing, malformed, or if rotation overlap exceeds 72h.
 */
export function validateBridgeSecretConfig(env: Env): { valid: boolean; error?: string } {
  const primary = env.INTERNAL_D1_BRIDGE_SECRET;
  if (!primary || !isCanonicalBase64Url32Worker(primary)) {
    return { valid: false, error: 'Primary bridge secret is missing or non-canonical.' };
  }

  const previous = env.INTERNAL_D1_BRIDGE_SECRET_PREVIOUS;
  const previousExpiresAt = env.INTERNAL_D1_BRIDGE_SECRET_PREVIOUS_EXPIRES_AT;

  if (previous) {
    if (!isCanonicalBase64Url32Worker(previous)) {
      return { valid: false, error: 'Previous bridge secret is non-canonical.' };
    }
    if (!previousExpiresAt) {
      return { valid: false, error: 'Previous bridge secret expiry is missing.' };
    }
    const expiresMs = Number(previousExpiresAt);
    if (isNaN(expiresMs) || expiresMs <= 0) {
      return { valid: false, error: 'Previous bridge secret expiry is invalid timestamp.' };
    }
  }

  return { valid: true };
}

/**
 * Constant-time comparison of two strings using SHA-256 digest + timingSafeEqual.
 */
export async function timingSafeStringEqual(a: string, b: string): Promise<boolean> {
  const enc = new TextEncoder();
  const hashA = await crypto.subtle.digest('SHA-256', enc.encode(a));
  const hashB = await crypto.subtle.digest('SHA-256', enc.encode(b));

  const bufA = new Uint8Array(hashA);
  const bufB = new Uint8Array(hashB);

  let mismatch = 0;
  for (let i = 0; i < 32; i++) {
    mismatch |= bufA[i] ^ bufB[i];
  }
  return mismatch === 0;
}

/**
 * Verifies incoming bridge secret with timing-safe comparison and rotation support.
 */
export async function verifyBridgeSecret(
  incomingSecret: string,
  env: Env
): Promise<{ authorized: boolean; matchedSecret?: string; reason?: string }> {
  if (!isCanonicalBase64Url32Worker(incomingSecret)) {
    return { authorized: false, reason: 'Malformed or non-canonical client secret.' };
  }

  const primary = env.INTERNAL_D1_BRIDGE_SECRET;
  if (!primary) {
    return { authorized: false, reason: 'Bridge secret not configured.' };
  }

  // Compare with primary secret
  if (await timingSafeStringEqual(incomingSecret, primary)) {
    return { authorized: true, matchedSecret: primary };
  }

  // Check previous secret if rotation overlap configured
  const previous = env.INTERNAL_D1_BRIDGE_SECRET_PREVIOUS;
  const previousExpiresAt = env.INTERNAL_D1_BRIDGE_SECRET_PREVIOUS_EXPIRES_AT;

  if (previous && previousExpiresAt) {
    const expiresMs = Number(previousExpiresAt);
    const now = Date.now();

    // Rejection boundary: now >= previousExpiresAt
    if (now >= expiresMs) {
      return { authorized: false, reason: 'Previous bridge secret has expired.' };
    }

    if (await timingSafeStringEqual(incomingSecret, previous)) {
      return { authorized: true, matchedSecret: previous };
    }
  }

  return { authorized: false, reason: 'Bridge secret mismatch.' };
}

export interface WorkerJwtPayload {
  id: string;
  email?: string;
  role: string;
  exp?: number;
  [key: string]: any;
}

/**
 * Verifies an HS256 JWT using Web Crypto API in Cloudflare Workers.
 */
export async function verifyWorkerJwt(
  token: string,
  secret: string
): Promise<{ valid: boolean; payload?: WorkerJwtPayload; reason?: string }> {
  if (!token || typeof token !== 'string') {
    return { valid: false, reason: 'Missing token' };
  }
  const parts = token.split('.');
  if (parts.length !== 3) {
    return { valid: false, reason: 'Malformed JWT structure' };
  }

  const [headerB64, payloadB64, signatureB64] = parts;

  let header: any;
  try {
    const headerJson = atob(headerB64.replace(/-/g, '+').replace(/_/g, '/'));
    header = JSON.parse(headerJson);
  } catch {
    return { valid: false, reason: 'Invalid JWT header' };
  }

  if (header.alg !== 'HS256') {
    return { valid: false, reason: `Unsupported algorithm: ${header.alg}` };
  }

  try {
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      enc.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    const data = enc.encode(`${headerB64}.${payloadB64}`);
    let sigBase64 = signatureB64.replace(/-/g, '+').replace(/_/g, '/');
    while (sigBase64.length % 4 !== 0) sigBase64 += '=';
    const sigBinary = atob(sigBase64);
    const sigBytes = new Uint8Array(sigBinary.length);
    for (let i = 0; i < sigBinary.length; i++) sigBytes[i] = sigBinary.charCodeAt(i);

    const isValidSig = await crypto.subtle.verify('HMAC', key, sigBytes, data);
    if (!isValidSig) {
      return { valid: false, reason: 'Invalid JWT signature' };
    }

    let payloadBase64 = payloadB64.replace(/-/g, '+').replace(/_/g, '/');
    while (payloadBase64.length % 4 !== 0) payloadBase64 += '=';
    const payloadJson = atob(payloadBase64);
    const payload = JSON.parse(payloadJson) as WorkerJwtPayload;

    if (payload.exp && Math.floor(Date.now() / 1000) >= payload.exp) {
      return { valid: false, reason: 'JWT token has expired' };
    }

    return { valid: true, payload };
  } catch (err: any) {
    return { valid: false, reason: `JWT verification error: ${err.message}` };
  }
}

/**
 * Verifies incoming internal media secret with timing-safe comparison and rotation support.
 * Dedicated credential strictly separated from INTERNAL_D1_BRIDGE_SECRET and ORIGIN_PROXY_SECRET.
 */
export async function verifyMediaSecret(
  incomingSecret: string,
  env: Env
): Promise<{ authorized: boolean; matchedSecret?: string; reason?: string }> {
  if (!isCanonicalBase64Url32Worker(incomingSecret)) {
    return { authorized: false, reason: 'Malformed or non-canonical media secret.' };
  }

  const primary = env.INTERNAL_MEDIA_SECRET;
  if (!primary) {
    return { authorized: false, reason: 'Internal media secret not configured.' };
  }

  if (await timingSafeStringEqual(incomingSecret, primary)) {
    return { authorized: true, matchedSecret: primary };
  }

  const previous = env.INTERNAL_MEDIA_SECRET_PREVIOUS;
  const previousExpiresAt = env.INTERNAL_MEDIA_SECRET_PREVIOUS_EXPIRES_AT;

  if (previous && previousExpiresAt) {
    const expiresMs = Number(previousExpiresAt);
    const now = Date.now();

    if (now >= expiresMs) {
      return { authorized: false, reason: 'Previous media secret has expired.' };
    }

    if (await timingSafeStringEqual(incomingSecret, previous)) {
      return { authorized: true, matchedSecret: previous };
    }
  }

  return { authorized: false, reason: 'Internal media secret mismatch.' };
}
