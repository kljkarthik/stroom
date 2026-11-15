# STROOM — Phase 1: Cloudflare Infrastructure & D1 Schema Preparation

**Target Architecture:** Cloudflare Pages (Frontend SPA) + Cloudflare Workers (Hono API) + Cloudflare D1 (Database) + Cloudflare R2 (Media Storage)  
**Verification Status:** Verified against Official Cloudflare Limits & Schemas  
**Database Safety:** `data/stroom.db` & Backup Intact (42 Tables • 10,163 Records • 0 Corruptions)

---

## 1. Cloudflare Free vs. Paid Quotas & Limits

> [!IMPORTANT]
> **Free Tier Specification Correction:**  
> The Cloudflare D1 Free plan provides **500 MB per database** (up to 10 databases / 5 GB total account storage), **NOT** 10 GB per database. The 10 GB per database limit applies only to the Cloudflare Workers Paid plan ($5/month).

### Comprehensive Free vs. Paid Tier Comparison

| Service | Metric | Free Tier Allowance | Paid Tier ($5/mo Base) | STROOM Launch Impact |
| :--- | :--- | :--- | :--- | :--- |
| **Cloudflare Workers** | Daily Requests | **100,000 requests / day** | 10,000,000 / mo included | Generous for launch (est. 5k–15k/day) |
| | CPU Runtime | **10 ms CPU time / request** | 50 ms (or 30s with Unbound) | API endpoints average 2–4ms |
| **Cloudflare D1** | Storage Per Database | **500 MB per database** | Up to 10 GB per database | STROOM schema + 50k users ≈ 45 MB |
| | Total Account Storage | **5 GB total storage** | 50 GB included | Ample for multi-environment DBs |
| | Database Count Cap | **Max 10 databases** | Max 50,000 databases | Allows dev, staging, prod DBs |
| | Daily Rows Read | **5,000,000 rows read / day** | 25,000,000,000 / mo | Easily supports beta queries |
| | Daily Rows Written | **100,000 rows written / day** | 50,000,000 / mo | Fits event booking & check-ins |
| | Queries Per Invocation | **50 queries / Worker request** | Unlimited | Requires batching N+1 queries |
| | Max Row Size | **2 MB** | 2 MB | All text & JSON columns fit safely |
| **Cloudflare R2** | Storage Volume | **10 GB-month** | $0.015 / GB-month | Zero egress fees |
| | Class A Ops (Write) | **1,000,000 operations / month** | $4.50 / million | Direct client presigned PUTs |
| | Class B Ops (Read) | **10,000,000 operations / month** | $0.36 / million | Cached via Cloudflare CDN |
| **Cloudflare Pages** | Monthly Builds | **500 builds / month** | 5,000 builds / month | CI/CD deployments |
| | Total Files Per Site | **20,000 files / site** | 20,000 files / site | Vite build outputs ~25 files |
| | Bandwidth & Requests | **Unlimited** | Unlimited | Zero bandwidth surprise bills |

---

## 2. Infrastructure Configuration Prepared

### A. Wrangler Configuration (`wrangler.jsonc`)
A production-ready [wrangler.jsonc](file:///d:/ST/wrangler.jsonc) file has been configured adhering to Cloudflare's latest standard schema:
* **Entry Point:** `src/worker/index.ts`
* **Compatibility Date:** `2024-11-01`
* **Compatibility Flags:** `["nodejs_compat"]`
* **Database Bindings:**
  * Production: `stroom-production-db` (bound to `DB`)
  * Development: `stroom-dev-db` (under `env.dev`)
  * Safe Placeholder IDs: Non-UUID placeholder values ensure accidental deployments to uncreated production databases fail fast.
* **Storage Bindings:**
  * Production: `stroom-media-production` (bound to `MEDIA_BUCKET`)
  * Development Preview: `stroom-media-dev`

### B. Cloudflare Pages SPA Routing (`public/_redirects`)
Created [public/_redirects](file:///d:/ST/public/_redirects) so Cloudflare Pages resolves all SPA client routes (e.g., `/events/:id`, `/passport`, `/admin`) to `/index.html` with HTTP 200:
```
/*    /index.html   200
```

---

## 3. D1 Schema Migration Strategy

The migration files are sequentially ordered and isolated:

### 1. `migrations/0001_initial_schema.sql` (Pure Relational DDL)
* **Scope:** All **42 tables** and **33 explicit secondary indexes**.
* **Zero Data:** Contains **0 `INSERT` statements** (no demo users, sample events, or test bookings).
* **Topological Foreign-Key Order:**
  `achievements_master` -> `users` -> `activity_logs` -> `admin_announcements` -> `partner_accounts` -> `cities` -> `venues` -> `events` -> `auction_rooms` -> `auction_teams` -> `auction_players` -> `auction_registrations` -> `audit_logs` -> `bids` -> `partner_collaborations` -> `collaboration_comments` -> `communities` -> `community_members` -> `community_posts` -> `contact_inquiries` -> `coupons` -> `coupon_redemptions` -> `discovery_items` -> `event_registrations` -> `notifications` -> `quizzes` -> `quiz_versions` -> `questions` -> `options` -> `partner_audit_logs` -> `partner_communications` -> `partner_proposals` -> `partner_users` -> `passport_stamps` -> `payment_transactions` -> `platform_settings` -> `quiz_sessions` -> `responses` -> `response_options` -> `user_achievements` -> `user_preferences` -> `venue_availability`.
* **Repeatable:** Every statement uses `CREATE TABLE IF NOT EXISTS` and `CREATE INDEX IF NOT EXISTS`.

### 2. `migrations/0002_essential_metadata.sql` (System Constants Only)
* **Scope:** Essential non-secret operational reference tables:
  * 4 Regional Hubs (`city_hyd`, `city_pune` active; `city_blr`, `city_mum` planned).
  * 7 Master Achievements (`pioneer_member`, `vibe_matcher`, `first_bid`, `cricket_enthusiast`, `door_checked_in`, `community_builder`, `coffee_explorer`).
  * 6 System Platform Settings (`general`, `events`, `auctions`, `security`, `partners`, `notifications`).
* **Zero Sample Records:** Contains 0 users, 0 venues, 0 events, 0 bids, 0 bookings, 0 partner accounts.

---

## 4. Local D1 Simulation & Validation Results

* **Execution Status:** Validated via isolated SQLite D1 dialect simulator with strict foreign keys enabled (`PRAGMA foreign_keys = ON;`).
* **Table Count:** Exactly 42 tables created.
* **Index Count:** Exactly 33 explicit secondary indexes created.
* **Integrity:** `[{"integrity_check": "ok"}]`.
* **Foreign Keys:** `0 violations`.
* **Populated Tables:** 3 tables with documented configuration (`achievements_master`: 7, `cities`: 4, `platform_settings`: 6).
* **Empty Tables:** Exactly 39 tables start completely empty with 0 rows.

---

## 5. R2 Media Storage Architecture Plan

* **Catalog Schema (Planned for Phase 2):** Dedicated `media_assets` table tracking `id`, `owner_user_id`, `entity_type`, `entity_id`, `r2_key`, `public_url`, `mime_type`, `file_size_bytes`.
* **Direct Client Presigned Uploads:** Presigned PUT URLs generated by Worker allow browser clients to stream image binaries directly to Cloudflare R2, bypassing Worker CPU/memory constraints.

---

## 6. Build & Regression Verification

* **Frontend Build Check (`npm run build:client`):** 100% Passed.
* **Backend Build Check (`npm run build:server`):** 100% Passed.
* **Original Database:** `D:\ST\data\stroom.db` intact (42 tables, 10,163 records, 0 corruptions).
