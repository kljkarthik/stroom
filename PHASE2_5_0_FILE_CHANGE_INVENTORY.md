# STROOM — Phase 2.5.0: File Change Inventory & Implementation Catalog

**Project:** `D:\ST`  
**Branch:** `feature/stroom-production-launch`  
**Approved Baseline Commit:** `19c4176`  
**Document Version:** 1.0.0 (Authoritative File Change Inventory)  
**Security Classification:** Implementation Plan  
**Mode:** STRICT PLANNING ONLY (Zero code, schema, data, or infrastructure modifications)

---

## 1. Inventory Summary

This catalog specifies every file to be created, modified, or preserved during the Phase 2.5 serverless migration of STROOM. Every planned file change is documented with:
- Exact file path.
- Architectural purpose.
- Existing behavior.
- Proposed behavior.
- Dependencies.
- Tests required.
- Rollback method.

The catalog is divided into three distinct sections:
1. **Part A: New Files (22 files)** — New Worker routers, middleware, services, migrations, and test scripts.
2. **Part B: Modified Files (7 files)** — Minimal, surgical updates to existing Express and Worker scaffolds.
3. **Part C: Unchanged & Protected Files** — Explicitly protected baseline artifacts that must not be altered.

---

## 2. Part A: New Files to be Created

### 2.1 Worker Middleware & Services

#### 1. `src/worker/middleware/auth.ts`
- **Purpose:** Cloudflare Worker JWT authentication middleware validating tokens at the edge.
- **Existing Behavior:** None (file does not exist; existing auth handled in `server/middleware/auth.ts`).
- **Proposed Behavior:**
  - Extracts Bearer token from `Authorization` header.
  - Verifies token signature using Web Crypto API (`HS256`).
  - Enforces standard claims: `iss === 'stroom-api'`, `aud === 'stroom-client'`, expiration with $\le 60\text{s}$ clock skew.
  - Checks in-isolate user cache (`revocationCache.ts`) for revocation status.
  - Attaches authenticated user payload (`c.set('user', user)`) to context.
  - Supports optional authentication: missing token proceeds as guest; invalid/expired token returns `401 Unauthorized`.
- **Dependencies:** Hono context, `src/worker/services/tokenService.ts`, `src/worker/services/revocationCache.ts`.
- **Tests Required:** Unit tests for valid token, expired token, clock skew tolerance, malformed token, revoked token, missing header.
- **Rollback Method:** Delete file; revert `src/worker/app.ts` imports.

#### 2. `src/worker/middleware/rbac.ts`
- **Purpose:** Enforces Role-Based Access Control (RBAC) across all 11 system roles at the edge.
- **Existing Behavior:** None (handled in `server/services/rbacService.ts`).
- **Proposed Behavior:**
  - High-order middleware function `requireRole(allowedRoles: string[])`.
  - Verifies that `c.get('user').role` belongs to the allowed list.
  - For partner and venue roles, validates multi-tenant resource ownership (`partnerId`, `venueId`).
  - Returns `403 Forbidden` with standardized error JSON on authorization failure.
- **Dependencies:** Hono context, `src/worker/types/index.ts`.
- **Tests Required:** RBAC matrix test covering all 11 roles against admin, partner, and member endpoints.
- **Rollback Method:** Delete file; remove middleware references.

#### 3. `src/worker/middleware/rateLimit.ts`
- **Purpose:** Edge rate-limiting middleware to protect endpoints from abuse within Cloudflare free-tier quotas.
- **Existing Behavior:** Express in-memory rate limiting.
- **Proposed Behavior:**
  - Tracks request counts per IP (`CF-Connecting-IP`) and per authenticated `userId`.
  - Enforces window thresholds: 60 requests/minute for public endpoints; 10 requests/minute for auth endpoints; 1 request/2 seconds for live auction polling.
  - Emits `429 Too Many Requests` with `Retry-After` header.
- **Dependencies:** Hono context.
- **Tests Required:** Concurrency bursts, IP rate-limit triggering, header inspection.
- **Rollback Method:** Delete file; remove middleware from router pipeline.

#### 4. `src/worker/services/revocationCache.ts`
- **Purpose:** In-isolate memory cache for user authorization and revocation state.
- **Existing Behavior:** None.
- **Proposed Behavior:**
  - LRU memory cache storing user account status, role, and `lastRevokedAt` timestamp.
  - Implements $30\text{-second}$ normal TTL.
  - On cache miss, queries D1 primary with `withSession("first-primary")`.
  - Implements emergency degraded mode: allows $60\text{s}$ emergency grace for member read-only routes during D1 outage; strictly fails closed ($0\text{s}$ grace, `503`) for administrative and write routes.
- **Dependencies:** `src/worker/db/d1Client.ts`.
- **Tests Required:** TTL expiry tests, LRU eviction tests, fail-closed simulation during D1 downtime.
- **Rollback Method:** Delete file.

#### 5. `src/worker/services/tokenService.ts`
- **Purpose:** Cryptographic Web Crypto API wrapper for HMAC-SHA256 JWT validation and signature verification.
- **Existing Behavior:** Node.js `jsonwebtoken` package.
- **Proposed Behavior:**
  - Pure edge-compatible JWT decoder and validator without Node.js `crypto` or `jsonwebtoken` dependencies.
  - Validates base64url encoding, header algorithm (`HS256` only), and cryptographic signature.
  - Performs constant-time signature comparison using `crypto.subtle.verify`.
- **Dependencies:** Web Crypto API (global standard).
- **Tests Required:** Valid signature verification, tampered payload rejection, algorithm confusion rejection (e.g. `none` or `RS256`).
- **Rollback Method:** Delete file.

---

### 2.2 Worker API Routers

#### 6. `src/worker/routes/authProxy.ts`
- **Purpose:** Edge reverse proxy forwarding authentication requests to Express origin.
- **Existing Behavior:** None in Worker; Express serves auth directly.
- **Proposed Behavior:**
  - Intercepts `POST /api/auth/login`, `/register`, `/change-password`, `/reset-demo`.
  - Injects `X-STROOM-Origin-Secret` header for mutual origin authentication.
  - Forwards client IP via `X-Forwarded-For` and `CF-Connecting-IP`.
  - Bounded timeout: $5,000\text{ ms}$; returns `502 Bad Gateway` or `504 Gateway Timeout` on origin failure.
- **Dependencies:** Hono, `fetch`.
- **Tests Required:** Origin forwarding test, secret injection test, origin down failover test.
- **Rollback Method:** Delete file; route traffic directly to origin DNS.

#### 7. `src/worker/routes/internalBridge.ts`
- **Purpose:** Worker endpoint handling Express-to-D1 internal database operations.
- **Existing Behavior:** None.
- **Proposed Behavior:**
  - Exposes `POST /api/internal/d1/dispatch`.
  - Authenticates request using `INTERNAL_D1_BRIDGE_SECRET` in `X-STROOM-Bridge-Secret`.
  - Enforces anti-replay nonce consumption via D1 primary table `_internal_bridge_nonces`.
  - Verifies HMAC-SHA256 signature across timestamp, nonce, action, and payload hash.
  - Executes strictly one of 6 named, parameterized operations:
    1. `getUserForLogin`
    2. `createUser`
    3. `updatePasswordHash`
    4. `changePassword`
    5. `changeAccountStatus`
    6. `updateUserRole`
  - Zero arbitrary SQL permitted; parameters strictly validated using Zod schemas.
- **Dependencies:** Hono, `src/worker/db/d1Client.ts`, `zod`.
- **Tests Required:** Replay attack rejection, tampered payload rejection, secret mismatch rejection, 6-operation unit tests.
- **Rollback Method:** Delete file.

#### 8. `src/worker/routes/events.ts`
- **Purpose:** Edge router for public and member event catalog endpoints (Endpoints #75–#83).
- **Existing Behavior:** Served by Express `server/routes/events.ts`.
- **Proposed Behavior:**
  - Serves `GET /api/events`, `GET /api/events/:id`, `GET /api/events/featured`, `GET /api/events/cities`, etc.
  - Queries Cloudflare D1 with parameterized SQL.
  - Supports optional authentication (attaches registration state if user is logged in).
- **Dependencies:** Hono, `src/worker/db/d1Client.ts`, `auth.ts`.
- **Tests Required:** Event list parity test against Express, single event details test, optional auth test.
- **Rollback Method:** Delete file; fall back to Express route.

#### 9. `src/worker/routes/contact.ts`
- **Purpose:** Edge router for public contact, feedback, and FAQ endpoints.
- **Existing Behavior:** Served by Express `server/routes/contact.ts`.
- **Proposed Behavior:**
  - Serves `GET /api/contact/faqs` and `POST /api/contact/feedback`.
  - Directly queries D1 for FAQ catalog; inserts feedback records.
- **Dependencies:** Hono, `src/worker/db/d1Client.ts`.
- **Tests Required:** FAQ list query test, feedback insertion test.
- **Rollback Method:** Delete file.

#### 10. `src/worker/routes/onboarding.ts`
- **Purpose:** Edge router for public onboarding quiz and vibe matching.
- **Existing Behavior:** Served by Express `server/routes/onboarding.ts`.
- **Proposed Behavior:**
  - Serves `GET /api/onboarding/quiz` (published version) and `POST /api/onboarding/match`.
  - Cached reads from D1 for published quiz structure.
- **Dependencies:** Hono, `src/worker/db/d1Client.ts`.
- **Tests Required:** Published quiz structure parity test.
- **Rollback Method:** Delete file.

#### 11. `src/worker/routes/users.ts`
- **Purpose:** Edge router for user profile, preferences, notifications, and passport (Endpoints #143–#152, #156).
- **Existing Behavior:** Served by Express `server/routes/preferences.ts`, `passport.ts`, `users.ts`.
- **Proposed Behavior:**
  - Serves `GET/PUT /api/users/me/preferences`, `GET/PUT /api/users/me/profile`, `GET /api/users/me/passport`, `GET /api/users/me/notifications`.
  - Enforces `requireRole(['member', ...])`.
  - Reads and updates D1 user preference and profile tables.
- **Dependencies:** Hono, `src/worker/db/d1Client.ts`, `auth.ts`, `rbac.ts`.
- **Tests Required:** Preference update test, profile update test, passport retrieval test.
- **Rollback Method:** Delete file.

#### 12. `src/worker/routes/communities.ts`
- **Purpose:** Edge router for communities, clubs, and member directories (Endpoints #84–#91).
- **Existing Behavior:** Served by Express `server/routes/communities.ts`.
- **Proposed Behavior:**
  - Serves `GET /api/communities`, `GET /api/communities/:id`, `POST /api/communities/:id/join`.
  - Reads community metadata and membership records from D1.
- **Dependencies:** Hono, `src/worker/db/d1Client.ts`, `auth.ts`.
- **Tests Required:** Community listing test, join community transaction test.
- **Rollback Method:** Delete file.

#### 13. `src/worker/routes/sports.ts`
- **Purpose:** Edge router for sports, facilities, court reservations, and match play (Endpoints #92–#98).
- **Existing Behavior:** Served by Express `server/routes/sports.ts`.
- **Proposed Behavior:**
  - Serves sports catalog, court availability queries, and slot bookings.
  - Parameterized D1 queries for real-time court availability.
- **Dependencies:** Hono, `src/worker/db/d1Client.ts`, `auth.ts`.
- **Tests Required:** Court availability search test, slot booking transaction test.
- **Rollback Method:** Delete file.

#### 14. `src/worker/routes/passes.ts`
- **Purpose:** Edge router for digital event passes, QR verification, and check-in (Endpoints #139–#142).
- **Existing Behavior:** Served by Express `server/routes/passes.ts`.
- **Proposed Behavior:**
  - Serves `GET /api/passes/my-passes`, `GET /api/passes/verify/:token`, `POST /api/passes/check-in`.
  - Validates pass tokens and updates attendance state in D1.
- **Dependencies:** Hono, `src/worker/db/d1Client.ts`, `auth.ts`, `rbac.ts`.
- **Tests Required:** Pass verification test, check-in idempotency test.
- **Rollback Method:** Delete file.

#### 15. `src/worker/routes/auctions.ts`
- **Purpose:** Edge router for live sports auctions, player lots, and bidding engine (Endpoints #99–#110).
- **Existing Behavior:** Served by Express `server/routes/auction.ts`.
- **Proposed Behavior:**
  - Serves auction overview, active player lots, and bid submissions.
  - Implements Cloudflare Cache API for 2-second polling with instant cache purge on bid submission.
  - Atomic D1 transaction for bid placement (`INSERT INTO auction_bids`, `UPDATE auction_players`).
- **Dependencies:** Hono, `src/worker/db/d1Client.ts`, `auth.ts`, `rbac.ts`.
- **Tests Required:** Bid placement transaction test, outbid rejection test, cache invalidation test.
- **Rollback Method:** Delete file.

#### 16. `src/worker/routes/partners.ts`
- **Purpose:** Edge router for partner portal, venues, deals, and coupon redemptions (Endpoints #111–#138).
- **Existing Behavior:** Served by Express `server/routes/partners.ts`.
- **Proposed Behavior:**
  - Serves partner dashboard, venue configurations, and coupon verification (`POST /api/partners/coupons/verify`) and redemption (`POST /api/partners/coupons/redeem`).
  - Multi-tenant data isolation by `partnerId`.
- **Dependencies:** Hono, `src/worker/db/d1Client.ts`, `auth.ts`, `rbac.ts`.
- **Tests Required:** Multi-tenant access boundary test, coupon redemption atomic check test.
- **Rollback Method:** Delete file.

#### 17. `src/worker/routes/admin.ts`
- **Purpose:** Edge router for admin CMS, quiz editor, role assignments, and audit logs (Endpoints #2–#74, #153–#155).
- **Existing Behavior:** Served by Express `server/routes/admin.ts`.
- **Proposed Behavior:**
  - Serves quiz question reordering, event duplication, member role modifications, and system analytics.
  - Strictly requires `requireRole(['admin', 'staff'])`.
  - Implements immediate fail-closed ($0\text{s}$ grace) if D1 primary is unreachable.
- **Dependencies:** Hono, `src/worker/db/d1Client.ts`, `auth.ts`, `rbac.ts`.
- **Tests Required:** Full admin permission enforcement test, member role change audit log test.
- **Rollback Method:** Delete file.

---

### 2.3 Database Migrations & Tooling Scripts

#### 18. `migrations/0003_internal_bridge_nonces.sql`
- **Purpose:** D1 schema migration adding the distributed anti-replay nonce tracking table.
- **Existing Behavior:** None.
- **Proposed Behavior:**
  ```sql
  CREATE TABLE IF NOT EXISTS _internal_bridge_nonces (
    nonce TEXT PRIMARY KEY,
    request_hash TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_bridge_nonces_expires ON _internal_bridge_nonces(expires_at);
  ```
- **Dependencies:** Cloudflare D1 / Wrangler migrations engine.
- **Tests Required:** Migration execution test in local Miniflare D1.
- **Rollback Method:** Drop table via rollback migration.

#### 19. `migrations/0004_d1_data_seed.sql`
- **Purpose:** Baseline migration script providing empty reference fixtures for D1 environments.
- **Existing Behavior:** None.
- **Proposed Behavior:** Defines standard initial configuration keys and metadata constants for D1.
- **Dependencies:** D1 engine.
- **Tests Required:** Execution test in clean D1 database.
- **Rollback Method:** Revert migration.

#### 20. `scripts/migrate-sqlite-to-d1.ts`
- **Purpose:** Standalone migration utility copying all 10,163 records across 42 tables from SQLite into D1.
- **Existing Behavior:** None.
- **Proposed Behavior:**
  - Reads SQLite database in read-only mode using `better-sqlite3`.
  - Traverses tables in strict foreign-key dependency order (Level 0 to Level 3).
  - Formats batched parameterized `INSERT OR IGNORE` statements (up to 50 per D1 batch).
  - Preserves exact primary keys, UUIDs, and foreign key references.
  - Outputs verification summary comparing source row counts vs target row counts.
- **Dependencies:** `better-sqlite3`, `wrangler` CLI or D1 HTTP API.
- **Tests Required:** Dry-run test against disposable SQLite and local Miniflare D1.
- **Rollback Method:** Reset local D1 state via `wrangler d1 execute DB --local --command "..."`.

#### 21. `scripts/verify-d1-parity.ts`
- **Purpose:** Independent forensic auditor comparing record-level parity between SQLite and D1.
- **Existing Behavior:** Ad-hoc scratch scripts.
- **Proposed Behavior:**
  - Iterates through all 42 application tables.
  - Compares row counts, column lists, and row hashes.
  - Reports exact record-level parity percentage ($\ge 99.99\%$).
  - Confirms the single known `auction_players.ply_past_001.sold_at` discrepancy without modifying data.
- **Dependencies:** `better-sqlite3`, D1 client.
- **Tests Required:** Execution against matched databases.
- **Rollback Method:** Delete file.

#### 22. `scripts/test-d1-bridge.ts`
- **Purpose:** Automated integration and security test suite for the Express-to-D1 internal bridge.
- **Existing Behavior:** None.
- **Proposed Behavior:**
  - Executes test vectors for all 6 named bridge operations.
  - Simulates replay attacks by re-sending identical nonces (verifies `409 Conflict`).
  - Simulates tampering by mutating payloads (verifies HMAC rejection).
  - Simulates invalid/arbitrary SQL injection attempts (verifies strict rejection).
- **Dependencies:** Node.js `tsx`, `crypto`.
- **Tests Required:** Self-testing script.
- **Rollback Method:** Delete file.

---

## 3. Part B: Modifications to Existing Files

#### 1. `src/worker/app.ts`
- **Purpose:** Central Hono application assembly and routing pipeline.
- **Existing Behavior:** Mounts only `healthRouter` and CORS/secure headers.
- **Proposed Behavior:**
  - Mounts all 10 new API routers: `authProxy`, `internalBridge`, `events`, `contact`, `onboarding`, `users`, `communities`, `sports`, `passes`, `auctions`, `partners`, `admin`.
  - Configures global error handling, 404 responses, and request timing headers.
- **Dependencies:** Hono, all router modules.
- **Tests Required:** Worker compilation and route dispatch unit tests.
- **Rollback Method:** Revert file to Git commit `19c4176`.

#### 2. `src/worker/types/env.ts`
- **Purpose:** TypeScript interface definition for Cloudflare Worker environment bindings and secrets.
- **Existing Behavior:** Defines `DB`, `MEDIA_BUCKET`, `NODE_ENV`, `JWT_SECRET`, etc.
- **Proposed Behavior:**
  - Adds `INTERNAL_D1_BRIDGE_SECRET: string`.
  - Adds `ORIGIN_PROXY_SECRET: string`.
  - Adds `EXPRESS_ORIGIN_URL: string`.
- **Dependencies:** `@cloudflare/workers-types`.
- **Tests Required:** `npm run typecheck:worker`.
- **Rollback Method:** Revert file to Git commit `19c4176`.

#### 3. `server/routes/auth.ts`
- **Purpose:** Express authentication routes (`/api/auth/login`, `/register`, `/change-password`, `/reset-demo`).
- **Existing Behavior:** Directly queries local SQLite database `stroom.db`.
- **Proposed Behavior:**
  - Verifies incoming requests have valid `X-STROOM-Origin-Secret`.
  - Performs local password verification (scrypt / SHA-256).
  - Reads and writes user records by dispatching to the Worker D1 bridge (`/api/internal/d1/dispatch`) via the bridge client.
  - Issues JWTs with required `iss: 'stroom-api'` and `aud: 'stroom-client'` claims.
- **Dependencies:** `server/services/d1BridgeClient.ts`, `server/config/env.ts`.
- **Tests Required:** Express login test, registration test, hash upgrade test, legacy SHA-256 test.
- **Rollback Method:** Revert file to Git commit `19c4176`.

#### 4. `server/middleware/auth.ts`
- **Purpose:** Express JWT creation and verification middleware.
- **Existing Behavior:** Generates tokens with only `id` and `role`; verifies without issuer/audience checks.
- **Proposed Behavior:**
  - Updates `generateToken(user)` to inject `iss: 'stroom-api'` and `aud: 'stroom-client'`.
  - Updates verification to accept both legacy tokens (during 7-day migration grace) and new standard tokens.
- **Dependencies:** `jsonwebtoken`, `server/config/env.ts`.
- **Tests Required:** Token generation and verification unit tests.
- **Rollback Method:** Revert file to Git commit `19c4176`.

#### 5. `server/config/env.ts`
- **Purpose:** Centralized environment configuration loader and validator.
- **Existing Behavior:** Validates `PORT`, `JWT_SECRET`, `NODE_ENV`, `DB_PATH`.
- **Proposed Behavior:**
  - Adds validation for `INTERNAL_D1_BRIDGE_SECRET` (minimum 32 characters).
  - Adds validation for `ORIGIN_PROXY_SECRET` (minimum 32 characters).
  - Adds validation for `D1_BRIDGE_URL` (URL of Worker dispatch endpoint).
- **Dependencies:** `dotenv`.
- **Tests Required:** Configuration validation tests.
- **Rollback Method:** Revert file to Git commit `19c4176`.

#### 6. `wrangler.jsonc`
- **Purpose:** Cloudflare Wrangler deployment and local Miniflare configuration.
- **Existing Behavior:** Configures `stroom-worker`, local D1 database binding `DB`, and basic env vars.
- **Proposed Behavior:**
  - Declares migration directory `migrations/`.
  - Configures binding for `_internal_bridge_nonces` and future R2 bucket.
  - Adds environment variables for local testing (`D1_BRIDGE_ENABLED: "true"`).
- **Dependencies:** Wrangler CLI.
- **Tests Required:** `wrangler dev` startup test.
- **Rollback Method:** Revert file to Git commit `19c4176`.

#### 7. `package.json`
- **Purpose:** Project metadata and npm scripts catalog.
- **Existing Behavior:** Basic build, test, and dev scripts.
- **Proposed Behavior:**
  - Adds `"migrate:d1:local": "wrangler d1 migrations apply DB --local"`.
  - Adds `"migrate:data:d1": "tsx scripts/migrate-sqlite-to-d1.ts"`.
  - Adds `"verify:d1:parity": "tsx scripts/verify-d1-parity.ts"`.
  - Adds `"test:bridge": "tsx scripts/test-d1-bridge.ts"`.
- **Dependencies:** npm / Node.js.
- **Tests Required:** npm script execution tests.
- **Rollback Method:** Revert file to Git commit `19c4176`.

---

## 4. Part C: Unchanged & Explicitly Protected Files

The following files represent the immutable baseline of the application and **MUST NOT** be modified, deleted, or overwritten under any circumstances during Phase 2.5:

1. **`data/stroom.db`:** The authoritative production SQLite database containing all 42 tables, 10,163 records, and 188 registered accounts. Must remain strictly read-only.
2. **`backups/stroom-checkpoint-phase0-2026-11-13T08-10-02-441Z.db`:** The pristine Phase 0 reference backup used for forensic integrity auditing.
3. **`tests/run-all-tests.ts`:** The comprehensive 78-test regression suite. Must execute against disposable databases only.
4. **`src/*` (React Frontend Code):** All React components, Vite configuration, Tailwind styles, and UI state managers remain intact and functional.
5. **`server/routes/*` (Business Routes):** All non-auth Express route files (`events.ts`, `communities.ts`, `sports.ts`, etc.) remain fully functional as the local development reference until Phase 3 cutover.
