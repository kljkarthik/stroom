/**
 * STROOM Stage 3.2: PostgreSQL Implementation Verification Suite
 * Tests SQL converter, dual-driver adapter, security masking, transactions, and schema parity.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import Database from 'better-sqlite3';
import {
  convertPlaceholders,
  convertDialectFunctions,
  convertSqlForPostgres,
} from '../server/db/sqlConverter';
import {
  maskConnectionString,
  sanitizeDatabaseError,
  PostgresAdapter,
} from '../server/db/postgresAdapter';
import { SqliteAdapter } from '../server/db/sqliteAdapter';
import {
  getActiveDriver,
  createDatabaseAdapter,
  getDatabaseAdapter,
  resetDatabaseAdapter,
} from '../server/db/adapter';
import { TOPOLOGICAL_TABLES } from '../scripts/migrate-sqlite-to-postgres';
import {
  hashRow,
  computeTableHash,
  hashSqliteTable,
} from '../scripts/verify-postgres-parity';

let passedAssertions = 0;
let totalAssertions = 0;

function assert(condition: boolean, message: string) {
  totalAssertions++;
  if (!condition) {
    console.error(`  ❌ FAILED: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  passedAssertions++;
  console.log(`  ✅ PASSED: ${message}`);
}

async function runTests() {
  console.log('================================================================');
  console.log('🧪 STROOM STAGE 3.2 POSTGRESQL IMPLEMENTATION VERIFICATION SUITE');
  console.log('================================================================\n');

  // ============================================================================
  // SUITE 1: SQL Converter & Dialect Rewriting
  // ============================================================================
  console.log('--- Suite 1: SQL Converter & Parameter Token Translation ---');

  // Test 1.1: Basic positional parameter translation
  {
    const res = convertPlaceholders('SELECT * FROM users WHERE id = ? AND email = ?');
    assert(res.sql === 'SELECT * FROM users WHERE id = $1 AND email = $2', 'Placeholders ? converted to $1 and $2');
    assert(res.parameterCount === 2, 'Parameter count equals 2');
  }

  // Test 1.2: String literal preservation
  {
    const res = convertPlaceholders("SELECT * FROM users WHERE note = 'What?' AND id = ?");
    assert(res.sql === "SELECT * FROM users WHERE note = 'What?' AND id = $1", 'Question mark inside single quote literal preserved');
    assert(res.parameterCount === 1, 'Parameter count correctly excludes literal ?');
  }

  // Test 1.3: Escaped quote in string literal
  {
    const res = convertPlaceholders("SELECT * FROM users WHERE note = 'It''s a question?' AND id = ?");
    assert(res.sql === "SELECT * FROM users WHERE note = 'It''s a question?' AND id = $1", 'Escaped quote inside string literal preserved');
    assert(res.parameterCount === 1, 'Parameter count ignores ? in escaped quote literal');
  }

  // Test 1.4: SQL comments preservation
  {
    const res = convertPlaceholders('-- Is this a query?\nSELECT * FROM users /* Why? */ WHERE id = ?');
    assert(res.sql === '-- Is this a query?\nSELECT * FROM users /* Why? */ WHERE id = $1', 'Question marks inside line and block comments preserved');
    assert(res.parameterCount === 1, 'Parameter count ignores comments');
  }

  // Test 1.5: datetime('now') conversion
  {
    const res = convertDialectFunctions("UPDATE users SET updated_at = datetime('now') WHERE id = 1");
    assert(res === 'UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = 1', "datetime('now') converted to CURRENT_TIMESTAMP");
  }

  // Test 1.6: datetime('now', '-30 days') interval conversion
  {
    const res = convertDialectFunctions("SELECT * FROM logs WHERE created_at >= datetime('now', '-30 days')");
    assert(res === "SELECT * FROM logs WHERE created_at >= (CURRENT_TIMESTAMP - INTERVAL '30 days')", "datetime('now', '-30 days') converted to INTERVAL arithmetic");
  }

  // Test 1.7: datetime('now', '+2 hours') interval conversion
  {
    const res = convertDialectFunctions("SELECT * FROM events WHERE start_time <= datetime('now', '+2 hours')");
    assert(res === "SELECT * FROM events WHERE start_time <= (CURRENT_TIMESTAMP + INTERVAL '2 hours')", "datetime('now', '+2 hours') converted to positive INTERVAL arithmetic");
  }

  // Test 1.8: strftime('%Y-%m', col) conversion
  {
    const res = convertDialectFunctions("SELECT strftime('%Y-%m', created_at) AS month FROM payments");
    assert(res === "SELECT TO_CHAR(CAST(created_at AS TIMESTAMP), 'YYYY-MM') AS month FROM payments", 'strftime conversion to TO_CHAR');
  }

  // Test 1.9: INSERT OR IGNORE INTO conversion
  {
    const res = convertDialectFunctions('INSERT OR IGNORE INTO cities (id, name, state) VALUES (?, ?, ?)');
    assert(res === 'INSERT INTO cities (id, name, state) VALUES (?, ?, ?) ON CONFLICT DO NOTHING', 'INSERT OR IGNORE converted to ON CONFLICT DO NOTHING');
  }

  // Test 1.10: INSERT OR REPLACE INTO conversion
  {
    const res = convertDialectFunctions(
      'INSERT OR REPLACE INTO venue_availability (id, venue_id, date, status) VALUES (?, ?, ?, ?)'
    );
    assert(
      res ===
        'INSERT INTO venue_availability (id, venue_id, date, status) VALUES (?, ?, ?, ?) ON CONFLICT (id) DO UPDATE SET venue_id = EXCLUDED.venue_id, date = EXCLUDED.date, status = EXCLUDED.status',
      'INSERT OR REPLACE converted to ON CONFLICT (id) DO UPDATE SET'
    );
  }

  // Test 1.11: Combined pipeline conversion
  {
    const res = convertSqlForPostgres(
      "UPDATE users SET updated_at = datetime('now'), name = ? WHERE id = ?"
    );
    assert(
      res.sql === 'UPDATE users SET updated_at = CURRENT_TIMESTAMP, name = $1 WHERE id = $2',
      'Combined dialect and placeholder conversion executes cleanly'
    );
    assert(res.parameterCount === 2, 'Combined parameter count accurate');
  }

  // ============================================================================
  // SUITE 2: Security & Credential Masking
  // ============================================================================
  console.log('\n--- Suite 2: Security & Credential Redaction ---');

  // Test 2.1: maskConnectionString with cleartext password
  {
    const secretUrl = 'postgres://stroom_admin:SuperSecretPass123!@ep-green-pond-123.us-east-2.aws.neon.tech/stroom?sslmode=require';
    const masked = maskConnectionString(secretUrl);
    assert(!masked.includes('SuperSecretPass123!'), 'Password is fully redacted from connection string');
    assert(masked.includes('postgres://stroom_admin:***@'), 'Replaced password with *** mask');
    assert(masked.includes('ep-green-pond-123.us-east-2.aws.neon.tech/stroom'), 'Host and database remain identifiable');
  }

  // Test 2.2: sanitizeDatabaseError with credentials in error message
  {
    const leakedError = new Error(
      'Connection failed to postgres://app_user:MySecretP@ss@pooler.neon.tech:5432/neondb: timeout'
    );
    (leakedError as any).detail = 'Auth failure for user postgresql://app_user:MySecretP@ss@pooler.neon.tech/neondb';
    (leakedError as any).code = '28P01';

    const sanitized = sanitizeDatabaseError(leakedError);
    assert(!sanitized.message.includes('MySecretP@ss'), 'Sanitized error message contains zero plain credentials');
    assert(sanitized.message.includes('app_user:***@pooler.neon.tech'), 'Credentials replaced with *** in message');
    assert(!(sanitized as any).detail.includes('MySecretP@ss'), 'Credentials removed from error detail');
    assert((sanitized as any).code === '28P01', 'Error code preserved for error mapping');
  }

  // ============================================================================
  // SUITE 3: SqliteAdapter & Transaction Safety (Disposable DB)
  // ============================================================================
  console.log('\n--- Suite 3: SqliteAdapter Functional Verification ---');

  const testDbPath = path.resolve(process.cwd(), 'data', `test_stage3_2_sqlite_${Date.now()}.db`);
  const sqliteAdapter = new SqliteAdapter(testDbPath);

  try {
    // Test 3.1: DDL & Insert via execute
    await sqliteAdapter.execute(`
      CREATE TABLE test_items (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        val INTEGER NOT NULL DEFAULT 0
      )
    `);

    const insertRes = await sqliteAdapter.execute(
      'INSERT INTO test_items (id, name, val) VALUES (?, ?, ?)',
      ['item_1', 'Alpha', 100]
    );
    assert(insertRes.changes === 1, 'SqliteAdapter execute returned changes = 1');

    // Test 3.2: queryOne & query
    const row = await sqliteAdapter.queryOne<{ id: string; name: string; val: number }>(
      'SELECT * FROM test_items WHERE id = ?',
      ['item_1']
    );
    assert(row?.name === 'Alpha', 'SqliteAdapter queryOne returned expected row');
    assert(row?.val === 100, 'SqliteAdapter queryOne value match');

    const allRows = await sqliteAdapter.query('SELECT * FROM test_items');
    assert(allRows.length === 1, 'SqliteAdapter query returned all rows');

    // Test 3.3: PreparedStatement interface
    const stmt = sqliteAdapter.prepare('SELECT * FROM test_items WHERE id = ?');
    const stmtRow = await stmt.get<{ id: string; name: string }>('item_1');
    assert(stmtRow?.name === 'Alpha', 'SqlitePreparedStatement.get returned row');

    const stmtAll = await stmt.all('item_1');
    assert(stmtAll.length === 1, 'SqlitePreparedStatement.all returned array');

    // Test 3.4: Transaction Commit
    await sqliteAdapter.transaction(async (tx) => {
      await tx.execute('INSERT INTO test_items (id, name, val) VALUES (?, ?, ?)', ['item_2', 'Beta', 200]);
      await tx.execute('INSERT INTO test_items (id, name, val) VALUES (?, ?, ?)', ['item_3', 'Gamma', 300]);
    });
    const committedRows = await sqliteAdapter.query('SELECT * FROM test_items');
    assert(committedRows.length === 3, 'Transaction committed successfully with 3 rows total');

    // Test 3.5: Transaction Rollback on Error
    let rollbackThrew = false;
    try {
      await sqliteAdapter.transaction(async (tx) => {
        await tx.execute('INSERT INTO test_items (id, name, val) VALUES (?, ?, ?)', ['item_4', 'Delta', 400]);
        throw new Error('Intentional transaction abort');
      });
    } catch {
      rollbackThrew = true;
    }
    assert(rollbackThrew, 'Transaction threw on internal error');
    const afterRollbackRows = await sqliteAdapter.query('SELECT * FROM test_items');
    assert(afterRollbackRows.length === 3, 'Rollback guaranteed: item_4 was not persisted');
  } finally {
    await sqliteAdapter.close();
    // Clean up temporary disposable database
    try {
      if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
      if (fs.existsSync(testDbPath + '-wal')) fs.unlinkSync(testDbPath + '-wal');
      if (fs.existsSync(testDbPath + '-shm')) fs.unlinkSync(testDbPath + '-shm');
    } catch {}
  }

  // ============================================================================
  // SUITE 4: Adapter Factory & Driver Selection
  // ============================================================================
  console.log('\n--- Suite 4: Adapter Factory & Driver Switching ---');

  // Test 4.1: Default driver without environment variable is sqlite
  {
    const origDriver = process.env.DATABASE_DRIVER;
    delete process.env.DATABASE_DRIVER;
    assert(getActiveDriver() === 'sqlite', 'Default driver is strictly sqlite when DATABASE_DRIVER is unset');
    if (origDriver) process.env.DATABASE_DRIVER = origDriver;
  }

  // Test 4.2: Explicit postgres driver selection
  {
    const origDriver = process.env.DATABASE_DRIVER;
    process.env.DATABASE_DRIVER = 'postgres';
    assert(getActiveDriver() === 'postgres', 'getActiveDriver() reflects postgres when set');
    if (origDriver) process.env.DATABASE_DRIVER = origDriver;
    else delete process.env.DATABASE_DRIVER;
  }

  // Test 4.3: Safe fallback when DATABASE_URL is missing
  {
    const origDriver = process.env.DATABASE_DRIVER;
    const origUrl = process.env.DATABASE_URL;
    const origTargetUrl = process.env.TARGET_DATABASE_URL;
    process.env.DATABASE_DRIVER = 'postgres';
    delete process.env.DATABASE_URL;
    delete process.env.TARGET_DATABASE_URL;
    await resetDatabaseAdapter();

    const adapter = getDatabaseAdapter();
    assert(adapter.driver === 'sqlite', 'Safely falls back to SQLite adapter when DATABASE_URL is missing');

    await resetDatabaseAdapter();
    if (origDriver) process.env.DATABASE_DRIVER = origDriver;
    else delete process.env.DATABASE_DRIVER;
    if (origUrl) process.env.DATABASE_URL = origUrl;
    if (origTargetUrl) process.env.TARGET_DATABASE_URL = origTargetUrl;
  }

  // ============================================================================
  // SUITE 5: PostgreSQL DDL Schema Topological & Syntax Audit
  // ============================================================================
  console.log('\n--- Suite 5: PostgreSQL DDL Schema Audit ---');

  const ddlPath = path.resolve(process.cwd(), 'migrations', 'postgres', '0001_postgres_schema.sql');
  assert(fs.existsSync(ddlPath), 'migrations/postgres/0001_postgres_schema.sql exists on disk');

  const ddlContent = fs.readFileSync(ddlPath, 'utf8');
  assert(ddlContent.length > 30000, `DDL file size verified (${ddlContent.length} bytes)`);

  // Count CREATE TABLE statements
  const createTableMatches = ddlContent.match(/CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+"?([a-zA-Z0-9_]+)"?/gi) || [];
  assert(createTableMatches.length === 42, `Exactly 42 CREATE TABLE statements present (Found: ${createTableMatches.length})`);

  // Count explicit CREATE INDEX statements
  const createIndexMatches = ddlContent.match(/CREATE\s+(?:UNIQUE\s+)?INDEX\s+IF\s+NOT\s+EXISTS/gi) || [];
  assert(createIndexMatches.length >= 33, `At least 33 CREATE INDEX statements present (Found: ${createIndexMatches.length})`);

  // Verify all 42 tables appear in DDL
  for (const table of TOPOLOGICAL_TABLES) {
    const tablePattern = new RegExp(`CREATE\\s+TABLE\\s+IF\\s+NOT\\s+EXISTS\\s+"?${table}"?`, 'i');
    assert(tablePattern.test(ddlContent), `Table ${table} defined in PostgreSQL DDL`);
  }

  // Verify numeric currency conversion in DDL
  assert(ddlContent.includes('NUMERIC(12, 2)'), 'Currency fields converted to NUMERIC(12, 2) in DDL');
  assert(!ddlContent.includes("datetime('now')"), "Zero occurrences of datetime('now') in PostgreSQL DDL");

  // ============================================================================
  // SUITE 6: Deterministic Row & Table Hashing
  // ============================================================================
  console.log('\n--- Suite 6: Parity Tooling & Deterministic Hashing ---');

  // Test 6.1: Deterministic row hashing with key order independence
  {
    const rowA = { id: 'usr_1', email: 'test@stroom.in', is_active: 1, role: 'user' };
    const rowB = { role: 'user', is_active: 1, id: 'usr_1', email: 'test@stroom.in' };
    assert(hashRow(rowA) === hashRow(rowB), 'Row hashing is key-order independent (deterministic)');
  }

  // Test 6.2: Boolean canonicalization in row hashing
  {
    const rowNum = { id: 'usr_2', is_active: 1 };
    const rowBool = { id: 'usr_2', is_active: true };
    assert(hashRow(rowNum) === hashRow(rowBool), 'Boolean true canonicalized to 1 for cross-engine parity');
  }

  // Test 6.3: Empty table hash sentinel
  {
    const emptyHash = computeTableHash([]);
    assert(emptyHash === '0'.repeat(64), 'Empty table hash produces 64-character zero sentinel');
  }

  // Test 6.4: Table hash changes when row data differs
  {
    const hash1 = computeTableHash([hashRow({ id: '1', val: 'a' })]);
    const hash2 = computeTableHash([hashRow({ id: '1', val: 'b' })]);
    assert(hash1 !== hash2, 'Table hash sensitively detects modified column values');
  }

  console.log('\n================================================================');
  console.log(`🎉 ALL TESTS COMPLETED: ${passedAssertions}/${totalAssertions} assertions passed.`);
  console.log('================================================================\n');
}

runTests().catch((err) => {
  console.error('\n❌ TEST RUN ABORTED WITH ERROR:', err);
  process.exit(1);
});
