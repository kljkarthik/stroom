const Database = require('better-sqlite3');
const db = new Database('data/stroom.db');

console.log('=== AUDIT OF ALL TABLES AND CLASSIFICATION ===\n');

const allTables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all();

for (const t of allTables) {
  const count = db.prepare(`SELECT COUNT(*) as c FROM ${t.name}`).get().c;
  if (count > 0) {
    console.log(`${t.name.padEnd(25)}: ${count} rows`);
  }
}

console.log('\n--- FOREIGN KEY MAP ---');
for (const t of allTables) {
  const fks = db.prepare(`PRAGMA foreign_key_list(${t.name})`).all();
  if (fks.length > 0) {
    fks.forEach(fk => {
      console.log(`  ${t.name}.${fk.from} -> ${fk.table}.${fk.to} (on delete: ${fk.on_delete})`);
    });
  }
}
