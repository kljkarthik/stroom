# STROOM (Strangers Room) — Production Deployment & Operations Guide

**Project:** `D:\ST`  
**Target Environment:** Cloudflare Edge (Pages + Workers + D1 + R2) + Origin Express Backend  
**Document Version:** 4.0.0 (Production Release Guide — Final Runtime & Security Closure)  
**Security Classification:** Highly Confidential — Deployment Architecture & Operations Runbook  
**Date:** November 14, 2026  

---

> [!WARNING]
> **REMOTE AUTHORIZATION GATE:**  
> All commands in this guide that interact with remote Cloudflare infrastructure (`wrangler d1 ...`, `wrangler r2 ...`, `wrangler pages deploy`, `wrangler deploy`, DNS modifications) require **explicit manual approval** and must **NEVER** be executed autonomously.

---

## 1. Prerequisites & Tooling Requirements

Before proceeding with production deployment, the deployment operator must possess:

1. **Cloudflare Account & CLI:**
   - Active Cloudflare account with Workers Paid or Enterprise plan (required for D1 and R2 storage).
   - Production Target Node.js: **Node.js 24.22.3** (`>=24.0.0 <25.0.0`) configured in production deployment containers/hosts.
   - Note on Local Environment: Local test verification ran on host Node.js `v18.18.2` (npm `9.8.1`). Execution under Node 24.22.3 remains `[NOT VERIFIED]` until remote/container staging.
   - Wrangler CLI: `wrangler 3.114.17` (bundled in project dependencies; invoked via `npx wrangler`).
   - Authenticated session: `npx wrangler login` or `CLOUDFLARE_API_TOKEN` environment variable configured with permissions:
     - *Account / Cloudflare Pages / Edit*
     - *Account / Workers Scripts / Edit*
     - *Account / D1 / Edit*
     - *Account / Workers R2 Storage / Edit*
     - *Zone / DNS / Edit*
2. **Origin Hosting Infrastructure (Express Backend):**
   - Container or VM running Node.js 24.22.3 with mounted persistent volume for SQLite (e.g. Railway, Render, Fly.io, or AWS EC2).
   - Cloudflare Tunnel (`cloudflared`) installed on the origin server for secure, zero-public-port ingress.
3. **Repository Workspace:**
   - Git branch: `feature/stroom-production-launch`.
   - Verified Checkpoint: `19c4176b87094a6ba7b81ffec7a01b72796c08ec`.

---

## 2. Cloudflare Account Preparation

### Step 2.1: Verify Account ID
```bash
# [REMOTE ACTION: Requires Approval]
npx wrangler whoami
```
Record the `Account ID` output for use in continuous integration and deployment pipelines.

---

## 3. Production API Hostname & Routing Architecture

### Step 3.1: API Hostname Policy (Illustrative Placeholder vs Same-Origin)
- **`https://api.stroom.in` is an unverified illustrative placeholder:** It is used throughout documentation templates to represent the edge Worker API. It is **NOT** pre-provisioned or verified in DNS.
- **Frontend Relative Pathing:** The React frontend source code uses relative paths for all API calls (`/api/*`).
- **Same-Origin Production Design:** When Cloudflare Pages routes `/api/*` to the Worker isolate on the primary domain (`https://stroom.in/api/*` or `https://stroom.pages.dev/api/*`), all frontend traffic remains same-origin (`'self'`).
- **Subdomain Deployment (Optional):** If the production operator decides to bind the Worker to a dedicated subdomain (`https://api.stroom.in`), the operator must:
  1. Create a DNS CNAME record in Cloudflare Dashboard.
  2. Append `https://api.stroom.in` to `connect-src` in `public/_headers`.
  3. Configure CORS origins in Express `.env`.

---

## 4. Cloudflare Pages Configuration (Frontend Hosting)

Cloudflare Pages hosts the compiled React 18 single-page application (`dist/`).

### Step 4.1: Build Configuration
- **Build Command:** `npm run build:client`
- **Build Output Directory:** `dist`
- **Node.js Version in Pages:** Set environment variable `NODE_VERSION=24.22.3` in Cloudflare Pages project settings.

### Step 4.2: SPA Deep-Linking Fallback (`public/_redirects`)
The repository includes [`public/_redirects`](file:///d:/ST/public/_redirects) which Vite copies directly to `dist/_redirects`:
```
/*    /index.html   200
```
This ensures client-side routing routes (e.g. `/events/:id`, `/auctions/:id`, `/dashboard`, `/passport`) resolve to `index.html` with HTTP 200 rather than throwing 404s.

### Step 4.3: Production HTTP Security & Caching Headers (`public/_headers`)
The repository includes [`public/_headers`](file:///d:/ST/public/_headers) which Vite copies to `dist/_headers`:
```
# Static Immutable Assets (Vite chunk hashes)
/assets/*
  Cache-Control: public, max-age=31536000, immutable
  X-Content-Type-Options: nosniff

# Brand Assets
/brand/*
  Cache-Control: public, max-age=86400, stale-while-revalidate=604800
  X-Content-Type-Options: nosniff

# Global Security Headers
/*
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=()
  Strict-Transport-Security: max-age=31536000
  Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob: https://images.unsplash.com https://api.dicebear.com; connect-src 'self'; frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self';
```

> [!NOTE]
> **CSP Hardening Details:**
> - `script-src 'self'`: Zero `'unsafe-inline'` permitted. Tested against `dist/index.html` which loads 100% of scripts as external chunks.
> - `connect-src 'self'`: Agrees with the frontend's relative `/api/*` design. Wildcard schemes (`http:`, broad `https:`, broad `wss:`) are omitted.
> - `Strict-Transport-Security: max-age=31536000`: `preload` and `includeSubDomains` omitted from default configuration until domain-wide HTTPS coverage is verified.

---

## 5. Cloudflare Worker Edge Backend (`stroom-api`)

The Cloudflare Worker isolate handles edge health monitoring, internal D1 bridge operations, R2 media delivery, and ingress proxying to Express.

### Step 5.1: Inspect `wrangler.jsonc`
The root [`wrangler.jsonc`](file:///d:/ST/wrangler.jsonc) configures worker bindings:
```jsonc
{
  "name": "stroom-api",
  "main": "src/worker/index.ts",
  "compatibility_date": "2024-11-01",
  "compatibility_flags": ["nodejs_compat"],
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "stroom-production-db",
      "database_id": "STROOM_D1_DATABASE_ID_PLACEHOLDER"
    }
  ],
  "r2_buckets": [
    {
      "binding": "MEDIA_BUCKET",
      "bucket_name": "stroom-media-production"
    }
  ],
  "vars": {
    "NODE_ENV": "production",
    "PLATFORM_NAME": "STROOM",
    "DEFAULT_CITY": "Hyderabad",
    "AUTH_RATE_LIMIT_MAX": "10",
    "ALLOWED_ORIGINS": "https://stroom.in,https://www.stroom.in,https://stroom.pages.dev"
  }
}
```

---

## 6. Cloudflare D1 Database Provisioning & Schema Migrations

### Step 6.1: Create Remote D1 Database
```bash
# [REMOTE ACTION: Requires Approval]
npx wrangler d1 create stroom-production-db
```
The CLI will output the generated `database_id` (e.g. `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`).

### Step 6.2: Update `wrangler.jsonc`
Insert the real `database_id` into [`wrangler.jsonc`](file:///d:/ST/wrangler.jsonc) under the `d1_databases` array.

### Step 6.3: Apply Schema & Metadata Migrations Sequentially
```bash
# [REMOTE ACTION: Requires Approval]
# 1. Core 42-Table Application Schema
npx wrangler d1 execute stroom-production-db --remote --file=./migrations/0001_initial_schema.sql

# 2. Essential Metadata & Seed Configurations
npx wrangler d1 execute stroom-production-db --remote --file=./migrations/0002_essential_metadata.sql

# 3. Nonce Replay Guard System Table
npx wrangler d1 execute stroom-production-db --remote --file=./migrations/0003_bridge_nonces.sql
```

### Step 6.4: Verify Remote Schema
```bash
# [REMOTE ACTION: Requires Approval]
npx wrangler d1 execute stroom-production-db --remote --command="SELECT COUNT(*) AS total_tables FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%';"
```
Expected result: **43** (42 application tables + 1 `_internal_bridge_nonces` table).

---

## 7. Cloudflare R2 Media Storage Provisioning & Credential Separation

### Step 7.1: Create Production R2 Bucket
```bash
# [REMOTE ACTION: Requires Approval]
npx wrangler r2 bucket create stroom-media-production
```

### Step 7.2: Dedicated Credential Separation Architecture
Implemented in [`src/worker/routes/media.ts`](file:///d:/ST/src/worker/routes/media.ts):
1. **Public User Media Upload (`POST /api/media/upload`):**
   - Strictly requires verified user Bearer JWT (`Authorization: Bearer <jwt>`) verified via Web Crypto HMAC-SHA256 using `JWT_SECRET`.
   - `INTERNAL_D1_BRIDGE_SECRET`, `INTERNAL_MEDIA_SECRET`, and `ORIGIN_PROXY_SECRET` are **strictly rejected with 401** if passed to this public user route.
2. **Dedicated Internal Service Media Route (`POST /api/internal/media/upload`):**
   - Completely isolated behind dedicated internal media credential (`X-STROOM-Media-Secret`).
   - `INTERNAL_D1_BRIDGE_SECRET` is **strictly rejected with 401** (prevents credential reuse).
   - Browser / user JWTs are strictly rejected with 401.
   - Does not expose secrets in logs or error bodies.
3. **Magic-Byte File Signature Validation:**
   - Evaluates raw byte headers to prevent MIME spoofing:
     - JPEG: `FF D8 FF`
     - PNG: `89 50 4E 47 0D 0A 1A 0A`
     - GIF: `GIF87a` (`47 49 46 38 37 61`) or `GIF89a` (`47 49 46 38 39 61`)
     - WebP: `RIFF` (`52 49 46 46`) and offset 8 `WEBP` (`57 45 42 50`)
   - SVG (`image/svg+xml`) and HTML (`text/html`) are strictly prohibited (415).
4. **Public vs Private Object Access Policy (`GET /api/media/:key`):**
   - Public objects (`pub_*`): Cached with `public, max-age=31536000, immutable`, `nosniff`, and sandbox CSP.
   - Private objects (`priv_*`): Requires verified user Bearer JWT. Requester must match `ownerId` or have `admin`/`super_admin` role (`403 Forbidden` otherwise). Service credentials are rejected with 401.

---

## 8. Production Secret Generation & Injection

Generate high-entropy, 256-bit canonical Base64URL secrets (exactly 43 characters):

```bash
# Generate primary D1 bridge secret (Express -> Worker)
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"

# Generate primary origin proxy secret (Worker -> Express)
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"

# Generate dedicated internal media secret (Express -> Worker R2)
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"

# Generate production JWT secret (minimum 32 bytes)
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

### Step 8.1: Inject Worker Secrets via Wrangler
```bash
# [REMOTE ACTION: Requires Approval]
npx wrangler secret put INTERNAL_D1_BRIDGE_SECRET
npx wrangler secret put ORIGIN_PROXY_SECRET
npx wrangler secret put INTERNAL_MEDIA_SECRET
npx wrangler secret put JWT_SECRET
npx wrangler secret put ORIGIN_URL
```

### Step 8.2: Configure Express Origin `.env`
On the Express server hosting container, populate the production `.env`:
```ini
NODE_ENV=production
PORT=5000
JWT_SECRET=<PRODUCTION_JWT_SECRET_43_CHARS>
DB_PATH=/var/data/stroom.db

# Trust Path A (Express -> Worker -> D1)
ENABLE_D1_AUTH_BRIDGE=true
INTERNAL_D1_BRIDGE_SECRET=<SAME_BRIDGE_SECRET_AS_WORKER>
D1_BRIDGE_URL=https://api.stroom.in

# Dedicated Internal Media Credential (Express -> Worker R2)
INTERNAL_MEDIA_SECRET=<SAME_MEDIA_SECRET_AS_WORKER>

# Trust Path B (Worker -> Express)
REQUIRE_ORIGIN_PROXY_AUTH=true
ORIGIN_PROXY_SECRET=<SAME_ORIGIN_SECRET_AS_WORKER>

# CORS
CORS_ORIGIN=https://stroom.in,https://www.stroom.in,https://stroom.pages.dev
```

---

## 9. Deployment Execution

### Step 9.1: Build and Deploy Frontend to Cloudflare Pages
```bash
# 1. Build production Vite bundle
npm run build:client

# 2. Deploy to Cloudflare Pages [REMOTE ACTION: Requires Approval]
npx wrangler pages deploy dist --project-name=stroom-web --branch=main
```

### Step 9.2: Deploy Cloudflare Worker API
```bash
# [REMOTE ACTION: Requires Approval]
npx wrangler deploy
```

### Step 9.3: Start Origin Express Server
```bash
# On origin host container
npm run build:server
node dist/server/index.js
```

---

## 10. Complete Production Readiness Verification Matrix

Each production readiness capability has been categorized according to verification status:
- **`[PASS]`**: Verified with complete local test evidence.
- **`[FAIL]`**: Unresolved blocker (e.g. `npm audit` code 1 due to 9 upstream/dev advisories).
- **`[NOT VERIFIED]`**: Requires remote Cloudflare credentials/infrastructure or production container environment.

```
+-----------------------------------------------------------------------------------------------------------------+
|                                 PRODUCTION READINESS CAPABILITY VERIFICATION MATRIX                             |
+-----------------------------------------------------------------------------------------------------------------+
| Domain                | Check / Capability                                           | Status        | Evidence |
+-----------------------+--------------------------------------------------------------+---------------+----------+
| Runtime Environment   | Pinned Node.js 24.22.3 declaration (.node-version)           | [PASS]        | Local    |
| Runtime Environment   | Engines declared: >=24.0.0 <25.0.0 in package.json           | [PASS]        | Local    |
| Runtime Execution     | Test execution under Node 24.22.3 (Host: Node 18.18.2)       | [NOT VERIFIED]| Node 18  |
| Client Build          | Vite production build (npm run build:client)                 | [PASS]        | Code 0   |
| Server Build          | TypeScript server compilation (npm run build:server)         | [PASS]        | Code 0   |
| Worker Build          | Worker Isolate typecheck (npm run build:worker)              | [PASS]        | Code 0   |
| Security Headers      | public/_headers CSP (no unsafe-inline scripts, connect 'self')| [PASS]       | Audited  |
| Security Headers      | HSTS max-age=31536000 (preload omitted from default config)  | [PASS]        | Audited  |
| SPA Routing           | public/_redirects 200 rewrite fallback for deep links        | [PASS]        | Verified |
| R2 User Uploads       | Requires verified user JWT; rejects bridge & media secrets   | [PASS]        | Tested   |
| R2 Service Uploads    | Isolated route POST /api/internal/media/upload (Media Secret)| [PASS]        | Tested   |
| Credential Separation | Rejects D1 bridge secret cross-substitution on media route   | [PASS]        | Tested   |
| R2 File Storage       | Magic-byte file signature validation (JPEG, PNG, GIF, WebP)  | [PASS]        | Tested   |
| R2 File Storage       | SVG / HTML stored script injection rejection                 | [PASS]        | Tested   |
| R2 File Storage       | 5MB payload limit enforcement (413 Payload Too Large)        | [PASS]        | Tested   |
| R2 File Storage       | Public vs private object access authorization (Owner/Admin)  | [PASS]        | Tested   |
| R2 File Storage       | Key directory traversal protection (regex sanitization)      | [PASS]        | Tested   |
| D1 Database Schema    | 42/42 application tables 100% match SQLite data/stroom.db    | [PASS]        | Introspect|
| D1 System Tables      | _internal_bridge_nonces replay guard table integration       | [PASS]        | Tested   |
| D1 Migrations         | Repeatable execution of 0001, 0002, 0003 migrations          | [PASS]        | Miniflare|
| Hybrid Auth Bridge    | Flow A: Express -> Worker -> D1 bridge RPC (6 operations)    | [PASS]        | 35 Tests |
| Origin Proxy Guard    | Flow B: Worker -> Express origin proxy authentication        | [PASS]        | Tested   |
| Replay Protection     | Atomic D1 batch nonce consumption (409 Conflict on replay)   | [PASS]        | Tested   |
| Secret Rotation       | 72-hour overlap rotation support with canonical Base64URL    | [PASS]        | Tested   |
| Application E2E Tests | 78 existing unit and integration tests across 15 suites      | [PASS]        | 78 PASS  |
| Database Safety       | Primary data/stroom.db and backup DB 100% hash preservation  | [PASS]        | SHA-256  |
| Dependency Audit      | npm audit clean exit code 0                                  | [FAIL]        | Code 1   |
| Dependency Audit      | package.json & package-lock.json dependency tree consistency | [PASS]        | npm ls 0 |
| Production API Host   | api.stroom.in DNS & Edge routing verified                     | [NOT VERIFIED]| Remote CF|
| Remote D1 Creation    | wrangler d1 create stroom-production-db                      | [NOT VERIFIED]| Remote CF|
| Remote R2 Creation    | wrangler r2 bucket create stroom-media-production            | [NOT VERIFIED]| Remote CF|
| Remote Secret Storage | wrangler secret put <NAME>                                   | [NOT VERIFIED]| Remote CF|
| Remote Pages Deploy   | wrangler pages deploy dist --project-name=stroom-web         | [NOT VERIFIED]| Remote CF|
| Remote Worker Deploy  | wrangler deploy                                              | [NOT VERIFIED]| Remote CF|
| Cloudflare Tunnel     | cloudflared ingress to Express origin server                 | [NOT VERIFIED]| Remote CF|
| DNS Configuration     | CNAME and apex domain routing in Cloudflare dashboard        | [NOT VERIFIED]| Remote CF|
+-----------------------------------------------------------------------------------------------------------------+
```
