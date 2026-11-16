const Database = require('better-sqlite3');
const db = new Database('data/stroom.db');
db.pragma('foreign_keys = ON');

const demoIds = ['usr_partner_001', 'usr_partner_pune_001', 'usr_superadmin_001', 'usr_checkin_001', 'usr_eventmgr_001'];

const cleanUsersTx = db.transaction(() => {
  // 1. Reassign coupons.created_by
  db.prepare("UPDATE coupons SET created_by = 'usr_superadmin_master' WHERE created_by IN (?, ?, ?, ?, ?)").run(...demoIds);

  // 2. Delete old demo partner_users
  db.prepare("DELETE FROM partner_users WHERE user_id IN (?, ?, ?, ?, ?)").run(...demoIds);

  // 3. Reassign media_uploads.user_id
  db.prepare("UPDATE media_uploads SET user_id = 'usr_superadmin_master' WHERE user_id IN (?, ?, ?, ?, ?)").run(...demoIds);

  // 4. Delete the 5 demo accounts
  const res = db.prepare("DELETE FROM users WHERE id IN (?, ?, ?, ?, ?)").run(...demoIds);
  console.log(`Deleted demo users: ${res.changes}`);
});

cleanUsersTx();

const fkCheck = db.prepare('PRAGMA foreign_key_check').all();
console.log('PRAGMA foreign_key_check violations:', fkCheck.length);
if (fkCheck.length > 0) {
  console.error('FK Violations:', fkCheck);
}

const integrity = db.prepare('PRAGMA integrity_check').all();
console.log('PRAGMA integrity_check:', integrity);

const remainingUsers = db.prepare('SELECT id, email, full_name, role FROM users').all();
console.log('Remaining users in database:');
console.log(remainingUsers);
