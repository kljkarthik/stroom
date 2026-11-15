# STROOM — Phase 2.5.1.0.4: Canonical Base64URL Validation Specification

**Project:** `D:\ST`  
**Branch:** `feature/stroom-production-launch`  
**Approved Baseline Commit:** `19c4176`  
**Document Version:** 1.0.0 (Base64URL Non-Malleability & Canonical Invariant)  
**Security Classification:** Cryptographic Encoding & Malleability Defense  
**Mode:** STRICT READ-ONLY SPECIFICATION (Zero code changes, zero database mutations)  
**Date:** November 14, 2026  

---

## 1. The Non-Canonical Base64URL Malleability Vulnerability

When binary data is encoded into Base64 or Base64URL, bits are grouped into 6-bit units. For a 32-byte (256-bit) secret:
- The first 42 characters encode $42 \times 6 = 252$ bits.
- The remaining $256 - 252 = \mathbf{4 \text{ bits}}$ are encoded in the 43rd character.
- Because each Base64URL character represents 6 bits, the 43rd character contains:
  $$\underbrace{b_3 \quad b_2 \quad b_1 \quad b_0}_{\text{Payload Bits}} \quad \underbrace{p_1 \quad p_0}_{\text{Padding Bits}}$$
- In **canonical Base64URL**, the two padding bits ($p_1, p_0$) **MUST BE ZERO** (`00`).

### The Malleability Risk
Standard Base64 decoders discard the unused padding bits $p_1, p_0$ during decoding. Consequently, an attacker can modify the 43rd character by setting $p_1, p_0$ to `01`, `10`, or `11`:
$$\begin{aligned}
S_{\text{canonical}} &= \text{HA2LXuQJDfZffAsMHV\_qpwUIwXMQn1vVfUj4ydReTI}\mathbf{8} \quad (\text{Index } 60 = 1111\mathbf{00}_2) \\
S_{\text{non-canonical}} &= \text{HA2LXuQJDfZffAsMHV\_qpwUIwXMQn1vVfUj4ydReTI}\mathbf{9} \quad (\text{Index } 61 = 1111\mathbf{01}_2)
\end{aligned}$$
Both strings decode to the **identical 32 raw bytes**!
If an application normalizes or decodes before comparing, it accepts non-canonical aliases. In cryptographic protocol design, allowing multiple representations of a single credential introduces signature malleability, token aliasing, and cache-poisoning vulnerabilities.

---

## 2. Decode-and-Re-Encode Canonical Invariant

To guarantee absolute non-malleability, both the configured environment secret and all incoming request secrets must satisfy the **Decode-and-Re-Encode Equality Invariant**:

$$\text{isCanonical}(S) \iff \text{length}(S) = 43 \ \land \ \forall c \in S, \ c \in \text{B64URL} \ \land \ \text{encode}(\text{decode}(S)) \equiv S$$

### Mathematical Proof of Detection
1. If $S$ contains non-zero padding bits ($p_1 p_0 \neq 00$), standard decoding strips $p_1 p_0$, producing the 32 raw bytes.
2. Canonical re-encoding of those 32 raw bytes forces the two padding bits to `00`.
3. The re-encoded 43rd character differs from the original 43rd character ($S_{\text{re-encoded}}[42] \neq S[42]$).
4. Strict equality $\text{encode}(\text{decode}(S)) \equiv S$ evaluates to **`false`**, rejecting the non-canonical string immediately.

### Mathematical Allowlist of 43rd Characters
Because the lowest 2 bits of the 6-bit index must be `00` ($\text{index} \pmod 4 = 0$), only **16 out of the 64 Base64URL characters** can legally appear at index 42:

$$\text{Legal 43rd Characters} = \{ \text{A, E, I, M, Q, U, Y, c, g, k, o, s, w, 0, 4, 8} \}$$

Any 43-character string ending in any of the other 48 characters is mathematically non-canonical and must be rejected.

---

## 3. Production Implementations

### 3.1 Node.js Canonical Validator (`server/utils/crypto.ts`)
```typescript
import crypto from 'node:crypto';

export const EXPECTED_SECRET_LENGTH = 43;

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
```

### 3.2 Cloudflare Worker Canonical Validator (`src/worker/utils/crypto.ts`)
```typescript
export const EXPECTED_SECRET_LENGTH = 43;

export function isStrictBase64UrlCharCode(code: number): boolean {
  return (
    (code >= 65 && code <= 90) ||
    (code >= 97 && code <= 122) ||
    (code >= 48 && code <= 57) ||
    code === 95 ||
    code === 45
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
```

---

## 4. Rejection Policy: Zero Transformation Invariant

1. **Supplied Secrets Are Never Mutated**:
   - The server does **NOT** decode, fix, or re-encode incoming request secrets.
   - If a request header contains a non-canonical secret (e.g. `HA2L...9` instead of `HA2L...8`), the server evaluates `isCanonicalBase64Url32()` as `false` and rejects the request immediately with `401 Unauthorized`.
2. **Configured Secrets Fail Boot**:
   - If an administrator configures a non-canonical secret in `.env` or `wrangler secret put`, the application or Worker isolate throws `[STROOM Config Fatal]` and refuses to boot.
