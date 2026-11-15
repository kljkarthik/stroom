import crypto from 'node:crypto';

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

/**
 * Validates that a string is a strictly canonical 43-character unpadded Base64URL
 * encoding of exactly 32 bytes with zero non-canonical padding bits.
 */
export function isCanonicalBase64Url32Node(secret: unknown): secret is string {
  if (typeof secret !== 'string') return false;
  if (secret.length !== EXPECTED_SECRET_LENGTH) return false;

  for (let i = 0; i < secret.length; i++) {
    if (!isStrictBase64UrlCharCode(secret.charCodeAt(i))) return false;
  }

  // Decode to raw buffer
  const buf = Buffer.from(secret, 'base64url');
  if (buf.length !== 32) return false;

  // Re-encode and verify exact string equality
  return buf.toString('base64url') === secret;
}

/**
 * Timing-safe string equality using SHA-256 digest double-hashing.
 */
export function timingSafeStringEqualNode(a: string, b: string): boolean {
  const hashA = crypto.createHash('sha256').update(a, 'utf8').digest();
  const hashB = crypto.createHash('sha256').update(b, 'utf8').digest();
  return crypto.timingSafeEqual(hashA, hashB);
}

/**
 * Generates a canonical 43-character unpadded Base64URL secret containing 256 bits of CSPRNG entropy.
 */
export function generateCanonicalSecret(): string {
  return crypto.randomBytes(32).toString('base64url');
}
