const Database = require('better-sqlite3');
const db = new Database('data/stroom.db');
const demoIds = ['usr_partner_001', 'usr_partner_pune_001', 'usr_superadmin_001', 'usr_checkin_001', 'usr_eventmgr_001'];
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
tables.forEach(t => {
  const cols = db.prepare(`PRAGMA table_info(${t.name})`).all().map(c => c.name);
  for (const c of cols) {
    if (c.includes('user_id') || c === 'created_by' || c === 'owner_user_id' || c === 'author_user_id') {
      for (const id of demoIds) {
        try {
          const row = db.prepare(`SELECT COUNT(*) as cnt FROM ${t.name} WHERE ${c} = ?`).get(id);
          if (row && row.cnt > 0) {
            console.log(`Found in ${t.name}.${c} for ${id}: ${row.cnt}`);
          }
        } catch (e) {}
      }
    }
  }
});
console.log('Search complete.');
