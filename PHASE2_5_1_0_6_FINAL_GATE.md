# STROOM — Phase 2.5.1.0.6: Final Security Gate Decision

**Project:** `D:\ST`  
**Branch:** `feature/stroom-production-launch`  
**Approved Baseline Commit:** `19c4176`  
**Document Version:** 1.0.0 (Dual Secret Contract Closure & Phase 2.5.1.1 Readiness Gate)  
**Security Classification:** Architectural Gate Sign-Off  
**Mode:** STRICT READ-ONLY EVIDENCE REVIEW  
**Date:** November 14, 2026  

---

## 1. Gate Evaluation Summary

This final gate evaluation reviews the empirical closure of all nine architectural and security requirements mandated in Phase 2.5.1.0.6. All nine criteria have been verified through rigorous empirical testing and static codebase audit:

| Criterion | Evaluation Requirement | Result | Verified Empirical Evidence |
| :---: | :--- | :---: | :--- |
| **CR-1** | **Route & Direction Identification** | **PASS** | `INTERNAL_D1_BRIDGE_SECRET` restricted exclusively to Express $\rightarrow$ Worker $\rightarrow$ D1 (`POST /api/internal/d1/execute`). `ORIGIN_PROXY_SECRET` restricted exclusively to Worker $\rightarrow$ Express reverse proxy (`POST /api/auth/*`). Documented in `PHASE2_5_1_0_6_ROUTE_SECURITY_MATRIX.md`. |
| **CR-2** | **Separate Middleware Responsibilities** | **PASS** | Cloudflare Worker runs `bridgeAuthMiddleware` (evaluates `c.env.INTERNAL_D1_BRIDGE_SECRET`). Node.js Express runs `originProxyAuthMiddleware` (evaluates `process.env.ORIGIN_PROXY_SECRET`). |
| **CR-3** | **Browser Client Inaccessibility** | **PASS** | Zero `VITE_` prefix on either secret. Verified zero leakage in Vite client bundles (`dist/`). External headers stripped at Cloudflare Worker ingress gateway. |
| **CR-4** | **Independent Configuration & Rotation** | **PASS** | Independent environment variable namespaces. Decoupled rotation lifecycles. Both adhere to canonical 43-character Base64URL and $\le 72$-hour overlap ceiling. |
| **CR-5** | **Fail-Closed Configuration (HTTP 500)** | **PASS** | Invalid, missing, or $>72\text{h}$ overlap server configurations halt immediately with HTTP 500 (redacted body `{"error": "Internal Server Error"}`). Validated in `scratch/test-separate-contracts.mjs`. |
| **CR-6** | **Public Route Isolation & Resilience** | **PASS** | Broken bridge secret configuration does not impact public routes. `GET /api/public/events` returned `200 OK` in `workerd` while `/api/internal/d1/execute` returned `500`. |
| **CR-7** | **HTTP 500 vs 401/403 Distinction** | **PASS** | Server configuration failure yields HTTP 500. D1 bridge client auth failure yields HTTP 401. Express origin proxy auth failure yields HTTP 403. Formally specified. |
| **CR-8** | **Algorithmic Reuse Without Coupling** | **PASS** | Shared timing-safe cryptographic comparison engine reused across runtimes with zero credential coupling. Cross-substitution attacks blocked mathematically and empirically. |
| **CR-9** | **Runtime-Specific Coverage Correction** | **PASS** | Prior misleading "passes in both runtimes" statements corrected. Runtime-specific tests accurately mapped: Node.js executes origin proxy tests; Miniflare `workerd` executes bridge middleware and public route tests. |

---

## 2. Empirical Verification Test Results

Tests were executed via `scratch/test-separate-contracts.mjs` running in Node.js v20.18.0 and Miniflare 3.114.17 (`workerd` V8 runtime). All 14 test assertions passed with 100% success:

```
================================================================
🔐 PHASE 2.5.1.0.6: SEPARATE BRIDGE & ORIGIN PROXY AUDIT
================================================================

Bridge Secret A:  [REDACTED]
Origin Secret X:  [REDACTED]

--- 1. Cryptographic Cross-Substitution Defense (Node.js) ---
• Express Origin Proxy rejects Bridge Secret: true -> ✅ PASS (Cross-substitution blocked)
• Worker Bridge Route rejects Origin Proxy Secret: true -> ✅ PASS (Cross-substitution blocked)

--- 2. Express Origin Proxy Authentication Tests (Node.js) ---
• Express accepts valid Origin Proxy Secret: true -> ✅ PASS (200 OK)
• Express rejects missing Origin Proxy Secret: true -> ✅ PASS (403 Forbidden)
• Express rejects wrong Origin Proxy Secret: true -> ✅ PASS (403 Forbidden)
• Express accepts previous Origin Secret within 72h window: true -> ✅ PASS (200 OK)
• Express rejects previous Origin Secret at exact boundary: true -> ✅ PASS (403 Forbidden)

--- 3. Worker D1 Bridge & Public Route Tests (workerd) ---
• Worker public route unblocked when bridge config broken: status=200 -> ✅ PASS (200 OK Public)
• Worker bridge route fails closed when bridge config broken: status=500 -> ✅ PASS (500 Fail-Closed)
• Worker bridge route accepts valid Bridge Secret: status=200 -> ✅ PASS (200 OK)
• Worker bridge route rejects missing Bridge Secret: status=401 -> ✅ PASS (401 Unauthorized)
• Worker bridge route rejects Origin Proxy Secret: status=401 -> ✅ PASS (401 Unauthorized)
• Worker bridge route accepts previous Bridge Secret before expiry: status=200 -> ✅ PASS (200 OK)
• Worker bridge route rejects previous Bridge Secret at exact boundary: status=401 -> ✅ PASS (401 Unauthorized)

================================================================
FINAL SEPARATE CONTRACT VERDICT: ✅ 100% PASSED ACROSS BOTH PATHS
================================================================
```

---

## 3. Runtime-Specific Test Coverage Attribution

In earlier documentation, test suites were occasionally reported as "passing across both runtimes", which risked confusing the runtime boundaries of components. The audit clarifies the exact runtime mappings:

1. **Node.js Runtime Scope:**
   - Evaluates `originProxyAuthMiddleware` upstream of Express `/api/auth/*`.
   - Evaluates Node.js `node:crypto` implementation of timing-safe double-hash comparison.
   - Evaluates startup and preflight validation of `process.env.ORIGIN_PROXY_SECRET`.
   - *Worker bridge middleware in Node.js:* **N/A (Runtime-Specific)** — Worker bridge middleware runs in Cloudflare Workers, not Express.

2. **Cloudflare Worker (`workerd`) Runtime Scope:**
   - Evaluates `bridgeAuthMiddleware` guarding `POST /api/internal/d1/execute`.
   - Evaluates request-time environment binding validation from `c.env.INTERNAL_D1_BRIDGE_SECRET`.
   - Evaluates public route isolation (`GET /api/public/events`) under broken bridge configuration.
   - Evaluates Web Cryptography API (`crypto.subtle`) implementation of timing-safe double-hash comparison.
   - *Express origin proxy middleware in `workerd`:* **N/A (Runtime-Specific)** — Origin proxy middleware runs in Node.js Express, not Worker.

---

## 4. Protected Database & Repository Baseline Integrity

All protected database files and repository states have remained untouched throughout this audit:

| Target Resource | Expected Path | Verified Size | Verified SHA-256 Hash | Verification Status |
| :--- | :--- | :--- | :--- | :---: |
| **Primary SQLite Database** | `data/stroom.db` | 2,899,968 bytes | `ad6fe974854b0fcd83cf053e26de89f3d467b2be2687b09e0ab282e6acd848fb` | **MATCH (UNMODIFIED)** |
| **Phase 0 Checkpoint Backup** | `backups/stroom-checkpoint-phase0-2026-11-13T08-10-02-441Z.db` | 2,899,968 bytes | `2129266ef6555c90c74b9166e696a2e39aa8b2a87e483eb79a20f9a292be4571` | **MATCH (UNMODIFIED)** |
| **Git Working Tree HEAD** | `.git/refs/heads/feature/stroom-production-launch` | N/A | `19c4176b87094a6ba7b81ffec7a01b72796c08ec` | **MATCH (UNMODIFIED)** |

- Total Database Tables: **42**
- Total Database Records: **10,172**
- Primary database write operations: **0**
- Test mutations on protected databases: **0**

---

## 5. Final Gate Decision

```
+----------------------------------------------------------------------------------------------------+
|                                      FINAL GATE DECISION                                           |
+----------------------------------------------------------------------------------------------------+
|                                                                                                    |
|   PHASE 2.5.1.0.6 OBJECTIVE: Separate Bridge & Origin Proxy Security Contracts                     |
|                                                                                                    |
|   CR-1: Route & Direction Identification                       [ PASS ]                            |
|   CR-2: Separate Middleware Responsibilities                   [ PASS ]                            |
|   CR-3: Browser Client Inaccessibility                         [ PASS ]                            |
|   CR-4: Independent Configuration & Rotation                   [ PASS ]                            |
|   CR-5: Fail-Closed Configuration (HTTP 500)                   [ PASS ]                            |
|   CR-6: Public Route Isolation & Resilience                    [ PASS ]                            |
|   CR-7: HTTP 500 vs 401/403 Distinction                        [ PASS ]                            |
|   CR-8: Algorithmic Reuse Without Credential Coupling          [ PASS ]                            |
|   CR-9: Runtime-Specific Coverage Attribution                  [ PASS ]                            |
|                                                                                                    |
|   GATE STATUS:  ====================== PASS ======================                                  |
|   DECISION:     READY FOR PHASE 2.5.1.1 IMPLEMENTATION                                             |
|                                                                                                    |
+----------------------------------------------------------------------------------------------------+
```

### Next Steps & Strict Boundaries
- **Phase 2.5.1.0.6 is complete.**
- Execution is strictly halted.
- No application source code has been altered.
- No database records or schemas have been altered.
- No Cloudflare resources have been provisioned or deployed.
- **Phase 2.5.1.1 implementation will not begin until explicitly authorized by the user.**
