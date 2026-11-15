# STROOM — Phase 2.4.3: Final Architecture Readiness Decision Record

**Project:** `D:\ST`  
**Branch:** `feature/stroom-production-launch`  
**Approved Baseline Commit:** `19c4176`  
**Document Version:** 1.0.0 (Phase 2.4.3 Final Architecture Approval)  
**Security Classification:** Authoritative Architectural Decision Record (ADR)  
**Phase Status:** **APPROVED FOR PHASE 2.5 IMPLEMENTATION PLANNING**

---

## 1. Context and Executive Decision

Phase 2.4.3 concludes the final review and security hardening of the STROOM Hybrid Authentication Architecture. All five specific architectural ambiguities identified in the independent review have been formally resolved with zero remaining unaddressed concerns.

This document serves as the **Final Architecture Readiness Decision Record (ADR)** authorizing progression to Phase 2.5 Implementation Planning.

---

## 2. Summary of Resolved Architectural Decisions

### 2.1 Resolution 1: Secure Express-to-D1 Bridge (`PHASE2_4_3_D1_BRIDGE_SECURITY_CONTRACT.md`)
- **Prohibition of Dynamic SQL:** Accepting raw SQL queries over the bridge is permanently prohibited.
- **Fixed Named Allowlist:** The bridge exclusively exposes six strictly validated operations:
  `getUserForLogin`, `createUser`, `updatePasswordHash`, `changePassword`, `changeAccountStatus`, `updateUserRole`.
- **Separate Cryptographic Keys:** `INTERNAL_D1_BRIDGE_SECRET` (Express $\rightarrow$ Worker) and `ORIGIN_PROXY_SECRET` (Worker $\rightarrow$ Express) are generated independently with 256 bits of entropy and validated via constant-time comparison (`crypto.subtle.timingSafeEqual`).
- **Anti-Replay & Redaction:** Replay protection enforced via timestamp/nonce headers. Password hashes are masked as `[REDACTED_HASH]` in all edge logs.

---

### 2.2 Resolution 2: Pages Advanced Mode Execution (`PHASE2_4_3_PAGES_ADVANCED_MODE_EXECUTION.md`)
- **Corrected Execution Lifecycle:** Every request to the domain enters `_worker.js`.
- **Static Asset Delegation:** Static requests are delegated to Cloudflare Pages' internal storage via `env.ASSETS.fetch(request)`, consuming $\approx 0.15\text{ ms} - 0.35\text{ ms}$ of Worker CPU time (removing prior unsupported claims of "0ms Worker execution").
- **SPA Fallback:** Non-API requests that return 404 with `Accept: text/html` automatically fall back to serving `/index.html` from `env.ASSETS` for client-side HTML5 history routing.

---

### 2.3 Resolution 3: D1 Authorization Consistency (`PHASE2_4_3_D1_AUTHORIZATION_CONSISTENCY.md`)
- **Sequential Consistency:** Security-critical authorization lookups and writes utilize D1's Sessions API (`withSession("first-primary")`) to eliminate edge read-replica replication lag.
- **Reconciled Cache Windows:**
  - In-isolate cache TTL is strictly **30 seconds** on warm isolates; **0 seconds on cold isolates**.
  - **Administrative Staff Routes:** Strictly **Fail-Closed (`503`)** with 0ms grace beyond TTL.
  - **General Member Read-Only Routes:** Permitted an emergency **grace period up to 60 seconds from `verifiedAt`** before failing closed.
- **Optional Auth Error Contract:** Malformed, expired, or invalid tokens sent to optional endpoints return **`401 Unauthorized`** and never silently degrade to guest access.

---

### 2.4 Resolution 4: Cloudflare Tunnel Origin Validation (`PHASE2_4_3_TUNNEL_CONNECTIVITY_VALIDATION.md`)
- **Full Path Documented:** Browser $\rightarrow$ `stroom.club` (Pages `_worker.js`) $\rightarrow$ `fetch('https://auth-origin.stroom.club/api/auth/login')` $\rightarrow$ Cloudflare Tunnel (`cloudflared`) $\rightarrow$ Express `127.0.0.1:5000`.
- **Zero Routing Loops:** Hostname partitioning guarantees `auth-origin.stroom.club` terminates at the Tunnel ingress and never re-enters `_worker.js`.
- **Zero Public Port Exposure:** Express host firewall blocks all inbound public ports; `cloudflared` initiates outbound-only connections to Cloudflare Anycast edge.

---

### 2.5 Resolution 5: JWT & Database Forensic Parity (`PHASE2_4_3_JWT_AND_DATABASE_RECONCILIATION.md`)
- **JWT Transition Formalized:** Established the five formal conditions governing the 7-day legacy transition window ($T_0$ to $T_0 + 604,860\text{s}$). Replaced loose phrasing with exact mathematical bounds.
- **Database Parity Scientifically Stated:**
  - Total records: **10,163 rows** across all 42 tables (100% row count parity).
  - 41 of 42 tables are **100% identical at the byte/cell level**.
  - Exactly **1 record** in `auction_players` (`ply_past_001`) differs by **1 timestamp field** (`sold_at`), confirmed as historical Phase 0 seed timestamp variance.
  - Parity is strictly reported as **99.99% field-level parity (10,162 identical records)** without false claims of bit-for-bit parity.

---

## 3. Master Deliverables Directory

| Deliverable File | Scope and Purpose |
| :--- | :--- |
| [`PHASE2_4_3_D1_BRIDGE_SECURITY_CONTRACT.md`](file:///D:/ST/PHASE2_4_3_D1_BRIDGE_SECURITY_CONTRACT.md) | Fixed 6-operation allowlist, zero dynamic SQL, dual secrets, constant-time checks. |
| [`PHASE2_4_3_PAGES_ADVANCED_MODE_EXECUTION.md`](file:///D:/ST/PHASE2_4_3_PAGES_ADVANCED_MODE_EXECUTION.md) | `_worker.js` execution lifecycle, `env.ASSETS.fetch()`, SPA HTML fallback, CPU realities. |
| [`PHASE2_4_3_D1_AUTHORIZATION_CONSISTENCY.md`](file:///D:/ST/PHASE2_4_3_D1_AUTHORIZATION_CONSISTENCY.md) | D1 `withSession("first-primary")`, 30s TTL, 60s member grace, admin fail-closed. |
| [`PHASE2_4_3_TUNNEL_CONNECTIVITY_VALIDATION.md`](file:///D:/ST/PHASE2_4_3_TUNNEL_CONNECTIVITY_VALIDATION.md) | Production network path, Cloudflare Tunnel, zero routing loops, origin shielding. |
| [`PHASE2_4_3_JWT_AND_DATABASE_RECONCILIATION.md`](file:///D:/ST/PHASE2_4_3_JWT_AND_DATABASE_RECONCILIATION.md) | 5 formal JWT conditions, 604,860s cutoff, 10,163 row parity, 1-cell seed diff. |
| [`PHASE2_4_3_FINAL_READINESS_DECISION.md`](file:///D:/ST/PHASE2_4_3_FINAL_READINESS_DECISION.md) | Authoritative Architectural Decision Record approving Phase 2.5 planning. |

---

## 4. Final Architectural Decision

All five remaining security, routing, consistency, and forensic issues have been completely resolved.

**DECISION:**  
**A. APPROVED FOR PHASE 2.5 IMPLEMENTATION PLANNING**

*(Approval grants planning readiness for Phase 2.5 only; it does not authorize implementation, account migration, password changes, production deployment, or remote infrastructure provisioning.)*
