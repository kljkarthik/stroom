const Database = require('better-sqlite3');
const db = new Database('data/stroom.db');

const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all();
console.log('--- ALL TABLES AND ROW COUNTS ---');
for (const t of tables) {
  const c = db.prepare("SELECT COUNT(*) as c FROM " + t.name).get().c;
  if (c > 0) {
    console.log(`${t.name}: ${c}`);
  }
}
