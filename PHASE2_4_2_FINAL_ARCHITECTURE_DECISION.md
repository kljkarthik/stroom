# STROOM — Phase 2.4.2: Final Architecture Decision & Sign-Off

**Project:** `D:\ST`  
**Branch:** `feature/stroom-production-launch`  
**Approved Baseline Commit:** `19c4176`  
**Document Version:** 1.0.0 (Phase 2.4.2 Final Decision Record)  
**Security Classification:** Authoritative Architectural Decision Record (ADR)  
**Phase Status:** **APPROVED FOR PHASE 2.5 IMPLEMENTATION PLANNING**

---

## 1. Context and Executive Decision

Over Phases 2.1 through 2.4.2, the architectural design for migrating STROOM from its reference Node.js + Express + SQLite monolith to a zero-cost-first Cloudflare serverless platform has undergone deep forensic analysis, capacity modeling, and security hardening.

This document serves as the **Authoritative Architecture Decision Record (ADR)** that formally synthesizes and unifies all approved architectural specifications into an immutable blueprint.

---

## 2. Definitive Architecture Blueprint

### 2.1 The Hybrid Strangler-Fig Model
1. **Express Auth Origin:** Remains operational to compute CPU-intensive password hashing and verification:
   - Verifies **61 modern scrypt** accounts ($N=16384, r=8, p=1, \text{keylen}=64$).
   - Verifies **126 legacy SHA-256** accounts (`password + 'stroom_vibe_salt_2026'`) and transparently upgrades them to scrypt on login.
   - Preserves **1 guest attendee record** (`password_hash = ''`) safely locked out from password authentication.
   - Signs standardized **HS256 JSON Web Tokens** with a 7-day lifetime.
2. **Cloudflare Worker Edge API:** Verifies incoming Bearer tokens using native WebCrypto in $<0.5\text{ ms}$ of CPU time, completely eliminating the risk of Cloudflare 50ms CPU limit exhaustion (Error 1102).
3. **Cloudflare D1 Database:** Acts as the authoritative production database containing all 42 application tables.

---

### 2.2 Express-to-D1 Write Consistency Contract
- **Mechanism:** Authenticated Worker Internal Bridge (`POST /api/internal/d1/execute`) guarded by `X-Internal-Service-Key` and firewall rules.
- **Registration Rule:** **ABSOLUTELY ZERO JWT MAY BE ISSUED** if the D1 user insert fails. Express aborts and returns `503 Service Unavailable` or `409 Conflict`.
- **Legacy Upgrade Rule:** If a legacy SHA-256 password is valid but D1 write fails, the login **succeeds** and the JWT is issued. The legacy hash remains in D1, and Express will automatically re-attempt the upgrade on the next login.
- **Authoritative Source:** Once user data is migrated, **Cloudflare D1 is authoritative** for all user status, roles, and profiles.

---

### 2.3 Edge Routing & Origin Protection Topology
- **Topology:** **Cloudflare Pages Advanced Mode (`dist/_worker.js`)** with **Origin Tunneling**.
- **Static Assets:** Pages CDN delivers HTML, CSS, JS chunks, and images with 0ms Worker execution time.
- **Dynamic API:** `_worker.js` intercepts `/api/*`.
- **Auth Routes (`/api/auth/login`, `/register`, `/change-password`, `/reset-demo`):** The Worker acts as an edge reverse proxy, forwarding requests via `fetch()` to the Express origin.
- **Origin Shielding:** Express host blocks all public inbound ports using **Cloudflare Tunnel (`cloudflared`)** and validates internal secret `X-STROOM-Origin-Secret`.

---

### 2.4 Revocation & Cache Contract
- **In-Isolate Memory:** The 30-second cache lives in local V8 isolate memory and is **not shared across Cloudflare PoPs**.
- **Normal Operation:** Cache TTL is strictly **30 seconds**. Cache misses query D1 with 0s revocation delay.
- **D1 Outage Policy:**
  - Administrative and Staff routes (`ADMIN_STAFF_ROLES`): Strictly **Fail-Closed (`503`)**. Outages never allow stale administrative access.
  - General Member Read-Only routes: Permitted a **bounded emergency grace period of up to 60 seconds** from initial verification.
- **Optional Authentication:**
  - Missing token $\rightarrow$ Guest access (`200 OK`).
  - Malformed, expired, or invalid token $\rightarrow$ **`401 Unauthorized`** (Never silently degrades to guest mode).

---

### 2.5 Coordinated JWT Issuer Transition
- **Stage 1:** Hono deployed in dual-acceptance mode (accepts modern tokens with `iss`/`aud` and legacy tokens without `iss`/`aud`).
- **Stage 2 ($T_0$):** Express switches permanently to signing all new tokens with `iss: 'stroom-api'` and `aud: 'stroom-client'`. Legacy issuance stops completely.
- **Stage 3 ($T_0$ to $T_0 + 7\text{d} + 60\text{s}$):** Pre-$T_0$ legacy tokens naturally expire over their remaining 7-day lifetime.
- **Stage 4:** At $T_0 + 7\text{d} + 60\text{s}$, mathematical proof guarantees zero valid legacy tokens remain. Hono strictly mandates `iss` and `aud`, rejecting missing claims with `401 Unauthorized`.

---

## 3. Deliverables Master Index

| Document Identifier | Document Title | Purpose & Scope |
| :--- | :--- | :--- |
| [`PHASE2_4_2_EXPRESS_D1_CONNECTIVITY_AND_CONSISTENCY.md`](file:///D:/ST/PHASE2_4_2_EXPRESS_D1_CONNECTIVITY_AND_CONSISTENCY.md) | Express-D1 Connectivity & Consistency | Internal Worker bridge specification, transactional write contracts, failed write policies. |
| [`PHASE2_4_2_FINAL_CLOUDFLARE_ROUTING_TOPOLOGY.md`](file:///D:/ST/PHASE2_4_2_FINAL_CLOUDFLARE_ROUTING_TOPOLOGY.md) | Final Cloudflare Routing Topology | Pages Advanced Mode (`_worker.js`), reverse proxy forwarding, Cloudflare Tunnel origin shielding. |
| [`PHASE2_4_2_REVOCATION_CACHE_CONTRACT.md`](file:///D:/ST/PHASE2_4_2_REVOCATION_CACHE_CONTRACT.md) | Revocation & Cache Contract | 30s normal TTL, 60s member grace, admin fail-closed, optional auth strict error contract. |
| [`PHASE2_4_2_JWT_ISSUER_CUTOVER_PLAN.md`](file:///D:/ST/PHASE2_4_2_JWT_ISSUER_CUTOVER_PLAN.md) | JWT Issuer Cutover Plan | Coordinated 4-stage rollout, $T_0$ cutover, 7-day deprecation window, mathematical proof. |
| [`PHASE2_4_2_AVAILABILITY_FAILURE_MATRIX.md`](file:///D:/ST/PHASE2_4_2_AVAILABILITY_FAILURE_MATRIX.md) | Availability & Failure Matrix | 8 failure scenarios evaluated across all route types; honest labeling of facts vs estimates. |
| [`PHASE2_4_2_FINAL_ARCHITECTURE_DECISION.md`](file:///D:/ST/PHASE2_4_2_FINAL_ARCHITECTURE_DECISION.md) | Final Architecture Decision Record | Authoritative ADR synthesizing all verified architectural decisions and gates. |

---

## 4. Final Architectural Decision

All technical ambiguities, consistency models, routing mechanisms, and failure modes have been rigorously resolved.

**DECISION:**  
**A. APPROVED FOR PHASE 2.5 IMPLEMENTATION PLANNING**

*(Approval grants readiness for Phase 2.5 implementation planning only; it does not authorize authentication implementation, account migration, password changes, production deployment, or remote infrastructure provisioning.)*
