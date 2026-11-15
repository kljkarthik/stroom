# STROOM — Phase 2.5.1.0.6: Route Security Matrix & Traffic Boundaries

**Project:** `D:\ST`  
**Branch:** `feature/stroom-production-launch`  
**Approved Baseline Commit:** `19c4176`  
**Document Version:** 1.0.0 (Comprehensive Route Security Matrix & Boundary Specification)  
**Security Classification:** Route Architecture & Traffic Boundary Standard  
**Mode:** STRICT READ-ONLY AUDIT & SPECIFICATION (Zero code changes, zero database mutations)  
**Date:** November 14, 2026  

---

## 1. Overview & Traffic Boundary Architecture

In the STROOM hybrid deployment, traffic flows across four distinct security zones:
1. **Public Zone (Untrusted Ingress):** Anonymous public visitors and browser clients accessing static assets, system health, and public catalogs.
2. **Client Authenticated Zone (Edge Terminated):** End-user traffic carrying JWT session tokens, authenticated and terminated directly at the Cloudflare Worker edge.
3. **Origin Proxy Zone (Worker $\rightarrow$ Express):** Secure reverse-proxy traffic directed from the Cloudflare Worker edge to the Express origin backend for password verification and authentication workflows, guarded by `ORIGIN_PROXY_SECRET`.
4. **Internal Bridge Zone (Express $\rightarrow$ Worker $\rightarrow$ D1):** Secure database execution traffic initiated by the Express backend to query Cloudflare D1 via the Worker bridge endpoint, guarded by `INTERNAL_D1_BRIDGE_SECRET`.

---

## 2. Comprehensive Route Security Matrix

The following table provides the exhaustive security contract for each route family across the STROOM system:

| Route / Pattern | Method | Request Origin | Destination Runtime | Auth Mechanism | Secret / Credential Name | Enforcing Middleware | Server Config Failure | Client Auth Failure | Route Category |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `/*` (Static UI Assets) | `GET` | Browser Client | Cloudflare Pages / Edge | None (Public) | None | None (Static Asset Handler) | `N/A` (Static) | `N/A` (Public) | Public Static |
| `/api/health` | `GET` | External / Monitor | Cloudflare Worker Edge | None (Public) | None | None | `N/A` | `N/A` | Public Health |
| `/api/public/events` | `GET` | Browser Client | Cloudflare Worker Edge | None (Public) | None | None | `N/A` | `N/A` | Public Catalog |
| `/api/public/venues` | `GET` | Browser Client | Cloudflare Worker Edge | None (Public) | None | None | `N/A` | `N/A` | Public Catalog |
| `/api/public/sports` | `GET` | Browser Client | Cloudflare Worker Edge | None (Public) | None | None | `N/A` | `N/A` | Public Catalog |
| `/api/public/*` (All Public) | `GET` | Browser Client | Cloudflare Worker Edge | None (Public) | None | None | `N/A` | `N/A` | Public Catalog |
| `/api/internal/d1/execute` | `POST` | Origin Express Backend | Cloudflare Worker Edge $\rightarrow$ D1 | `X-STROOM-Bridge-Secret` | `INTERNAL_D1_BRIDGE_SECRET` | `bridgeAuthMiddleware` (Worker) | `500 Internal Server Error` | `401 Unauthorized` | Internal D1 Bridge |
| `/api/auth/register` | `POST` | Worker Edge Proxy | Origin Express Backend | `X-STROOM-Origin-Secret` | `ORIGIN_PROXY_SECRET` | `originProxyAuthMiddleware` (Express) | `500 Internal Server Error` | `403 Forbidden` | Origin Auth Proxy |
| `/api/auth/login` | `POST` | Worker Edge Proxy | Origin Express Backend | `X-STROOM-Origin-Secret` | `ORIGIN_PROXY_SECRET` | `originProxyAuthMiddleware` (Express) | `500 Internal Server Error` | `403 Forbidden` | Origin Auth Proxy |
| `/api/auth/logout` | `POST` | Worker Edge Proxy | Origin Express Backend | `X-STROOM-Origin-Secret` | `ORIGIN_PROXY_SECRET` | `originProxyAuthMiddleware` (Express) | `500 Internal Server Error` | `403 Forbidden` | Origin Auth Proxy |
| `/api/auth/refresh` | `POST` | Worker Edge Proxy | Origin Express Backend | `X-STROOM-Origin-Secret` | `ORIGIN_PROXY_SECRET` | `originProxyAuthMiddleware` (Express) | `500 Internal Server Error` | `403 Forbidden` | Origin Auth Proxy |
| `/api/auth/verify-token` | `POST` | Worker Edge Proxy | Origin Express Backend | `X-STROOM-Origin-Secret` | `ORIGIN_PROXY_SECRET` | `originProxyAuthMiddleware` (Express) | `500 Internal Server Error` | `403 Forbidden` | Origin Auth Proxy |
| `/api/auth/me` | `GET` | Browser Client | Cloudflare Worker Edge | JWT Cookie / Bearer | `JWT_SECRET` | `authMiddleware` (Worker) | `500 Internal Server Error` | `401 Unauthorized` | User Authenticated |
| `/api/users/profile` | `GET`, `PUT` | Browser Client | Cloudflare Worker Edge | JWT Cookie / Bearer | `JWT_SECRET` | `authMiddleware` (Worker) | `500 Internal Server Error` | `401 Unauthorized` | User Authenticated |
| `/api/users/preferences` | `GET`, `PUT` | Browser Client | Cloudflare Worker Edge | JWT Cookie / Bearer | `JWT_SECRET` | `authMiddleware` (Worker) | `500 Internal Server Error` | `401 Unauthorized` | User Authenticated |
| `/api/users/passport` | `GET`, `POST` | Browser Client | Cloudflare Worker Edge | JWT Cookie / Bearer | `JWT_SECRET` | `authMiddleware` (Worker) | `500 Internal Server Error` | `401 Unauthorized` | User Authenticated |
| `/api/communities/*` | `GET`, `POST` | Browser Client | Cloudflare Worker Edge | JWT Cookie / Bearer | `JWT_SECRET` | `authMiddleware` (Worker) | `500 Internal Server Error` | `401 Unauthorized` | User Authenticated |
| `/api/venues/*` | `GET`, `POST` | Browser Client | Cloudflare Worker Edge | JWT Cookie / Bearer | `JWT_SECRET` | `authMiddleware` (Worker) | `500 Internal Server Error` | `401 Unauthorized` | User Authenticated |
| `/api/bookings/*` | `GET`, `POST` | Browser Client | Cloudflare Worker Edge | JWT Cookie / Bearer | `JWT_SECRET` | `authMiddleware` (Worker) | `500 Internal Server Error` | `401 Unauthorized` | User Authenticated |
| `/api/passes/*` | `GET`, `POST` | Browser Client | Cloudflare Worker Edge | JWT Cookie / Bearer | `JWT_SECRET` | `authMiddleware` (Worker) | `500 Internal Server Error` | `401 Unauthorized` | User Authenticated |
| `/api/auctions/*` | `GET`, `POST` | Browser Client | Cloudflare Worker Edge | JWT Cookie / Bearer | `JWT_SECRET` | `authMiddleware` (Worker) | `500 Internal Server Error` | `401 Unauthorized` | User Authenticated |
| `/api/partner/*` | ALL | Browser Client | Cloudflare Worker Edge | JWT + Partner Role | `JWT_SECRET` | `authMiddleware` + `requirePartner` | `500 Internal Server Error` | `401` / `403 Forbidden` | Partner RBAC |
| `/api/admin/*` | ALL | Browser Client | Cloudflare Worker Edge | JWT + Admin Role | `JWT_SECRET` | `authMiddleware` + `requireAdmin` | `500 Internal Server Error` | `401` / `403 Forbidden` | Admin RBAC |

---

## 3. Fail-Closed vs Fail-Open Architectural Boundaries

STROOM strictly adheres to the principle of least privilege and fail-closed security for all sensitive endpoints, while isolating public assets to prevent unnecessary denial of service:

### 3.1 Fail-Closed Boundaries (Security Protected Paths)
1. **D1 Bridge Endpoint (`/api/internal/d1/execute`):**
   - If Worker environment variable `INTERNAL_D1_BRIDGE_SECRET` is unset, null, empty string, non-canonical, or configured with an overlap exceeding 72 hours $\rightarrow$ **HALTS IMMEDIATELY with HTTP 500**.
   - If incoming header `X-STROOM-Bridge-Secret` is omitted, malformed, non-matching, or timestamp is expired $\rightarrow$ **HALTS IMMEDIATELY with HTTP 401**.
   - Zero SQL execution is performed unless both server configuration and client authentication pass validation.
2. **Express Origin Proxy Endpoints (`/api/auth/*`):**
   - If Node.js environment variable `ORIGIN_PROXY_SECRET` is unset, null, empty, non-canonical, or configured with an overlap exceeding 72 hours $\rightarrow$ **HALTS IMMEDIATELY with HTTP 500**.
   - If incoming header `X-STROOM-Origin-Secret` is omitted, malformed, non-matching, or expired $\rightarrow$ **HALTS IMMEDIATELY with HTTP 403**.
   - Direct requests bypassing the Cloudflare Worker are completely blocked at origin ingress.

### 3.2 Fail-Safe Public Boundaries (Availability Protected Paths)
1. **Public Catalog & Health Endpoints (`/api/public/*`, `/api/health`):**
   - Do NOT invoke `bridgeAuthMiddleware` or `originProxyAuthMiddleware`.
   - Complete failure, misconfiguration, or rotation errors in `INTERNAL_D1_BRIDGE_SECRET` or `ORIGIN_PROXY_SECRET` have **zero effect** on public catalog availability.
   - Public requests continue serving with **HTTP 200 OK**.
2. **Static Web Application Assets (`/*`):**
   - Handled directly by Cloudflare Pages / Workers static asset fetcher.
   - Completely independent of backend server secrets.

---

## 4. Ingress Header Hygiene & Stripping Rules

To guarantee that browser clients or external attackers cannot spoof internal authentication headers, Cloudflare Worker ingress enforces strict header sanitation:

```
[External Request from Browser / Internet]
                   |
                   v
+--------------------------------------------------------------------+
|               Cloudflare Ingress Sanitizer (Worker Edge)           |
+--------------------------------------------------------------------+
|  1. Inspect incoming request headers.                              |
|  2. If 'X-STROOM-Bridge-Secret' is present:                        |
|     --> Strip / overwrite header before routing.                   |
|  3. If 'X-STROOM-Origin-Secret' is present:                        |
|     --> Strip header immediately before dispatching to origin.    |
|  4. In Origin Reverse Proxy Handler:                               |
|     --> Ingress proxy injects authentic 'X-STROOM-Origin-Secret'    |
|         derived exclusively from Worker 'c.env.ORIGIN_PROXY_SECRET'|
+--------------------------------------------------------------------+
                   |
                   v
        [Downstream Execution]
```

### 4.1 Header Sanitization Invariants
- **Rule 1 (Origin Secret Ingress Strip):** Under no circumstance may an incoming external request header named `X-STROOM-Origin-Secret` be forwarded to Express. The Worker gateway strips any client-provided value and injects the genuine secret from its trusted environment bindings.
- **Rule 2 (Bridge Secret Isolation):** The bridge endpoint `POST /api/internal/d1/execute` is restricted to authorized origin callers. Even if reached externally, only callers possessing the genuine `INTERNAL_D1_BRIDGE_SECRET` can authenticate; any client-spoofed secret fails cryptographic timing-safe comparison.

---

## 5. Security Matrix Verification Summary

| Verification Category | Standard Requirement | Implemented & Verified Status | Evidence |
| :--- | :--- | :---: | :--- |
| **Cross-Path Isolation** | Bridge secret cannot authenticate origin; Origin secret cannot authenticate bridge | **VERIFIED** | `scratch/test-separate-contracts.mjs` Section 1 |
| **Status Code Precision** | Server config fails closed (500); Client auth fails closed (401/403) | **VERIFIED** | `scratch/test-separate-contracts.mjs` Sections 2 & 3 |
| **Public Traffic Resilience** | Broken bridge config leaves public endpoints unaffected | **VERIFIED** | `scratch/test-separate-contracts.mjs` Section 3.1 (`status=200`) |
| **Client Inaccessibility** | Neither secret accessible to Vite build or browser client | **VERIFIED** | Static code audit (No `VITE_` prefix, zero bundle leaks) |
| **Rotation Ceiling** | Independent 72-hour overlap ceiling per path | **VERIFIED** | Machine-enforced overlap validation in both runtimes |
