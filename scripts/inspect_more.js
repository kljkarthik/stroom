const Database = require('better-sqlite3');
const db = new Database('data/stroom.db');

function inspectTable(tableName) {
  console.log(`\n=== ${tableName} ===`);
  const cols = db.prepare(`PRAGMA table_info(${tableName})`).all().map(c => c.name);
  console.log('Columns:', cols.join(', '));
  const rows = db.prepare(`SELECT * FROM ${tableName} LIMIT 5`).all();
  console.log('Sample rows:', JSON.stringify(rows, null, 2));
}

inspectTable('partner_proposals');
inspectTable('admin_announcements');
inspectTable('discovery_items');
inspectTable('partner_collaborations');
inspectTable('partner_communications');
inspectTable('partner_audit_logs');
inspectTable('audit_logs');
