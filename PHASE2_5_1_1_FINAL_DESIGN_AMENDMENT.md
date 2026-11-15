# STROOM — Phase 2.5.1.1: Final Architectural Design Amendment

**Project:** `D:\ST`  
**Current Branch:** `feature/stroom-production-launch`  
**Verified Baseline HEAD:** `19c4176b87094a6ba7b81ffec7a01b72796c08ec`  
**Document Version:** 1.0.0 (Authoritative Design Amendment & Implementation Standard)  
**Security Classification:** Core Cryptographic Architecture & Implementation Specification  
**Mode:** STRICT READ-ONLY DESIGN AMENDMENT (Zero application code modified, zero databases mutated)  
**Date:** November 14, 2026  

---

## 1. Executive Summary & Purpose of Amendment

This amendment establishes the authoritative, binding architectural and cryptographic specification for Phase 2.5.1.1. It builds upon `PHASE2_5_1_1_DESIGN_CORRECTION.md` and `PHASE2_5_1_1_FINAL_DESIGN_APPROVAL.md` by resolving all eight remaining technical refinements:

1. **Atomic D1 Batch Selection:** Codifies atomic `env.DB.batch([nonceStmt, businessStmt])` as the single execution model for replay protection and database operations on Cloudflare D1.
2. **Replication & Consistency Demarcation:** Accurately distinguishes Cloudflare D1's single primary geographic writer from asynchronous edge read replication.
3. **Action-by-Action Retry & Idempotency Analysis:** Defines the precise failure, retry, and idempotency guarantees for all six operations.
4. **Privileged Actor Authorization & Origin Context Binding:** Establishes that the bridge secret authenticates the transport channel only; privileged user operations require verified origin session extraction and HMAC-sealed actor context.
5. **Feature-Flag Isolation:** Enforces `ENABLE_D1_AUTH_BRIDGE=false` by default, preserving existing SQLite behavior while guaranteeing fail-closed startup validation if misconfigured.
6. **Bit-for-Bit Raw Wire Byte Signing:** Eliminates JSON reserialization divergence by signing and verifying the exact HTTP raw body bytes.
7. **Strict Implementation Boundary:** Partitions files into immediate Phase 2.5.1.1 deliverables versus deferred production migration components.
8. **Comprehensive Local Test & Safety Plan:** Specifies the 13 local failure, concurrency, and regression test suites executed against disposable databases.

---

## 2. D1 Nonce & Transaction Design: Atomic Batch Architecture

### 2.1 Single Implementation Selection: Atomic D1 Batch
To guarantee that replay protection and business operations remain strictly consistent, STROOM adopts **Atomic D1 Batch Execution** (`env.DB.batch(...)`) as the sole implementation model.

Cloudflare D1 executes all prepared statements supplied to `env.DB.batch([stmt1, stmt2])` sequentially within an **implicit transactional boundary** (`BEGIN TRANSACTION ... COMMIT`).

```
                              [Incoming D1 Bridge Request]
                                           │
                                           ▼
                       ┌───────────────────────────────────────┐
                       │ 1. Validate Timestamp Freshness       │
                       │    |now - timestamp| <= 30,000 ms     │
                       └───────────────────┬───────────────────┘
                                           │ Passed
                                           ▼
                       ┌───────────────────────────────────────┐
                       │ 2. Verify HMAC-SHA256 Signature       │
                       │    Over (time:nonce:action:bodyHash)  │
                       └───────────────────┬───────────────────┘
                                           │ Passed
                                           ▼
             ┌───────────────────────────────────────────────────────────┐
             │ 3. Execute Atomic D1 Transaction: env.DB.batch([          │
             │      stmt1: INSERT INTO _internal_bridge_nonces ...,      │
             │      stmt2: Execute Approved Business Action SQL          │
             │    ])                                                     │
             └─────────────────────────────┬─────────────────────────────┘
                                           │
               ┌───────────────────────────┴───────────────────────────┐
               │                                                       │
               ▼ Batch Succeeds                                        ▼ Batch Fails
┌───────────────────────────────┐                       ┌───────────────────────────────────────┐
│ Both Nonce & Operation Commit │                       │ Entire Transaction Rolls Back         │
│ • Returns 200/201 Success     │                       │ • If Nonce Duplicate: 409 Conflict    │
└───────────────────────────────┘                       │ • If Business Error: Safe Mapped Code │
                                                        │ • If D1 Down: 503 Service Unavailable │
                                                        └───────────────────────────────────────┘
```

### 2.2 Execution Failure & Rollback Mechanics
1. **Case A: Statement 1 (Nonce Insertion) Fails:**
   - If an attacker or network duplicate submits an identical `nonce`, D1 throws `SQLITE_CONSTRAINT_PRIMARYKEY` on statement 1.
   - The batch aborts immediately; statement 2 **never executes**.
   - Cloudflare D1 rolls back the transaction. The Worker catches the constraint violation and returns **HTTP 409 Conflict ("Replay detected")**.
2. **Case B: Statement 2 (Business Mutation) Fails:**
   - Example: `createUser` is called with an email that already exists in D1 `users`. Statement 2 triggers `SQLITE_CONSTRAINT_UNIQUE: UNIQUE constraint failed: users.email`.
   - Because both statements execute inside the same batch transaction, **D1 rolls back statement 1 as well!**
   - The nonce is **not consumed**, and the database state remains pristine. The Worker returns `{ success: false, error: 'User already exists', code: 'USER_EXISTS' }` (which Express maps to `409 Conflict`).
3. **Case C: D1 Infrastructure Unavailability:**
   - If D1 is unreachable, timing out, or experiencing storage faults, the Worker **strictly fails closed**.
   - It returns **HTTP 503 Service Unavailable ("Anti-replay storage unavailable")**. Zero business operations proceed.

### 2.3 Nonce Schema & Unique Constraints
Nonces are tracked in Cloudflare D1 in the dedicated bookkeeping table:

```sql
CREATE TABLE IF NOT EXISTS _internal_bridge_nonces (
  nonce TEXT PRIMARY KEY,
  request_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_nonces_expires ON _internal_bridge_nonces(expires_at);
```

- **`nonce TEXT PRIMARY KEY`:** Guarantees uniqueness at the SQLite B-Tree engine level.
- **`request_hash TEXT NOT NULL`:** Contains the SHA-256 digest of the request payload, binding the nonce to the exact body bytes.
- **`created_at INTEGER NOT NULL`:** Epoch timestamp in seconds when consumed.
- **`expires_at INTEGER NOT NULL`:** Epoch timestamp in seconds when the nonce record may be safely purged (`created_at + 60`).

### 2.4 Timestamp Validation, Clock Skew & Expiry Cleanup Boundary
1. **Timestamp Window ($\pm 30$ seconds):**
   - Express supplies integer millisecond epoch in `X-Internal-Timestamp`.
   - Worker checks: $|now - \text{timestamp}| \le 30,000\text{ ms}$.
   - Accommodates up to $\pm 30$ seconds of network latency and legitimate NTP clock skew between server hosts.
   - Any request generated $> 30$ seconds in the past or $> 30$ seconds in the future is rejected with **HTTP 401 Unauthorized ("Timestamp drift exceeded")** without touching D1.
2. **Nonce TTL (60 seconds):**
   - `expires_at = unixepoch() + 60`.
   - Opportunistic cleanup query:
     ```sql
     DELETE FROM _internal_bridge_nonces WHERE expires_at < unixepoch();
     ```
3. **Proof of No Accidental Premature Purge:**
   - A nonce is deleted only when `unixepoch() > expires_at`, meaning at least 60 seconds have elapsed since the request was created.
   - Any attempt to replay that request at this point has a timestamp that is at least 60 seconds old, which is immediately rejected by the $\pm 30$-second timestamp check.
   - Therefore, cleanup can **never** accidentally remove a nonce that could otherwise be accepted.

### 2.5 D1 Replication Architecture: Single Primary vs. Read Replicas
- **Universal Strong Consistency Refuted:** Cloudflare D1 is **not** a multi-master globally strongly consistent database.
- **Documented Architecture:** Every D1 database has a **single primary geographic location** where the authoritative SQLite database resides. All write operations (`env.DB.batch`, `INSERT`, `UPDATE`, `DELETE`) are transported across Cloudflare's private network backbone to this single primary writer.
- **Replication Model:** Read replicas (when enabled) replicate asynchronously from the primary. Read replicas may experience replication lag.
- **Write Serialization:** Because all nonce insertions and data mutations route exclusively to the primary writer, transactions execute with **strict serializability and write-lock mutual exclusion**. Two Worker isolates calling D1 concurrently are serialized at the primary SQLite lock.

### 2.6 Local Concurrency Verification (Miniflare D1)
In local integration testing, concurrent replay attacks are proven via parallel execution in Miniflare:
```ts
const [res1, res2] = await Promise.all([
  worker.fetch('http://localhost/api/internal/d1/execute', reqOptions),
  worker.fetch('http://localhost/api/internal/d1/execute', reqOptions), // Identical clone
]);
// Assertion: Exactly one request returns 200/201; exactly one returns 409 Conflict
assert.strictEqual([res1.status, res2.status].sort().join(','), '200,409');
```

---

## 3. Retry Behavior & Business-Level Idempotency

A fresh nonce prevents *network-level replay attacks*, but does **not** automatically make business operations idempotent on client retries. The following matrix specifies the exact behavior for every operation if a network timeout occurs after D1 commits:

```
[Express Client] ──(Request: Nonce N1)──► [Worker Bridge] ──► [D1 Commits Mutation]
       │                                                              │
       │ ◄─── (Network Drops Response / 504 Gateway Timeout) ─────────┘
       ▼
Express Times Out! What happens when Express retries with fresh Nonce N2?
```

| Action | Naturally Idempotent? | Timeout After D1 Commit | Safe to Retry? | Idempotency / Deduplication Guarantee |
| :--- | :---: | :--- | :---: | :--- |
| **`getUserForLogin`** | **YES** | Read query committed; no state changed. | **YES** | Naturally idempotent pure read. Retrying with fresh nonce $N_2$ returns the identical user record safely. |
| **`createUser`** | **NO** | User row inserted in D1, but Express never received `{ success: true, userId }`. | **YES (Safe)** | The table enforces `UNIQUE(email)` and `PRIMARY KEY(id)`. When Express or the user retries with fresh nonce $N_2$, D1 rejects with `SQLITE_CONSTRAINT_UNIQUE: users.email`. Express catches this and returns `409 Conflict ("An account with this email already exists")`. Zero duplicate records are created. |
| **`updatePasswordHash`** | **YES** | Password hash updated to new scrypt hash; Express timed out. | **YES** | Declarative update: `SET password_hash = ? WHERE id = ?`. Re-executing with fresh nonce $N_2$ writes the identical scrypt hash to the identical row. Zero unintended side-effects. |
| **`changePassword`** | **YES** | Password hash updated to target hash; Express timed out. | **YES** | Declarative update: `SET password_hash = ? WHERE id = ?`. Re-executing with fresh nonce $N_2$ commits the identical hash. If the user subsequently enters their old password, verification fails. Zero unintended side-effects. |
| **`changeAccountStatus`**| **YES** | Account status updated to target enum (`'suspended'`); Express timed out. | **YES** | Declarative update: `SET account_status = ? WHERE id = ?`. Setting `account_status = 'suspended'` multiple times produces the exact same end state. Retrying is completely safe. |
| **`updateUserRole`** | **YES** | Role updated to target role key (`'event_manager'`); Express timed out. | **YES** | Declarative update: `SET role = ? WHERE id = ?`. Setting `role = 'event_manager'` multiple times produces the exact same end state. Retrying is completely safe. |

---

## 4. Privileged Actor Authorization & Origin Context Binding

### 4.1 Separation of Machine Authentication from User Authorization
- **Bridge Secret Boundary:** `INTERNAL_D1_BRIDGE_SECRET` verifies only that the HTTP request was dispatched by the trusted Express origin service. It does **not** prove that the user requesting the change is an administrator.
- **Origin Session Enforcement:** The Express controller extracts actor identity strictly from the cryptographically verified JWT cookie / Bearer token (`req.user.id`, `req.user.role`). Client-supplied actor fields in request bodies or query parameters are strictly forbidden and rejected.

### 4.2 Cryptographic Context Binding in Request Payload
The Express client includes the verified origin actor context in the request payload:
```ts
const bridgePayload = {
  action: 'updateUserRole',
  params: { id: targetUserId, role: newRole },
  actor: {
    id: req.user.id,     // Derived strictly from verified server-side session
    role: req.user.role, // Derived strictly from verified server-side session
  },
};
```
Because the entire serialized payload is hashed into the HMAC signature (`${timestamp}:${nonce}:${action}:${bodyHash}`), any client tampering with `actor.id` or `actor.role` immediately invalidates the HMAC signature.

### 4.3 Detailed Role Assignment & Governance Matrix
In accordance with `server/services/rbacService.ts`:
- **`PRIVILEGED_ROLES`:** `['super_admin', 'admin', 'platform_admin']`
- **All 13 Verified Roles:** `'super_admin'`, `'admin'`, `'platform_admin'`, `'event_manager'`, `'auctioneer'`, `'auction_manager'`, `'community_manager'`, `'partner_manager'`, `'checkin_staff'`, `'support_staff'`, `'venue_partner'`, `'participant'`, `'user'`.

```
+---------------------------------------------------------------------------------------------------------+
|                                    RBAC ROLE ASSIGNMENT PERMISSION MATRIX                               |
+---------------------------------------------------------------------------------------------------------+
| Actor Role          | Holds roles.assign? | May Assign Non-Privileged Roles? | May Assign Privileged Roles? |
+---------------------+---------------------+----------------------------------+------------------------------+
| super_admin         | YES                 | YES (All 13 roles)               | YES (super_admin, admin, ...) |
| admin               | YES                 | YES (10 operational roles)       | NO (Blocked: 403 Forbidden)  |
| platform_admin      | NO                  | NO (Blocked: 403 Forbidden)      | NO (Blocked: 403 Forbidden)  |
| All other 10 roles  | NO                  | NO (Blocked: 403 Forbidden)      | NO (Blocked: 403 Forbidden)  |
+---------------------+---------------------+----------------------------------+------------------------------+
```

### 4.4 Invariants Against Privilege Escalation:
1. **Self-Modification Defense:** An administrator cannot alter their own administrative role or suspend their own account (`if (targetId === req.user.id) return 400 Bad Request`).
2. **Super Admin Exclusivity:** Assigning or altering any privileged role (`super_admin`, `admin`, `platform_admin`) is restricted exclusively to `super_admin`. Any attempt by an `admin` to promote themselves or another user to a privileged role is blocked with **HTTP 403 Forbidden** and logs an immutable audit event (`PRIVILEGE_ESCALATION_BLOCKED`).
3. **What Worker Independently Validates vs. Trusts:**
   - **Worker Independently Validates:** HMAC cryptographic signature, timestamp freshness, nonce uniqueness, action allowlist, parameter schema, and that `actor.role` belongs to `ADMIN_STAFF_ROLES`.
   - **Worker Trusts from Express:** The Worker trusts that Express correctly verified the user's password and validated the session JWT on the origin.

---

## 5. Feature-Flag Architecture & Authentication Isolation

### 5.1 Default-Off Feature Flag
In `server/config/env.ts`, the D1 bridge is isolated behind an explicit feature flag:
```ts
export interface AppConfig {
  // Existing fields...
  useD1AuthBridge: boolean;
  internalD1BridgeSecret: string;
  d1BridgeUrl: string;
}

export function loadConfig(): AppConfig {
  const useD1AuthBridge = process.env.ENABLE_D1_AUTH_BRIDGE === 'true'; // Defaults strictly to false
  // ...
  return {
    // ...
    useD1AuthBridge,
    internalD1BridgeSecret: process.env.INTERNAL_D1_BRIDGE_SECRET?.trim() || '',
    d1BridgeUrl: process.env.D1_BRIDGE_URL?.trim() || 'http://127.0.0.1:8787',
  };
}
```

### 5.2 Strict Startup Fail-Closed Validation
If `ENABLE_D1_AUTH_BRIDGE === 'true'`, Express executes mandatory startup checks in `validateEnvironment()`:
```ts
if (config.useD1AuthBridge) {
  if (!config.internalD1BridgeSecret || !isCanonicalBase64Url32(config.internalD1BridgeSecret)) {
    throw new Error('[STROOM Config Fatal] ENABLE_D1_AUTH_BRIDGE is true but INTERNAL_D1_BRIDGE_SECRET is missing or non-canonical 43-character Base64URL.');
  }
  if (!config.d1BridgeUrl) {
    throw new Error('[STROOM Config Fatal] ENABLE_D1_AUTH_BRIDGE is true but D1_BRIDGE_URL is not configured.');
  }
}
```
If misconfigured, the Express process **refuses to start**, preventing silent fallback or runtime exceptions.

### 5.3 Conditional Integration in `server/routes/auth.ts`
When `config.useD1AuthBridge === false` (the production default throughout Phase 2.5.1.1):
- `POST /api/auth/register` executes existing SQLite `INSERT INTO users ...`.
- `POST /api/auth/login` executes existing SQLite `SELECT ... FROM users ...`.
- Existing SQLite behavior is **100% preserved**.

When `config.useD1AuthBridge === true` (in isolated local integration test harnesses):
- `POST /api/auth/register` routes to `d1BridgeClient.createUser()`.
- `POST /api/auth/login` routes to `d1BridgeClient.getUserForLogin()`.

---

## 6. Signature Wire-Byte Binding & Secret Separation

### 6.1 Bit-for-Bit Raw Wire Byte Signing
To eliminate JSON serialization divergences (e.g. whitespace, key ordering, number formatting) between Node.js and the V8 Worker runtime, signing operates on the exact wire bytes:

```
[Express Origin]
  1. rawBody = Buffer.from(JSON.stringify(payload), 'utf8');
  2. bodyHash = crypto.createHash('sha256').update(rawBody).digest('hex');
  3. signature = crypto.createHmac('sha256', secret)
                   .update(`${timestamp}:${nonce}:${action}:${bodyHash}`)
                   .digest('hex');
  4. Dispatch HTTP POST with body: rawBody.

[Worker Edge]
  1. rawBodyBytes = new Uint8Array(await req.arrayBuffer()); // Read exact wire bytes!
  2. bodyHash = toHex(await crypto.subtle.digest('SHA-256', rawBodyBytes));
  3. expectedSig = toHex(await crypto.subtle.sign('HMAC', key, `${time}:${nonce}:${action}:${bodyHash}`));
  4. Compare signatures using crypto.subtle.timingSafeEqual().
  5. ONLY AFTER signature passes: parsedJson = JSON.parse(new TextDecoder().decode(rawBodyBytes));
```
- **Byte Parity Guarantee:** Because the hash is computed directly over the raw wire bytes before JSON parsing, serialization discrepancies are mathematically impossible.

### 6.2 Secret Separation & Independent Rotation
- **`INTERNAL_D1_BRIDGE_SECRET`:** Express $\rightarrow$ Worker. Header: `X-STROOM-Bridge-Secret`. Validated by Worker `bridgeAuthMiddleware`.
- **`ORIGIN_PROXY_SECRET`:** Worker $\rightarrow$ Express. Header: `X-STROOM-Origin-Secret`. Validated by Express `originProxyAuthMiddleware`.
- **Rotation Model:** Max 72-hour overlap ceiling. Exact millisecond boundary rejection (`now >= previousExpiresAt`).
- **Secret Hygiene:** Raw secret values are **never** logged to stdout, files, or reports (`[REDACTED]` only). All test harnesses use ephemeral in-memory generated secrets.

---

## 7. Exact Implementation Scope & Phased File Inventory

```
+---------------------------------------------------------------------------------------------------------+
|                                      IMPLEMENTATION INVENTORY & PHASING                                 |
+---------------------------------------------------------------------------------------------------------+
| Group | File Path                            | Status   | Target  | Role in Phase 2.5.1.1               |
+-------+--------------------------------------+----------+---------+-------------------------------------+
| **A** | migrations/0003_bridge_nonces.sql    | NEW      | D1      | **Immediate:** D1 Nonce Schema      |
| **A** | src/worker/middleware/bridgeAuth.ts  | NEW      | Worker  | **Immediate:** HMAC & Nonce Guard   |
| **A** | src/worker/routes/internalBridge.ts  | NEW      | Worker  | **Immediate:** 6 D1 Actions Endpoint|
| **A** | src/worker/app.ts                    | MODIFIED | Worker  | **Immediate:** Mounts Bridge Route  |
| **B** | server/services/d1BridgeClient.ts    | NEW      | Express | **Immediate:** Express Bridge Client|
| **C** | server/middleware/originProxyAuth.ts | NEW      | Express | **Immediate:** Origin Proxy Auth    |
| **C** | server/index.ts                      | MODIFIED | Express | **Immediate:** Mounts Proxy Auth    |
| **D** | server/config/env.ts                 | MODIFIED | Express | **Immediate:** Adds feature flag    |
| **D** | server/routes/auth.ts                | MODIFIED | Express | **Immediate (Behind flag = false)** |
| --    | src/worker/routes/authProxy.ts       | DEFERRED | Worker  | **Deferred to Stage 2.5.2**         |
| --    | Production D1 Remote Migration       | DEFERRED | Remote  | **Deferred to Stage 2.5.3**         |
| --    | Production User Data Migration       | DEFERRED | Remote  | **Deferred to Stage 2.5.3**         |
+-------+--------------------------------------+----------+---------+-------------------------------------+
```

---

## 8. Local Test & Safety Plan (13 Test Suites)

All tests execute against disposable temporary databases (`data/test_disposable_*.db` and local Miniflare D1). The primary database (`data/stroom.db`) is verified before and after test execution.

```
+---------------------------------------------------------------------------------------------------------+
|                                    13 LOCAL TEST SUITES & EXPECTED OUTCOMES                             |
+---------------------------------------------------------------------------------------------------------+
| #  | Test Suite Name                      | Test Execution Condition                    | Expected Result|
+----+--------------------------------------+---------------------------------------------+----------------+
| 1  | Valid HMAC Signature Verification    | Canonical payload & authentic secret        | 200/201 Success|
| 2  | Invalid HMAC Signature Rejection     | Signature corrupted by 1 byte               | 401 Unauthoriz |
| 3  | Body Tampering Detection             | Body mutated after signature generated      | 401 Unauthoriz |
| 4  | Timestamp Drift Rejection            | Request timestamp outside +/- 30s window    | 401 Unauthoriz |
| 5  | Concurrent Duplicate Nonce Replay    | Two identical requests dispatched in parallel| 1x 200, 1x 409 |
| 6  | D1 Unavailability Fail-Closed        | D1 binding simulated as disconnected/error  | 503 Fail-Closed|
| 7  | Batch Rollback on Business Failure   | createUser with duplicate email in batch    | Nonce uncommitt|
| 8  | Timeout Idempotency / Retry Handling | Re-request after timeout with fresh nonce   | Safe deduplicat|
| 9  | Duplicate Registration Handling      | Registration retry with existing email      | 409 Conflict   |
| 10 | Zero Password Hash Exposure          | Verify all responses and logs omit hash     | Zero hash leak |
| 11 | Unauthorized Administrative Access   | Non-admin calls role/status update          | 403 Forbidden  |
| 12 | Direct Origin Bypass Rejection       | External caller hits Express without secret | 403 Forbidden  |
| 13 | Existing SQLite Auth Preservation    | npm test with ENABLE_D1_AUTH_BRIDGE=false   | 78/78 Tests PAS|
+----+--------------------------------------+---------------------------------------------+----------------+
```

---

## 9. Baseline Database Checksums & Pre-Implementation State

The repository and databases remain completely pristine and verified:

```
Working Directory:        D:\ST
Git Branch:               feature/stroom-production-launch
Current HEAD:             19c4176b87094a6ba7b81ffec7a01b72796c08ec

Primary SQLite Database:  data/stroom.db (2,899,968 bytes)
Primary SHA-256 Checksum: ad6fe974854b0fcd83cf053e26de89f3d467b2be2687b09e0ab282e6acd848fb (MATCH)

Phase 0 Checkpoint Backup:backups/stroom-checkpoint-phase0-2026-11-13T08-10-02-441Z.db (2,899,968 bytes)
Backup SHA-256 Checksum:  2129266ef6555c90c74b9166e696a2e39aa8b2a87e483eb79a20f9a292be4571 (MATCH)
```

---

## 10. Final Authorization Gate

> [!IMPORTANT]
> **READ-ONLY MANDATE OBSERVED:**  
> All eight design items are fully specified. Zero application files or databases have been modified. Implementation remains **unapproved**. We await your explicit authorization before proceeding to Step C (Implementation).
