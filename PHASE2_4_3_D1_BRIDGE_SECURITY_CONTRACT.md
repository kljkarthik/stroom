# STROOM — Phase 2.4.3: Express-to-D1 Bridge Security Contract

**Project:** `D:\ST`  
**Branch:** `feature/stroom-production-launch`  
**Approved Baseline Commit:** `19c4176`  
**Document Version:** 1.0.0 (Phase 2.4.3 Security Specification)  
**Security Level:** Critical Internal API Contract  
**Phase Status:** **APPROVED FOR PHASE 2.5 IMPLEMENTATION PLANNING**

---

## 1. Executive Summary & Core Security Decision

In Phase 2.4.2, a generic execute endpoint (`POST /api/internal/d1/execute`) was conceptualized for Express-to-D1 writes.

> [!CAUTION]
> **Prohibition of Arbitrary SQL Execution:**  
> Accepting dynamic SQL strings (`{ query: string, params: any[] }`) over an internal HTTP bridge creates a severe vulnerability: an injection, supply-chain flaw, or compromised secret in Express could execute arbitrary `DROP`, `DELETE`, or `SELECT` queries across the entire D1 database.
> 
> **Definitive Decision:** **Arbitrary SQL execution is strictly and permanently prohibited.**  
> The internal bridge will exclusively expose a **fixed allowlist of named, parameterized operations**. No SQL strings are ever accepted over the wire. The SQL statements are hardcoded as immutable constants inside the Worker bridge code.

---

## 2. Fixed Allowlist of Named Operations

The Worker bridge (`src/worker/routes/internalBridge.ts`) enforces the following six immutable operations:

```
[Express Request: { action: "...", params: {...} }]
                     │
                     ▼
       ┌───────────────────────────┐
       │ Action Allowlist Check    │
       └─────────────┬─────────────┘
                     │ Matches Allowlist
                     ▼
  ┌─────────────────────────────────────────────────────────────┐
  │  1. getUserForLogin      -> Fixed SELECT on users           │
  │  2. createUser           -> Fixed INSERT on users           │
  │  3. updatePasswordHash   -> Fixed UPDATE password_hash      │
  │  4. changePassword       -> Fixed UPDATE password_hash      │
  │  5. changeAccountStatus  -> Fixed UPDATE account_status     │
  │  6. updateUserRole       -> Fixed UPDATE role               │
  └─────────────────────────────────────────────────────────────┘
```

---

### 2.1 Operation Specifications

#### 1. `getUserForLogin`
- **Purpose:** Express fetches user credentials and status to verify password during login.
- **Fixed Prepared SQL:**
  ```sql
  SELECT id, email, password_hash, full_name, avatar_url, role, account_status, onboarding_status, created_at, updated_at 
  FROM users 
  WHERE lower(email) = lower(?)
  ```
- **Permitted Parameters:** `{ email: string }` (Length: 1–180 chars, valid email syntax).
- **Response Structure:** `{ success: true, user: UserRecord | null }`.

#### 2. `createUser`
- **Purpose:** Express inserts a newly registered user after scrypt hashing.
- **Fixed Prepared SQL:**
  ```sql
  INSERT INTO users (id, email, password_hash, full_name, avatar_url, role, onboarding_status, created_at, updated_at)
  VALUES (?, lower(?), ?, ?, ?, 'user', 'NOT_STARTED', datetime('now'), datetime('now'))
  ```
- **Permitted Parameters:**
  - `id`: string (Format: `^usr_[a-zA-Z0-9]{16}$`)
  - `email`: string (Valid email, 1–180 chars)
  - `password_hash`: string (Format: `^scrypt\$[0-9a-f]{32}\$[0-9a-f]{128}$`)
  - `full_name`: string (2–120 chars)
  - `avatar_url`: string (Valid safe HTTP/HTTPS URL $\le 2048$ chars)
- **Response Structure:** `{ success: true, userId: string }`.

#### 3. `updatePasswordHash`
- **Purpose:** Express transparently updates a legacy SHA-256 hash to per-user salted scrypt upon successful login.
- **Fixed Prepared SQL:**
  ```sql
  UPDATE users 
  SET password_hash = ?, updated_at = datetime('now') 
  WHERE id = ? AND account_status != 'suspended'
  ```
- **Permitted Parameters:**
  - `id`: string (Valid user ID)
  - `password_hash`: string (Valid scrypt format)
- **Response Structure:** `{ success: true, rowsUpdated: number }`.

#### 4. `changePassword`
- **Purpose:** User updates password via `POST /api/users/me/change-password`.
- **Fixed Prepared SQL:**
  ```sql
  UPDATE users 
  SET password_hash = ?, updated_at = datetime('now') 
  WHERE id = ? AND account_status != 'suspended'
  ```
- **Permitted Parameters:**
  - `id`: string
  - `password_hash`: string (Valid scrypt format)
- **Response Structure:** `{ success: true, rowsUpdated: number }`.

#### 5. `changeAccountStatus`
- **Purpose:** Administrator suspends, deactivates, or activates an account.
- **Fixed Prepared SQL:**
  ```sql
  UPDATE users 
  SET account_status = ?, updated_at = datetime('now') 
  WHERE id = ?
  ```
- **Permitted Parameters:**
  - `id`: string
  - `account_status`: string (Must strictly be one of `'active'`, `'suspended'`, `'deactivated'`)
- **Response Structure:** `{ success: true, rowsUpdated: number }`.

#### 6. `updateUserRole`
- **Purpose:** Administrator assigns or updates an RBAC role.
- **Fixed Prepared SQL:**
  ```sql
  UPDATE users 
  SET role = ?, updated_at = datetime('now') 
  WHERE id = ?
  ```
- **Permitted Parameters:**
  - `id`: string
  - `role`: string (Must strictly match one of the 11 valid RBAC role identifiers)
- **Response Structure:** `{ success: true, rowsUpdated: number }`.

---

## 3. Cryptographic Authentication & Access Isolation

### 3.1 Separate Cryptographic Secrets
To prevent privilege confusion, two completely distinct cryptographic keys are enforced:

| Secret Identifier | Environment Variable | Minimum Entropy | Direction / Usage |
| :--- | :--- | :--- | :--- |
| **D1 Internal Bridge Secret** | `INTERNAL_D1_BRIDGE_SECRET` | 64-char Hex (256-bit) | **Express $\rightarrow$ Worker:** Express authenticates to Worker bridge endpoint. |
| **Origin Proxy Secret** | `ORIGIN_PROXY_SECRET` | 64-char Hex (256-bit) | **Worker $\rightarrow$ Express:** Worker authenticates to Express when proxying `/auth/*`. |

Under no circumstances may these two secrets share the same value.

### 3.2 Constant-Time Comparison
The Worker validates the incoming bridge secret using constant-time evaluation to prevent timing side-channel attacks:

```ts
function timingSafeCheck(headerValue: string | undefined, expectedSecret: string): boolean {
  if (!headerValue || headerValue.length !== expectedSecret.length) {
    return false;
  }
  const a = new TextEncoder().encode(headerValue);
  const b = new TextEncoder().encode(expectedSecret);
  return crypto.subtle.timingSafeEqual(a, b);
}
```

---

## 4. Operational Hardening: Rate Limiting, Replay & Redaction

### 4.1 Anti-Replay Contract
Every internal request from Express must include:
1. `X-Internal-Timestamp`: Unix epoch milliseconds. Requests where `|now - timestamp| > 30,000 ms` are rejected with `401 Unauthorized` (`"Internal request timestamp expired"`).
2. `X-Internal-Nonce`: Random 16-byte hex UUID generated per request.

### 4.2 Rate Limiting
The Worker bridge endpoint enforces an internal sliding-window rate limit: **max 120 requests / minute**. Sustained spikes trigger `429 Too Many Requests`.

### 4.3 Logging & Sensitive Field Redaction
Worker logging middleware must explicitly redact sensitive fields:
- `password_hash` is unconditionally masked as `[REDACTED_HASH]`.
- User `email` is masked as `a***@example.com`.
- No raw passwords, hashes, or secrets are ever written to `wrangler tail` or edge console output.

---

## 5. Failure Handling & Retry Policy

| Operation | Transient Failure Handling | Max Retries | Backoff Strategy | Rollback Action |
| :--- | :--- | :---: | :--- | :--- |
| **`createUser`** | Network timeout / D1 busy | 2 | Exponential (100ms, 250ms) | **Aborts.** Zero JWT issued. Returns 503 to client. |
| **`updatePasswordHash`** | Transient D1 write error | 1 | 200ms | **Fails softly.** Login succeeds. Hash retried on next login. |
| **`changePassword`** | Transient D1 write error | 2 | Exponential (100ms, 250ms) | **Aborts.** Password unchanged. Returns 503 to client. |
| **`getUserForLogin`** | Transient D1 read error | 2 | Exponential (50ms, 150ms) | Returns 503 ("Auth service temporarily unreachable"). |
