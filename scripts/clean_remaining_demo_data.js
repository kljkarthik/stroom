const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const dbPath = path.resolve('data/stroom.db');
const backupPath = path.resolve(`backups/stroom-backup-before-demo-clean-${Date.now()}.db`);

console.log(`Creating database backup at: ${backupPath}`);
fs.copyFileSync(dbPath, backupPath);
console.log('Backup created successfully.');

const db = new Database(dbPath);
db.pragma('foreign_keys = ON');

const cleanupTx = db.transaction(() => {
  // 1. Delete all 12 test notifications
  const delNotifs = db.prepare("DELETE FROM notifications WHERE title LIKE '%Suite 14 Ops Update%' OR user_id NOT IN (SELECT id FROM users)").run();
  console.log(`Deleted notifications: ${delNotifs.changes}`);

  // 2. Delete all 11 test admin announcements
  const delAnn = db.prepare("DELETE FROM admin_announcements WHERE title LIKE '%Suite 14 Ops Update%'").run();
  console.log(`Deleted admin announcements: ${delAnn.changes}`);

  // 3. Delete all 27 automated test contact inquiries
  const delInq = db.prepare("DELETE FROM contact_inquiries WHERE email = 'sneha@example.com'").run();
  console.log(`Deleted contact inquiries: ${delInq.changes}`);

  // 4. Delete 33 automated test partner proposals (preserving genuine proposal from kljkarthik79@gmail.com)
  const delProp = db.prepare("DELETE FROM partner_proposals WHERE proposer_email = 'nishant@roastery.in'").run();
  console.log(`Deleted automated partner proposals: ${delProp.changes}`);

  // 5. Delete all test coupon redemptions so partner ledger starts clean
  const delRed = db.prepare("DELETE FROM coupon_redemptions").run();
  console.log(`Deleted test coupon redemptions: ${delRed.changes}`);

  // 6. Delete test partner communications
  const delPcomm = db.prepare("DELETE FROM partner_communications").run();
  console.log(`Deleted test partner communications: ${delPcomm.changes}`);

  // 7. Delete fake person profiles and auction discovery items from discovery_items
  const delDisc = db.prepare("DELETE FROM discovery_items WHERE id IN ('disc_person_aarav', 'disc_person_riya', 'disc_hyd_auction')").run();
  console.log(`Deleted fake discovery items: ${delDisc.changes}`);
});

cleanupTx();

// Integrity & Foreign Key Check
console.log('\n--- VERIFYING INTEGRITY ---');
const fkCheck = db.prepare('PRAGMA foreign_key_check').all();
console.log('Foreign key check violations:', fkCheck.length);
if (fkCheck.length > 0) {
  console.error('FK Violations:', fkCheck);
}

const integrity = db.prepare('PRAGMA integrity_check').all();
console.log('Integrity check:', integrity);

console.log('\n=== POST-CLEANUP RECORD COUNTS ===');
const tablesToCheck = [
  'users',
  'notifications',
  'admin_announcements',
  'contact_inquiries',
  'partner_proposals',
  'coupon_redemptions',
  'partner_communications',
  'discovery_items',
  'partner_accounts',
  'events'
];

for (const t of tablesToCheck) {
  const c = db.prepare(`SELECT COUNT(*) as c FROM ${t}`).get().c;
  console.log(`${t}: ${c}`);
}
