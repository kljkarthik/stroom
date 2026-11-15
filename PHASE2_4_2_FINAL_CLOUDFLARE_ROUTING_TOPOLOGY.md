# STROOM — Phase 2.4.2: Final Cloudflare Routing Topology Specification

**Project:** `D:\ST`  
**Branch:** `feature/stroom-production-launch`  
**Approved Baseline Commit:** `19c4176`  
**Document Version:** 1.0.0 (Phase 2.4.2 Routing Topology Specification)  
**Security Classification:** Production Infrastructure Topology  
**Phase Status:** **APPROVED FOR PHASE 2.5 IMPLEMENTATION PLANNING**

---

## 1. Executive Summary & Recommended Topology

This document selects and specifies the single, concrete Cloudflare edge routing topology for STROOM.

### Selected Topology: Cloudflare Pages Advanced Mode (`_worker.js`) with Origin Tunneling

```
                            [Internet Client (Browser SPA)]
                                          │
                                HTTPS Request (stroom.club)
                                          │
                                          ▼
                      ┌───────────────────────────────────────┐
                      │        Cloudflare Global Anycast      │
                      │          (Pages Edge Platform)        │
                      └───────────────────┬───────────────────┘
                                          │
                    ┌─────────────────────┴─────────────────────┐
                    │ Static Asset? (/assets/*, favicon, etc.)  │
                    └─────────┬───────────────────────┬─────────┘
                       YES    │                       │ NO (Matches /api/* or SPA route)
                              ▼                       ▼
                  ┌──────────────────────┐ ┌──────────────────────────────────────┐
                  │ Cloudflare Pages CDN │ │   Advanced Mode Worker (_worker.js)  │
                  │ (env.ASSETS.fetch)   │ │      (Compiled Hono Application)     │
                  └──────────────────────┘ └──────────────────┬───────────────────┘
                                                              │
                                     ┌────────────────────────┴────────────────────────┐
                                     │ Path Inspection & Routing Gate                  │
                                     └────────────┬────────────────────────┬───────────┘
                                                  │                        │
       /api/auth/login                            │                        │ All other 152 API Routes
       /api/auth/register                         │                        │ (/api/events, /api/auctions,
       /api/users/me/change-pwd                   │                        │  /api/passes, /api/admin, etc.)
       /api/auth/reset-demo                       │                        │
                                                  ▼                        ▼
                                     ┌────────────────────────┐ ┌────────────────────────┐
                                     │   Reverse Proxy fetch  │ │ Native Hono Handlers   │
                                     │  (Inject Secret Header)│ │ (JWT Verify + D1 Read) │
                                     └────────────┬───────────┘ └───────────┬────────────┘
                                                  │                         │
                                     Encrypted    │                         │ Native
                                     Cloudflare   │                         │ D1 Binding
                                     Tunnel       │                         │ (env.DB)
                                                  ▼                         ▼
                                     ┌────────────────────────┐ ┌────────────────────────┐
                                     │     Express Origin     │ │   Cloudflare D1 DB     │
                                     │   (Zero Inbound Ports) │ │   (Authoritative Data) │
                                     └────────────────────────┘ └────────────────────────┘
```

---

## 2. Distinction of Cloudflare Routing Mechanisms

Official Cloudflare documentation distinguishes these mechanisms:

### 2.1 Cloudflare Pages Functions vs Advanced Mode (`_worker.js`)
- **Pages Functions (`functions/` directory):**  
  File-based routing where each file (e.g. `functions/api/events.ts`) is compiled into an individual route segment.  
  *Limitation:* Rigid file-system routing structure that complicates centralized middleware, custom error handling, and Hono integration.
  *Documentation:* [Cloudflare Pages Functions](https://developers.cloudflare.com/pages/functions/)
- **Pages Advanced Mode (`_worker.js`):** — **SELECTED**  
  Instead of multiple function files, the entire serverless application is compiled into a single `_worker.js` file placed in the build output directory (`dist/_worker.js`).  
  *Advantage:* Gives full, unconstrained control over the Hono application, global middleware, CORS, error boundaries, and environment bindings.  
  *Documentation:* [Cloudflare Pages Advanced Mode](https://developers.cloudflare.com/pages/functions/advanced-mode/)

### 2.2 Why Worker Routes & Custom Domains Were Not Selected
- **Worker Routes (Zone Level):** Operates on DNS zones, bypassing Pages. It creates configuration drift between local testing (`wrangler dev`) and production routing.
- **Worker Custom Domains:** Useful for standalone APIs, but splits the SPA frontend (`stroom.club`) from the API (`api.stroom.club`), introducing cross-origin preflight latency and CORS complexity.
- *Documentation:* [Cloudflare Worker Routes](https://developers.cloudflare.com/workers/configuration/routing/routes/)

---

## 3. Component Responsibilities & Path Dispatch

| Component | Physical Artifact | Execution Target | Responsibilities |
| :--- | :--- | :--- | :--- |
| **Cloudflare Pages CDN** | `dist/` | Cloudflare Edge | Serves static assets (`.js`, `.css`, images, `index.html`) with 0ms Worker execution time. |
| **Hono Edge Worker** | `dist/_worker.js` | Cloudflare Workers Runtime | Intercepts all dynamic requests; verifies JWTs; executes migrated business logic against D1. |
| **Worker Reverse Proxy Router** | `src/worker/routes/authProxy.ts` | Cloudflare Workers Runtime | Identifies the 4 auth endpoints and streams requests to the Express origin backend. |
| **Cloudflare Tunnel (`cloudflared`)** | `cloudflared` daemon | Express Host | Creates outbound-only encrypted tunnel from Express host to Cloudflare network; 0 inbound ports. |
| **Express Auth Origin** | `server/index.ts` | Node.js Process (VPS / Host) | Executes scrypt hashing, password verification, and legacy upgrades; issues HS256 JWTs. |

---

## 4. Protection of the Express Origin from Unauthorized Access

In production, the Express backend must never be exposed directly to the public internet. It is protected by dual security perimeters:

### Perimeter 1: Cloudflare Tunnel (No Inbound Public IP)
- **Mechanism:** The Express origin host runs Cloudflare's lightweight connector daemon (`cloudflared`).
- **Security:** The host firewall blocks **all inbound ports** (including 80, 443, and 5000). The daemon establishes an outbound-only connection to Cloudflare edge data centers.
- **Documentation:** [Cloudflare Tunnel Architecture](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/)

### Perimeter 2: Cryptographic Shared Secret (`X-STROOM-Origin-Secret`)
- **Mechanism:** The Hono Worker injects an internal secret header on every proxied request:
  `X-STROOM-Origin-Secret: <64-character-cryptographic-hex-token>`
- **Express Enforcement Middleware:**
  ```ts
  app.use('/api/auth', (req, res, next) => {
    if (config.isProduction) {
      const incomingSecret = req.headers['x-stroom-origin-secret'];
      if (!incomingSecret || incomingSecret !== config.originSecret) {
        return res.status(403).json({ error: 'Direct access to origin server is forbidden.' });
      }
    }
    next();
  });
  ```
- **Documentation:** [Cloudflare Authenticated Origin Pulls / Headers](https://developers.cloudflare.com/ssl/origin-configuration/authenticated-origin-pull/)

---

## 5. End-to-End Request Flows

### 5.1 Local Development Request Flow
- Client SPA runs on `http://localhost:3000` (Vite dev server).
- Express runs on `http://localhost:5000` (`npm run dev:server`).
- Worker runs on `http://localhost:8787` (`npm run dev:worker`).
- Client makes requests to `http://localhost:8787/api/*`:
  - Auth routes (`/api/auth/login`, `/register`): Worker forwards to `http://localhost:5000`.
  - Application routes (`/api/events`, etc.): Worker executes against local Miniflare D1 database.

### 5.2 Production Request Flow
1. Client requests `https://stroom.club/api/events`.
2. Cloudflare Anycast routes to nearest edge data center.
3. Edge executes `_worker.js` (Hono).
4. WebCrypto verifies JWT in $<0.5\text{ ms}$; checks in-isolate cache.
5. Hono executes prepared SQL query against D1 binding (`env.DB`).
6. JSON response returned to client in $<50\text{ ms}$ round-trip.

### 5.3 Rollback Request Flow
If the Worker edge layer experiences an operational incident:
1. Cloudflare DNS / Tunnel route for `stroom.club/api/*` is updated to point directly to the Express origin server.
2. In $<60$ seconds, 100% of API traffic bypasses the Worker and executes against the Express backend.
3. Because Express generated the original JWTs and understands the database models, all sessions and functionality continue operating without disruption.
