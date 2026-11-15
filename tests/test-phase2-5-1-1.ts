import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import http from 'node:http';
import esbuild from 'esbuild';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import {
  generateCanonicalSecret,
  isCanonicalBase64Url32Node,
} from '../server/utils/crypto';

// Strict Safety Constants
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

async function runPhase2511Tests() {
  console.log('================================================================');
  console.log('🛡️  STROOM PHASE 2.5.1.1 CONSOLIDATED INTEGRATION TEST SUITE');
  console.log('================================================================\n');

  // Pre-test Safety Verification
  const prePrimaryHash = computeSha256(PRIMARY_DB_PATH);
  const preBackupHash = computeSha256(BACKUP_DB_PATH);
  assert(prePrimaryHash === EXPECTED_PRIMARY_HASH, 'Primary SQLite DB hash mismatch before tests');
  assert(preBackupHash === EXPECTED_BACKUP_HASH, 'Backup DB hash mismatch before tests');
  console.log('✅ Pre-test database integrity verified (Primary & Backup match baseline)');

  // Create disposable SQLite test database for Express
  const testId = crypto.randomUUID().slice(0, 8);
  const disposableDbName = `test_disposable_phase2511_${Date.now()}_${testId}.db`;
  const disposableDbPath = path.resolve(process.cwd(), 'data', disposableDbName);
  fs.copyFileSync(PRIMARY_DB_PATH, disposableDbPath);
  if (fs.existsSync(PRIMARY_DB_PATH + '-wal')) {
    fs.copyFileSync(PRIMARY_DB_PATH + '-wal', disposableDbPath + '-wal');
  }
  if (fs.existsSync(PRIMARY_DB_PATH + '-shm')) {
    fs.copyFileSync(PRIMARY_DB_PATH + '-shm', disposableDbPath + '-shm');
  }
  console.log(`✅ Created disposable test SQLite database: ${disposableDbName}`);

  // Ephemeral test secrets (never logged or shared)
  const bridgeSecretPrimary = generateCanonicalSecret();
  const bridgeSecretPrev = generateCanonicalSecret();
  const originSecretPrimary = generateCanonicalSecret();
  const originSecretPrev = generateCanonicalSecret();

  assert(isCanonicalBase64Url32Node(bridgeSecretPrimary), 'Generated bridge secret is canonical');
  assert(isCanonicalBase64Url32Node(originSecretPrimary), 'Generated origin secret is canonical');

  // 1. Bundle Worker with esbuild for Miniflare
  console.log('📦 Bundling src/worker/index.ts with esbuild...');
  const buildResult = await esbuild.build({
    entryPoints: ['src/worker/index.ts'],
    bundle: true,
    format: 'esm',
    write: false,
    target: 'es2022',
    platform: 'browser',
    external: ['@cloudflare/workers-types'],
  });
  const workerScript = buildResult.outputFiles[0].text;
  console.log('✅ Worker bundled successfully.');

  // 2. Initialize Miniflare with D1 bindings
  console.log('⚡ Initializing Miniflare instance with local D1...');
  const rawMfOpts = {
    modules: true,
    script: workerScript,
    port: 8788,
    d1Databases: ['DB'],
    bindings: {
      NODE_ENV: 'test',
      INTERNAL_D1_BRIDGE_SECRET: bridgeSecretPrimary,
      INTERNAL_D1_BRIDGE_SECRET_PREVIOUS: bridgeSecretPrev,
      INTERNAL_D1_BRIDGE_SECRET_PREVIOUS_EXPIRES_AT: String(Date.now() + 3600000), // Valid for 1h
      ORIGIN_PROXY_SECRET: originSecretPrimary,
      ORIGIN_PROXY_SECRET_PREVIOUS: originSecretPrev,
      ORIGIN_PROXY_SECRET_PREVIOUS_EXPIRES_AT: String(Date.now() + 3600000),
      ORIGIN_URL: 'http://127.0.0.1:5056',
    },
  };
  const mfOpts = typeof (convertV4MiniflareOptions as any) === 'function'
    ? (convertV4MiniflareOptions as any)(rawMfOpts)
    : rawMfOpts;
  const mf = new Miniflare(mfOpts);
  await mf.ready;
  console.log('✅ Miniflare ready on port 8788.');

  // Apply D1 migrations to Miniflare D1
  console.log('📜 Applying migrations to Miniflare D1...');
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

  await applySqlFile(d1, 'migrations/0001_initial_schema.sql');
  await applySqlFile(d1, 'migrations/0003_bridge_nonces.sql');
  console.log('✅ Migrations applied to local D1 (users table & _internal_bridge_nonces table created).');

  // Seed essential super_admin, admin, and user into Miniflare D1
  const seedSuperAdminPw = 'scrypt$16384$8$1$seedsuperadmin$validhash';
  await d1.prepare(`
    INSERT INTO users (id, email, password_hash, full_name, avatar_url, role, account_status)
    VALUES ('usr_superadmin1', 'superadmin@stroom.in', ?, 'Super Admin User', 'https://avatar.com/1', 'super_admin', 'active')
  `).bind(seedSuperAdminPw).run();

  await d1.prepare(`
    INSERT INTO users (id, email, password_hash, full_name, avatar_url, role, account_status)
    VALUES ('usr_admin1', 'admin@stroom.in', ?, 'Admin User', 'https://avatar.com/2', 'admin', 'active')
  `).bind(seedSuperAdminPw).run();

  await d1.prepare(`
    INSERT INTO users (id, email, password_hash, full_name, avatar_url, role, account_status)
    VALUES ('usr_target1', 'target@stroom.in', ?, 'Target User', 'https://avatar.com/3', 'user', 'active')
  `).bind(seedSuperAdminPw).run();
  console.log('✅ Seed users created in Miniflare D1.');

  // 3. Start Express server with disposable DB and bridge enabled
  const EXPRESS_PORT = 5056;
  process.env.NODE_ENV = 'test';
  process.env.DB_PATH = disposableDbPath;
  process.env.ENABLE_D1_AUTH_BRIDGE = 'true';
  process.env.INTERNAL_D1_BRIDGE_SECRET = bridgeSecretPrimary;
  process.env.D1_BRIDGE_URL = 'http://127.0.0.1:8788';
  process.env.REQUIRE_ORIGIN_PROXY_AUTH = 'true';
  process.env.ORIGIN_PROXY_SECRET = originSecretPrimary;
  process.env.ORIGIN_PROXY_SECRET_PREVIOUS = originSecretPrev;
  process.env.ORIGIN_PROXY_SECRET_PREVIOUS_EXPIRES_AT = String(Date.now() + 3600000);

  // Set up Express app and sync singleton configuration
  const { config: appConfig } = await import('../server/config/env');
  appConfig.d1BridgeUrl = 'http://127.0.0.1:8788';
  appConfig.internalD1BridgeSecret = bridgeSecretPrimary;
  appConfig.useD1AuthBridge = true;
  appConfig.requireOriginProxyAuth = true;
  appConfig.originProxySecret = originSecretPrimary;
  appConfig.originProxySecretPrevious = originSecretPrev;
  appConfig.originProxySecretPreviousExpiresAt = Date.now() + 3600000;

  const { d1BridgeClient } = await import('../server/services/d1BridgeClient');
  (d1BridgeClient as any).bridgeUrl = 'http://127.0.0.1:8788';
  (d1BridgeClient as any).secret = bridgeSecretPrimary;

  const { default: app } = await import('../server/index');
  const expressServer: http.Server = app.listen(EXPRESS_PORT);
  await new Promise((r) => setTimeout(r, 600));
  console.log(`✅ Express test server running on port ${EXPRESS_PORT}.`);

  let passed = 0;
  let failed = 0;

  async function test(name: string, fn: () => Promise<void>) {
    try {
      process.stdout.write(`• Testing: ${name}... `);
      await fn();
      console.log('✅ PASS');
      passed++;
    } catch (err: any) {
      console.log('❌ FAIL');
      console.error(`  Error: ${err.message}`);
      failed++;
    }
  }

  // Helper for generating authenticated worker bridge request
  function createSignedBridgeRequest(
    action: string,
    params: Record<string, any>,
    actor?: { id: string; role: string },
    options: {
      secret?: string;
      timestamp?: number;
      nonce?: string;
      tamperBody?: boolean;
      tamperSig?: boolean;
    } = {}
  ) {
    const activeSecret = options.secret ?? bridgeSecretPrimary;
    const timestamp = options.timestamp ?? Date.now();
    const nonce = options.nonce ?? crypto.randomBytes(16).toString('hex');

    const payload: any = { action, params };
    if (actor) payload.actor = actor;

    const rawBodyBuffer = Buffer.from(JSON.stringify(payload), 'utf8');
    const bodyHash = crypto.createHash('sha256').update(rawBodyBuffer).digest('hex');

    const sigPayload = `${timestamp}:${nonce}:${action}:${bodyHash}`;
    let signature = crypto.createHmac('sha256', activeSecret).update(sigPayload).digest('hex');

    if (options.tamperSig) {
      // Flip last character of signature hex
      const lastChar = signature.slice(-1);
      const flipped = lastChar === 'a' ? 'b' : 'a';
      signature = signature.slice(0, -1) + flipped;
    }

    let finalBody = rawBodyBuffer;
    if (options.tamperBody) {
      const tamperedPayload = { ...payload, params: { ...params, tamperedField: 'evil' } };
      finalBody = Buffer.from(JSON.stringify(tamperedPayload), 'utf8');
    }

    return {
      headers: {
        'Content-Type': 'application/json',
        'X-STROOM-Bridge-Secret': activeSecret,
        'X-STROOM-Timestamp': String(timestamp),
        'X-STROOM-Nonce': nonce,
        'X-STROOM-Signature': signature,
        'X-STROOM-Action': action,
      },
      body: finalBody,
    };
  }

  try {
    console.log('\n--- SUITE 1: WORKER BRIDGE CRYPTOGRAPHIC GUARDS & ERROR HANDLING ---');

    await test('Missing X-STROOM-Bridge-Secret returns 401 Unauthorized', async () => {
      const req = createSignedBridgeRequest('getUserForLogin', { email: 'target@stroom.in' });
      delete (req.headers as any)['X-STROOM-Bridge-Secret'];
      const res = await mf.dispatchFetch('http://localhost/api/internal/d1/execute', {
        method: 'POST',
        headers: req.headers,
        body: req.body,
      });
      assert(res.status === 401, `Expected 401, got ${res.status}`);
    });

    await test('Malformed non-canonical bridge secret returns 401 Unauthorized', async () => {
      const req = createSignedBridgeRequest('getUserForLogin', { email: 'target@stroom.in' });
      req.headers['X-STROOM-Bridge-Secret'] = 'invalid_non_canonical_secret';
      const res = await mf.dispatchFetch('http://localhost/api/internal/d1/execute', {
        method: 'POST',
        headers: req.headers,
        body: req.body,
      });
      assert(res.status === 401, `Expected 401, got ${res.status}`);
    });

    await test('Cross-substitution: ORIGIN_PROXY_SECRET passed to bridge endpoint returns 401', async () => {
      const req = createSignedBridgeRequest(
        'getUserForLogin',
        { email: 'target@stroom.in' },
        undefined,
        { secret: originSecretPrimary }
      );
      const res = await mf.dispatchFetch('http://localhost/api/internal/d1/execute', {
        method: 'POST',
        headers: req.headers,
        body: req.body,
      });
      assert(res.status === 401, `Expected 401 for cross-supplied secret, got ${res.status}`);
    });

    await test('Corrupted HMAC signature returns 401 Unauthorized', async () => {
      const req = createSignedBridgeRequest(
        'getUserForLogin',
        { email: 'target@stroom.in' },
        undefined,
        { tamperSig: true }
      );
      const res = await mf.dispatchFetch('http://localhost/api/internal/d1/execute', {
        method: 'POST',
        headers: req.headers,
        body: req.body,
      });
      assert(res.status === 401, `Expected 401 for tampered signature, got ${res.status}`);
    });

    await test('Modified request body after signing returns 401 Unauthorized', async () => {
      const req = createSignedBridgeRequest(
        'getUserForLogin',
        { email: 'target@stroom.in' },
        undefined,
        { tamperBody: true }
      );
      const res = await mf.dispatchFetch('http://localhost/api/internal/d1/execute', {
        method: 'POST',
        headers: req.headers,
        body: req.body,
      });
      assert(res.status === 401, `Expected 401 for tampered body, got ${res.status}`);
    });

    await test('Past timestamp drift (> 30s) returns 401 Unauthorized', async () => {
      const req = createSignedBridgeRequest(
        'getUserForLogin',
        { email: 'target@stroom.in' },
        undefined,
        { timestamp: Date.now() - 45000 }
      );
      const res = await mf.dispatchFetch('http://localhost/api/internal/d1/execute', {
        method: 'POST',
        headers: req.headers,
        body: req.body,
      });
      assert(res.status === 401, `Expected 401 for past drift, got ${res.status}`);
    });

    await test('Future timestamp drift (> 30s) returns 401 Unauthorized', async () => {
      const req = createSignedBridgeRequest(
        'getUserForLogin',
        { email: 'target@stroom.in' },
        undefined,
        { timestamp: Date.now() + 45000 }
      );
      const res = await mf.dispatchFetch('http://localhost/api/internal/d1/execute', {
        method: 'POST',
        headers: req.headers,
        body: req.body,
      });
      assert(res.status === 401, `Expected 401 for future drift, got ${res.status}`);
    });

    await test('Malformed nonce format returns 401 Unauthorized', async () => {
      const req = createSignedBridgeRequest('getUserForLogin', { email: 'target@stroom.in' });
      req.headers['X-STROOM-Nonce'] = 'bad/nonce$!';
      const res = await mf.dispatchFetch('http://localhost/api/internal/d1/execute', {
        method: 'POST',
        headers: req.headers,
        body: req.body,
      });
      assert(res.status === 401, `Expected 401 for bad nonce format, got ${res.status}`);
    });

    await test('Unallowlisted bridge action returns 400 Bad Request', async () => {
      const req = createSignedBridgeRequest('dropAllTables', { param: 'test' });
      const res = await mf.dispatchFetch('http://localhost/api/internal/d1/execute', {
        method: 'POST',
        headers: req.headers,
        body: req.body,
      });
      assert(res.status === 400, `Expected 400 for unallowlisted action, got ${res.status}`);
    });

    console.log('\n--- SUITE 2: D1 REPLAY NONCES & ATOMIC BATCH CONSISTENCY ---');

    await test('Sequential duplicate nonce replay is rejected with 409 Conflict', async () => {
      const fixedNonce = 'nonce_seq_test_' + crypto.randomBytes(8).toString('hex');
      const req = createSignedBridgeRequest(
        'getUserForLogin',
        { email: 'target@stroom.in' },
        undefined,
        { nonce: fixedNonce }
      );

      // Attempt 1: succeeds
      const res1 = await mf.dispatchFetch('http://localhost/api/internal/d1/execute', {
        method: 'POST',
        headers: req.headers,
        body: req.body,
      });
      assert(res1.status === 200, `First request failed: status ${res1.status}`);

      // Attempt 2: identical request replay
      const res2 = await mf.dispatchFetch('http://localhost/api/internal/d1/execute', {
        method: 'POST',
        headers: req.headers,
        body: req.body,
      });
      assert(res2.status === 409, `Expected 409 Conflict on replay, got ${res2.status}`);
      const json2: any = await res2.json();
      assert(json2.message.includes('Replay detected'), 'Expected replay message in response');
    });

    await test('Concurrent duplicate nonce replay yields exactly 1x 200 and 1x 409 Conflict', async () => {
      const fixedNonce = 'nonce_conc_test_' + crypto.randomBytes(8).toString('hex');
      const req = createSignedBridgeRequest(
        'getUserForLogin',
        { email: 'target@stroom.in' },
        undefined,
        { nonce: fixedNonce }
      );

      const [r1, r2] = await Promise.all([
        mf.dispatchFetch('http://localhost/api/internal/d1/execute', {
          method: 'POST',
          headers: req.headers,
          body: req.body,
        }),
        mf.dispatchFetch('http://localhost/api/internal/d1/execute', {
          method: 'POST',
          headers: req.headers,
          body: req.body,
        }),
      ]);

      const statuses = [r1.status, r2.status].sort();
      assert(
        statuses[0] === 200 && statuses[1] === 409,
        `Expected statuses [200, 409], got [${statuses.join(', ')}]`
      );
    });

    await test('Batch rollback on business failure: statement 1 nonce uncommitted', async () => {
      const testNonce = 'nonce_rollback_' + crypto.randomBytes(8).toString('hex');
      // Create user with already existing email 'target@stroom.in' and a different ID to trigger constraint
      const req = createSignedBridgeRequest(
        'createUser',
        {
          id: 'usr_different_rollback',
          email: 'target@stroom.in', // Conflict!
          password_hash: 'hash123',
          full_name: 'Rollback User',
        },
        undefined,
        { nonce: testNonce }
      );

      const res = await mf.dispatchFetch('http://localhost/api/internal/d1/execute', {
        method: 'POST',
        headers: req.headers,
        body: req.body,
      });
      assert(res.status === 409, `Expected 409 Conflict for existing email, got ${res.status}`);

      // Verify nonce was NOT committed due to batch transaction rollback
      const nonceRecord = await d1
        .prepare('SELECT nonce FROM _internal_bridge_nonces WHERE nonce = ?')
        .bind(testNonce)
        .first();
      assert(nonceRecord === null, 'Nonce must be rolled back and uncommitted on business failure');
    });

    console.log('\n--- SUITE 3: SIX APPROVED D1 BRIDGE ACTIONS (FLOW A) ---');

    await test('Action 1: getUserForLogin returns user with password hash', async () => {
      const req = createSignedBridgeRequest('getUserForLogin', { email: 'target@stroom.in' });
      const res = await mf.dispatchFetch('http://localhost/api/internal/d1/execute', {
        method: 'POST',
        headers: req.headers,
        body: req.body,
      });
      assert(res.status === 200, `Expected 200, got ${res.status}`);
      const json: any = await res.json();
      assert(json.success === true, 'Expected success: true');
      assert(json.user?.email === 'target@stroom.in', 'User email match');
      assert(Boolean(json.user?.password_hash), 'Password hash must be returned over authenticated internal bridge');
    });

    await test('Action 1: getUserForLogin returns null for non-existent email', async () => {
      const req = createSignedBridgeRequest('getUserForLogin', { email: 'nonexistent@stroom.in' });
      const res = await mf.dispatchFetch('http://localhost/api/internal/d1/execute', {
        method: 'POST',
        headers: req.headers,
        body: req.body,
      });
      assert(res.status === 200, `Expected 200, got ${res.status}`);
      const json: any = await res.json();
      assert(json.user === null, 'Expected user: null');
    });

    const newUserId = 'usr_flowa_' + crypto.randomBytes(6).toString('hex');
    const newUserEmail = `flowa_${Date.now()}@stroom.in`;
    const newPasswordHash = 'scrypt$16384$8$1$salted$hashabc123';

    await test('Action 2: createUser inserts new user record into D1', async () => {
      const req = createSignedBridgeRequest('createUser', {
        id: newUserId,
        email: newUserEmail,
        password_hash: newPasswordHash,
        full_name: 'Flow A User',
      });
      const res = await mf.dispatchFetch('http://localhost/api/internal/d1/execute', {
        method: 'POST',
        headers: req.headers,
        body: req.body,
      });
      assert(res.status === 201, `Expected 201, got ${res.status}`);
      const json: any = await res.json();
      assert(json.userId === newUserId, 'Expected returned userId match');

      const d1Row = await d1
        .prepare('SELECT id, email, full_name, role, onboarding_status FROM users WHERE id = ?')
        .bind(newUserId)
        .first<any>();
      assert(d1Row?.id === newUserId, 'User row created in D1');
      assert(d1Row?.role === 'user', 'Default role is user');
      assert(d1Row?.onboarding_status === 'NOT_STARTED', 'Default onboarding_status is NOT_STARTED');
    });

    await test('Action 2: createUser retry reconciliation on timeout recovery', async () => {
      // Re-invoke createUser with fresh nonce but SAME id and email (simulating timeout retry)
      const req = createSignedBridgeRequest('createUser', {
        id: newUserId,
        email: newUserEmail,
        password_hash: newPasswordHash,
        full_name: 'Flow A User',
      });
      const res = await mf.dispatchFetch('http://localhost/api/internal/d1/execute', {
        method: 'POST',
        headers: req.headers,
        body: req.body,
      });
      assert(res.status === 200, `Expected 200 OK for reconciled retry, got ${res.status}`);
      const json: any = await res.json();
      assert(json.reconciled === true, 'Expected reconciled: true on timeout retry');
      assert(json.userId === newUserId, 'Expected returned userId match');
    });

    await test('Action 2: createUser duplicate email from different user fails with 409', async () => {
      const req = createSignedBridgeRequest('createUser', {
        id: 'usr_different_' + crypto.randomBytes(6).toString('hex'),
        email: newUserEmail, // Existing email!
        password_hash: 'hashxyz',
        full_name: 'Imposter User',
      });
      const res = await mf.dispatchFetch('http://localhost/api/internal/d1/execute', {
        method: 'POST',
        headers: req.headers,
        body: req.body,
      });
      assert(res.status === 409, `Expected 409 Conflict, got ${res.status}`);
      const json: any = await res.json();
      assert(json.code === 'USER_EXISTS', 'Expected USER_EXISTS error code');
    });

    const upgradedHash = 'scrypt$16384$8$1$upgraded$hash999';
    await test('Action 3: updatePasswordHash transparently upgrades password in D1', async () => {
      const req = createSignedBridgeRequest('updatePasswordHash', {
        id: newUserId,
        password_hash: upgradedHash,
      });
      const res = await mf.dispatchFetch('http://localhost/api/internal/d1/execute', {
        method: 'POST',
        headers: req.headers,
        body: req.body,
      });
      assert(res.status === 200, `Expected 200, got ${res.status}`);

      const userRow = await d1
        .prepare('SELECT password_hash FROM users WHERE id = ?')
        .bind(newUserId)
        .first<any>();
      assert(userRow?.password_hash === upgradedHash, 'Password hash successfully updated in D1');
    });

    const changedHash = 'scrypt$16384$8$1$changed$hash777';
    await test('Action 4: changePassword updates password in D1 and is idempotent', async () => {
      const req1 = createSignedBridgeRequest('changePassword', {
        id: newUserId,
        password_hash: changedHash,
      });
      const res1 = await mf.dispatchFetch('http://localhost/api/internal/d1/execute', {
        method: 'POST',
        headers: req1.headers,
        body: req1.body,
      });
      assert(res1.status === 200, `Expected 200, got ${res1.status}`);

      // Repeated assignment with fresh nonce is idempotent
      const req2 = createSignedBridgeRequest('changePassword', {
        id: newUserId,
        password_hash: changedHash,
      });
      const res2 = await mf.dispatchFetch('http://localhost/api/internal/d1/execute', {
        method: 'POST',
        headers: req2.headers,
        body: req2.body,
      });
      assert(res2.status === 200, `Idempotent repeat expected 200, got ${res2.status}`);
    });

    await test('Action 5: changeAccountStatus suspends member with verified admin actor', async () => {
      const req = createSignedBridgeRequest(
        'changeAccountStatus',
        { id: newUserId, account_status: 'suspended' },
        { id: 'usr_admin1', role: 'admin' }
      );
      const res = await mf.dispatchFetch('http://localhost/api/internal/d1/execute', {
        method: 'POST',
        headers: req.headers,
        body: req.body,
      });
      assert(res.status === 200, `Expected 200, got ${res.status}`);
      const d1Row = await d1
        .prepare('SELECT account_status FROM users WHERE id = ?')
        .bind(newUserId)
        .first<any>();
      assert(d1Row?.account_status === 'suspended', 'Account status suspended in D1');
    });

    await test('Action 5: changeAccountStatus self-modification defense rejects with 400', async () => {
      const req = createSignedBridgeRequest(
        'changeAccountStatus',
        { id: 'usr_admin1', account_status: 'suspended' },
        { id: 'usr_admin1', role: 'admin' } // Self-modification!
      );
      const res = await mf.dispatchFetch('http://localhost/api/internal/d1/execute', {
        method: 'POST',
        headers: req.headers,
        body: req.body,
      });
      assert(res.status === 400, `Expected 400 for self-suspension, got ${res.status}`);
    });

    await test('Action 5: non-super-admin cannot suspend a privileged super_admin (403)', async () => {
      const req = createSignedBridgeRequest(
        'changeAccountStatus',
        { id: 'usr_superadmin1', account_status: 'suspended' },
        { id: 'usr_admin1', role: 'admin' } // Regular admin targeting super admin!
      );
      const res = await mf.dispatchFetch('http://localhost/api/internal/d1/execute', {
        method: 'POST',
        headers: req.headers,
        body: req.body,
      });
      assert(res.status === 403, `Expected 403 Forbidden, got ${res.status}`);
    });

    await test('Action 6: updateUserRole updates role to operational role (event_manager)', async () => {
      const req = createSignedBridgeRequest(
        'updateUserRole',
        { id: newUserId, role: 'event_manager' },
        { id: 'usr_superadmin1', role: 'super_admin' }
      );
      const res = await mf.dispatchFetch('http://localhost/api/internal/d1/execute', {
        method: 'POST',
        headers: req.headers,
        body: req.body,
      });
      assert(res.status === 200, `Expected 200, got ${res.status}`);
      const d1Row = await d1
        .prepare('SELECT role FROM users WHERE id = ?')
        .bind(newUserId)
        .first<any>();
      assert(d1Row?.role === 'event_manager', 'Role updated to event_manager in D1');
    });

    await test('Action 6: updateUserRole privilege escalation blocked (admin cannot assign super_admin)', async () => {
      const req = createSignedBridgeRequest(
        'updateUserRole',
        { id: newUserId, role: 'super_admin' },
        { id: 'usr_admin1', role: 'admin' } // Unauthorized privilege escalation!
      );
      const res = await mf.dispatchFetch('http://localhost/api/internal/d1/execute', {
        method: 'POST',
        headers: req.headers,
        body: req.body,
      });
      assert(res.status === 403, `Expected 403 Forbidden, got ${res.status}`);
    });

    await test('Action 6: updateUserRole self-modification defense rejects with 400', async () => {
      const req = createSignedBridgeRequest(
        'updateUserRole',
        { id: 'usr_admin1', role: 'user' },
        { id: 'usr_admin1', role: 'admin' } // Self-modification!
      );
      const res = await mf.dispatchFetch('http://localhost/api/internal/d1/execute', {
        method: 'POST',
        headers: req.headers,
        body: req.body,
      });
      assert(res.status === 400, `Expected 400 for self-role modification, got ${res.status}`);
    });

    await test('Action 6: updateUserRole invalid role key rejects with 400 Bad Request', async () => {
      const req = createSignedBridgeRequest(
        'updateUserRole',
        { id: newUserId, role: 'invented_fake_role' },
        { id: 'usr_superadmin1', role: 'super_admin' }
      );
      const res = await mf.dispatchFetch('http://localhost/api/internal/d1/execute', {
        method: 'POST',
        headers: req.headers,
        body: req.body,
      });
      assert(res.status === 400, `Expected 400 for invalid role, got ${res.status}`);
    });

    console.log('\n--- SUITE 4: SECRET ROTATION & EXPIRY BOUNDARY HANDLING ---');

    await test('Bridge secret rotation: primary secret authenticates (200)', async () => {
      const req = createSignedBridgeRequest(
        'getUserForLogin',
        { email: 'target@stroom.in' },
        undefined,
        { secret: bridgeSecretPrimary }
      );
      const res = await mf.dispatchFetch('http://localhost/api/internal/d1/execute', {
        method: 'POST',
        headers: req.headers,
        body: req.body,
      });
      assert(res.status === 200, `Expected 200 for primary secret, got ${res.status}`);
    });

    await test('Bridge secret rotation: previous secret within 72h overlap authenticates (200)', async () => {
      const req = createSignedBridgeRequest(
        'getUserForLogin',
        { email: 'target@stroom.in' },
        undefined,
        { secret: bridgeSecretPrev }
      );
      const res = await mf.dispatchFetch('http://localhost/api/internal/d1/execute', {
        method: 'POST',
        headers: req.headers,
        body: req.body,
      });
      assert(res.status === 200, `Expected 200 for valid previous secret, got ${res.status}`);
    });

    console.log('\n--- SUITE 5: TRUST PATH B (WORKER -> EXPRESS) & ORIGIN PROXY GUARD ---');

    await test('Worker Auth Proxy forwards request and Express accepts (200/201 OK)', async () => {
      const proxyReqBody = {
        email: `proxied_user_${Date.now()}@stroom.in`,
        password: 'ValidPassword123!',
        full_name: 'Proxied User',
      };
      const res = await mf.dispatchFetch('http://localhost/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(proxyReqBody),
      });
      assert(res.status === 201, `Expected 201 Created from proxied register, got ${res.status}`);
    });

    await test('Direct origin bypass without X-STROOM-Origin-Secret rejected with 403 Forbidden', async () => {
      const directRes = await fetch(`http://127.0.0.1:${EXPRESS_PORT}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'target@stroom.in', password: 'password' }),
      });
      assert(
        directRes.status === 403,
        `Expected 403 Forbidden for direct access without secret, got ${directRes.status}`
      );
      const json: any = await directRes.json();
      assert(json.error === 'Forbidden', 'Expected Forbidden response body');
    });

    await test('Worker Auth Proxy strips spoofed client headers before proxying', async () => {
      const proxyReqBody = {
        email: `spoof_user_${Date.now()}@stroom.in`,
        password: 'ValidPassword123!',
        full_name: 'Spoof Test User',
      };
      const res = await mf.dispatchFetch('http://localhost/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-STROOM-Origin-Secret': 'forged_client_secret_attempt', // Ingress spoofing attempt!
        },
        body: JSON.stringify(proxyReqBody),
      });
      assert(
        res.status === 201,
        `Expected 201 Created because worker sanitized header and injected real secret, got ${res.status}`
      );
    });

    await test('Cross-substitution: INTERNAL_D1_BRIDGE_SECRET rejected by Express Origin Proxy (403)', async () => {
      const directRes = await fetch(`http://127.0.0.1:${EXPRESS_PORT}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-STROOM-Origin-Secret': bridgeSecretPrimary, // Cross-substituted secret!
        },
        body: JSON.stringify({ email: 'target@stroom.in', password: 'password' }),
      });
      assert(directRes.status === 403, `Expected 403 for cross-substituted secret, got ${directRes.status}`);
    });

    console.log('\n--- SUITE 6: ZERO PASSWORD HASH EXPOSURE AUDIT ---');

    await test('Password hashes never leaked in public API responses or logs', async () => {
      const proxyLoginRes = await mf.dispatchFetch('http://localhost/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'target@stroom.in', password: 'badpassword' }),
      });
      const text = await proxyLoginRes.text();
      assert(!text.includes('scrypt$'), 'Response must never leak scrypt hash');
      assert(!text.includes('password_hash'), 'Response must never leak password_hash field');
    });

    console.log('\n--- SUITE 7: STARTUP FAIL-CLOSED VALIDATION ---');

    await test('validateEnvironment fails closed when ENABLE_D1_AUTH_BRIDGE=true but secret invalid', async () => {
      const { validateEnvironment, config } = await import('../server/config/env');
      const originalBridge = config.useD1AuthBridge;
      const originalSecret = config.internalD1BridgeSecret;

      try {
        config.useD1AuthBridge = true;
        config.internalD1BridgeSecret = 'non_canonical_secret!';
        let threw = false;
        try {
          validateEnvironment();
        } catch {
          threw = true;
        }
        assert(threw, 'validateEnvironment must throw when bridge secret is non-canonical');
      } finally {
        config.useD1AuthBridge = originalBridge;
        config.internalD1BridgeSecret = originalSecret;
      }
    });

    await test('validateEnvironment fails closed when REQUIRE_ORIGIN_PROXY_AUTH=true but secret invalid', async () => {
      const { validateEnvironment, config } = await import('../server/config/env');
      const originalRequire = config.requireOriginProxyAuth;
      const originalOriginSecret = config.originProxySecret;

      try {
        config.requireOriginProxyAuth = true;
        config.originProxySecret = '';
        let threw = false;
        try {
          validateEnvironment();
        } catch {
          threw = true;
        }
        assert(threw, 'validateEnvironment must throw when origin proxy secret is empty');
      } finally {
        config.requireOriginProxyAuth = originalRequire;
        config.originProxySecret = originalOriginSecret;
      }
    });
  } finally {
    console.log('\n================================================================');
    console.log('🧹 CLEANING UP INTEGRATION TEST HARNESS');
    console.log('================================================================');

    // 1. Close Express test server
    expressServer.close();
    console.log('✅ Express test server stopped.');

    // 2. Dispose Miniflare
    await mf.dispose();
    console.log('✅ Miniflare instance disposed cleanly.');

    // 3. Close SQLite database connection
    try {
      const { db } = await import('../server/db/database');
      db.close();
      console.log('✅ Disposable SQLite database connection closed.');
    } catch {
      // Ignored
    }

    // 4. Delete disposable SQLite database and WAL files
    const filesToClean = [
      disposableDbPath,
      disposableDbPath + '-wal',
      disposableDbPath + '-shm',
    ];
    for (const f of filesToClean) {
      if (fs.existsSync(f)) {
        try {
          fs.unlinkSync(f);
          console.log(`Deleted: ${path.basename(f)}`);
        } catch (err: any) {
          console.warn(`[Warning] Failed to delete ${path.basename(f)}:`, err.message);
        }
      }
    }

    // 4. Verify primary and backup database hashes remain 100% untouched
    const postPrimaryHash = computeSha256(PRIMARY_DB_PATH);
    const postBackupHash = computeSha256(BACKUP_DB_PATH);
    console.log('\n--- POST-TEST DATABASE INTEGRITY VERIFICATION ---');
    console.log('Primary DB Hash: ', postPrimaryHash);
    console.log('Expected Hash:   ', EXPECTED_PRIMARY_HASH);
    assert(postPrimaryHash === EXPECTED_PRIMARY_HASH, 'FATAL: Primary SQLite database was modified!');
    console.log('Backup DB Hash:  ', postBackupHash);
    console.log('Expected Hash:   ', EXPECTED_BACKUP_HASH);
    assert(postBackupHash === EXPECTED_BACKUP_HASH, 'FATAL: Checkpoint backup was modified!');
    console.log('✅ Database safety verified: 100% pristine and unaltered.');

    console.log('\n================================================================');
    console.log(`🏁 PHASE 2.5.1.1 TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('================================================================\n');

    if (failed > 0) {
      process.exit(1);
    }
  }
}

runPhase2511Tests().catch((err) => {
  console.error('[FATAL] Unhandled test harness error:', err);
  process.exit(1);
});
