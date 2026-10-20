import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

const DATA_DIR = path.resolve(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, 'stroom.db');
export const db = new Database(DB_PATH);

// Enable WAL mode and foreign keys for high performance and ACID integrity
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function initDatabase() {
  const schema = `
    -- Users table
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      full_name TEXT NOT NULL,
      avatar_url TEXT,
      role TEXT NOT NULL DEFAULT 'user' CHECK(role IN ('user', 'admin')),
      onboarding_status TEXT NOT NULL DEFAULT 'NOT_STARTED' CHECK(onboarding_status IN ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
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

    -- Quiz Versions (supports immutable published versions and editable drafts)
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

    -- Responses to questions within a session
    CREATE TABLE IF NOT EXISTS responses (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES quiz_sessions(id) ON DELETE CASCADE,
      question_id TEXT NOT NULL REFERENCES questions(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(session_id, question_id)
    );

    -- Selected options for responses (supports multi-select)
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

    -- Social Discovery Items (Communities, Events, People, Trips)
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

    -- Indexes for fast query lookup
    CREATE INDEX IF NOT EXISTS idx_versions_quiz ON quiz_versions(quiz_id, publication_status);
    CREATE INDEX IF NOT EXISTS idx_questions_version ON questions(quiz_version_id, display_order);
    CREATE INDEX IF NOT EXISTS idx_options_question ON options(question_id, display_order);
    CREATE INDEX IF NOT EXISTS idx_sessions_user ON quiz_sessions(user_id, status);
    CREATE INDEX IF NOT EXISTS idx_responses_session ON responses(session_id);
    CREATE INDEX IF NOT EXISTS idx_preferences_user ON user_preferences(user_id);
  `;

  db.exec(schema);
  seedInitialData();
}

// Password hashing utility using Node crypto (SHA-256 with salt)
export function hashPassword(password: string): string {
  const salt = 'stroom_vibe_salt_2026';
  return crypto.createHash('sha256').update(password + salt).digest('hex');
}

export function seedInitialData() {
  const countUsers = db.prepare('SELECT count(*) as count FROM users').get() as { count: number };
  if (countUsers.count > 0) {
    return; // Already seeded
  }

  const transaction = db.transaction(() => {
    // 1. Seed Users: Admin and Regular Demo User
    const adminId = 'usr_admin_001';
    const regularUserId = 'usr_regular_001';

    const insertUser = db.prepare(`
      INSERT INTO users (id, email, password_hash, full_name, avatar_url, role, onboarding_status)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    insertUser.run(
      adminId,
      'admin@stroom.app',
      hashPassword('Admin@123'),
      'Alex Rivera (Admin)',
      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
      'admin',
      'COMPLETED'
    );

    insertUser.run(
      regularUserId,
      'user@stroom.app',
      hashPassword('User@123'),
      'Sam Taylor',
      'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150&auto=format&fit=crop&q=80',
      'user',
      'NOT_STARTED'
    );

    // 2. Seed Vibe Quiz & Published Version 1
    const quizId = 'quiz_vibe_001';
    const version1Id = 'qver_001_published';
    const draftVersionId = 'qver_002_draft';

    db.prepare(`
      INSERT INTO quizzes (id, title, description, status)
      VALUES (?, ?, ?, ?)
    `).run(
      quizId,
      'Stroom Vibe Quiz',
      'Personalize your social discovery journey and connect with your vibe communities.',
      'active'
    );

    // Published Version 1
    db.prepare(`
      INSERT INTO quiz_versions (id, quiz_id, version_number, publication_status, published_at, created_by)
      VALUES (?, ?, ?, 'published', datetime('now'), ?)
    `).run(version1Id, quizId, 1, 'Alex Rivera');

    // Questions for Version 1
    const insertQuestion = db.prepare(`
      INSERT INTO questions (id, quiz_version_id, question_text, description, question_type, is_required, min_selections, max_selections, display_order, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertOption = db.prepare(`
      INSERT INTO options (id, question_id, label, stable_value, display_order, is_active)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    // Q1
    const q1Id = 'q1_focus';
    insertQuestion.run(
      q1Id,
      version1Id,
      "What's your main focus right now?",
      "Choose what you'd love to experience most on Stroom.",
      'single',
      1,
      1,
      1,
      1,
      1
    );
    insertOption.run('opt_q1_1', q1Id, 'Exploring new communities', 'communities', 1, 1);
    insertOption.run('opt_q1_2', q1Id, 'Making genuine new friends', 'friendship', 2, 1);
    insertOption.run('opt_q1_3', q1Id, 'Joining social meetups & events', 'social_meetups', 3, 1);
    insertOption.run('opt_q1_4', q1Id, 'Travel, trips & weekend getaways', 'travel_adventure', 4, 1);
    insertOption.run('opt_q1_5', q1Id, 'Creative & business networking', 'professional_networking', 5, 1);

    // Q2
    const q2Id = 'q2_connections';
    insertQuestion.run(
      q2Id,
      version1Id,
      'What kind of connections are you looking for?',
      'Select up to 3 types of people you click with best.',
      'multiple',
      1,
      1,
      3,
      2,
      1
    );
    insertOption.run('opt_q2_1', q2Id, 'Like-minded souls & deep thinkers', 'like_minded', 1, 1);
    insertOption.run('opt_q2_2', q2Id, 'Casual hangouts & dinner buddies', 'friendship', 2, 1);
    insertOption.run('opt_q2_3', q2Id, 'Active partners for sports & outdoor', 'activity_partners', 3, 1);
    insertOption.run('opt_q2_4', q2Id, 'Co-creators & professional peers', 'professional_networking', 4, 1);

    // Q3
    const q3Id = 'q3_weekend';
    insertQuestion.run(
      q3Id,
      version1Id,
      "What's your ideal weekend vibe?",
      'How do you recharge and have the best time?',
      'single',
      1,
      1,
      1,
      3,
      1
    );
    insertOption.run('opt_q3_1', q3Id, 'Exploring new hidden spots & cities', 'travel_adventure', 1, 1);
    insertOption.run('opt_q3_2', q3Id, 'Outdoor hikes, nature & adventures', 'outdoor_adventures', 2, 1);
    insertOption.run('opt_q3_3', q3Id, 'Bustling social events, music & parties', 'social_events', 3, 1);
    insertOption.run('opt_q3_4', q3Id, 'Learning new crafts, arts or skills', 'skills_growth', 4, 1);
    insertOption.run('opt_q3_5', q3Id, 'Cozy coffee, brunch & relaxing with friends', 'casual_hangouts', 5, 1);

    // Q4
    const q4Id = 'q4_communities';
    insertQuestion.run(
      q4Id,
      version1Id,
      'Which communities interest you most?',
      'Select any that spark your curiosity (optional).',
      'multiple',
      0, // optional
      0,
      4,
      4,
      1
    );
    insertOption.run('opt_q4_1', q4Id, 'Travelers & Nomads', 'travel_adventure', 1, 1);
    insertOption.run('opt_q4_2', q4Id, 'Creative Minds & Designers', 'creativity', 2, 1);
    insertOption.run('opt_q4_3', q4Id, 'Fitness, Running & Wellness', 'fitness_wellness', 3, 1);
    insertOption.run('opt_q4_4', q4Id, 'Tech Innovators & Entrepreneurs', 'entrepreneurship', 4, 1);
    insertOption.run('opt_q4_5', q4Id, 'Foodies & Local Culture Lovers', 'food_culture', 5, 1);

    // Also seed Draft Version 2 so Admin CMS has an immediate draft version to edit or preview
    db.prepare(`
      INSERT INTO quiz_versions (id, quiz_id, version_number, publication_status, created_by)
      VALUES (?, ?, ?, 'draft', ?)
    `).run(draftVersionId, quizId, 2, 'Alex Rivera');

    // Clone questions into Draft
    const draftQuestions = db.prepare('SELECT * FROM questions WHERE quiz_version_id = ?').all(version1Id) as any[];
    for (const q of draftQuestions) {
      const newQId = 'draft_' + q.id;
      insertQuestion.run(
        newQId,
        draftVersionId,
        q.question_text,
        q.description,
        q.question_type,
        q.is_required,
        q.min_selections,
        q.max_selections,
        q.display_order,
        q.is_active
      );
      const qOptions = db.prepare('SELECT * FROM options WHERE question_id = ?').all(q.id) as any[];
      for (const opt of qOptions) {
        insertOption.run(
          'draft_' + opt.id,
          newQId,
          opt.label,
          opt.stable_value,
          opt.display_order,
          opt.is_active
        );
      }
    }

    // 3. Seed Rich Social Discovery Items
    const insertDiscovery = db.prepare(`
      INSERT INTO discovery_items (id, type, title, subtitle, description, image_url, category, tags, location, member_count, date_time)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const discoveryData = [
      {
        id: 'disc_001',
        type: 'community',
        title: 'Euro Nomads & Explorers',
        subtitle: '1,420 adventurous members',
        description: 'For remote workers, weekend wanderers, and spontaneous travel lovers exploring European cities and nature trails.',
        image_url: 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=800&auto=format&fit=crop&q=80',
        category: 'Travel & Adventure',
        tags: JSON.stringify(['travel_adventure', 'outdoor_adventures', 'like_minded']),
        location: 'Amsterdam & Remote',
        member_count: 1420,
        date_time: 'Active daily'
      },
      {
        id: 'disc_002',
        type: 'event',
        title: 'Sunset Rooftop Drinks & Music',
        subtitle: 'Friday, 7:00 PM • Skylight Lounge',
        description: 'Meet warm, welcoming locals and newcomers for an evening of chilled house beats, great craft drinks, and casual conversations.',
        image_url: 'https://images.unsplash.com/photo-1517457373958-b7bdd4587205?w=800&auto=format&fit=crop&q=80',
        category: 'Social Meetup',
        tags: JSON.stringify(['social_meetups', 'social_events', 'friendship', 'casual_hangouts']),
        location: 'Canal District, Amsterdam',
        member_count: 85,
        date_time: 'This Friday • 19:00'
      },
      {
        id: 'disc_003',
        type: 'community',
        title: 'Sunrise Trail Runners & Hikers',
        subtitle: '680 active members',
        description: 'A friendly community of weekend trail runners, hikers, and fitness enthusiasts of all paces. We run, then we get coffee.',
        image_url: 'https://images.unsplash.com/photo-1551632811-561732d1e306?w=800&auto=format&fit=crop&q=80',
        category: 'Fitness & Wellness',
        tags: JSON.stringify(['fitness_wellness', 'outdoor_adventures', 'activity_partners']),
        location: 'Vondelpark & Amsterdamse Bos',
        member_count: 680,
        date_time: 'Every Sat & Sun 09:00'
      },
      {
        id: 'disc_004',
        type: 'community',
        title: 'Creative Minds & Visual Artists',
        subtitle: '910 creators',
        description: 'Designers, illustrators, filmmakers, and digital artists collaborating on passion projects and sharing gallery walks.',
        image_url: 'https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=800&auto=format&fit=crop&q=80',
        category: 'Creativity',
        tags: JSON.stringify(['creativity', 'like_minded', 'skills_growth']),
        location: 'NDSM Wharf, Amsterdam',
        member_count: 910,
        date_time: 'Bi-weekly meetups'
      },
      {
        id: 'disc_005',
        type: 'event',
        title: 'Tech Founders & Indie Builders Coffee',
        subtitle: 'Tuesday, 8:30 AM • Coffee & Coconuts',
        description: 'An informal morning roundtable for software engineers, product founders, and entrepreneurs sharing growth experiments.',
        image_url: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=800&auto=format&fit=crop&q=80',
        category: 'Professional Networking',
        tags: JSON.stringify(['professional_networking', 'entrepreneurship', 'skills_growth']),
        location: 'De Pijp, Amsterdam',
        member_count: 42,
        date_time: 'Next Tuesday • 08:30'
      },
      {
        id: 'disc_006',
        type: 'person',
        title: 'Elena Vance, 27',
        subtitle: 'UX Researcher & Travel Photographer',
        description: 'Passionate about film cameras, finding the best specialty coffee, and planning train trips across Europe. Looking for weekend explore buddies!',
        image_url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=800&auto=format&fit=crop&q=80',
        category: 'Like-Minded Person',
        tags: JSON.stringify(['travel_adventure', 'creativity', 'friendship', 'casual_hangouts']),
        location: 'Amsterdam Centre',
        member_count: 0,
        date_time: 'Active now'
      },
      {
        id: 'disc_007',
        type: 'person',
        title: 'Marcus Lindqvist, 30',
        subtitle: 'Fintech Engineer & Marathon Runner',
        description: 'Always up for a 10k morning jog or checking out indie electronic DJ sets. Looking for running partners and concert buddies.',
        image_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&auto=format&fit=crop&q=80',
        category: 'Activity Partner',
        tags: JSON.stringify(['fitness_wellness', 'activity_partners', 'social_events', 'entrepreneurship']),
        location: 'Amsterdam Zuid',
        member_count: 0,
        date_time: 'Active 2h ago'
      },
      {
        id: 'disc_008',
        type: 'trip',
        title: 'Alpine Weekend Getaway & Cabin Retreat',
        subtitle: 'Nov 14-17 • 6 spots left',
        description: 'A cozy 4-day retreat in the Bavarian Alps. Fresh mountain air, group hikes, warm fireside fondue, and breathtaking star-gazing.',
        image_url: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800&auto=format&fit=crop&q=80',
        category: 'Travel & Trips',
        tags: JSON.stringify(['travel_adventure', 'outdoor_adventures', 'like_minded', 'friendship']),
        location: 'Bavaria, Germany',
        member_count: 8,
        date_time: 'Nov 14 - 17'
      }
    ];

    for (const item of discoveryData) {
      insertDiscovery.run(
        item.id,
        item.type,
        item.title,
        item.subtitle,
        item.description,
        item.image_url,
        item.category,
        item.tags,
        item.location,
        item.member_count,
        item.date_time
      );
    }
  });

  transaction();
  console.log('[Database] Schema initialized and seeded with default data.');
}
