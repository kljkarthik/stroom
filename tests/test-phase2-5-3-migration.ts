import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import esbuild from 'esbuild';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { migrateSqliteToD1, TOPOLOGICAL_TABLES } from '../scripts/migrate-sqlite-to-d1';
import { verifyD1Parity } from '../scripts/verify-d1-parity';
import { rollbackD1Migration } from '../scripts/rollback-d1-migration';
import { generateCanonicalSecret, isCanonicalBase64Url32Node } from '../server/utils/crypto';
import { verifyPassword } from '../server/db/database';

const PRIMARY_DB_PATH = path.resolve(process.cwd(), 'data', 'stroom.db');
const BACKUP_DB_PATH = path.resolve(
  process.cwd(),
  'backups',
  'stroom-checkpoint-phase0-2026-11-13T08-10-02-441Z.db'
);
const EXPECTED_PRIMARY_HASH = 'ad6fe974854b0fcd83cf053e26de89f3d467b2be2687b09e0ab282e6acd848fb';
const EXPECTED_BACKUP_HASH = '2129266ef6555c90c74b9166e696a2e39aa8b2a87e483eb79a20f9a292be4571';

function computeSha256(filePath: string): string {
  const content = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(content).digest('hex').toLowerCase();
}

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`[ASSERTION FAILED]: ${msg}`);
  }
}

async function runMigrationTestSuite() {
  console.log('================================================================');
  console.log('📦  STROOM PHASE 2.5.3 DATA MIGRATION & PARITY TEST SUITE');
  console.log('================================================================\n');

  // Pre-test Safety Verification
  const prePrimaryHash = computeSha256(PRIMARY_DB_PATH);
  const preBackupHash = computeSha256(BACKUP_DB_PATH);
  assert(prePrimaryHash === EXPECTED_PRIMARY_HASH, 'Primary SQLite DB hash mismatch before tests');
  assert(preBackupHash === EXPECTED_BACKUP_HASH, 'Backup DB hash mismatch before tests');
  console.log('✅ Pre-test database integrity verified:');
  console.log(`   data/stroom.db:       ${prePrimaryHash}`);
  console.log(`   checkpoint backup:    ${preBackupHash}\n`);

  // Create disposable SQLite test copy using raw filesystem byte-copy (never opening primary DB with SQLite engine)
  const testId = crypto.randomUUID().slice(0, 8);
  const disposableDbName = `test_disposable_phase253_${Date.now()}_${testId}.db`;
  const disposableDbPath = path.resolve(process.cwd(), 'data', disposableDbName);

  fs.copyFileSync(PRIMARY_DB_PATH, disposableDbPath);
  if (fs.existsSync(PRIMARY_DB_PATH + '-wal')) {
    fs.copyFileSync(PRIMARY_DB_PATH + '-wal', disposableDbPath + '-wal');
  }
  if (fs.existsSync(PRIMARY_DB_PATH + '-shm')) {
    fs.copyFileSync(PRIMARY_DB_PATH + '-shm', disposableDbPath + '-shm');
  }

  // Checkpoint only the disposable copy so all 10,172 rows are consolidated
  const Database = (await import('better-sqlite3')).default;
  const dDb = new Database(disposableDbPath);
  dDb.pragma('wal_checkpoint(FULL)');
  dDb.close();
  console.log(`✅ Created self-contained disposable test SQLite database: ${disposableDbName}\n`);

  // Build worker bundle for Miniflare
  console.log('📦 Bundling worker isolate with esbuild...');
  const workerBundlePath = path.resolve(process.cwd(), 'scratch', `worker_test_bundle_${testId}.js`);
  await esbuild.build({
    entryPoints: [path.resolve(process.cwd(), 'src/worker/index.ts')],
    bundle: true,
    outfile: workerBundlePath,
    format: 'esm',
    target: 'es2022',
    platform: 'neutral',
    external: ['cloudflare:workers'],
    define: {
      'process.env.NODE_ENV': '"test"',
    },
  });

  const bridgeSecret = generateCanonicalSecret();
  const originSecret = generateCanonicalSecret();
  const mediaSecret = generateCanonicalSecret();
  assert(isCanonicalBase64Url32Node(bridgeSecret), 'Bridge secret is canonical base64url');

  const rawMfOpts = {
    modules: true,
    scriptPath: workerBundlePath,
    d1Databases: ['DB'],
    r2Buckets: ['MEDIA_BUCKET'],
    bindings: {
      NODE_ENV: 'test',
      INTERNAL_D1_BRIDGE_SECRET: bridgeSecret,
      ORIGIN_PROXY_SECRET: originSecret,
      INTERNAL_MEDIA_SECRET: mediaSecret,
      ORIGIN_URL: 'http://127.0.0.1:5058',
      JWT_SECRET: 'test-jwt-secret-phase253-migration-32b',
    },
  };
  const mfOpts = typeof (convertV4MiniflareOptions as any) === 'function'
    ? (convertV4MiniflareOptions as any)(rawMfOpts)
    : rawMfOpts;
  const mf = new Miniflare(mfOpts);
  await mf.ready;
  console.log('✅ Miniflare D1 initialized and ready.\n');

  const d1 = await mf.getD1Database('DB');

  async function applySqlFile(database: any, filePath: string) {
    let content = fs.readFileSync(filePath, 'utf8');
    content = content.replace(/\r/g, '').replace(/--[^\n]*\n/g, '\n');
    const stmts = content
      .split(';')
      .map((s) => s.trim().replace(/\s+/g, ' '))
      .filter((s) => s.length > 0 && !s.toUpperCase().startsWith('PRAGMA'));
    for (const stmt of stmts) {
      try {
        await database.prepare(stmt).run();
      } catch (err: any) {
        throw new Error(`Failed to execute statement in ${path.basename(filePath)}: ${stmt.slice(0, 80)}... Reason: ${err.message}`);
      }
    }
  }

  function buildBridgeRequest(action: string, params: any, secret: string, actor?: any) {
    const timestamp = Date.now();
    const nonce = crypto.randomBytes(16).toString('hex');
    const payload: any = { action, params };
    if (actor) payload.actor = actor;
    const rawBodyBuffer = Buffer.from(JSON.stringify(payload), 'utf8');
    const bodyHash = crypto.createHash('sha256').update(rawBodyBuffer).digest('hex');
    const sigPayload = `${timestamp}:${nonce}:${action}:${bodyHash}`;
    const signature = crypto.createHmac('sha256', secret).update(sigPayload).digest('hex');
    return {
      headers: {
        'Content-Type': 'application/json',
        'X-STROOM-Bridge-Secret': secret,
        'X-STROOM-Timestamp': String(timestamp),
        'X-STROOM-Nonce': nonce,
        'X-STROOM-Signature': signature,
        'X-STROOM-Action': action,
      },
      body: rawBodyBuffer,
    };
  }

  try {
    // 1. Apply Schema Migrations (0001, 0002, 0003)
    console.log('--- Step 1: Apply Initial D1 Migrations (0001, 0002, 0003) ---');
    await applySqlFile(d1, 'migrations/0001_initial_schema.sql');
    await applySqlFile(d1, 'migrations/0002_essential_metadata.sql');
    await applySqlFile(d1, 'migrations/0003_bridge_nonces.sql');
    console.log('✅ Schema migrations 0001, 0002, 0003 applied cleanly to Miniflare D1.\n');

    // 2. Run Data Migration Script
    console.log('--- Step 2: Execute migrateSqliteToD1 ---');
    const migrationResult = await migrateSqliteToD1({
      sourceDbPath: disposableDbPath,
      d1Database: d1,
      batchSize: 50,
      log: (m) => console.log(`   ${m}`),
    });

    assert(migrationResult.success, 'Migration failed');
    assert(migrationResult.totalTables === 42, `Expected 42 tables, got ${migrationResult.totalTables}`);
    assert(migrationResult.totalRecordsMigrated === 10160, `Expected 10,160 migrated records, got ${migrationResult.totalRecordsMigrated}`);
    console.log(`✅ Step 2 Complete: 10,160 records migrated across 42 tables in ${migrationResult.durationMs}ms.\n`);

    // 3. Verify Parity, Column Values, Row Hashes & Foreign Keys
    console.log('--- Step 3: Execute verifyD1Parity (Comprehensive 42-Table Row Verification) ---');
    const parityResult = await verifyD1Parity({
      sourceDbPath: disposableDbPath,
      d1Database: d1,
      log: (m) => console.log(`   ${m}`),
    });

    assert(parityResult.passed, `Parity check failed: ${parityResult.mismatches.join('; ')}`);
    assert(parityResult.tableCountMatch, 'Table count mismatch');
    assert(parityResult.tablesVerified === 42, `Expected 42 verified tables, got ${parityResult.tablesVerified}`);
    assert(parityResult.totalD1Rows === 10160, `Expected 10,160 rows in D1, got ${parityResult.totalD1Rows}`);
    assert(parityResult.foreignKeyViolations === 0, `Expected 0 FK violations, got ${parityResult.foreignKeyViolations}`);
    assert(parityResult.accountIntegrity.verified, 'Account integrity check failed');
    assert(parityResult.accountIntegrity.totalAccounts === 188, `Expected 188 accounts, got ${parityResult.accountIntegrity.totalAccounts}`);
    assert(parityResult.accountIntegrity.scryptAccounts === 61, `Expected 61 scrypt accounts, got ${parityResult.accountIntegrity.scryptAccounts}`);
    assert(parityResult.accountIntegrity.legacySha256Accounts === 126, `Expected 126 SHA-256 accounts, got ${parityResult.accountIntegrity.legacySha256Accounts}`);
    assert(parityResult.accountIntegrity.emptyPasswordAccounts === 1, `Expected 1 empty password account, got ${parityResult.accountIntegrity.emptyPasswordAccounts}`);
    console.log(`✅ Step 3 Complete: 100% record parity, 0 FK violations, all 42 tables verified with SHA-256 row matching.\n`);

    // 4. Test Authentication Cutover Readiness & Empty-Password Account Security
    console.log('--- Step 4: Authentication Cutover Readiness & Empty-Password Account Security ---');
    const reqAdmin = buildBridgeRequest('getUserForLogin', { email: 'admin@stroom.app' }, bridgeSecret);
    const resAdmin = await mf.dispatchFetch('http://127.0.0.1:8787/api/internal/d1/execute', {
      method: 'POST',
      headers: reqAdmin.headers,
      body: reqAdmin.body,
    });

    assert(resAdmin.status === 200, `Expected 200 from D1 bridge, got ${resAdmin.status}`);
    const adminData = (await resAdmin.json()) as any;
    const adminUser = adminData.user;
    assert(adminUser && adminUser.email === 'admin@stroom.app', 'Failed to retrieve admin user from migrated D1');
    assert(adminUser.password_hash.startsWith('scrypt$'), 'Admin password hash format preserved');
    assert(adminUser.role === 'admin', 'Admin role preserved');
    console.log(`✅ D1 Bridge retrieved admin account: id=${adminUser.id}, role=${adminUser.role}, hash_len=${adminUser.password_hash.length}`);

    // Test regular user retrieval
    const reqUser = buildBridgeRequest('getUserForLogin', { email: 'user@stroom.app' }, bridgeSecret);
    const resUser = await mf.dispatchFetch('http://127.0.0.1:8787/api/internal/d1/execute', {
      method: 'POST',
      headers: reqUser.headers,
      body: reqUser.body,
    });
    assert(resUser.status === 200, `Expected 200 for user lookup, got ${resUser.status}`);
    const userData = (await resUser.json()) as any;
    const regUser = userData.user;
    assert(regUser && regUser.email === 'user@stroom.app', 'Failed to retrieve regular user');
    console.log(`✅ D1 Bridge retrieved regular user: id=${regUser.id}, onboarding_status=${regUser.onboarding_status}`);

    // Test empty-password user (usr_b6f256a7aa94499c / karan@stroom.club) retrieval & security
    const reqKaran = buildBridgeRequest('getUserForLogin', { email: 'karan@stroom.club' }, bridgeSecret);
    const resKaran = await mf.dispatchFetch('http://127.0.0.1:8787/api/internal/d1/execute', {
      method: 'POST',
      headers: reqKaran.headers,
      body: reqKaran.body,
    });
    assert(resKaran.status === 200, `Expected 200 for Karan lookup, got ${resKaran.status}`);
    const karanData = (await resKaran.json()) as any;
    const karanUser = karanData.user;
    assert(karanUser && karanUser.id === 'usr_b6f256a7aa94499c', 'Karan user ID preserved');
    assert(karanUser.email === 'karan@stroom.club', 'Karan email preserved');
    assert(karanUser.password_hash === '', 'Karan empty password hash preserved verbatim');
    assert(karanUser.role === 'user', 'Karan role is user');
    console.log(`✅ D1 Bridge retrieved empty-password account: id=${karanUser.id}, email=${karanUser.email}, hash_len=${karanUser.password_hash.length}`);

    // Credential validation regression tests: ensure empty password account CANNOT authenticate under any input
    assert(verifyPassword('', karanUser.password_hash).valid === false, 'Empty password string must be rejected');
    assert(verifyPassword('Password123!', karanUser.password_hash).valid === false, 'Arbitrary password string must be rejected');
    assert(verifyPassword('   ', karanUser.password_hash).valid === false, 'Whitespace password string must be rejected');
    assert(verifyPassword(null as any, karanUser.password_hash).valid === false, 'Null password must be rejected');
    assert(verifyPassword(undefined as any, karanUser.password_hash).valid === false, 'Undefined password must be rejected');
    console.log('✅ Empty-password account credential security verified: Authentication impossible for unconfigured credentials.');

    // Test password update through D1 bridge
    const testNewHash = 'scrypt$16384$8$1$testmigratedsalt$updatedhash12345';
    const reqUpdatePw = buildBridgeRequest('updatePasswordHash', { id: regUser.id, password_hash: testNewHash }, bridgeSecret);
    const resUpdatePw = await mf.dispatchFetch('http://127.0.0.1:8787/api/internal/d1/execute', {
      method: 'POST',
      headers: reqUpdatePw.headers,
      body: reqUpdatePw.body,
    });
    assert(resUpdatePw.status === 200, `Expected 200 for updatePasswordHash, got ${resUpdatePw.status}`);

    // Re-fetch user to confirm updated password hash in D1
    const reqVerifyPw = buildBridgeRequest('getUserForLogin', { email: 'user@stroom.app' }, bridgeSecret);
    const resVerifyPw = await mf.dispatchFetch('http://127.0.0.1:8787/api/internal/d1/execute', {
      method: 'POST',
      headers: reqVerifyPw.headers,
      body: reqVerifyPw.body,
    });
    const updatedUserData = (await resVerifyPw.json()) as any;
    assert(updatedUserData.user.password_hash === testNewHash, 'Password hash was not updated in D1');
    console.log('✅ D1 Bridge successfully executed and verified updatePasswordHash in migrated D1.\n');

    // 5. Test Failure Handling, System Table Isolation & Clean Rollback Procedures
    console.log('--- Step 5: Test Failure Handling, System Table Isolation & Clean Rollback Procedures ---');

    // 5a. Test application-only rollback (dropSystemTables: false)
    const appRollbackResult = await rollbackD1Migration({
      d1Database: d1,
      dropSystemTables: false,
      log: (m) => console.log(`   ${m}`),
    });
    assert(appRollbackResult.success, 'Application-only rollback failed');
    assert(appRollbackResult.droppedApplicationTables.length === 42, `Expected 42 dropped app tables, got ${appRollbackResult.droppedApplicationTables.length}`);
    assert(appRollbackResult.droppedSystemTables.length === 0, 'Expected 0 dropped system tables in app-only mode');

    // Verify 42 application tables are gone, but _internal_bridge_nonces remains
    const appRemainingTables = await d1.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%'").all();
    const appRemainingNames = (appRemainingTables.results as Array<{ name: string }>).map((r) => r.name);
    assert(appRemainingNames.length === 1 && appRemainingNames[0] === '_internal_bridge_nonces', `Expected only _internal_bridge_nonces remaining, got ${appRemainingNames.join(', ')}`);
    console.log('✅ Application rollback verified: 42 application tables dropped, 1 system table (_internal_bridge_nonces) safely preserved.');

    // 5b. Test full reset rollback (dropSystemTables: true)
    const fullRollbackResult = await rollbackD1Migration({
      d1Database: d1,
      dropSystemTables: true,
      log: (m) => console.log(`   ${m}`),
    });
    assert(fullRollbackResult.success, 'Full rollback failed');
    assert(fullRollbackResult.droppedSystemTables.length === 1, 'Expected 1 dropped system table in full mode');

    // Verify D1 has 0 remaining user/system tables
    const totalRemainingTables = await d1.prepare("SELECT COUNT(*) as c FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%'").first();
    assert(totalRemainingTables.c === 0, `Expected 0 remaining tables after full rollback, got ${totalRemainingTables.c}`);
    console.log('✅ Full rollback verified: All 43 tables (42 application + 1 system) cleanly dropped from D1.\n');

    // 6. Test Full Re-Migration & Recovery
    console.log('--- Step 6: Test Full Re-Migration & Recovery ---');
    await applySqlFile(d1, 'migrations/0001_initial_schema.sql');
    await applySqlFile(d1, 'migrations/0002_essential_metadata.sql');
    await applySqlFile(d1, 'migrations/0003_bridge_nonces.sql');

    const recoveryResult = await migrateSqliteToD1({
      sourceDbPath: disposableDbPath,
      d1Database: d1,
      batchSize: 50,
      log: (m) => {},
    });
    assert(recoveryResult.success, 'Recovery migration failed');
    assert(recoveryResult.totalRecordsMigrated === 10160, 'Recovery migrated count mismatch');

    const postRecoveryParity = await verifyD1Parity({
      sourceDbPath: disposableDbPath,
      d1Database: d1,
      log: (m) => {},
    });
    assert(postRecoveryParity.passed, 'Post-recovery parity failed');
    assert(postRecoveryParity.totalD1Rows === 10160, 'Post-recovery row count mismatch');
    console.log('✅ Full Re-Migration & Recovery successfully verified: 10,160 records across all 42 tables restored with 100% SHA-256 parity.\n');

  } finally {
    await mf.dispose();
    if (fs.existsSync(workerBundlePath)) {
      try { fs.unlinkSync(workerBundlePath); } catch (_) {}
    }
    if (fs.existsSync(disposableDbPath)) {
      try { fs.unlinkSync(disposableDbPath); } catch (_) {}
      try { if (fs.existsSync(disposableDbPath + '-wal')) fs.unlinkSync(disposableDbPath + '-wal'); } catch (_) {}
      try { if (fs.existsSync(disposableDbPath + '-shm')) fs.unlinkSync(disposableDbPath + '-shm'); } catch (_) {}
      console.log(`🧹 Cleaned up disposable database: ${disposableDbName}`);
    }
  }

  // Post-test Safety Verification
  const postPrimaryHash = computeSha256(PRIMARY_DB_PATH);
  const postBackupHash = computeSha256(BACKUP_DB_PATH);
  assert(postPrimaryHash === EXPECTED_PRIMARY_HASH, 'Primary SQLite DB hash altered after tests!');
  assert(postBackupHash === EXPECTED_BACKUP_HASH, 'Backup DB hash altered after tests!');
  console.log('\n✅ Post-test database integrity verified:');
  console.log(`   data/stroom.db:       ${postPrimaryHash} (MATCH 100%)`);
  console.log(`   checkpoint backup:    ${postBackupHash} (MATCH 100%)`);
  console.log('\n🎉 ALL PHASE 2.5.3 DATA MIGRATION TESTS PASSED PERFECTLY!\n');
}

runMigrationTestSuite().catch((err) => {
  console.error('\n❌ TEST RUN FAILED:', err);
  process.exit(1);
});
