# STROOM — Phase 2.5.1.0.2: Node.js & Worker Secret Comparison Implementations

**Project:** `D:\ST`  
**Branch:** `feature/stroom-production-launch`  
**Approved Baseline Commit:** `19c4176`  
**Document Version:** 1.0.0 (Production Reference Implementations)  
**Security Classification:** Cryptographic Architecture & Implementation Contract  
**Mode:** STRICT READ-ONLY SPECIFICATION (Zero code changes, zero database mutations)  
**Date:** November 14, 2026  

---

## 1. Architectural Overview & Separation of Concerns

This document specifies the exact, production-ready cryptographic comparison modules for:
1. **Node.js Express Backend** (`server/utils/crypto.ts`): Executing within Node.js v18+/v20+ LTS using `node:crypto`.
2. **Cloudflare Worker Edge Proxy** (`src/worker/utils/crypto.ts`): Executing within the Cloudflare `workerd` V8 isolate using Web Crypto `SubtleCrypto` and the native `crypto.subtle.timingSafeEqual` extension.

### Explicit Distinction: What Is and Is Not Constant-Time
In strict adherence to cryptographic precision:
> **The entire comparison procedure IS NOT constant-time.**  
> - **Input Validation Phase (Variable Time)**: Validating parameter types (`typeof !== 'string'`), length bounds ($[32, 128]$ bytes), regex compliance (`/^[A-Za-z0-9_-]{32,128}$/`), and UTF-8 byte equality executes in variable time and exits early. This early exit is cryptographically secure because rejecting non-string objects, malformed headers, or 100,000-character DoS payloads leaks only protocol compliance, leaking zero entropy regarding the secret.
> - **Cryptographic Digest Comparison Phase (Strictly Constant-Time)**: Once both inputs are validated, SHA-256 digests both inputs into guaranteed 32-byte buffers. The equality of these 32 bytes is evaluated using `timingSafeEqual`. This step executes in strictly constant time ($O(32)$ cycles) using bitwise accumulator logic without early branching.

---

## 2. Node.js Express Implementation (`server/utils/crypto.ts`)

```typescript
import crypto from 'node:crypto';

// Strict ASCII base64url and hex allowlist bounds
export const MIN_SECRET_BYTES = 32;
export const MAX_SECRET_BYTES = 128;
export const SECRET_REGEX = /^[A-Za-z0-9_-]{32,128}$/;

/**
 * Validates configured environment secrets at application boot.
 * Throws a fatal configuration error if missing, empty, or malformed.
 */
export function validateConfiguredSecretNode(secret: unknown, secretName = 'SECRET'): string {
  if (typeof secret !== 'string') {
    throw new Error(`[STROOM Config Fatal] ${secretName} must be a string, got ${typeof secret}`);
  }
  const byteLen = Buffer.byteLength(secret, 'utf8');
  if (byteLen < MIN_SECRET_BYTES || byteLen > MAX_SECRET_BYTES) {
    throw new Error(
      `[STROOM Config Fatal] ${secretName} byte length (${byteLen}) outside allowed bounds [${MIN_SECRET_BYTES}, ${MAX_SECRET_BYTES}]`
    );
  }
  if (!SECRET_REGEX.test(secret)) {
    throw new Error(
      `[STROOM Config Fatal] ${secretName} contains invalid characters. Must be 32-128 ASCII [A-Za-z0-9_-]`
    );
  }
  return secret;
}

/**
 * Validates secret shape for incoming HTTP headers.
 * Never throws; returns false in O(1) time on any validation failure.
 */
export function isValidSecretShapeNode(secret: unknown): secret is string {
  if (typeof secret !== 'string') return false;
  // Fast length check (for ASCII, length === byteLength)
  if (secret.length < MIN_SECRET_BYTES || secret.length > MAX_SECRET_BYTES) return false;
  if (!SECRET_REGEX.test(secret)) return false;
  // Strict byteLength verification against UTF-8
  if (Buffer.byteLength(secret, 'utf8') !== secret.length) return false;
  return true;
}

/**
 * Hardened secret comparison for Express backend.
 * Validates inputs first, then performs constant-time comparison on SHA-256 digests.
 */
export function safeCompareNode(supplied: unknown, expected: unknown): boolean {
  // Phase 1: Validation phase (Variable Time: Early rejection of invalid shapes)
  if (!isValidSecretShapeNode(supplied)) return false;
  if (!isValidSecretShapeNode(expected)) return false;

  // Phase 2: Digest generation (Guaranteed 32-byte fixed buffers)
  const hashSupplied = crypto.createHash('sha256').update(supplied, 'utf8').digest();
  const hashExpected = crypto.createHash('sha256').update(expected, 'utf8').digest();

  // Phase 3: Constant-time comparison (Strictly Constant-Time across 32 bytes)
  return crypto.timingSafeEqual(hashSupplied, hashExpected);
}
```

---

## 3. Cloudflare Worker Implementation (`src/worker/utils/crypto.ts`)

```typescript
// Strict ASCII base64url and hex allowlist bounds
export const MIN_SECRET_BYTES = 32;
export const MAX_SECRET_BYTES = 128;
export const SECRET_REGEX = /^[A-Za-z0-9_-]{32,128}$/;

/**
 * Validates configured environment secrets at Worker isolate boot.
 * Throws a fatal configuration error if missing, empty, or malformed.
 */
export function validateConfiguredSecretWorker(secret: unknown, secretName = 'SECRET'): string {
  if (typeof secret !== 'string') {
    throw new Error(`[STROOM Config Fatal] ${secretName} must be a string, got ${typeof secret}`);
  }
  const byteLen = new TextEncoder().encode(secret).byteLength;
  if (byteLen < MIN_SECRET_BYTES || byteLen > MAX_SECRET_BYTES) {
    throw new Error(
      `[STROOM Config Fatal] ${secretName} byte length (${byteLen}) outside allowed bounds [${MIN_SECRET_BYTES}, ${MAX_SECRET_BYTES}]`
    );
  }
  if (!SECRET_REGEX.test(secret)) {
    throw new Error(
      `[STROOM Config Fatal] ${secretName} contains invalid characters. Must be 32-128 ASCII [A-Za-z0-9_-]`
    );
  }
  return secret;
}

/**
 * Validates secret shape for incoming HTTP headers.
 * Never throws; returns false in O(1) time on any validation failure.
 */
export function isValidSecretShapeWorker(secret: unknown): secret is string {
  if (typeof secret !== 'string') return false;
  if (secret.length < MIN_SECRET_BYTES || secret.length > MAX_SECRET_BYTES) return false;
  if (!SECRET_REGEX.test(secret)) return false;
  if (new TextEncoder().encode(secret).byteLength !== secret.length) return false;
  return true;
}

/**
 * Hardened secret comparison for Cloudflare Worker edge proxy.
 * Validates inputs first, then performs constant-time comparison on SHA-256 digests.
 */
export async function safeCompareWorker(supplied: unknown, expected: unknown): Promise<boolean> {
  // Phase 1: Validation phase (Variable Time: Early rejection of invalid shapes)
  if (!isValidSecretShapeWorker(supplied)) return false;
  if (!isValidSecretShapeWorker(expected)) return false;

  // Phase 2: Digest generation (Guaranteed 32-byte fixed buffers)
  const enc = new TextEncoder();
  const [hashSupplied, hashExpected] = await Promise.all([
    crypto.subtle.digest('SHA-256', enc.encode(supplied)),
    crypto.subtle.digest('SHA-256', enc.encode(expected)),
  ]);

  // Phase 3: Constant-time comparison (Strictly Constant-Time via workerd extension)
  return crypto.subtle.timingSafeEqual(hashSupplied, hashExpected);
}
```

---

## 4. Semantic Parity and Failure Invariants

Both implementations guarantee identical behavioral semantics:

| Scenario | Input Condition | Node.js Express Behavior | Cloudflare Worker Behavior |
| :--- | :--- | :--- | :--- |
| **Startup Check** | Expected secret missing or empty | Throws `[STROOM Config Fatal]` | Throws `[STROOM Config Fatal]` |
| **Startup Check** | Expected secret $< 32$ or $> 128$ bytes | Throws `[STROOM Config Fatal]` | Throws `[STROOM Config Fatal]` |
| **Startup Check** | Expected secret contains Unicode/symbols | Throws `[STROOM Config Fatal]` | Throws `[STROOM Config Fatal]` |
| **Runtime Request** | Missing / non-string supplied secret | Returns `false` ($O(1)$, no hash) | Returns `false` ($O(1)$, no hash) |
| **Runtime Request** | Empty supplied secret (`""`) | Returns `false` ($O(1)$, no hash) | Returns `false` ($O(1)$, no hash) |
| **Runtime Request** | Both secrets empty (`"" vs ""`) | Returns `false` (Never authenticates) | Returns `false` (Never authenticates) |
| **Runtime Request** | Supplied $< 32$ or $> 128$ bytes | Returns `false` ($O(1)$, no hash) | Returns `false` ($O(1)$, no hash) |
| **Runtime Request** | Oversized input (e.g. 100k chars) | Returns `false` ($O(1)$, DoS blocked) | Returns `false` ($O(1)$, DoS blocked) |
| **Runtime Request** | Malformed UTF-16 / lone surrogate | Returns `false` ($O(1)$, no hash) | Returns `false` ($O(1)$, no hash) |
| **Runtime Request** | Valid secrets, unequal values | Returns `false` (Constant-Time $O(32)$) | Returns `false` (Constant-Time $O(32)$) |
| **Runtime Request** | Valid matching secrets | Returns `true` (Constant-Time $O(32)$) | Returns `true` (Constant-Time $O(32)$) |
| **Runtime Exceptions** | Unequal buffer lengths | **NEVER THROWS** (Guaranteed 32B) | **NEVER THROWS** (Guaranteed 32B) |
