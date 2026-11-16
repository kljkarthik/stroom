import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { config } from '../config/env';

const DB_PATH = config.dbPath;
const DATA_DIR = path.dirname(DB_PATH);
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

export const db = new Database(DB_PATH);

// Enable WAL mode, busy timeout, and foreign keys for high performance and ACID integrity
db.pragma('journal_mode = WAL');
db.pragma('busy_timeout = 5000');
db.pragma('foreign_keys = ON');

export function initDatabase() {
  const schema = `
    -- Users table (expanded to support all 7 official STROOM roles & unique member IDs)
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      full_name TEXT NOT NULL,
      avatar_url TEXT,
      role TEXT NOT NULL DEFAULT 'user',
      member_id TEXT UNIQUE,
      phone TEXT,
      city TEXT DEFAULT 'Hyderabad',
      bio TEXT,
      onboarding_status TEXT NOT NULL DEFAULT 'NOT_STARTED' CHECK(onboarding_status IN ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Cities (Prioritized for launch: Hyderabad, Pune, Bangalore, Mumbai)
    CREATE TABLE IF NOT EXISTS cities (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      state TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      launch_order INTEGER NOT NULL DEFAULT 1,
      tagline TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Venues & Cafes (Verified partnership destinations)
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
    );

    -- Events (Cricket auctions, sports, café meetups, gaming, travel)
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
    );

    -- Event Registrations / Verified Digital QR Passes
    CREATE TABLE IF NOT EXISTS event_registrations (
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

    -- Independent Auction Rooms
    CREATE TABLE IF NOT EXISTS auction_rooms (
      id TEXT PRIMARY KEY,
      event_id TEXT REFERENCES events(id) ON DELETE SET NULL,
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
    );

    -- Auction Teams / Franchises
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
    );

    -- Auction Players Pool
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
    );

    -- Bids Transaction Log (Authoritative, Concurrency-Safe)
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

    -- Cafe & Partner Coupons
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
    );

    -- Verified Coupon Redemptions (Audited, No Fake Data)
    CREATE TABLE IF NOT EXISTS coupon_redemptions (
      id TEXT PRIMARY KEY,
      coupon_id TEXT NOT NULL REFERENCES coupons(id) ON DELETE CASCADE,
      venue_id TEXT NOT NULL REFERENCES venues(id),
      user_id TEXT NOT NULL REFERENCES users(id),
      verified_by_user_id TEXT REFERENCES users(id),
      order_amount REAL,
      notes TEXT,
      redeemed_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Partner Proposals (Downloadable PDF Collaboration Generator)
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

    -- Community Event Proposals & Submissions (User & Partner Experience Submissions)
    CREATE TABLE IF NOT EXISTS event_submissions (
      id TEXT PRIMARY KEY,
      user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      organizer_name TEXT NOT NULL,
      organizer_email TEXT NOT NULL,
      organizer_phone TEXT NOT NULL,
      organization_name TEXT,
      title TEXT NOT NULL,
      category TEXT NOT NULL,
      short_description TEXT NOT NULL,
      detailed_description TEXT NOT NULL,
      format TEXT NOT NULL DEFAULT 'Physical',
      city TEXT NOT NULL,
      venue TEXT,
      proposed_date TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT,
      expected_capacity INTEGER NOT NULL,
      age_group TEXT,
      cover_image_url TEXT,
      additional_images_json TEXT,
      estimated_budget TEXT,
      ticketing_details TEXT,
      sponsorship_requirements TEXT,
      additional_notes TEXT,
      status TEXT NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'UNDER_REVIEW', 'APPROVED', 'REJECTED'
      admin_notes TEXT,
      reviewed_by TEXT,
      reviewed_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Participant Achievements & STROOM Passport
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

    -- Platform Audit Logs
    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT REFERENCES users(id),
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT,
      details_json TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Quizzes master table
    CREATE TABLE IF NOT EXISTS quizzes (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Quiz Versions
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

    -- Questions table
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

    -- Options table
    CREATE TABLE IF NOT EXISTS options (
      id TEXT PRIMARY KEY,
      question_id TEXT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
      label TEXT NOT NULL,
      stable_value TEXT NOT NULL,
      display_order INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1
    );

    -- Quiz Sessions
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

    -- Responses to questions
    CREATE TABLE IF NOT EXISTS responses (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES quiz_sessions(id) ON DELETE CASCADE,
      question_id TEXT NOT NULL REFERENCES questions(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(session_id, question_id)
    );

    -- Selected options
    CREATE TABLE IF NOT EXISTS response_options (
      response_id TEXT NOT NULL REFERENCES responses(id) ON DELETE CASCADE,
      option_id TEXT NOT NULL REFERENCES options(id),
      PRIMARY KEY (response_id, option_id)
    );

    -- Normalized User Preferences
    CREATE TABLE IF NOT EXISTS user_preferences (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      preference_key TEXT NOT NULL,
      preference_value TEXT NOT NULL,
      source TEXT NOT NULL DEFAULT 'vibe_quiz',
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(user_id, preference_key, preference_value)
    );

    -- Social Discovery Items
    CREATE TABLE IF NOT EXISTS discovery_items (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL CHECK(type IN ('community', 'event', 'person', 'trip')),
      title TEXT NOT NULL,
      subtitle TEXT NOT NULL,
      description TEXT NOT NULL,
      image_url TEXT NOT NULL,
      category TEXT NOT NULL,
      tags TEXT NOT NULL,
      location TEXT,
      member_count INTEGER DEFAULT 0,
      date_time TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Dedicated Communities Table (Phase 2 Public Discovery)
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
    );

    -- Community Memberships (Authenticated join/leave)
    CREATE TABLE IF NOT EXISTS community_members (
      id TEXT PRIMARY KEY,
      community_id TEXT NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      joined_at TEXT NOT NULL DEFAULT (datetime('now')),
      role TEXT NOT NULL DEFAULT 'member',
      UNIQUE(community_id, user_id)
    );

    -- Contact Inquiries (Phase 2 Public Inquiries)
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

    -- STROOM Verified Passport Stamps (Phase 4 Member Experience)
    CREATE TABLE IF NOT EXISTS passport_stamps (
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

    -- Achievements Master Catalog (Phase 4 Configurable Rules)
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

    -- In-App Member Notifications (Phase 4 Member Notification Center)
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

    -- Member Activity History Timeline (Phase 4 Member Journey)
    CREATE TABLE IF NOT EXISTS activity_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      activity_type TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      reference_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Indexes
    CREATE INDEX IF NOT EXISTS idx_events_city ON events(city_id, status);
    CREATE INDEX IF NOT EXISTS idx_registrations_user ON event_registrations(user_id);
    CREATE INDEX IF NOT EXISTS idx_registrations_event ON event_registrations(event_id);
    CREATE INDEX IF NOT EXISTS idx_communities_city ON communities(city_id, category);
    CREATE INDEX IF NOT EXISTS idx_community_members_user ON community_members(user_id);
    CREATE INDEX IF NOT EXISTS idx_auction_rooms_status ON auction_rooms(status);
    CREATE INDEX IF NOT EXISTS idx_auction_players_room ON auction_players(auction_id, lot_number);
    CREATE INDEX IF NOT EXISTS idx_bids_auction ON bids(auction_id, player_id);
    CREATE INDEX IF NOT EXISTS idx_coupons_venue ON coupons(venue_id, status);
    CREATE INDEX IF NOT EXISTS idx_achievements_user ON user_achievements(user_id);
    CREATE INDEX IF NOT EXISTS idx_discovery_location ON discovery_items(location);
    CREATE INDEX IF NOT EXISTS idx_passport_stamps_user ON passport_stamps(user_id);
    CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read);
    CREATE INDEX IF NOT EXISTS idx_activity_logs_user ON activity_logs(user_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
    CREATE INDEX IF NOT EXISTS idx_registrations_pass ON event_registrations(pass_code);
  `;

  db.exec(schema);

  // Apply migrations for any existing columns in users and auctions
  migrateUsersTable();
  migrateAuctionTables();
  migratePhase4Tables();

  // Seed domain data (Hyderabad, Pune, Bangalore, Mumbai, Venues, Real Flagship Auctions)
  seedExtendedDomainData();

  // Apply Phase 5 Business Partner Ecosystem tables & initial verified partnerships
  migratePhase5Tables();

  // Apply Phase 6 Centralized Admin Control Center tables & permissions
  migratePhase6Tables();

  // Enforce ON DELETE RESTRICT on historical registration, attendance, payment, and auction records
  migrateHistoricalEventRestrictions();
}

function migrateUsersTable() {
  try {
    const tableInfo = db.prepare('PRAGMA table_info(users)').all() as { name: string }[];
    const colNames = tableInfo.map((c) => c.name);

    if (!colNames.includes('member_id')) {
      db.prepare('ALTER TABLE users ADD COLUMN member_id TEXT').run();
    }
    if (!colNames.includes('phone')) {
      db.prepare('ALTER TABLE users ADD COLUMN phone TEXT').run();
    }
    if (!colNames.includes('city')) {
      db.prepare("ALTER TABLE users ADD COLUMN city TEXT DEFAULT 'Hyderabad'").run();
    }
    if (!colNames.includes('bio')) {
      db.prepare('ALTER TABLE users ADD COLUMN bio TEXT').run();
    }


  } catch (err) {
    // Migration helper
  }
}

function migrateAuctionTables() {
  try {
    // 1. auction_rooms
    const roomCols = (db.prepare('PRAGMA table_info(auction_rooms)').all() as { name: string }[]).map(c => c.name);
    if (!roomCols.includes('description')) {
      db.prepare('ALTER TABLE auction_rooms ADD COLUMN description TEXT').run();
    }
    if (!roomCols.includes('cover_image_url')) {
      db.prepare('ALTER TABLE auction_rooms ADD COLUMN cover_image_url TEXT').run();
    }
    if (!roomCols.includes('format_category')) {
      db.prepare("ALTER TABLE auction_rooms ADD COLUMN format_category TEXT DEFAULT 'ipl_mock'").run();
    }
    if (!roomCols.includes('registration_fee')) {
      db.prepare("ALTER TABLE auction_rooms ADD COLUMN registration_fee TEXT DEFAULT 'Free / Included with Community Pass'").run();
    }
    if (!roomCols.includes('registration_status')) {
      db.prepare("ALTER TABLE auction_rooms ADD COLUMN registration_status TEXT DEFAULT 'open'").run();
    }
    if (!roomCols.includes('overseas_limit')) {
      db.prepare('ALTER TABLE auction_rooms ADD COLUMN overseas_limit INTEGER DEFAULT 4').run();
    }
    if (!roomCols.includes('bid_increment_slabs_json')) {
      db.prepare('ALTER TABLE auction_rooms ADD COLUMN bid_increment_slabs_json TEXT').run();
    }

    // 2. auction_teams
    const teamCols = (db.prepare('PRAGMA table_info(auction_teams)').all() as { name: string }[]).map(c => c.name);
    if (!teamCols.includes('logo_url')) {
      db.prepare('ALTER TABLE auction_teams ADD COLUMN logo_url TEXT').run();
    }
    if (!teamCols.includes('owner_name')) {
      db.prepare('ALTER TABLE auction_teams ADD COLUMN owner_name TEXT').run();
    }
    if (!teamCols.includes('owner_email')) {
      db.prepare('ALTER TABLE auction_teams ADD COLUMN owner_email TEXT').run();
    }
    if (!teamCols.includes('overseas_count')) {
      db.prepare('ALTER TABLE auction_teams ADD COLUMN overseas_count INTEGER DEFAULT 0').run();
    }

    // 3. auction_players
    const playerCols = (db.prepare('PRAGMA table_info(auction_players)').all() as { name: string }[]).map(c => c.name);
    if (!playerCols.includes('nationality')) {
      db.prepare("ALTER TABLE auction_players ADD COLUMN nationality TEXT DEFAULT 'India'").run();
    }
    if (!playerCols.includes('is_overseas')) {
      db.prepare('ALTER TABLE auction_players ADD COLUMN is_overseas INTEGER DEFAULT 0').run();
    }
    if (!playerCols.includes('batting_style')) {
      db.prepare("ALTER TABLE auction_players ADD COLUMN batting_style TEXT DEFAULT 'Right-hand bat'").run();
    }
    if (!playerCols.includes('bowling_style')) {
      db.prepare("ALTER TABLE auction_players ADD COLUMN bowling_style TEXT DEFAULT 'Right-arm medium'").run();
    }
    if (!playerCols.includes('category')) {
      db.prepare("ALTER TABLE auction_players ADD COLUMN category TEXT DEFAULT 'All-Rounder'").run();
    }
    if (!playerCols.includes('age')) {
      db.prepare('ALTER TABLE auction_players ADD COLUMN age INTEGER DEFAULT 25').run();
    }
    if (!playerCols.includes('previous_team')) {
      db.prepare('ALTER TABLE auction_players ADD COLUMN previous_team TEXT').run();
    }

    // 4. auction_registrations table
    db.prepare(`
      CREATE TABLE IF NOT EXISTS auction_registrations (
        id TEXT PRIMARY KEY,
        auction_id TEXT NOT NULL REFERENCES auction_rooms(id) ON DELETE CASCADE,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        role_type TEXT NOT NULL DEFAULT 'viewer',
        team_id TEXT REFERENCES auction_teams(id) ON DELETE SET NULL,
        registered_at TEXT NOT NULL DEFAULT (datetime('now')),
        status TEXT NOT NULL DEFAULT 'confirmed'
      )
    `).run();
    db.prepare('CREATE UNIQUE INDEX IF NOT EXISTS idx_auction_reg_unique ON auction_registrations(auction_id, user_id)').run();
  } catch (err) {
    // Migration helper
  }
}

function migratePhase4Tables() {
  try {
    // 1. Extend users table with profile, preferences, and privacy columns
    const userCols = (db.prepare('PRAGMA table_info(users)').all() as { name: string }[]).map(c => c.name);
    if (!userCols.includes('display_name')) {
      db.prepare('ALTER TABLE users ADD COLUMN display_name TEXT').run();
    }
    if (!userCols.includes('first_name')) {
      db.prepare('ALTER TABLE users ADD COLUMN first_name TEXT').run();
    }
    if (!userCols.includes('last_name')) {
      db.prepare('ALTER TABLE users ADD COLUMN last_name TEXT').run();
    }
    if (!userCols.includes('cover_url')) {
      db.prepare('ALTER TABLE users ADD COLUMN cover_url TEXT').run();
    }
    if (!userCols.includes('interests_json')) {
      db.prepare("ALTER TABLE users ADD COLUMN interests_json TEXT DEFAULT '[]'").run();
    }
    if (!userCols.includes('is_public')) {
      db.prepare('ALTER TABLE users ADD COLUMN is_public INTEGER NOT NULL DEFAULT 1').run();
    }
    if (!userCols.includes('privacy_settings_json')) {
      db.prepare("ALTER TABLE users ADD COLUMN privacy_settings_json TEXT DEFAULT '{\"showCommunities\":true,\"showAchievements\":true,\"showStamps\":true,\"showCity\":true}'").run();
    }
    if (!userCols.includes('notification_settings_json')) {
      db.prepare("ALTER TABLE users ADD COLUMN notification_settings_json TEXT DEFAULT '{\"eventReminders\":true,\"communityUpdates\":true,\"achievementAlerts\":true,\"marketing\":false}'").run();
    }



    // 2. Seed Master Achievements Catalog
    const masterAchievements = [
      {
        id: 'ach_first_experience',
        badge_key: 'FIRST_EXPERIENCE',
        title: 'First Experience',
        description: 'Attended your first verified in-person STROOM meetup or event.',
        icon_name: 'Sparkles',
        category: 'attendance',
        points: 50,
        requirement_type: 'min_attendance',
        requirement_threshold: 1,
      },
      {
        id: 'ach_explorer',
        badge_key: 'EXPLORER',
        title: 'Category Explorer',
        description: 'Attended verified experiences across 2 or more distinct categories.',
        icon_name: 'Compass',
        category: 'exploration',
        points: 100,
        requirement_type: 'distinct_categories',
        requirement_threshold: 2,
      },
      {
        id: 'ach_community_builder',
        badge_key: 'COMMUNITY_BUILDER',
        title: 'Community Builder',
        description: 'Joined 2 or more local STROOM communities and social circles.',
        icon_name: 'Users',
        category: 'community',
        points: 75,
        requirement_type: 'communities_joined',
        requirement_threshold: 2,
      },
      {
        id: 'ach_auction_strategist',
        badge_key: 'AUCTION_STRATEGIST',
        title: 'Auction Strategist',
        description: 'Participated as bidder or franchise strategist in an interactive cricket auction.',
        icon_name: 'Trophy',
        category: 'auction',
        points: 150,
        requirement_type: 'auction_participation',
        requirement_threshold: 1,
      },
      {
        id: 'ach_sports_enthusiast',
        badge_key: 'SPORTS_ENTHUSIAST',
        title: 'Sports Enthusiast',
        description: 'Participated in sports tournaments or live cricket bidding formats.',
        icon_name: 'Flame',
        category: 'sports',
        points: 80,
        requirement_type: 'sports_events',
        requirement_threshold: 1,
      },
      {
        id: 'ach_city_explorer',
        badge_key: 'CITY_EXPLORER',
        title: 'City Explorer',
        description: 'Attended verified experiences across multiple STROOM launch cities.',
        icon_name: 'MapPin',
        category: 'exploration',
        points: 200,
        requirement_type: 'cities_visited',
        requirement_threshold: 2,
      },
      {
        id: 'ach_pioneer_member',
        badge_key: 'PIONEER_MEMBER',
        title: 'Pioneer Member',
        description: 'Completed full profile studio onboarding and personal discovery preferences.',
        icon_name: 'ShieldCheck',
        category: 'identity',
        points: 50,
        requirement_type: 'profile_completed',
        requirement_threshold: 1,
      },
    ];

    const insertMasterAch = db.prepare(`
      INSERT OR IGNORE INTO achievements_master (id, badge_key, title, description, icon_name, category, points, requirement_type, requirement_threshold)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const ach of masterAchievements) {
      insertMasterAch.run(
        ach.id,
        ach.badge_key,
        ach.title,
        ach.description,
        ach.icon_name,
        ach.category,
        ach.points,
        ach.requirement_type,
        ach.requirement_threshold
      );
    }

    // 3. Migrate past checked-in registrations into passport_stamps
    db.prepare(`
      INSERT OR IGNORE INTO passport_stamps (id, user_id, event_id, event_title, category, city_name, venue_name, stamp_icon, verified_at)
      SELECT
        'stamp_' || substr(r.id, 5),
        r.user_id,
        r.event_id,
        e.title,
        e.category,
        c.name,
        v.name,
        CASE
          WHEN e.category LIKE '%auction%' THEN 'Trophy'
          WHEN e.category LIKE '%sport%' THEN 'Activity'
          WHEN e.category LIKE '%cafe%' THEN 'Coffee'
          ELSE 'Award'
        END,
        COALESCE(r.checked_in_at, datetime('now'))
      FROM event_registrations r
      JOIN events e ON r.event_id = e.id
      JOIN cities c ON e.city_id = c.id
      JOIN venues v ON e.venue_id = v.id
      WHERE r.checkin_status = 'checked_in'
    `).run();


  } catch (err) {
    // Migration helper
  }
}

// Password hashing utility using Node crypto (SHA-256 with salt)
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `scrypt$${salt}$${derived}`;
}

export function verifyPassword(password: string, storedHash: string): { valid: boolean; needsRehash: boolean } {
  if (!storedHash || typeof storedHash !== 'string' || storedHash.trim().length === 0) {
    return { valid: false, needsRehash: false };
  }
  if (!password || typeof password !== 'string' || password.length === 0) {
    return { valid: false, needsRehash: false };
  }

  if (storedHash.startsWith('scrypt$')) {
    const parts = storedHash.split('$');
    if (parts.length !== 3) return { valid: false, needsRehash: false };
    const [, salt, hexDigest] = parts;
    try {
      const derived = crypto.scryptSync(password, salt, 64);
      const storedBuf = Buffer.from(hexDigest, 'hex');
      if (derived.length !== storedBuf.length) return { valid: false, needsRehash: false };
      return { valid: crypto.timingSafeEqual(derived, storedBuf), needsRehash: false };
    } catch {
      return { valid: false, needsRehash: false };
    }
  }

  // Legacy Phase 1-6 SHA-256 verification (transparently upgraded on login)
  const legacySalt = 'stroom_vibe_salt_2026';
  const legacyDigest = crypto.createHash('sha256').update(password + legacySalt).digest('hex');
  try {
    const a = Buffer.from(legacyDigest, 'hex');
    const b = Buffer.from(storedHash, 'hex');
    if (a.length !== b.length) return { valid: false, needsRehash: false };
    const valid = crypto.timingSafeEqual(a, b);
    return { valid, needsRehash: valid };
  } catch {
    return { valid: false, needsRehash: false };
  }
}

export async function createDatabaseBackup(targetDir = config.backupDir, retainDays = 14): Promise<string> {
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const destPath = path.join(targetDir, `stroom-backup-${stamp}.db`);
  await db.backup(destPath);

  // Prune old backups beyond retention window
  const cutoff = Date.now() - retainDays * 86400000;
  for (const file of fs.readdirSync(targetDir)) {
    if (!file.startsWith('stroom-backup-') || !file.endsWith('.db')) continue;
    const full = path.join(targetDir, file);
    const stat = fs.statSync(full);
    if (stat.mtimeMs < cutoff) {
      fs.unlinkSync(full);
    }
  }
  return destPath;
}

export function seedExtendedDomainData() {
  const transaction = db.transaction(() => {
    // 1. Ensure Launch Cities: Hyderabad (#1 priority), Pune (#2 priority), Bangalore, Mumbai
    const insertCity = db.prepare(`
      INSERT OR IGNORE INTO cities (id, name, state, is_active, launch_order, tagline)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    insertCity.run('city_hyd', 'Hyderabad', 'Telangana', 1, 1, 'Flagship Launch Hub • Jubilee Hills & Gachibowli');
    insertCity.run('city_pune', 'Pune', 'Maharashtra', 1, 2, 'Premier Expansion Hub • FC Road & Koregaon Park');
    insertCity.run('city_mum', 'Mumbai', 'Maharashtra', 0, 3, 'Western Coastal Hub • Bandra West & BKC (Coming Soon)');
    insertCity.run('city_delhi', 'Delhi', 'Delhi NCR', 0, 4, 'Capital Social Hub • Hauz Khas & CP (Coming Soon)');
    insertCity.run('city_blr', 'Bangalore', 'Karnataka', 0, 5, 'Tech & Social Circle Hub • Indiranagar & Koramangala (Coming Soon)');
    insertCity.run('city_kolkata', 'Kolkata', 'West Bengal', 0, 6, 'Cultural & Meetup Hub • Park Street & Salt Lake (Coming Soon)');

    // 2. Venues: Populated via genuine partner submissions & admin verification

    // 3. Events: Production clean state (created via event submissions & admin publishing)









    // 4. Ensure Auction Room for Hyderabad Flagship
    const insertAuction = db.prepare(`
      INSERT OR IGNORE INTO auction_rooms (id, event_id, title, format_type, status, current_player_id, countdown_seconds, auto_extend_seconds, min_bid_increment, max_squad_size, min_squad_size, team_purse_cap, rules_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const rules = JSON.stringify({
      formatName: 'STROOM Premier League Format',
      autoExtendOnLastSeconds: 5,
      extensionDuration: 15,
      maxForeignPlayers: 0,
      allPlayersGuaranteedMatch: true,
      soldConfirmationDelayMs: 250
    });

    insertAuction.run(
      'auc_hyd_001',
      null,
      'STROOM Hyderabad Premier Cricket Auction 2026',
      'stroom_premier',
      'LIVE',
      'ply_hyd_001',
      15,
      15,
      25000,
      15,
      8,
      10000000,
      rules
    );

    // 5. Ensure 5 Franchise Teams for Hyderabad
    const insertTeam = db.prepare(`
      INSERT OR IGNORE INTO auction_teams (id, auction_id, name, city, color, purse_initial, purse_remaining, squad_count, captain_name)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertTeam.run('team_hyd_1', 'auc_hyd_001', 'Hyderabad Cyber Strikers', 'Hyderabad', '#FF7100', 10000000, 8150000, 8, 'Dev Patel');
    insertTeam.run('team_hyd_2', 'auc_hyd_001', 'Deccan Chargers United', 'Hyderabad', '#10B981', 10000000, 7400000, 9, 'Zaid Khan');
    insertTeam.run('team_hyd_3', 'auc_hyd_001', 'Jubilee Hills Royals', 'Hyderabad', '#EAB308', 10000000, 8900000, 7, 'Suresh Kumar');
    insertTeam.run('team_hyd_4', 'auc_hyd_001', 'Gachibowli Titans', 'Hyderabad', '#8B5CF6', 10000000, 6850000, 10, 'Ananya Rao');
    insertTeam.run('team_hyd_5', 'auc_hyd_001', 'Secunderabad Blasters', 'Hyderabad', '#0284C7', 10000000, 7600000, 8, 'Rohit Kulkarni');

    // 6. Ensure Player Database for the Auction
    const insertPlayer = db.prepare(`
      INSERT OR IGNORE INTO auction_players (id, auction_id, lot_number, name, role, base_price, current_bid, status, highest_bidder_team_id, photo_url, stats_json, bio)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertPlayer.run(
      'ply_hyd_001',
      'auc_hyd_001',
      1,
      'Aarav "Dynamite" Sharma',
      'Spin All-Rounder',
      500000,
      500000,
      'IN_AUCTION',
      null,
      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=700&q=80',
      JSON.stringify({ matches: 48, strikeRate: 168.4, wickets: 54, economy: 6.8, communityReputation: 98, bestScore: '84* (32b)' }),
      'Fierce competitor on the field, ultimate hype-man at post-match cafe meetups. Known for clutch death bowling and towering sixes in Hyderabad club leagues.'
    );

    insertPlayer.run(
      'ply_hyd_002',
      'auc_hyd_001',
      2,
      'Kavya "Rockets" Nair',
      'Fast Bowler',
      600000,
      600000,
      'UPCOMING',
      null,
      'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=700&q=80',
      JSON.stringify({ matches: 39, strikeRate: 112.0, wickets: 68, economy: 5.9, communityReputation: 96, bestScore: '5/18 (4 ov)' }),
      'Clocking 130km/h with devastating yorkers. Joined STROOM as a stranger at a weekend cricket net, now leading Hyderabad bowling attacks.'
    );

    insertPlayer.run(
      'ply_hyd_003',
      'auc_hyd_001',
      3,
      'Rohan "The Wall" Verma',
      'Batter',
      400000,
      400000,
      'UPCOMING',
      null,
      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=700&q=80',
      JSON.stringify({ matches: 52, strikeRate: 145.2, wickets: 8, economy: 8.2, communityReputation: 94, bestScore: '106* (51b)' }),
      'Anchor in chases with ice in his veins. Community legend who has mentored over 30 new entrants to the Hyderabad weekend league.'
    );

    insertPlayer.run(
      'ply_hyd_004',
      'auc_hyd_001',
      4,
      'Tanvi "Gloves" Deshmukh',
      'Wicketkeeper Batter',
      450000,
      450000,
      'UPCOMING',
      null,
      'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=700&q=80',
      JSON.stringify({ matches: 34, strikeRate: 154.6, wickets: 42, economy: 0, communityReputation: 97, bestScore: '67 (29b)' }),
      'Lightning stumpings and innovative scoop shots. The heart and soul of STROOM watch parties in Jubilee Hills.'
    );

    insertPlayer.run(
      'ply_hyd_005',
      'auc_hyd_001',
      5,
      'Marcus "Thunder" Miller',
      'Fast Bowler',
      750000,
      750000,
      'UPCOMING',
      null,
      'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=700&q=80',
      JSON.stringify({ matches: 62, strikeRate: 105.0, wickets: 88, economy: 6.2, communityReputation: 95, bestScore: '4/14 (4 ov)' }),
      'Australian overseas express pacer. Relocated to Hyderabad tech corridor and brings furious 140km/h pace to weekend box turf leagues.'
    );

    insertPlayer.run(
      'ply_hyd_006',
      'auc_hyd_001',
      6,
      'Vikram "Smash" Reddy',
      'Pace All-Rounder',
      650000,
      650000,
      'UPCOMING',
      null,
      'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?auto=format&fit=crop&w=700&q=80',
      JSON.stringify({ matches: 44, strikeRate: 172.5, wickets: 38, economy: 7.4, communityReputation: 92, bestScore: '78* (28b)' }),
      'Power hitter who loves clearing the net in Gachibowli. Consistent wicket-taker in the middle overs.'
    );

    // Update player and team metadata for Hyderabad
    db.prepare(`
      UPDATE auction_rooms
      SET description = 'The ultimate live community cricket bidding arena. 5 franchise tables, marquee local heroes, live gavel hammer, and authentic camaraderie.',
          cover_image_url = 'https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?w=800&auto=format&fit=crop&q=80',
          format_category = 'ipl_mock',
          registration_fee = '₹499 (Includes Welcome Cold Brew & Team Paddle)',
          registration_status = 'open',
          overseas_limit = 4,
          bid_increment_slabs_json = '[{"upTo":1000000,"increment":25000},{"upTo":5000000,"increment":50000},{"upTo":999999999,"increment":100000}]'
      WHERE id = 'auc_hyd_001'
    `).run();

    db.prepare("UPDATE auction_players SET nationality = 'Australia', is_overseas = 1, category = 'Overseas', batting_style = 'Right-hand bat', bowling_style = 'Right-arm fast', age = 27 WHERE id = 'ply_hyd_005'").run();
    db.prepare("UPDATE auction_players SET nationality = 'India', is_overseas = 0, category = 'All-Rounder', batting_style = 'Right-hand bat', bowling_style = 'Right-arm offbreak', age = 24 WHERE id = 'ply_hyd_001'").run();
    db.prepare("UPDATE auction_players SET nationality = 'India', is_overseas = 0, category = 'Bowler', batting_style = 'Right-hand bat', bowling_style = 'Right-arm fast', age = 23 WHERE id = 'ply_hyd_002'").run();
    db.prepare("UPDATE auction_players SET nationality = 'India', is_overseas = 0, category = 'Batter', batting_style = 'Right-hand bat', bowling_style = 'Right-arm medium', age = 26 WHERE id = 'ply_hyd_003'").run();
    db.prepare("UPDATE auction_players SET nationality = 'India', is_overseas = 0, category = 'Wicketkeeper', batting_style = 'Right-hand bat', bowling_style = 'Wicketkeeper', age = 22 WHERE id = 'ply_hyd_004'").run();
    db.prepare("UPDATE auction_players SET nationality = 'India', is_overseas = 0, category = 'All-Rounder', batting_style = 'Left-hand bat', bowling_style = 'Right-arm medium-fast', age = 25 WHERE id = 'ply_hyd_006'").run();

    // 4b. Ensure Pune All-Time Cricket Legends Mega Auction
    const puneRules = JSON.stringify({
      formatName: 'All-Time Legends Mega Auction',
      purseCap: 20000000,
      maxSquadSize: 18,
      minSquadSize: 11,
      overseasLimit: 4,
      autoExtendOnLastSeconds: 5,
      extensionDuration: 15,
      minBidIncrement: 50000
    });

    insertAuction.run(
      'auc_pune_002',
      null,
      'Pune Deccan All-Time Cricket Legends Mega Auction',
      'all_time_mega',
      'SCHEDULED',
      'ply_pune_001',
      20,
      15,
      50000,
      18,
      11,
      20000000,
      puneRules
    );

    db.prepare(`
      UPDATE auction_rooms
      SET description = 'Draft legendary cricket icons from across eras. 4 franchise tables, ₹2 Crore purse, classic legends, and tactical bidding rounds.',
          cover_image_url = 'https://images.unsplash.com/photo-1511578314322-379afb476865?w=800&auto=format&fit=crop&q=80',
          format_category = 'all_time_mega',
          registration_fee = '₹499 (Includes Team Cap & Social Bites)',
          registration_status = 'open',
          overseas_limit = 4,
          bid_increment_slabs_json = '[{"upTo":2000000,"increment":50000},{"upTo":10000000,"increment":100000},{"upTo":999999999,"increment":200000}]'
      WHERE id = 'auc_pune_002'
    `).run();

    // Pune Teams
    insertTeam.run('team_pune_1', 'auc_pune_002', 'Pune Warriors Elite', 'Pune', '#FF6900', 20000000, 20000000, 0, 'Kedar Jadhav');
    insertTeam.run('team_pune_2', 'auc_pune_002', 'Sahyadri Super Kings', 'Pune', '#D9A441', 20000000, 20000000, 0, 'Ajinkya Rahane');
    insertTeam.run('team_pune_3', 'auc_pune_002', 'Deccan Gladiators', 'Pune', '#2563EB', 20000000, 20000000, 0, 'Ruturaj Gaikwad');
    insertTeam.run('team_pune_4', 'auc_pune_002', 'Sinhagad Lions', 'Pune', '#DC2626', 20000000, 20000000, 0, 'Rahul Tripathi');

    // Pune All-Time Legend Players
    insertPlayer.run(
      'ply_pune_001',
      'auc_pune_002',
      1,
      'Sachin "Master Blaster" Tendulkar',
      'Batter',
      2000000,
      2000000,
      'UPCOMING',
      null,
      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=700&q=80',
      JSON.stringify({ matches: 463, strikeRate: 86.2, runs: 18426, centuries: 49, average: 44.83, bestScore: '200*' }),
      'The God of Cricket. Legendary technique, timeless balance, and the ultimate marquee opening batter for any all-time franchise dream squad.'
    );
    db.prepare("UPDATE auction_players SET nationality = 'India', is_overseas = 0, category = 'Legend', batting_style = 'Right-hand bat', bowling_style = 'Right-arm offbreak', age = 50, previous_team = 'Mumbai Indians' WHERE id = 'ply_pune_001'").run();

    insertPlayer.run(
      'ply_pune_002',
      'auc_pune_002',
      2,
      'MS "Captain Cool" Dhoni',
      'Wicketkeeper Batter',
      2000000,
      2000000,
      'UPCOMING',
      null,
      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=700&q=80',
      JSON.stringify({ matches: 350, strikeRate: 87.6, stumpings: 123, catches: 321, average: 50.57, bestScore: '183*' }),
      'Finisher extraordinaire, tactical mastermind, and the undisputed leader behind India and CSK legendary franchise championships.'
    );
    db.prepare("UPDATE auction_players SET nationality = 'India', is_overseas = 0, category = 'Legend', batting_style = 'Right-hand bat', bowling_style = 'Right-arm medium', age = 42, previous_team = 'Chennai Super Kings' WHERE id = 'ply_pune_002'").run();

    insertPlayer.run(
      'ply_pune_003',
      'auc_pune_002',
      3,
      'AB "Mr. 360" de Villiers',
      'Batter',
      1800000,
      1800000,
      'UPCOMING',
      null,
      'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=700&q=80',
      JSON.stringify({ matches: 228, strikeRate: 151.7, runs: 5162, centuries: 3, fifties: 40, bestScore: '133*' }),
      'South African batting wizard capable of hitting any delivery to any corner of the stadium. Irresistible crowd puller and game changer.'
    );
    db.prepare("UPDATE auction_players SET nationality = 'South Africa', is_overseas = 1, category = 'Overseas', batting_style = 'Right-hand bat', bowling_style = 'Right-arm medium', age = 39, previous_team = 'Royal Challengers Bengaluru' WHERE id = 'ply_pune_003'").run();

    insertPlayer.run(
      'ply_pune_004',
      'auc_pune_002',
      4,
      'Lasith "Slinga" Malinga',
      'Fast Bowler',
      1500000,
      1500000,
      'UPCOMING',
      null,
      'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?auto=format&fit=crop&w=700&q=80',
      JSON.stringify({ matches: 122, strikeRate: 16.6, wickets: 170, economy: 7.14, bestScore: '5/13' }),
      'The toe-crusher king from Sri Lanka. Unorthodox round-arm action, deadly dipping slower balls, and the most feared death bowler in franchise history.'
    );
    db.prepare("UPDATE auction_players SET nationality = 'Sri Lanka', is_overseas = 1, category = 'Overseas', batting_style = 'Right-hand bat', bowling_style = 'Right-arm fast roundarm', age = 40, previous_team = 'Mumbai Indians' WHERE id = 'ply_pune_004'").run();

    // 4c. Ensure Bangalore Rapid Draft Blitz Auction
    const blrRules = JSON.stringify({
      formatName: 'Rapid Draft Blitz',
      purseCap: 5000000,
      maxSquadSize: 10,
      minSquadSize: 7,
      overseasLimit: 2,
      countdownSeconds: 10,
      minBidIncrement: 10000
    });

    insertAuction.run(
      'auc_blr_003',
      null,
      'Bangalore Rapid Draft Blitz Auction 2027',
      'rapid_draft',
      'REGISTRATION_OPEN',
      'ply_blr_001',
      10,
      10,
      10000,
      10,
      7,
      5000000,
      blrRules
    );

    db.prepare(`
      UPDATE auction_rooms
      SET description = 'High-octane rapid-fire 10-second draft for Bangalore weekend club cricket & turf leagues. 4 tables, instant paddle bids.',
          cover_image_url = 'https://images.unsplash.com/photo-1531415074968-036ba1b575da?w=800&auto=format&fit=crop&q=80',
          format_category = 'rapid_draft',
          registration_fee = '₹349 (Includes Turf Slot & Beverage)',
          registration_status = 'open',
          overseas_limit = 2,
          bid_increment_slabs_json = '[{"upTo":1000000,"increment":10000},{"upTo":5000000,"increment":25000}]'
      WHERE id = 'auc_blr_003'
    `).run();

    // Bangalore Teams
    insertTeam.run('team_blr_1', 'auc_blr_003', 'Indiranagar Kings', 'Bangalore', '#EC4899', 5000000, 5000000, 0, 'Karthik Raja');
    insertTeam.run('team_blr_2', 'auc_blr_003', 'Koramangala Knights', 'Bangalore', '#14B8A6', 5000000, 5000000, 0, 'Manish Hegde');
    insertTeam.run('team_blr_3', 'auc_blr_003', 'Whitefield Challengers', 'Bangalore', '#F97316', 5000000, 5000000, 0, 'Praveen Rao');
    insertTeam.run('team_blr_4', 'auc_blr_003', 'MG Road Mavericks', 'Bangalore', '#6366F1', 5000000, 5000000, 0, 'Sanjay Gowda');

    // Bangalore Players
    insertPlayer.run(
      'ply_blr_001',
      'auc_blr_003',
      1,
      'Nikhil "Flash" Gowda',
      'Fast Bowler',
      250000,
      250000,
      'UPCOMING',
      null,
      'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=700&q=80',
      JSON.stringify({ matches: 28, strikeRate: 110.0, wickets: 44, economy: 6.4, communityReputation: 93 }),
      'Top wicket-taker in Indiranagar corporate box leagues. Lethal bouncer and aggressive presence.'
    );
    db.prepare("UPDATE auction_players SET nationality = 'India', is_overseas = 0, category = 'Bowler', batting_style = 'Right-hand bat', bowling_style = 'Right-arm fast', age = 23 WHERE id = 'ply_blr_001'").run();

    // 4d. Ensure Completed Autumn Auction for Historical Analytics & Reporting
    const pastRules = JSON.stringify({
      formatName: 'STROOM Premier League Format',
      purseCap: 10000000,
      maxSquadSize: 12,
      minSquadSize: 8,
      overseasLimit: 3
    });

    insertAuction.run(
      'auc_hyd_past',
      null,
      'STROOM Hyderabad Autumn Box Cup Auction 2025',
      'ipl_mock',
      'COMPLETED',
      'ply_past_001',
      15,
      15,
      25000,
      12,
      8,
      10000000,
      pastRules
    );

    db.prepare(`
      UPDATE auction_rooms
      SET description = 'Official completed tournament auction records, verified sales, and championship rosters from the Autumn 2025 season.',
          cover_image_url = 'https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?w=800&auto=format&fit=crop&q=80',
          format_category = 'ipl_mock',
          registration_fee = 'Free Archive View',
          registration_status = 'closed',
          overseas_limit = 3
      WHERE id = 'auc_hyd_past'
    `).run();

    insertTeam.run('team_past_1', 'auc_hyd_past', 'Jubilee Strikers', 'Hyderabad', '#FF7100', 10000000, 2400000, 8, 'Rahul Mehra');
    insertTeam.run('team_past_2', 'auc_hyd_past', 'Cyber City Royals', 'Hyderabad', '#10B981', 10000000, 3100000, 8, 'Imran Siddiqui');

    insertPlayer.run(
      'ply_past_001',
      'auc_hyd_past',
      1,
      'Karan "Sniper" Varma',
      'Batter',
      500000,
      2650000,
      'SOLD',
      'team_past_1',
      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=700&q=80',
      JSON.stringify({ matches: 40, strikeRate: 182.4, runs: 1280, bestScore: '92* (34b)' }),
      'Highest bid player of Autumn 2025 tournament. Propelled Jubilee Strikers to the championship.'
    );
    db.prepare("UPDATE auction_players SET nationality = 'India', is_overseas = 0, category = 'Batter', batting_style = 'Right-hand bat', sold_at = datetime('now', '-30 days') WHERE id = 'ply_past_001'").run();



    // 7. Coupons: Managed via partner & admin promotional campaigns

    // 8. Discovery Items: Real-time discovery derived from active communities & curated experiences









    // 10. Communities: Production clean state (created via genuine community formation & admin verification)




  });

  transaction();
}

function migratePhase5Tables() {
  try {
    // Upgrade legacy Phase 1 users table if CHECK(role IN ('user', 'admin')) restricts new roles (venue_partner, super_admin, etc.)
    const userTbl = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='users'").get() as { sql: string } | undefined;
    if (userTbl?.sql && /CHECK\s*\(\s*role\s+IN\s*\(\s*'user'\s*,\s*'admin'\s*\)\s*\)/i.test(userTbl.sql)) {
      const upgradedSql = userTbl.sql
        .replace(/CREATE TABLE(?:\s+IF NOT EXISTS)?\s+users/i, 'CREATE TABLE users_new')
        .replace(/CHECK\s*\(\s*role\s+IN\s*\(\s*'user'\s*,\s*'admin'\s*\)\s*\)/i, '');
      const cols = (db.prepare('PRAGMA table_info(users)').all() as { name: string }[]).map((c) => c.name);
      db.pragma('foreign_keys = OFF');
      db.transaction(() => {
        db.exec(upgradedSql);
        db.exec(`INSERT INTO users_new (${cols.join(', ')}) SELECT ${cols.join(', ')} FROM users`);
        db.exec('DROP TABLE users');
        db.exec('ALTER TABLE users_new RENAME TO users');
      })();
      db.pragma('foreign_keys = ON');
    }

    db.exec(`
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

      CREATE TABLE IF NOT EXISTS partner_users (
        id TEXT PRIMARY KEY,
        partner_id TEXT NOT NULL REFERENCES partner_accounts(id) ON DELETE CASCADE,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        partner_role TEXT NOT NULL DEFAULT 'manager' CHECK(partner_role IN ('owner', 'manager', 'staff', 'viewer')),
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(partner_id, user_id)
      );

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

      CREATE INDEX IF NOT EXISTS idx_partner_accounts_owner ON partner_accounts(owner_user_id);
      CREATE INDEX IF NOT EXISTS idx_partner_users_user ON partner_users(user_id);
      CREATE INDEX IF NOT EXISTS idx_venue_avail_venue_date ON venue_availability(venue_id, date);
      CREATE INDEX IF NOT EXISTS idx_collabs_partner ON partner_collaborations(partner_id);
      CREATE INDEX IF NOT EXISTS idx_partner_comms_partner ON partner_communications(partner_id);
      CREATE INDEX IF NOT EXISTS idx_partner_audit_partner ON partner_audit_logs(partner_id);
    `);

    // Extend existing tables idempotently
    const venueCols = (db.prepare('PRAGMA table_info(venues)').all() as { name: string }[]).map(c => c.name);
    if (!venueCols.includes('partner_id')) db.prepare('ALTER TABLE venues ADD COLUMN partner_id TEXT REFERENCES partner_accounts(id)').run();
    if (!venueCols.includes('photos_json')) db.prepare("ALTER TABLE venues ADD COLUMN photos_json TEXT DEFAULT '[]'").run();
    if (!venueCols.includes('facilities_json')) db.prepare("ALTER TABLE venues ADD COLUMN facilities_json TEXT DEFAULT '[]'").run();
    if (!venueCols.includes('event_spaces_json')) db.prepare("ALTER TABLE venues ADD COLUMN event_spaces_json TEXT DEFAULT '[]'").run();
    if (!venueCols.includes('operating_hours')) db.prepare("ALTER TABLE venues ADD COLUMN operating_hours TEXT DEFAULT '09:00 AM - 11:00 PM'").run();
    if (!venueCols.includes('accessibility_info')) db.prepare("ALTER TABLE venues ADD COLUMN accessibility_info TEXT DEFAULT 'Wheelchair accessible ground entrance & elevator access'").run();
    if (!venueCols.includes('maps_url')) db.prepare('ALTER TABLE venues ADD COLUMN maps_url TEXT').run();
    if (!venueCols.includes('status')) db.prepare("ALTER TABLE venues ADD COLUMN status TEXT DEFAULT 'active'").run();

    const couponCols = (db.prepare('PRAGMA table_info(coupons)').all() as { name: string }[]).map(c => c.name);
    if (!couponCols.includes('partner_id')) db.prepare('ALTER TABLE coupons ADD COLUMN partner_id TEXT REFERENCES partner_accounts(id)').run();
    if (!couponCols.includes('offer_category')) db.prepare("ALTER TABLE coupons ADD COLUMN offer_category TEXT DEFAULT 'percentage'").run();
    if (!couponCols.includes('min_purchase')) db.prepare('ALTER TABLE coupons ADD COLUMN min_purchase REAL DEFAULT 0').run();
    if (!couponCols.includes('valid_from')) db.prepare('ALTER TABLE coupons ADD COLUMN valid_from TEXT').run();
    if (!couponCols.includes('eligible_event_id')) db.prepare('ALTER TABLE coupons ADD COLUMN eligible_event_id TEXT').run();
    if (!couponCols.includes('eligible_audience')) db.prepare("ALTER TABLE coupons ADD COLUMN eligible_audience TEXT DEFAULT 'all_members'").run();
    if (!couponCols.includes('terms_conditions')) db.prepare('ALTER TABLE coupons ADD COLUMN terms_conditions TEXT').run();
    if (!couponCols.includes('image_url')) db.prepare('ALTER TABLE coupons ADD COLUMN image_url TEXT').run();
    if (!couponCols.includes('approval_status')) db.prepare("ALTER TABLE coupons ADD COLUMN approval_status TEXT DEFAULT 'Active'").run();
    if (!couponCols.includes('impressions')) db.prepare('ALTER TABLE coupons ADD COLUMN impressions INTEGER DEFAULT 0').run();
    if (!couponCols.includes('created_by')) db.prepare('ALTER TABLE coupons ADD COLUMN created_by TEXT').run();

    const redCols = (db.prepare('PRAGMA table_info(coupon_redemptions)').all() as { name: string }[]).map(c => c.name);
    if (!redCols.includes('partner_id')) db.prepare('ALTER TABLE coupon_redemptions ADD COLUMN partner_id TEXT REFERENCES partner_accounts(id)').run();
    if (!redCols.includes('event_id')) db.prepare('ALTER TABLE coupon_redemptions ADD COLUMN event_id TEXT').run();
    if (!redCols.includes('pass_code')) db.prepare('ALTER TABLE coupon_redemptions ADD COLUMN pass_code TEXT').run();
    if (!redCols.includes('purchase_verified')) db.prepare('ALTER TABLE coupon_redemptions ADD COLUMN purchase_verified INTEGER DEFAULT 0').run();

    const eventCols = (db.prepare('PRAGMA table_info(events)').all() as { name: string }[]).map(c => c.name);
    if (!eventCols.includes('partner_operational_notes')) db.prepare('ALTER TABLE events ADD COLUMN partner_operational_notes TEXT').run();

    // Partner accounts, venues, collaborations, and campaigns: Production clean state (created via genuine partner applications & admin approvals)
  } catch (err) {
    console.warn('[migratePhase5Tables] Notice:', err);
  }
}

function migratePhase6Tables() {
  try {
    db.exec(`
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

      CREATE TABLE IF NOT EXISTS payment_transactions (
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

      CREATE TABLE IF NOT EXISTS platform_settings (
        key TEXT PRIMARY KEY,
        category TEXT NOT NULL,
        value_json TEXT NOT NULL,
        description TEXT,
        updated_by TEXT,
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_community_posts_status ON community_posts(status);
      CREATE INDEX IF NOT EXISTS idx_payments_user_event ON payment_transactions(user_id, event_id);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at);
    `);

    const userCols = (db.prepare('PRAGMA table_info(users)').all() as { name: string }[]).map((c) => c.name);
    if (!userCols.includes('account_status')) {
      db.prepare("ALTER TABLE users ADD COLUMN account_status TEXT NOT NULL DEFAULT 'active'").run();
    }

    const cityCols = (db.prepare('PRAGMA table_info(cities)').all() as { name: string }[]).map((c) => c.name);
    if (!cityCols.includes('description')) db.prepare('ALTER TABLE cities ADD COLUMN description TEXT').run();
    if (!cityCols.includes('image_url')) db.prepare('ALTER TABLE cities ADD COLUMN image_url TEXT').run();
    if (!cityCols.includes('is_featured')) db.prepare('ALTER TABLE cities ADD COLUMN is_featured INTEGER DEFAULT 0').run();

    const eventCols = (db.prepare('PRAGMA table_info(events)').all() as { name: string }[]).map((c) => c.name);
    if (!eventCols.includes('end_time')) db.prepare('ALTER TABLE events ADD COLUMN end_time TEXT').run();
    if (!eventCols.includes('organizer_name')) db.prepare("ALTER TABLE events ADD COLUMN organizer_name TEXT DEFAULT 'STROOM Experiences'").run();
    if (!eventCols.includes('registration_deadline')) db.prepare('ALTER TABLE events ADD COLUMN registration_deadline TEXT').run();
    if (!eventCols.includes('visibility')) db.prepare("ALTER TABLE events ADD COLUMN visibility TEXT DEFAULT 'public'").run();
    if (!eventCols.includes('eligibility_requirements')) db.prepare('ALTER TABLE events ADD COLUMN eligibility_requirements TEXT').run();
    if (!eventCols.includes('is_archived')) db.prepare('ALTER TABLE events ADD COLUMN is_archived INTEGER DEFAULT 0').run();

    const commCols = (db.prepare('PRAGMA table_info(communities)').all() as { name: string }[]).map((c) => c.name);
    if (!commCols.includes('status')) db.prepare("ALTER TABLE communities ADD COLUMN status TEXT DEFAULT 'published'").run();
    if (!commCols.includes('manager_user_id')) db.prepare('ALTER TABLE communities ADD COLUMN manager_user_id TEXT').run();

    const auditCols = (db.prepare('PRAGMA table_info(audit_logs)').all() as { name: string }[]).map((c) => c.name);
    if (!auditCols.includes('actor_name')) db.prepare('ALTER TABLE audit_logs ADD COLUMN actor_name TEXT').run();
    if (!auditCols.includes('actor_role')) db.prepare('ALTER TABLE audit_logs ADD COLUMN actor_role TEXT').run();
    if (!auditCols.includes('before_json')) db.prepare('ALTER TABLE audit_logs ADD COLUMN before_json TEXT').run();
    if (!auditCols.includes('after_json')) db.prepare('ALTER TABLE audit_logs ADD COLUMN after_json TEXT').run();
    if (!auditCols.includes('result')) db.prepare("ALTER TABLE audit_logs ADD COLUMN result TEXT DEFAULT 'success'").run();
    if (!auditCols.includes('source')) db.prepare("ALTER TABLE audit_logs ADD COLUMN source TEXT DEFAULT 'admin_api'").run();

    // Update city defaults for Hyderabad & Pune as initial launch hubs
    db.prepare("UPDATE cities SET is_featured = 1, description = COALESCE(description, 'Flagship STROOM Launch City — Cricket Auctions, Cafés & Founders Circles'), image_url = COALESCE(image_url, 'https://images.unsplash.com/photo-1588416936097-41850ab3d86d?w=800&auto=format&fit=crop&q=80') WHERE id = 'city_hyd'").run();
    db.prepare("UPDATE cities SET is_featured = 1, description = COALESCE(description, 'Premier Expansion Hub — Heritage Cafés, Gaming & Sahyadri Trails'), image_url = COALESCE(image_url, 'https://images.unsplash.com/photo-1567157577867-05ccb1388e66?w=800&auto=format&fit=crop&q=80') WHERE id = 'city_pune'").run();

    // Seed default platform settings (strictly non-secret operational defaults)
    const insertSetting = db.prepare(`
      INSERT OR IGNORE INTO platform_settings (key, category, value_json, description, updated_by)
      VALUES (?, ?, ?, ?, 'system')
    `);
    insertSetting.run('general', 'General', JSON.stringify({
      platformName: 'STROOM — Strangers Room',
      tagline: 'Strangers Today. Stories Tomorrow.',
      supportEmail: 'hello@stroom.club',
      defaultCity: 'Hyderabad',
      defaultTimezone: 'Asia/Kolkata (IST)',
    }), 'Core platform identity and regional defaults');
    insertSetting.run('events', 'Event Settings', JSON.stringify({
      defaultCapacity: 60,
      defaultVisibility: 'public',
      requireQrCheckinForStamps: true,
      allowWaitlist: true,
    }), 'Default parameters for newly created experiences');
    insertSetting.run('members', 'Member Settings', JSON.stringify({
      defaultProfilePublic: true,
      requireVibeQuizOnSignup: false,
      allowPublicPassportSharing: true,
    }), 'Member onboarding and profile defaults');
    insertSetting.run('partners', 'Partner Settings', JSON.stringify({
      requireAdminVerification: true,
      requireCampaignApproval: true,
      defaultCollaborationTarget: 50,
    }), 'Partner verification and campaign governance rules');
    insertSetting.run('notifications', 'Notification Settings', JSON.stringify({
      inAppEnabled: true,
      emailProviderStatus: 'Not configured (In-App delivery active)',
      smsProviderStatus: 'Not configured',
      respectMemberOptOuts: true,
    }), 'Messaging delivery configuration');


  } catch (err) {
    console.warn('[migratePhase6Tables] Notice:', err);
  }
}

function migrateHistoricalEventRestrictions() {
  const tablesToHarden: Array<{
    name: string;
    matchUnsafe: RegExp;
    transformSql: (sql: string) => string;
    postIndexes: string[];
  }> = [
    {
      name: 'event_registrations',
      matchUnsafe: /REFERENCES\s+events\s*\(\s*id\s*\)\s+ON\s+DELETE\s+CASCADE/i,
      transformSql: (sql) =>
        sql.replace(/REFERENCES\s+events\s*\(\s*id\s*\)\s+ON\s+DELETE\s+CASCADE/i, 'REFERENCES events(id) ON DELETE RESTRICT'),
      postIndexes: [
        'CREATE INDEX IF NOT EXISTS idx_registrations_user ON event_registrations(user_id)',
        'CREATE INDEX IF NOT EXISTS idx_registrations_event ON event_registrations(event_id)',
      ],
    },
    {
      name: 'passport_stamps',
      matchUnsafe: /REFERENCES\s+events\s*\(\s*id\s*\)\s+ON\s+DELETE\s+CASCADE/i,
      transformSql: (sql) =>
        sql.replace(/REFERENCES\s+events\s*\(\s*id\s*\)\s+ON\s+DELETE\s+CASCADE/i, 'REFERENCES events(id) ON DELETE RESTRICT'),
      postIndexes: [
        'CREATE INDEX IF NOT EXISTS idx_passport_stamps_user ON passport_stamps(user_id)',
      ],
    },
    {
      name: 'auction_rooms',
      matchUnsafe: /(?:event_id\s+TEXT\s+(?:UNIQUE\s+)?NOT\s+NULL|REFERENCES\s+events\s*\(\s*id\s*\)\s+ON\s+DELETE\s+(?:CASCADE|RESTRICT))/i,
      transformSql: (sql) =>
        sql
          .replace(/event_id\s+TEXT\s+(?:UNIQUE\s+)?NOT\s+NULL\s+REFERENCES\s+events\s*\(\s*id\s*\)\s+ON\s+DELETE\s+(?:CASCADE|RESTRICT)/i, 'event_id TEXT REFERENCES events(id) ON DELETE SET NULL')
          .replace(/REFERENCES\s+events\s*\(\s*id\s*\)\s+ON\s+DELETE\s+(?:CASCADE|RESTRICT)/i, 'REFERENCES events(id) ON DELETE SET NULL'),
      postIndexes: [
        'CREATE INDEX IF NOT EXISTS idx_auction_rooms_status ON auction_rooms(status)',
      ],
    },
    {
      name: 'payment_transactions',
      matchUnsafe: /REFERENCES\s+(events|event_registrations)\s*\(\s*id\s*\)\s+ON\s+DELETE\s+SET\s+NULL/i,
      transformSql: (sql) =>
        sql
          .replace(/REFERENCES\s+events\s*\(\s*id\s*\)\s+ON\s+DELETE\s+SET\s+NULL/gi, 'REFERENCES events(id) ON DELETE RESTRICT')
          .replace(/REFERENCES\s+event_registrations\s*\(\s*id\s*\)\s+ON\s+DELETE\s+SET\s+NULL/gi, 'REFERENCES event_registrations(id) ON DELETE RESTRICT'),
      postIndexes: [
        'CREATE INDEX IF NOT EXISTS idx_payments_user_event ON payment_transactions(user_id, event_id)',
      ],
    },
  ];

  for (const tbl of tablesToHarden) {
    try {
      const row = db
        .prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name = ?")
        .get(tbl.name) as { sql: string } | undefined;
      if (!row?.sql || !tbl.matchUnsafe.test(row.sql)) continue;

      const cols = (db.prepare(`PRAGMA table_info(${tbl.name})`).all() as { name: string }[]).map((c) => c.name);
      const createNewSql = tbl
        .transformSql(row.sql)
        .replace(new RegExp(`CREATE\\s+TABLE(?:\\s+IF\\s+NOT\\s+EXISTS)?\\s+${tbl.name}`, 'i'), `CREATE TABLE ${tbl.name}_restricted_new`);

      db.pragma('foreign_keys = OFF');
      try {
        db.transaction(() => {
          db.exec(createNewSql);
          db.exec(`INSERT INTO ${tbl.name}_restricted_new (${cols.join(', ')}) SELECT ${cols.join(', ')} FROM ${tbl.name}`);
          db.exec(`DROP TABLE ${tbl.name}`);
          db.exec(`ALTER TABLE ${tbl.name}_restricted_new RENAME TO ${tbl.name}`);
          for (const idxSql of tbl.postIndexes) {
            db.exec(idxSql);
          }
        })();
      } finally {
        db.pragma('foreign_keys = ON');
      }
    } catch (err) {
      console.warn(`[migrateHistoricalEventRestrictions] Notice upgrading ${tbl.name}:`, err);
    }
  }
}
