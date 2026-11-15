import fs from 'fs';
import path from 'path';

const partnersPath = path.resolve('server/routes/partners.ts');
let code = fs.readFileSync(partnersPath, 'utf8');

// 1. Replace db import with adapter
code = code.replace(
  "import { db } from '../db/database';",
  "import { getDatabaseAdapter } from '../db/adapter';"
);

// 2. Replace router method signatures with async
code = code.replace(/router\.(get|post|put|patch|delete)\(([^,]+),\s*(requireAuth|optionalAuth)?\s*,?\s*\((req[^)]*)\)\s*=>\s*\{/g, (match, method, route, auth, params) => {
  if (auth) {
    return `router.${method}(${route}, ${auth}, async (${params}) => {`;
  } else {
    return `router.${method}(${route}, async (${params}) => {`;
  }
});

// 3. Replace datetime('now') and date('now')
code = code.replace(/datetime\('now'\)/g, 'CURRENT_TIMESTAMP');
code = code.replace(/date\('now'\)/g, 'CURRENT_DATE');

// 4. In transaction 6 (venue_availability):
code = code.replace(
  `        INSERT OR REPLACE INTO venue_availability (id, venue_id, partner_id, date, time_slot, status, collaboration_id, notes)\n        VALUES (?, ?, ?, ?, 'evening', 'proposed', ?, ?)`,
  `        INSERT INTO venue_availability (id, venue_id, partner_id, date, time_slot, status, collaboration_id, notes)\n        VALUES (?, ?, ?, ?, 'evening', 'proposed', ?, ?)\n        ON CONFLICT (venue_id, date, time_slot) DO UPDATE SET status = excluded.status, collaboration_id = excluded.collaboration_id, notes = excluded.notes`
);

// 5. Replace helper calls with await (outside already awaited)
code = code.replace(/(?<!await\s+)(assertPartnerAccess\()/g, 'await $1');
code = code.replace(/(?<!await\s+)(logPartnerAudit\()/g, 'await $1');
code = code.replace(/(?<!await\s+)(notifyPartner\()/g, 'await $1');
code = code.replace(/(?<!await\s+)(getPartnerAnalytics\()/g, 'await $1');
code = code.replace(/(?<!await\s+)(buildCsvExport\()/g, 'await $1');
code = code.replace(/(?<!await\s+)(recordAuditLog\()/g, 'await $1');

// 6. Handle redeemTransaction specifically
code = code.replace(
  /const redeemTransaction = db\.transaction\(\(\) => \{([\s\S]*?)\}\);\s*const result = redeemTransaction\(\);/,
  (match, inner) => {
    return `const result = await adapter.transaction(async (tx) => {${inner}});`;
  }
);

// 7. Handle other db.transaction blocks: db.transaction(() => { ... })();
code = code.replace(
  /db\.transaction\(\(\) => \{([\s\S]*?)\}\)\(\);/g,
  (match, inner) => {
    return `await adapter.transaction(async (tx) => {${inner}});`;
  }
);

// 8. Inside tx blocks or in general: replace db.prepare(...) with adapter.query / execute
// We can inject `const adapter = getDatabaseAdapter();` at the start of each router handler try {
code = code.replace(/(router\.(?:get|post|put|patch|delete)\([^;]+?try\s*\{)/g, `$1\n    const adapter = getDatabaseAdapter();`);

// Now let's carefully handle tx vs adapter for db.prepare(...):
// For blocks inside `await adapter.transaction(async (tx) => { ... })`:
code = code.replace(/await adapter\.transaction\(async \(tx\) => \{([\s\S]*?)\}\);/g, (match, inner) => {
  let txInner = inner;
  // In txInner, convert db.prepare(...).run(...) to await tx.execute(...)
  // db.prepare(...).get(...) to await tx.queryOne(...)
  // db.prepare(...).all(...) to await tx.query(...)
  txInner = txInner.replace(/db\.prepare\((`[\s\S]*?`|'[\s\S]*?'|"[\s\S]*?")\)\.run\(([\s\S]*?)\);/g, 'await tx.execute($1, [$2]);');
  txInner = txInner.replace(/db\.prepare\((`[\s\S]*?`|'[\s\S]*?'|"[\s\S]*?")\)\.get\(([\s\S]*?)\)/g, 'await tx.queryOne($1, [$2])');
  txInner = txInner.replace(/db\.prepare\((`[\s\S]*?`|'[\s\S]*?'|"[\s\S]*?")\)\.all\(([\s\S]*?)\)/g, 'await tx.query($1, [$2])');
  return `await adapter.transaction(async (tx) => {${txInner}});`;
});

// For remaining db.prepare outside tx:
code = code.replace(/db\.prepare\((`[\s\S]*?`|'[\s\S]*?'|"[\s\S]*?")\)\.run\(([\s\S]*?)\);/g, 'await adapter.execute($1, [$2]);');
code = code.replace(/db\.prepare\((`[\s\S]*?`|'[\s\S]*?'|"[\s\S]*?")\)\.get\(([\s\S]*?)\)/g, 'await adapter.queryOne($1, [$2])');
code = code.replace(/db\.prepare\((`[\s\S]*?`|'[\s\S]*?'|"[\s\S]*?")\)\.all\(([\s\S]*?)\)/g, 'await adapter.query($1, [$2])');

// Clean up empty params like [, ] or []
code = code.replace(/,\s*\[\s*\]\)/g, ')');
code = code.replace(/\[\s*\]/g, '[]');

fs.writeFileSync(partnersPath, code, 'utf8');
console.log('partners.ts transformed successfully.');
