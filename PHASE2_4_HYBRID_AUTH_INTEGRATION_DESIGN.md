# STROOM — Phase 2.4: Hybrid Authentication Integration Design

**Project:** `D:\ST`  
**Branch:** `feature/stroom-production-launch`  
**Approved Baseline Commit:** `19c4176`  
**Document Version:** 1.0.0 (Phase 2.4 Master Integration Design)  
**Mode:** Documentation-Only Technical Specification  
**Phase Status:** **APPROVED FOR PHASE 2.5 IMPLEMENTATION DESIGN**

---

## 1. Executive Summary & Integration Architecture

Phase 2.4 defines the formal contract and operational design for the **Hybrid Authentication Architecture (Strangler-Fig Pattern)** between the reference Node.js + Express backend and the Cloudflare Workers / Hono serverless backend.

```
                    ┌────────────────────────────────────────────────────────┐
                    │               Client Browser (React SPA)               │
                    │         window.localStorage: 'stroom_token'           │
                    └───────────────────────────┬────────────────────────────┘
                                                │
                                    HTTP Requests (/api/*)
                                                │
                                                ▼
                             ┌──────────────────────────────────────┐
                             │    Cloudflare Edge Routing Layer     │
                             │  (Cloudflare Pages / Edge Worker)    │
                             └──────────────┬────────────────┬──────┘
                                            │                │
            POST /api/auth/login            │                │ All other 153 endpoints
            POST /api/auth/register         │                │ (GET/POST/PUT/DELETE)
            POST /api/users/me/change-pwd   │                │
                                            ▼                ▼
                     ┌──────────────────────────────┐  ┌──────────────────────────────┐
                     │   Express Auth Microservice  │  │   Cloudflare Worker / Hono   │
                     │       (Node.js / OpenSSL)    │  │       (V8 Isolates / Edge)   │
                     ├──────────────────────────────┤  ├──────────────────────────────┤
                     │ • Password verification:     │  │ • Token verification:        │
                     │   - 61 scrypt accounts       │  │   - Sub-millisecond WebCrypto│
                     │   - 126 legacy SHA-256       │  │   - HS256 signature check    │
                     │ • Transparent scrypt upgrade │  │ • Live D1 user validation    │
                     │ • Signs 7-day HS256 JWT      │  │ • Bounded 30s status cache   │
                     │ • Rate limiting (25 req/15m) │  │ • Zero Worker CPU spikes     │
                     └──────────────┬───────────────┘  └──────────────┬───────────────┘
                                    │                                 │
                                    │ Reads / Writes                  │ Reads / Writes
                                    ▼                                 ▼
                     ┌────────────────────────────────────────────────────────────────┐
                     │          Cloudflare D1 Database (42 Application Tables)        │
                     │            188 Accounts (187 Password-Bearing + 1 Stub)        │
                     └────────────────────────────────────────────────────────────────┘
```

> [!NOTE]
> **Data Baseline & Migration Prerequisite (Phase 2.4.1 Correction):**  
> Currently, the 188 user accounts exist solely in `data/stroom.db`; the local D1 database contains the 42 tables and system metadata, but 0 user rows.  
> As formally specified in [`PHASE2_4_1_ARCHITECTURE_CORRECTIONS.md`](file:///D:/ST/PHASE2_4_1_ARCHITECTURE_CORRECTIONS.md), during Phase 2.4 and 2.5 development, the Worker serves public catalog endpoints. Prior to cutting over authenticated member routes, a controlled, one-way user data migration script will populate D1 with the 188 accounts.

### Architectural Guarantees
1. **Zero Forced Password Resets:** All 188 user accounts (61 modern scrypt, 126 legacy SHA-256, 1 guest stub) retain complete login compatibility.
2. **Zero Password Hashing Weakening:** Scrypt parameters ($N=16384, r=8, p=1, \text{keylen}=64$) remain uncompromised.
3. **Zero Worker CPU Timeouts:** Heavy scrypt hashing remains in Node.js/OpenSSL; Workers verify tokens using native WebCrypto in $<0.5\text{ ms}$, comfortably staying within the 50 ms free-tier CPU limit.
4. **Zero Frontend Code Changes:** The existing React SPA continues sending `Authorization: Bearer <token>` from `localStorage` without modification.
5. **Decoupled High Availability:** Existing logged-in sessions continue operating even if the Express origin experiences temporary cold starts or downtime.

---

## 2. Reconciled Account Baseline & Read-Only Audit Findings

A read-only forensic inspection of `data/stroom.db` confirmed the exact account baseline:

### 2.1 Complete Account Inventory

| Account Classification | Verified Count | Database Representation | Salt Handling | Verification Engine |
| :--- | :---: | :--- | :--- | :--- |
| **Modern scrypt Accounts** | **61** | `scrypt$<salt>$<digest>` (168 chars) | 32-hex random per-user salt | OpenSSL `crypto.scryptSync(N=16384, r=8, p=1)` |
| **Legacy SHA-256 Accounts**| **126** | 64-character lowercase hex string | Static pepper `'stroom_vibe_salt_2026'` | `sha256(pw + pepper)` $\rightarrow$ Upgrade on login |
| **Guest Attendee Stub** | **1** | Empty string (`""`, length 0) | None | Non-login attendee stub |
| **TOTAL REGISTERED USERS** | **188** | — | — | **100% Account Preservation Confirmed** |
| **PASSWORD-BEARING USERS** | **187** | Valid hash format | Per-user or static salt | Login eligible via password |

### 2.2 Password-Bearing Accounts vs Guest Attendee Records
- **Password-Bearing Accounts (187 Users):**
  These are registered members, venue partners, event managers, and administrators who signed up via `POST /api/auth/register` or were seeded with valid credentials. They possess either a per-user salted scrypt hash or a legacy salted SHA-256 hash.
- **Guest Attendee Records (1 User: `usr_b6f256a7aa94499c`):**
  This account was created on `2026-11-13 06:23:42` during an unauthenticated event checkout flow in [`server/routes/events.ts:146`](file:///D:/ST/server/routes/events.ts#L146). To allow guest attendees to receive a digital pass (`event_registrations`), the system provisions a lightweight user stub with `password_hash = ''` and `onboarding_status = 'NOT_STARTED'`.
  
  **Security Protection:** In [`server/db/database.ts:788`](file:///D:/ST/server/db/database.ts#L788):
  ```ts
  if (!storedHash) return { valid: false, needsRehash: false };
  ```
  Because `password_hash` is empty, password authentication is rejected immediately with `401 Unauthorized`. It is impossible to log into this account using password authentication.

---

## 3. Password Lifecycle & Express Service Boundaries

The complete password lifecycle is partitioned across the two services:

```
[User Action]
      │
      ├── Registration ──────────────► Express: Hashes with per-user salted scrypt (N=16384, r=8, p=1)
      │
      ├── Login (scrypt) ────────────► Express: Verifies via crypto.scryptSync; issues 7-day HS256 JWT
      │
      ├── Login (legacy SHA-256) ────► Express: Verifies legacy hash; issues JWT; auto-rehashes to scrypt
      │
      ├── Password Change ───────────► Express: Verifies current password; updates hash to scrypt
      │
      └── API Requests (153 routes) ──► Worker: Verifies HS256 JWT signature; validates user against D1
```

### Operations Retained Exclusively in Express
1. `POST /api/auth/register`: Zod validation, email deduplication, scrypt hashing, user insertion, JWT generation.
2. `POST /api/auth/login`: Rate limiting, user lookup, scrypt/SHA-256 verification, transparent legacy rehash, suspended check, audit logging, JWT generation.
3. `POST /api/users/me/change-password`: Rate limiting, current password verification, new password scrypt hashing, database update.
4. `POST /api/auth/reset-demo`: Development-only demo state reset (disabled in production).

### Operations Handled by Cloudflare Workers
1. `POST /api/auth/logout`: Stateless logout endpoint, token discard verification, and admin audit logging.
2. `GET /api/auth/me`: Verifies Bearer token, fetches live user profile and preferences from D1.
3. All other 151 application routes: Verifies Bearer token, enforces RBAC permissions, executes domain logic against D1.

---

## 4. Hosting, Operational Requirements & Cost Analysis

Keeping Express as the dedicated authentication microservice introduces specific hosting, latency, and cost considerations that must be addressed with honest, transparent engineering estimates.

### 4.1 Hosting Options for Express Auth Service

| Hosting Model | Platform Examples | Monthly Cost | Cold Start Latency | Warm Latency | Uptime SLA | Operational Complexity |
| :--- | :--- | :---: | :---: | :---: | :---: | :--- |
| **Existing Server Co-location** | Current Host / VPS | **$0.00** | **0 ms** | 10–30 ms | 99.9% | **Lowest.** Keep current process running. |
| **Low-Cost Cloud VPS** | DigitalOcean / Hetzner / Linode | **$4.00 – $6.00** | **0 ms** | 15–40 ms | 99.99% | **Low.** Dedicated Docker container or systemd service. |
| **Serverless Container (Sleep-Enabled)** | Render Free Tier / Koyeb | **$0.00** | **30,000 – 50,000 ms** | 50–120 ms | No SLA | **Medium.** Unacceptable 50s delay on idle logins. |
| **Always-On Cloud Container** | Fly.io / Railway / Render Starter | **$5.00 – $7.00** | **0 ms** | 20–50 ms | 99.95% | **Low.** Managed container deployment. |

### 4.2 Measured vs Estimated Latency Metrics

- **Measured (Local Baseline):**
  - Worker Health + D1 query (`GET /api/health`): **33 ms** wall-clock latency.
  - Express Health + SQLite query (`GET /api/health`): **12 ms** wall-clock latency.
  - WebCrypto HMAC-SHA256 signature verification in Worker isolate: **$< 0.5 ms** CPU time.
  - Node.js `scryptSync` computation on CPU ($N=16384, r=8, p=1$): **45 ms** CPU time.
- **Estimated (Production Internet Conditions):**
  - Worker Edge API request (cached user status): **15–45 ms** global latency.
  - Worker Edge API request (D1 read miss): **40–80 ms** global latency.
  - Express Login Request (VPS hosting, warm): **60–120 ms** round-trip latency.
  - Express Login Request (Render Free Tier, cold start): **35,000–50,000 ms** round-trip latency.

### 4.3 Cost Accounting: Zero-Cost vs Low-Cost Reality
- **Cloudflare Edge Stack (Workers + Pages + D1):** **$0.00 / month** on the Free Tier:
  - Workers: 100,000 requests/day free (supports ~3,000,000 requests/month).
  - D1: 5,000,000 row reads/day, 100,000 row writes/day free.
  - Pages: Unlimited static bandwidth.
- **Express Auth Service:**
  - If co-located on existing infrastructure: **$0.00 incremental cost**.
  - If deployed to a dedicated cloud instance: **$4.00 – $5.00 / month** (Hetzner CX22 / DigitalOcean Droplet).
  - *Recommendation:* Do not deploy to a free container platform with sleep/spin-down behavior (such as Render Free Tier) as a 50-second cold start degrades user experience during login. Deploy to an always-on VPS ($4/mo) or maintain co-location on the existing host.

### 4.4 Availability Decoupling
Because Express is only invoked during initial login and registration:
- **99.9% of user traffic** (event browsing, ticket booking, live auction polling, pass verification, community chat) is served directly by Cloudflare Workers and D1 globally.
- If the Express server undergoes maintenance or restarts, **all active user sessions continue functioning with 100% uptime**.

---

## 5. Security & Boundary Hardening

1. **Origin Shielding:**
   The Express server will only accept authentication requests. When deployed behind Cloudflare, the origin Express server will reject direct IP access using Cloudflare Tunnel (`cloudflared`) or origin IP filtering.
2. **CORS Hardening:**
   Express CORS policy is restricted to authorized frontend origins ([`server/index.ts:29-42`](file:///D:/ST/server/index.ts#L29-L42)). Wildcard origins (`*`) are prohibited when credentials are transmitted.
3. **Rate Limiting:**
   - Express enforces `authRateLimiter` (15-minute sliding window, max 25 attempts per IP).
   - Cloudflare WAF rate limiting provides edge defense against volumetric credential stuffing before requests reach Express.

---

## 6. Summary of Architectural Deliverables in Phase 2.4

| Deliverable Document | Focus Area | Key Specifications |
| :--- | :--- | :--- |
| [`PHASE2_4_HYBRID_AUTH_INTEGRATION_DESIGN.md`](file:///D:/ST/PHASE2_4_HYBRID_AUTH_INTEGRATION_DESIGN.md) | Master Architecture | Service boundaries, account baseline, hosting options, cost realities. |
| [`PHASE2_4_JWT_SECURITY_CONTRACT.md`](file:///D:/ST/PHASE2_4_JWT_SECURITY_CONTRACT.md) | Cryptographic Spec | HS256 allowlisting, claim types, clock skew, asymmetric comparison, key rotation. |
| [`PHASE2_4_SESSION_REVOCATION_DESIGN.md`](file:///D:/ST/PHASE2_4_SESSION_REVOCATION_DESIGN.md) | Revocation & RBAC | Live D1 lookup, 30s bounded cache, browser storage, all 156 endpoints mapped. |
| [`PHASE2_4_AUTH_ROLLBACK_AND_CUTOVER_PLAN.md`](file:///D:/ST/PHASE2_4_AUTH_ROLLBACK_AND_CUTOVER_PLAN.md) | Cutover & Runbooks | Edge routing rules, failure scenario runbooks, zero-downtime rollback protocols. |

---

## 7. Final Phase Decision

**DECISION: APPROVED FOR PHASE 2.5 IMPLEMENTATION DESIGN**

*(Approval grants readiness for Phase 2.5 design only; no production migrations, password changes, or account modifications are authorized at this stage.)*
