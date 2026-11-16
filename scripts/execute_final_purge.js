const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const dbPath = path.join(__dirname, '..', 'data', 'stroom.db');
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupPath = path.join(__dirname, '..', 'backups', `stroom-backup-final-purge-${timestamp}.db`);

if (!fs.existsSync(path.dirname(backupPath))) {
  fs.mkdirSync(path.dirname(backupPath), { recursive: true });
}

// 1. Create verified backup
console.log(`Backing up ${dbPath} to ${backupPath}...`);
fs.copyFileSync(dbPath, backupPath);
const backupDb = new Database(backupPath);
const backupCheck = backupDb.prepare('PRAGMA integrity_check').all();
backupDb.close();
if (backupCheck[0]?.integrity_check !== 'ok') {
  throw new Error('Backup failed integrity check!');
}
console.log('Backup verified OK.');

// 2. Open active database
const db = new Database(dbPath);
console.log('Executing database final purge transaction...');

db.pragma('foreign_keys = OFF');

db.transaction(() => {
  // A. Harden and migrate auction_rooms table schema
  console.log('Migrating auction_rooms table to support nullable event_id ON DELETE SET NULL...');
  db.exec(`
    CREATE TABLE IF NOT EXISTS auction_rooms_new (
      id TEXT PRIMARY KEY,
      event_id TEXT REFERENCES events(id) ON DELETE SET NULL,
      title TEXT NOT NULL,
      format_type TEXT NOT NULL DEFAULT 'stroom_premier',
      status TEXT NOT NULL DEFAULT 'SCHEDULED',
      current_player_id TEXT,
      countdown_seconds INTEGER NOT NULL DEFAULT 15,
      auto_extend_seconds INTEGER NOT NULL DEFAULT 15,
      min_bid_increment INTEGER NOT NULL DEFAULT 25000,
      max_squad_size INTEGER NOT NULL DEFAULT 15,
      min_squad_size INTEGER NOT NULL DEFAULT 8,
      team_purse_cap INTEGER NOT NULL DEFAULT 10000000,
      rules_json TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      description TEXT,
      cover_image_url TEXT,
      format_category TEXT DEFAULT 'ipl_mock',
      registration_fee TEXT DEFAULT 'Free / Included with Community Pass',
      registration_status TEXT DEFAULT 'open',
      overseas_limit INTEGER DEFAULT 4,
      bid_increment_slabs_json TEXT
    );

    INSERT INTO auction_rooms_new (
      id, event_id, title, format_type, status, current_player_id,
      countdown_seconds, auto_extend_seconds, min_bid_increment, max_squad_size,
      min_squad_size, team_purse_cap, rules_json, created_at, description,
      cover_image_url, format_category, registration_fee, registration_status,
      overseas_limit, bid_increment_slabs_json
    )
    SELECT
      id, event_id, title, format_type, status, current_player_id,
      countdown_seconds, auto_extend_seconds, min_bid_increment, max_squad_size,
      min_squad_size, team_purse_cap, rules_json, created_at, description,
      cover_image_url, format_category, registration_fee, registration_status,
      overseas_limit, bid_increment_slabs_json
    FROM auction_rooms;

    DROP TABLE auction_rooms;
    ALTER TABLE auction_rooms_new RENAME TO auction_rooms;
    CREATE INDEX IF NOT EXISTS idx_auction_rooms_status ON auction_rooms(status);
  `);

  // B. Decouple historical auction rooms from demo events
  db.prepare("UPDATE auction_rooms SET event_id = NULL WHERE id IN ('auc_hyd_001', 'auc_pune_002', 'auc_blr_003', 'auc_hyd_past')").run();

  // C. Delete automated E2E test auction rooms and their test bids/players/teams
  const e2eRooms = ['auc_4b26b462-0', 'auc_8262c57b-a'];
  for (const rid of e2eRooms) {
    db.prepare('DELETE FROM bids WHERE player_id IN (SELECT id FROM auction_players WHERE auction_id = ?)').run(rid);
    db.prepare('DELETE FROM auction_players WHERE auction_id = ?').run(rid);
    db.prepare('DELETE FROM auction_teams WHERE auction_id = ?').run(rid);
    db.prepare('DELETE FROM auction_rooms WHERE id = ?').run(rid);
  }

  // D. Delete synthetic event submissions
  db.prepare("DELETE FROM event_submissions WHERE organizer_email = 'vikram.reddy@teststroom.com' OR id LIKE 'SUB-MWJ%'").run();

  // E. Delete demo partner ecosystem records
  db.prepare('DELETE FROM partner_communications').run();
  db.prepare('DELETE FROM partner_audit_logs').run();
  db.prepare('DELETE FROM venue_availability').run();
  db.prepare('DELETE FROM partner_collaborations').run();
  db.prepare('DELETE FROM partner_users').run();
  db.prepare('DELETE FROM partner_accounts').run();

  // F. Delete demo community posts and communities
  db.prepare('DELETE FROM community_posts').run();
  db.prepare('DELETE FROM community_members').run();
  db.prepare('DELETE FROM communities').run();

  // G. Delete demo discovery items
  db.prepare('DELETE FROM discovery_items').run();

  // H. Delete demo coupons and redemptions
  db.prepare('DELETE FROM coupon_redemptions').run();
  db.prepare('DELETE FROM coupons').run();

  // I. Delete demo events and related registrations/payments (already 0)
  db.prepare('DELETE FROM payment_transactions WHERE event_id IS NOT NULL').run();
  db.prepare('DELETE FROM passport_stamps WHERE event_id IS NOT NULL').run();
  db.prepare('DELETE FROM event_registrations').run();
  db.prepare('DELETE FROM events').run();

  // J. Delete demo venues
  db.prepare('DELETE FROM venues').run();
})();

db.pragma('foreign_keys = ON');

// 3. Post-cleanup validation
console.log('Running post-cleanup integrity & foreign-key checks...');
const fkViolations = db.prepare('PRAGMA foreign_key_check').all();
console.log('FK Violations:', fkViolations.length);
if (fkViolations.length > 0) {
  console.error('FK Violations found:', fkViolations);
  throw new Error('Foreign key violations detected after purge!');
}

const integrity = db.prepare('PRAGMA integrity_check').all();
console.log('Integrity check result:', integrity[0]?.integrity_check);
if (integrity[0]?.integrity_check !== 'ok') {
  throw new Error('Integrity check failed!');
}

const finalCounts = {
  users: db.prepare('SELECT COUNT(*) as c FROM users').get().c,
  events: db.prepare('SELECT COUNT(*) as c FROM events').get().c,
  communities: db.prepare('SELECT COUNT(*) as c FROM communities').get().c,
  venues: db.prepare('SELECT COUNT(*) as c FROM venues').get().c,
  coupons: db.prepare('SELECT COUNT(*) as c FROM coupons').get().c,
  discovery_items: db.prepare('SELECT COUNT(*) as c FROM discovery_items').get().c,
  partner_accounts: db.prepare('SELECT COUNT(*) as c FROM partner_accounts').get().c,
  partner_collaborations: db.prepare('SELECT COUNT(*) as c FROM partner_collaborations').get().c,
  partner_proposals: db.prepare('SELECT COUNT(*) as c FROM partner_proposals').get().c,
  event_submissions: db.prepare('SELECT COUNT(*) as c FROM event_submissions').get().c,
  auction_rooms: db.prepare('SELECT COUNT(*) as c FROM auction_rooms').get().c,
  auction_players: db.prepare('SELECT COUNT(*) as c FROM auction_players').get().c,
  auction_teams: db.prepare('SELECT COUNT(*) as c FROM auction_teams').get().c,
  bids: db.prepare('SELECT COUNT(*) as c FROM bids').get().c,
};

console.log('Final Record Counts in data/stroom.db:');
console.log(JSON.stringify(finalCounts, null, 2));

const genuineUsers = db.prepare('SELECT id, email, role FROM users').all();
console.log('Preserved Users:', genuineUsers);

const genuineProposal = db.prepare('SELECT id, proposer_name, proposer_email, status FROM partner_proposals').all();
console.log('Preserved Partner Proposals:', genuineProposal);

db.close();
console.log('Purge completed SUCCESSFULLY.');
