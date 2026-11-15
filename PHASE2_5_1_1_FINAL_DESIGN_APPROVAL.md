# STROOM — Phase 2.5.1.1: Final Implementation Design & Architectural Specification

**Project:** `D:\ST`  
**Current Branch:** `feature/stroom-production-launch`  
**Verified Baseline HEAD:** `19c4176b87094a6ba7b81ffec7a01b72796c08ec`  
**Document Version:** 1.0.0 (Authoritative Implementation Design Sign-Off)  
**Security Classification:** Core Architectural Specification & Implementation Gate  
**Mode:** STRICT READ-ONLY AUDIT & PLANNING (Zero application code modified, zero databases mutated)  
**Date:** November 14, 2026  

---

## 1. Corrected System Architecture & Trust Boundaries

The STROOM hybrid deployment coordinates two completely distinct, unidirectional trust boundaries:

```
+---------------------------------------------------------------------------------------------------------+
|                                  STROOM HYBRID TRUST TOPOLOGY                                           |
+---------------------------------------------------------------------------------------------------------+
|                                                                                                         |
|   +-------------------+                                                                                 |
|   |   Browser Client  |                                                                                 |
|   +---------+---------+                                                                                 |
|             |                                                                                           |
|             | 1. Public HTTPS Ingress (Cookies / Bearer JWT)                                            |
|             |    Headers: [X-STROOM-* stripped at Edge Ingress]                                         |
|             v                                                                                           |
|   +-----------------------------------------------------------------------+                             |
|   |                   Cloudflare Edge / Worker (workerd)                  |                             |
|   |                                                                       |                             |
|   |  • Edge Auth Router (Proxy Dispatcher: src/worker/routes/authProxy.ts)|                             |
|   |  • Internal D1 Bridge Endpoint (/api/internal/d1/execute)             |                             |
|   |    [Guarded by: bridgeAuthMiddleware]                                 |                             |
|   |    [Target Database: Cloudflare D1 (env.DB)]                          |                             |
|   |    [Anti-Replay Store: D1 primary table _internal_bridge_nonces]      |                             |
|   +---------+--------------------------------------------------+----------+                             |
|             |                                                  ^                                        |
|             | 2. TRUST PATH B: Worker -> Express               | 3. TRUST PATH A: Express -> Worker -> D1|
|             |    Header: X-STROOM-Origin-Secret                |    Header: X-STROOM-Bridge-Secret      |
|             |    Secret: ORIGIN_PROXY_SECRET                   |    Secret: INTERNAL_D1_BRIDGE_SECRET   |
|             |    Payload: Auth requests to origin              |    Auth: HMAC-SHA256 + Nonce + Time    |
|             |    Middleware: originProxyAuthMiddleware         |    Actions: 6 approved D1 operations   |
|             v                                                  |    Caller: d1BridgeClient.ts           |
|   +------------------------------------------------------------+----------+                             |
|   |                   Origin Express Backend (Node.js)                    |                             |
|   |                                                                       |                             |
|   |  • Auth Controllers: POST /api/auth/*                                 |                             |
|   |    [Guarded by: originProxyAuthMiddleware]                            |                             |
|   |    [Default Behavior: SQLite DB active via feature flag]              |                             |
|   |    [D1 Bridge Path: Activated via ENABLE_D1_AUTH_BRIDGE=true]         |                             |
|   |    [Computation: scryptSync hashing & verifyPassword]                 |                             |
|   |  • Bridge Client: server/services/d1BridgeClient.ts                   |                             |
|   |    [Formats HMAC signature, generates nonces, calls Worker]           |                             |
|   +-----------------------------------------------------------------------+                             |
|                                                                                                         |
+---------------------------------------------------------------------------------------------------------+
```

### 1.1 Summary of the Two Distinct Trust Paths:

1. **Trust Path A (Express $\rightarrow$ Cloudflare Worker $\rightarrow$ Cloudflare D1):**
   - **Request Origin:** Express backend via `server/services/d1BridgeClient.ts`.
   - **Request Destination:** Cloudflare Worker endpoint `POST /api/internal/d1/execute`.
   - **Guarding Middleware:** `bridgeAuthMiddleware` (Cloudflare Worker runtime).
   - **Secret:** `INTERNAL_D1_BRIDGE_SECRET` passed in header `X-STROOM-Bridge-Secret`.
   - **Target Database:** **Cloudflare D1** (`env.DB`). Zero local SQLite queries are executed for D1 bridge requests.
   - **Anti-Replay Mechanism:** Cryptographic HMAC-SHA256 request binding, $\pm 30$-second timestamp window, and atomic nonce consumption in D1 table `_internal_bridge_nonces`.

2. **Trust Path B (Cloudflare Worker $\rightarrow$ Express Backend):**
   - **Request Origin:** Cloudflare Worker reverse-proxy handler (`src/worker/routes/authProxy.ts`).
   - **Request Destination:** Express origin backend (`POST /api/auth/*`).
   - **Guarding Middleware:** `originProxyAuthMiddleware` (Express Node.js runtime).
   - **Secret:** `ORIGIN_PROXY_SECRET` passed in header `X-STROOM-Origin-Secret`.
   - **Purpose:** Shields Express from direct Internet exposure. Delegates CPU-intensive `scrypt` password hashing and transparent SHA-256 upgrades to Express while keeping edge Worker execution under Free Tier CPU limits.

---

## 2. Cloudflare D1 Consistency, Nonce Protection & Transaction Semantics

### 2.1 Correction of Distributed Consistency Model
Cloudflare D1 is **not** globally multi-master strongly consistent. D1's documented architecture operates as follows:
- **Single Primary Writer:** Every D1 database has a **single, specific primary geographic region** (e.g. `wnam`, `enam`, `weur`, `apac`). All write mutations (`INSERT`, `UPDATE`, `DELETE`) are routed from edge Worker isolates across Cloudflare’s global private backhaul to this single primary writer instance.
- **Asynchronous Read Replication:** Read replicas (when enabled) replicate from the primary asynchronously. Reads may observe replication lag unless directed to the primary session using `withSession("first-primary")`.
- **Serializable Primary Transactions:** On the primary instance, SQLite operates with strict ACID semantics, serializable transactions, and atomic write-locks.

### 2.2 Proof of Replay Protection Under Concurrent Requests
To prevent replay attacks across distributed Workers, nonces are consumed via an atomic SQL insert on D1:

```sql
CREATE TABLE IF NOT EXISTS _internal_bridge_nonces (
  nonce TEXT PRIMARY KEY,
  request_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_nonces_expires ON _internal_bridge_nonces(expires_at);
```

#### Behavior Under Concurrency & Failure Conditions:
1. **Two Identical Requests Arrive Concurrently:**
   - Whether the two requests hit the same edge Worker or different global PoPs (e.g. London and Tokyo), both Worker isolates dispatch `INSERT INTO _internal_bridge_nonces (nonce, ...) VALUES (...)` to D1.
   - Because writes execute serially on the single D1 primary instance, the first transaction successfully inserts the nonce.
   - The second transaction attempts to insert the identical `nonce` and immediately triggers `SQLITE_CONSTRAINT_PRIMARYKEY` (UNIQUE constraint failure).
   - D1 rejects the second insertion. The Worker catches the constraint error and immediately halts, returning **HTTP 409 Conflict ("Replay detected")**.
2. **D1 Storage Failure / Unreachable:**
   - The Worker **strictly fails closed**.
   - If D1 is timing out or unreachable, the Worker returns **HTTP 503 Service Unavailable ("Anti-replay storage unavailable")**. Zero downstream operations execute.
3. **Business Operation Failure After Nonce Consumption:**
   - When operations are executed in an atomic batch (`env.DB.batch([nonceInsert, businessQuery])`), D1 guarantees that if the business query fails, the entire transaction rolls back.
   - If executed sequentially and the business query fails (e.g., duplicate email on `createUser`), the nonce remains consumed. The client cannot replay the identical nonce; to retry, the client must generate a new request with a fresh nonce and timestamp. This satisfies standard cryptographic idempotency.
4. **Safe Expiry & Cleanup:**
   - Nonce TTL is exactly 60 seconds (`expires_at = unixepoch() + 60`).
   - Any request with $|now - \text{timestamp}| > 30\text{ seconds}$ is rejected by the timestamp guard before querying D1.
   - Opportunistic cleanup runs:
     ```sql
     DELETE FROM _internal_bridge_nonces WHERE expires_at < unixepoch();
     ```
   - **Accidental Early Purge Prevention:** A nonce is only purged when `expires_at < unixepoch()`, which is 60 seconds after request generation. By definition, a request generated 60 seconds ago is already expired by the 30-second timestamp freshness check. Therefore, cleanup can **never** accidentally remove a nonce that could otherwise be accepted.

---

## 3. Sensitive Action Authorization & RBAC Hierarchy

A critical security principle is enforced: **The internal bridge secret authenticates server-to-server communication; it does NOT constitute user authorization.**

Privileged administrative actions (`changeAccountStatus` and `updateUserRole`) require verified end-to-end user authorization originating from an authenticated administrator identity:

```
[Administrator Browser] ──(Admin Session JWT)──► [Express Origin Controller]
                                                        │
                                                        ├── 1. requireAuth: Extracts req.user (actorId, actorRole)
                                                        │
                                                        ├── 2. RBAC Enforcement (rbacService.ts):
                                                        │      • For status: hasPermission(actorRole, 'members.manage')
                                                        │      • For role: hasPermission(actorRole, 'roles.assign')
                                                        │      • Self-modification check: actorId !== targetId
                                                        │      • Privilege escalation check: targetRole not privileged unless super_admin
                                                        │
                                                        ├── 3. Audit Log Recorded in SQLite audit_logs
                                                        │
                                                        └── 4. ONLY AFTER Authorization:
                                                               Dispatch to D1 Bridge:
                                                               POST /api/internal/d1/execute
                                                               Payload: { action, params, actor: { id, role } }
```

### 3.1 Authorization Flow for `changeAccountStatus`:
1. **User Identity:** Extracted from JWT by Express `authMiddleware` (`req.user.id`, `req.user.role`).
2. **Permission Check:** Express verifies `hasPermission(req.user.role, 'members.manage')`. Ordinary users and staff without this permission receive **HTTP 403 Forbidden**.
3. **Self-Modification Defense:** An administrator cannot suspend their own active account (`id !== req.user.id`).
4. **Super Admin Protection:** Only a `super_admin` can suspend or reactivate another privileged account (`super_admin`, `admin`, `platform_admin`).
5. **Audit Logging:** Express records an audit log entry in `audit_logs` capturing `actorId`, `actorRole`, `MEMBER_SUSPENDED` / `MEMBER_REACTIVATED`, `targetUserId`, and `reason`.
6. **Bridge Dispatch:** Express calls `d1BridgeClient.changeAccountStatus()`.
7. **Worker Bridge Re-Verification:** The Worker bridge verifies that `actor.role` carries administrative privileges before executing the D1 update.

### 3.2 Authorization Flow for `updateUserRole`:
1. **User Identity:** Extracted from JWT (`req.user.id`, `req.user.role`).
2. **Permission Check:** Express verifies `hasPermission(req.user.role, 'roles.assign')` (held exclusively by `super_admin` and `admin`).
3. **Role Key Allowlist:** Target role is verified against the **13 verified STROOM roles**:
   `'super_admin'`, `'admin'`, `'platform_admin'`, `'event_manager'`, `'auctioneer'`, `'auction_manager'`, `'community_manager'`, `'partner_manager'`, `'checkin_staff'`, `'support_staff'`, `'venue_partner'`, `'participant'`, `'user'`.
4. **Privilege Escalation Defense:** Assigning or altering privileged admin roles (`super_admin`, `admin`, `platform_admin`) is restricted strictly to `super_admin`. Unauthorized escalation attempts log `PRIVILEGE_ESCALATION_BLOCKED` and return **HTTP 403 Forbidden**.
5. **Audit Logging:** Express records `MEMBER_ROLE_CHANGED` with `beforeRole` and `afterRole`.
6. **Bridge Dispatch:** Express calls `d1BridgeClient.updateUserRole()`.

---

## 4. Revalidated Semantics for All Six Actions

| Action | Target DB | Input Parameters | Output Payload | Semantics & Preserved Behavior |
| :--- | :---: | :--- | :--- | :--- |
| **`getUserForLogin`** | **D1** | `email`: string (1–180 chars, normalized lowercase) | `{ success: true, user: UserRecord \| null }` | Returns `password_hash` **only** over the internal bridge so Express can verify scrypt without Worker CPU timeout. Express strips `password_hash` immediately after verification (`const { password_hash: _ph, ...user } = userRecord;`). Hashes **never** appear in public responses or logs. |
| **`createUser`** | **D1** | `id`: `usr_[a-f0-9]{16}`<br/>`email`: 1–180 chars email<br/>`password_hash`: `scrypt$...`<br/>`full_name`: 2–120 chars<br/>`avatar_url`: optional URL | `{ success: true, userId: string }` | Express performs Zod validation (`registerSchema`) and hashes password with scrypt before calling D1. Duplicate email returns D1 unique constraint failure (`409 Conflict`). Zero JWT is issued if D1 insert fails. |
| **`updatePasswordHash`** | **D1** | `id`: string<br/>`password_hash`: `scrypt$...` | `{ success: true, rowsUpdated: number }` | **Transparent Login Upgrade:** Soft-fail. Invoked exclusively on successful login when user authenticates against legacy SHA-256 hash (`needsRehash === true`). If D1 update fails, login still succeeds and upgrade retries next login. |
| **`changePassword`** | **D1** | `id`: string<br/>`password_hash`: `scrypt$...` | `{ success: true, rowsUpdated: number }` | **Explicit Password Change:** Strict hard-fail / abort. Triggered by explicit user request (`POST /api/users/me/change-password`). Verifies current password before hashing new password. If D1 update fails, the entire operation aborts and old password remains active. |
| **`changeAccountStatus`**| **D1** | `id`: string<br/>`account_status`: `'active' \| 'suspended' \| 'deactivated'` | `{ success: true, rowsUpdated: number }` | Preserves account suspension behavior. Suspended accounts cannot log in or update credentials. Enforces `members.manage` permission and audit logging. |
| **`updateUserRole`** | **D1** | `id`: string<br/>`role`: one of 13 verified roles | `{ success: true, rowsUpdated: number }` | Enforces `roles.assign` permission. Validates strictly against the 13 official RBAC roles. Rejects invalid or invented roles with `400 Bad Request`. |

---

## 5. Separation of Implementation from Production Migration

To guarantee zero service disruption, implementation is strictly decoupled from production cutover:

1. **SQLite Remains Authoritative by Default:**
   - In `server/config/env.ts`, a feature flag is introduced:
     ```ts
     useD1AuthBridge: process.env.ENABLE_D1_AUTH_BRIDGE === 'true' // Defaults to false
     ```
   - By default (`ENABLE_D1_AUTH_BRIDGE=false`), Express authentication routes (`POST /api/auth/login`, `POST /api/auth/register`) continue executing against local SQLite (`data/stroom.db`) exactly as they do today.
2. **Reversible, Isolated Integration:**
   - The D1 Bridge Client (`server/services/d1BridgeClient.ts`) and Worker Bridge Handler (`src/worker/routes/internalBridge.ts`) are fully implemented and unit-tested in isolation.
   - When `ENABLE_D1_AUTH_BRIDGE=true` (enabled explicitly in dedicated integration test harnesses), Express routes user queries and mutations to the D1 Bridge.
3. **Zero Production Data Migration in Phase 2.5.1.1:**
   - Production user data remains in SQLite until Stage 2.5.3 (Data Migration & Parity Verification).
   - Switching production traffic to D1 is reserved for Stage 2.5.3 after bit-for-bit data parity is proven.

---

## 6. Exact Implementation Scope & File-by-File Boundary

```
+---------------------------------------------------------------------------------------------------------+
|                                    FILE-BY-FILE IMPLEMENTATION INVENTORY                                |
+---------------------------------------------------------------------------------------------------------+
| File Path                           | Status   | Runtime | Purpose                      | Changes Schema?|
+-------------------------------------+----------+---------+------------------------------+----------------+
| migrations/0003_bridge_nonces.sql   | NEW      | D1      | Creates _internal_bridge_    | YES (D1 only,  |
|                                     |          |         | nonces table on D1           | SQLite UNTOUCH)|
| src/worker/middleware/bridgeAuth.ts | NEW      | Worker  | Validates secret, timestamp, | NO             |
|                                     |          |         | HMAC & consumes D1 nonces    |                |
| src/worker/routes/internalBridge.ts | NEW      | Worker  | Implements 6 D1 actions on   | NO             |
|                                     |          |         | POST /api/internal/d1/execute|                |
| src/worker/routes/authProxy.ts      | NEW      | Worker  | Reverse proxy for auth routes| NO             |
|                                     |          |         | injecting Origin Secret      |                |
| src/worker/app.ts                   | MODIFIED | Worker  | Mounts bridge & auth proxy   | NO             |
| server/services/d1BridgeClient.ts   | NEW      | Express | Client formatting HMAC       | NO             |
|                                     |          |         | requests to Worker D1 bridge |                |
| server/middleware/originProxyAuth.ts| NEW      | Express | Ingress middleware validating| NO             |
|                                     |          |         | X-STROOM-Origin-Secret       |                |
| server/config/env.ts                | MODIFIED | Express | Adds bridge configuration &  | NO             |
|                                     |          |         | ENABLE_D1_AUTH_BRIDGE flag   |                |
| server/routes/auth.ts               | MODIFIED | Express | Adds conditional bridge path | NO             |
|                                     |          |         | behind feature flag          |                |
| server/index.ts                     | MODIFIED | Express | Mounts originProxyAuth on    | NO             |
|                                     |          |         | /api/auth/*                  |                |
+-------------------------------------+----------+---------+------------------------------+----------------+
```

> [!IMPORTANT]
> **Database Invariant:**  
> Zero modifications, DDL statements, or migrations will be executed against `data/stroom.db` or files in `backups/`. The migration `0003_bridge_nonces.sql` applies **exclusively to Cloudflare D1** (executed locally in Miniflare test state during integration tests).

---

## 7. Local End-to-End Testing & Verification Plan

### 7.1 Test Harness 1: Express $\rightarrow$ D1 Bridge Client $\rightarrow$ Worker $\rightarrow$ D1
- **Architecture:** An isolated test script starts a local Miniflare `workerd` instance loading `src/worker/index.ts` with local D1 binding.
- **D1 Setup:** Miniflare executes `0001_initial_schema.sql` and `0003_bridge_nonces.sql` on a disposable in-memory D1 database.
- **Verification Matrix:**
  1. `createUser`: Inserts user in D1; confirms row created in D1 `users`.
  2. `getUserForLogin`: Fetches user credentials from D1; verifies `password_hash` matches.
  3. `updatePasswordHash`: Transparent upgrade updates D1 `password_hash`.
  4. `changePassword`: Explicit change commits new scrypt hash to D1.
  5. `changeAccountStatus`: Suspends user in D1; confirms status updated.
  6. `updateUserRole`: Reassigns role; confirms role updated in D1.
  7. **Negative / Security Tests:**
     - Missing `X-STROOM-Bridge-Secret` $\rightarrow$ `401 Unauthorized`.
     - Tampered HMAC signature $\rightarrow$ `401 Unauthorized`.
     - Timestamp drift $> 30\text{ seconds}$ $\rightarrow$ `401 Unauthorized`.
     - Duplicate nonce replay $\rightarrow$ `409 Conflict`.
     - Unallowlisted action $\rightarrow$ `400 Bad Request`.
     - Unallowlisted role key $\rightarrow$ `400 Bad Request`.
     - Simulated D1 connection drop $\rightarrow$ `503 Service Unavailable` (fail-closed).

### 7.2 Test Harness 2: Browser $\rightarrow$ Worker $\rightarrow$ Express (Origin Proxy Auth)
- **Architecture:** Express runs in test mode (`process.env.NODE_ENV = 'test'`) on an ephemeral loopback port with disposable SQLite database.
- **Verification Matrix:**
  1. Worker auth proxy receives mock login request, attaches `X-STROOM-Origin-Secret`, and proxies to Express. Express returns `200 OK`.
  2. Direct client bypass test: External client calls Express directly without `X-STROOM-Origin-Secret` $\rightarrow$ Express rejects with **`403 Forbidden`**.
  3. Client supplies forged `X-STROOM-Origin-Secret` to Worker edge $\rightarrow$ Worker strips client header and injects genuine secret; Express accepts only genuine secret.

### 7.3 Demonstration of Existing SQLite Auth Preservation
- Execute full test suite `npm test` with `ENABLE_D1_AUTH_BRIDGE=false` against disposable database copy (`data/test_disposable_*.db`).
- Verify all 78 existing integration tests pass 100% with zero regression.

---

## 8. Rollback Strategy & Risk Mitigation

1. **Immediate Zero-Downtime Rollback:**
   - Because all D1 bridge integration in Express is guarded by `ENABLE_D1_AUTH_BRIDGE`, reverting Express to local SQLite requires only unsetting or setting `ENABLE_D1_AUTH_BRIDGE=false`.
   - Zero database restore or downtime is required.
2. **Origin Proxy Fail-Safe:**
   - If origin proxy authentication fails during staging, Express can temporarily bypass `originProxyAuthMiddleware` via `BYPASS_ORIGIN_PROXY_SECRET=true` (for staging diagnostics only).
3. **Database Checksum Protection:**
   - Both `data/stroom.db` (`ad6fe974...`) and `backups/...441Z.db` (`2129266e...`) remain immutable and untouched throughout Phase 2.5.1.1.

---

## 9. Explicitly Prohibited Actions in Phase 2.5.1.1

The following actions remain **strictly unauthorized and prohibited**:
- Deploying Workers, Pages, or D1 to remote Cloudflare infrastructure.
- Executing migrations or DDL against `data/stroom.db` or `backups/`.
- Generating or storing production secrets in `.env` or external secret managers.
- Provisioning Cloudflare Tunnels, DNS records, or custom domains.
- Migrating production user accounts to D1.
- Altering existing SQLite registration or login behavior in production.
- Committing or pushing changes to Git.

---

## 10. Status & Mandatory Approval Request

This design completely addresses all five refinements from your review:
1. D1 consistency and primary-location write serialization are accurately specified.
2. Implementation is cleanly isolated behind a default-off feature flag without touching existing SQLite behavior.
3. RBAC permissions (`members.manage`, `roles.assign`) and audit logging are preserved end-to-end.
4. All six action semantics and error behaviors are fully specified.
5. Implementation boundaries, files, and local testing harnesses are precisely documented.

> [!IMPORTANT]
> **Approval Gate:**  
> Execution remains strictly halted in read-only mode. No application files have been edited. We await your explicit authorization before proceeding to implementation.
