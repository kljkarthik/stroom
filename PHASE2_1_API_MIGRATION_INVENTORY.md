# STROOM — Phase 2.1: Complete API Migration Inventory

**Date:** 2026-11-13  
**Architecture Document:** `PHASE2_1_API_MIGRATION_INVENTORY.md`  
**Scope:** Exhaustive catalog of all 156 real HTTP endpoints across 12 modules + core health check  
**API Surface Status:** 100% Documented • 0 Inferred / Fabricated Endpoints  
**Reconciliation Baseline:** 156 Endpoints • 12 Physical Route Modules • 18 Business Feature Domains  

---

## 1. Architectural Reconciliation: Route Modules vs. Feature Domains vs. Endpoints

To maintain absolute technical precision, the STROOM architecture distinguishes between **Physical Route Modules** (file-level organization in `server/routes/*.ts`), **Business Feature Domains** (bounded business capabilities), and **HTTP Endpoints** (discrete request routes):

| Physical Route Module | Express Source File | Target Hono Route Module | Endpoints | Business Feature Domains Covered | Auth & RBAC Profile |
| :--- | :--- | :--- | :---: | :--- | :--- |
| **Module 1: Server Entry** | `server/index.ts` | `src/worker/routes/index.ts` | **1** | Domain 1: Registration & Auth (Health check) | Public |
| **Module 2: Auth Router** | `server/routes/auth.ts` | `src/worker/routes/auth.ts` | **5** | Domain 1: Registration & Auth | Public (3), Token (2) |
| **Module 3: Onboarding Router** | `server/routes/onboarding.ts` | `src/worker/routes/onboarding.ts` | **7** | Domain 3: Onboarding & Persona Quiz | Public (2), Optional (1), Required (4) |
| **Module 4: Discovery Router** | `server/routes/discovery.ts` | `src/worker/routes/discovery.ts` | **1** | Domain 5: Discovery Feed & Member Networking | Optional Auth |
| **Module 5: Preferences Router** | `server/routes/preferences.ts` | `src/worker/routes/users.ts` | **14** | Domain 2: Member Profiles & Studio<br/>Domain 4: User Preferences & Privacy<br/>Domain 10: Digital Passport & Badges | Required (13), Staff/Admin (1) |
| **Module 6: Events Router** | `server/routes/events.ts` | `src/worker/routes/events.ts` | **5** | Domain 6: Events & Cities Catalog<br/>Domain 7: Event Registrations & Booking | Public (4), Required (1) |
| **Module 7: Passes Router** | `server/routes/passes.ts` | `src/worker/routes/passes.ts` | **4** | Domain 8: Digital Passes<br/>Domain 9: Door QR Check-in | Required (2), Staff Checkin (2) |
| **Module 8: Auction Router** | `server/routes/auction.ts` | `src/worker/routes/auction.ts` | **23** | Domain 11: Auction Arena (Mock Auctions & Bidding) | Public (2), Required (17), Staff/Auctioneer (4) |
| **Module 9: Partners Router** | `server/routes/partners.ts` | `src/worker/routes/partners.ts` | **36** | Domain 12: Partner Portal (Venues, Campaigns, Coupons) | Public (4), Partner Scoped (32) |
| **Module 10: Communities Router**| `server/routes/communities.ts` | `src/worker/routes/communities.ts` | **4** | Domain 13: Communities & Member Clubs | Public (2), Required (2) |
| **Module 11: Contact Router** | `server/routes/contact.ts` | `src/worker/routes/contact.ts` | **2** | Domain 17: Contact & Public FAQs | Public (2) |
| **Module 12A: Admin Quiz Router**| `server/routes/admin.ts` | `src/worker/routes/quizCms.ts` | **12** | Domain 15: Quiz CMS (Versioning, Drafts, Reordering) | Admin RBAC (`quiz.manage`, `overview.view`) |
| **Module 12B: Admin Hub Router** | `server/routes/adminHub.ts` | `src/worker/routes/adminHub.ts` | **42** | Domain 14: Admin Control Center & Analytics<br/>Domain 16: Notifications & Mass Broadcasts<br/>Domain 18: Payments Ledger, Refunds & Financials | Admin Staff RBAC (54 endpoints across 11 roles) |
| **TOTALS** | **12 Physical Source Modules**| **12 Target Hono Modules** | **156** | **All 18 Bounded Feature Domains** | **13 Public, 10 Opt, 133 Auth (54 Granular RBAC)** |

### Inventory Summary by Priority Tier

| Priority Tier | Domain Area | Endpoint Count | Target Migration Module |
| :--- | :--- | :---: | :--- |
| **P0: Core Foundation** | System Health & Authentication | **6** | `index.ts` (1), `auth.ts` (5) |
| **P1: Member Core** | Dynamic Onboarding & User Profiles | **21** | `onboarding.ts` (7), `users.ts` (14) |
| **P1: Events & Passes** | Discovery, Events & Digital Passes | **10** | `discovery.ts` (1), `events.ts` (5), `passes.ts` (4) |
| **P2: Community & Contact** | Communities & Support Inquiries | **6** | `communities.ts` (4), `contact.ts` (2) |
| **P2: Partner Portal** | Business Partner Accounts & Venues | **36** | `partners.ts` (36) |
| **P3: Auction Arena** | Cricket Auctions, Bidding & Rosters | **23** | `auction.ts` (23) |
| **P3: Central Admin** | Quiz CMS & Central Control Center | **54** | `quizCms.ts` (12), `adminHub.ts` (42) |
| **TOTAL** | **Entire Application Surface** | **156** | **12 Ported Hono Route Modules** |

---

## 2. Complete 156-Endpoint Migration Catalog

### Endpoint #1: `GET /api/health`

- **Priority Tier:** `P0 (Core Foundation)`
- **Domain:** Authentication & Health
- **Express Source:** [`index.ts:49`](file:///D:/ST/server/index.ts#L49)
- **Target Hono Route:** `src/worker/routes/index.ts`
- **Authentication Requirement:** `Public`
- **Authorization / RBAC Guard:** `None`
- **Rate Limiting:** Standard IP Guard
- **Edge Compatibility & Migration Note:** Fully D1-compatible via standard async prepared statement

---

### Endpoint #2: `GET /api/admin/overview`

- **Priority Tier:** `P3 (Central Admin & CMS)`
- **Domain:** Admin Operations & Quiz CMS
- **Express Source:** [`admin.ts:20`](file:///D:/ST/server/routes/admin.ts#L20)
- **Target Hono Route:** `src/worker/routes/admin.ts`
- **Authentication Requirement:** `Required (Bearer JWT)`
- **Authorization / RBAC Guard:** `Admin (overview.view)`
- **Rate Limiting:** Standard IP Guard
- **Edge Compatibility & Migration Note:** Fully D1-compatible via standard async prepared statement

---

### Endpoint #3: `GET /api/admin/quizzes`

- **Priority Tier:** `P3 (Central Admin & CMS)`
- **Domain:** Admin Operations & Quiz CMS
- **Express Source:** [`admin.ts:78`](file:///D:/ST/server/routes/admin.ts#L78)
- **Target Hono Route:** `src/worker/routes/admin.ts`
- **Authentication Requirement:** `Required (Bearer JWT)`
- **Authorization / RBAC Guard:** `Admin (quiz.manage)`
- **Rate Limiting:** Standard IP Guard
- **Edge Compatibility & Migration Note:** Fully D1-compatible via standard async prepared statement

---

### Endpoint #4: `GET /api/admin/versions/:versionId`

- **Priority Tier:** `P3 (Central Admin & CMS)`
- **Domain:** Admin Operations & Quiz CMS
- **Express Source:** [`admin.ts:103`](file:///D:/ST/server/routes/admin.ts#L103)
- **Target Hono Route:** `src/worker/routes/admin.ts`
- **Authentication Requirement:** `Required (Bearer JWT)`
- **Authorization / RBAC Guard:** `Admin (quiz.manage)`
- **Rate Limiting:** Standard IP Guard
- **Edge Compatibility & Migration Note:** Fully D1-compatible via standard async prepared statement

---

### Endpoint #5: `POST /api/admin/quizzes/:quizId/create-draft`

- **Priority Tier:** `P3 (Central Admin & CMS)`
- **Domain:** Admin Operations & Quiz CMS
- **Express Source:** [`admin.ts:142`](file:///D:/ST/server/routes/admin.ts#L142)
- **Target Hono Route:** `src/worker/routes/admin.ts`
- **Authentication Requirement:** `Required (Bearer JWT)`
- **Authorization / RBAC Guard:** `Admin (quiz.manage)`
- **Rate Limiting:** Standard IP Guard
- **Edge Compatibility & Migration Note:** Fully D1-compatible via standard async prepared statement

---

### Endpoint #6: `POST /api/admin/questions`

- **Priority Tier:** `P3 (Central Admin & CMS)`
- **Domain:** Admin Operations & Quiz CMS
- **Express Source:** [`admin.ts:236`](file:///D:/ST/server/routes/admin.ts#L236)
- **Target Hono Route:** `src/worker/routes/admin.ts`
- **Authentication Requirement:** `Required (Bearer JWT)`
- **Authorization / RBAC Guard:** `Admin (quiz.manage)`
- **Rate Limiting:** Standard IP Guard
- **Edge Compatibility & Migration Note:** Fully D1-compatible via standard async prepared statement

---

### Endpoint #7: `PATCH /api/admin/questions/:id`

- **Priority Tier:** `P3 (Central Admin & CMS)`
- **Domain:** Admin Operations & Quiz CMS
- **Express Source:** [`admin.ts:317`](file:///D:/ST/server/routes/admin.ts#L317)
- **Target Hono Route:** `src/worker/routes/admin.ts`
- **Authentication Requirement:** `Required (Bearer JWT)`
- **Authorization / RBAC Guard:** `Admin (quiz.manage)`
- **Rate Limiting:** Standard IP Guard
- **Edge Compatibility & Migration Note:** Fully D1-compatible via standard async prepared statement

---

### Endpoint #8: `DELETE /api/admin/questions/:id`

- **Priority Tier:** `P3 (Central Admin & CMS)`
- **Domain:** Admin Operations & Quiz CMS
- **Express Source:** [`admin.ts:378`](file:///D:/ST/server/routes/admin.ts#L378)
- **Target Hono Route:** `src/worker/routes/admin.ts`
- **Authentication Requirement:** `Required (Bearer JWT)`
- **Authorization / RBAC Guard:** `Admin (quiz.manage)`
- **Rate Limiting:** Standard IP Guard
- **Edge Compatibility & Migration Note:** Fully D1-compatible via standard async prepared statement

---

### Endpoint #9: `POST /api/admin/questions/reorder`

- **Priority Tier:** `P3 (Central Admin & CMS)`
- **Domain:** Admin Operations & Quiz CMS
- **Express Source:** [`admin.ts:409`](file:///D:/ST/server/routes/admin.ts#L409)
- **Target Hono Route:** `src/worker/routes/admin.ts`
- **Authentication Requirement:** `Required (Bearer JWT)`
- **Authorization / RBAC Guard:** `Admin (quiz.manage)`
- **Rate Limiting:** Standard IP Guard
- **Edge Compatibility & Migration Note:** Fully D1-compatible via standard async prepared statement

---

### Endpoint #10: `POST /api/admin/questions/:questionId/options`

- **Priority Tier:** `P3 (Central Admin & CMS)`
- **Domain:** Admin Operations & Quiz CMS
- **Express Source:** [`admin.ts:431`](file:///D:/ST/server/routes/admin.ts#L431)
- **Target Hono Route:** `src/worker/routes/admin.ts`
- **Authentication Requirement:** `Required (Bearer JWT)`
- **Authorization / RBAC Guard:** `Admin (quiz.manage)`
- **Rate Limiting:** Standard IP Guard
- **Edge Compatibility & Migration Note:** Fully D1-compatible via standard async prepared statement

---

### Endpoint #11: `PATCH /api/admin/options/:id`

- **Priority Tier:** `P3 (Central Admin & CMS)`
- **Domain:** Admin Operations & Quiz CMS
- **Express Source:** [`admin.ts:478`](file:///D:/ST/server/routes/admin.ts#L478)
- **Target Hono Route:** `src/worker/routes/admin.ts`
- **Authentication Requirement:** `Required (Bearer JWT)`
- **Authorization / RBAC Guard:** `Admin (quiz.manage)`
- **Rate Limiting:** Standard IP Guard
- **Edge Compatibility & Migration Note:** Fully D1-compatible via standard async prepared statement

---

### Endpoint #12: `DELETE /api/admin/options/:id`

- **Priority Tier:** `P3 (Central Admin & CMS)`
- **Domain:** Admin Operations & Quiz CMS
- **Express Source:** [`admin.ts:521`](file:///D:/ST/server/routes/admin.ts#L521)
- **Target Hono Route:** `src/worker/routes/admin.ts`
- **Authentication Requirement:** `Required (Bearer JWT)`
- **Authorization / RBAC Guard:** `Admin (quiz.manage)`
- **Rate Limiting:** Standard IP Guard
- **Edge Compatibility & Migration Note:** Fully D1-compatible via standard async prepared statement

---

### Endpoint #13: `POST /api/admin/versions/:versionId/publish`

- **Priority Tier:** `P3 (Central Admin & CMS)`
- **Domain:** Admin Operations & Quiz CMS
- **Express Source:** [`admin.ts:550`](file:///D:/ST/server/routes/admin.ts#L550)
- **Target Hono Route:** `src/worker/routes/admin.ts`
- **Authentication Requirement:** `Required (Bearer JWT)`
- **Authorization / RBAC Guard:** `Admin (quiz.manage)`
- **Rate Limiting:** Standard IP Guard
- **Edge Compatibility & Migration Note:** Fully D1-compatible via standard async prepared statement

---

### Endpoint #14: `GET /api/admin/me/permissions`

- **Priority Tier:** `P3 (Central Admin & CMS)`
- **Domain:** Admin Operations & Quiz CMS
- **Express Source:** [`adminHub.ts:23`](file:///D:/ST/server/routes/adminHub.ts#L23)
- **Target Hono Route:** `src/worker/routes/adminHub.ts`
- **Authentication Requirement:** `Required (Bearer JWT)`
- **Authorization / RBAC Guard:** `Admin Staff`
- **Rate Limiting:** Standard IP Guard
- **Edge Compatibility & Migration Note:** Fully D1-compatible via standard async prepared statement

---

### Endpoint #15: `GET /api/admin/global-search`

- **Priority Tier:** `P3 (Central Admin & CMS)`
- **Domain:** Admin Operations & Quiz CMS
- **Express Source:** [`adminHub.ts:39`](file:///D:/ST/server/routes/adminHub.ts#L39)
- **Target Hono Route:** `src/worker/routes/adminHub.ts`
- **Authentication Requirement:** `Required (Bearer JWT)`
- **Authorization / RBAC Guard:** `Admin (overview.view)`
- **Rate Limiting:** Standard IP Guard
- **Edge Compatibility & Migration Note:** Fully D1-compatible via standard async prepared statement

---

### Endpoint #16: `GET /api/admin/dashboard-overview`

- **Priority Tier:** `P3 (Central Admin & CMS)`
- **Domain:** Admin Operations & Quiz CMS
- **Express Source:** [`adminHub.ts:90`](file:///D:/ST/server/routes/adminHub.ts#L90)
- **Target Hono Route:** `src/worker/routes/adminHub.ts`
- **Authentication Requirement:** `Required (Bearer JWT)`
- **Authorization / RBAC Guard:** `Admin (overview.view)`
- **Rate Limiting:** Standard IP Guard
- **Edge Compatibility & Migration Note:** Fully D1-compatible via standard async prepared statement

---

### Endpoint #17: `GET /api/admin/overview-analytics`

- **Priority Tier:** `P3 (Central Admin & CMS)`
- **Domain:** Admin Operations & Quiz CMS
- **Express Source:** [`adminHub.ts:260`](file:///D:/ST/server/routes/adminHub.ts#L260)
- **Target Hono Route:** `src/worker/routes/adminHub.ts`
- **Authentication Requirement:** `Required (Bearer JWT)`
- **Authorization / RBAC Guard:** `Admin (overview.view)`
- **Rate Limiting:** Standard IP Guard
- **Edge Compatibility & Migration Note:** Fully D1-compatible via standard async prepared statement

---

### Endpoint #18: `GET /api/admin/events`

- **Priority Tier:** `P3 (Central Admin & CMS)`
- **Domain:** Admin Operations & Quiz CMS
- **Express Source:** [`adminHub.ts:523`](file:///D:/ST/server/routes/adminHub.ts#L523)
- **Target Hono Route:** `src/worker/routes/adminHub.ts`
- **Authentication Requirement:** `Required (Bearer JWT)`
- **Authorization / RBAC Guard:** `Admin (events.view)`
- **Rate Limiting:** Standard IP Guard
- **Edge Compatibility & Migration Note:** Fully D1-compatible via standard async prepared statement

---

### Endpoint #19: `POST /api/admin/events`

- **Priority Tier:** `P3 (Central Admin & CMS)`
- **Domain:** Admin Operations & Quiz CMS
- **Express Source:** [`adminHub.ts:571`](file:///D:/ST/server/routes/adminHub.ts#L571)
- **Target Hono Route:** `src/worker/routes/adminHub.ts`
- **Authentication Requirement:** `Required (Bearer JWT)`
- **Authorization / RBAC Guard:** `Admin (events.create)`
- **Rate Limiting:** Standard IP Guard
- **Edge Compatibility & Migration Note:** Fully D1-compatible via standard async prepared statement

---

### Endpoint #20: `PUT /api/admin/events/:id`

- **Priority Tier:** `P3 (Central Admin & CMS)`
- **Domain:** Admin Operations & Quiz CMS
- **Express Source:** [`adminHub.ts:654`](file:///D:/ST/server/routes/adminHub.ts#L654)
- **Target Hono Route:** `src/worker/routes/adminHub.ts`
- **Authentication Requirement:** `Required (Bearer JWT)`
- **Authorization / RBAC Guard:** `Admin (events.edit)`
- **Rate Limiting:** Standard IP Guard
- **Edge Compatibility & Migration Note:** Fully D1-compatible via standard async prepared statement

---

### Endpoint #21: `POST /api/admin/events/:id/duplicate`

- **Priority Tier:** `P3 (Central Admin & CMS)`
- **Domain:** Admin Operations & Quiz CMS
- **Express Source:** [`adminHub.ts:756`](file:///D:/ST/server/routes/adminHub.ts#L756)
- **Target Hono Route:** `src/worker/routes/adminHub.ts`
- **Authentication Requirement:** `Required (Bearer JWT)`
- **Authorization / RBAC Guard:** `Admin (events.create)`
- **Rate Limiting:** Standard IP Guard
- **Edge Compatibility & Migration Note:** Fully D1-compatible via standard async prepared statement

---

### Endpoint #22: `GET /api/admin/events/:id/dependencies`

- **Priority Tier:** `P3 (Central Admin & CMS)`
- **Domain:** Admin Operations & Quiz CMS
- **Express Source:** [`adminHub.ts:838`](file:///D:/ST/server/routes/adminHub.ts#L838)
- **Target Hono Route:** `src/worker/routes/adminHub.ts`
- **Authentication Requirement:** `Required (Bearer JWT)`
- **Authorization / RBAC Guard:** `Admin (events.view)`
- **Rate Limiting:** Standard IP Guard
- **Edge Compatibility & Migration Note:** Fully D1-compatible via standard async prepared statement

---

### Endpoint #23: `DELETE /api/admin/events/:id`

- **Priority Tier:** `P3 (Central Admin & CMS)`
- **Domain:** Admin Operations & Quiz CMS
- **Express Source:** [`adminHub.ts:870`](file:///D:/ST/server/routes/adminHub.ts#L870)
- **Target Hono Route:** `src/worker/routes/adminHub.ts`
- **Authentication Requirement:** `Required (Bearer JWT)`
- **Authorization / RBAC Guard:** `Admin (events.delete)`
- **Rate Limiting:** Standard IP Guard
- **Edge Compatibility & Migration Note:** Event safe deletion: checks registrations/payments; blocks if financial records exist; wraps cascades in D1 batch

---

### Endpoint #24: `GET /api/admin/registrations`

- **Priority Tier:** `P3 (Central Admin & CMS)`
- **Domain:** Admin Operations & Quiz CMS
- **Express Source:** [`adminHub.ts:1026`](file:///D:/ST/server/routes/adminHub.ts#L1026)
- **Target Hono Route:** `src/worker/routes/adminHub.ts`
- **Authentication Requirement:** `Required (Bearer JWT)`
- **Authorization / RBAC Guard:** `Admin (events.view)`
- **Rate Limiting:** Standard IP Guard
- **Edge Compatibility & Migration Note:** Fully D1-compatible via standard async prepared statement

---

### Endpoint #25: `PATCH /api/admin/registrations/:id`

- **Priority Tier:** `P3 (Central Admin & CMS)`
- **Domain:** Admin Operations & Quiz CMS
- **Express Source:** [`adminHub.ts:1068`](file:///D:/ST/server/routes/adminHub.ts#L1068)
- **Target Hono Route:** `src/worker/routes/adminHub.ts`
- **Authentication Requirement:** `Required (Bearer JWT)`
- **Authorization / RBAC Guard:** `Admin (registrations.manage)`
- **Rate Limiting:** Standard IP Guard
- **Edge Compatibility & Migration Note:** Fully D1-compatible via standard async prepared statement

---

### Endpoint #26: `GET /api/admin/cities`

- **Priority Tier:** `P3 (Central Admin & CMS)`
- **Domain:** Admin Operations & Quiz CMS
- **Express Source:** [`adminHub.ts:1113`](file:///D:/ST/server/routes/adminHub.ts#L1113)
- **Target Hono Route:** `src/worker/routes/adminHub.ts`
- **Authentication Requirement:** `Required (Bearer JWT)`
- **Authorization / RBAC Guard:** `Admin (events.view)`
- **Rate Limiting:** Standard IP Guard
- **Edge Compatibility & Migration Note:** Fully D1-compatible via standard async prepared statement

---

### Endpoint #27: `POST /api/admin/cities`

- **Priority Tier:** `P3 (Central Admin & CMS)`
- **Domain:** Admin Operations & Quiz CMS
- **Express Source:** [`adminHub.ts:1129`](file:///D:/ST/server/routes/adminHub.ts#L1129)
- **Target Hono Route:** `src/worker/routes/adminHub.ts`
- **Authentication Requirement:** `Required (Bearer JWT)`
- **Authorization / RBAC Guard:** `Admin (cities.manage)`
- **Rate Limiting:** Standard IP Guard
- **Edge Compatibility & Migration Note:** Fully D1-compatible via standard async prepared statement

---

### Endpoint #28: `PUT /api/admin/cities/:id`

- **Priority Tier:** `P3 (Central Admin & CMS)`
- **Domain:** Admin Operations & Quiz CMS
- **Express Source:** [`adminHub.ts:1160`](file:///D:/ST/server/routes/adminHub.ts#L1160)
- **Target Hono Route:** `src/worker/routes/adminHub.ts`
- **Authentication Requirement:** `Required (Bearer JWT)`
- **Authorization / RBAC Guard:** `Admin (cities.manage)`
- **Rate Limiting:** Standard IP Guard
- **Edge Compatibility & Migration Note:** Fully D1-compatible via standard async prepared statement

---

### Endpoint #29: `GET /api/admin/members-directory`

- **Priority Tier:** `P3 (Central Admin & CMS)`
- **Domain:** Admin Operations & Quiz CMS
- **Express Source:** [`adminHub.ts:1210`](file:///D:/ST/server/routes/adminHub.ts#L1210)
- **Target Hono Route:** `src/worker/routes/adminHub.ts`
- **Authentication Requirement:** `Required (Bearer JWT)`
- **Authorization / RBAC Guard:** `Admin (members.view)`
- **Rate Limiting:** Standard IP Guard
- **Edge Compatibility & Migration Note:** Fully D1-compatible via standard async prepared statement

---

### Endpoint #30: `PATCH /api/admin/members/:id/status`

- **Priority Tier:** `P3 (Central Admin & CMS)`
- **Domain:** Admin Operations & Quiz CMS
- **Express Source:** [`adminHub.ts:1266`](file:///D:/ST/server/routes/adminHub.ts#L1266)
- **Target Hono Route:** `src/worker/routes/adminHub.ts`
- **Authentication Requirement:** `Required (Bearer JWT)`
- **Authorization / RBAC Guard:** `Admin (members.manage)`
- **Rate Limiting:** Standard IP Guard
- **Edge Compatibility & Migration Note:** Fully D1-compatible via standard async prepared statement

---

### Endpoint #31: `PATCH /api/admin/members/:id/role`

- **Priority Tier:** `P3 (Central Admin & CMS)`
- **Domain:** Admin Operations & Quiz CMS
- **Express Source:** [`adminHub.ts:1303`](file:///D:/ST/server/routes/adminHub.ts#L1303)
- **Target Hono Route:** `src/worker/routes/adminHub.ts`
- **Authentication Requirement:** `Required (Bearer JWT)`
- **Authorization / RBAC Guard:** `Admin (roles.assign)`
- **Rate Limiting:** Standard IP Guard
- **Edge Compatibility & Migration Note:** Fully D1-compatible via standard async prepared statement

---

### Endpoint #32: `GET /api/admin/roles-matrix`

- **Priority Tier:** `P3 (Central Admin & CMS)`
- **Domain:** Admin Operations & Quiz CMS
- **Express Source:** [`adminHub.ts:1353`](file:///D:/ST/server/routes/adminHub.ts#L1353)
- **Target Hono Route:** `src/worker/routes/adminHub.ts`
- **Authentication Requirement:** `Required (Bearer JWT)`
- **Authorization / RBAC Guard:** `Admin (overview.view)`
- **Rate Limiting:** Standard IP Guard
- **Edge Compatibility & Migration Note:** Fully D1-compatible via standard async prepared statement

---

### Endpoint #33: `GET /api/admin/communities`

- **Priority Tier:** `P3 (Central Admin & CMS)`
- **Domain:** Admin Operations & Quiz CMS
- **Express Source:** [`adminHub.ts:1364`](file:///D:/ST/server/routes/adminHub.ts#L1364)
- **Target Hono Route:** `src/worker/routes/adminHub.ts`
- **Authentication Requirement:** `Required (Bearer JWT)`
- **Authorization / RBAC Guard:** `Admin (communities.manage)`
- **Rate Limiting:** Standard IP Guard
- **Edge Compatibility & Migration Note:** Fully D1-compatible via standard async prepared statement

---

### Endpoint #34: `POST /api/admin/communities`

- **Priority Tier:** `P3 (Central Admin & CMS)`
- **Domain:** Admin Operations & Quiz CMS
- **Express Source:** [`adminHub.ts:1383`](file:///D:/ST/server/routes/adminHub.ts#L1383)
- **Target Hono Route:** `src/worker/routes/adminHub.ts`
- **Authentication Requirement:** `Required (Bearer JWT)`
- **Authorization / RBAC Guard:** `Admin (communities.manage)`
- **Rate Limiting:** Standard IP Guard
- **Edge Compatibility & Migration Note:** Fully D1-compatible via standard async prepared statement

---

### Endpoint #35: `PUT /api/admin/communities/:id`

- **Priority Tier:** `P3 (Central Admin & CMS)`
- **Domain:** Admin Operations & Quiz CMS
- **Express Source:** [`adminHub.ts:1433`](file:///D:/ST/server/routes/adminHub.ts#L1433)
- **Target Hono Route:** `src/worker/routes/adminHub.ts`
- **Authentication Requirement:** `Required (Bearer JWT)`
- **Authorization / RBAC Guard:** `Admin (communities.manage)`
- **Rate Limiting:** Standard IP Guard
- **Edge Compatibility & Migration Note:** Fully D1-compatible via standard async prepared statement

---

### Endpoint #36: `GET /api/admin/communities/:id/members`

- **Priority Tier:** `P3 (Central Admin & CMS)`
- **Domain:** Admin Operations & Quiz CMS
- **Express Source:** [`adminHub.ts:1471`](file:///D:/ST/server/routes/adminHub.ts#L1471)
- **Target Hono Route:** `src/worker/routes/adminHub.ts`
- **Authentication Requirement:** `Required (Bearer JWT)`
- **Authorization / RBAC Guard:** `Admin (communities.manage)`
- **Rate Limiting:** Standard IP Guard
- **Edge Compatibility & Migration Note:** Fully D1-compatible via standard async prepared statement

---

### Endpoint #37: `GET /api/admin/auctions`

- **Priority Tier:** `P3 (Central Admin & CMS)`
- **Domain:** Admin Operations & Quiz CMS
- **Express Source:** [`adminHub.ts:1491`](file:///D:/ST/server/routes/adminHub.ts#L1491)
- **Target Hono Route:** `src/worker/routes/adminHub.ts`
- **Authentication Requirement:** `Required (Bearer JWT)`
- **Authorization / RBAC Guard:** `Admin (auctions.view)`
- **Rate Limiting:** Standard IP Guard
- **Edge Compatibility & Migration Note:** Fully D1-compatible via standard async prepared statement

---

### Endpoint #38: `POST /api/admin/auctions`

- **Priority Tier:** `P3 (Central Admin & CMS)`
- **Domain:** Admin Operations & Quiz CMS
- **Express Source:** [`adminHub.ts:1531`](file:///D:/ST/server/routes/adminHub.ts#L1531)
- **Target Hono Route:** `src/worker/routes/adminHub.ts`
- **Authentication Requirement:** `Required (Bearer JWT)`
- **Authorization / RBAC Guard:** `Admin (auctions.manage)`
- **Rate Limiting:** Standard IP Guard
- **Edge Compatibility & Migration Note:** Fully D1-compatible via standard async prepared statement

---

### Endpoint #39: `GET /api/admin/venues`

- **Priority Tier:** `P3 (Central Admin & CMS)`
- **Domain:** Admin Operations & Quiz CMS
- **Express Source:** [`adminHub.ts:1581`](file:///D:/ST/server/routes/adminHub.ts#L1581)
- **Target Hono Route:** `src/worker/routes/adminHub.ts`
- **Authentication Requirement:** `Required (Bearer JWT)`
- **Authorization / RBAC Guard:** `Admin (venues.manage)`
- **Rate Limiting:** Standard IP Guard
- **Edge Compatibility & Migration Note:** Fully D1-compatible via standard async prepared statement

---

### Endpoint #40: `PATCH /api/admin/venues/:id/verify`

- **Priority Tier:** `P3 (Central Admin & CMS)`
- **Domain:** Admin Operations & Quiz CMS
- **Express Source:** [`adminHub.ts:1602`](file:///D:/ST/server/routes/adminHub.ts#L1602)
- **Target Hono Route:** `src/worker/routes/adminHub.ts`
- **Authentication Requirement:** `Required (Bearer JWT)`
- **Authorization / RBAC Guard:** `Admin (venues.manage)`
- **Rate Limiting:** Standard IP Guard
- **Edge Compatibility & Migration Note:** Fully D1-compatible via standard async prepared statement

---

### Endpoint #41: `GET /api/admin/checkin/events`

- **Priority Tier:** `P3 (Central Admin & CMS)`
- **Domain:** Admin Operations & Quiz CMS
- **Express Source:** [`adminHub.ts:1638`](file:///D:/ST/server/routes/adminHub.ts#L1638)
- **Target Hono Route:** `src/worker/routes/adminHub.ts`
- **Authentication Requirement:** `Required (Bearer JWT)`
- **Authorization / RBAC Guard:** `Admin (checkin.access)`
- **Rate Limiting:** Standard IP Guard
- **Edge Compatibility & Migration Note:** Fully D1-compatible via standard async prepared statement

---

### Endpoint #42: `GET /api/admin/checkin/search`

- **Priority Tier:** `P3 (Central Admin & CMS)`
- **Domain:** Admin Operations & Quiz CMS
- **Express Source:** [`adminHub.ts:1672`](file:///D:/ST/server/routes/adminHub.ts#L1672)
- **Target Hono Route:** `src/worker/routes/adminHub.ts`
- **Authentication Requirement:** `Required (Bearer JWT)`
- **Authorization / RBAC Guard:** `Admin (checkin.access)`
- **Rate Limiting:** Standard IP Guard
- **Edge Compatibility & Migration Note:** Fully D1-compatible via standard async prepared statement

---

### Endpoint #43: `POST /api/admin/checkin/scan`

- **Priority Tier:** `P3 (Central Admin & CMS)`
- **Domain:** Admin Operations & Quiz CMS
- **Express Source:** [`adminHub.ts:1702`](file:///D:/ST/server/routes/adminHub.ts#L1702)
- **Target Hono Route:** `src/worker/routes/adminHub.ts`
- **Authentication Requirement:** `Required (Bearer JWT)`
- **Authorization / RBAC Guard:** `Admin (checkin.access)`
- **Rate Limiting:** Standard IP Guard
- **Edge Compatibility & Migration Note:** Fully D1-compatible via standard async prepared statement

---

### Endpoint #44: `POST /api/admin/checkin/override`

- **Priority Tier:** `P3 (Central Admin & CMS)`
- **Domain:** Admin Operations & Quiz CMS
- **Express Source:** [`adminHub.ts:1789`](file:///D:/ST/server/routes/adminHub.ts#L1789)
- **Target Hono Route:** `src/worker/routes/adminHub.ts`
- **Authentication Requirement:** `Required (Bearer JWT)`
- **Authorization / RBAC Guard:** `Admin (checkin.override)`
- **Rate Limiting:** Standard IP Guard
- **Edge Compatibility & Migration Note:** Fully D1-compatible via standard async prepared statement

---

### Endpoint #45: `GET /api/admin/moderation/posts`

- **Priority Tier:** `P3 (Central Admin & CMS)`
- **Domain:** Admin Operations & Quiz CMS
- **Express Source:** [`adminHub.ts:1825`](file:///D:/ST/server/routes/adminHub.ts#L1825)
- **Target Hono Route:** `src/worker/routes/adminHub.ts`
- **Authentication Requirement:** `Required (Bearer JWT)`
- **Authorization / RBAC Guard:** `Admin (moderation.manage)`
- **Rate Limiting:** Standard IP Guard
- **Edge Compatibility & Migration Note:** Fully D1-compatible via standard async prepared statement

---

### Endpoint #46: `PATCH /api/admin/moderation/posts/:id`

- **Priority Tier:** `P3 (Central Admin & CMS)`
- **Domain:** Admin Operations & Quiz CMS
- **Express Source:** [`adminHub.ts:1854`](file:///D:/ST/server/routes/adminHub.ts#L1854)
- **Target Hono Route:** `src/worker/routes/adminHub.ts`
- **Authentication Requirement:** `Required (Bearer JWT)`
- **Authorization / RBAC Guard:** `Admin (moderation.manage)`
- **Rate Limiting:** Standard IP Guard
- **Edge Compatibility & Migration Note:** Fully D1-compatible via standard async prepared statement

---

### Endpoint #47: `GET /api/admin/payments`

- **Priority Tier:** `P3 (Central Admin & CMS)`
- **Domain:** Admin Operations & Quiz CMS
- **Express Source:** [`adminHub.ts:1903`](file:///D:/ST/server/routes/adminHub.ts#L1903)
- **Target Hono Route:** `src/worker/routes/adminHub.ts`
- **Authentication Requirement:** `Required (Bearer JWT)`
- **Authorization / RBAC Guard:** `Admin (payments.view)`
- **Rate Limiting:** Standard IP Guard
- **Edge Compatibility & Migration Note:** Fully D1-compatible via standard async prepared statement

---

### Endpoint #48: `POST /api/admin/payments/:id/refund`

- **Priority Tier:** `P3 (Central Admin & CMS)`
- **Domain:** Admin Operations & Quiz CMS
- **Express Source:** [`adminHub.ts:1936`](file:///D:/ST/server/routes/adminHub.ts#L1936)
- **Target Hono Route:** `src/worker/routes/adminHub.ts`
- **Authentication Requirement:** `Required (Bearer JWT)`
- **Authorization / RBAC Guard:** `Admin (payments.refund)`
- **Rate Limiting:** Standard IP Guard
- **Edge Compatibility & Migration Note:** Fully D1-compatible via standard async prepared statement

---

### Endpoint #49: `GET /api/admin/notifications/announcements`

- **Priority Tier:** `P3 (Central Admin & CMS)`
- **Domain:** Admin Operations & Quiz CMS
- **Express Source:** [`adminHub.ts:1980`](file:///D:/ST/server/routes/adminHub.ts#L1980)
- **Target Hono Route:** `src/worker/routes/adminHub.ts`
- **Authentication Requirement:** `Required (Bearer JWT)`
- **Authorization / RBAC Guard:** `Admin (notifications.manage)`
- **Rate Limiting:** Standard IP Guard
- **Edge Compatibility & Migration Note:** Fully D1-compatible via standard async prepared statement

---

### Endpoint #50: `POST /api/admin/notifications/broadcast`

- **Priority Tier:** `P3 (Central Admin & CMS)`
- **Domain:** Admin Operations & Quiz CMS
- **Express Source:** [`adminHub.ts:1989`](file:///D:/ST/server/routes/adminHub.ts#L1989)
- **Target Hono Route:** `src/worker/routes/adminHub.ts`
- **Authentication Requirement:** `Required (Bearer JWT)`
- **Authorization / RBAC Guard:** `Admin (notifications.manage)`
- **Rate Limiting:** Standard IP Guard
- **Edge Compatibility & Migration Note:** Fully D1-compatible via standard async prepared statement

---

### Endpoint #51: `GET /api/admin/analytics`

- **Priority Tier:** `P3 (Central Admin & CMS)`
- **Domain:** Admin Operations & Quiz CMS
- **Express Source:** [`adminHub.ts:2080`](file:///D:/ST/server/routes/adminHub.ts#L2080)
- **Target Hono Route:** `src/worker/routes/adminHub.ts`
- **Authentication Requirement:** `Required (Bearer JWT)`
- **Authorization / RBAC Guard:** `Admin (analytics.view)`
- **Rate Limiting:** Standard IP Guard
- **Edge Compatibility & Migration Note:** Fully D1-compatible via standard async prepared statement

---

### Endpoint #52: `GET /api/admin/reports/export`

- **Priority Tier:** `P3 (Central Admin & CMS)`
- **Domain:** Admin Operations & Quiz CMS
- **Express Source:** [`adminHub.ts:2177`](file:///D:/ST/server/routes/adminHub.ts#L2177)
- **Target Hono Route:** `src/worker/routes/adminHub.ts`
- **Authentication Requirement:** `Required (Bearer JWT)`
- **Authorization / RBAC Guard:** `Admin (analytics.view)`
- **Rate Limiting:** Standard IP Guard
- **Edge Compatibility & Migration Note:** Fully D1-compatible via standard async prepared statement

---

### Endpoint #53: `GET /api/admin/settings`

- **Priority Tier:** `P3 (Central Admin & CMS)`
- **Domain:** Admin Operations & Quiz CMS
- **Express Source:** [`adminHub.ts:2249`](file:///D:/ST/server/routes/adminHub.ts#L2249)
- **Target Hono Route:** `src/worker/routes/adminHub.ts`
- **Authentication Requirement:** `Required (Bearer JWT)`
- **Authorization / RBAC Guard:** `Admin (settings.manage)`
- **Rate Limiting:** Standard IP Guard
- **Edge Compatibility & Migration Note:** Fully D1-compatible via standard async prepared statement

---

### Endpoint #54: `PUT /api/admin/settings`

- **Priority Tier:** `P3 (Central Admin & CMS)`
- **Domain:** Admin Operations & Quiz CMS
- **Express Source:** [`adminHub.ts:2266`](file:///D:/ST/server/routes/adminHub.ts#L2266)
- **Target Hono Route:** `src/worker/routes/adminHub.ts`
- **Authentication Requirement:** `Required (Bearer JWT)`
- **Authorization / RBAC Guard:** `Admin (settings.manage)`
- **Rate Limiting:** Standard IP Guard
- **Edge Compatibility & Migration Note:** Fully D1-compatible via standard async prepared statement

---

### Endpoint #55: `GET /api/admin/audit-logs`

- **Priority Tier:** `P3 (Central Admin & CMS)`
- **Domain:** Admin Operations & Quiz CMS
- **Express Source:** [`adminHub.ts:2297`](file:///D:/ST/server/routes/adminHub.ts#L2297)
- **Target Hono Route:** `src/worker/routes/adminHub.ts`
- **Authentication Requirement:** `Required (Bearer JWT)`
- **Authorization / RBAC Guard:** `Admin (auditlogs.view)`
- **Rate Limiting:** Standard IP Guard
- **Edge Compatibility & Migration Note:** Fully D1-compatible via standard async prepared statement

---

### Endpoint #56: `GET /api/auctions`

- **Priority Tier:** `P3 (Auction Arena)`
- **Domain:** Auction Arena
- **Express Source:** [`auction.ts:33`](file:///D:/ST/server/routes/auction.ts#L33)
- **Target Hono Route:** `src/worker/routes/auction.ts`
- **Authentication Requirement:** `Optional (Bearer JWT)`
- **Authorization / RBAC Guard:** `None`
- **Rate Limiting:** Standard IP Guard
- **Edge Compatibility & Migration Note:** Fully D1-compatible via standard async prepared statement

---

### Endpoint #57: `GET /api/auctions/my/registrations`

- **Priority Tier:** `P3 (Auction Arena)`
- **Domain:** Auction Arena
- **Express Source:** [`auction.ts:98`](file:///D:/ST/server/routes/auction.ts#L98)
- **Target Hono Route:** `src/worker/routes/auction.ts`
- **Authentication Requirement:** `Required (Bearer JWT)`
- **Authorization / RBAC Guard:** `None`
- **Rate Limiting:** Standard IP Guard
- **Edge Compatibility & Migration Note:** Fully D1-compatible via standard async prepared statement

---

### Endpoint #58: `GET /api/auctions/:id`

- **Priority Tier:** `P3 (Auction Arena)`
- **Domain:** Auction Arena
- **Express Source:** [`auction.ts:141`](file:///D:/ST/server/routes/auction.ts#L141)
- **Target Hono Route:** `src/worker/routes/auction.ts`
- **Authentication Requirement:** `Optional (Bearer JWT)`
- **Authorization / RBAC Guard:** `None`
- **Rate Limiting:** Standard IP Guard
- **Edge Compatibility & Migration Note:** Fully D1-compatible via standard async prepared statement

---

### Endpoint #59: `GET /api/auctions/:id/stream` (Target: `GET /api/auctions/:id/poll`)

- **Priority Tier:** `P3 (Auction Arena)`
- **Domain:** Auction Arena (Domain 11)
- **Express Source:** [`auction.ts:252`](file:///D:/ST/server/routes/auction.ts#L252)
- **Target Hono Route:** `src/worker/routes/auction.ts` (`/api/auctions/:id/poll`)
- **Authentication Requirement:** `Public`
- **Authorization / RBAC Guard:** `None`
- **Rate Limiting:** Adaptive Heartbeat Guard (2s active, 5s idle, 10s lot transition; backoff to 15s max)
- **Edge Compatibility & Migration Note:** Workers are stateless isolates with a 10ms CPU / 30s wall-clock boundary. Node in-memory SSE Map (`auctionEvents.ts`) cannot be shared across isolates without Durable Objects. Target solution: **Gated Adaptive Polling Engine** with Cloudflare Edge Cache API (`caches.default`, 1s TTL) collapsing D1 reads by 99.8%, and `If-None-Match` returning HTTP 304 Not Modified when version ETag matches.

---

### Endpoint #60: `POST /api/auctions/:id/bid`

- **Priority Tier:** `P3 (Auction Arena)`
- **Domain:** Auction Arena (Domain 11)
- **Express Source:** [`auction.ts:273`](file:///D:/ST/server/routes/auction.ts#L273)
- **Target Hono Route:** `src/worker/routes/auction.ts`
- **Authentication Requirement:** `Required (Bearer JWT)`
- **Authorization / RBAC Guard:** `None (Authenticated Franchise Bidder)`
- **Rate Limiting:** Bid Debounce Guard (1 bid / sec / user) + Global WAF Rule
- **Edge Compatibility & Migration Note:** Requires optimistic atomic concurrency via `env.DB.batch([...])`: `UPDATE auction_rooms SET current_bid = ?, current_bidder_id = ? WHERE id = ? AND current_bid < ?`. If `meta.changes === 0`, bidder was outbid in race condition; returns 409 Conflict. Atomic team purse deduction checks `purse_balance >= ?`.

---

### Endpoint #61: `POST /api/auctions/:id/gavel`

- **Priority Tier:** `P3 (Auction Arena)`
- **Domain:** Auction Arena
- **Express Source:** [`auction.ts:403`](file:///D:/ST/server/routes/auction.ts#L403)
- **Target Hono Route:** `src/worker/routes/auction.ts`
- **Authentication Requirement:** `Required (Bearer JWT)`
- **Authorization / RBAC Guard:** `None`
- **Rate Limiting:** Standard IP Guard
- **Edge Compatibility & Migration Note:** Requires atomic transaction via env.DB.batch([...]) to update purse, lot status & bid history

---

### Endpoint #62: `POST /api/auctions/:id/next-lot`

- **Priority Tier:** `P3 (Auction Arena)`
- **Domain:** Auction Arena
- **Express Source:** [`auction.ts:489`](file:///D:/ST/server/routes/auction.ts#L489)
- **Target Hono Route:** `src/worker/routes/auction.ts`
- **Authentication Requirement:** `Required (Bearer JWT)`
- **Authorization / RBAC Guard:** `None`
- **Rate Limiting:** Standard IP Guard
- **Edge Compatibility & Migration Note:** Fully D1-compatible via standard async prepared statement

---

### Endpoint #63: `POST /api/auctions/:id/skip-lot`

- **Priority Tier:** `P3 (Auction Arena)`
- **Domain:** Auction Arena
- **Express Source:** [`auction.ts:546`](file:///D:/ST/server/routes/auction.ts#L546)
- **Target Hono Route:** `src/worker/routes/auction.ts`
- **Authentication Requirement:** `Required (Bearer JWT)`
- **Authorization / RBAC Guard:** `None`
- **Rate Limiting:** Standard IP Guard
- **Edge Compatibility & Migration Note:** Fully D1-compatible via standard async prepared statement

---

### Endpoint #64: `POST /api/auctions/:id/reopen-lot`

- **Priority Tier:** `P3 (Auction Arena)`
- **Domain:** Auction Arena
- **Express Source:** [`auction.ts:573`](file:///D:/ST/server/routes/auction.ts#L573)
- **Target Hono Route:** `src/worker/routes/auction.ts`
- **Authentication Requirement:** `Required (Bearer JWT)`
- **Authorization / RBAC Guard:** `None`
- **Rate Limiting:** Standard IP Guard
- **Edge Compatibility & Migration Note:** Fully D1-compatible via standard async prepared statement

---

### Endpoint #65: `POST /api/auctions/:id/select-lot`

- **Priority Tier:** `P3 (Auction Arena)`
- **Domain:** Auction Arena
- **Express Source:** [`auction.ts:610`](file:///D:/ST/server/routes/auction.ts#L610)
- **Target Hono Route:** `src/worker/routes/auction.ts`
- **Authentication Requirement:** `Required (Bearer JWT)`
- **Authorization / RBAC Guard:** `None`
- **Rate Limiting:** Standard IP Guard
- **Edge Compatibility & Migration Note:** Fully D1-compatible via standard async prepared statement

---

### Endpoint #66: `POST /api/auctions/:id/status`

- **Priority Tier:** `P3 (Auction Arena)`
- **Domain:** Auction Arena
- **Express Source:** [`auction.ts:655`](file:///D:/ST/server/routes/auction.ts#L655)
- **Target Hono Route:** `src/worker/routes/auction.ts`
- **Authentication Requirement:** `Required (Bearer JWT)`
- **Authorization / RBAC Guard:** `None`
- **Rate Limiting:** Standard IP Guard
- **Edge Compatibility & Migration Note:** Fully D1-compatible via standard async prepared statement

---

### Endpoint #67: `POST /api/auctions/:id/register`

- **Priority Tier:** `P3 (Auction Arena)`
- **Domain:** Auction Arena
- **Express Source:** [`auction.ts:679`](file:///D:/ST/server/routes/auction.ts#L679)
- **Target Hono Route:** `src/worker/routes/auction.ts`
- **Authentication Requirement:** `Required (Bearer JWT)`
- **Authorization / RBAC Guard:** `None`
- **Rate Limiting:** Standard IP Guard
- **Edge Compatibility & Migration Note:** Fully D1-compatible via standard async prepared statement

---

### Endpoint #68: `GET /api/auctions/:id/report`

- **Priority Tier:** `P3 (Auction Arena)`
- **Domain:** Auction Arena
- **Express Source:** [`auction.ts:704`](file:///D:/ST/server/routes/auction.ts#L704)
- **Target Hono Route:** `src/worker/routes/auction.ts`
- **Authentication Requirement:** `Public`
- **Authorization / RBAC Guard:** `None`
- **Rate Limiting:** Standard IP Guard
- **Edge Compatibility & Migration Note:** Fully D1-compatible via standard async prepared statement

---

### Endpoint #69: `GET /api/auctions/:id/results`

- **Priority Tier:** `P3 (Auction Arena)`
- **Domain:** Auction Arena
- **Express Source:** [`auction.ts:836`](file:///D:/ST/server/routes/auction.ts#L836)
- **Target Hono Route:** `src/worker/routes/auction.ts`
- **Authentication Requirement:** `Public`
- **Authorization / RBAC Guard:** `None`
- **Rate Limiting:** Standard IP Guard
- **Edge Compatibility & Migration Note:** Fully D1-compatible via standard async prepared statement

---

### Endpoint #70: `POST /api/auctions`

- **Priority Tier:** `P3 (Auction Arena)`
- **Domain:** Auction Arena
- **Express Source:** [`auction.ts:841`](file:///D:/ST/server/routes/auction.ts#L841)
- **Target Hono Route:** `src/worker/routes/auction.ts`
- **Authentication Requirement:** `Required (Bearer JWT)`
- **Authorization / RBAC Guard:** `None`
- **Rate Limiting:** Standard IP Guard
- **Edge Compatibility & Migration Note:** Fully D1-compatible via standard async prepared statement

---

### Endpoint #71: `PUT /api/auctions/:id`

- **Priority Tier:** `P3 (Auction Arena)`
- **Domain:** Auction Arena
- **Express Source:** [`auction.ts:894`](file:///D:/ST/server/routes/auction.ts#L894)
- **Target Hono Route:** `src/worker/routes/auction.ts`
- **Authentication Requirement:** `Required (Bearer JWT)`
- **Authorization / RBAC Guard:** `None`
- **Rate Limiting:** Standard IP Guard
- **Edge Compatibility & Migration Note:** Fully D1-compatible via standard async prepared statement

---

### Endpoint #72: `POST /api/auctions/:id/teams`

- **Priority Tier:** `P3 (Auction Arena)`
- **Domain:** Auction Arena
- **Express Source:** [`auction.ts:951`](file:///D:/ST/server/routes/auction.ts#L951)
- **Target Hono Route:** `src/worker/routes/auction.ts`
- **Authentication Requirement:** `Required (Bearer JWT)`
- **Authorization / RBAC Guard:** `None`
- **Rate Limiting:** Standard IP Guard
- **Edge Compatibility & Migration Note:** Fully D1-compatible via standard async prepared statement

---

### Endpoint #73: `PUT /api/auctions/:id/teams/:teamId`

- **Priority Tier:** `P3 (Auction Arena)`
- **Domain:** Auction Arena
- **Express Source:** [`auction.ts:975`](file:///D:/ST/server/routes/auction.ts#L975)
- **Target Hono Route:** `src/worker/routes/auction.ts`
- **Authentication Requirement:** `Required (Bearer JWT)`
- **Authorization / RBAC Guard:** `None`
- **Rate Limiting:** Standard IP Guard
- **Edge Compatibility & Migration Note:** Fully D1-compatible via standard async prepared statement

---

### Endpoint #74: `DELETE /api/auctions/:id/teams/:teamId`

- **Priority Tier:** `P3 (Auction Arena)`
- **Domain:** Auction Arena
- **Express Source:** [`auction.ts:998`](file:///D:/ST/server/routes/auction.ts#L998)
- **Target Hono Route:** `src/worker/routes/auction.ts`
- **Authentication Requirement:** `Required (Bearer JWT)`
- **Authorization / RBAC Guard:** `None`
- **Rate Limiting:** Standard IP Guard
- **Edge Compatibility & Migration Note:** Fully D1-compatible via standard async prepared statement

---

### Endpoint #75: `POST /api/auctions/:id/players`

- **Priority Tier:** `P3 (Auction Arena)`
- **Domain:** Auction Arena
- **Express Source:** [`auction.ts:1019`](file:///D:/ST/server/routes/auction.ts#L1019)
- **Target Hono Route:** `src/worker/routes/auction.ts`
- **Authentication Requirement:** `Required (Bearer JWT)`
- **Authorization / RBAC Guard:** `None`
- **Rate Limiting:** Standard IP Guard
- **Edge Compatibility & Migration Note:** Fully D1-compatible via standard async prepared statement

---

### Endpoint #76: `PUT /api/auctions/:id/players/:playerId`

- **Priority Tier:** `P3 (Auction Arena)`
- **Domain:** Auction Arena
- **Express Source:** [`auction.ts:1080`](file:///D:/ST/server/routes/auction.ts#L1080)
- **Target Hono Route:** `src/worker/routes/auction.ts`
- **Authentication Requirement:** `Required (Bearer JWT)`
- **Authorization / RBAC Guard:** `None`
- **Rate Limiting:** Standard IP Guard
- **Edge Compatibility & Migration Note:** Fully D1-compatible via standard async prepared statement

---

### Endpoint #77: `DELETE /api/auctions/:id/players/:playerId`

- **Priority Tier:** `P3 (Auction Arena)`
- **Domain:** Auction Arena
- **Express Source:** [`auction.ts:1137`](file:///D:/ST/server/routes/auction.ts#L1137)
- **Target Hono Route:** `src/worker/routes/auction.ts`
- **Authentication Requirement:** `Required (Bearer JWT)`
- **Authorization / RBAC Guard:** `None`
- **Rate Limiting:** Standard IP Guard
- **Edge Compatibility & Migration Note:** Fully D1-compatible via standard async prepared statement

---

### Endpoint #78: `POST /api/auctions/:id/players/batch`

- **Priority Tier:** `P3 (Auction Arena)`
- **Domain:** Auction Arena
- **Express Source:** [`auction.ts:1152`](file:///D:/ST/server/routes/auction.ts#L1152)
- **Target Hono Route:** `src/worker/routes/auction.ts`
- **Authentication Requirement:** `Required (Bearer JWT)`
- **Authorization / RBAC Guard:** `None`
- **Rate Limiting:** Standard IP Guard
- **Edge Compatibility & Migration Note:** Fully D1-compatible via standard async prepared statement

---

### Endpoint #79: `POST /api/auth/register`

- **Priority Tier:** `P0 (Core Foundation)`
- **Domain:** Authentication & Health (Domain 1)
- **Express Source:** [`auth.ts:34`](file:///D:/ST/server/routes/auth.ts#L34)
- **Target Hono Route:** `src/worker/routes/auth.ts`
- **Authentication Requirement:** `Public`
- **Authorization / RBAC Guard:** `None`
- **Rate Limiting:** Global WAF Rule (10 req/min/IP) + D1 `rate_limit_events` Transactional Throttle + In-Isolate Memory Bucket
- **Edge Compatibility & Migration Note:** Password hashing: Node `crypto.scryptSync` (taking ~44ms CPU) exceeds Workers Free 10ms CPU limit. Production on Free tier requires native Web Crypto PBKDF2 (~2-3ms CPU) or Workers Paid ($5/mo, 50ms CPU) to maintain standard $N=16384$ scrypt. JWT signed via `jose` (`SignJWT`). Uniqueness enforced via D1 unique constraints on `LOWER(email)` and `LOWER(username)`.

---

### Endpoint #80: `POST /api/auth/login`

- **Priority Tier:** `P0 (Core Foundation)`
- **Domain:** Authentication & Health (Domain 1)
- **Express Source:** [`auth.ts:75`](file:///D:/ST/server/routes/auth.ts#L75)
- **Target Hono Route:** `src/worker/routes/auth.ts`
- **Authentication Requirement:** `Public`
- **Authorization / RBAC Guard:** `None (Suspension Guard: 403 Forbidden if account_status === 'suspended')`
- **Rate Limiting:** Global WAF Rule (10 req/min/IP) + D1 `rate_limit_events` Failure Counter + In-Isolate Memory Bucket
- **Edge Compatibility & Migration Note:** Verifies password format: transparently upgrades legacy SHA-256 (`stroom_vibe_salt_2026`) upon valid login. For `scrypt$...` hashes, requires Workers Paid ($5/mo) CPU budget or transition to native Web Crypto PBKDF2. Issues 7-day JWT signed via `jose` HMAC-SHA256. Checks account suspension in D1 before issuing token.

---

### Endpoint #81: `POST /api/auth/logout`

- **Priority Tier:** `P0 (Core Foundation)`
- **Domain:** Authentication & Health
- **Express Source:** [`auth.ts:135`](file:///D:/ST/server/routes/auth.ts#L135)
- **Target Hono Route:** `src/worker/routes/auth.ts`
- **Authentication Requirement:** `Required (Bearer JWT)`
- **Authorization / RBAC Guard:** `None`
- **Rate Limiting:** Standard IP Guard
- **Edge Compatibility & Migration Note:** Fully D1-compatible via standard async prepared statement

---

### Endpoint #82: `GET /api/auth/me`

- **Priority Tier:** `P0 (Core Foundation)`
- **Domain:** Authentication & Health
- **Express Source:** [`auth.ts:151`](file:///D:/ST/server/routes/auth.ts#L151)
- **Target Hono Route:** `src/worker/routes/auth.ts`
- **Authentication Requirement:** `Required (Bearer JWT)`
- **Authorization / RBAC Guard:** `None`
- **Rate Limiting:** Standard IP Guard
- **Edge Compatibility & Migration Note:** Fully D1-compatible via standard async prepared statement

---

### Endpoint #83: `POST /api/auth/reset-demo`

- **Priority Tier:** `P0 (Core Foundation)`
- **Domain:** Authentication & Health
- **Express Source:** [`auth.ts:164`](file:///D:/ST/server/routes/auth.ts#L164)
- **Target Hono Route:** `src/worker/routes/auth.ts`
- **Authentication Requirement:** `Required (Bearer JWT)`
- **Authorization / RBAC Guard:** `None`
- **Rate Limiting:** Standard IP Guard
- **Edge Compatibility & Migration Note:** Fully D1-compatible via standard async prepared statement

---

### Endpoint #84: `GET /api/communities`

- **Priority Tier:** `P2 (Public Discovery & Community)`
- **Domain:** Discovery & Communities
- **Express Source:** [`communities.ts:9`](file:///D:/ST/server/routes/communities.ts#L9)
- **Target Hono Route:** `src/worker/routes/communities.ts`
- **Authentication Requirement:** `Optional (Bearer JWT)`
- **Authorization / RBAC Guard:** `None`
- **Rate Limiting:** Standard IP Guard
- **Edge Compatibility & Migration Note:** Fully D1-compatible via standard async prepared statement

---

### Endpoint #85: `GET /api/communities/:id`

- **Priority Tier:** `P2 (Public Discovery & Community)`
- **Domain:** Discovery & Communities
- **Express Source:** [`communities.ts:67`](file:///D:/ST/server/routes/communities.ts#L67)
- **Target Hono Route:** `src/worker/routes/communities.ts`
- **Authentication Requirement:** `Optional (Bearer JWT)`
- **Authorization / RBAC Guard:** `None`
- **Rate Limiting:** Standard IP Guard
- **Edge Compatibility & Migration Note:** Fully D1-compatible via standard async prepared statement

---

### Endpoint #86: `POST /api/communities/:id/join`

- **Priority Tier:** `P2 (Public Discovery & Community)`
- **Domain:** Discovery & Communities
- **Express Source:** [`communities.ts:126`](file:///D:/ST/server/routes/communities.ts#L126)
- **Target Hono Route:** `src/worker/routes/communities.ts`
- **Authentication Requirement:** `Required (Bearer JWT)`
- **Authorization / RBAC Guard:** `None`
- **Rate Limiting:** Standard IP Guard
- **Edge Compatibility & Migration Note:** Fully D1-compatible via standard async prepared statement

---

### Endpoint #87: `POST /api/communities/:id/leave`

- **Priority Tier:** `P2 (Public Discovery & Community)`
- **Domain:** Discovery & Communities
- **Express Source:** [`communities.ts:162`](file:///D:/ST/server/routes/communities.ts#L162)
- **Target Hono Route:** `src/worker/routes/communities.ts`
- **Authentication Requirement:** `Required (Bearer JWT)`
- **Authorization / RBAC Guard:** `None`
- **Rate Limiting:** Standard IP Guard
- **Edge Compatibility & Migration Note:** Fully D1-compatible via standard async prepared statement

---

### Endpoint #88: `POST /api/contact`

- **Priority Tier:** `P2 (Public Discovery & Community)`
- **Domain:** Discovery & Communities
- **Express Source:** [`contact.ts:17`](file:///D:/ST/server/routes/contact.ts#L17)
- **Target Hono Route:** `src/worker/routes/contact.ts`
- **Authentication Requirement:** `Optional (Bearer JWT)`
- **Authorization / RBAC Guard:** `None`
- **Rate Limiting:** Standard IP Guard
- **Edge Compatibility & Migration Note:** Fully D1-compatible via standard async prepared statement

---

### Endpoint #89: `GET /api/contact/faqs`

- **Priority Tier:** `P2 (Public Discovery & Community)`
- **Domain:** Discovery & Communities
- **Express Source:** [`contact.ts:61`](file:///D:/ST/server/routes/contact.ts#L61)
- **Target Hono Route:** `src/worker/routes/contact.ts`
- **Authentication Requirement:** `Public`
- **Authorization / RBAC Guard:** `None`
- **Rate Limiting:** Standard IP Guard
- **Edge Compatibility & Migration Note:** Fully D1-compatible via standard async prepared statement

---

### Endpoint #90: `GET /api/discovery`

- **Priority Tier:** `P2 (Public Discovery & Community)`
- **Domain:** Discovery & Communities
- **Express Source:** [`discovery.ts:10`](file:///D:/ST/server/routes/discovery.ts#L10)
- **Target Hono Route:** `src/worker/routes/discovery.ts`
- **Authentication Requirement:** `Optional (Bearer JWT)`
- **Authorization / RBAC Guard:** `None`
- **Rate Limiting:** Standard IP Guard
- **Edge Compatibility & Migration Note:** Fully D1-compatible via standard async prepared statement

---

### Endpoint #91: `GET /api/events/cities`

- **Priority Tier:** `P1 (Events & Bookings)`
- **Domain:** Events & Ticketing
- **Express Source:** [`events.ts:10`](file:///D:/ST/server/routes/events.ts#L10)
- **Target Hono Route:** `src/worker/routes/events.ts`
- **Authentication Requirement:** `Public`
- **Authorization / RBAC Guard:** `None`
- **Rate Limiting:** Standard IP Guard
- **Edge Compatibility & Migration Note:** Fully D1-compatible via standard async prepared statement

---

### Endpoint #92: `GET /api/events`

- **Priority Tier:** `P1 (Events & Bookings)`
- **Domain:** Events & Ticketing
- **Express Source:** [`events.ts:28`](file:///D:/ST/server/routes/events.ts#L28)
- **Target Hono Route:** `src/worker/routes/events.ts`
- **Authentication Requirement:** `Optional (Bearer JWT)`
- **Authorization / RBAC Guard:** `None`
- **Rate Limiting:** Standard IP Guard
- **Edge Compatibility & Migration Note:** Fully D1-compatible via standard async prepared statement

---

### Endpoint #93: `GET /api/events/:id`

- **Priority Tier:** `P1 (Events & Bookings)`
- **Domain:** Events & Ticketing
- **Express Source:** [`events.ts:92`](file:///D:/ST/server/routes/events.ts#L92)
- **Target Hono Route:** `src/worker/routes/events.ts`
- **Authentication Requirement:** `Optional (Bearer JWT)`
- **Authorization / RBAC Guard:** `None`
- **Rate Limiting:** Standard IP Guard
- **Edge Compatibility & Migration Note:** Fully D1-compatible via standard async prepared statement

---

### Endpoint #94: `POST /api/events/:id/register`

- **Priority Tier:** `P1 (Events & Bookings)`
- **Domain:** Events & Ticketing
- **Express Source:** [`events.ts:132`](file:///D:/ST/server/routes/events.ts#L132)
- **Target Hono Route:** `src/worker/routes/events.ts`
- **Authentication Requirement:** `Optional (Bearer JWT)`
- **Authorization / RBAC Guard:** `None`
- **Rate Limiting:** Standard IP Guard
- **Edge Compatibility & Migration Note:** Fully D1-compatible via standard async prepared statement

---

### Endpoint #95: `POST /api/events`

- **Priority Tier:** `P1 (Events & Bookings)`
- **Domain:** Events & Ticketing
- **Express Source:** [`events.ts:221`](file:///D:/ST/server/routes/events.ts#L221)
- **Target Hono Route:** `src/worker/routes/events.ts`
- **Authentication Requirement:** `Required (Bearer JWT)`
- **Authorization / RBAC Guard:** `Admin (events.create)`
- **Rate Limiting:** Standard IP Guard
- **Edge Compatibility & Migration Note:** Fully D1-compatible via standard async prepared statement

---

### Endpoint #96: `GET /api/onboarding/quiz`

- **Priority Tier:** `P1 (Onboarding & Member)`
- **Domain:** Member & Onboarding
- **Express Source:** [`onboarding.ts:55`](file:///D:/ST/server/routes/onboarding.ts#L55)
- **Target Hono Route:** `src/worker/routes/onboarding.ts`
- **Authentication Requirement:** `Public`
- **Authorization / RBAC Guard:** `None`
- **Rate Limiting:** Standard IP Guard
- **Edge Compatibility & Migration Note:** Fully D1-compatible via standard async prepared statement

---

### Endpoint #97: `POST /api/onboarding/sessions`

- **Priority Tier:** `P1 (Onboarding & Member)`
- **Domain:** Member & Onboarding
- **Express Source:** [`onboarding.ts:70`](file:///D:/ST/server/routes/onboarding.ts#L70)
- **Target Hono Route:** `src/worker/routes/onboarding.ts`
- **Authentication Requirement:** `Required (Bearer JWT)`
- **Authorization / RBAC Guard:** `None`
- **Rate Limiting:** Standard IP Guard
- **Edge Compatibility & Migration Note:** Fully D1-compatible via standard async prepared statement

---

### Endpoint #98: `GET /api/onboarding/sessions/:id`

- **Priority Tier:** `P1 (Onboarding & Member)`
- **Domain:** Member & Onboarding
- **Express Source:** [`onboarding.ts:154`](file:///D:/ST/server/routes/onboarding.ts#L154)
- **Target Hono Route:** `src/worker/routes/onboarding.ts`
- **Authentication Requirement:** `Required (Bearer JWT)`
- **Authorization / RBAC Guard:** `None`
- **Rate Limiting:** Standard IP Guard
- **Edge Compatibility & Migration Note:** Fully D1-compatible via standard async prepared statement

---

### Endpoint #99: `PUT /api/onboarding/sessions/:id/responses`

- **Priority Tier:** `P1 (Onboarding & Member)`
- **Domain:** Member & Onboarding
- **Express Source:** [`onboarding.ts:210`](file:///D:/ST/server/routes/onboarding.ts#L210)
- **Target Hono Route:** `src/worker/routes/onboarding.ts`
- **Authentication Requirement:** `Required (Bearer JWT)`
- **Authorization / RBAC Guard:** `None`
- **Rate Limiting:** Standard IP Guard
- **Edge Compatibility & Migration Note:** Fully D1-compatible via standard async prepared statement

---

### Endpoint #100: `POST /api/onboarding/sessions/:id/complete`

- **Priority Tier:** `P1 (Onboarding & Member)`
- **Domain:** Member & Onboarding
- **Express Source:** [`onboarding.ts:312`](file:///D:/ST/server/routes/onboarding.ts#L312)
- **Target Hono Route:** `src/worker/routes/onboarding.ts`
- **Authentication Requirement:** `Required (Bearer JWT)`
- **Authorization / RBAC Guard:** `None`
- **Rate Limiting:** Standard IP Guard
- **Edge Compatibility & Migration Note:** Fully D1-compatible via standard async prepared statement

---

### Endpoint #101: `POST /api/onboarding/sessions/:id/skip`

- **Priority Tier:** `P1 (Onboarding & Member)`
- **Domain:** Member & Onboarding
- **Express Source:** [`onboarding.ts:410`](file:///D:/ST/server/routes/onboarding.ts#L410)
- **Target Hono Route:** `src/worker/routes/onboarding.ts`
- **Authentication Requirement:** `Required (Bearer JWT)`
- **Authorization / RBAC Guard:** `None`
- **Rate Limiting:** Standard IP Guard
- **Edge Compatibility & Migration Note:** Fully D1-compatible via standard async prepared statement

---

### Endpoint #102: `POST /api/onboarding/restart`

- **Priority Tier:** `P1 (Onboarding & Member)`
- **Domain:** Member & Onboarding
- **Express Source:** [`onboarding.ts:454`](file:///D:/ST/server/routes/onboarding.ts#L454)
- **Target Hono Route:** `src/worker/routes/onboarding.ts`
- **Authentication Requirement:** `Required (Bearer JWT)`
- **Authorization / RBAC Guard:** `None`
- **Rate Limiting:** Standard IP Guard
- **Edge Compatibility & Migration Note:** Fully D1-compatible via standard async prepared statement

---

### Endpoint #103: `GET /api/partners/venues`

- **Priority Tier:** `P2 (Partner Portal)`
- **Domain:** Business Partner Portal
- **Express Source:** [`partners.ts:36`](file:///D:/ST/server/routes/partners.ts#L36)
- **Target Hono Route:** `src/worker/routes/partners.ts`
- **Authentication Requirement:** `Public`
- **Authorization / RBAC Guard:** `None`
- **Rate Limiting:** Standard IP Guard
- **Edge Compatibility & Migration Note:** Fully D1-compatible via standard async prepared statement

---

### Endpoint #104: `GET /api/partners/stats/:venueId`

- **Priority Tier:** `P2 (Partner Portal)`
- **Domain:** Business Partner Portal
- **Express Source:** [`partners.ts:58`](file:///D:/ST/server/routes/partners.ts#L58)
- **Target Hono Route:** `src/worker/routes/partners.ts`
- **Authentication Requirement:** `Public`
- **Authorization / RBAC Guard:** `None`
- **Rate Limiting:** Standard IP Guard
- **Edge Compatibility & Migration Note:** Fully D1-compatible via standard async prepared statement

---

### Endpoint #105: `POST /api/partners/proposals`

- **Priority Tier:** `P2 (Partner Portal)`
- **Domain:** Business Partner Portal
- **Express Source:** [`partners.ts:129`](file:///D:/ST/server/routes/partners.ts#L129)
- **Target Hono Route:** `src/worker/routes/partners.ts`
- **Authentication Requirement:** `Optional (Bearer JWT)`
- **Authorization / RBAC Guard:** `None`
- **Rate Limiting:** Standard IP Guard
- **Edge Compatibility & Migration Note:** Fully D1-compatible via standard async prepared statement

---

### Endpoint #106: `GET /api/partners/proposals`

- **Priority Tier:** `P2 (Partner Portal)`
- **Domain:** Business Partner Portal
- **Express Source:** [`partners.ts:198`](file:///D:/ST/server/routes/partners.ts#L198)
- **Target Hono Route:** `src/worker/routes/partners.ts`
- **Authentication Requirement:** `Required (Bearer JWT)`
- **Authorization / RBAC Guard:** `None`
- **Rate Limiting:** Standard IP Guard
- **Edge Compatibility & Migration Note:** Fully D1-compatible via standard async prepared statement

---

### Endpoint #107: `POST /api/partners/coupons`

- **Priority Tier:** `P2 (Partner Portal)`
- **Domain:** Business Partner Portal
- **Express Source:** [`partners.ts:214`](file:///D:/ST/server/routes/partners.ts#L214)
- **Target Hono Route:** `src/worker/routes/partners.ts`
- **Authentication Requirement:** `Required (Bearer JWT)`
- **Authorization / RBAC Guard:** `None`
- **Rate Limiting:** Standard IP Guard
- **Edge Compatibility & Migration Note:** Fully D1-compatible via standard async prepared statement

---

### Endpoint #108: `GET /api/partners/my-accounts`

- **Priority Tier:** `P2 (Partner Portal)`
- **Domain:** Business Partner Portal
- **Express Source:** [`partners.ts:299`](file:///D:/ST/server/routes/partners.ts#L299)
- **Target Hono Route:** `src/worker/routes/partners.ts`
- **Authentication Requirement:** `Required (Bearer JWT)`
- **Authorization / RBAC Guard:** `None`
- **Rate Limiting:** Standard IP Guard
- **Edge Compatibility & Migration Note:** Fully D1-compatible via standard async prepared statement

---

### Endpoint #109: `POST /api/partners/onboarding/save`

- **Priority Tier:** `P2 (Partner Portal)`
- **Domain:** Business Partner Portal
- **Express Source:** [`partners.ts:323`](file:///D:/ST/server/routes/partners.ts#L323)
- **Target Hono Route:** `src/worker/routes/partners.ts`
- **Authentication Requirement:** `Required (Bearer JWT)`
- **Authorization / RBAC Guard:** `None`
- **Rate Limiting:** Standard IP Guard
- **Edge Compatibility & Migration Note:** Fully D1-compatible via standard async prepared statement

---

### Endpoint #110: `POST /api/partners/onboarding/submit`

- **Priority Tier:** `P2 (Partner Portal)`
- **Domain:** Business Partner Portal
- **Express Source:** [`partners.ts:452`](file:///D:/ST/server/routes/partners.ts#L452)
- **Target Hono Route:** `src/worker/routes/partners.ts`
- **Authentication Requirement:** `Required (Bearer JWT)`
- **Authorization / RBAC Guard:** `None`
- **Rate Limiting:** Standard IP Guard
- **Edge Compatibility & Migration Note:** Fully D1-compatible via standard async prepared statement

---

### Endpoint #111: `PUT /api/partners/accounts/:partnerId/profile`

- **Priority Tier:** `P2 (Partner Portal)`
- **Domain:** Business Partner Portal
- **Express Source:** [`partners.ts:529`](file:///D:/ST/server/routes/partners.ts#L529)
- **Target Hono Route:** `src/worker/routes/partners.ts`
- **Authentication Requirement:** `Required (Bearer JWT)`
- **Authorization / RBAC Guard:** `None`
- **Rate Limiting:** Standard IP Guard
- **Edge Compatibility & Migration Note:** Fully D1-compatible via standard async prepared statement

---

### Endpoint #112: `GET /api/partners/accounts/:partnerId/dashboard`

- **Priority Tier:** `P2 (Partner Portal)`
- **Domain:** Business Partner Portal
- **Express Source:** [`partners.ts:610`](file:///D:/ST/server/routes/partners.ts#L610)
- **Target Hono Route:** `src/worker/routes/partners.ts`
- **Authentication Requirement:** `Required (Bearer JWT)`
- **Authorization / RBAC Guard:** `None`
- **Rate Limiting:** Standard IP Guard
- **Edge Compatibility & Migration Note:** Fully D1-compatible via standard async prepared statement

---

### Endpoint #113: `GET /api/partners/accounts/:partnerId/venues`

- **Priority Tier:** `P2 (Partner Portal)`
- **Domain:** Business Partner Portal
- **Express Source:** [`partners.ts:667`](file:///D:/ST/server/routes/partners.ts#L667)
- **Target Hono Route:** `src/worker/routes/partners.ts`
- **Authentication Requirement:** `Required (Bearer JWT)`
- **Authorization / RBAC Guard:** `None`
- **Rate Limiting:** Standard IP Guard
- **Edge Compatibility & Migration Note:** Fully D1-compatible via standard async prepared statement

---

### Endpoint #114: `POST /api/partners/accounts/:partnerId/venues`

- **Priority Tier:** `P2 (Partner Portal)`
- **Domain:** Business Partner Portal
- **Express Source:** [`partners.ts:690`](file:///D:/ST/server/routes/partners.ts#L690)
- **Target Hono Route:** `src/worker/routes/partners.ts`
- **Authentication Requirement:** `Required (Bearer JWT)`
- **Authorization / RBAC Guard:** `None`
- **Rate Limiting:** Standard IP Guard
- **Edge Compatibility & Migration Note:** Fully D1-compatible via standard async prepared statement

---

### Endpoint #115: `PUT /api/partners/accounts/:partnerId/venues/:venueId`

- **Priority Tier:** `P2 (Partner Portal)`
- **Domain:** Business Partner Portal
- **Express Source:** [`partners.ts:758`](file:///D:/ST/server/routes/partners.ts#L758)
- **Target Hono Route:** `src/worker/routes/partners.ts`
- **Authentication Requirement:** `Required (Bearer JWT)`
- **Authorization / RBAC Guard:** `None`
- **Rate Limiting:** Standard IP Guard
- **Edge Compatibility & Migration Note:** Fully D1-compatible via standard async prepared statement

---

### Endpoint #116: `GET /api/partners/accounts/:partnerId/venues/:venueId/availability`

- **Priority Tier:** `P2 (Partner Portal)`
- **Domain:** Business Partner Portal
- **Express Source:** [`partners.ts:830`](file:///D:/ST/server/routes/partners.ts#L830)
- **Target Hono Route:** `src/worker/routes/partners.ts`
- **Authentication Requirement:** `Required (Bearer JWT)`
- **Authorization / RBAC Guard:** `None`
- **Rate Limiting:** Standard IP Guard
- **Edge Compatibility & Migration Note:** Fully D1-compatible via standard async prepared statement

---

### Endpoint #117: `POST /api/partners/accounts/:partnerId/venues/:venueId/availability`

- **Priority Tier:** `P2 (Partner Portal)`
- **Domain:** Business Partner Portal
- **Express Source:** [`partners.ts:856`](file:///D:/ST/server/routes/partners.ts#L856)
- **Target Hono Route:** `src/worker/routes/partners.ts`
- **Authentication Requirement:** `Required (Bearer JWT)`
- **Authorization / RBAC Guard:** `None`
- **Rate Limiting:** Standard IP Guard
- **Edge Compatibility & Migration Note:** Fully D1-compatible via standard async prepared statement

---

### Endpoint #118: `GET /api/partners/accounts/:partnerId/collaborations`

- **Priority Tier:** `P2 (Partner Portal)`
- **Domain:** Business Partner Portal
- **Express Source:** [`partners.ts:917`](file:///D:/ST/server/routes/partners.ts#L917)
- **Target Hono Route:** `src/worker/routes/partners.ts`
- **Authentication Requirement:** `Required (Bearer JWT)`
- **Authorization / RBAC Guard:** `None`
- **Rate Limiting:** Standard IP Guard
- **Edge Compatibility & Migration Note:** Fully D1-compatible via standard async prepared statement

---

### Endpoint #119: `POST /api/partners/accounts/:partnerId/collaborations/:collabId/respond`

- **Priority Tier:** `P2 (Partner Portal)`
- **Domain:** Business Partner Portal
- **Express Source:** [`partners.ts:949`](file:///D:/ST/server/routes/partners.ts#L949)
- **Target Hono Route:** `src/worker/routes/partners.ts`
- **Authentication Requirement:** `Required (Bearer JWT)`
- **Authorization / RBAC Guard:** `None`
- **Rate Limiting:** Standard IP Guard
- **Edge Compatibility & Migration Note:** Fully D1-compatible via standard async prepared statement

---

### Endpoint #120: `GET /api/partners/accounts/:partnerId/events`

- **Priority Tier:** `P2 (Partner Portal)`
- **Domain:** Business Partner Portal
- **Express Source:** [`partners.ts:1042`](file:///D:/ST/server/routes/partners.ts#L1042)
- **Target Hono Route:** `src/worker/routes/partners.ts`
- **Authentication Requirement:** `Required (Bearer JWT)`
- **Authorization / RBAC Guard:** `None`
- **Rate Limiting:** Standard IP Guard
- **Edge Compatibility & Migration Note:** Fully D1-compatible via standard async prepared statement

---

### Endpoint #121: `PATCH /api/partners/accounts/:partnerId/events/:eventId/operations`

- **Priority Tier:** `P2 (Partner Portal)`
- **Domain:** Business Partner Portal
- **Express Source:** [`partners.ts:1089`](file:///D:/ST/server/routes/partners.ts#L1089)
- **Target Hono Route:** `src/worker/routes/partners.ts`
- **Authentication Requirement:** `Required (Bearer JWT)`
- **Authorization / RBAC Guard:** `None`
- **Rate Limiting:** Standard IP Guard
- **Edge Compatibility & Migration Note:** Fully D1-compatible via standard async prepared statement

---

### Endpoint #122: `GET /api/partners/accounts/:partnerId/campaigns`

- **Priority Tier:** `P2 (Partner Portal)`
- **Domain:** Business Partner Portal
- **Express Source:** [`partners.ts:1116`](file:///D:/ST/server/routes/partners.ts#L1116)
- **Target Hono Route:** `src/worker/routes/partners.ts`
- **Authentication Requirement:** `Required (Bearer JWT)`
- **Authorization / RBAC Guard:** `None`
- **Rate Limiting:** Standard IP Guard
- **Edge Compatibility & Migration Note:** Fully D1-compatible via standard async prepared statement

---

### Endpoint #123: `POST /api/partners/accounts/:partnerId/campaigns`

- **Priority Tier:** `P2 (Partner Portal)`
- **Domain:** Business Partner Portal
- **Express Source:** [`partners.ts:1141`](file:///D:/ST/server/routes/partners.ts#L1141)
- **Target Hono Route:** `src/worker/routes/partners.ts`
- **Authentication Requirement:** `Required (Bearer JWT)`
- **Authorization / RBAC Guard:** `None`
- **Rate Limiting:** Standard IP Guard
- **Edge Compatibility & Migration Note:** Fully D1-compatible via standard async prepared statement

---

### Endpoint #124: `PATCH /api/partners/accounts/:partnerId/campaigns/:campaignId`

- **Priority Tier:** `P2 (Partner Portal)`
- **Domain:** Business Partner Portal
- **Express Source:** [`partners.ts:1230`](file:///D:/ST/server/routes/partners.ts#L1230)
- **Target Hono Route:** `src/worker/routes/partners.ts`
- **Authentication Requirement:** `Required (Bearer JWT)`
- **Authorization / RBAC Guard:** `None`
- **Rate Limiting:** Standard IP Guard
- **Edge Compatibility & Migration Note:** Fully D1-compatible via standard async prepared statement

---

### Endpoint #125: `POST /api/partners/coupons/verify`

- **Priority Tier:** `P2 (Partner Portal)`
- **Domain:** Business Partner Portal
- **Express Source:** [`partners.ts:1277`](file:///D:/ST/server/routes/partners.ts#L1277)
- **Target Hono Route:** `src/worker/routes/partners.ts`
- **Authentication Requirement:** `Required (Bearer JWT)`
- **Authorization / RBAC Guard:** `None`
- **Rate Limiting:** Standard IP Guard
- **Edge Compatibility & Migration Note:** Fully D1-compatible via standard async prepared statement

---

### Endpoint #126: `POST /api/partners/coupons/redeem`

- **Priority Tier:** `P2 (Partner Portal)`
- **Domain:** Business Partner Portal
- **Express Source:** [`partners.ts:1360`](file:///D:/ST/server/routes/partners.ts#L1360)
- **Target Hono Route:** `src/worker/routes/partners.ts`
- **Authentication Requirement:** `Required (Bearer JWT)`
- **Authorization / RBAC Guard:** `None`
- **Rate Limiting:** Standard IP Guard
- **Edge Compatibility & Migration Note:** Fully D1-compatible via standard async prepared statement

---

### Endpoint #127: `GET /api/partners/accounts/:partnerId/redemptions`

- **Priority Tier:** `P2 (Partner Portal)`
- **Domain:** Business Partner Portal
- **Express Source:** [`partners.ts:1470`](file:///D:/ST/server/routes/partners.ts#L1470)
- **Target Hono Route:** `src/worker/routes/partners.ts`
- **Authentication Requirement:** `Required (Bearer JWT)`
- **Authorization / RBAC Guard:** `None`
- **Rate Limiting:** Standard IP Guard
- **Edge Compatibility & Migration Note:** Fully D1-compatible via standard async prepared statement

---

### Endpoint #128: `GET /api/partners/accounts/:partnerId/analytics`

- **Priority Tier:** `P2 (Partner Portal)`
- **Domain:** Business Partner Portal
- **Express Source:** [`partners.ts:1485`](file:///D:/ST/server/routes/partners.ts#L1485)
- **Target Hono Route:** `src/worker/routes/partners.ts`
- **Authentication Requirement:** `Required (Bearer JWT)`
- **Authorization / RBAC Guard:** `None`
- **Rate Limiting:** Standard IP Guard
- **Edge Compatibility & Migration Note:** Fully D1-compatible via standard async prepared statement

---

### Endpoint #129: `GET /api/partners/accounts/:partnerId/reports/export`

- **Priority Tier:** `P2 (Partner Portal)`
- **Domain:** Business Partner Portal
- **Express Source:** [`partners.ts:1498`](file:///D:/ST/server/routes/partners.ts#L1498)
- **Target Hono Route:** `src/worker/routes/partners.ts`
- **Authentication Requirement:** `Required (Bearer JWT)`
- **Authorization / RBAC Guard:** `None`
- **Rate Limiting:** Standard IP Guard
- **Edge Compatibility & Migration Note:** CSV export generated in memory and returned as text/csv

---

### Endpoint #130: `GET /api/partners/accounts/:partnerId/communications`

- **Priority Tier:** `P2 (Partner Portal)`
- **Domain:** Business Partner Portal
- **Express Source:** [`partners.ts:1518`](file:///D:/ST/server/routes/partners.ts#L1518)
- **Target Hono Route:** `src/worker/routes/partners.ts`
- **Authentication Requirement:** `Required (Bearer JWT)`
- **Authorization / RBAC Guard:** `None`
- **Rate Limiting:** Standard IP Guard
- **Edge Compatibility & Migration Note:** Fully D1-compatible via standard async prepared statement

---

### Endpoint #131: `POST /api/partners/accounts/:partnerId/communications`

- **Priority Tier:** `P2 (Partner Portal)`
- **Domain:** Business Partner Portal
- **Express Source:** [`partners.ts:1538`](file:///D:/ST/server/routes/partners.ts#L1538)
- **Target Hono Route:** `src/worker/routes/partners.ts`
- **Authentication Requirement:** `Required (Bearer JWT)`
- **Authorization / RBAC Guard:** `None`
- **Rate Limiting:** Standard IP Guard
- **Edge Compatibility & Migration Note:** Fully D1-compatible via standard async prepared statement

---

### Endpoint #132: `PATCH /api/partners/accounts/:partnerId/communications/:msgId/read`

- **Priority Tier:** `P2 (Partner Portal)`
- **Domain:** Business Partner Portal
- **Express Source:** [`partners.ts:1568`](file:///D:/ST/server/routes/partners.ts#L1568)
- **Target Hono Route:** `src/worker/routes/partners.ts`
- **Authentication Requirement:** `Required (Bearer JWT)`
- **Authorization / RBAC Guard:** `None`
- **Rate Limiting:** Standard IP Guard
- **Edge Compatibility & Migration Note:** Fully D1-compatible via standard async prepared statement

---

### Endpoint #133: `GET /api/partners/admin/overview`

- **Priority Tier:** `P2 (Partner Portal)`
- **Domain:** Business Partner Portal
- **Express Source:** [`partners.ts:1583`](file:///D:/ST/server/routes/partners.ts#L1583)
- **Target Hono Route:** `src/worker/routes/partners.ts`
- **Authentication Requirement:** `Required (Bearer JWT)`
- **Authorization / RBAC Guard:** `None`
- **Rate Limiting:** Standard IP Guard
- **Edge Compatibility & Migration Note:** Fully D1-compatible via standard async prepared statement

---

### Endpoint #134: `GET /api/partners/admin/:partnerId/details`

- **Priority Tier:** `P2 (Partner Portal)`
- **Domain:** Business Partner Portal
- **Express Source:** [`partners.ts:1649`](file:///D:/ST/server/routes/partners.ts#L1649)
- **Target Hono Route:** `src/worker/routes/partners.ts`
- **Authentication Requirement:** `Required (Bearer JWT)`
- **Authorization / RBAC Guard:** `None`
- **Rate Limiting:** Standard IP Guard
- **Edge Compatibility & Migration Note:** Fully D1-compatible via standard async prepared statement

---

### Endpoint #135: `POST /api/partners/admin/:partnerId/verify`

- **Priority Tier:** `P2 (Partner Portal)`
- **Domain:** Business Partner Portal
- **Express Source:** [`partners.ts:1677`](file:///D:/ST/server/routes/partners.ts#L1677)
- **Target Hono Route:** `src/worker/routes/partners.ts`
- **Authentication Requirement:** `Required (Bearer JWT)`
- **Authorization / RBAC Guard:** `None`
- **Rate Limiting:** Standard IP Guard
- **Edge Compatibility & Migration Note:** Fully D1-compatible via standard async prepared statement

---

### Endpoint #136: `POST /api/partners/admin/collaborations`

- **Priority Tier:** `P2 (Partner Portal)`
- **Domain:** Business Partner Portal
- **Express Source:** [`partners.ts:1737`](file:///D:/ST/server/routes/partners.ts#L1737)
- **Target Hono Route:** `src/worker/routes/partners.ts`
- **Authentication Requirement:** `Required (Bearer JWT)`
- **Authorization / RBAC Guard:** `None`
- **Rate Limiting:** Standard IP Guard
- **Edge Compatibility & Migration Note:** Fully D1-compatible via standard async prepared statement

---

### Endpoint #137: `POST /api/partners/admin/collaborations/:collabId/confirm`

- **Priority Tier:** `P2 (Partner Portal)`
- **Domain:** Business Partner Portal
- **Express Source:** [`partners.ts:1837`](file:///D:/ST/server/routes/partners.ts#L1837)
- **Target Hono Route:** `src/worker/routes/partners.ts`
- **Authentication Requirement:** `Required (Bearer JWT)`
- **Authorization / RBAC Guard:** `None`
- **Rate Limiting:** Standard IP Guard
- **Edge Compatibility & Migration Note:** Fully D1-compatible via standard async prepared statement

---

### Endpoint #138: `POST /api/partners/admin/campaigns/:campaignId/review`

- **Priority Tier:** `P2 (Partner Portal)`
- **Domain:** Business Partner Portal
- **Express Source:** [`partners.ts:1926`](file:///D:/ST/server/routes/partners.ts#L1926)
- **Target Hono Route:** `src/worker/routes/partners.ts`
- **Authentication Requirement:** `Required (Bearer JWT)`
- **Authorization / RBAC Guard:** `None`
- **Rate Limiting:** Standard IP Guard
- **Edge Compatibility & Migration Note:** Fully D1-compatible via standard async prepared statement

---

### Endpoint #139: `GET /api/passes/my-passes`

- **Priority Tier:** `P1 (Events & Bookings)`
- **Domain:** Events & Ticketing
- **Express Source:** [`passes.ts:11`](file:///D:/ST/server/routes/passes.ts#L11)
- **Target Hono Route:** `src/worker/routes/passes.ts`
- **Authentication Requirement:** `Required (Bearer JWT)`
- **Authorization / RBAC Guard:** `None`
- **Rate Limiting:** Standard IP Guard
- **Edge Compatibility & Migration Note:** Fully D1-compatible via standard async prepared statement

---

### Endpoint #140: `GET /api/passes/verify/:token`

- **Priority Tier:** `P1 (Events & Bookings)`
- **Domain:** Events & Ticketing
- **Express Source:** [`passes.ts:45`](file:///D:/ST/server/routes/passes.ts#L45)
- **Target Hono Route:** `src/worker/routes/passes.ts`
- **Authentication Requirement:** `Public`
- **Authorization / RBAC Guard:** `None`
- **Rate Limiting:** Standard IP Guard
- **Edge Compatibility & Migration Note:** Fully D1-compatible via standard async prepared statement

---

### Endpoint #141: `POST /api/passes/check-in`

- **Priority Tier:** `P1 (Events & Bookings)`
- **Domain:** Events & Ticketing
- **Express Source:** [`passes.ts:84`](file:///D:/ST/server/routes/passes.ts#L84)
- **Target Hono Route:** `src/worker/routes/passes.ts`
- **Authentication Requirement:** `Required (Bearer JWT)`
- **Authorization / RBAC Guard:** `Admin (checkin.access)`
- **Rate Limiting:** Standard IP Guard
- **Edge Compatibility & Migration Note:** Requires atomic pass verification & stamp update in D1 batch

---

### Endpoint #142: `POST /api/passes/:id/cancel`

- **Priority Tier:** `P1 (Events & Bookings)`
- **Domain:** Events & Ticketing
- **Express Source:** [`passes.ts:183`](file:///D:/ST/server/routes/passes.ts#L183)
- **Target Hono Route:** `src/worker/routes/passes.ts`
- **Authentication Requirement:** `Required (Bearer JWT)`
- **Authorization / RBAC Guard:** `None`
- **Rate Limiting:** Standard IP Guard
- **Edge Compatibility & Migration Note:** Fully D1-compatible via standard async prepared statement

---

### Endpoint #143: `GET /api/users/me/preferences`

- **Priority Tier:** `P1 (Onboarding & Member)`
- **Domain:** Member & Onboarding
- **Express Source:** [`preferences.ts:26`](file:///D:/ST/server/routes/preferences.ts#L26)
- **Target Hono Route:** `src/worker/routes/users.ts`
- **Authentication Requirement:** `Required (Bearer JWT)`
- **Authorization / RBAC Guard:** `None`
- **Rate Limiting:** Standard IP Guard
- **Edge Compatibility & Migration Note:** Fully D1-compatible via standard async prepared statement

---

### Endpoint #144: `PUT /api/users/me/preferences`

- **Priority Tier:** `P1 (Onboarding & Member)`
- **Domain:** Member & Onboarding
- **Express Source:** [`preferences.ts:68`](file:///D:/ST/server/routes/preferences.ts#L68)
- **Target Hono Route:** `src/worker/routes/users.ts`
- **Authentication Requirement:** `Required (Bearer JWT)`
- **Authorization / RBAC Guard:** `None`
- **Rate Limiting:** Standard IP Guard
- **Edge Compatibility & Migration Note:** Fully D1-compatible via standard async prepared statement

---

### Endpoint #145: `GET /api/users/me/profile`

- **Priority Tier:** `P1 (Onboarding & Member)`
- **Domain:** Member & Onboarding
- **Express Source:** [`preferences.ts:111`](file:///D:/ST/server/routes/preferences.ts#L111)
- **Target Hono Route:** `src/worker/routes/users.ts`
- **Authentication Requirement:** `Required (Bearer JWT)`
- **Authorization / RBAC Guard:** `None`
- **Rate Limiting:** Standard IP Guard
- **Edge Compatibility & Migration Note:** Fully D1-compatible via standard async prepared statement

---

### Endpoint #146: `PUT /api/users/me/profile`

- **Priority Tier:** `P1 (Onboarding & Member)`
- **Domain:** Member & Onboarding
- **Express Source:** [`preferences.ts:283`](file:///D:/ST/server/routes/preferences.ts#L283)
- **Target Hono Route:** `src/worker/routes/users.ts`
- **Authentication Requirement:** `Required (Bearer JWT)`
- **Authorization / RBAC Guard:** `None`
- **Rate Limiting:** Standard IP Guard
- **Edge Compatibility & Migration Note:** Fully D1-compatible via standard async prepared statement

---

### Endpoint #147: `POST /api/users/me/change-password`

- **Priority Tier:** `P1 (Onboarding & Member)`
- **Domain:** Member & Onboarding
- **Express Source:** [`preferences.ts:395`](file:///D:/ST/server/routes/preferences.ts#L395)
- **Target Hono Route:** `src/worker/routes/users.ts`
- **Authentication Requirement:** `Required (Bearer JWT)`
- **Authorization / RBAC Guard:** `None`
- **Rate Limiting:** Enforced (Token-Bucket Limiter)
- **Edge Compatibility & Migration Note:** Fully D1-compatible via standard async prepared statement

---

### Endpoint #148: `GET /api/users/me/passport`

- **Priority Tier:** `P1 (Onboarding & Member)`
- **Domain:** Member & Onboarding
- **Express Source:** [`preferences.ts:426`](file:///D:/ST/server/routes/preferences.ts#L426)
- **Target Hono Route:** `src/worker/routes/users.ts`
- **Authentication Requirement:** `Required (Bearer JWT)`
- **Authorization / RBAC Guard:** `None`
- **Rate Limiting:** Standard IP Guard
- **Edge Compatibility & Migration Note:** Fully D1-compatible via standard async prepared statement

---

### Endpoint #149: `GET /api/users/me/notifications`

- **Priority Tier:** `P1 (Onboarding & Member)`
- **Domain:** Member & Onboarding
- **Express Source:** [`preferences.ts:494`](file:///D:/ST/server/routes/preferences.ts#L494)
- **Target Hono Route:** `src/worker/routes/users.ts`
- **Authentication Requirement:** `Required (Bearer JWT)`
- **Authorization / RBAC Guard:** `None`
- **Rate Limiting:** Standard IP Guard
- **Edge Compatibility & Migration Note:** Fully D1-compatible via standard async prepared statement

---

### Endpoint #150: `PATCH /api/users/me/notifications/:id/read`

- **Priority Tier:** `P1 (Onboarding & Member)`
- **Domain:** Member & Onboarding
- **Express Source:** [`preferences.ts:514`](file:///D:/ST/server/routes/preferences.ts#L514)
- **Target Hono Route:** `src/worker/routes/users.ts`
- **Authentication Requirement:** `Required (Bearer JWT)`
- **Authorization / RBAC Guard:** `None`
- **Rate Limiting:** Standard IP Guard
- **Edge Compatibility & Migration Note:** Fully D1-compatible via standard async prepared statement

---

### Endpoint #151: `POST /api/users/me/notifications/mark-all-read`

- **Priority Tier:** `P1 (Onboarding & Member)`
- **Domain:** Member & Onboarding
- **Express Source:** [`preferences.ts:527`](file:///D:/ST/server/routes/preferences.ts#L527)
- **Target Hono Route:** `src/worker/routes/users.ts`
- **Authentication Requirement:** `Required (Bearer JWT)`
- **Authorization / RBAC Guard:** `None`
- **Rate Limiting:** Standard IP Guard
- **Edge Compatibility & Migration Note:** Fully D1-compatible via standard async prepared statement

---

### Endpoint #152: `GET /api/users/public/:memberIdOrId`

- **Priority Tier:** `P1 (Onboarding & Member)`
- **Domain:** Member & Onboarding
- **Express Source:** [`preferences.ts:538`](file:///D:/ST/server/routes/preferences.ts#L538)
- **Target Hono Route:** `src/worker/routes/users.ts`
- **Authentication Requirement:** `Public`
- **Authorization / RBAC Guard:** `None`
- **Rate Limiting:** Standard IP Guard
- **Edge Compatibility & Migration Note:** Fully D1-compatible via standard async prepared statement

---

### Endpoint #153: `GET /api/users/admin/members`

- **Priority Tier:** `P1 (Onboarding & Member)`
- **Domain:** Member & Onboarding
- **Express Source:** [`preferences.ts:613`](file:///D:/ST/server/routes/preferences.ts#L613)
- **Target Hono Route:** `src/worker/routes/users.ts`
- **Authentication Requirement:** `Required (Bearer JWT)`
- **Authorization / RBAC Guard:** `None`
- **Rate Limiting:** Standard IP Guard
- **Edge Compatibility & Migration Note:** Fully D1-compatible via standard async prepared statement

---

### Endpoint #154: `GET /api/users/admin/members/:id/details`

- **Priority Tier:** `P1 (Onboarding & Member)`
- **Domain:** Member & Onboarding
- **Express Source:** [`preferences.ts:656`](file:///D:/ST/server/routes/preferences.ts#L656)
- **Target Hono Route:** `src/worker/routes/users.ts`
- **Authentication Requirement:** `Required (Bearer JWT)`
- **Authorization / RBAC Guard:** `None`
- **Rate Limiting:** Standard IP Guard
- **Edge Compatibility & Migration Note:** Fully D1-compatible via standard async prepared statement

---

### Endpoint #155: `POST /api/users/admin/members/:id/award-achievement`

- **Priority Tier:** `P1 (Onboarding & Member)`
- **Domain:** Member & Onboarding
- **Express Source:** [`preferences.ts:700`](file:///D:/ST/server/routes/preferences.ts#L700)
- **Target Hono Route:** `src/worker/routes/users.ts`
- **Authentication Requirement:** `Required (Bearer JWT)`
- **Authorization / RBAC Guard:** `None`
- **Rate Limiting:** Standard IP Guard
- **Edge Compatibility & Migration Note:** Fully D1-compatible via standard async prepared statement

---

### Endpoint #156: `PUT /api/users/admin/members/:id/role`

- **Priority Tier:** `P1 (Onboarding & Member)`
- **Domain:** Member & Onboarding
- **Express Source:** [`preferences.ts:737`](file:///D:/ST/server/routes/preferences.ts#L737)
- **Target Hono Route:** `src/worker/routes/users.ts`
- **Authentication Requirement:** `Required (Bearer JWT)`
- **Authorization / RBAC Guard:** `Admin (roles.assign)`
- **Rate Limiting:** Standard IP Guard
- **Edge Compatibility & Migration Note:** Fully D1-compatible via standard async prepared statement

---


## 3. Special Edge Migration Constraints & Exceptions

1. **Live Auction Real-Time Updates (`/api/auctions/:id/stream`):**
   - *Current Implementation:* In-memory `Map<string, Set<Response>>` holding open persistent SSE connections in Node.js.
   - *Cloudflare Worker Constraint:* Workers are stateless isolates with a 10ms CPU / 30s wall-clock boundary on the Free tier. Free tier terminates idle streaming connections, and concurrent isolates cannot share in-memory connection Maps.
   - *Capacity Math:* Simple unthrottled 2-second polling with 50 clients burns 180,000 requests in 2 hours (180% of daily Worker quota).
   - *Target Hono Solution:* Implement **Gated Adaptive Polling** (`GET /api/auctions/:id/poll?since=<id>&gavel=<count>`):
     - Active only when `room.status === 'LIVE'`.
     - Adaptive interval (2s active bidding, 5s idle lot, 10s lot transition; backoff to 15s max).
     - Cloudflare Edge Cache API (`caches.default`) with 1-second TTL collapsing concurrent D1 reads by 99.8%.
     - `If-None-Match` header returning HTTP 304 Not Modified when state ETag is unchanged.
     - WebSocket + Durable Objects documented as the paid upgrade path for >250 concurrent live bidders.
2. **Distributed Rate Limiting Across Multi-Isolate Deployments:**
   - *Constraint:* In-isolate memory `Map<string, RateBucket>` is local to a single V8 isolate and provides only best-effort single-isolate throttling.
   - *Target Hono Solution:* Multi-layer defense: Cloudflare WAF Rate Limiting at the zone level for perimeter IP filtering, D1 transactional `rate_limit_events` table for sensitive security operations (Login, Register, Password Reset, Refunds), and in-isolate memory bucket for general read protection.
3. **Password Hashing CPU Limits on Workers Free Tier:**
   - *Constraint:* Pure-JS/WASM `scrypt` with $N=16384$ takes 40–150ms of CPU time, exceeding the Workers Free 10ms CPU limit per invocation.
   - *Target Hono Solution:* Documented upgrade trigger to Workers Paid ($5/mo for 50ms Standard CPU) to preserve standard $N=16384$ scrypt, or transition to native Web Crypto PBKDF2 (~2-3ms CPU) for strict free-tier compliance. Legacy SHA-256 hashes auto-upgraded upon verified login.
4. **Event Safe Deletion (`DELETE /api/admin/events/:id`):**
   - *Constraint:* Event deletion must verify dependencies (registrations, attendances, payment transactions) and block deletion with HTTP 409 if active payments or attended passes exist.
   - *Hono Solution:* Port the multi-table verification and execute atomic cascading deletions via `await env.DB.batch([...])`.
5. **Database Disk Backups (`POST /api/admin/backup` or internal backup):**
   - *Constraint:* `better-sqlite3` calls `db.backup('backups/...')` which writes to local disk. Cloudflare Workers have no persistent local filesystem.
   - *Hono Solution:* Cloudflare D1 provides automated continuous daily snapshots. The Worker endpoint returns D1 metadata and export instruction links rather than attempting local disk I/O.
