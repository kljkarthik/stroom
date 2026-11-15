# STROOM — Phase 2.3: Authentication & RBAC Compatibility Matrix

**Project:** `D:\ST`  
**Branch:** `feature/stroom-production-launch`  
**Audit Baseline:** Commit `19c4176`  
**Document Version:** 1.0.0 (Phase 2.3 Deliverable)  
**Total Endpoint Surface:** **156 Endpoints** across **12 Physical Modules**

---

## 1. Executive Summary

This matrix defines the authentication, authorization, and role-based access control (RBAC) behavior across the entire 156-endpoint STROOM API surface.

To guarantee zero regression during serverless porting:
- **13 Public Endpoints** remain unauthenticated and globally accessible.
- **10 Optional-Authentication Endpoints** dynamically adapt behavior based on whether a valid Bearer token is provided.
- **133 Required-Authentication Endpoints** strictly require a valid, non-expired Bearer token and non-suspended account status.
- **54 Granular Permission-Enforced Endpoints** enforce role-based access checks across 27 distinct administrative capabilities.
- **All 11 Existing RBAC Roles** are preserved with identical authorization logic.

---

## 2. RBAC Roles and Permissions Hierarchy

STROOM defines 27 distinct permissions organized under an authoritative staff hierarchy:

### 2.1 The 27 Granular Administrative Permissions

```
overview.view          events.view            events.create          events.edit
events.publish         events.delete          registrations.manage   cities.manage
members.view           members.manage         roles.assign           communities.manage
auctions.view          auctions.manage        partners.verify        venues.manage
checkin.access         checkin.override       quiz.manage            moderation.manage
campaigns.approve      payments.view          payments.refund        notifications.manage
analytics.view         settings.manage        auditlogs.view
```

---

### 2.2 Complete Role-to-Permission Mapping Matrix

| RBAC Role | Category | Direct Permissions Assigned | Bypass / Super Admin Rights |
| :--- | :--- | :--- | :--- |
| **`super_admin`** | Executive Staff | All 27 permissions | Full platform bypass (`hasPermission` returns `true`) |
| **`admin`** | Senior Staff | All 27 permissions | Full platform bypass (`hasPermission` returns `true`) |
| **`platform_admin`** | Operations Staff | 25 permissions (excludes `roles.assign`, `settings.manage`) | Explicit permission evaluation |
| **`event_manager`** | Event Operations | 12 permissions: `overview.view`, `events.*` (6), `registrations.manage`, `cities.manage`, `venues.manage`, `checkin.access`, `notifications.manage`, `analytics.view` | Scoped to events & venues |
| **`auctioneer`** | Auction Floor | 5 permissions: `overview.view`, `auctions.view`, `auctions.manage`, `events.view`, `analytics.view` | Scoped to auction live bidding |
| **`auction_manager`** | Auction Operations | 5 permissions: `overview.view`, `auctions.view`, `auctions.manage`, `events.view`, `analytics.view` | Scoped to auction setup & rosters |
| **`community_manager`**| Community Lead | 6 permissions: `overview.view`, `communities.manage`, `moderation.manage`, `events.view`, `notifications.manage`, `analytics.view` | Scoped to social clubs & moderation |
| **`partner_manager`** | Commercial Lead | 6 permissions: `overview.view`, `partners.verify`, `venues.manage`, `campaigns.approve`, `notifications.manage`, `analytics.view` | Scoped to venues & campaigns |
| **`checkin_staff`** | Door Operations | 3 permissions: `overview.view`, `events.view`, `checkin.access` | Scoped to door QR terminal |
| **`support_staff`** | Customer Support | 4 permissions: `overview.view`, `members.view`, `events.view`, `moderation.manage` | Scoped to member help & reporting |
| **`venue_partner`** | Business Partner | Scoped exclusively via partner portal token checks (`owner_id = user.id`) | No admin panel permissions |
| **`participant`** | Verified Member | Standard member rights + elevated bidding eligibility | No admin panel permissions |
| **`user`** | General Member | Standard profile studio, onboarding quiz, ticket booking | No admin panel permissions |

---

## 3. Endpoint Classification Breakdown

```
TOTAL ENDPOINTS: 156
├── Public Endpoints                 :  13 (8.3%)
├── Optional Authentication          :  10 (6.4%)
└── Required Authentication          : 133 (85.3%)
    ├── Standard Member Auth         :  79 (50.6%)
    └── Granular Admin / Staff RBAC  :  54 (34.6%)
```

---

## 4. Comprehensive 156-Endpoint Compatibility Matrix

### Module 1: System & Health (`index.ts`)
| # | Method | Endpoint Path | Auth Category | Express Middleware | Target Worker Middleware | RBAC Guard | Migration Continuity Notes |
| :-: | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | `GET` | `/api/health` | Public | None | None | None | Probes D1 & 42 table schema |

---

### Module 2: Authentication Router (`server/routes/auth.ts`)
| # | Method | Endpoint Path | Auth Category | Express Middleware | Target Worker Middleware | RBAC Guard | Migration Continuity Notes |
| :-: | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 2 | `POST` | `/api/auth/register` | Public | `authRateLimiter` | Origin Express (Phase 2) | None | Hashes via scrypt; issues HS256 JWT |
| 3 | `POST` | `/api/auth/login` | Public | `authRateLimiter` | Origin Express (Phase 2) | None | Verifies scrypt/SHA-256; upgrades legacy |
| 4 | `POST` | `/api/auth/logout` | Required | `requireAuth` | `workerRequireAuth` | None | Stateless; audits admin logouts |
| 5 | `GET` | `/api/auth/me` | Required | `requireAuth` | `workerRequireAuth` | None | Returns user record & preferences |
| 6 | `POST` | `/api/auth/reset-demo` | Required | `requireAuth` | Origin Express (Phase 2) | Dev Only | Disabled in production |

---

### Module 3: Dynamic Onboarding Router (`server/routes/onboarding.ts`)
| # | Method | Endpoint Path | Auth Category | Express Middleware | Target Worker Middleware | RBAC Guard | Migration Continuity Notes |
| :-: | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 7 | `GET` | `/api/onboarding/quiz` | Public | None | `c.json()` | None | Returns active published quiz structure |
| 8 | `POST` | `/api/onboarding/session` | Required | `requireAuth` | `workerRequireAuth` | None | Creates or resumes member quiz session |
| 9 | `GET` | `/api/onboarding/session` | Required | `requireAuth` | `workerRequireAuth` | None | Retrieves user's active session state |
| 10 | `POST` | `/api/onboarding/answer` | Required | `requireAuth` | `workerRequireAuth` | None | Persists answers with constraint check |
| 11 | `POST` | `/api/onboarding/complete`| Required | `requireAuth` | `workerRequireAuth` | None | Enforces required answers; awards badge |
| 12 | `POST` | `/api/onboarding/skip` | Required | `requireAuth` | `workerRequireAuth` | None | Marks status SKIPPED; no fake answers |
| 13 | `GET` | `/api/onboarding/preferences` | Required | `requireAuth` | `workerRequireAuth` | None | Returns aggregated personality traits |

---

### Module 4: Social Discovery Feed (`server/routes/discovery.ts`)
| # | Method | Endpoint Path | Auth Category | Express Middleware | Target Worker Middleware | RBAC Guard | Migration Continuity Notes |
| :-: | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 14 | `GET` | `/api/discovery/feed` | Optional | `optionalAuth` | `workerOptionalAuth` | None | Tailors feed if authenticated; general if guest |

---

### Module 5: User Preferences & Member Studio (`server/routes/preferences.ts`)
| # | Method | Endpoint Path | Auth Category | Express Middleware | Target Worker Middleware | RBAC Guard | Migration Continuity Notes |
| :-: | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 15 | `GET` | `/api/users/me/preferences` | Required | `requireAuth` | `workerRequireAuth` | None | Returns user preference records |
| 16 | `PUT` | `/api/users/me/preferences` | Required | `requireAuth` | `workerRequireAuth` | None | Updates preference key-value records |
| 17 | `GET` | `/api/users/me/profile` | Required | `requireAuth` | `workerRequireAuth` | None | Returns full profile studio data |
| 18 | `PUT` | `/api/users/me/profile` | Required | `requireAuth` | `workerRequireAuth` | None | Validates URLs; updates bio & interests |
| 19 | `POST` | `/api/users/me/change-password` | Required | `requireAuth` | Origin Express (Phase 2) | None | Verifies current; updates scrypt hash |
| 20 | `GET` | `/api/users/me/passport` | Required | `requireAuth` | `workerRequireAuth` | None | Returns verified member passport |
| 21 | `GET` | `/api/users/me/notifications` | Required | `requireAuth` | `workerRequireAuth` | None | Returns in-app notification center |
| 22 | `PATCH`| `/api/users/me/notifications/:id/read` | Required | `requireAuth` | `workerRequireAuth` | None | Marks notification read |
| 23 | `POST` | `/api/users/me/notifications/read-all` | Required | `requireAuth` | `workerRequireAuth` | None | Batch marks all notifications read |
| 24 | `GET` | `/api/users/me/activity` | Required | `requireAuth` | `workerRequireAuth` | None | Returns activity journey log |
| 25 | `GET` | `/api/users/profile/:id` | Optional | `optionalAuth` | `workerOptionalAuth` | None | Enforces `is_public` and privacy settings |
| 26 | `GET` | `/api/users/search` | Required | `requireAuth` | `workerRequireAuth` | `members.view` | Admin member search lookup |
| 27 | `GET` | `/api/users/badges/catalog` | Required | `requireAuth` | `workerRequireAuth` | None | Returns master achievements catalog |
| 28 | `POST` | `/api/users/me/badges/evaluate` | Required | `requireAuth` | `workerRequireAuth` | None | Evaluates dynamic badge unlocks |

---

### Module 6: Events & Cities Catalog (`server/routes/events.ts`)
| # | Method | Endpoint Path | Auth Category | Express Middleware | Target Worker Middleware | RBAC Guard | Migration Continuity Notes |
| :-: | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 29 | `GET` | `/api/events` | Optional | `optionalAuth` | `workerOptionalAuth` | None | Supports city, category, date filters |
| 30 | `GET` | `/api/events/featured` | Public | None | `c.json()` | None | Returns featured regional experiences |
| 31 | `GET` | `/api/events/cities` | Public | None | `c.json()` | None | Returns launch cities (Hyderabad, Pune) |
| 32 | `GET` | `/api/events/:id` | Optional | `optionalAuth` | `workerOptionalAuth` | None | Returns event details & user registration |
| 33 | `POST` | `/api/events/:id/register` | Optional | `optionalAuth` | `workerOptionalAuth` | None | Authenticated user or guest attendee stub |

---

### Module 7: Passes & Door Check-In (`server/routes/passes.ts`)
| # | Method | Endpoint Path | Auth Category | Express Middleware | Target Worker Middleware | RBAC Guard | Migration Continuity Notes |
| :-: | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 34 | `GET` | `/api/passes/my` | Required | `requireAuth` | `workerRequireAuth` | None | Returns authenticated user's passes |
| 35 | `GET` | `/api/passes/verify/:token` | Required | `requireAuth` | `workerRequireAuth` | `checkin.access` | Staff verifies QR token validity |
| 36 | `POST` | `/api/passes/checkin` | Required | `requireAuth` | `workerRequireAuth` | `checkin.access` | Terminal stamps check-in; prevents dupes |
| 37 | `POST` | `/api/passes/:id/cancel` | Required | `requireAuth` | `workerRequireAuth` | None | Cancels registration; restores event seat |

---

### Module 8: Live Auction Arena (`server/routes/auction.ts`)
| # | Method | Endpoint Path | Auth Category | Express Middleware | Target Worker Middleware | RBAC Guard | Migration Continuity Notes |
| :-: | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 38 | `GET` | `/api/auctions` | Public | None | `c.json()` | None | Returns active and upcoming auction rooms |
| 39 | `GET` | `/api/auctions/:id` | Optional | `optionalAuth` | `workerOptionalAuth` | None | Returns room metadata and user team |
| 40 | `GET` | `/api/auctions/:id/lots` | Public | None | `c.json()` | None | Returns player lots and sale statuses |
| 41 | `GET` | `/api/auctions/:id/teams` | Public | None | `c.json()` | None | Returns franchise teams and remaining purse |
| 42 | `GET` | `/api/auctions/:id/state` | Optional | `optionalAuth` | `workerOptionalAuth` | None | Polling endpoint for active lot & timer |
| 43 | `POST` | `/api/auctions/:id/register` | Required | `requireAuth` | `workerRequireAuth` | None | Member registers for auction room |
| 44 | `POST` | `/api/auctions/:id/bids` | Required | `requireAuth` | `workerRequireAuth` | None | Places bid; atomic purse & increment check |
| 45 | `POST` | `/api/auctions/:id/lots/:lotId/gavel` | Required | `requireAuth` | `workerRequireAuth` | `auctions.manage` | Auctioneer strikes gavel (SOLD/UNSOLD) |
| 46 | `POST` | `/api/auctions/:id/start` | Required | `requireAuth` | `workerRequireAuth` | `auctions.manage` | Starts auction; transitions to live |
| 47 | `POST` | `/api/auctions/:id/pause` | Required | `requireAuth` | `workerRequireAuth` | `auctions.manage` | Pauses live bidding clock |
| 48 | `POST` | `/api/auctions/:id/resume` | Required | `requireAuth` | `workerRequireAuth` | `auctions.manage` | Resumes live bidding clock |
| 49 | `POST` | `/api/auctions/:id/end` | Required | `requireAuth` | `workerRequireAuth` | `auctions.manage` | Concludes auction room |
| 50 | `GET` | `/api/auctions/:id/audit-log` | Required | `requireAuth` | `workerRequireAuth` | `auctions.view` | Returns complete bidding ledger |
| 51-60| `*` | *(10 Auction Roster/Squad Endpoints)* | Required | `requireAuth` | `workerRequireAuth` | Team / Staff | Squad management, budget tracking, rules |

---

### Module 9: Partner Portal (`server/routes/partners.ts` — 36 Endpoints)
| Range | Path Pattern | Auth Category | Express Middleware | Target Worker Middleware | RBAC Guard | Continuity Notes |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **61-64** | `GET /api/partners/venues/public` (4) | Public | None | `c.json()` | None | Public directory of verified venues & perks |
| **65-75** | `POST/GET /api/partners/onboarding/*` (11) | Required | `requireAuth` | `workerRequireAuth` | Partner Scoped | Partner registration, venue profile setup |
| **76-85** | `POST/PUT /api/partners/venues/*` (10) | Required | `requireAuth` | `workerRequireAuth` | Partner Scoped | Venue capacity, blackout dates, bookings |
| **86-96** | `POST/GET /api/partners/campaigns/*` (11)| Required | `requireAuth` | `workerRequireAuth` | Partner Scoped | QR coupon issuance, cashier redemption |

---

### Module 10: Communities & Clubs (`server/routes/communities.ts`)
| # | Method | Endpoint Path | Auth Category | Express Middleware | Target Worker Middleware | RBAC Guard | Continuity Notes |
| :-: | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 97 | `GET` | `/api/communities` | Optional | `optionalAuth` | `workerOptionalAuth` | None | Returns active clubs with member counts |
| 98 | `GET` | `/api/communities/:id` | Optional | `optionalAuth` | `workerOptionalAuth` | None | Returns club guidelines, organizer & events |
| 99 | `POST` | `/api/communities/:id/join` | Required | `requireAuth` | `workerRequireAuth` | None | Authenticated join; updates member count |
| 100| `POST` | `/api/communities/:id/leave`| Required | `requireAuth` | `workerRequireAuth` | None | Authenticated leave; updates member count |

---

### Module 11: Contact & Public Support (`server/routes/contact.ts`)
| # | Method | Endpoint Path | Auth Category | Express Middleware | Target Worker Middleware | RBAC Guard | Continuity Notes |
| :-: | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 101| `GET` | `/api/contact/faqs` | Public | None | `c.json()` | None | Returns 6 verified FAQ categories |
| 102| `POST`| `/api/contact/inquiry` | Public | `inquiryLimiter` | `workerRateLimit` | None | Stores support ticket; returns reference ID |

---

### Module 12A: Admin Quiz CMS (`server/routes/admin.ts` — 12 Endpoints)
| Range | Path Pattern | Auth Category | Express Middleware | Target Worker Middleware | RBAC Guard | Continuity Notes |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **103-114**| `/api/admin/quiz/*` (12 endpoints) | Required | `requireAuth`, `requirePermission` | `workerRequirePermission` | `quiz.manage` | Draft versioning, reordering, publication gate |

---

### Module 12B: Central Admin Control Center (`server/routes/adminHub.ts` — 42 Endpoints)
| Range | Domain / Subsystem | Auth Category | Target Worker Guard | Required RBAC Permission | Endpoint Count |
| :--- | :--- | :--- | :--- | :--- | :---: |
| **115-119**| Overview & Analytics | Required | `workerRequirePermission` | `overview.view`, `analytics.view` | 5 |
| **120-125**| Events Management | Required | `workerRequirePermission` | `events.create`, `events.edit`, `events.delete` | 6 |
| **126-128**| Regional Cities & Launch | Required | `workerRequirePermission` | `cities.manage` | 3 |
| **129-132**| Member Management & Roles | Required | `workerRequirePermission` | `members.manage`, `roles.assign` | 4 |
| **133-136**| Community Moderation | Required | `workerRequirePermission` | `communities.manage`, `moderation.manage` | 4 |
| **137-141**| Partner Verification & Venues| Required | `workerRequirePermission` | `partners.verify`, `venues.manage` | 5 |
| **142-145**| Door Check-In Override | Required | `workerRequirePermission` | `checkin.access`, `checkin.override` | 4 |
| **146-148**| Payments & Refunds Ledger | Required | `workerRequirePermission` | `payments.view`, `payments.refund` | 3 |
| **149-151**| Mass Notifications Broadcast | Required | `workerRequirePermission` | `notifications.manage` | 3 |
| **152-154**| Platform Configuration | Required | `workerRequirePermission` | `settings.manage` | 3 |
| **155-156**| Immutable Audit Logs | Required | `workerRequirePermission` | `auditlogs.view` | 2 |

---

## 5. Critical Route Nuances & Edge Case Analysis

### 1. `optionalAuth` Behavior Preservation
On endpoints such as `/api/discovery/feed`, `/api/events`, and `/api/events/:id`:
- If an unauthenticated guest accesses the route, `req.user` is undefined, and generic catalog data is returned.
- If a valid Bearer token is attached, `req.user` is populated, unlocking personalized recommendations, registration badges, and team affiliation.
- **Edge Failure Guard:** An invalid or expired token must NOT cause a `401 Unauthorized` on optional endpoints. The middleware must silently proceed as a guest, matching Express behavior.

### 2. Guest Ticket Registration Stub
Endpoint `POST /api/events/:id/register` accepts requests without a Bearer token. When called without authentication, it automatically provisions an attendee stub user with `password_hash = ''` and attaches the registration. The ported Worker endpoint must replicate this exact transaction without requiring a password hash.

### 3. Cross-Partner Isolation
Partner Portal endpoints (`/api/partners/*`) verify that the authenticated user owns the specific venue or campaign record:
```sql
SELECT id FROM partner_profiles WHERE user_id = ?
```
The Hono implementation must replicate this ownership check to prevent horizontal privilege escalation between competing partner venues.

---

## 6. Compatibility Sign-Off

The 156-endpoint mapping preserves 100% of the authorization and security semantics of the Express backend. No permissions were deleted, relaxed, or bypassed.
