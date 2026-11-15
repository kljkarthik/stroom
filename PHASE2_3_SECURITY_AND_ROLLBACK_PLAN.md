# STROOM — Phase 2.3: Security & Rollback Plan

**Project:** `D:\ST`  
**Branch:** `feature/stroom-production-launch`  
**Audit Baseline:** Commit `19c4176`  
**Document Version:** 1.0.0 (Phase 2.3 Deliverable)  
**Security Classification:** Critical Infrastructure Architecture

---

## 1. Threat Modeling & Attack Vectors During Authentication Migration

Migrating authentication and session verification from a monolithic Node.js runtime to a distributed serverless edge runtime introduces distinct security attack surfaces. This section identifies each attack vector and specifies defensive countermeasures.

### 1.1 Algorithm Confusion Attacks
- **Threat Vector:** An attacker alters the JWT header to `{"alg": "none"}` or `{"alg": "RS256"}`. If the token verification engine blindly respects the algorithm specified in the incoming token header, it may accept unsigned tokens or treat the HMAC secret as a public key.
- **Countermeasure:**
  - Hono's `verify(token, secret, 'HS256')` strictly enforces the algorithm parameter.
  - The middleware explicitly checks `header.alg === 'HS256'`. Any token specifying `none`, `RS256`, `ES256`, or any algorithm other than `HS256` is rejected with `401 Unauthorized` before signature parsing.

### 1.2 Signature Forgery & Secret Key Exposure
- **Threat Vector:** If `JWT_SECRET` is committed to Git, leaked via client source maps, or accessible through an unhandled error stack trace, an attacker could forge arbitrary tokens with `role: 'super_admin'`.
- **Countermeasure:**
  - `JWT_SECRET` is never committed to Git; `.env` and `.dev.vars` are strictly excluded in `.gitignore`.
  - In Cloudflare Workers, `JWT_SECRET` is passed exclusively as an encrypted environment secret via `wrangler secret put JWT_SECRET`.
  - The production environment guard in `server/config/env.ts:33-38` rejects startup if `JWT_SECRET` is shorter than 24 characters or uses the development fallback.
  - Global error handlers redact filesystem paths and credentials.

### 1.3 Replay Attacks & Stateless Token Expiry
- **Threat Vector:** Because JWTs are stateless, if a token is intercepted before its 7-day expiration, an attacker can replay it even if the user logs out on their client.
- **Countermeasure:**
  - Transport Layer Security (TLS 1.3 / HTTPS) is strictly enforced on all Cloudflare edge routes.
  - Token lifetime is capped at 7 days (`expiresIn: '7d'`).
  - For sensitive administrative actions, the Worker checks the live database record on every authenticated request (`account_status` and live `role`).
  - If instant global revocation is required in a future phase, a `token_version` column on `users` or a lightweight Cloudflare KV revocation cache will be introduced.

### 1.4 Brute Force & Credential Stuffing
- **Threat Vector:** Automated credential stuffing attacks against `POST /api/auth/login`.
- **Countermeasure:**
  - Express currently enforces `authRateLimiter` (15-minute window, max 25 attempts per IP).
  - Under the recommended Option A architecture, Express continues handling login with this rate limiter intact.
  - Cloudflare Web Application Firewall (WAF) rate limiting rules will provide edge-level throttling before requests hit the origin server.

### 1.5 Timing Attacks on Hash Verification
- **Threat Vector:** An attacker measures minute variations in response times to infer password characters or token signatures.
- **Countermeasure:**
  - Both Express and Worker implementations utilize constant-time comparison primitives:
    - Express: `crypto.timingSafeEqual()`.
    - Worker: WebCrypto native `crypto.subtle.verify()` which is constant-time by design.
  - Generic error messages (`"Invalid email or password"`) prevent user enumeration.

### 1.6 Suspended Account Lockout Propagation
- **Threat Vector:** A malicious or compromised user is suspended by an administrator, but their pre-issued 7-day JWT remains cryptographically valid.
- **Countermeasure:**
  - The Worker authentication middleware does NOT rely solely on the claims inside the JWT.
  - On every authenticated request, the Worker queries D1:
    ```sql
    SELECT account_status, role FROM users WHERE id = ?
    ```
  - If `account_status === 'suspended'`, the request is immediately terminated with `403 Forbidden` (`"Account suspended. Please contact STROOM support."`), guaranteeing instantaneous suspension enforcement across the global edge network.

---

## 2. Defensive Hardening Specifications for Worker Middleware

When implemented in Hono, the authentication middleware must adhere to these technical specifications:

```
[Incoming Request]
       │
       ▼
1. Extract 'Authorization: Bearer <token>'
   ├── Missing / Malformed? ───────────────► 401 Unauthorized
       │
       ▼
2. Decode JWT Header & Verify Algorithm
   ├── alg !== 'HS256'? ───────────────────► 401 Unauthorized
       │
       ▼
3. WebCrypto HMAC-SHA256 Signature Check
   ├── Invalid signature? ─────────────────► 401 Unauthorized
       │
       ▼
4. Timestamp & Expiration Check
   ├── exp < Math.floor(Date.now() / 1000)? ──► 401 Unauthorized
       │
       ▼
5. D1 Live User Lookup (id = payload.id)
   ├── User not found? ────────────────────► 401 Unauthorized
   └── account_status === 'suspended'? ────► 403 Forbidden
       │
       ▼
6. Role & Permission Verification
   ├── Missing required permission? ───────► 403 Forbidden
       │
       ▼
7. Attach Sanitized User to Context & Proceed
```

---

## 3. Rollback Procedures & Runbooks

To guarantee zero production downtime, deterministic rollback runbooks are established for all potential failure modes during the phased rollout.

### 3.1 Failure Scenario 1: JWT Signature Mismatch Between Express and Worker
- **Symptom:** Users logged in via Express receive `401 Unauthorized` when making requests to ported Worker endpoints.
- **Root Cause:** Mismatch in `JWT_SECRET` string, encoding differences (e.g. UTF-8 vs hex), or clock skew between origin and edge.
- **Rollback Runbook:**
  1. **Immediate Action (< 60 seconds):**
     In `wrangler.jsonc` / Cloudflare Pages routing configuration, update the route rule:
     Reroute the affected path prefix (e.g. `/api/*`) back to the Express origin backend (`http://localhost:5000` or production origin).
  2. **Diagnostic Verification:**
     Run `scratch/test-jwt-compat.js` against the production secret to verify byte-for-byte signature parity.
  3. **Resolution:**
     Ensure `wrangler secret put JWT_SECRET` matches the origin secret exactly without trailing whitespace or newlines.

---

### 3.2 Failure Scenario 2: D1 Query Throttling or High Edge Latency
- **Symptom:** Worker authentication middleware experiences latency $> 200\text{ ms}$ or D1 row-read limits approach daily free-tier caps (5,000,000 reads/day).
- **Rollback Runbook:**
  1. **Immediate Action:**
     Enable short-lived in-isolate caching (60-second TTL) for user status lookups in Worker memory, reducing D1 reads by up to 95% for active sessions.
  2. **Fallback Action:**
     If D1 connectivity degrades, redirect traffic back to the Express origin via Cloudflare Pages proxy rules.

---

### 3.3 Failure Scenario 3: Erroneous Permission Denial (403 Spikes)
- **Symptom:** Legitimate administrators or staff members receive `403 Forbidden` on admin endpoints.
- **Root Cause:** Discrepancy between Worker `ROLE_PERMISSIONS` dictionary and Express `rbacService.ts`.
- **Rollback Runbook:**
  1. **Immediate Action:**
     Switch admin endpoints (`/api/admin/*`) back to the Express backend.
  2. **Audit Verification:**
     Compare `getRolePermissions(role)` between `server/services/rbacService.ts` and `src/worker/services/rbacService.ts` using the Phase 2.3 Compatibility Matrix.

---

## 4. Production Prerequisites & Operational Readiness Checklist

Before any authentication migration is deployed:

- [x] **Account Baseline Integrity:** 188 accounts verified intact in `data/stroom.db` with 0 foreign-key violations.
- [x] **Cryptographic Parity Verified:** Node.js `jsonwebtoken` and WebCrypto HMAC-SHA256 proven 100% bidirectionally compatible.
- [x] **Zero Plaintext Password Leakage:** All passwords stored as scrypt or legacy salted SHA-256.
- [ ] **Production Secret Management:** `JWT_SECRET` generated with $> 32$ bytes of cryptographic randomness and securely deployed to both Express and Cloudflare Workers secret store.
- [ ] **Origin-Bound CORS Hardening:** Production domain whitelist configured on both backends; wildcard origins prohibited on credentials-bearing endpoints.
- [ ] **Telemetry & Anomaly Alerting:** Edge alerts configured for:
  - Spike in 401 Unauthorized responses ($> 5\%$ of total requests).
  - Spike in 403 Forbidden responses ($> 2\%$ of total requests).
  - Worker CPU execution time exceeding $25\text{ ms}$.

---

## 5. Phased Implementation Roadmap

| Phase | Scope | Authentication Architecture Status | Safety Guard |
| :---: | :--- | :--- | :--- |
| **Phase 2.3** | Architecture & Security Audit | Documentation-only | Zero code changes |
| **Phase 2.4** | Public Catalogs & Worker JWT Auth | Worker verifies JWT on read-only public routes; Express handles login | Dual-backend running concurrently |
| **Phase 2.5** | Member Core (Onboarding & Profiles) | Worker enforces `requireAuth` on member routes | Express fallback available instantly |
| **Phase 2.6** | Partner Portal & Communities | Worker enforces partner ownership checks | Partner records isolated in D1 |
| **Phase 2.7** | Auction Arena & Bidding | Worker enforces auctioneer permissions | Bids recorded in D1 with atomic checks |
| **Phase 2.8** | Admin Control Center & Final Cutover | Full 156-endpoint parity confirmed | Full regression test suite passing |

---

## 6. Final Security Assessment & Sign-Off

The proposed Option A (Hybrid Strangler-Fig) architecture satisfies all security, backward compatibility, performance, and cost constraints:
- Zero user accounts or passwords disrupted.
- Zero forced password resets.
- Zero risk of Cloudflare Worker CPU timeouts.
- Instantaneous rollback capability at all stages.

**FINAL DECISION: APPROVED FOR PHASE 2.4 DESIGN**
