# STROOM — Phase 2.4.1: Routing & Origin Integration Design

**Project:** `D:\ST`  
**Branch:** `feature/stroom-production-launch`  
**Approved Baseline Commit:** `19c4176`  
**Document Version:** 1.0.0 (Phase 2.4.1 Edge Routing Specification)  
**Security Level:** Critical Edge Network Architecture  
**Phase Status:** **APPROVED FOR PHASE 2.5 IMPLEMENTATION PLANNING**

---

## 1. Executive Summary & Problem Definition

In Phase 2.4, the preliminary design claimed that Cloudflare Pages' `public/_routes.json` file could be used to split incoming traffic: routing `/api/auth/login` and `/api/auth/register` to the Express backend while routing all other `/api/*` endpoints to Cloudflare Workers.

This document formally corrects that routing architecture. Using official Cloudflare documentation, it analyzes Cloudflare's routing mechanisms and establishes a production-grade, technically accurate **Worker Edge Reverse Proxy Architecture** using standard Fetch API forwarding.

---

## 2. Cloudflare Routing Mechanics: Technical Analysis

To determine how requests are genuinely routed in Cloudflare's network, six distinct routing models were evaluated:

### 2.1 Model 1: Pages `_routes.json` (Corrected Understanding)
- **Official Specification:**  
  Cloudflare Pages `_routes.json` is strictly an internal invocation gate. It defines which URL paths execute Pages Functions (Workers) versus which URL paths are served as pre-built static files from the Pages static asset store.
- **Why It Cannot Route to Express:**  
  `_routes.json` has no concept of an external IP, hostname, or origin URL. If `/api/auth/login` is placed in `"exclude"`, Pages bypasses the Function and attempts to find a static file at `dist/api/auth/login`. Because no static file exists, Cloudflare serves `index.html` (for SPAs) or returns `404 Not Found`.

---

### 2.2 Model 2: Worker Edge Reverse Proxy (`fetch()` Subrequest) — RECOMMENDED
- **Official Specification:**  
  In Cloudflare Workers, incoming HTTP requests can be conditionally forwarded to an external origin server using the standard Web `fetch()` API (`Request` / `Response` streaming).
- **How It Works:**
  - The Worker intercepts all requests matching `/api/*`.
  - If the path matches an authentication route (`/api/auth/login`, `/api/auth/register`, `/api/users/me/change-password`, `/api/auth/reset-demo`), the Worker forwards the exact HTTP request to the configured Express origin (`EXPRESS_ORIGIN_URL`).
  - For all other `/api/*` paths, the Worker executes the request locally in Hono, verifies the JWT, and queries Cloudflare D1.
- **Why It Is Recommended:**
  - **Works Identically in Local Development:** Local `wrangler dev` (port 8787) proxies auth routes to `http://localhost:5000` while serving ported routes locally.
  - **Works Identically in Production:** Production Worker proxies auth routes to `https://auth-origin.stroom.club` while serving ported routes at the global edge.
  - **Zero Frontend Changes:** Frontend SPA continues calling `/api/*` on its own origin. No separate domain configuration, no cross-subdomain CORS drops.

---

### 2.3 Model 3: Cloudflare Worker Routes (Zone Level)
- **Official Specification:**  
  Cloudflare DNS allows assigning Workers to specific route patterns across an entire custom domain zone (e.g. `stroom.club/api/events/*` assigned to Worker, while `stroom.club/api/auth/*` bypasses Worker to default DNS origin).
- **Limitation:**  
  Worker Routes operate exclusively at the Cloudflare Zone DNS level. They cannot be tested locally in Miniflare (`wrangler dev`), creating an unacceptable discrepancy between local testing and production behavior.

---

### 2.4 Model 4: Worker Service Bindings
- **Official Specification:**  
  Service Bindings allow one Worker to invoke another Worker with zero network latency using direct V8 isolate context sharing.
- **Limitation:**  
  Service Bindings only operate between two Cloudflare Workers. They cannot connect to a Node.js + Express server running outside Cloudflare.

---

### 2.5 Model 5: Separate API / Auth Hostnames (`auth.stroom.club` vs `api.stroom.club`)
- **Limitation:**  
  Requires modifying the frontend React client (`src/services/api.ts`) to maintain two distinct `API_BASE` URLs, re-introducing cross-origin CORS preflight overhead and complex credentials handling.

---

## 3. Recommended Architecture: Worker Edge Reverse Proxy Specification

```
                                [Client Browser (SPA)]
                                          │
                                HTTP Request (/api/*)
                                          │
                                          ▼
                      ┌───────────────────────────────────────┐
                      │    Cloudflare Worker / Hono Router    │
                      │               (Port 8787)             │
                      └───────────────────┬───────────────────┘
                                          │
                      ┌───────────────────┴───────────────────┐
                      │ Path Matcher                          │
                      └─────────┬───────────────────┬─────────┘
                                │                   │
       /api/auth/login          │                   │ All Other API Paths
       /api/auth/register       │                   │ (/api/events, /api/auctions,
       /api/users/me/change-pwd │                   │  /api/passes, /api/admin, etc.)
                                ▼                   ▼
                  ┌──────────────────────┐ ┌──────────────────────┐
                  │  Edge Reverse Proxy  │ │  Local Hono Handlers │
                  │     (fetch API)      │ │  (JWT verify + D1)   │
                  └──────────┬───────────┘ └──────────┬───────────┘
                             │                        │
               HTTP Forward  │                        │ Direct Binding
                             ▼                        ▼
                  ┌──────────────────────┐ ┌──────────────────────┐
                  │    Express Origin    │ │   Cloudflare D1 DB   │
                  │   (Port 5000 / VPS)  │ │      (42 Tables)     │
                  └──────────────────────┘ └──────────────────────┘
```

---

## 4. Technical Forwarding Specifications

### 4.1 Path Matching Contract
The Worker proxy router intercepts and forwards the following exact paths and prefixes:
1. `POST /api/auth/login`
2. `POST /api/auth/register`
3. `POST /api/users/me/change-password`
4. `POST /api/auth/reset-demo` (Development environment only)

All other endpoints under `/api/*` are handled natively by Hono.

---

### 4.2 Header Preservation & Hop-by-Hop Sanitization
When proxying requests to Express, the Worker must preserve client intent while adhering to RFC 7230 (HTTP/1.1 Message Syntax):

#### Preserved Headers:
- `Authorization`: Transmits `Bearer <token>` untouched.
- `Content-Type`: Transmits `application/json`, `multipart/form-data`, etc.
- `Content-Length`: Transmits payload size.
- `Accept`, `Accept-Language`, `User-Agent`: Preserves client telemetry.

#### Injected / Overridden Headers:
- `Host`: Overridden to match the target Express origin host (e.g. `localhost:5000` or `auth-origin.stroom.club`).
- `X-Forwarded-For`: Injected with `CF-Connecting-IP` (the client's genuine IP address) to ensure Express rate limiting operates on real client IPs rather than the Cloudflare edge IP.
- `X-Forwarded-Proto`: Set to `https` (or `http` in local dev).
- `X-Forwarded-Host`: Set to the public frontend hostname (e.g. `stroom.club`).

#### Stripped Hop-by-Hop Headers (RFC 7230 §6.1):
The Worker must explicitly remove connection-specific headers before forwarding:
- `Connection`, `Keep-Alive`, `Proxy-Authenticate`, `Proxy-Authorization`, `TE`, `Trailers`, `Transfer-Encoding`, `Upgrade`.

---

### 4.3 Request & Response Body Streaming
- For `POST` and `PUT` requests, the Worker streams `c.req.raw.body` directly to the Express origin using `ReadableStream`.
- For responses, the Worker streams `originResponse.body` directly back to the client browser without buffering the full response into Worker memory, minimizing memory footprint and latency.

---

### 4.4 CORS & Preflight (OPTIONS) Handling
- The Worker handles CORS preflight (`OPTIONS`) requests at the edge using Hono's `cors()` middleware:
  - Allowed Origins: Configured to authorized frontend origins.
  - Allowed Methods: `GET, POST, PUT, DELETE, PATCH, OPTIONS`.
  - Allowed Headers: `Content-Type, Authorization, X-Requested-With`.
  - Credentials: `true`.
- For proxied auth routes, preflight requests are resolved at the edge Worker; only actual `POST` requests are forwarded to Express.

---

### 4.5 Timeout & Failure Behavior (Circuit Breaking)
- **Subrequest Timeout:** A strict **10-second timeout** is enforced using `AbortSignal.timeout(10000)`.
- **Origin Unreachable:** If Express is unreachable (network drop, ECONNREFUSED, timeout):
  The Worker returns an immediate, structured `503 Service Unavailable` JSON response:
  ```json
  {
    "error": "Authentication service is temporarily unavailable. Please try again shortly.",
    "code": "AUTH_ORIGIN_UNREACHABLE",
    "timestamp": "2026-11-13T16:51:00Z"
  }
  ```
- **Error Redaction:** The response hides internal origin IPs, ports, and stack traces.

---

## 5. Rollback Procedure

If the Worker proxy implementation encounters unexpected edge issues:
1. **Immediate Fallback (< 60s):**
   Update the deployment configuration to point all client API calls directly to the Express origin backend.
2. **Zero Incompatible State:**
   Because Express holds the authoritative password hashing and user creation logic throughout this phase, rolling back the Worker proxy leaves database records, passwords, and sessions completely unharmed.
