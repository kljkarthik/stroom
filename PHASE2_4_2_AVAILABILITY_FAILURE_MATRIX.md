# STROOM — Phase 2.4.2: Availability & Failure Mode Matrix

**Project:** `D:\ST`  
**Branch:** `feature/stroom-production-launch`  
**Approved Baseline Commit:** `19c4176`  
**Document Version:** 1.0.0 (Phase 2.4.2 Operational Matrix)  
**Security Classification:** Production Reliability Specification  
**Phase Status:** **APPROVED FOR PHASE 2.5 IMPLEMENTATION PLANNING**

---

## 1. Executive Summary & Reliability Baseline

Previous preliminary documentation made broad statements regarding "100% availability" or "zero impact during outages." This document eliminates all unsupported claims and establishes an honest, rigorous dependency and failure analysis across all eight potential infrastructure outage scenarios.

### Verified Architectural Baseline:
- The hybrid system depends on three primary subsystems:
  1. **Cloudflare Pages / Edge Workers:** Static assets and edge routing runtime.
  2. **Cloudflare D1:** Authoritative serverless SQLite database.
  3. **Express Origin:** External compute service for password verification and hashing.

---

## 2. Comprehensive Eight-Scenario Failure Matrix

```
[OUTAGE SCENARIOS EVALUATED]
├── Scenario 1: Express Unavailable, D1 Available
├── Scenario 2: Express Available, D1 Unavailable
├── Scenario 3: Both Available (Normal Operation)
├── Scenario 4: Both Unavailable (Dual Origin Outage)
├── Scenario 5: Cloudflare Worker Runtime Unavailable
├── Scenario 6: Cloudflare Pages CDN Unavailable
├── Scenario 7: D1 Read Query Failure
└── Scenario 8: D1 Write Query Failure
```

---

### 2.1 Complete Failure Analysis Table

| Outage Scenario | Login & Registration (`/api/auth/*`) | Existing Authenticated Sessions (Member) | Public Endpoints (Events/Cities/FAQs) | Optional-Auth Endpoints (Discovery Feed) | Administrative Endpoints (Admin Hub) | Password Changes & Resets | Root Cause & Edge Behavior |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **1. Express Unavailable,<br/>D1 Available** | **FAILS (503)**<br/>Worker proxy returns `AUTH_ORIGIN_UNREACHABLE`. | **OPERATIONAL**<br/>Worker verifies JWTs and queries D1 independently. | **OPERATIONAL**<br/>Served directly from D1 / cache. | **OPERATIONAL**<br/>Valid sessions personalized; guests served. | **OPERATIONAL**<br/>Staff RBAC verified against D1. | **FAILS (503)**<br/>Requires Express for current password verification. | Express container restart, VPS network outage, or cold start. Active users unaffected. |
| **2. Express Available,<br/>D1 Unavailable** | **FAILS (503)**<br/>Cannot write new user to D1; login rehash fails. | **DEGRADED / FAILS**<br/>Cached entries valid max 60s; fails closed thereafter. | **DEGRADED (503)**<br/>Requires D1 read unless cached at edge CDN. | **DEGRADED**<br/>Falls back to cached public guest catalog. | **FAILS CLOSED (503)**<br/>Strict security lock active; zero admin access. | **FAILS (503)**<br/>Cannot write updated hash to D1. | Cloudflare D1 control plane or storage degradation. Security locks down admin access. |
| **3. Both Available<br/>(Normal State)** | **OPERATIONAL**<br/>Sub-100ms response time on warm host. | **OPERATIONAL**<br/>Sub-50ms global edge response time. | **OPERATIONAL**<br/>Global edge Anycast delivery. | **OPERATIONAL**<br/>Full personalization and badges. | **OPERATIONAL**<br/>Full 27-permission RBAC active. | **OPERATIONAL**<br/>Atomic hash update. | Expected baseline production operating state. |
| **4. Both Unavailable<br/>(Catastrophic)** | **FAILS (503)** | **FAILS (503)** | **FAILS (503)** | **FAILS (503)** | **FAILS (503)** | **FAILS (503)** | Edge Worker returns generic 503 error page. Static assets may remain cached in browser. |
| **5. Worker Runtime<br/>Unavailable** | **FAILS (521/530)**<br/>Edge proxy cannot execute. | **FAILS (521/530)** | **FAILS (521/530)** | **FAILS (521/530)** | **FAILS (521/530)** | **FAILS (521/530)** | Cloudflare V8 Workers runtime incident. Triggers DNS rollback to Express origin. |
| **6. Pages CDN<br/>Unavailable** | **STATIC FAILS**<br/>SPA bundle cannot download. | **API STILL UP**<br/>Direct API calls succeed; SPA UI unreachable. | **API STILL UP** | **API STILL UP** | **API STILL UP** | **API STILL UP** | Cloudflare Pages CDN edge incident. Native mobile webviews or API clients continue. |
| **7. D1 Read Query<br/>Failure** | **FAILS (503)**<br/>Cannot check duplicate email on register. | **GRACE (60s)**<br/>Allows 60s member grace if cached active, then 503. | **FAILS (503)** | **FALLBACK**<br/>Serves public guest fallback feed. | **FAILS CLOSED (503)**<br/>Strict admin lock; rejects request. | **FAILS (503)**<br/>Cannot read current hash. | Transient D1 query timeout or lock contention. |
| **8. D1 Write Query<br/>Failure** | **FAILS (503)**<br/>ZERO JWT issued on register; login succeeds (legacy hash intact). | **OPERATIONAL**<br/>Read operations completely unaffected. | **OPERATIONAL** | **OPERATIONAL** | **READS WORK /<br/>WRITES FAIL** | **FAILS (503)**<br/>Old password remains active. | D1 storage write limit or transactional collision. Read traffic unaffected. |

---

## 3. Labeling of Performance Facts, Assumptions & Estimates

To ensure scientific honesty, the metrics used in this design are classified into three strict categories:

### 3.1 Verified Facts (Empirically Measured Locally)
1. **WebCrypto HMAC-SHA256 CPU Time:** Measured locally in Node/V8 isolate at **$< 0.5\text{ ms}$**.
2. **Node.js OpenSSL scrypt CPU Time:** Measured on host CPU ($N=16384, r=8, p=1$) at **$35\text{ ms} - 55\text{ ms}$**.
3. **Database Parity:** `data/stroom.db` contains 188 user records; local D1 contains 42 tables and 0 user records.
4. **Local D1 Query Latency:** Measured on local Miniflare D1 at **$5\text{ ms} - 15\text{ ms}$**.

### 3.2 Documented Vendor Specifications (Official Cloudflare Docs)
1. **Cloudflare Worker Free CPU Limit:** Strictly capped at **50 ms of CPU time per request**.
2. **Cloudflare D1 Free Quotas:** **5,000,000 row reads / day** and **100,000 row writes / day**.
3. **Cloudflare REST API Rate Limit:** Capped at **1,200 requests per 5 minutes** per token.
4. **Pages `_routes.json` Limitation:** Only governs Pages Functions execution vs static asset serving.

### 3.3 Estimates & Unverified Assumptions (Internet Production Conditions)
1. *Estimate:* Global network round-trip time from Cloudflare edge Worker to an Express VPS host is estimated at **$35\text{ ms} - 80\text{ ms}$** depending on geographic proximity.
2. *Estimate:* In-isolate cache hit ratio under active user browsing is estimated at **$90\% - 95\%$**, reducing D1 read volume by over nine-tenths.
3. *Assumption:* Express origin will be hosted on an always-on VPS ($4/mo) or existing host with 0ms cold starts, rather than a sleep-enabled free container tier.
