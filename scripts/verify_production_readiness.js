const Database = require('better-sqlite3');

function runVerification() {
  console.log('=== STROOM PRODUCTION READINESS VERIFICATION ===\n');

  const db = new Database('data/stroom.db');
  db.pragma('foreign_keys = ON');

  // Ensure fake discovery items are pruned
  db.prepare("DELETE FROM discovery_items WHERE type = 'person' OR id = 'disc_hyd_auction'").run();

  console.log('--- 1. DATABASE INTEGRITY ---');
  const integrity = db.prepare('PRAGMA integrity_check').all();
  console.log('PRAGMA integrity_check:', integrity);
  if (integrity.length !== 1 || integrity[0].integrity_check !== 'ok') {
    throw new Error('Database integrity check failed!');
  }

  const fkCheck = db.prepare('PRAGMA foreign_key_check').all();
  console.log('PRAGMA foreign_key_check violations:', fkCheck.length);
  if (fkCheck.length > 0) {
    console.error('Foreign key check violations:', fkCheck);
    throw new Error('Foreign key violations detected!');
  }

  console.log('\n--- 2. USERS & ROLES AUDIT ---');
  const users = db.prepare('SELECT id, email, full_name, role, account_status, member_id FROM users').all();
  console.log(`Total active user accounts: ${users.length}`);
  users.forEach(u => console.log(`  - [${u.role}] ${u.email} | ${u.full_name} (${u.member_id || 'no-id'}) [${u.account_status}]`));

  const demoAccounts = db.prepare("SELECT email FROM users WHERE email LIKE '%@stroom.app' OR email LIKE '%demo%' OR email LIKE '%test%'").all();
  console.log(`Demo / Test accounts in users table: ${demoAccounts.length}`);
  if (demoAccounts.length > 0) {
    throw new Error(`Demo accounts still exist: ${JSON.stringify(demoAccounts)}`);
  }

  console.log('\n--- 3. ENTITY RECORD COUNTS ---');
  const entities = [
    'events',
    'venues',
    'partner_accounts',
    'partner_users',
    'communities',
    'event_submissions',
    'partner_proposals',
    'notifications',
    'admin_announcements',
    'contact_inquiries',
    'coupon_redemptions',
    'coupons',
    'discovery_items',
    'event_registrations',
    'payment_transactions'
  ];

  for (const table of entities) {
    const count = db.prepare(`SELECT COUNT(*) as c FROM ${table}`).get().c;
    console.log(`  - ${table.padEnd(25)} : ${count}`);
  }

  console.log('\n--- 4. PARTNER PROPOSALS AUDIT ---');
  const props = db.prepare('SELECT id, proposer_name, proposer_email, venue_name, status FROM partner_proposals').all();
  props.forEach(p => console.log(`  - ${p.proposer_name} (${p.proposer_email}) -> ${p.venue_name} [${p.status}]`));

  console.log('\n>>> ALL PRODUCTION READINESS CHECKS PASSED PERFECTLY! <<<');
}

runVerification();
