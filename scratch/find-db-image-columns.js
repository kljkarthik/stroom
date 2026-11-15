const fs = require('fs');

const ddl = fs.readFileSync('migrations/postgres/0001_postgres_schema.sql', 'utf8');
const tables = ddl.split(/CREATE TABLE IF NOT EXISTS/i).slice(1);

const results = [];

tables.forEach(tableChunk => {
  const tableNameMatch = tableChunk.match(/^\s*"?([a-zA-Z0-9_]+)"?\s*\(/);
  if (!tableNameMatch) return;
  const tableName = tableNameMatch[1];
  
  const lines = tableChunk.split('\n');
  lines.forEach(line => {
    const colMatch = line.match(/^\s*"?([a-zA-Z0-9_]+)"?\s+([A-Z0-9()]+)/);
    if (colMatch) {
      const colName = colMatch[1];
      const colType = colMatch[2];
      if (/image|avatar|cover|logo|banner|photo|poster|icon|url/i.test(colName)) {
        results.push({ table: tableName, column: colName, type: colType, line: line.trim() });
      }
    }
  });
});

console.log(`Found ${results.length} image/URL columns in database schema:\n`);
results.forEach(r => {
  console.log(`${r.table.padEnd(25)} . ${r.column.padEnd(20)} (${r.type})`);
});
