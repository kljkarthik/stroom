# STROOM — Phase 2.5.1.0.6: Separate Bridge and Origin Proxy Security Contracts

**Project:** `D:\ST`  
**Branch:** `feature/stroom-production-launch`  
**Approved Baseline Commit:** `19c4176`  
**Document Version:** 1.0.0 (Authoritative Dual Secret Architecture & Security Contract)  
**Security Classification:** Cryptographic Contract & Route Architecture Standard  
**Mode:** STRICT READ-ONLY AUDIT & SPECIFICATION (Zero code changes, zero database mutations)  
**Date:** November 14, 2026  

---

## 1. Executive Summary & Architectural Motivation

In the STROOM hybrid Cloudflare architecture, communication between distributed runtime components spans two distinct, unidirectional network segments:
1. **Express $\rightarrow$ Worker $\rightarrow$ D1** (The Internal D1 Bridge)
2. **Worker $\rightarrow$ Express** (The Origin Reverse Proxy)

Historically, planning documents referenced shared cryptographic verification principles across these paths. This specification strictly establishes their **cryptographic, operational, and architectural separation**. Under no circumstances may `INTERNAL_D1_BRIDGE_SECRET` be substituted, aliased, shared, or coupled with `ORIGIN_PROXY_SECRET`.

Each path possesses its own independent authentication secret, dedicated middleware, targeted failure status codes, isolated rotation schedules, and distinct trust boundaries.

```
+---------------------------------------------------------------------------------------------------------+
|                                      HYBRID SECURITY TOPOLOGY                                           |
+---------------------------------------------------------------------------------------------------------+
|                                                                                                         |
|   +-------------------+                                                                                 |
|   |   Browser Client  |                                                                                 |
|   +---------+---------+                                                                                 |
|             |                                                                                           |
|             | Standard HTTPS (Cookies / Bearer JWT)                                                     |
|             | [Headers X-STROOM-* strictly stripped at Edge]                                            |
|             v                                                                                           |
|   +-----------------------------------------------------------------------+                             |
|   |                   Cloudflare Edge / Worker (workerd)                  |                             |
|   |                                                                       |                             |
|   |  • Public Routes (/api/public/*, /api/health)                         |                             |
|   |  • Edge Auth Router (/api/auth/*) -------------------------\          |                             |
|   |  • Edge API Router (Waves 2-8)                             |          |                             |
|   |  • Internal D1 Bridge Endpoint (/api/internal/d1/execute)  |          |                             |
|   |    [Guarded by: bridgeAuthMiddleware]                      |          |                             |
|   +--------------------+---------------------------------------+----------+                             |
|                        ^                                       |                                        |
|                        |                                       | Worker -> Express                      |
|                        | Express -> Worker                     | Header: X-STROOM-Origin-Secret         |
|                        | Header: X-STROOM-Bridge-Secret        | Secret: ORIGIN_PROXY_SECRET            |
|                        | Secret: INTERNAL_D1_BRIDGE_SECRET     |                                        |
|                        |                                       v                                        |
|   +--------------------+--------------------------------------------------+                             |
|   |                   Origin Express Backend (Node.js)                    |                             |
|   |                                                                       |                             |
|   |  • Auth Endpoints (/api/auth/*)                                       |                             |
|   |    [Guarded by: originProxyAuthMiddleware]                            |                             |
|   |  • D1 Bridge Client (invokes Worker bridge)                           |                             |
|   +-----------------------------------------------------------------------+                             |
|                                                                                                         |
+---------------------------------------------------------------------------------------------------------+
```

---

## 2. Path 1: Express $\rightarrow$ Worker $\rightarrow$ D1 (`INTERNAL_D1_BRIDGE_SECRET`)

### 2.1 Purpose and Directionality
During the hybrid migration phase, the Node.js Express backend remains responsible for business logic that requires database access (including administrative functions and password verification workflows). However, Cloudflare D1 is the authoritative database. The Express backend connects to Cloudflare D1 via the internal Worker D1 Bridge endpoint.

- **Request Origin:** Express backend (running on origin server or container behind Cloudflare Tunnel).
- **Request Destination:** Cloudflare Worker edge route (`POST /api/internal/d1/execute`).
- **Transport Security:** TLS 1.3 over Cloudflare Tunnel or authenticated edge domain.

### 2.2 Dedicated Secret & Header
- **Secret Environment Variable:** `INTERNAL_D1_BRIDGE_SECRET`
- **Rotation Overlap Variables:**
  - `INTERNAL_D1_BRIDGE_SECRET_PREVIOUS`
  - `INTERNAL_D1_BRIDGE_SECRET_PREVIOUS_EXPIRES_AT`
- **HTTP Header Name:** `X-STROOM-Bridge-Secret`
- **Secret Format:** Canonical 43-character Base64URL string (unpadded, exactly 256 bits of CSPRNG entropy).

### 2.3 Middleware & Evaluation Responsibilities
- **Middleware Name:** `bridgeAuthMiddleware`
- **Runtime Environment:** Cloudflare Worker (`workerd` V8 isolate).
- **Execution Lifecycle:**
  1. Executes on `POST /api/internal/d1/execute`.
  2. Bypassed entirely for public routes (`/api/public/*`, `/api/health`) and user-facing routes.
  3. Validates Worker environment bindings (`c.env.INTERNAL_D1_BRIDGE_SECRET`) per-request from `c.env`.
  4. If `c.env.INTERNAL_D1_BRIDGE_SECRET` is missing, non-canonical, or if previous rotation overlap exceeds 72 hours, execution halts immediately with **HTTP 500 Internal Server Error** (fails closed).
  5. Inspects incoming `X-STROOM-Bridge-Secret` header. If missing, malformed, or non-matching, execution halts with **HTTP 401 Unauthorized**.
  6. Evaluates comparison using Web Cryptography API (`crypto.subtle.digest('SHA-256')` + `crypto.subtle.timingSafeEqual`).
  7. If primary secret matches, grants execution.
  8. If primary secret does not match, inspects previous secret if configured. Rejects with **HTTP 401** if `now >= previousExpiresAt`. If `now < previousExpiresAt` and double-hash matches, grants execution.

---

## 3. Path 2: Worker $\rightarrow$ Express (`ORIGIN_PROXY_SECRET`)

### 3.1 Purpose and Directionality
To protect the Express origin backend from direct public access and unauthorized bypass of Cloudflare security controls (WAF, DDoS mitigation, rate limiting, and edge caching), the Express backend only accepts proxied authentication requests originating from the Cloudflare Worker.

- **Request Origin:** Cloudflare Worker edge proxy.
- **Request Destination:** Express origin server (`POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/logout`, `POST /api/auth/refresh`, `POST /api/auth/verify-token`).
- **Transport Security:** Cloudflare Tunnel or mutual TLS (mTLS).

### 3.2 Dedicated Secret & Header
- **Secret Environment Variable:** `ORIGIN_PROXY_SECRET`
- **Rotation Overlap Variables:**
  - `ORIGIN_PROXY_SECRET_PREVIOUS`
  - `ORIGIN_PROXY_SECRET_PREVIOUS_EXPIRES_AT`
- **HTTP Header Name:** `X-STROOM-Origin-Secret`
- **Secret Format:** Canonical 43-character Base64URL string (unpadded, exactly 256 bits of CSPRNG entropy).

### 3.3 Middleware & Evaluation Responsibilities
- **Middleware Name:** `originProxyAuthMiddleware`
- **Runtime Environment:** Node.js Express.
- **Execution Lifecycle:**
  1. Mounts upstream of origin authentication controllers (`/api/auth/*`).
  2. Validates Node.js configuration (`process.env.ORIGIN_PROXY_SECRET`) at startup and per-request guard.
  3. If `process.env.ORIGIN_PROXY_SECRET` is missing or invalid, halts with **HTTP 500 Internal Server Error** (fails closed).
  4. Inspects incoming `X-STROOM-Origin-Secret` header. If missing, malformed, or non-matching, halts immediately with **HTTP 403 Forbidden** (preventing direct origin access).
  5. Evaluates comparison using Node.js `node:crypto` (`createHash('sha256')` + `timingSafeEqual`).
  6. Rejects with **HTTP 403 Forbidden** if `now >= previousExpiresAt`.
  7. If authenticated, passes request to Express auth controller.

---

## 4. Cryptographic Cross-Substitution Defense

### 4.1 Threat Model
If an attacker intercepts or extracts one secret, they must not be able to compromise the other pathway. For example:
- A malicious actor who discovers `ORIGIN_PROXY_SECRET` from a compromised origin log or proxy header must NOT be able to execute arbitrary queries on Cloudflare D1 via the Worker bridge.
- A compromise of `INTERNAL_D1_BRIDGE_SECRET` must NOT permit bypassing edge controls to call Express authentication routes.

### 4.2 Architectural Enforcement
1. **Independent Cryptographic Material:** Both secrets are generated independently using 32 bytes of cryptographically secure pseudorandom entropy (`crypto.randomBytes(32)`). They share no common seed, salt, or derivation tree.
2. **Header Isolation:** The bridge evaluates only `X-STROOM-Bridge-Secret`; the origin proxy evaluates only `X-STROOM-Origin-Secret`.
3. **Double-Hash Incompatibility:** Because timing-safe comparison matches SHA-256 digests of distinct 256-bit entropy values, cross-supplying secrets yields an immediate cryptographic mismatch ($P < 2^{-256}$).

### 4.3 Empirical Cross-Substitution Verification
Empirical tests executed in `scratch/test-separate-contracts.mjs` confirm:
- Supplying `INTERNAL_D1_BRIDGE_SECRET` to Express Origin Proxy $\rightarrow$ **REJECTED (HTTP 403 Forbidden)**.
- Supplying `ORIGIN_PROXY_SECRET` to Worker D1 Bridge Route $\rightarrow$ **REJECTED (HTTP 401 Unauthorized)**.

---

## 5. Browser Client Inaccessibility

### 5.1 Zero Client Exposure
Neither secret is ever exposed to the client browser:
1. **No `VITE_` Prefix:** Vite strictly isolates client-facing environment variables by requiring the `VITE_` prefix. Neither `INTERNAL_D1_BRIDGE_SECRET` nor `ORIGIN_PROXY_SECRET` contains this prefix.
2. **Build-Time Verification:** Static inspection of the frontend build outputs (`dist/`) confirms zero references to either variable name or secret string.
3. **No Client Distribution:** Browser clients communicate with STROOM via standard HTTPS cookies (`stroom_session`) and `Authorization: Bearer <jwt>`. The browser is completely unaware of the bridge and origin secrets.

### 5.2 Edge Header Stripping and Ingress Sanitization
To prevent malicious clients from attempting to spoof internal headers, the Cloudflare Worker ingress gateway executes mandatory header hygiene on all incoming external requests:
- Any incoming request carrying `X-STROOM-Bridge-Secret` from an external client is either ignored or overwritten before route processing.
- Any incoming request carrying `X-STROOM-Origin-Secret` from an external client is stripped immediately at the Cloudflare edge before dispatching reverse-proxy requests to the origin.

---

## 6. Separate Configuration Validation and Rotation Lifecycles

### 6.1 Independent Rotation Schedules
Because the two secrets protect distinct network segments, their rotation lifecycles are completely decoupled:
- `INTERNAL_D1_BRIDGE_SECRET` may be rotated independently whenever Cloudflare Worker secrets are updated.
- `ORIGIN_PROXY_SECRET` may be rotated independently whenever origin infrastructure or Cloudflare Tunnel configurations are maintained.
- Rotating one secret requires **zero** changes to the other secret's environment variables or services.

### 6.2 Rotation Contract Specification
Both runtimes utilize the verified Phase 2.5.1.0.5 rotation specification:
- **Canonical Format:** 43-character Base64URL string (`[A-Za-z0-9_-]{43}`).
- **Maximum Overlap Ceiling:** Exactly 72 hours ($259,200,000\text{ ms}$). Configured expiry exceeding 72 hours from validation time fails closed (throws fatal config error).
- **Strict Expiry Boundary:** Rejection occurs when `now >= previousExpiresAt`. At the exact millisecond of expiry, the previous secret is revoked.

### 6.3 Algorithmic Reuse Without Credential Coupling
The mathematical engine (canonical validation, SHA-256 pre-hashing, fixed-length allocation, `timingSafeEqual`, 72-hour overlap ceiling, and strict boundary check) is identical across runtimes. However, each runtime executes this logic against its own isolated environment variables:

| Path | Primary Secret Variable | Previous Secret Variable | Expiry Timestamp Variable |
| :--- | :--- | :--- | :--- |
| **Express $\rightarrow$ Worker** | `INTERNAL_D1_BRIDGE_SECRET` | `INTERNAL_D1_BRIDGE_SECRET_PREVIOUS` | `INTERNAL_D1_BRIDGE_SECRET_PREVIOUS_EXPIRES_AT` |
| **Worker $\rightarrow$ Express** | `ORIGIN_PROXY_SECRET` | `ORIGIN_PROXY_SECRET_PREVIOUS` | `ORIGIN_PROXY_SECRET_PREVIOUS_EXPIRES_AT` |

---

## 7. HTTP Status Code Discipline: 500 vs 401 / 403

To maintain strict operational clarity, prevent security regressions, and avoid masking infrastructure faults as client authentication failures, all endpoints adhere to the following status code contract:

```
+----------------------------------------------------------------------------------------------------+
|                                HTTP STATUS CODE DECISION LOGIC                                     |
+----------------------------------------------------------------------------------------------------+
|                                                                                                    |
|    [Incoming Request]                                                                              |
|             |                                                                                      |
|             v                                                                                      |
|    Is Server Environment Configuration Valid?                                                      |
|    (Primary present, canonical 43 chars, overlap <= 72h)                                           |
|             |                                                                                      |
|             +---- NO  -----> [HTTP 500 Internal Server Error]                                      |
|             |                (Redacted error body: {"error": "Internal Server Error"})             |
|             |                (Server configuration / binding failure - fail closed)                |
|             v                                                                                      |
|            YES                                                                                     |
|             |                                                                                      |
|    Is Incoming Request Header Valid?                                                               |
|    (Supplied header matches primary or unexpired previous)                                         |
|             |                                                                                      |
|             +---- NO  -----> Target is D1 Bridge?    ==> [HTTP 401 Unauthorized]                   |
|             |                Target is Origin Proxy? ==> [HTTP 403 Forbidden]                      |
|             v                                                                                      |
|            YES                                                                                     |
|             |                                                                                      |
|             v                                                                                      |
|    [Proceed to Business Logic / Database / Proxy] ==> [HTTP 200 OK]                                |
|                                                                                                    |
+----------------------------------------------------------------------------------------------------+
```

### 7.1 HTTP 500 Internal Server Error (Server Configuration Failure)
- **Condition:** Server environment variables are missing, malformed, non-canonical, or configured with an overlap exceeding 72 hours.
- **Behavior:** Fails closed immediately.
- **Response Body:** Redacted generic JSON (`{ "error": "Internal Server Error" }`). Internal error messages are logged securely to server logs and never exposed to the caller.

### 7.2 HTTP 401 Unauthorized (D1 Bridge Client Authentication Failure)
- **Condition:** Request to `POST /api/internal/d1/execute` lacks `X-STROOM-Bridge-Secret`, supplies an invalid secret, or supplies an expired previous secret.
- **Behavior:** Rejection of unauthenticated bridge caller.

### 7.3 HTTP 403 Forbidden (Origin Proxy Access Rejection)
- **Condition:** Request to Express `/api/auth/*` lacks `X-STROOM-Origin-Secret`, supplies an invalid secret, or supplies an expired previous secret.
- **Behavior:** Rejection of unauthorized caller attempting to reach origin without passing through Cloudflare Worker edge proxy.

---

## 8. Public Traffic Isolation

A critical requirement of the STROOM architecture is that public traffic must **never** be impacted by bridge or origin proxy configuration errors:
- **Public Routes:** `GET /api/public/*`, `GET /api/health`, and static UI assets (`/`, `/index.html`, `/assets/*`).
- **Middleware Exemption:** Neither `bridgeAuthMiddleware` nor `originProxyAuthMiddleware` is registered on public route branches.
- **Resilience Proof:** If `INTERNAL_D1_BRIDGE_SECRET` or `ORIGIN_PROXY_SECRET` is unset, corrupt, or invalid, public requests continue to resolve with **HTTP 200 OK** without error.

---

## 9. Conclusion

The dual-secret security model guarantees strict defense-in-depth across the STROOM hybrid deployment. By isolating `INTERNAL_D1_BRIDGE_SECRET` from `ORIGIN_PROXY_SECRET`, enforcing strict fail-closed configuration validation, preventing browser exposure, and decoupling rotation lifecycles, the architecture satisfies all security criteria established in Phase 2.5.1.0.6.
