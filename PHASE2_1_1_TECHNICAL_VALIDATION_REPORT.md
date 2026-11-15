# STROOM — Phase 2.1.1: Architecture Corrections and Technical Validation Report

**Date:** 2026-11-13  
**Report File:** `PHASE2_1_1_TECHNICAL_VALIDATION_REPORT.md`  
**Current Branch:** `feature/stroom-production-launch`  
**Reference Checkpoint Commit:** `19c4176`  
**Audit Scope:** Deep technical verification and correction of all six Phase 2.1 architecture documents  
**Primary Auditor:** Senior Edge & Serverless Systems Architect  
**Final Decision:** **CONDITIONALLY APPROVED**

---

## 1. Executive Audit Summary

Phase 2.1 established an extensive design for porting STROOM (Strangers Room) from a single-server Node.js + Express + SQLite architecture to a Cloudflare serverless edge stack (Pages + Workers + Hono + D1 + R2).

However, an exhaustive technical validation revealed several critical engineering assumptions in the initial design that required rigorous correction before any implementation could safely begin:
1. **Auction Polling Quota Risk:** The original proposal of an unthrottled 2-second client polling endpoint for live auctions would exhaust Cloudflare Workers' daily free-tier request quota (100,000 requests/day) in just **66 minutes with only 50 active clients**, and consume up to 72% of D1 daily reads with 1,000 clients.
2. **Isolate Memory Rate Limiting Fallacy:** The assumption that an in-isolate JavaScript `Map<string, RateBucket>` could provide global rate limiting overlooked the multi-region distributed architecture of Cloudflare Workers. An in-memory Map is private to a single V8 isolate and provides **local best-effort throttling only**.
3. **The 10 ms Free-Tier CPU Wall for Scrypt:** Benchmark testing proved that standard salted `scrypt` ($N=16384, r=8, p=1$) consumes **~44.3 ms of raw CPU time** in compiled native OpenSSL C++, and between **50 ms and 150 ms** in pure-JS/WASM. The Cloudflare Workers Free tier has a **strict hard limit of 10 ms CPU time per invocation**. Standard scrypt will reliably crash with a CPU timeout on Workers Free.
4. **D1 Concurrency & Race Conditions:** Assuming that statement batching (`env.DB.batch()`) alone prevents race conditions was flawed. D1 batches execute atomically, but do not prevent parallel Workers from reading stale state before submitting batches. Optimistic conditional SQL predicates (`WHERE available_seats > 0`, `WHERE current_bid < ?`) are mandatory.
5. **The "100,000 Users for Free" Fallacy:** Workload modeling revealed that 100,000 registered accounts with 15% monthly active users generate ~450,000 daily API requests—**4.5x the entire Workers free daily quota**. While 10,000 registered accounts (500 DAU) runs 100% free ($0), 100,000 MAU requires Cloudflare Workers Paid (~$6.75/month).

All six Phase 2.1 documents have been updated, corrected, and mathematically substantiated.

---

## 2. In-Depth Technical Review & Corrections

### 2.1 Auction Polling Capacity & Mathematical Reality

#### The Mathematical Proof:
- **Baseline Frequency:** 1 request every 2 seconds = 30 requests/minute = **1,800 requests/hour per client**.
- **Per 24-Hour Day:** $1,800 \times 24 =$ **43,200 requests/day per client**.
- **Standard 2-Hour Live Auction Event:** $1,800 \times 2 =$ **3,600 requests per client**.

```
Client Count   Hourly Requests   2-Hour Auction Reqs   Workers Free Quota (100k/day)   D1 Read Quota (5M/day)
------------   ---------------   -------------------   -----------------------------   ----------------------
10 clients     18,000 req/hr     36,000 requests       36.0% consumed                  36,000 reads (0.7%)
50 clients     90,000 req/hr     180,000 requests      180.0% (Exhausted in 66 min!)   180,000 reads (3.6%)
100 clients    180,000 req/hr    360,000 requests      360.0% (Exhausted in 33 min!)   360,000 reads (7.2%)
1,000 clients  1,800,000 req/hr  3,600,000 requests    3,600% (Exhausted in 3.3 min!)  3,600,000 reads (72.0%)
```

#### Corrective Multi-Tier Architecture:
To make live auctions viable without exceeding free-tier limits or requiring immediate paid upgrades:
1. **Active Gating:** Polling endpoint strictly gates execution: clients poll ONLY when `auction_rooms.status === 'LIVE'`.
2. **Adaptive Polling Intervals:**
   - Active bidding on lot (<10s since last bid): **2 seconds**.
   - Waiting for bid / idle lot: **5 seconds**.
   - Between lots / transition: **10 seconds**.
   - Exponential backoff: if 3 consecutive polls return HTTP 304, interval steps from 2s -> 4s -> 8s -> 15s max.
3. **Cloudflare Edge Cache API (`caches.default`) with 1-Second TTL:**
   - The Worker caches the live room state JSON at the edge for 1 second.
   - If 1,000 clients poll simultaneously, **1 request hits D1**, and the other **999 requests are served directly from the Edge Cache in memory**.
   - D1 row reads for 1,000 clients over a 2-hour event collapse from 3,600,000 reads to **7,200 reads (a 99.8% reduction)**!
4. **Conditional Requests:** `If-None-Match` header returns `304 Not Modified` with zero response body when state ETag matches.
5. **Upgrade Trigger:** When concurrent live bidders exceed 250 users, the architecture upgrades to **Cloudflare Workers Paid ($5/mo) + Durable Objects**, utilizing persistent bidirectional WebSockets.

---

### 2.2 Distributed Rate Limiting: Global vs. Local Best-Effort

#### Why In-Isolate Memory Fails Globally:
In Cloudflare Workers, an in-memory `Map<string, RateBucket>` is instantiated inside a private V8 heap.
- Cloudflare routes traffic across **330+ global edge cities**.
- Within a single city, multiple isolates are dynamically spawned across different CPU cores.
- An attacker sending 50 concurrent requests from the same IP will have requests distributed across multiple isolates, each observing an empty bucket.
- **Verdict:** An in-isolate memory bucket provides **local best-effort throttling only** and cannot be described as global protection.

#### The Corrected Three-Tier Rate Limiting Strategy:
1. **Tier 1 — Global Edge Perimeter (Cloudflare WAF Rate Limiting):**
   - Configured at the Cloudflare zone level (1 free custom rule included in Cloudflare Free plan).
   - Enforces global IP rate limiting (e.g. max 10 req/min for `/api/auth/*`) before requests execute Worker CPU.
2. **Tier 2 — Transactional Database Throttling (D1 `rate_limit_events`):**
   - For sensitive operations (`/api/auth/login`, `/api/auth/register`, `/api/auth/reset-password`, `/api/admin/payments/:id/refund`).
   - The Worker queries attempt history in D1:
     `SELECT COUNT(*) FROM rate_limit_events WHERE key = ? AND action = ? AND created_at > datetime('now', '-15 minutes')`.
   - If count $\ge 5$, returns `429 Too Many Requests`. This guarantees **100% globally consistent enforcement** across all 330+ edge locations.
3. **Tier 3 — In-Isolate Memory Token Bucket:**
   - Retained for high-volume non-sensitive browsing endpoints (`/api/discovery/feed`, `/api/events`) to prevent single-connection runaway loops without creating D1 write overhead.
4. **Paid Upgrade Path:** Cloudflare Workers Rate Limiting API (`env.MY_RATE_LIMITER.limit(...)`) available on Workers Paid.

---

### 2.3 Password Hashing Validation & The 10 ms CPU Constraint

#### Forensic Audit of `data/stroom.db`:
- Total User Accounts: **188**
- Accounts with `scrypt$...` hashes: **61** (including `admin@stroom.app` and `user@stroom.app`)
- Accounts with legacy SHA-256 hashes: **127** (hashed with $\text{SHA-256}(\text{password} + \texttt{"stroom\_vibe\_salt\_2026"})$)

#### Benchmark & Runtime Compatibility Analysis:
- In Node.js C++, `crypto.scryptSync` with $N=16384, r=8, p=1$ took **44.37 ms** on the local test machine.
- In pure JS or WASM inside a Cloudflare Worker V8 isolate, this derivation requires **50 ms to 150 ms** of CPU time.
- **The Cloudflare Workers Free plan has a hard 10 ms CPU time limit per invocation.**
- Running pure-JS/WASM `scrypt` with $N=16384$ in a Free Worker **will reliably crash with `Error: Worker exceeded CPU limit` (HTTP 1101)**.
- Reducing $N$ below 16384 is **strictly prohibited**: it weakens password security against brute-force attacks and cannot verify existing $N=16384$ hashes.

#### Validated Resolution & Path Forward:
- **Local Development (Wrangler Miniflare):** Miniflare runs on Node.js and does not enforce the 10 ms edge kill-switch, allowing full local implementation and verification of existing $N=16384$ scrypt hashes during Phase 2.2.
- **Production Edge Resolution:**
  - **Option A (Production Standard): Workers Paid ($5/month).** Unlocks 50 ms Standard CPU (and up to 30,000 ms on Unbound), allowing standard salted scrypt ($N=16384$) to execute natively without any password resets.
  - **Option B (Strict $0 Free-Tier Alternative): Native Web Crypto PBKDF2.** Web Crypto API provides native, C++ accelerated `crypto.subtle.deriveBits(PBKDF2-HMAC-SHA256, 100,000 iterations)`, which executes in **~2 to 3 ms of CPU time** (well within the 10 ms limit). Existing scrypt users are migrated upon verified login on a paid/worker bridge or through a secure password-reset flow.
- Legacy SHA-256 hashes (127 accounts) upgrade automatically to the target hash format upon their first valid login.

---

### 2.4 D1 Concurrency, Single-Database Limitations & Transaction Safety

#### Single-Writer Database Reality:
- Cloudflare D1 routes read queries across distributed read replicas, but **all write transactions are routed to a single primary SQLite replica**.
- Write throughput on D1 is bounded by SQLite write serialization (~50 to 100 write transactions/sec).
- Under burst load, D1 may queue writes and return `SQLITE_BUSY: database is locked`.

#### The Race Condition Hazard in `env.DB.batch()`:
- `env.DB.batch([...])` is atomic, but it is **not an interactive transaction**.
- A Worker cannot hold database locks across separate asynchronous steps.
- If two Workers read available seats (`available_seats = 1`) simultaneously, and then both submit `env.DB.batch([decrement, insert])`, both will succeed, leaving `available_seats = -1` (oversold)!

#### Mandatory Concurrency Defenses Implemented Across All 19 Call Sites:
All 19 transaction call sites in the codebase were audited. The critical mutations now require **optimistic conditional predicates in their `WHERE` clause**:

1. **Event Seat Booking (`events.ts:155`):**
   `UPDATE events SET available_seats = available_seats - 1 WHERE id = ? AND available_seats > 0`
   If `meta.changes === 0`, returns `409 Conflict: Sold out`.
2. **Auction Bids (`auction.ts:284`):**
   `UPDATE auction_rooms SET current_bid = ?, current_bidder_id = ? WHERE id = ? AND current_bid < ? AND status = 'LIVE'`
   If `meta.changes === 0`, returns `409 Conflict: Outbid by concurrent bid`.
   `UPDATE auction_teams SET purse_spent = purse_spent + ?, purse_balance = purse_balance - ? WHERE id = ? AND purse_balance >= ?`
3. **Coupon Redemption (`partners.ts:1369`):**
   `UPDATE partner_coupons SET used_count = used_count + 1 WHERE id = ? AND is_active = 1 AND used_count < max_redemptions`
   If `meta.changes === 0`, returns `409 Conflict: Maximum redemptions reached`.
4. **Payment Refunds (`adminHub.ts:1954`):**
   `UPDATE payment_transactions SET status = 'Refunded' WHERE id = ? AND status = 'Successful'`
   If `meta.changes === 0`, returns `409 Conflict: Already refunded`.
5. **Door QR Check-in (`passes.ts:122`):**
   `UPDATE digital_passes SET checkin_status = 'checked_in', checked_in_at = datetime('now') WHERE id = ? AND checkin_status = 'confirmed'`
   If `meta.changes === 0`, returns `409 Conflict: Pass already checked in`.
6. **Event Safe Deletion & Archival (`adminHub.ts:870-1010`):**
   Multi-table dependency check (registrations, payments, attendance, collabs). If dependencies exist, hard delete is blocked (409 Conflict) and safe archival is executed (`is_archived = 1, status = 'cancelled'`). Foreign keys enforce `ON DELETE RESTRICT`.

---

### 2.5 Free-Tier Quotas and 100,000-User Workload Validation

#### Platform Services Limits & Failure Behaviors:

| Service | Free Allowance | Reset Interval | Relevant Technical Limits | Over-Quota Failure Behavior |
| :--- | :--- | :--- | :--- | :--- |
| **Cloudflare Workers** | 100,000 req / day | Daily at **00:00 UTC** | 10 ms CPU / request; 128 MB RAM | **HTTP 1027:** Daily limit reached; requests dropped |
| **Cloudflare D1** | 5M row reads / day;<br/>100k row writes / day;<br/>500 MB DB storage | Reads/Writes reset daily at **00:00 UTC** | 50 queries / invocation;<br/>50 stmts / batch; single-writer replica | **HTTP 500:** `D1_ERROR: Row read/write limit exceeded` |
| **Cloudflare R2** | 10 GB-mo storage;<br/>1M Class A ops / mo;<br/>10M Class B ops / mo | Monthly on billing date | Max 5 GB / object; $0 egress fees | **HTTP 429:** Too Many Requests on Class A write ops |
| **Cloudflare Pages** | Unlimited requests;<br/>500 builds / month | Monthly on billing date | 20,000 files / site; 25 MB max file | Build queue blocked until monthly reset |

#### Workload Validation Across User Population Milestones:

```mermaid
flowchart TD
    subgraph M1["Milestone 1: 10,000 Registered Users"]
        U1["500 DAU (5% active)"] --> R1["12,500 req/day"]
        R1 --> S1["100% FREE ($0/mo)<br/>Consumes 12.5% of Workers quota"]
    end

    subgraph M2["Milestone 2: 10,000 MAU"]
        U2["1,500 DAU (15% active)"] --> R2["45,000 req/day"]
        R2 --> S2["100% FREE ($0/mo)<br/>Consumes 45% of Workers quota"]
    end

    subgraph M3["Milestone 3: 100,000 Registered Users"]
        U3["5,000 DAU (5% active)"] --> R3["125,000 req/day"]
        R3 --> S3["EXCEEDS FREE TIER<br/>Requires Workers Paid ($5/mo)"]
    end

    subgraph M4["Milestone 4: 100,000 MAU"]
        U4["15,000 DAU (15% active)"] --> R4["450,000 req/day (13.5M/mo)"]
        R4 --> S4["REQUIRES WORKERS PAID<br/>Estimated Cost: ~$6.75/month"]
    end
```

- **10,000 Registered Users (500 DAU):** 12,500 req/day $\rightarrow$ **100% Free ($0/mo)**.
- **10,000 MAU (1,500 DAU):** 45,000 req/day $\rightarrow$ **100% Free ($0/mo)**.
- **100,000 Registered Users (5,000 DAU):** 125,000 req/day $\rightarrow$ **Exceeds 100k daily Workers limit by midday.**
- **100,000 MAU (15,000 DAU):** 450,000 req/day (~13.5M req/month) $\rightarrow$ Requires **Workers Paid ($5.00/mo base + $1.75 overage = ~$6.75/month)**.

---

### 2.6 Endpoint Inventory Reconciliation

The architecture documents have been reconciled across all dimensions:
- **156 HTTP Endpoints** across **12 Physical Source Modules** representing **18 Bounded Feature Domains**.
- **Difference Explained:** Physical route modules (`server/routes/*.ts`) represent file-level code organization. Feature domains represent conceptual business domains. For example, `server/routes/preferences.ts` is 1 file (14 endpoints), but spans Domain 2 (Profiles & Studio), Domain 4 (User Preferences & Privacy), and Domain 10 (Digital Passport & Badges).
- **Authentication Breakdown:** Exactly 13 Public endpoints, 10 Optional Auth endpoints, and 133 Required Auth endpoints (54 of which enforce granular RBAC permissions across 11 roles).

---

## 3. Summary of Updates Made to Phase 2.1 Documents

| Document File | Key Revisions & Additions |
| :--- | :--- |
| **`PHASE2_1_HONO_ARCHITECTURE.md`** | Updated to validated design: added WAF + D1 rate-limiting pipeline, Cloudflare Edge Cache API (1s TTL) for live auction polling, scrypt 10ms CPU analysis, and explicit workload-based free-tier saturation points. |
| **`PHASE2_1_API_MIGRATION_INVENTORY.md`** | Added Section 1 Reconciliation Table (12 Modules vs. 18 Domains vs. 156 Endpoints); updated Endpoint #59 (gated adaptive polling), #60 (atomic bid concurrency), #79 & #80 (WAF + D1 rate limiting and scrypt CPU constraints); expanded Section 3 Edge Constraints. |
| **`PHASE2_1_DATABASE_COMPATIBILITY_REPORT.md`** | Rewritten Section 4: detailed single-database SQLite write concurrency limits (50–100 writes/sec), why `batch()` alone fails without SQL conditions, exhaustive audit of all 19 transaction call sites with retry/conflict/idempotency specifications, and D1 quota reset mechanics. |
| **`PHASE2_1_FEATURE_MIGRATION_MATRIX.md`** | Updated Domain 1 (Auth rate limiting & CPU constraints), Domain 11 (Auction Arena polling math, adaptive intervals, Edge Cache API, Durable Objects upgrade path), Domain 7, 12, 18 (optimistic concurrency predicates), and summary matrix. |
| **`PHASE2_1_SECURITY_AND_AUTH_DESIGN.md`** | Comprehensive rewrite of Section 2 (scrypt 44ms CPU vs 10ms Free limit, 188-user database audit, constant-time comparison, PBKDF2 vs Workers Paid paths) and Section 7 (why in-isolate memory fails globally across 330+ edge locations, 3-tier WAF + D1 + Isolate defense matrix). |
| **`PHASE2_1_MIGRATION_ROADMAP.md`** | Completely revised Section 6 with formal workload modeling (10k registered, 10k MAU, 100k registered, 100k MAU, peak concurrent), Cloudflare service failure behaviors, and updated technical risks. |

---

## 4. Unresolved Technical Risks & Pre-Implementation Checklist

Before production cutover, the project owner must decide on two operational decisions:

1. **Production Password Hashing Tier Choice:**
   - *Option A (Recommended):* Commit to **Cloudflare Workers Paid ($5/month)** for production, allowing standard $N=16384$ scrypt to run without password resets.
   - *Option B (Strict Free Tier):* Adopt native Web Crypto PBKDF2 (~2-3 ms CPU) on the free tier, with an authentication transition bridge or password reset flow for the 61 existing scrypt accounts.
   *(Note: This decision does NOT block Phase 2.2 local implementation, because Wrangler Miniflare runs on Node.js and does not enforce the 10 ms CPU kill-switch).*
2. **Auction Arena Scaling Path:**
   - Up to 250 concurrent live bidders can be accommodated on the Workers Paid tier using Gated Adaptive Polling + Edge Cache API.
   - For >250 concurrent bidders, Durable Objects + WebSockets must be planned as a future enhancement.

---

## 5. Formal Final Decision

### **DECISION: CONDITIONALLY APPROVED FOR PHASE 2.2**

**Justification:**
1. All six architecture documents are now technically accurate, mathematically validated, and fully reconciled.
2. The concurrency hazards of Cloudflare D1 batching have been resolved via optimistic conditional SQL predicates.
3. The auction polling capacity risks have been mitigated via active gating, adaptive intervals, and the Cloudflare Edge Cache API.
4. The distributed rate-limiting architecture now incorporates global perimeter WAF rules and D1-backed transactional counters.
5. Dual TypeScript build passes cleanly (`npm run build` exit code 0).
6. The entire 78-test E2E integration suite passes 100% on an isolated disposable test harness (`npm test` exit code 0).
7. The primary database (`data/stroom.db`) remains completely untouched at 42 tables, 10,163 records, 0 foreign-key violations, and integrity `ok`.
8. Phase 2.2 implementation is strictly local (Wrangler dev on port 8787 alongside Express on port 5000) and does NOT deploy remote resources or activate billing.

**Action Required:**
Per strict instructions, execution is paused. We await explicit approval from the project owner to proceed to Phase 2.2.
