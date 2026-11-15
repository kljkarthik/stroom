# STROOM — Phase 2.5.0: API Migration Execution Plan

**Project:** `D:\ST`  
**Branch:** `feature/stroom-production-launch`  
**Approved Baseline Commit:** `19c4176`  
**Document Version:** 1.0.0 (Authoritative API Migration Execution Plan)  
**Security Classification:** System Integration Specification  
**Mode:** STRICT PLANNING ONLY (Zero code, schema, data, or infrastructure modifications)

---

## 1. Executive Summary & Catalog Methodology

This plan governs the migration of all **156 verified API endpoints** in STROOM from the existing Node.js + Express backend to Cloudflare Workers + Hono.

To ensure zero service disruption, endpoints are organized into **8 functional migration waves** based on business dependency and data mutability:
- **Wave 1:** System Health & Public Read-Only Catalog (10 endpoints)
- **Wave 2:** User Profile, Preferences & Passport (11 endpoints)
- **Wave 3:** Communities, Clubs & Member Engagement (8 endpoints)
- **Wave 4:** Sports Facilities, Availability & Court Bookings (7 endpoints)
- **Wave 5:** Digital Passes, Check-in & Verification (4 endpoints)
- **Wave 6:** Live Sports Auctions & Real-Time Bidding (12 endpoints)
- **Wave 7:** Partner Portal & Venue Operations (28 endpoints)
- **Wave 8:** Admin CMS, Quiz Engine, Governance & System Management (76 endpoints)

For every single endpoint, the specification defines:
- **Express Source Route** vs **Target Hono Route**
- **Authentication Requirement** (`Public`, `Optional`, `Required`)
- **RBAC Role Requirement** (e.g. `all`, `member`, `partner_staff`, `admin`, `staff`)
- **Database Tables Accessed** (Read / Write)
- **Transaction Requirements** (`Read-only`, `Single write`, `Atomic D1 batch`)
- **Test Coverage Requirement**
- **Rollback Route** (Express origin fallback)

---

## 2. Complete 156-Endpoint Migration Catalog

### Wave 1: System Health & Public Read-Only Catalog (10 Endpoints)

| # | Existing Express Route | Target Hono Route | Auth | RBAC | Tables Accessed | Transaction | Test Coverage | Rollback Route |
|---|---|---|---|---|---|---|---|---|
| **1** | `GET /api/health` | `GET /api/health` | Public | None | None | None | Status 200 probe | `http://auth-origin:5000/api/health` |
| **75** | `GET /api/events` | `GET /api/events` | Optional | All / Guest | `events`, `venues`, `event_registrations` | Read-only | Query filter & sort | `http://auth-origin:5000/api/events` |
| **76** | `GET /api/events/featured` | `GET /api/events/featured` | Public | None | `events`, `venues` | Read-only | Featured flag verification | `http://auth-origin:5000/api/events/featured` |
| **77** | `GET /api/events/cities` | `GET /api/events/cities` | Public | None | `cities`, `events` | Read-only | Distinct cities count | `http://auth-origin:5000/api/events/cities` |
| **78** | `GET /api/events/:id` | `GET /api/events/:id` | Optional | All / Guest | `events`, `venues`, `tickets` | Read-only | 404 on missing, detail match | `http://auth-origin:5000/api/events/:id` |
| **79** | `POST /api/events/:id/register` | `POST /api/events/:id/register` | Required | `member` | `event_registrations`, `events` | Atomic write | Seat decrement, duplicate check | `http://auth-origin:5000/api/events/:id/register` |
| **81** | `GET /api/contact/faqs` | `GET /api/contact/faqs` | Public | None | `faqs` | Read-only | FAQ ordering and status | `http://auth-origin:5000/api/contact/faqs` |
| **82** | `POST /api/contact/feedback` | `POST /api/contact/feedback` | Optional | All / Guest | `feedback` | Single write | Field validation, rate limit | `http://auth-origin:5000/api/contact/feedback` |
| **83** | `GET /api/onboarding/quiz` | `GET /api/onboarding/quiz` | Public | None | `quizzes`, `quiz_questions`, `quiz_options` | Read-only | Published version query | `http://auth-origin:5000/api/onboarding/quiz` |
| **140** | `GET /api/passes/verify/:token` | `GET /api/passes/verify/:token` | Public | None | `passes`, `events`, `users` | Read-only | Token decoding, status probe | `http://auth-origin:5000/api/passes/verify/:token` |

---

### Wave 2: User Profile, Preferences & Passport (11 Endpoints)

| # | Existing Express Route | Target Hono Route | Auth | RBAC | Tables Accessed | Transaction | Test Coverage | Rollback Route |
|---|---|---|---|---|---|---|---|---|
| **143** | `GET /api/users/me/preferences` | `GET /api/users/me/preferences` | Required | `member` | `user_preferences` | Read-only | Default fallback, match user | `http://auth-origin:5000/api/users/me/preferences` |
| **144** | `PUT /api/users/me/preferences` | `PUT /api/users/me/preferences` | Required | `member` | `user_preferences` | Single write | Upsert preference payload | `http://auth-origin:5000/api/users/me/preferences` |
| **145** | `GET /api/users/me/profile` | `GET /api/users/me/profile` | Required | `member` | `users`, `user_profiles` | Read-only | Join user + profile data | `http://auth-origin:5000/api/users/me/profile` |
| **146** | `PUT /api/users/me/profile` | `PUT /api/users/me/profile` | Required | `member` | `users`, `user_profiles` | Single write | Validation, partial updates | `http://auth-origin:5000/api/users/me/profile` |
| **147** | `POST /api/users/me/change-password` | Proxied to Express | Required | `member` | `users` | Express scrypt | Password verification, bridge | `http://auth-origin:5000/api/auth/change-password` |
| **148** | `GET /api/users/me/passport` | `GET /api/users/me/passport` | Required | `member` | `passport_stamps`, `badges`, `events` | Read-only | Aggregated stamp collection | `http://auth-origin:5000/api/users/me/passport` |
| **149** | `GET /api/users/me/notifications` | `GET /api/users/me/notifications` | Required | `member` | `notifications` | Read-only | Unread ordering, pagination | `http://auth-origin:5000/api/users/me/notifications` |
| **150** | `PATCH /api/users/me/notifications/:id/read` | `PATCH /api/users/me/notifications/:id/read` | Required | `member` | `notifications` | Single write | Owner check, mark read | `http://auth-origin:5000/api/users/me/notifications/:id/read` |
| **151** | `POST /api/users/me/notifications/mark-all-read` | `POST /api/users/me/notifications/mark-all-read` | Required | `member` | `notifications` | Single write | Bulk update by user_id | `http://auth-origin:5000/api/users/me/notifications/mark-all-read` |
| **152** | `GET /api/users/public/:memberIdOrId` | `GET /api/users/public/:memberIdOrId` | Public | None | `users`, `user_profiles` | Read-only | Privacy filter (omit email/phone) | `http://auth-origin:5000/api/users/public/:memberIdOrId` |
| **156** | `PUT /api/users/admin/members/:id/role` | `PUT /api/users/admin/members/:id/role` | Required | `admin` | `users`, `audit_logs` | Atomic D1 batch | In-isolate cache eviction, audit log | `http://auth-origin:5000/api/users/admin/members/:id/role` |

---

### Wave 3: Communities, Clubs & Member Engagement (8 Endpoints)

| # | Existing Express Route | Target Hono Route | Auth | RBAC | Tables Accessed | Transaction | Test Coverage | Rollback Route |
|---|---|---|---|---|---|---|---|---|
| **84** | `GET /api/communities` | `GET /api/communities` | Optional | All / Guest | `communities`, `community_members` | Read-only | Member count aggregation | `http://auth-origin:5000/api/communities` |
| **85** | `POST /api/communities` | `POST /api/communities` | Required | `member` | `communities`, `community_members` | Atomic D1 batch | Creator auto-joined as lead | `http://auth-origin:5000/api/communities` |
| **86** | `GET /api/communities/:id` | `GET /api/communities/:id` | Optional | All / Guest | `communities`, `venues` | Read-only | Details + membership status | `http://auth-origin:5000/api/communities/:id` |
| **87** | `PUT /api/communities/:id` | `PUT /api/communities/:id` | Required | `moderator`, `admin` | `communities` | Single write | Owner / moderator validation | `http://auth-origin:5000/api/communities/:id` |
| **88** | `POST /api/communities/:id/join` | `POST /api/communities/:id/join` | Required | `member` | `community_members` | Single write | Duplicate join prevention | `http://auth-origin:5000/api/communities/:id/join` |
| **89** | `POST /api/communities/:id/leave` | `POST /api/communities/:id/leave` | Required | `member` | `community_members` | Single write | Leave membership removal | `http://auth-origin:5000/api/communities/:id/leave` |
| **90** | `GET /api/communities/:id/members` | `GET /api/communities/:id/members` | Required | `member` | `community_members`, `users` | Read-only | Member roster pagination | `http://auth-origin:5000/api/communities/:id/members` |
| **91** | `GET /api/communities/:id/events` | `GET /api/communities/:id/events` | Optional | All / Guest | `events`, `communities` | Read-only | Community-specific events | `http://auth-origin:5000/api/communities/:id/events` |

---

### Wave 4: Sports Facilities, Availability & Court Bookings (7 Endpoints)

| # | Existing Express Route | Target Hono Route | Auth | RBAC | Tables Accessed | Transaction | Test Coverage | Rollback Route |
|---|---|---|---|---|---|---|---|---|
| **92** | `GET /api/sports/categories` | `GET /api/sports/categories` | Public | None | `sports_categories` | Read-only | Category listing & icons | `http://auth-origin:5000/api/sports/categories` |
| **93** | `GET /api/sports/facilities` | `GET /api/sports/facilities` | Optional | All / Guest | `facilities`, `venues` | Read-only | Filter by sport, city | `http://auth-origin:5000/api/sports/facilities` |
| **94** | `GET /api/sports/facilities/:id` | `GET /api/sports/facilities/:id` | Optional | All / Guest | `facilities`, `courts` | Read-only | Courts listing & amenities | `http://auth-origin:5000/api/sports/facilities/:id` |
| **95** | `GET /api/sports/facilities/:id/availability` | `GET /api/sports/facilities/:id/availability` | Public | None | `court_slots`, `bookings` | Read-only | Slot availability matrix | `http://auth-origin:5000/api/sports/facilities/:id/availability` |
| **96** | `POST /api/sports/bookings` | `POST /api/sports/bookings` | Required | `member` | `bookings`, `court_slots` | Atomic D1 batch | Concurrency lock, slot claim | `http://auth-origin:5000/api/sports/bookings` |
| **97** | `GET /api/sports/bookings/my` | `GET /api/sports/bookings/my` | Required | `member` | `bookings`, `facilities` | Read-only | User booking history | `http://auth-origin:5000/api/sports/bookings/my` |
| **98** | `POST /api/sports/bookings/:id/cancel` | `POST /api/sports/bookings/:id/cancel` | Required | `member` | `bookings`, `court_slots` | Atomic D1 batch | Cancellation policy check | `http://auth-origin:5000/api/sports/bookings/:id/cancel` |

---

### Wave 5: Digital Passes, Check-in & Verification (4 Endpoints)

| # | Existing Express Route | Target Hono Route | Auth | RBAC | Tables Accessed | Transaction | Test Coverage | Rollback Route |
|---|---|---|---|---|---|---|---|---|
| **80** | `GET /api/events/:id/attendees` | `GET /api/events/:id/attendees` | Required | `event_organizer`, `staff` | `event_registrations`, `users` | Read-only | Organizer authorization | `http://auth-origin:5000/api/events/:id/attendees` |
| **139** | `GET /api/passes/my-passes` | `GET /api/passes/my-passes` | Required | `member` | `passes`, `events`, `venues` | Read-only | Active passes filtering | `http://auth-origin:5000/api/passes/my-passes` |
| **141** | `POST /api/passes/check-in` | `POST /api/passes/check-in` | Required | `event_organizer`, `staff` | `passes`, `checkins`, `users` | Atomic D1 batch | One-time check-in idempotency | `http://auth-origin:5000/api/passes/check-in` |
| **142** | `POST /api/passes/:id/cancel` | `POST /api/passes/:id/cancel` | Required | `member` | `passes`, `events` | Atomic D1 batch | Refund / cancel logic | `http://auth-origin:5000/api/passes/:id/cancel` |

---

### Wave 6: Live Sports Auctions & Real-Time Bidding (12 Endpoints)

| # | Existing Express Route | Target Hono Route | Auth | RBAC | Tables Accessed | Transaction | Test Coverage | Rollback Route |
|---|---|---|---|---|---|---|---|---|
| **99** | `GET /api/auctions` | `GET /api/auctions` | Optional | All / Guest | `auctions`, `teams` | Read-only | Status filter (live, past) | `http://auth-origin:5000/api/auctions` |
| **100** | `GET /api/auctions/:id` | `GET /api/auctions/:id` | Optional | All / Guest | `auctions`, `teams`, `auction_rules` | Read-only (Cached 2s) | Cache API hit & schema | `http://auth-origin:5000/api/auctions/:id` |
| **101** | `GET /api/auctions/:id/teams` | `GET /api/auctions/:id/teams` | Optional | All / Guest | `teams`, `auction_teams` | Read-only | Purse balances & roster | `http://auth-origin:5000/api/auctions/:id/teams` |
| **102** | `GET /api/auctions/:id/players` | `GET /api/auctions/:id/players` | Optional | All / Guest | `auction_players`, `teams` | Read-only | Unsold / sold roster filter | `http://auth-origin:5000/api/auctions/:id/players` |
| **103** | `GET /api/auctions/:id/current-lot` | `GET /api/auctions/:id/current-lot` | Optional | All / Guest | `auction_players`, `auctions` | Read-only (Cached 2s) | Active lot query, bids | `http://auth-origin:5000/api/auctions/:id/current-lot` |
| **104** | `GET /api/auctions/:id/bids` | `GET /api/auctions/:id/bids` | Optional | All / Guest | `auction_bids`, `teams` | Read-only | Bid timeline ordering | `http://auth-origin:5000/api/auctions/:id/bids` |
| **105** | `POST /api/auctions/:id/bid` | `POST /api/auctions/:id/bid` | Required | `auction_manager`, `member` | `auction_bids`, `auction_players`, `teams` | Atomic D1 batch | Outbid check, purse check, cache purge | `http://auth-origin:5000/api/auctions/:id/bid` |
| **106** | `POST /api/auctions/:id/pass-lot` | `POST /api/auctions/:id/pass-lot` | Required | `auction_manager` | `auction_players` | Single write | Unsold status, cache purge | `http://auth-origin:5000/api/auctions/:id/pass-lot` |
| **107** | `POST /api/auctions/:id/next-lot` | `POST /api/auctions/:id/next-lot` | Required | `auction_manager` | `auction_players` | Single write | Increment lot pointer | `http://auth-origin:5000/api/auctions/:id/next-lot` |
| **108** | `POST /api/auctions/:id/pause` | `POST /api/auctions/:id/pause` | Required | `auction_manager` | `auctions` | Single write | State transition to PAUSED | `http://auth-origin:5000/api/auctions/:id/pause` |
| **109** | `POST /api/auctions/:id/resume` | `POST /api/auctions/:id/resume` | Required | `auction_manager` | `auctions` | Single write | State transition to LIVE | `http://auth-origin:5000/api/auctions/:id/resume` |
| **110** | `GET /api/auctions/:id/analytics` | `GET /api/auctions/:id/analytics` | Required | `auction_manager`, `staff` | `auction_bids`, `teams`, `auction_players` | Read-only | Spending velocity stats | `http://auth-origin:5000/api/auctions/:id/analytics` |

---

### Wave 7: Partner Portal & Venue Management (28 Endpoints)

| # | Existing Express Route | Target Hono Route | Auth | RBAC | Tables Accessed | Transaction | Test Coverage | Rollback Route |
|---|---|---|---|---|---|---|---|---|
| **111** | `PUT /api/partners/accounts/:partnerId/profile` | `PUT /api/partners/accounts/:partnerId/profile` | Required | `partner_admin` | `partner_accounts` | Single write | Multi-tenant ID check | `http://auth-origin:5000/api/partners/accounts/:partnerId/profile` |
| **112** | `GET /api/partners/accounts/:partnerId/dashboard` | `GET /api/partners/accounts/:partnerId/dashboard` | Required | `partner_staff`, `partner_admin` | `partner_accounts`, `venues`, `campaigns` | Read-only | Aggregated dashboard stats | `http://auth-origin:5000/api/partners/accounts/:partnerId/dashboard` |
| **113** | `GET /api/partners/accounts/:partnerId/venues` | `GET /api/partners/accounts/:partnerId/venues` | Required | `partner_staff` | `venues` | Read-only | Venues owned by partner | `http://auth-origin:5000/api/partners/accounts/:partnerId/venues` |
| **114** | `POST /api/partners/accounts/:partnerId/venues` | `POST /api/partners/accounts/:partnerId/venues` | Required | `partner_admin` | `venues` | Single write | Venue creation schema | `http://auth-origin:5000/api/partners/accounts/:partnerId/venues` |
| **115** | `PUT /api/partners/accounts/:partnerId/venues/:venueId` | `PUT /api/partners/accounts/:partnerId/venues/:venueId` | Required | `partner_admin` | `venues` | Single write | Ownership verification | `http://auth-origin:5000/api/partners/accounts/:partnerId/venues/:venueId` |
| **116** | `GET /api/partners/accounts/:partnerId/venues/:venueId/availability` | `GET /api/partners/accounts/:partnerId/venues/:venueId/availability` | Required | `partner_staff` | `venue_availability` | Read-only | Calendar schedules | `http://auth-origin:5000/api/partners/accounts/:partnerId/venues/:venueId/availability` |
| **117** | `POST /api/partners/accounts/:partnerId/venues/:venueId/availability` | `POST /api/partners/accounts/:partnerId/venues/:venueId/availability` | Required | `partner_admin` | `venue_availability` | Single write | Slot blackout dates | `http://auth-origin:5000/api/partners/accounts/:partnerId/venues/:venueId/availability` |
| **118** | `GET /api/partners/accounts/:partnerId/collaborations` | `GET /api/partners/accounts/:partnerId/collaborations` | Required | `partner_staff` | `collaborations`, `events` | Read-only | Event collaboration requests | `http://auth-origin:5000/api/partners/accounts/:partnerId/collaborations` |
| **119** | `POST /api/partners/accounts/:partnerId/collaborations/:collabId/respond` | `POST /api/partners/accounts/:partnerId/collaborations/:collabId/respond` | Required | `partner_admin` | `collaborations` | Single write | Accept / reject collaboration | `http://auth-origin:5000/api/partners/accounts/:partnerId/collaborations/:collabId/respond` |
| **120** | `GET /api/partners/accounts/:partnerId/events` | `GET /api/partners/accounts/:partnerId/events` | Required | `partner_staff` | `events`, `venues` | Read-only | Associated venue events | `http://auth-origin:5000/api/partners/accounts/:partnerId/events` |
| **121** | `PATCH /api/partners/accounts/:partnerId/events/:eventId/operations` | `PATCH /api/partners/accounts/:partnerId/events/:eventId/operations` | Required | `partner_staff` | `event_operations` | Single write | Operational task updates | `http://auth-origin:5000/api/partners/accounts/:partnerId/events/:eventId/operations` |
| **122** | `GET /api/partners/accounts/:partnerId/campaigns` | `GET /api/partners/accounts/:partnerId/campaigns` | Required | `partner_staff` | `partner_campaigns` | Read-only | List promotions & campaigns | `http://auth-origin:5000/api/partners/accounts/:partnerId/campaigns` |
| **123** | `POST /api/partners/accounts/:partnerId/campaigns` | `POST /api/partners/accounts/:partnerId/campaigns` | Required | `partner_admin` | `partner_campaigns` | Single write | Create marketing campaign | `http://auth-origin:5000/api/partners/accounts/:partnerId/campaigns` |
| **124** | `PATCH /api/partners/accounts/:partnerId/campaigns/:campaignId` | `PATCH /api/partners/accounts/:partnerId/campaigns/:campaignId` | Required | `partner_admin` | `partner_campaigns` | Single write | Update campaign budget | `http://auth-origin:5000/api/partners/accounts/:partnerId/campaigns/:campaignId` |
| **125** | `POST /api/partners/coupons/verify` | `POST /api/partners/coupons/verify` | Required | `partner_staff` | `coupons`, `venues` | Read-only | Coupon validity & venue check | `http://auth-origin:5000/api/partners/coupons/verify` |
| **126** | `POST /api/partners/coupons/redeem` | `POST /api/partners/coupons/redeem` | Required | `partner_staff` | `coupons`, `coupon_redemptions` | Atomic D1 batch | Max redemptions enforcement | `http://auth-origin:5000/api/partners/coupons/redeem` |
| **127** | `GET /api/partners/accounts/:partnerId/redemptions` | `GET /api/partners/accounts/:partnerId/redemptions` | Required | `partner_staff` | `coupon_redemptions`, `coupons` | Read-only | Redemptions log & history | `http://auth-origin:5000/api/partners/accounts/:partnerId/redemptions` |
| **128** | `GET /api/partners/accounts/:partnerId/analytics` | `GET /api/partners/accounts/:partnerId/analytics` | Required | `partner_admin` | `coupon_redemptions`, `venues` | Read-only | Footfall & discount analytics | `http://auth-origin:5000/api/partners/accounts/:partnerId/analytics` |
| **129** | `GET /api/partners/accounts/:partnerId/reports/export` | `GET /api/partners/accounts/:partnerId/reports/export` | Required | `partner_admin` | `partner_accounts`, `coupons` | Read-only | CSV export generation | `http://auth-origin:5000/api/partners/accounts/:partnerId/reports/export` |
| **130** | `GET /api/partners/accounts/:partnerId/communications` | `GET /api/partners/accounts/:partnerId/communications` | Required | `partner_staff` | `partner_messages` | Read-only | Internal communication thread | `http://auth-origin:5000/api/partners/accounts/:partnerId/communications` |
| **131** | `POST /api/partners/accounts/:partnerId/communications` | `POST /api/partners/accounts/:partnerId/communications` | Required | `partner_staff` | `partner_messages` | Single write | Send message to admin/staff | `http://auth-origin:5000/api/partners/accounts/:partnerId/communications` |
| **132** | `PATCH /api/partners/accounts/:partnerId/communications/:msgId/read` | `PATCH /api/partners/accounts/:partnerId/communications/:msgId/read` | Required | `partner_staff` | `partner_messages` | Single write | Mark message as read | `http://auth-origin:5000/api/partners/accounts/:partnerId/communications/:msgId/read` |
| **133** | `GET /api/partners/admin/overview` | `GET /api/partners/admin/overview` | Required | `admin`, `staff` | `partner_accounts`, `venues` | Read-only | Admin view of all partners | `http://auth-origin:5000/api/partners/admin/overview` |
| **134** | `GET /api/partners/admin/:partnerId/details` | `GET /api/partners/admin/:partnerId/details` | Required | `admin`, `staff` | `partner_accounts`, `venues`, `users` | Read-only | Full partner audit profile | `http://auth-origin:5000/api/partners/admin/:partnerId/details` |
| **135** | `POST /api/partners/admin/:partnerId/verify` | `POST /api/partners/admin/:partnerId/verify` | Required | `admin` | `partner_accounts` | Single write | Set partner verified = 1 | `http://auth-origin:5000/api/partners/admin/:partnerId/verify` |
| **136** | `POST /api/partners/admin/collaborations` | `POST /api/partners/admin/collaborations` | Required | `staff`, `admin` | `collaborations` | Single write | Initiate collaboration offer | `http://auth-origin:5000/api/partners/admin/collaborations` |
| **137** | `POST /api/partners/admin/collaborations/:collabId/confirm` | `POST /api/partners/admin/collaborations/:collabId/confirm` | Required | `admin` | `collaborations` | Single write | Admin sign-off on partner deal | `http://auth-origin:5000/api/partners/admin/collaborations/:collabId/confirm` |
| **138** | `POST /api/partners/admin/campaigns/:campaignId/review` | `POST /api/partners/admin/campaigns/:campaignId/review` | Required | `admin`, `staff` | `partner_campaigns` | Single write | Approve / reject promotion | `http://auth-origin:5000/api/partners/admin/campaigns/:campaignId/review` |

---

### Wave 8: Admin CMS, Quiz Engine, Governance & System Management (76 Endpoints)

| # | Existing Express Route | Target Hono Route | Auth | RBAC | Tables Accessed | Transaction | Test Coverage | Rollback Route |
|---|---|---|---|---|---|---|---|---|
| **2** | `GET /api/admin/overview` | `GET /api/admin/overview` | Required | `admin`, `staff` | `users`, `events`, `bookings`, `auctions` | Read-only | Key metrics summary | `http://auth-origin:5000/api/admin/overview` |
| **3** | `GET /api/admin/quizzes` | `GET /api/admin/quizzes` | Required | `admin`, `staff` | `quizzes`, `quiz_versions` | Read-only | List quizzes & versions | `http://auth-origin:5000/api/admin/quizzes` |
| **4** | `GET /api/admin/versions/:versionId` | `GET /api/admin/versions/:versionId` | Required | `admin`, `staff` | `quiz_versions`, `quiz_questions` | Read-only | Full question tree | `http://auth-origin:5000/api/admin/versions/:versionId` |
| **5** | `POST /api/admin/quizzes/:quizId/create-draft` | `POST /api/admin/quizzes/:quizId/create-draft` | Required | `admin` | `quiz_versions`, `quiz_questions`, `quiz_options` | Atomic D1 batch | Deep copy question graph | `http://auth-origin:5000/api/admin/quizzes/:quizId/create-draft` |
| **6** | `POST /api/admin/questions` | `POST /api/admin/questions` | Required | `admin` | `quiz_questions` | Single write | Question creation & order | `http://auth-origin:5000/api/admin/questions` |
| **7** | `PATCH /api/admin/questions/:id` | `PATCH /api/admin/questions/:id` | Required | `admin` | `quiz_questions` | Single write | Text & metadata update | `http://auth-origin:5000/api/admin/questions/:id` |
| **8** | `DELETE /api/admin/questions/:id` | `DELETE /api/admin/questions/:id` | Required | `admin` | `quiz_questions`, `quiz_options` | Atomic D1 batch | Cascade option deletion | `http://auth-origin:5000/api/admin/questions/:id` |
| **9** | `POST /api/admin/questions/reorder` | `POST /api/admin/questions/reorder` | Required | `admin` | `quiz_questions` | Atomic D1 batch | Batch order index updates | `http://auth-origin:5000/api/admin/questions/reorder` |
| **10** | `POST /api/admin/questions/:questionId/options` | `POST /api/admin/questions/:questionId/options` | Required | `admin` | `quiz_options` | Single write | Option insertion & traits | `http://auth-origin:5000/api/admin/questions/:questionId/options` |
| **11** | `PATCH /api/admin/options/:id` | `PATCH /api/admin/options/:id` | Required | `admin` | `quiz_options` | Single write | Trait weights update | `http://auth-origin:5000/api/admin/options/:id` |
| **12** | `DELETE /api/admin/options/:id` | `DELETE /api/admin/options/:id` | Required | `admin` | `quiz_options` | Single write | Remove option row | `http://auth-origin:5000/api/admin/options/:id` |
| **13** | `POST /api/admin/versions/:versionId/publish` | `POST /api/admin/versions/:versionId/publish` | Required | `admin` | `quiz_versions`, `quizzes` | Atomic D1 batch | Unpublish previous, activate | `http://auth-origin:5000/api/admin/versions/:versionId/publish` |
| **14** | `GET /api/admin/me/permissions` | `GET /api/admin/me/permissions` | Required | `admin`, `staff` | `user_roles`, `role_permissions` | Read-only | Resolved permission matrix | `http://auth-origin:5000/api/admin/me/permissions` |
| **15** | `GET /api/admin/global-search` | `GET /api/admin/global-search` | Required | `admin`, `staff` | `users`, `events`, `venues` | Read-only | Multi-entity LIKE search | `http://auth-origin:5000/api/admin/global-search` |
| **16** | `GET /api/admin/dashboard-overview` | `GET /api/admin/dashboard-overview` | Required | `admin`, `staff` | `events`, `users`, `bookings` | Read-only | 30-day growth trends | `http://auth-origin:5000/api/admin/dashboard-overview` |
| **17** | `GET /api/admin/overview-analytics` | `GET /api/admin/overview-analytics` | Required | `admin`, `staff` | `analytics_events` | Read-only | Funnel conversions | `http://auth-origin:5000/api/admin/overview-analytics` |
| **18** | `GET /api/admin/events` | `GET /api/admin/events` | Required | `admin`, `staff` | `events`, `venues` | Read-only | Admin full event list | `http://auth-origin:5000/api/admin/events` |
| **19** | `POST /api/admin/events` | `POST /api/admin/events` | Required | `admin`, `staff` | `events` | Single write | Create event validation | `http://auth-origin:5000/api/admin/events` |
| **20** | `PUT /api/admin/events/:id` | `PUT /api/admin/events/:id` | Required | `admin`, `staff` | `events` | Single write | Update event details | `http://auth-origin:5000/api/admin/events/:id` |
| **21** | `POST /api/admin/events/:id/duplicate` | `POST /api/admin/events/:id/duplicate` | Required | `admin` | `events`, `tickets` | Atomic D1 batch | Clone event & ticket tiers | `http://auth-origin:5000/api/admin/events/:id/duplicate` |
| **22** | `GET /api/admin/events/:id/dependencies` | `GET /api/admin/events/:id/dependencies` | Required | `admin` | `event_registrations`, `passes` | Read-only | Safe delete dependency check | `http://auth-origin:5000/api/admin/events/:id/dependencies` |
| **23** | `DELETE /api/admin/events/:id` | `DELETE /api/admin/events/:id` | Required | `admin` | `events`, `tickets` | Atomic D1 batch | Soft-delete / safe delete | `http://auth-origin:5000/api/admin/events/:id` |
| **24** | `GET /api/admin/registrations` | `GET /api/admin/registrations` | Required | `admin`, `staff` | `event_registrations`, `events` | Read-only | Global registrations list | `http://auth-origin:5000/api/admin/registrations` |
| **25** | `PATCH /api/admin/registrations/:id` | `PATCH /api/admin/registrations/:id` | Required | `admin`, `staff` | `event_registrations` | Single write | Status update (confirmed/cancelled) | `http://auth-origin:5000/api/admin/registrations/:id` |
| **26** | `GET /api/admin/cities` | `GET /api/admin/cities` | Required | `admin`, `staff` | `cities` | Read-only | List managed cities | `http://auth-origin:5000/api/admin/cities` |
| **27** | `POST /api/admin/cities` | `POST /api/admin/cities` | Required | `admin` | `cities` | Single write | Create city record | `http://auth-origin:5000/api/admin/cities` |
| **28** | `PUT /api/admin/cities/:id` | `PUT /api/admin/cities/:id` | Required | `admin` | `cities` | Single write | Update city metadata | `http://auth-origin:5000/api/admin/cities/:id` |
| **29** | `GET /api/admin/members-directory` | `GET /api/admin/members-directory` | Required | `admin`, `staff` | `users`, `user_profiles` | Read-only | Full member list & search | `http://auth-origin:5000/api/admin/members-directory` |
| **30** | `PATCH /api/admin/members/:id/status` | `PATCH /api/admin/members/:id/status` | Required | `admin` | `users`, `audit_logs` | Atomic D1 batch | Suspend/activate, evict cache | `http://auth-origin:5000/api/admin/members/:id/status` |
| **31** | `PATCH /api/admin/members/:id/role` | `PATCH /api/admin/members/:id/role` | Required | `admin` | `users`, `audit_logs` | Atomic D1 batch | Assign system role, evict cache | `http://auth-origin:5000/api/admin/members/:id/role` |
| **32** | `GET /api/admin/roles-matrix` | `GET /api/admin/roles-matrix` | Required | `admin` | `role_permissions` | Read-only | Full RBAC permissions table | `http://auth-origin:5000/api/admin/roles-matrix` |
| **33** | `GET /api/admin/communities` | `GET /api/admin/communities` | Required | `admin`, `staff` | `communities` | Read-only | Communities admin list | `http://auth-origin:5000/api/admin/communities` |
| **34** | `POST /api/admin/communities` | `POST /api/admin/communities` | Required | `admin` | `communities` | Single write | Official community creation | `http://auth-origin:5000/api/admin/communities` |
| **35** | `PUT /api/admin/communities/:id` | `PUT /api/admin/communities/:id` | Required | `admin` | `communities` | Single write | Update community settings | `http://auth-origin:5000/api/admin/communities/:id` |
| **36** | `GET /api/admin/communities/:id/members` | `GET /api/admin/communities/:id/members` | Required | `admin`, `staff` | `community_members`, `users` | Read-only | Community members roster | `http://auth-origin:5000/api/admin/communities/:id/members` |
| **37** | `GET /api/admin/auctions` | `GET /api/admin/auctions` | Required | `admin`, `staff` | `auctions`, `teams` | Read-only | Auctions list & budgets | `http://auth-origin:5000/api/admin/auctions` |
| **38** | `POST /api/admin/auctions` | `POST /api/admin/auctions` | Required | `admin` | `auctions` | Single write | Create tournament auction | `http://auth-origin:5000/api/admin/auctions` |
| **39** | `GET /api/admin/venues` | `GET /api/admin/venues` | Required | `admin`, `staff` | `venues` | Read-only | All partner & verified venues | `http://auth-origin:5000/api/admin/venues` |
| **40** | `PATCH /api/admin/venues/:id/verify` | `PATCH /api/admin/venues/:id/verify` | Required | `admin` | `venues` | Single write | Toggle venue verified flag | `http://auth-origin:5000/api/admin/venues/:id/verify` |
| **41** | `GET /api/admin/checkin/events` | `GET /api/admin/checkin/events` | Required | `admin`, `staff` | `events` | Read-only | Active check-in events | `http://auth-origin:5000/api/admin/checkin/events` |
| **42** | `GET /api/admin/checkin/search` | `GET /api/admin/checkin/search` | Required | `admin`, `staff` | `passes`, `users`, `events` | Read-only | Rapid ticket/name search | `http://auth-origin:5000/api/admin/checkin/search` |
| **43** | `POST /api/admin/checkin/manual` | `POST /api/admin/checkin/manual` | Required | `admin`, `staff` | `passes`, `checkins` | Atomic D1 batch | Staff override check-in | `http://auth-origin:5000/api/admin/checkin/manual` |
| **44** | `GET /api/admin/checkin/stats` | `GET /api/admin/checkin/stats` | Required | `admin`, `staff` | `checkins`, `passes` | Read-only | Real-time entry counts | `http://auth-origin:5000/api/admin/checkin/stats` |
| **45** | `GET /api/admin/reports/summary` | `GET /api/admin/reports/summary` | Required | `admin` | `events`, `users`, `bookings` | Read-only | Executive report summary | `http://auth-origin:5000/api/admin/reports/summary` |
| **46** | `GET /api/admin/reports/export` | `GET /api/admin/reports/export` | Required | `admin` | `events`, `registrations`, `users` | Read-only | CSV export generation | `http://auth-origin:5000/api/admin/reports/export` |
| **47** | `GET /api/admin/cms/banners` | `GET /api/admin/cms/banners` | Required | `admin`, `staff` | `cms_banners` | Read-only | Hero promotional banners | `http://auth-origin:5000/api/admin/cms/banners` |
| **48** | `POST /api/admin/cms/banners` | `POST /api/admin/cms/banners` | Required | `admin` | `cms_banners` | Single write | Add promotional banner | `http://auth-origin:5000/api/admin/cms/banners` |
| **49** | `PUT /api/admin/cms/banners/:id` | `PUT /api/admin/cms/banners/:id` | Required | `admin` | `cms_banners` | Single write | Update banner scheduling | `http://auth-origin:5000/api/admin/cms/banners/:id` |
| **50** | `DELETE /api/admin/cms/banners/:id` | `DELETE /api/admin/cms/banners/:id` | Required | `admin` | `cms_banners` | Single write | Delete promotional banner | `http://auth-origin:5000/api/admin/cms/banners/:id` |
| **51** | `GET /api/admin/audit-logs` | `GET /api/admin/audit-logs` | Required | `admin` | `audit_logs`, `users` | Read-only | System audit trail | `http://auth-origin:5000/api/admin/audit-logs` |
| **52** | `GET /api/admin/feedback` | `GET /api/admin/feedback` | Required | `admin`, `staff` | `feedback`, `users` | Read-only | User feedback inbox | `http://auth-origin:5000/api/admin/feedback` |
| **53** | `PATCH /api/admin/feedback/:id/status` | `PATCH /api/admin/feedback/:id/status` | Required | `admin`, `staff` | `feedback` | Single write | Mark feedback resolved | `http://auth-origin:5000/api/admin/feedback/:id/status` |
| **54** | `GET /api/admin/faqs` | `GET /api/admin/faqs` | Required | `admin`, `staff` | `faqs` | Read-only | Full FAQ list & order | `http://auth-origin:5000/api/admin/faqs` |
| **55** | `POST /api/admin/faqs` | `POST /api/admin/faqs` | Required | `admin` | `faqs` | Single write | Add new FAQ entry | `http://auth-origin:5000/api/admin/faqs` |
| **56** | `PUT /api/admin/faqs/:id` | `PUT /api/admin/faqs/:id` | Required | `admin` | `faqs` | Single write | Edit FAQ question & text | `http://auth-origin:5000/api/admin/faqs/:id` |
| **57** | `DELETE /api/admin/faqs/:id` | `DELETE /api/admin/faqs/:id` | Required | `admin` | `faqs` | Single write | Remove FAQ entry | `http://auth-origin:5000/api/admin/faqs/:id` |
| **58** | `GET /api/admin/settings` | `GET /api/admin/settings` | Required | `admin` | `system_settings` | Read-only | Platform config settings | `http://auth-origin:5000/api/admin/settings` |
| **59** | `PUT /api/admin/settings` | `PUT /api/admin/settings` | Required | `admin` | `system_settings` | Atomic D1 batch | Update platform config | `http://auth-origin:5000/api/admin/settings` |
| **60** | `GET /api/admin/sports/bookings` | `GET /api/admin/sports/bookings` | Required | `admin`, `staff` | `bookings`, `facilities` | Read-only | Global bookings overview | `http://auth-origin:5000/api/admin/sports/bookings` |
| **61** | `PATCH /api/admin/sports/bookings/:id` | `PATCH /api/admin/sports/bookings/:id` | Required | `admin`, `staff` | `bookings`, `court_slots` | Atomic D1 batch | Admin booking cancellation | `http://auth-origin:5000/api/admin/sports/bookings/:id` |
| **62** | `GET /api/admin/sports/facilities` | `GET /api/admin/sports/facilities` | Required | `admin`, `staff` | `facilities`, `venues` | Read-only | All sports facilities | `http://auth-origin:5000/api/admin/sports/facilities` |
| **63** | `POST /api/admin/sports/facilities` | `POST /api/admin/sports/facilities` | Required | `admin` | `facilities` | Single write | Create sports facility | `http://auth-origin:5000/api/admin/sports/facilities` |
| **64** | `PUT /api/admin/sports/facilities/:id` | `PUT /api/admin/sports/facilities/:id` | Required | `admin` | `facilities` | Single write | Update facility amenities | `http://auth-origin:5000/api/admin/sports/facilities/:id` |
| **65** | `DELETE /api/admin/sports/facilities/:id` | `DELETE /api/admin/sports/facilities/:id` | Required | `admin` | `facilities`, `courts` | Atomic D1 batch | Delete sports facility | `http://auth-origin:5000/api/admin/sports/facilities/:id` |
| **66** | `GET /api/admin/sports/courts` | `GET /api/admin/sports/courts` | Required | `admin`, `staff` | `courts`, `facilities` | Read-only | All facility courts | `http://auth-origin:5000/api/admin/sports/courts` |
| **67** | `POST /api/admin/sports/courts` | `POST /api/admin/sports/courts` | Required | `admin` | `courts` | Single write | Create court within facility | `http://auth-origin:5000/api/admin/sports/courts` |
| **68** | `PUT /api/admin/sports/courts/:id` | `PUT /api/admin/sports/courts/:id` | Required | `admin` | `courts` | Single write | Update court hourly rate | `http://auth-origin:5000/api/admin/sports/courts/:id` |
| **69** | `DELETE /api/admin/sports/courts/:id` | `DELETE /api/admin/sports/courts/:id` | Required | `admin` | `courts` | Single write | Delete court | `http://auth-origin:5000/api/admin/sports/courts/:id` |
| **70** | `GET /api/admin/passport/badges` | `GET /api/admin/passport/badges` | Required | `admin`, `staff` | `badges` | Read-only | All passport badges | `http://auth-origin:5000/api/admin/passport/badges` |
| **71** | `POST /api/admin/passport/badges` | `POST /api/admin/passport/badges` | Required | `admin` | `badges` | Single write | Create passport badge | `http://auth-origin:5000/api/admin/passport/badges` |
| **72** | `PUT /api/admin/passport/badges/:id` | `PUT /api/admin/passport/badges/:id` | Required | `admin` | `badges` | Single write | Update badge criteria | `http://auth-origin:5000/api/admin/passport/badges/:id` |
| **73** | `DELETE /api/admin/passport/badges/:id` | `DELETE /api/admin/passport/badges/:id` | Required | `admin` | `badges` | Single write | Delete passport badge | `http://auth-origin:5000/api/admin/passport/badges/:id` |
| **74** | `POST /api/admin/passport/awards` | `POST /api/admin/passport/awards` | Required | `admin`, `staff` | `user_badges`, `notifications` | Atomic D1 batch | Grant badge to member | `http://auth-origin:5000/api/admin/passport/awards` |
| **153** | `GET /api/users/admin/members` | `GET /api/users/admin/members` | Required | `admin`, `staff` | `users`, `user_profiles` | Read-only | Filtered member search | `http://auth-origin:5000/api/users/admin/members` |
| **154** | `GET /api/users/admin/members/:id/details` | `GET /api/users/admin/members/:id/details` | Required | `admin`, `staff` | `users`, `user_profiles`, `passes` | Read-only | Full profile & registration history | `http://auth-origin:5000/api/users/admin/members/:id/details` |
| **155** | `POST /api/users/admin/members/:id/award-achievement` | `POST /api/users/admin/members/:id/award-achievement` | Required | `admin`, `staff` | `user_achievements`, `notifications` | Atomic D1 batch | Direct achievement award | `http://auth-origin:5000/api/users/admin/members/:id/award-achievement` |

---

## 3. Migration Wave Execution Sequence

The migration of these 156 endpoints must be executed sequentially:
1. **Wave 1 (Public & Health):** Deployed first to establish edge routing and D1 read connectivity.
2. **Wave 2 (User Profiles):** Validates authenticated edge reads and D1 user data integrity.
3. **Wave 3 (Communities):** Tests member interaction and community membership logic.
4. **Wave 4 (Sports Facilities):** Tests complex slot availability queries.
5. **Wave 5 (Passes & Check-in):** Validates atomic check-in transactions and QR token decoding.
6. **Wave 6 (Auctions):** Tests 2-second Cloudflare Cache API polling and instantaneous bid cache purges.
7. **Wave 7 (Partner Operations):** Validates multi-tenant scoping and coupon redemption transactions.
8. **Wave 8 (Admin CMS):** Migrates high-privilege administrative routes with strict fail-closed authorization.
