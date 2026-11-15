-- ==============================================================================
-- STROOM (Strangers Room) — Essential Platform Metadata Migration
-- Migration: 0002_essential_metadata.sql
-- Database Target: Cloudflare D1 (SQLite Dialect)
-- Purpose: Foundational regional metadata, badge rules & default system configuration
-- ZERO DEMO USERS • ZERO FAKE EVENTS • ZERO SYNTHETIC TRANSACTIONS
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Initial Regional Launch Hubs (Cities)
-- ------------------------------------------------------------------------------
INSERT OR IGNORE INTO cities (id, name, state, is_active, launch_order, tagline, description, image_url, is_featured)
VALUES
  (
    'city_hyd',
    'Hyderabad',
    'Telangana',
    1,
    1,
    'Flagship Launch Hub • Jubilee Hills & Gachibowli',
    'Flagship STROOM Launch City — Cricket Auctions, Cafés & Founders Circles',
    'https://images.unsplash.com/photo-1588416936097-41850ab3d86d?w=800&auto=format&fit=crop&q=80',
    1
  ),
  (
    'city_pune',
    'Pune',
    'Maharashtra',
    1,
    2,
    'Premier Expansion Hub • FC Road & Koregaon Park',
    'Premier Expansion Hub — Heritage Cafés, Gaming & Sahyadri Trails',
    'https://images.unsplash.com/photo-1567157577867-05ccb1388e66?w=800&auto=format&fit=crop&q=80',
    1
  ),
  (
    'city_blr',
    'Bangalore',
    'Karnataka',
    0,
    3,
    'South Community Hub • Indiranagar & Koramangala',
    'Upcoming Expansion Hub — Tech Founders, Indie Board Games & Run Clubs',
    'https://images.unsplash.com/photo-1596176530529-78163a4f7af2?w=800&auto=format&fit=crop&q=80',
    0
  ),
  (
    'city_mum',
    'Mumbai',
    'Maharashtra',
    0,
    4,
    'Coastal Arena Hub • Bandra West & Lower Parel',
    'Upcoming Expansion Hub — Rooftop Jams, Comedy Mixers & Turf Leagues',
    'https://images.unsplash.com/photo-1570168007204-dfb528c6958f?w=800&auto=format&fit=crop&q=80',
    0
  );

-- ------------------------------------------------------------------------------
-- 2. Master Achievements Catalog (Canonical 7 Platform Achievements)
-- ------------------------------------------------------------------------------
INSERT OR IGNORE INTO achievements_master (id, badge_key, title, description, icon_name, category, points, requirement_type, requirement_threshold, is_active, created_at)
VALUES
  ('ach_first_experience', 'FIRST_EXPERIENCE', 'First Experience', 'Attended your first verified in-person STROOM meetup or event.', 'Sparkles', 'attendance', 50, 'min_attendance', 1, 1, '2026-11-11 15:24:29'),
  ('ach_explorer', 'EXPLORER', 'Category Explorer', 'Attended verified experiences across 2 or more distinct categories.', 'Compass', 'exploration', 100, 'distinct_categories', 2, 1, '2026-11-11 15:24:29'),
  ('ach_community_builder', 'COMMUNITY_BUILDER', 'Community Builder', 'Joined 2 or more local STROOM communities and social circles.', 'Users', 'community', 75, 'communities_joined', 2, 1, '2026-11-11 15:24:29'),
  ('ach_auction_strategist', 'AUCTION_STRATEGIST', 'Auction Strategist', 'Participated as bidder or franchise strategist in an interactive cricket auction.', 'Trophy', 'auction', 150, 'auction_participation', 1, 1, '2026-11-11 15:24:29'),
  ('ach_sports_enthusiast', 'SPORTS_ENTHUSIAST', 'Sports Enthusiast', 'Participated in sports tournaments or live cricket bidding formats.', 'Flame', 'sports', 80, 'sports_events', 1, 1, '2026-11-11 15:24:29'),
  ('ach_city_explorer', 'CITY_EXPLORER', 'City Explorer', 'Attended verified experiences across multiple STROOM launch cities.', 'MapPin', 'exploration', 200, 'cities_visited', 2, 1, '2026-11-11 15:24:29'),
  ('ach_pioneer_member', 'PIONEER_MEMBER', 'Pioneer Member', 'Completed full profile studio onboarding and personal discovery preferences.', 'ShieldCheck', 'identity', 50, 'profile_completed', 1, 1, '2026-11-11 15:24:29');

-- ------------------------------------------------------------------------------
-- 3. Core Platform Operational Settings (Canonical 6 Settings)
-- ------------------------------------------------------------------------------
INSERT OR IGNORE INTO platform_settings (key, category, value_json, description, updated_by, updated_at)
VALUES
  (
    'general',
    'General',
    '{"platformName":"STROOM — Strangers Room","tagline":"Strangers Today. Stories Tomorrow.","supportEmail":"hello@stroom.club","defaultCity":"Hyderabad","defaultTimezone":"Asia/Kolkata (IST)"}',
    'Core platform identity and regional defaults',
    'Vikramaditya Rao (Super Admin)',
    '2026-11-13 08:03:28'
  ),
  (
    'events',
    'Event Settings',
    '{"defaultCapacity":60,"defaultVisibility":"public","requireQrCheckinForStamps":true,"allowWaitlist":true}',
    'Default parameters for newly created experiences',
    'system',
    '2026-11-12 08:38:03'
  ),
  (
    'members',
    'Member Settings',
    '{"defaultProfilePublic":true,"requireVibeQuizOnSignup":false,"allowPublicPassportSharing":true}',
    'Member onboarding and profile defaults',
    'system',
    '2026-11-12 08:38:03'
  ),
  (
    'partners',
    'Partner Settings',
    '{"requireAdminVerification":true,"requireCampaignApproval":true,"defaultCollaborationTarget":50}',
    'Partner verification and campaign governance rules',
    'system',
    '2026-11-12 08:38:03'
  ),
  (
    'auctions',
    'Auction Settings',
    '{"defaultPurseCap":10000000,"defaultMinBidIncrement":25000,"defaultCountdownSeconds":15,"autoExtendSeconds":15}',
    'Default sports auction floor engine rules',
    'system',
    '2026-11-12 08:38:03'
  ),
  (
    'notifications',
    'Notification Settings',
    '{"inAppEnabled":true,"emailProviderStatus":"Not configured (In-App delivery active)","smsProviderStatus":"Not configured","respectMemberOptOuts":true}',
    'Messaging delivery configuration',
    'system',
    '2026-11-12 08:38:03'
  );
