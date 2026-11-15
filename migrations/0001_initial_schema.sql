-- ==============================================================================
-- STROOM (Strangers Room) — Cloudflare D1 Production Schema Migration
-- Migration: 0001_initial_schema.sql
-- Database Target: Cloudflare D1 (SQLite Dialect)
-- Characteristics: Pure Schema (0 Data Records), Foreign Keys, Repeatable DDL
-- Total Tables: 42 | Explicit Indexes: 33
-- Generated: 2026-11-13T08:22:35.766Z
-- ==============================================================================

-- Enable foreign key enforcement
PRAGMA foreign_keys = ON;

-- ------------------------------------------------------------------------------
-- Table: achievements_master
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS achievements_master (
      id TEXT PRIMARY KEY,
      badge_key TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      icon_name TEXT NOT NULL,
      category TEXT NOT NULL,
      points INTEGER NOT NULL DEFAULT 50,
      requirement_type TEXT NOT NULL,
      requirement_threshold INTEGER NOT NULL DEFAULT 1,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

-- ------------------------------------------------------------------------------
-- Table: users
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "users" (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      full_name TEXT NOT NULL,
      avatar_url TEXT,
      role TEXT NOT NULL DEFAULT 'user' ,
      onboarding_status TEXT NOT NULL DEFAULT 'NOT_STARTED' CHECK(onboarding_status IN ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    , member_id TEXT, phone TEXT, city TEXT DEFAULT 'Hyderabad', bio TEXT, display_name TEXT, first_name TEXT, last_name TEXT, cover_url TEXT, interests_json TEXT DEFAULT '[]', is_public INTEGER NOT NULL DEFAULT 1, privacy_settings_json TEXT DEFAULT '{"showCommunities":true,"showAchievements":true,"showStamps":true,"showCity":true}', notification_settings_json TEXT DEFAULT '{"eventReminders":true,"communityUpdates":true,"achievementAlerts":true,"marketing":false}', account_status TEXT NOT NULL DEFAULT 'active');

-- ------------------------------------------------------------------------------
-- Table: activity_logs
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS activity_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      activity_type TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      reference_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

-- ------------------------------------------------------------------------------
-- Table: admin_announcements
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS admin_announcements (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        target_audience TEXT NOT NULL DEFAULT 'all_members',
        target_filter TEXT,
        channel TEXT NOT NULL DEFAULT 'in_app',
        status TEXT NOT NULL DEFAULT 'sent' CHECK(status IN ('sent', 'scheduled')),
        scheduled_for TEXT,
        recipients_count INTEGER NOT NULL DEFAULT 0,
        created_by TEXT REFERENCES users(id),
        created_by_name TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

-- ------------------------------------------------------------------------------
-- Table: partner_accounts
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS partner_accounts (
        id TEXT PRIMARY KEY,
        owner_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        business_name TEXT NOT NULL,
        business_logo TEXT,
        cover_url TEXT,
        category TEXT NOT NULL DEFAULT 'Cafe & Restaurant',
        description TEXT,
        contact_person TEXT NOT NULL,
        contact_email TEXT NOT NULL,
        contact_phone TEXT,
        website TEXT,
        social_links_json TEXT DEFAULT '{}',
        city TEXT NOT NULL DEFAULT 'Hyderabad',
        address TEXT,
        maps_url TEXT,
        capacity INTEGER DEFAULT 60,
        facilities_json TEXT DEFAULT '[]',
        operating_hours_json TEXT DEFAULT '{}',
        collaboration_interests_json TEXT DEFAULT '[]',
        verification_status TEXT NOT NULL DEFAULT 'Draft' CHECK(verification_status IN ('Draft', 'Submitted', 'Under Review', 'Verified', 'Rejected', 'Suspended')),
        verification_notes TEXT,
        onboarding_step INTEGER NOT NULL DEFAULT 1,
        partnership_start_date TEXT,
        partnership_tier TEXT DEFAULT 'Community Partner',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

-- ------------------------------------------------------------------------------
-- Table: cities
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cities (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      state TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      launch_order INTEGER NOT NULL DEFAULT 1,
      tagline TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    , description TEXT, image_url TEXT, is_featured INTEGER DEFAULT 0);

-- ------------------------------------------------------------------------------
-- Table: venues
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS venues (
      id TEXT PRIMARY KEY,
      city_id TEXT NOT NULL REFERENCES cities(id) ON DELETE RESTRICT,
      name TEXT NOT NULL,
      area TEXT NOT NULL,
      address TEXT NOT NULL,
      capacity INTEGER NOT NULL DEFAULT 60,
      partner_type TEXT NOT NULL DEFAULT 'cafe', -- 'cafe', 'sports_turf', 'lounge', 'auditorium'
      contact_name TEXT NOT NULL,
      contact_email TEXT NOT NULL,
      contact_phone TEXT NOT NULL,
      is_verified INTEGER NOT NULL DEFAULT 1,
      partnership_tier TEXT NOT NULL DEFAULT 'Gold Partner',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    , partner_id TEXT REFERENCES partner_accounts(id), photos_json TEXT DEFAULT '[]', facilities_json TEXT DEFAULT '[]', event_spaces_json TEXT DEFAULT '[]', operating_hours TEXT DEFAULT '09:00 AM - 11:00 PM', accessibility_info TEXT DEFAULT 'Wheelchair accessible ground entrance & elevator access', maps_url TEXT, status TEXT DEFAULT 'active');

-- ------------------------------------------------------------------------------
-- Table: events
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      city_id TEXT NOT NULL REFERENCES cities(id) ON DELETE RESTRICT,
      venue_id TEXT NOT NULL REFERENCES venues(id) ON DELETE RESTRICT,
      title TEXT NOT NULL,
      category TEXT NOT NULL, -- 'cricket_auction', 'sports', 'gaming', 'cafe_meetup', 'movies', 'fitness', 'travel', 'creativity'
      event_date TEXT NOT NULL,
      event_time TEXT NOT NULL,
      description TEXT NOT NULL,
      seats_total INTEGER NOT NULL DEFAULT 60,
      seats_booked INTEGER NOT NULL DEFAULT 0,
      entry_fee TEXT NOT NULL DEFAULT 'Free Entry',
      status TEXT NOT NULL DEFAULT 'published', -- 'draft', 'published', 'live', 'completed', 'cancelled'
      is_flagship INTEGER NOT NULL DEFAULT 0,
      image_url TEXT NOT NULL,
      created_by TEXT REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    , partner_operational_notes TEXT, end_time TEXT, organizer_name TEXT DEFAULT 'STROOM Experiences', registration_deadline TEXT, visibility TEXT DEFAULT 'public', eligibility_requirements TEXT, is_archived INTEGER DEFAULT 0);

-- ------------------------------------------------------------------------------
-- Table: auction_rooms
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "auction_rooms" (
      id TEXT PRIMARY KEY,
      event_id TEXT UNIQUE NOT NULL REFERENCES events(id) ON DELETE RESTRICT,
      title TEXT NOT NULL,
      format_type TEXT NOT NULL DEFAULT 'stroom_premier', -- 'stroom_premier', 'rapid_draft', 'corporate_cup'
      status TEXT NOT NULL DEFAULT 'SCHEDULED', -- 'SCHEDULED', 'LIVE', 'PAUSED', 'COMPLETED'
      current_player_id TEXT,
      countdown_seconds INTEGER NOT NULL DEFAULT 15,
      auto_extend_seconds INTEGER NOT NULL DEFAULT 15,
      min_bid_increment INTEGER NOT NULL DEFAULT 25000,
      max_squad_size INTEGER NOT NULL DEFAULT 15,
      min_squad_size INTEGER NOT NULL DEFAULT 8,
      team_purse_cap INTEGER NOT NULL DEFAULT 10000000,
      rules_json TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    , description TEXT, cover_image_url TEXT, format_category TEXT DEFAULT 'ipl_mock', registration_fee TEXT DEFAULT 'Free / Included with Community Pass', registration_status TEXT DEFAULT 'open', overseas_limit INTEGER DEFAULT 4, bid_increment_slabs_json TEXT);

-- ------------------------------------------------------------------------------
-- Table: auction_teams
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS auction_teams (
      id TEXT PRIMARY KEY,
      auction_id TEXT NOT NULL REFERENCES auction_rooms(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      city TEXT NOT NULL,
      color TEXT NOT NULL,
      purse_initial INTEGER NOT NULL DEFAULT 10000000,
      purse_remaining INTEGER NOT NULL DEFAULT 10000000,
      squad_count INTEGER NOT NULL DEFAULT 0,
      captain_name TEXT,
      owner_user_id TEXT REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    , logo_url TEXT, owner_name TEXT, owner_email TEXT, overseas_count INTEGER DEFAULT 0);

-- ------------------------------------------------------------------------------
-- Table: auction_players
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS auction_players (
      id TEXT PRIMARY KEY,
      auction_id TEXT NOT NULL REFERENCES auction_rooms(id) ON DELETE CASCADE,
      lot_number INTEGER NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL, -- 'Batter', 'Fast Bowler', 'Spin All-Rounder', 'Wicketkeeper Batter', 'Pace All-Rounder'
      base_price INTEGER NOT NULL DEFAULT 500000,
      current_bid INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'UPCOMING', -- 'UPCOMING', 'IN_AUCTION', 'SOLD', 'UNSOLD'
      highest_bidder_team_id TEXT REFERENCES auction_teams(id),
      photo_url TEXT NOT NULL,
      stats_json TEXT NOT NULL,
      bio TEXT NOT NULL,
      reentry_count INTEGER NOT NULL DEFAULT 0,
      sold_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    , nationality TEXT DEFAULT 'India', is_overseas INTEGER DEFAULT 0, batting_style TEXT DEFAULT 'Right-hand bat', bowling_style TEXT DEFAULT 'Right-arm medium', category TEXT DEFAULT 'All-Rounder', age INTEGER DEFAULT 25, previous_team TEXT);

-- ------------------------------------------------------------------------------
-- Table: auction_registrations
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS auction_registrations (
        id TEXT PRIMARY KEY,
        auction_id TEXT NOT NULL REFERENCES auction_rooms(id) ON DELETE CASCADE,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        role_type TEXT NOT NULL DEFAULT 'viewer',
        team_id TEXT REFERENCES auction_teams(id) ON DELETE SET NULL,
        registered_at TEXT NOT NULL DEFAULT (datetime('now')),
        status TEXT NOT NULL DEFAULT 'confirmed'
      );

-- ------------------------------------------------------------------------------
-- Table: audit_logs
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT REFERENCES users(id),
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT,
      details_json TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    , actor_name TEXT, actor_role TEXT, before_json TEXT, after_json TEXT, result TEXT DEFAULT 'success', source TEXT DEFAULT 'admin_api');

-- ------------------------------------------------------------------------------
-- Table: bids
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bids (
      id TEXT PRIMARY KEY,
      auction_id TEXT NOT NULL REFERENCES auction_rooms(id) ON DELETE CASCADE,
      player_id TEXT NOT NULL REFERENCES auction_players(id) ON DELETE CASCADE,
      team_id TEXT NOT NULL REFERENCES auction_teams(id) ON DELETE CASCADE,
      bidder_user_id TEXT REFERENCES users(id),
      amount INTEGER NOT NULL,
      placed_at TEXT NOT NULL DEFAULT (datetime('now')),
      time_remaining INTEGER
    );

-- ------------------------------------------------------------------------------
-- Table: partner_collaborations
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS partner_collaborations (
        id TEXT PRIMARY KEY,
        partner_id TEXT NOT NULL REFERENCES partner_accounts(id) ON DELETE CASCADE,
        venue_id TEXT NOT NULL REFERENCES venues(id) ON DELETE RESTRICT,
        event_id TEXT REFERENCES events(id) ON DELETE SET NULL,
        initiated_by TEXT NOT NULL DEFAULT 'admin',
        organizer_user_id TEXT REFERENCES users(id),
        organizer_name TEXT NOT NULL DEFAULT 'STROOM Events Team',
        event_name TEXT NOT NULL,
        event_category TEXT NOT NULL,
        description TEXT NOT NULL,
        proposed_date TEXT NOT NULL,
        proposed_time TEXT NOT NULL DEFAULT '6:00 PM IST',
        expected_attendance INTEGER NOT NULL DEFAULT 50,
        target_audience TEXT,
        partner_responsibilities TEXT,
        stroom_responsibilities TEXT,
        marketing_plan TEXT,
        commercial_arrangement TEXT,
        special_requirements TEXT,
        status TEXT NOT NULL DEFAULT 'Proposal Sent' CHECK(status IN ('Draft', 'Proposal Sent', 'Under Review', 'Negotiation', 'Approved', 'Scheduled', 'Live', 'Completed', 'Rejected', 'Cancelled')),
        suggested_date TEXT,
        suggested_time TEXT,
        operational_notes TEXT,
        timeline_json TEXT DEFAULT '[]',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

-- ------------------------------------------------------------------------------
-- Table: collaboration_comments
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS collaboration_comments (
        id TEXT PRIMARY KEY,
        collaboration_id TEXT NOT NULL REFERENCES partner_collaborations(id) ON DELETE CASCADE,
        partner_id TEXT NOT NULL REFERENCES partner_accounts(id) ON DELETE CASCADE,
        user_id TEXT REFERENCES users(id),
        sender_name TEXT NOT NULL,
        sender_role TEXT NOT NULL,
        message TEXT NOT NULL,
        action_type TEXT NOT NULL DEFAULT 'comment',
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

-- ------------------------------------------------------------------------------
-- Table: communities
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS communities (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      city_id TEXT NOT NULL REFERENCES cities(id) ON DELETE RESTRICT,
      category TEXT NOT NULL,
      description TEXT NOT NULL,
      image_url TEXT NOT NULL,
      organizer_name TEXT NOT NULL,
      organizer_role TEXT NOT NULL DEFAULT 'Community Lead',
      organizer_avatar TEXT NOT NULL,
      member_count INTEGER NOT NULL DEFAULT 1,
      meeting_schedule TEXT NOT NULL,
      guidelines TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    , status TEXT DEFAULT 'published', manager_user_id TEXT);

-- ------------------------------------------------------------------------------
-- Table: community_members
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS community_members (
      id TEXT PRIMARY KEY,
      community_id TEXT NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      joined_at TEXT NOT NULL DEFAULT (datetime('now')),
      role TEXT NOT NULL DEFAULT 'member',
      UNIQUE(community_id, user_id)
    );

-- ------------------------------------------------------------------------------
-- Table: community_posts
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS community_posts (
        id TEXT PRIMARY KEY,
        community_id TEXT NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
        author_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
        author_name TEXT NOT NULL,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        image_url TEXT,
        status TEXT NOT NULL DEFAULT 'Published' CHECK(status IN ('Pending', 'Published', 'Reported', 'Under Review', 'Removed', 'Archived')),
        report_reason TEXT,
        reported_by TEXT,
        moderated_by TEXT,
        moderation_notes TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

-- ------------------------------------------------------------------------------
-- Table: contact_inquiries
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS contact_inquiries (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      subject TEXT NOT NULL,
      message TEXT NOT NULL,
      user_id TEXT REFERENCES users(id),
      status TEXT NOT NULL DEFAULT 'new',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

-- ------------------------------------------------------------------------------
-- Table: coupons
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS coupons (
      id TEXT PRIMARY KEY,
      venue_id TEXT NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
      code TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      discount_type TEXT NOT NULL DEFAULT 'percentage', -- 'percentage', 'bogo', 'freebie', 'fixed'
      discount_value TEXT NOT NULL,
      max_redemptions INTEGER NOT NULL DEFAULT 500,
      actual_redemptions INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'active', -- 'active', 'paused', 'expired'
      valid_until TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    , partner_id TEXT REFERENCES partner_accounts(id), offer_category TEXT DEFAULT 'percentage', min_purchase REAL DEFAULT 0, valid_from TEXT, eligible_event_id TEXT, eligible_audience TEXT DEFAULT 'all_members', terms_conditions TEXT, image_url TEXT, approval_status TEXT DEFAULT 'Active', impressions INTEGER DEFAULT 0, created_by TEXT);

-- ------------------------------------------------------------------------------
-- Table: coupon_redemptions
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS coupon_redemptions (
      id TEXT PRIMARY KEY,
      coupon_id TEXT NOT NULL REFERENCES coupons(id) ON DELETE CASCADE,
      venue_id TEXT NOT NULL REFERENCES venues(id),
      user_id TEXT NOT NULL REFERENCES users(id),
      verified_by_user_id TEXT REFERENCES users(id),
      order_amount REAL,
      notes TEXT,
      redeemed_at TEXT NOT NULL DEFAULT (datetime('now'))
    , partner_id TEXT REFERENCES partner_accounts(id), event_id TEXT, pass_code TEXT, purchase_verified INTEGER DEFAULT 0);

-- ------------------------------------------------------------------------------
-- Table: discovery_items
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS discovery_items (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL CHECK(type IN ('community', 'event', 'person', 'trip')),
      title TEXT NOT NULL,
      subtitle TEXT NOT NULL,
      description TEXT NOT NULL,
      image_url TEXT NOT NULL,
      category TEXT NOT NULL,
      tags TEXT NOT NULL, -- JSON array of stable tags
      location TEXT,
      member_count INTEGER DEFAULT 0,
      date_time TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

-- ------------------------------------------------------------------------------
-- Table: event_registrations
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "event_registrations" (
      id TEXT PRIMARY KEY,
      event_id TEXT NOT NULL REFERENCES events(id) ON DELETE RESTRICT,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      pass_code TEXT UNIQUE NOT NULL, -- e.g. STR-HYD-7821
      qr_token TEXT UNIQUE NOT NULL,
      seat_tier TEXT NOT NULL DEFAULT 'Table Seat',
      role_type TEXT NOT NULL DEFAULT 'Bidder', -- 'Bidder', 'Player Pool', 'Audience', 'Franchise Owner'
      checkin_status TEXT NOT NULL DEFAULT 'confirmed', -- 'confirmed', 'checked_in', 'cancelled'
      checked_in_at TEXT,
      checked_in_by TEXT REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(event_id, user_id)
    );

-- ------------------------------------------------------------------------------
-- Table: notifications
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      data_json TEXT,
      is_read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

-- ------------------------------------------------------------------------------
-- Table: quizzes
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS quizzes (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

-- ------------------------------------------------------------------------------
-- Table: quiz_versions
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS quiz_versions (
      id TEXT PRIMARY KEY,
      quiz_id TEXT NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
      version_number INTEGER NOT NULL,
      publication_status TEXT NOT NULL DEFAULT 'draft' CHECK(publication_status IN ('draft', 'published', 'archived')),
      published_at TEXT,
      created_by TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

-- ------------------------------------------------------------------------------
-- Table: questions
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS questions (
      id TEXT PRIMARY KEY,
      quiz_version_id TEXT NOT NULL REFERENCES quiz_versions(id) ON DELETE CASCADE,
      question_text TEXT NOT NULL,
      description TEXT,
      question_type TEXT NOT NULL DEFAULT 'single' CHECK(question_type IN ('single', 'multiple')),
      is_required INTEGER NOT NULL DEFAULT 1,
      min_selections INTEGER NOT NULL DEFAULT 1,
      max_selections INTEGER NOT NULL DEFAULT 1,
      display_order INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1
    );

-- ------------------------------------------------------------------------------
-- Table: options
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS options (
      id TEXT PRIMARY KEY,
      question_id TEXT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
      label TEXT NOT NULL,
      stable_value TEXT NOT NULL,
      display_order INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1
    );

-- ------------------------------------------------------------------------------
-- Table: partner_audit_logs
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS partner_audit_logs (
        id TEXT PRIMARY KEY,
        partner_id TEXT NOT NULL REFERENCES partner_accounts(id) ON DELETE CASCADE,
        user_id TEXT REFERENCES users(id),
        actor_name TEXT NOT NULL,
        action TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        entity_id TEXT,
        details_json TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

-- ------------------------------------------------------------------------------
-- Table: partner_communications
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS partner_communications (
        id TEXT PRIMARY KEY,
        partner_id TEXT NOT NULL REFERENCES partner_accounts(id) ON DELETE CASCADE,
        event_id TEXT REFERENCES events(id) ON DELETE SET NULL,
        collaboration_id TEXT REFERENCES partner_collaborations(id) ON DELETE SET NULL,
        sender_user_id TEXT REFERENCES users(id),
        sender_name TEXT NOT NULL,
        sender_role TEXT NOT NULL DEFAULT 'coordinator',
        subject TEXT NOT NULL,
        message TEXT NOT NULL,
        type TEXT NOT NULL DEFAULT 'coordinator_message' CHECK(type IN ('coordinator_message', 'announcement', 'operational_note', 'verification_update')),
        is_read INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

-- ------------------------------------------------------------------------------
-- Table: partner_proposals
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS partner_proposals (
      id TEXT PRIMARY KEY,
      venue_id TEXT REFERENCES venues(id),
      proposer_name TEXT NOT NULL,
      proposer_email TEXT NOT NULL,
      proposer_phone TEXT NOT NULL,
      venue_name TEXT NOT NULL,
      city TEXT NOT NULL,
      event_type TEXT NOT NULL,
      proposed_date TEXT NOT NULL,
      expected_attendees INTEGER NOT NULL,
      perks_offered TEXT,
      status TEXT NOT NULL DEFAULT 'submitted', -- 'submitted', 'under_review', 'approved', 'rejected'
      proposal_pdf_data TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

-- ------------------------------------------------------------------------------
-- Table: partner_users
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS partner_users (
        id TEXT PRIMARY KEY,
        partner_id TEXT NOT NULL REFERENCES partner_accounts(id) ON DELETE CASCADE,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        partner_role TEXT NOT NULL DEFAULT 'manager' CHECK(partner_role IN ('owner', 'manager', 'staff', 'viewer')),
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(partner_id, user_id)
      );

-- ------------------------------------------------------------------------------
-- Table: passport_stamps
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "passport_stamps" (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      event_id TEXT NOT NULL REFERENCES events(id) ON DELETE RESTRICT,
      event_title TEXT NOT NULL,
      category TEXT NOT NULL,
      city_name TEXT NOT NULL,
      venue_name TEXT NOT NULL,
      stamp_icon TEXT NOT NULL DEFAULT 'Award',
      verified_at TEXT NOT NULL DEFAULT (datetime('now')),
      verified_by TEXT REFERENCES users(id),
      UNIQUE(user_id, event_id)
    );

-- ------------------------------------------------------------------------------
-- Table: payment_transactions
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "payment_transactions" (
        id TEXT PRIMARY KEY,
        user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
        event_id TEXT REFERENCES events(id) ON DELETE RESTRICT,
        registration_id TEXT REFERENCES event_registrations(id) ON DELETE RESTRICT,
        reference_type TEXT NOT NULL DEFAULT 'event_registration',
        reference_id TEXT,
        amount REAL NOT NULL,
        currency TEXT NOT NULL DEFAULT 'INR',
        provider TEXT NOT NULL DEFAULT 'manual_desk',
        status TEXT NOT NULL DEFAULT 'Pending' CHECK(status IN ('Pending', 'Successful', 'Failed', 'Refunded', 'Partially Refunded')),
        refund_amount REAL DEFAULT 0,
        refund_reason TEXT,
        refunded_by TEXT REFERENCES users(id),
        refunded_at TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

-- ------------------------------------------------------------------------------
-- Table: platform_settings
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS platform_settings (
        key TEXT PRIMARY KEY,
        category TEXT NOT NULL,
        value_json TEXT NOT NULL,
        description TEXT,
        updated_by TEXT,
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

-- ------------------------------------------------------------------------------
-- Table: quiz_sessions
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS quiz_sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      quiz_version_id TEXT NOT NULL REFERENCES quiz_versions(id),
      status TEXT NOT NULL DEFAULT 'IN_PROGRESS' CHECK(status IN ('IN_PROGRESS', 'COMPLETED', 'SKIPPED')),
      started_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      completed_at TEXT,
      skipped_at TEXT
    );

-- ------------------------------------------------------------------------------
-- Table: responses
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS responses (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES quiz_sessions(id) ON DELETE CASCADE,
      question_id TEXT NOT NULL REFERENCES questions(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(session_id, question_id)
    );

-- ------------------------------------------------------------------------------
-- Table: response_options
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS response_options (
      response_id TEXT NOT NULL REFERENCES responses(id) ON DELETE CASCADE,
      option_id TEXT NOT NULL REFERENCES options(id),
      PRIMARY KEY (response_id, option_id)
    );

-- ------------------------------------------------------------------------------
-- Table: user_achievements
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_achievements (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      badge_key TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      icon_name TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'auction',
      unlocked_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(user_id, badge_key)
    );

-- ------------------------------------------------------------------------------
-- Table: user_preferences
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_preferences (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      preference_key TEXT NOT NULL,
      preference_value TEXT NOT NULL,
      source TEXT NOT NULL DEFAULT 'vibe_quiz',
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(user_id, preference_key, preference_value)
    );

-- ------------------------------------------------------------------------------
-- Table: venue_availability
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS venue_availability (
        id TEXT PRIMARY KEY,
        venue_id TEXT NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
        partner_id TEXT REFERENCES partner_accounts(id) ON DELETE CASCADE,
        date TEXT NOT NULL,
        time_slot TEXT NOT NULL DEFAULT 'full_day',
        status TEXT NOT NULL DEFAULT 'available' CHECK(status IN ('available', 'unavailable', 'proposed', 'booked')),
        event_id TEXT REFERENCES events(id) ON DELETE SET NULL,
        collaboration_id TEXT,
        notes TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(venue_id, date, time_slot)
      );

-- ==============================================================================
-- EXPLICIT SECONDARY INDEXES
-- ==============================================================================

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user ON activity_logs(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_partner_accounts_owner ON partner_accounts(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_events_city ON events(city_id, status);
CREATE INDEX IF NOT EXISTS idx_auction_rooms_status ON auction_rooms(status);
CREATE INDEX IF NOT EXISTS idx_auction_players_room ON auction_players(auction_id, lot_number);
CREATE UNIQUE INDEX IF NOT EXISTS idx_auction_reg_unique ON auction_registrations(auction_id, user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_bids_auction ON bids(auction_id, player_id);
CREATE INDEX IF NOT EXISTS idx_collabs_partner ON partner_collaborations(partner_id);
CREATE INDEX IF NOT EXISTS idx_communities_city ON communities(city_id, category);
CREATE INDEX IF NOT EXISTS idx_community_members_user ON community_members(user_id);
CREATE INDEX IF NOT EXISTS idx_community_posts_status ON community_posts(status);
CREATE INDEX IF NOT EXISTS idx_coupons_venue ON coupons(venue_id, status);
CREATE INDEX IF NOT EXISTS idx_discovery_location ON discovery_items(location);
CREATE INDEX IF NOT EXISTS idx_registrations_event ON event_registrations(event_id);
CREATE INDEX IF NOT EXISTS idx_registrations_pass ON event_registrations(pass_code);
CREATE INDEX IF NOT EXISTS idx_registrations_user ON event_registrations(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_versions_quiz ON quiz_versions(quiz_id, publication_status);
CREATE INDEX IF NOT EXISTS idx_questions_version ON questions(quiz_version_id, display_order);
CREATE INDEX IF NOT EXISTS idx_options_question ON options(question_id, display_order);
CREATE INDEX IF NOT EXISTS idx_partner_audit_partner ON partner_audit_logs(partner_id);
CREATE INDEX IF NOT EXISTS idx_partner_comms_partner ON partner_communications(partner_id);
CREATE INDEX IF NOT EXISTS idx_partner_users_user ON partner_users(user_id);
CREATE INDEX IF NOT EXISTS idx_passport_stamps_user ON passport_stamps(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_user_event ON payment_transactions(user_id, event_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON quiz_sessions(user_id, status);
CREATE INDEX IF NOT EXISTS idx_responses_session ON responses(session_id);
CREATE INDEX IF NOT EXISTS idx_achievements_user ON user_achievements(user_id);
CREATE INDEX IF NOT EXISTS idx_preferences_user ON user_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_venue_avail_venue_date ON venue_availability(venue_id, date);