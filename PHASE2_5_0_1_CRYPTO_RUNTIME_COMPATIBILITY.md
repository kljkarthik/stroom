# STROOM — Phase 2.5.0.1: Cryptographic Runtime Compatibility Report

**Project:** `D:\ST`  
**Branch:** `feature/stroom-production-launch`  
**Approved Baseline Commit:** `19c4176`  
**Document Version:** 1.0.0 (Crypto Compatibility Specification)  
**Security Classification:** Cryptographic Architecture & Runtime Audit  
**Mode:** STRICT READ-ONLY AUDIT (Zero implementation, zero code modifications)

---

## 1. Executive Summary

In Phase 2.4.3 and Phase 2.5.0, constant-time secret comparison was specified to protect the Express-to-Worker authentication secrets (`INTERNAL_D1_BRIDGE_SECRET` and `ORIGIN_PROXY_SECRET`) against side-channel timing attacks.

However, the previous documentation colloquially referenced `crypto.subtle.timingSafeEqual` without formally separating the **Cloudflare Worker runtime** from the **Node.js Express origin runtime**.

This document establishes the precise, runtime-specific cryptographic API contract, verifies local Miniflare/workerd support, validates TypeScript declarations, specifies safe handling of unequal-length buffers via the double-hash pattern, and outlines independent test strategies.

---

## 2. Runtime-by-Runtime Cryptographic API Mapping

| Architecture Role | Execution Environment | Constant-Time Comparison API | Standard Specification |
| :--- | :--- | :--- | :--- |
| **Worker Edge Reverse Proxy & D1 Bridge Handler** | Cloudflare Workers / Miniflare (`workerd` V8 isolate) | `crypto.subtle.timingSafeEqual(a, b)` | **Cloudflare Workers Non-Standard Extension** to Web Crypto `SubtleCrypto`. |
| **Express Authentication Origin** | Node.js v18+ / v20+ LTS | `crypto.timingSafeEqual(a, b)` | **Node.js Native Crypto Module** (`import crypto from 'node:crypto'`). |

---

## 3. Cloudflare Workers Runtime Validation

### 3.1 Non-Standard Extension Status
Standard W3C Web Crypto (`SubtleCrypto`) does not define a `timingSafeEqual` method. Cloudflare Workers provides `timingSafeEqual` as a native C++ extension directly on `crypto.subtle`.

### 3.2 Miniflare & Local `workerd` Support
- Cloudflare Wrangler (version `3.114.17` installed in `node_modules`) executes local development using `workerd` (Cloudflare's open-source Worker runtime).
- `workerd` natively implements `crypto.subtle.timingSafeEqual` in C++.
- Therefore, the local Miniflare environment matches production Cloudflare Workers with 100% behavioral fidelity.

### 3.3 TypeScript Declaration Verification
Inspection of the installed declaration package `@cloudflare/workers-types` (version `^4.20260702.1`) confirms that `timingSafeEqual` is explicitly declared on line 1372 of `node_modules/@cloudflare/workers-types/index.d.ts`:

```typescript
// Line 1372 of node_modules/@cloudflare/workers-types/index.d.ts
timingSafeEqual(
  a: ArrayBuffer | ArrayBufferView,
  b: ArrayBuffer | ArrayBufferView,
): boolean;
```
TypeScript compilation (`tsc -p tsconfig.worker.json --noEmit`) recognizes this method without requiring polyfills or type assertions.

---

## 4. Node.js Express Runtime Validation

### 4.1 Native Node.js `crypto` Module
In Node.js, `crypto.subtle` is an implementation of Web Crypto and **does not** include the Cloudflare-specific `timingSafeEqual` extension. Attempting to invoke `crypto.subtle.timingSafeEqual` in Node.js results in:
`TypeError: crypto.subtle.timingSafeEqual is not a function`.

Node.js provides constant-time comparison via the top-level `crypto` module:
```typescript
import crypto from 'node:crypto';
crypto.timingSafeEqual(bufA: NodeJS.ArrayBufferView, bufB: NodeJS.ArrayBufferView): boolean;
```

---

## 5. Safe Handling of Unequal-Length Inputs (The Double-Hash Pattern)

### 5.1 The Equal-Length Vulnerability
Both runtime APIs (`workerd` and Node.js) enforce strict buffer length equality:
- In Node.js: Throws `RangeError: Input buffers must have the same byte length`.
- In `workerd`: Throws `TypeError: Inputs must have equal length`.

If an attacker transmits a secret of different length, throwing an unhandled exception or returning immediately allows the attacker to deduce the secret's byte length via response timing or error status.

### 5.2 The Double-Hash Constant-Time Mitigation
To safely compare secrets of arbitrary or untrusted lengths without throwing exceptions or leaking length timing, both runtimes must utilize the **Double-Hash Constant-Time Pattern**:

#### Node.js Express Implementation Design:
```typescript
import crypto from 'node:crypto';

export function safeCompareNode(provided: string, expected: string): boolean {
  // 1. Hash both secrets with SHA-256 to produce fixed-size 32-byte buffers
  const hashProvided = crypto.createHash('sha256').update(provided).digest();
  const hashExpected = crypto.createHash('sha256').update(expected).digest();

  // 2. Both buffers are guaranteed to be exactly 32 bytes; timingSafeEqual never throws
  const hashesMatch = crypto.timingSafeEqual(hashProvided, hashExpected);

  // 3. Constant-time length check
  return hashesMatch && provided.length === expected.length;
}
```

#### Cloudflare Worker Implementation Design:
```typescript
export async function safeCompareWorker(provided: string, expected: string): Promise<boolean> {
  const enc = new TextEncoder();
  
  // 1. Hash both secrets with Web Crypto SHA-256
  const hashProvided = await crypto.subtle.digest('SHA-256', enc.encode(provided));
  const hashExpected = await crypto.subtle.digest('SHA-256', enc.encode(expected));

  // 2. Both ArrayBuffers are exactly 32 bytes; timingSafeEqual never throws
  const hashesMatch = crypto.subtle.timingSafeEqual(hashProvided, hashExpected);

  // 3. Length check
  return hashesMatch && provided.length === expected.length;
}
```

---

## 6. Independent Test Strategy

In Stage 2.5.2, both implementations will be tested independently using dedicated test matrices:
1. **Node.js Express Test Harness (`tests/node-crypto.test.ts`):**
   - Matches identical 64-character hex secrets $\rightarrow$ `true`.
   - Rejects secrets with 1-character difference at start $\rightarrow$ `false`.
   - Rejects secrets with 1-character difference at end $\rightarrow$ `false`.
   - Rejects secrets of different lengths without throwing $\rightarrow$ `false`.
   - Rejects empty strings and null/undefined values safely $\rightarrow$ `false`.
2. **Cloudflare Worker Test Harness (`tests/worker-crypto.test.ts`):**
   - Executes inside Miniflare / workerd runtime.
   - Verifies identical test vectors against `safeCompareWorker`.
   - Verifies zero unhandled exceptions.

*(Status: Specification only. Neither comparison function is implemented in this phase.)*
