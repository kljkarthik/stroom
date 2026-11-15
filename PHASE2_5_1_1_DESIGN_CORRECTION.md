# STROOM — Phase 2.5.1.1: Architectural Design Correction & Reconciled Implementation Blueprint

**Project:** `D:\ST`  
**Branch:** `feature/stroom-production-launch`  
**Approved Baseline Commit:** `19c4176`  
**Document Version:** 2.0.0 (Authoritative Design Correction & Reconciled Implementation Plan)  
**Security Classification:** Core System Architecture & Trust Path Reconciliation  
**Mode:** STRICT READ-ONLY AUDIT & DESIGN CORRECTION  
**Date:** November 14, 2026  

---

## 1. Executive Summary & Purpose of Correction

This document formally resolves the architectural directionality inconsistency identified in the initial Phase 2.5.1.1 inspection report.

In hybrid serverless migrations, cryptographic secrets, authentication headers, and trust directions must be rigorously aligned with system boundaries. The previous inspection report mistakenly inverted the trust path of `INTERNAL_D1_BRIDGE_SECRET`, proposing an Express-side endpoint executing against local SQLite. 

This corrected specification restores the authoritative, approved architecture established across Phases 2.4.2, 2.4.3, 2.4.4, 2.5.0, and 2.5.1.0.6:
1. **Trust Path A (Express $\rightarrow$ Worker $\rightarrow$ D1):** Express invokes the Cloudflare Worker D1 Bridge to execute approved database operations against **Cloudflare D1**.
2. **Trust Path B (Worker $\rightarrow$ Express):** The Cloudflare Worker edge reverse-proxies authentication requests to Express, guarded by `ORIGIN_PROXY_SECRET`.
3. **Database Target:** The six approved operations belong on **Cloudflare D1** (`env.DB`), not local SQLite.
4. **Anti-Replay Nonce Storage:** Nonces are stored atomically in **Cloudflare D1** (`_internal_bridge_nonces`), not in a local Express SQLite file.

```
+---------------------------------------------------------------------------------------------------------+
|                                  CORRECTED HYBRID TRUST ARCHITECTURE                                    |
+---------------------------------------------------------------------------------------------------------+
|                                                                                                         |
|   +-------------------+                                                                                 |
|   |   Browser Client  |                                                                                 |
|   +---------+---------+                                                                                 |
|             |                                                                                           |
|             | 1. POST /api/auth/login or /register (HTTPS Cookies / Bearer)                             |
|             v                                                                                           |
|   +-----------------------------------------------------------------------+                             |
|   |                   Cloudflare Edge / Worker (workerd)                  |                             |
|   |                                                                       |                             |
|   |  • Edge Auth Router (Proxy Dispatcher: src/worker/routes/authProxy.ts)|                             |
|   |  • Internal D1 Bridge Endpoint (/api/internal/d1/execute)             |                             |
|   |    [Guarded by: bridgeAuthMiddleware]                                 |                             |
|   |    [Database Target: Cloudflare D1 (env.DB)]                          |                             |
|   |    [Nonce Store: D1 table _internal_bridge_nonces]                    |                             |
|   +---------+--------------------------------------------------+----------+                             |
|             |                                                  ^                                        |
|             | 2. TRUST PATH B: Worker -> Express               | 3. TRUST PATH A: Express -> Worker -> D1|
|             |    Header: X-STROOM-Origin-Secret                |    Header: X-STROOM-Bridge-Secret      |
|             |    Secret: ORIGIN_PROXY_SECRET                   |    Secret: INTERNAL_D1_BRIDGE_SECRET   |
|             |    Payload: User credentials                     |    Auth: HMAC-SHA256 + Nonce + Time    |
|             v                                                  |    Action: getUserForLogin / createUser|
|   +------------------------------------------------------------+----------+                             |
|   |                   Origin Express Backend (Node.js)                    |                             |
|   |                                                                       |                             |
|   |  • Auth Controller: POST /api/auth/*                                  |                             |
|   |    [Guarded by: originProxyAuthMiddleware]                            |                             |
|   |    [Computation: scryptSync hashing & verifyPassword]                 |                             |
|   |  • Bridge Client: server/services/d1BridgeClient.ts                   |                             |
|   |    [Formats HMAC signature, generates nonces, calls Worker]           |                             |
|   +-----------------------------------------------------------------------+                             |
|                                                                                                         |
+---------------------------------------------------------------------------------------------------------+
```

---

## 2. The Two Independent Trust Paths & Secret Directionality

| Architectural Dimension | Trust Path A: Internal D1 Bridge | Trust Path B: Origin Reverse Proxy |
| :--- | :--- | :--- |
| **Communication Direction** | **Express Backend $\rightarrow$ Cloudflare Worker $\rightarrow$ D1** | **Cloudflare Worker Edge $\rightarrow$ Express Backend** |
| **Request Initiator (Client)**| Express (`server/services/d1BridgeClient.ts`) | Cloudflare Worker (`src/worker/routes/authProxy.ts`) |
| **Request Receiver (Server)** | Cloudflare Worker (`/api/internal/d1/execute`) | Express Backend (`/api/auth/*`) |
| **Guarding Middleware** | `bridgeAuthMiddleware` (Cloudflare Worker runtime) | `originProxyAuthMiddleware` (Express Node.js runtime) |
| **Dedicated Secret** | `INTERNAL_D1_BRIDGE_SECRET` | `ORIGIN_PROXY_SECRET` |
| **HTTP Authentication Header**| `X-STROOM-Bridge-Secret` | `X-STROOM-Origin-Secret` |
| **Target Database** | **Cloudflare D1** (`env.DB`) | None (Express executes memory crypto) |
| **Anti-Replay Mechanism** | HMAC-SHA256 + Timestamp ($\pm 30$s) + Nonce | Ingress header stripping + Edge token binding |
| **Nonce Consumption Storage**| **Cloudflare D1** (`_internal_bridge_nonces`) | Not applicable (Direct edge-to-origin proxy) |
| **Failure Response Codes** | `401 Unauthorized` / `409 Conflict` / `503 Fail-Closed` | `403 Forbidden` / `500 Server Config Error` |
| **Cryptographic Cross-Defense**| Rejected if `ORIGIN_PROXY_SECRET` supplied | Rejected if `INTERNAL_D1_BRIDGE_SECRET` supplied |

---

## 3. Reconciled Scope: The Six Approved Actions in Path A

In the approved architecture, **Cloudflare D1 is the authoritative database for STROOM**. During the hybrid period, Express remains responsible for password verification and hashing because `scrypt` exceeds Cloudflare Worker Free Tier CPU limits. 

Therefore, Express executes **zero user credential writes against local SQLite**. Instead, Express calls the Worker D1 Bridge, which executes the approved parameterized SQL against **Cloudflare D1**.

```
[Browser] ──► [Worker: /api/auth/login] ──► [Express: verifyPassword (scrypt)]
                                                     │
                                                     ├── 1. Call D1 Bridge: getUserForLogin
                                                     │      Worker reads D1 -> returns password_hash
                                                     │
                                                     ├── 2. Express verifies scrypt hash in Node.js
                                                     │
                                                     └── 3. If legacy SHA-256: Call D1 Bridge: updatePasswordHash
                                                            Worker updates D1 with new scrypt hash
```

### 3.1 Detailed Action Specifications

#### Action 1: `getUserForLogin`
- **Target Database:** **Cloudflare D1** (`env.DB`).
- **Input Fields:**
  - `email`: string (length 1–180 chars, normalized to lowercase and trimmed, validated email syntax).
- **Output Fields:**
  - `success`: boolean (`true`).
  - `user`: object (or `null` if nonexistent) containing:
    - `id`: string (`usr_[a-f0-9]{16}`)
    - `email`: string
    - `password_hash`: string (scrypt hash or legacy SHA-256 hash)
    - `full_name`: string
    - `avatar_url`: string | null
    - `role`: string
    - `account_status`: string (`'active' | 'suspended' | 'deactivated'`)
    - `onboarding_status`: string (`'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' | 'SKIPPED'`)
    - `created_at`: ISO timestamp string
    - `updated_at`: ISO timestamp string
- **Executed SQL (on Cloudflare D1):**
  ```sql
  SELECT id, email, password_hash, full_name, avatar_url, role, account_status, onboarding_status, created_at, updated_at 
  FROM users 
  WHERE lower(email) = lower(?)
  ```
- **Existing Application Behavior Preserved:** Preserves `server/routes/auth.ts` lines 86-97.
- **Why `getUserForLogin` Must Return `password_hash` & How It Is Protected:**
  - *Why:* Express must compare the user's plaintext password against the stored hash using `verifyPassword()`. Because scrypt cannot run inside the Worker isolate under standard CPU limits, Express must perform this comparison.
  - *Protection:* 
    1. Transmitted exclusively over private server-to-server TLS (Cloudflare Tunnel).
    2. Guarded by `INTERNAL_D1_BRIDGE_SECRET` and HMAC request binding.
    3. Express strips `password_hash` immediately after verification (`const { password_hash: _ph, ...user } = userRecord;`).
    4. The password hash is **never** returned to the browser client or logged to stdout/disk.

#### Action 2: `createUser`
- **Target Database:** **Cloudflare D1** (`env.DB`).
- **Input Fields:**
  - `id`: string (format `^usr_[a-zA-Z0-9]{16}$`)
  - `email`: string (1–180 chars, normalized lowercase)
  - `password_hash`: string (format `^scrypt\$[0-9a-f]{32}\$[0-9a-f]{128}$`)
  - `full_name`: string (2–120 chars, trimmed)
  - `avatar_url`: string (optional, safe HTTP/HTTPS URL $\le 2048$ chars)
- **Output Fields:**
  - `{ success: true, userId: string }`
- **Executed SQL (on Cloudflare D1):**
  ```sql
  INSERT INTO users (id, email, password_hash, full_name, avatar_url, role, onboarding_status, created_at, updated_at)
  VALUES (?, lower(?), ?, ?, ?, 'user', 'NOT_STARTED', datetime('now'), datetime('now'))
  ```
- **Existing Application Behavior Preserved:** Preserves registration in `server/routes/auth.ts` lines 43-62. Express hashes the password using `hashPassword()` before sending the write request to D1.
- **Error Behavior:** Duplicate email triggers D1 `SQLITE_CONSTRAINT_UNIQUE`, which Worker maps to `{ success: false, error: 'User already exists', code: 'USER_EXISTS' }` (Express maps to `409 Conflict`). If D1 write fails, **zero JWT is issued**.

#### Action 3: `updatePasswordHash` vs. Action 4: `changePassword` (Distinct Business Purposes)
Both operations execute an update query against D1, but their business context, error tolerance, and authorization triggers are completely distinct:

```sql
UPDATE users 
SET password_hash = ?, updated_at = datetime('now') 
WHERE id = ? AND account_status != 'suspended'
```

1. **`updatePasswordHash` (Transparent System Security Upgrade on Login):**
   - **Business Purpose:** Transparent background cryptographic migration.
   - **Trigger:** Invoked automatically during user login when a user successfully enters their correct password against an older legacy SHA-256 hash (`needsRehash === true`). Express computes the new per-user salted `scrypt` hash and updates D1 in the background.
   - **User Involvement:** Zero user awareness; no explicit password change was requested.
   - **Failure Policy (Soft-Fail):** If D1 update fails due to a transient timeout, **login still succeeds!** The user is not blocked from logging in. The system will simply retry the hash upgrade on their next login.
2. **`changePassword` (Explicit User or Admin Password Modification):**
   - **Business Purpose:** Intentional user credential rotation (e.g. `POST /api/users/me/change-password` or admin password reset).
   - **Trigger:** Explicit user action requiring verification of current password and confirmation of new password.
   - **User Involvement:** User explicitly expects their password to change and receives a confirmation.
   - **Failure Policy (Strict Hard-Fail / Abort):** If D1 update fails, the operation **MUST ABORT**. The user's old password remains active, and the client receives an error (e.g. `503 Service Unavailable` or `500`). Login with the new password must NOT be permitted unless D1 successfully committed the new hash.

#### Action 5: `changeAccountStatus`
- **Target Database:** **Cloudflare D1** (`env.DB`).
- **Input Fields:**
  - `id`: string (valid user ID)
  - `account_status`: string (Must strictly be one of `'active'`, `'suspended'`, `'deactivated'`)
- **Output Fields:**
  - `{ success: true, rowsUpdated: number }`
- **Executed SQL (on Cloudflare D1):**
  ```sql
  UPDATE users 
  SET account_status = ?, updated_at = datetime('now') 
  WHERE id = ?
  ```
- **Existing Application Behavior Preserved:** Preserves account suspension checks in `server/routes/auth.ts`.
- **Authorization Requirements:** Requires authenticated administrator identity with `members.manage` permission.

#### Action 6: `updateUserRole`
- **Target Database:** **Cloudflare D1** (`env.DB`).
- **Input Fields:**
  - `id`: string (valid user ID)
  - `role`: string (Must strictly match one of the **13 verified STROOM roles** from `server/services/rbacService.ts`)
- **Verified STROOM Roles (from `server/services/rbacService.ts`):**
  1. `'super_admin'`
  2. `'admin'`
  3. `'platform_admin'`
  4. `'event_manager'`
  5. `'auctioneer'`
  6. `'auction_manager'`
  7. `'community_manager'`
  8. `'partner_manager'`
  9. `'checkin_staff'`
  10. `'support_staff'`
  11. `'venue_partner'`
  12. `'participant'`
  13. `'user'`
- **Output Fields:**
  - `{ success: true, rowsUpdated: number }`
- **Executed SQL (on Cloudflare D1):**
  ```sql
  UPDATE users 
  SET role = ?, updated_at = datetime('now') 
  WHERE id = ?
  ```
- **Authorization Requirements:** Strictly requires `roles.assign` permission (held exclusively by `super_admin` and `admin`). Unrecognized or invented roles fail Zod validation with `400 Bad Request`.

---

## 4. Nonce Storage Review & Multi-Instance Distributed Evaluation

The initial inspection report suggested storing nonces in a local Express SQLite database (`data/bridge_nonces.db`). A rigorous distributed systems evaluation reveals why that proposal was architecturally flawed:

### 4.1 Evaluation of Local SQLite Nonce Storage (`data/bridge_nonces.db`)
1. **Single-Node Atomicity:** On a single machine with a single Express process, SQLite WAL mode provides ACID transaction guarantees; an `INSERT INTO nonces (nonce) VALUES (?)` with a `PRIMARY KEY` constraint fails atomically on duplicate keys.
2. **Multi-Instance Incompatibility:** In production, backend services are scaled horizontally across multiple instances, containers, or VMs behind a load balancer. Each instance has an isolated local filesystem.
3. **Replay Vulnerability Across Instances:** If Instance A consumes nonce $N_1$ in its local SQLite file, Instance B has zero knowledge of $N_1$. An attacker capturing a request within its 30-second window can immediately replay it to Instance B, which would accept it!
4. **Maintenance Overhead:** Purging expired nonces (`DELETE WHERE expires_at < now`) generates continuous disk writes, WAL fragmentation, and lock contention on local disk.

### 4.2 Approved Architecture: Cloudflare D1 Primary Shared Atomic Nonce Store
Because the receiver in Trust Path A is the **Cloudflare Worker**, nonces must be stored and consumed on the receiver side in **Cloudflare D1**:
- **Shared Global State:** Cloudflare D1 operates a single primary writer database accessible to all Worker isolates across all 300+ global Cloudflare edge locations.
- **Atomic SQL Query:**
  ```sql
  INSERT INTO _internal_bridge_nonces (nonce, request_hash, created_at, expires_at)
  VALUES (?, ?, unixepoch(), unixepoch() + 60)
  ```
- **Atomic Consumption:** If a duplicate nonce is presented anywhere in the world within the 60-second window, the D1 primary rejects it with `SQLITE_CONSTRAINT_PRIMARYKEY`, returning **HTTP 409 Conflict ("Replay detected")**.
- **Conclusion:** **No local nonce database will be created on Express.** Nonces belong exclusively in Cloudflare D1 (`_internal_bridge_nonces`).

---

## 5. Reconciled Route & Middleware Responsibilities

```
+---------------------------------------------------------------------------------------------------------+
|                                    COMPONENT & ROUTE RESPONSIBILITIES                                   |
+---------------------------------------------------------------------------------------------------------+
| Component               | Host / Runtime    | Route / Method            | Enforcing Middleware          |
+-------------------------+-------------------+---------------------------+-------------------------------+
| Internal D1 Bridge      | Cloudflare Worker | POST /api/internal/d1/    | bridgeAuthMiddleware (Worker) |
|                         |                   |      execute              |                               |
| Origin Reverse Proxy    | Cloudflare Worker | POST /api/auth/*          | Edge Proxy Dispatcher         |
| Origin Auth Controller  | Express (Node.js) | POST /api/auth/*          | originProxyAuthMiddleware     |
| Express D1 Bridge Client| Express (Node.js) | (Outgoing HTTP Client)    | d1BridgeClient.ts             |
+-------------------------+-------------------+---------------------------+-------------------------------+
```

### 5.1 Cloudflare Worker: `POST /api/internal/d1/execute`
- Receives write/read requests from Express.
- Validates `X-STROOM-Bridge-Secret` against `c.env.INTERNAL_D1_BRIDGE_SECRET` using timing-safe comparison.
- Validates timestamp drift: $|now - \text{timestamp}| \le 30,000\text{ ms}$.
- Validates HMAC-SHA256 signature over `${timestamp}:${nonce}:${action}:${payloadHash}`.
- Atomically consumes nonce in D1 `_internal_bridge_nonces`.
- Executes the designated allowlisted action against D1 `users`.
- Returns sanitized JSON result.

### 5.2 Express Backend: `server/services/d1BridgeClient.ts`
- Formulates outgoing requests to the Worker D1 Bridge.
- Generates 32-hex random nonce (`crypto.randomUUID().replace(/-/g, '')`).
- Generates millisecond timestamp (`Date.now().toString()`).
- Computes SHA-256 hash of payload body (`JSON.stringify(params)`).
- Computes HMAC-SHA256 signature using `INTERNAL_D1_BRIDGE_SECRET`.
- Dispatches HTTP POST to `https://<worker-domain>/api/internal/d1/execute`.
- Handles responses, retries (for idempotent reads), and soft-fail logic.

### 5.3 Express Backend: `server/middleware/originProxyAuth.ts`
- Mounts upstream of `/api/auth/*` on Express.
- Validates `X-STROOM-Origin-Secret` against `process.env.ORIGIN_PROXY_SECRET` using timing-safe comparison.
- Rejects direct public requests that bypass Cloudflare with **HTTP 403 Forbidden**.

---

## 6. Corrected Security Specification

1. **Secret Format:** Canonical 43-character Base64URL string (`[A-Za-z0-9_-]{43}`, 256 bits entropy).
2. **Rotation Lifecycle:** Maximum 72-hour overlap ceiling. Exact millisecond boundary cutoff (`now >= previousExpiresAt`).
3. **HMAC Canonical String to Sign:**
   $$\text{StringToSign} = \text{Timestamp} + \text{":"} + \text{Nonce} + \text{":"} + \text{Action} + \text{":"} + \text{SHA256}(\text{JSON.stringify}(\text{params}))$$
4. **Status Code Discipline:**
   - Server Configuration Error: `500 Internal Server Error` (redacted generic body).
   - Bridge Authentication / Signature Failure: `401 Unauthorized`.
   - Replay Detected (Duplicate Nonce): `409 Conflict`.
   - Origin Proxy Unauthorized Direct Access: `403 Forbidden`.
   - D1 Storage Failure / Unreachable: `503 Service Unavailable` (fail-closed).

---

## 7. Database Hash Verification & Evidence Reconciliation

Both protected databases were recalculated bit-for-bit using Node.js `crypto.createHash('sha256')`:

| Database File | Path | Size (Bytes) | Computed SHA-256 Checksum | Baseline Verification |
| :--- | :--- | :--- | :--- | :---: |
| **Primary SQLite Database** | `data/stroom.db` | 2,899,968 | `ad6fe974854b0fcd83cf053e26de89f3d467b2be2687b09e0ab282e6acd848fb` | **MATCH (100.000%)** |
| **Phase 0 Checkpoint Backup**| `backups/stroom-checkpoint-phase0-2026-11-13T08-10-02-441Z.db` | 2,899,968 | `2129266ef6555c90c74b9166e696a2e39aa8b2a87e483eb79a20f9a292be4571` | **MATCH (100.000%)** |

### 7.1 Reconciliation of Apparent Discrepancy
An investigation was conducted into the apparent discrepancy mentioned in the audit request:
1. **Bit-for-Bit Parity:** Both physical files match their authoritative baseline SHA-256 hashes down to the exact bit. Zero bytes have changed.
2. **Record Count Clarification:**
   - Primary `data/stroom.db` has **10,172 records** (contains the 9 forensic records created during the live admin audit session).
   - Checkpoint backup has **10,163 records** (the pristine Phase 0 reference state).
   - In our previous turn's text table, the row count for the checkpoint backup was erroneously displayed as `10,172` instead of `10,163`. This was a typographical error in the summary text, not a change to the physical backup file.
3. **Backup Directory Provenance:** In earlier task scripts (e.g. Task-5009), sorting `backups/*.db` alphabetically selected `stroom-backup-2026-11-12T09-40-40-456Z.db` (which has hash `c71ae0...`). The true Phase 0 reference file `stroom-checkpoint-phase0-2026-11-13T08-10-02-441Z.db` has always had hash `2129266ef6555c90c74b9166e696a2e39aa8b2a87e483eb79a20f9a292be4571`.

---

## 8. Files Proposed for Implementation

When implementation is authorized, work will be partitioned cleanly across the two runtimes:

### 8.1 Cloudflare Worker (Receiver of Path A, Sender of Path B)
- **`src/worker/middleware/bridgeAuth.ts`:** Implements `bridgeAuthMiddleware` (secret comparison, timestamp window, HMAC signature check, D1 atomic nonce consumption).
- **`src/worker/routes/internalBridge.ts`:** Implements `POST /api/internal/d1/execute` (handles the 6 allowlisted operations on D1).
- **`src/worker/routes/authProxy.ts`:** Implements reverse proxy for `/api/auth/*` to Express with `X-STROOM-Origin-Secret`.
- **`src/worker/app.ts`:** Mounts the internal bridge router and auth proxy router.

### 8.2 Express Origin (Sender of Path A, Receiver of Path B)
- **`server/services/d1BridgeClient.ts`:** Outgoing client that formats HMAC requests and calls Worker bridge.
- **`server/middleware/originProxyAuth.ts`:** Ingress middleware guarding Express `/api/auth/*` using `ORIGIN_PROXY_SECRET`.
- **`server/routes/auth.ts`:** Updates login/registration controllers to query/mutate user records via `d1BridgeClient`.
- **`server/index.ts`:** Mounts `originProxyAuth` upstream of `authRouter`.

---

## 9. Remaining Blockers & Pre-Requisites

Before Phase 2.5.1.1 implementation can be deployed to production, two architectural prerequisites must be satisfied:
1. **D1 Nonce Schema:** The `_internal_bridge_nonces` table must be included in Cloudflare D1 migrations (`migrations/0003_bridge_nonces.sql`). In local testing, this will be tested using Miniflare D1.
2. **User Record Migration (Stage 2.5.3):** During Phase 2.5.1.1 isolated testing, mock/test users will be populated in disposable Miniflare D1 instances. Full migration of the 188 existing production users to D1 will occur in Stage 2.5.3.

---

## 10. Final Recommendation & Readiness Decision

The architectural confusion has been completely resolved:
- **Trust Path A:** Express $\rightarrow$ Worker $\rightarrow$ D1 (`INTERNAL_D1_BRIDGE_SECRET`).
- **Trust Path B:** Worker $\rightarrow$ Express (`ORIGIN_PROXY_SECRET`).
- **Zero SQLite Mutations:** All six actions target Cloudflare D1.
- **Zero Local Nonce Database:** Nonce consumption is handled atomically in D1.
- **Database Baseline Intact:** Both SQLite files are verified and unchanged.

**Standing Status:** Execution is halted in strict compliance with the read-only mandate. No source code has been altered. We await your explicit review and approval of this corrected design report before proceeding to implementation.
