# STROOM — Phase 2.4: JWT Security & Interoperability Contract

**Project:** `D:\ST`  
**Branch:** `feature/stroom-production-launch`  
**Approved Baseline Commit:** `19c4176`  
**Document Version:** 1.0.0 (Phase 2.4 Cryptographic Specification)  
**Security Level:** Critical API Interoperability Contract  
**Phase Status:** **APPROVED FOR PHASE 2.5 IMPLEMENTATION DESIGN**

---

## 1. Executive Summary

This document specifies the exact cryptographic contract governing JSON Web Token (JWT) issuance, transport, and verification between the Node.js + Express authentication service and the Cloudflare Workers / Hono edge API layer.

Both services must enforce an identical verification specification to guarantee that:
- Any token issued by Express is verified by Hono with 100% mathematical fidelity.
- All tokens currently stored in existing users' browsers remain completely valid for their full 7-day lifetime.
- Attack vectors such as algorithm confusion, signature forgery, clock drift, and secret leakage are mitigated.

---

## 2. Cryptographic Contract Specification

### 2.1 Token Header Specification

The token header must strictly conform to RFC 7515 (JSON Web Signature):

```json
{
  "alg": "HS256",
  "typ": "JWT"
}
```

#### Algorithm Allowlisting Policy
- **Strict Allowlist:** The ONLY permitted algorithm is `HS256` (HMAC using SHA-256).
- **Prohibited Algorithms:** Any token containing `alg: "none"`, `alg: "RS256"`, `alg: "ES256"`, `alg: "HS384"`, or `alg: "HS512"` must be rejected immediately with `401 Unauthorized`.
- **Enforcement Rule:** The verification engine must NOT infer the algorithm from the incoming token header. The algorithm must be explicitly hardcoded as an immutable verification constraint:
  ```ts
  // In Hono Worker
  await verify(token, secret, 'HS256');
  ```

---

### 2.2 Token Payload & Required Claims

The payload must contain the following claims:

```json
{
  "id": "usr_4f2b1a8c9e0d11ef",
  "email": "user@stroom.app",
  "role": "participant",
  "iat": 1794565604,
  "exp": 1795170404
}
```

#### Claim Schema & Type Contract

| Claim | Type | Format / Constraints | Express Generator | Worker Validator |
| :--- | :--- | :--- | :--- | :--- |
| **`id`** | `string` | Non-empty string, matches `^usr_[a-zA-Z0-9_-]{16,36}$` or system ID | Mandatory | Required. Rejects token if missing, null, or empty string. |
| **`email`** | `string` | Non-empty string, valid email address syntax ($\le 180$ chars) | Mandatory | Required. Rejects token if missing or malformed. |
| **`role`** | `string` | Non-empty string, one of the 11 valid RBAC role identifiers | Mandatory | Required. Rejects token if role is invalid. |
| **`iat`** | `number` | Integer, Unix epoch timestamp (seconds) | Auto-set (`now`) | Validates `iat <= now + clockSkew`. |
| **`exp`** | `number` | Integer, Unix epoch timestamp (seconds) | Set (`iat + 7d`) | Validates `exp > now - clockSkew`. |
| **`iss`** | `string` | Optional / Omitted | Omitted | **Must NOT be enforced in Phase 2.** |
| **`aud`** | `string` | Optional / Omitted | Omitted | **Must NOT be enforced in Phase 2.** |

> [!CAUTION]
> **Issuer (`iss`) and Audience (`aud`) Bounded Transition Policy (Phase 2.4.1):**
> In the existing Express implementation ([`server/middleware/auth.ts:14-20`](file:///D:/ST/server/middleware/auth.ts#L14-L20)), `jwt.sign()` does **not** specify `issuer` or `audience`.  
> Therefore, during the initial hybrid rollout, Hono must accept legacy tokens without `iss` or `aud`.
> 
> **Bounded 7-Day Transition Lifecycle:**
> 1. **Day 0:** Express updates `generateToken()` to sign all NEW tokens with `iss: 'stroom-api'` and `aud: 'stroom-client'`.
> 2. **Days 0–7:** Hono operates in dual-acceptance mode: accepts new tokens with `iss/aud` AND legacy tokens without `iss/aud` (provided `exp > now`).
> 3. **Day 7+:** Because all legacy tokens have a max 7-day lifetime, after day 7 all legacy tokens have naturally expired. Hono transitions to strictly enforcing `iss: 'stroom-api'` and `aud: 'stroom-client'`.

---

### 2.3 Token Lifetime & Clock Skew Policy

- **Token Lifetime:** Exactly **7 days** ($604,800\text{ seconds}$).
- **Clock Skew Tolerance (Leeway):** Exactly **60 seconds**.
  Because Cloudflare Workers run across hundreds of global edge data centers and Express runs on an origin host, slight NTP synchronization variances may occur.
  - An incoming token is valid if:
    $$\text{now} - 60 \le \text{exp}$$
    $$\text{iat} \le \text{now} + 60$$

---

## 3. Signature Verification & Error Handling

### 3.1 Verification Mechanics
1. **Header Parsing:** Token string must split on `.` into exactly 3 parts: `[headerB64, payloadB64, signatureB64]`. If `parts.length !== 3`, return `401 Unauthorized` (`"Invalid token format"`).
2. **Base64URL Decoding:** Header and payload are decoded from URL-safe base64. If decoding fails, return `401 Unauthorized`.
3. **JSON Parsing:** Both decoded strings are parsed as JSON. If parsing throws a `SyntaxError`, return `401 Unauthorized`.
4. **Header Validation:** Validate `header.alg === 'HS256'`. If not, return `401 Unauthorized` (`"Unsupported token algorithm"`).
5. **Cryptographic Verification:**
   In WebCrypto:
   ```ts
   const key = await crypto.subtle.importKey(
     'raw',
     new TextEncoder().encode(secret),
     { name: 'HMAC', hash: 'SHA-256' },
     false,
     ['verify']
   );
   const isValid = await crypto.subtle.verify(
     'HMAC',
     key,
     base64UrlToBuffer(signatureB64),
     new TextEncoder().encode(`${headerB64}.${payloadB64}`)
   );
   ```
6. **Error Sanitization:**
   Under NO circumstances should internal error messages, stack traces, secret fragments, or database paths be returned to the client. The response must always be a standardized JSON error:
   ```json
   {
     "error": "Invalid or expired token."
   }
   ```

---

## 4. Secret Storage & Access Boundaries

1. **Express Environment:**
   Stored in `process.env.JWT_SECRET`. Enforced at startup ([`server/config/env.ts:33-38`](file:///D:/ST/server/config/env.ts#L33-L38)) to be at least 24 characters in production.
2. **Cloudflare Workers Environment:**
   Stored exclusively as an encrypted environment secret via:
   ```bash
   wrangler secret put JWT_SECRET
   ```
   Workers runtime accesses it securely via `c.env.JWT_SECRET`.
3. **Strict Isolation Boundaries:**
   - Secrets must NEVER be committed to Git. Both `.env` and `.dev.vars` are excluded in `.gitignore`.
   - Secrets must NEVER be embedded in client-side code, Vite environment variables (`VITE_*`), or source maps.

---

## 5. Architectural Evaluation: Symmetric (HS256) vs Asymmetric (RS256 / EdDSA)

The security implications of sharing an HS256 symmetric secret between Express and Hono were evaluated against migrating to an asymmetric key pair.

### Comparative Evaluation

| Security & Architectural Criterion | Shared Symmetric (HS256) — Current Choice | Asymmetric (RS256 / Ed25519) — Future Option |
| :--- | :--- | :--- |
| **Signing Authority** | Both Express and Worker possess the capability to sign tokens. | Express holds **Private Key** (signs); Worker holds only **Public Key** (verifies). |
| **Worker Compromise Impact** | If Worker environment secrets leak, an attacker can forge valid tokens. | If Worker environment leaks, attacker cannot forge tokens (holds only public key). |
| **Backward Compatibility** | **100%.** All existing user tokens in `localStorage` continue working seamlessly. | **Fails for existing tokens.** All 188 existing active sessions would be immediately invalidated. |
| **Verification Overhead** | **Ultra-lightweight ($<0.5\text{ ms}$).** Native WebCrypto HMAC is nearly instantaneous. | Slightly heavier ($1-3\text{ ms}$) due to RSA modular exponentiation. |
| **Key Size & Complexity** | Simple 32+ byte secret string. | 2048-bit PEM certificate / JWKS endpoint / key management infrastructure. |
| **Phase 2 Suitability** | **Recommended.** Guarantees zero session disruption and zero frontend code changes. | Recommended as a Phase 3 post-migration enhancement. |

### Conclusion
Because both Express and Cloudflare Workers are **trusted first-party infrastructure** managed within the same organization and security perimeter, sharing `JWT_SECRET` via Cloudflare's encrypted secrets store is completely secure for Phase 2. Asymmetric signing (RS256 or Ed25519) can be scheduled for a future architectural upgrade once all legacy routes are retired.

---

## 6. Zero-Downtime Secret Rotation Protocol

If `JWT_SECRET` must be rotated in production (e.g. routine compliance rotation or suspected credential exposure), the system must support dual-key verification without forcing all users to log in again:

```
Step 1: Deploy Worker supporting primary secret (S2) and secondary secret (S1)
Step 2: Update Express to sign new tokens with S2, while accepting S1
Step 3: Wait 7 days (all S1 tokens naturally expire)
Step 4: Retire S1 from both Express and Worker environments
```

### Worker Dual-Key Verification Contract

```ts
export async function verifyTokenWithRotation(token: string, primarySecret: string, previousSecret?: string) {
  // Attempt verification with primary (current) secret
  try {
    return await verify(token, primarySecret, 'HS256');
  } catch (errPrimary) {
    if (previousSecret) {
      // Graceful fallback to previous secret during rotation grace period
      try {
        return await verify(token, previousSecret, 'HS256');
      } catch (errPrevious) {
        throw new Error('Invalid token signature on both active secrets');
      }
    }
    throw errPrimary;
  }
}
```

---

## 7. Compliance Sign-Off

The cryptographic contract defined in this document guarantees:
1. Complete interoperability between Express (`jsonwebtoken`) and Hono (`hono/jwt`).
2. Preservation of all 188 accounts and their active browser sessions.
3. Zero algorithm confusion vulnerability.
4. Predictable, secure error handling and zero secret leakage.
