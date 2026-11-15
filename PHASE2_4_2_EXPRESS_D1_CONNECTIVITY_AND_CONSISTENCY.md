# STROOM — Phase 2.4.2: Express-to-D1 Connectivity & Write Consistency

**Project:** `D:\ST`  
**Branch:** `feature/stroom-production-launch`  
**Approved Baseline Commit:** `19c4176`  
**Document Version:** 1.0.0 (Phase 2.4.2 Technical Specification)  
**Security Classification:** Critical Data Consistency Architecture  
**Phase Status:** **APPROVED FOR PHASE 2.5 IMPLEMENTATION PLANNING**

---

## 1. Executive Summary & Problem Definition

In the STROOM hybrid serverless architecture:
- **Express Origin** remains responsible for computationally intensive password verification, scrypt hashing, and legacy SHA-256 upgrades.
- **Cloudflare D1** is the authoritative database for the serverless platform, serving all read and write queries for migrated Worker endpoints.

This creates a critical architectural requirement: **How does the external Node.js / Express process communicate with Cloudflare D1 to maintain data consistency?**

An external Node.js process cannot use a Cloudflare Worker Service Binding directly (Service Bindings operate exclusively within the Cloudflare Workers V8 isolate environment). This document evaluates the supported communication mechanisms, selects a production architecture, and defines the complete write contract, failure modes, and recovery protocols.

---

## 2. Evaluation of Express-to-D1 Connectivity Mechanisms

Three communication mechanisms were evaluated:

```
Mechanism 1: Direct Cloudflare D1 REST API
[Express] ──(HTTPS POST + Cloudflare API Token)──► [Cloudflare v4 REST API] ──► [Cloudflare D1]

Mechanism 2: Authenticated Worker Internal Data Bridge (RECOMMENDED)
[Express] ──(HTTPS POST + Internal HMAC Secret)──► [Worker /api/internal/d1] ──► [D1 Binding (env.DB)]

Mechanism 3: Dual-Write (Express writes SQLite, Worker syncs D1)
[Express] ──► [data/stroom.db] ──(Asynchronous Sync Pipeline)──► [Cloudflare D1]
```

---

### 2.1 Detailed Mechanism Comparison

| Architectural Dimension | Mechanism 1: Cloudflare D1 REST API | Mechanism 2: Authenticated Worker Bridge (Recommended) | Mechanism 3: Dual-Write Async Sync |
| :--- | :--- | :--- | :--- |
| **Official Documentation** | [Cloudflare D1 REST API](https://developers.cloudflare.com/api/resources/d1/subresources/database/methods/query/) | [Cloudflare Worker Fetch API](https://developers.cloudflare.com/workers/runtime-apis/fetch/) | Custom synchronization code |
| **Local Dev Compatibility** | **Incompatible.** D1 REST API connects only to remote Cloudflare D1, not local Miniflare SQLite. | **100% Compatible.** Connects to local D1 Miniflare (`env.DB`) in dev; remote D1 in prod. | Partial. Requires maintaining two SQLite engines locally. |
| **Rate Limits & Quotas** | Cloudflare API rate limit: **1,200 req / 5 min** per user/token (~4 req/s global cap). | Standard Worker request allowance: **100,000 req / day** free (no 4 req/s throttle). | Bounded by disk I/O. |
| **Round-Trip Latency** | **180–350 ms** (traverses Cloudflare management control plane). | **35–80 ms** (direct edge Worker execution to D1). | 5–15 ms local; sync lag seconds. |
| **Parameterization Safety** | JSON SQL + params array. | Native `stmt.bind(...params)` in D1 client wrapper. | Raw better-sqlite3 statements. |
| **Authentication & Boundary** | Cloudflare API Bearer Token (requires Account ID + Database ID). | Pre-shared internal secret (`X-Internal-Service-Key`, $\ge 64$ hex chars). | Direct filesystem permissions. |
| **Transactional Support** | Supports batch query array via REST endpoint. | Supports `env.DB.batch([stmt1, stmt2])` atomic execution. | Local SQLite WAL transaction; sync async. |

---

### 2.2 Recommended Mechanism: Authenticated Worker Internal Bridge

> [!IMPORTANT]
> **Decision: Adopt Mechanism 2 (Authenticated Worker Internal Bridge)**.
> 
> 1. **Unified Environment Parity:** Express sends internal write requests to `/api/internal/d1/execute`. In local development, the local Worker writes to Miniflare D1 (`.wrangler/state/v3/d1/...sqlite`). In production, the Worker writes to remote Cloudflare D1 via native `env.DB` bindings.
> 2. **Zero Global API Throttling:** Bypasses Cloudflare REST API management rate limits (1,200 req/5 min).
> 3. **Edge Performance:** Executes in 35–80ms compared to 250ms+ for Cloudflare management endpoints.
> 4. **Strict Isolation:** Endpoint is locked via `X-Internal-Service-Key` header validation and IP/origin firewalling; external clients cannot invoke it.

---

## 3. Comprehensive Write Contract Specification

For every user mutation operation handled by Express, the write contract establishes transactional boundaries, failure handling, and JWT issuance eligibility.

### 3.1 Operation 1: User Registration (`POST /api/auth/register`)

```
Client ──► Express: POST /api/auth/register
             │
             ├── 1. Zod schema validation (email, password, full_name)
             ├── 2. Hash password with scrypt (N=16384, r=8, p=1, keylen=64)
             ├── 3. Send write to Worker Bridge: INSERT INTO users ...
             │
             ├── If D1 Write SUCCEEDS:
             │     └── Issue 7-day HS256 JWT ──► Return 201 Created { token, user }
             │
             └── If D1 Write FAILS (Network drop, timeout, or constraint error):
                   ├── STRICT CONTRACT: ZERO JWT MAY BE ISSUED!
                   └── Return 503 Service Unavailable / 409 Conflict
```

#### Contract Rules for Registration:
- **Authoritative System:** Cloudflare D1.
- **Transactional Guarantee:** Atomic insert into `users` table.
- **Failed Write Policy:** **ABSOLUTELY NO JWT MAY BE ISSUED**. If Express issued a JWT after a failed D1 insert, the client would attempt to access `/api/*` endpoints on Workers, where D1 user lookup would fail, returning `401 Unauthorized`.
- **Duplicate Request Handling:** The `users.email` column has a `UNIQUE` constraint. Duplicate submissions return `SQLITE_CONSTRAINT`, which Express maps to `409 Conflict` (`"An account with this email already exists"`).
- **Recovery:** Client receives `503 Service Unavailable` or `409 Conflict`; no orphan records are created.

---

### 3.2 Operation 2: Legacy SHA-256 Hash Upgrade on Login (`POST /api/auth/login`)

```
Client ──► Express: POST /api/auth/login
             │
             ├── 1. Fetch user by email via Worker Bridge (or local read)
             ├── 2. Verify password:
             │     ├── Modern scrypt? -> crypto.timingSafeEqual()
             │     └── Legacy SHA-256? -> sha256(pw + pepper) -> Match -> needsRehash = true
             │
             ├── 3. If credentials INVALID:
             │     └── Return 401 Unauthorized ("Invalid email or password")
             │
             ├── 4. If credentials VALID and needsRehash === true:
             │     ├── Generate fresh scrypt hash (N=16384, r=8, p=1)
             │     └── Attempt D1 Update: UPDATE users SET password_hash = ? WHERE id = ?
             │           │
             │           ├── If Update SUCCEEDS: Hash upgraded permanently in D1.
             │           └── If Update FAILS: Log internal warning. DO NOT BLOCK LOGIN!
             │
             └── 5. Issue 7-day HS256 JWT ──► Return 200 OK { token, user }
```

#### Contract Rules for Legacy Upgrade:
- **Authoritative System:** Cloudflare D1.
- **Failed Write Policy:** **LOGIN SUCCEEDS**. The user provided correct credentials. If the D1 write fails due to transient network congestion, Express issues the JWT and logs an alert. The legacy SHA-256 hash remains in D1, so on the user's next login, Express will automatically attempt the upgrade again.
- **Idempotency:** Re-running the upgrade is idempotent; subsequent successful logins simply overwrite the hash with a fresh scrypt salt.

---

### 3.3 Operation 3: Password Change (`POST /api/users/me/change-password`)

```
Client ──► Express: POST /api/users/me/change-password
             │
             ├── 1. Verify current_password against stored hash
             ├── 2. Validate new_password complexity (6–128 chars)
             ├── 3. Generate new scrypt hash
             ├── 4. Send write to Worker Bridge:
             │     UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?
             │
             ├── If D1 Write SUCCEEDS:
             │     └── Return 200 OK { success: true, message: "Password updated successfully" }
             │
             └── If D1 Write FAILS:
                   └── Return 503 Service Unavailable ("Failed to update password. Please try again.")
```

#### Contract Rules for Password Change:
- **Authoritative System:** Cloudflare D1.
- **Failed Write Policy:** Express aborts the operation. Password in D1 remains unchanged. User continues using their existing password.
- **Token Invalidation:** Under the 30-second bounded cache design, previous tokens expire naturally or upon session version bump.

---

### 3.4 Summary of User Mutation Operations

| Operation | Trigger | Target Table / Columns | Authoritative System | Transactional? | On Failure: Issue JWT? | Client Response on Failure |
| :--- | :--- | :--- | :---: | :---: | :---: | :--- |
| **New Registration** | `POST /api/auth/register` | `users` (`id`, `email`, `password_hash`, `full_name`, `role`) | D1 | Yes | **NO (Forbidden)** | `503` or `409 Conflict` |
| **Legacy Hash Upgrade** | `POST /api/auth/login` | `users` (`password_hash`, `updated_at`) | D1 | Yes | **YES (Permitted)**| `200 OK` (Retry on next login) |
| **Password Change** | `POST /api/users/me/change-password` | `users` (`password_hash`, `updated_at`) | D1 | Yes | N/A | `503 Service Unavailable` |
| **Account Suspension** | Admin Action | `users` (`account_status`, `updated_at`) | D1 | Yes | N/A | `503 Service Unavailable` |
| **Role Assignment** | Admin Action | `users` (`role`, `updated_at`) | D1 | Yes | N/A | `503 Service Unavailable` |

---

## 4. Internal Worker Bridge API Specification

> [!CAUTION]
> **Prohibition of Dynamic SQL Execution (Phase 2.4.3 Security Correction):**  
> Dynamic SQL submission (`{ query: string, params: [] }`) is strictly prohibited.  
> As formally specified in [`PHASE2_4_3_D1_BRIDGE_SECURITY_CONTRACT.md`](file:///D:/ST/PHASE2_4_3_D1_BRIDGE_SECURITY_CONTRACT.md), the internal bridge exclusively accepts a **fixed allowlist of six named operations** (`getUserForLogin`, `createUser`, `updatePasswordHash`, `changePassword`, `changeAccountStatus`, `updateUserRole`).  
> Zero raw SQL is accepted over the wire. The SQL statements are hardcoded as immutable constants in the Worker bridge code.

- **Path:** `POST /api/internal/d1/dispatch`
- **Access Gate:**
  1. Header Check: `X-Internal-Bridge-Secret` must match `c.env.INTERNAL_D1_BRIDGE_SECRET` ($\ge 64$ random hex characters) using constant-time comparison (`crypto.subtle.timingSafeEqual`).
  2. Origin Check: Request must originate from the authorized Express origin via Cloudflare Tunnel.
- **Payload Schema:**
  ```json
  {
    "action": "createUser",
    "params": {
      "id": "usr_4f2b1a8c9e0d11ef",
      "email": "user@stroom.app",
      "password_hash": "[REDACTED_SCRYPT_HASH]",
      "full_name": "New User",
      "avatar_url": "https://api.dicebear.com/..."
    }
  }
  ```
- **Logging Sanitization Rule:**
  The Worker bridge MUST NOT log `password_hash`, `salt`, or user credentials. Error messages must redact all sensitive fields.
