import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import http from 'node:http';
import esbuild from 'esbuild';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import jwt from 'jsonwebtoken';
import { generateCanonicalSecret, isCanonicalBase64Url32Node } from '../server/utils/crypto';

const TEST_JWT_SECRET = 'test-jwt-secret-phase252-auth-key-32b';

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

async function runReadinessTests() {
  console.log('================================================================');
  console.log('🛡️  STROOM PHASE 2.5.2 PRODUCTION READINESS & R2 TEST SUITE');
  console.log('================================================================\n');

  // Pre-test Safety Verification
  const prePrimaryHash = computeSha256(PRIMARY_DB_PATH);
  const preBackupHash = computeSha256(BACKUP_DB_PATH);
  assert(prePrimaryHash === EXPECTED_PRIMARY_HASH, 'Primary SQLite DB hash mismatch before tests');
  assert(preBackupHash === EXPECTED_BACKUP_HASH, 'Backup DB hash mismatch before tests');
  console.log('✅ Pre-test database integrity verified (Primary & Backup match baseline)');

  // Disposable SQLite database for Express
  const testId = crypto.randomUUID().slice(0, 8);
  const disposableDbName = `test_disposable_phase252_${Date.now()}_${testId}.db`;
  const disposableDbPath = path.resolve(process.cwd(), 'data', disposableDbName);
  fs.copyFileSync(PRIMARY_DB_PATH, disposableDbPath);
  if (fs.existsSync(PRIMARY_DB_PATH + '-wal')) {
    fs.copyFileSync(PRIMARY_DB_PATH + '-wal', disposableDbPath + '-wal');
  }
  if (fs.existsSync(PRIMARY_DB_PATH + '-shm')) {
    fs.copyFileSync(PRIMARY_DB_PATH + '-shm', disposableDbPath + '-shm');
  }
  console.log(`✅ Created disposable test SQLite database: ${disposableDbName}`);

  // Generate ephemeral secrets for test run
  const bridgeSecret = generateCanonicalSecret();
  const originSecret = generateCanonicalSecret();
  const mediaSecret = generateCanonicalSecret();
  assert(isCanonicalBase64Url32Node(bridgeSecret), 'Bridge secret is canonical 43-char base64url');
  assert(isCanonicalBase64Url32Node(originSecret), 'Origin secret is canonical 43-char base64url');
  assert(isCanonicalBase64Url32Node(mediaSecret), 'Media secret is canonical 43-char base64url');

  // 1. Bundle Worker
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

  // 2. Initialize Miniflare with D1 and R2 Media Bucket
  console.log('⚡ Initializing Miniflare with D1 & R2 Media Bucket...');
  const rawMfOpts = {
    modules: true,
    script: workerScript,
    port: 8789,
    d1Databases: ['DB'],
    r2Buckets: ['MEDIA_BUCKET'],
    bindings: {
      NODE_ENV: 'test',
      INTERNAL_D1_BRIDGE_SECRET: bridgeSecret,
      ORIGIN_PROXY_SECRET: originSecret,
      INTERNAL_MEDIA_SECRET: mediaSecret,
      ORIGIN_URL: 'http://127.0.0.1:5057',
      JWT_SECRET: TEST_JWT_SECRET,
    },
  };
  const mfOpts = typeof (convertV4MiniflareOptions as any) === 'function'
    ? (convertV4MiniflareOptions as any)(rawMfOpts)
    : rawMfOpts;
  const mf = new Miniflare(mfOpts);
  await mf.ready;
  console.log('✅ Miniflare ready on port 8789.');

  // 3. Apply D1 Migrations: 0001, 0002, 0003
  console.log('📜 Applying repeatable migrations to Miniflare D1...');
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
  await applySqlFile(d1, 'migrations/0002_essential_metadata.sql');
  await applySqlFile(d1, 'migrations/0003_bridge_nonces.sql');
  console.log('✅ Migrations 0001, 0002, 0003 applied cleanly to Miniflare D1.');

  // 4. Start Express on port 5057
  const EXPRESS_PORT = 5057;
  process.env.NODE_ENV = 'test';
  process.env.DB_PATH = disposableDbPath;
  process.env.ENABLE_D1_AUTH_BRIDGE = 'true';
  process.env.INTERNAL_D1_BRIDGE_SECRET = bridgeSecret;
  process.env.D1_BRIDGE_URL = 'http://127.0.0.1:8789';
  process.env.REQUIRE_ORIGIN_PROXY_AUTH = 'true';
  process.env.ORIGIN_PROXY_SECRET = originSecret;

  const { config: appConfig } = await import('../server/config/env');
  appConfig.d1BridgeUrl = 'http://127.0.0.1:8789';
  appConfig.internalD1BridgeSecret = bridgeSecret;
  appConfig.useD1AuthBridge = true;
  appConfig.requireOriginProxyAuth = true;
  appConfig.originProxySecret = originSecret;

  const { d1BridgeClient } = await import('../server/services/d1BridgeClient');
  (d1BridgeClient as any).bridgeUrl = 'http://127.0.0.1:8789';
  (d1BridgeClient as any).secret = bridgeSecret;

  const { default: app } = await import('../server/index');
  const expressServer: http.Server = app.listen(EXPRESS_PORT);
  await new Promise((r) => setTimeout(r, 600));
  console.log(`✅ Express server running on port ${EXPRESS_PORT}.`);

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

  try {
    console.log('\n--- SUITE 1: CLOUDFLARE D1 SCHEMA & HEALTH PROBE ---');

    await test('Worker health probe verifies 42 application tables in D1', async () => {
      const res = await mf.dispatchFetch('http://localhost/api/health');
      assert(res.status === 200, `Expected 200, got ${res.status}`);
      const json: any = await res.json();
      assert(json.status === 'healthy', 'Expected status: healthy');
      assert(json.database.applicationTables === 42, `Expected 42 tables, got ${json.database.applicationTables}`);
      assert(json.database.schemaVerified === true, 'Expected schemaVerified: true');
    });

    await test('Essential metadata migration seeded cities and platform settings', async () => {
      const hyd = await d1.prepare('SELECT name, is_active FROM cities WHERE id = ?').bind('city_hyd').first<any>();
      assert(hyd?.name === 'Hyderabad', 'Expected city Hyderabad in D1');
      assert(hyd?.is_active === 1, 'Expected Hyderabad to be active');

      const pune = await d1.prepare('SELECT name, is_active FROM cities WHERE id = ?').bind('city_pune').first<any>();
      assert(pune?.name === 'Pune', 'Expected city Pune in D1');

      const setting = await d1.prepare('SELECT value_json FROM platform_settings WHERE key = ?')
        .bind('general').first<any>();
      assert(setting !== null, 'Platform setting "general" must exist');
      const generalData = JSON.parse(setting.value_json);
      assert(generalData.defaultCity === 'Hyderabad', 'Expected defaultCity to be Hyderabad');
    });

    console.log('\n--- SUITE 2: CLOUDFLARE R2 FILE STORAGE & ACCESS CONTROLS ---');

    // Create test JWTs
    const u1Token = jwt.sign({ id: 'user_u1', email: 'u1@stroom.in', role: 'user' }, TEST_JWT_SECRET, { expiresIn: '1h' });
    const u2Token = jwt.sign({ id: 'user_u2', email: 'u2@stroom.in', role: 'user' }, TEST_JWT_SECRET, { expiresIn: '1h' });
    const adminToken = jwt.sign({ id: 'admin_a1', email: 'admin@stroom.in', role: 'admin' }, TEST_JWT_SECRET, { expiresIn: '1h' });

    let uploadedPublicKey = '';
    let uploadedPrivateKey = '';
    const sampleJpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);
    const samplePng = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);

    await test('R2 Media Upload: rejects unauthenticated upload with 401 Unauthorized', async () => {
      const res = await mf.dispatchFetch('http://localhost/api/media/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'image/jpeg' },
        body: sampleJpeg,
      });
      assert(res.status === 401, `Expected 401 Unauthorized, got ${res.status}`);
    });

    await test('R2 Media Upload: accepts valid JPEG binary payload with authentication (201 Created)', async () => {
      const res = await mf.dispatchFetch('http://localhost/api/media/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'image/jpeg',
          Authorization: `Bearer ${u1Token}`,
        },
        body: sampleJpeg,
      });
      assert(res.status === 201, `Expected 201, got ${res.status}`);
      const json: any = await res.json();
      assert(json.success === true, 'Expected success: true');
      assert(typeof json.key === 'string' && json.key.startsWith('pub_') && json.key.endsWith('.jpg'), 'Key starts with pub_ and ends with .jpg');
      assert(json.url === `/api/media/${json.key}`, 'URL matches key path');
      uploadedPublicKey = json.key;
    });

    await test('R2 Media Upload: accepts valid PNG binary payload with authentication (201 Created)', async () => {
      const res = await mf.dispatchFetch('http://localhost/api/media/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'image/png',
          Authorization: `Bearer ${u1Token}`,
        },
        body: samplePng,
      });
      assert(res.status === 201, `Expected 201, got ${res.status}`);
      const json: any = await res.json();
      assert(json.key.startsWith('pub_') && json.key.endsWith('.png'), 'Key ends with .png');
    });

    await test('R2 Media Upload: rejects payload exceeding 5MB limit with 413 Payload Too Large', async () => {
      const oversizedBuffer = Buffer.alloc(5 * 1024 * 1024 + 1024);
      oversizedBuffer[0] = 0xff;
      oversizedBuffer[1] = 0xd8;
      oversizedBuffer[2] = 0xff;
      const res = await mf.dispatchFetch('http://localhost/api/media/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'image/jpeg',
          Authorization: `Bearer ${u1Token}`,
        },
        body: oversizedBuffer,
      });
      assert(res.status === 413, `Expected 413 Payload Too Large, got ${res.status}`);
    });

    await test('R2 Media Upload: rejects magic-bytes mismatch with 400 Bad Request', async () => {
      const res = await mf.dispatchFetch('http://localhost/api/media/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'image/jpeg',
          Authorization: `Bearer ${u1Token}`,
        },
        body: samplePng, // Declared JPEG, but body is PNG
      });
      assert(res.status === 400, `Expected 400 Bad Request, got ${res.status}`);
      const json: any = await res.json();
      assert(json.message.includes('magic bytes'), 'Error mentions magic bytes');
    });

    await test('R2 Media Upload: rejects unsupported MIME type (415 Unsupported Media Type)', async () => {
      const res = await mf.dispatchFetch('http://localhost/api/media/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-msdownload',
          Authorization: `Bearer ${u1Token}`,
        },
        body: Buffer.from('executable binary code'),
      });
      assert(res.status === 415, `Expected 415, got ${res.status}`);
    });

    await test('R2 Media Upload: rejects HTML/SVG script injection types (415)', async () => {
      const res = await mf.dispatchFetch('http://localhost/api/media/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'image/svg+xml',
          Authorization: `Bearer ${u1Token}`,
        },
        body: Buffer.from('<svg><script>alert(1)</script></svg>'),
      });
      assert(res.status === 415, `Expected 415 for SVG, got ${res.status}`);
    });

    await test('R2 Media Retrieval: serves public uploaded image without auth and with immutable caching headers', async () => {
      const res = await mf.dispatchFetch(`http://localhost/api/media/${uploadedPublicKey}`);
      assert(res.status === 200, `Expected 200, got ${res.status}`);
      assert(res.headers.get('Content-Type') === 'image/jpeg', 'Content-Type must be image/jpeg');
      assert(
        res.headers.get('Cache-Control')?.includes('max-age=31536000'),
        'Cache-Control must contain max-age=31536000'
      );
      assert(res.headers.get('X-Content-Type-Options') === 'nosniff', 'nosniff header must be present');
    });

    await test('R2 Media Upload: supports private media upload with visibility=private', async () => {
      const res = await mf.dispatchFetch('http://localhost/api/media/upload?visibility=private', {
        method: 'POST',
        headers: {
          'Content-Type': 'image/jpeg',
          Authorization: `Bearer ${u1Token}`,
        },
        body: sampleJpeg,
      });
      assert(res.status === 201, `Expected 201, got ${res.status}`);
      const json: any = await res.json();
      assert(json.visibility === 'private', 'Visibility is private');
      assert(json.key.startsWith('priv_user_u1_'), `Key starts with priv_user_u1_, got ${json.key}`);
      uploadedPrivateKey = json.key;
    });

    await test('R2 Media Upload: rejects internal service credential substitution on public user upload (401)', async () => {
      const resBridge = await mf.dispatchFetch('http://localhost/api/media/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'image/jpeg',
          'X-STROOM-Bridge-Secret': bridgeSecret,
        },
        body: sampleJpeg,
      });
      assert(resBridge.status === 401, `Expected 401 for bridge secret on public upload, got ${resBridge.status}`);
      const jsonBridge: any = await resBridge.json();
      assert(jsonBridge.message.includes('Internal service credentials cannot be used'), 'Error explains service credentials cannot be used');

      const resMedia = await mf.dispatchFetch('http://localhost/api/media/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'image/jpeg',
          'X-STROOM-Media-Secret': mediaSecret,
        },
        body: sampleJpeg,
      });
      assert(resMedia.status === 401, `Expected 401 for media secret on public upload, got ${resMedia.status}`);
    });

    await test('R2 Media Retrieval: blocks unauthenticated access to private media (401 Unauthorized)', async () => {
      const res = await mf.dispatchFetch(`http://localhost/api/media/${uploadedPrivateKey}`);
      assert(res.status === 401, `Expected 401 Unauthorized, got ${res.status}`);
    });

    await test('R2 Media Retrieval: rejects internal credential substitution on private user media endpoint (401)', async () => {
      const resBridge = await mf.dispatchFetch(`http://localhost/api/media/${uploadedPrivateKey}`, {
        headers: {
          'X-STROOM-Bridge-Secret': bridgeSecret,
        },
      });
      assert(resBridge.status === 401, `Expected 401 Unauthorized for bridge secret on private media, got ${resBridge.status}`);

      const resMedia = await mf.dispatchFetch(`http://localhost/api/media/${uploadedPrivateKey}`, {
        headers: {
          'X-STROOM-Media-Secret': mediaSecret,
        },
      });
      assert(resMedia.status === 401, `Expected 401 Unauthorized for media secret on private media, got ${resMedia.status}`);
    });

    await test('R2 Media Retrieval: blocks unauthorized user access to private media (403 Forbidden)', async () => {
      const res = await mf.dispatchFetch(`http://localhost/api/media/${uploadedPrivateKey}`, {
        headers: { Authorization: `Bearer ${u2Token}` },
      });
      assert(res.status === 403, `Expected 403 Forbidden, got ${res.status}`);
    });

    await test('R2 Media Retrieval: allows owner access to private media (200 OK with no-cache headers)', async () => {
      const res = await mf.dispatchFetch(`http://localhost/api/media/${uploadedPrivateKey}`, {
        headers: { Authorization: `Bearer ${u1Token}` },
      });
      assert(res.status === 200, `Expected 200 OK, got ${res.status}`);
      assert(res.headers.get('Cache-Control')?.includes('no-store'), 'Cache-Control must be private no-store');
      assert(res.headers.get('X-Content-Type-Options') === 'nosniff', 'nosniff must be present');
    });

    await test('R2 Media Retrieval: allows admin access to private media (200 OK)', async () => {
      const res = await mf.dispatchFetch(`http://localhost/api/media/${uploadedPrivateKey}`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert(res.status === 200, `Expected 200 OK, got ${res.status}`);
    });

    await test('R2 Internal Service: rejects browser/user JWT credentials on internal media endpoint (401)', async () => {
      const res = await mf.dispatchFetch('http://localhost/api/internal/media/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'image/jpeg',
          Authorization: `Bearer ${u1Token}`,
        },
        body: sampleJpeg,
      });
      assert(res.status === 401, `Expected 401 Unauthorized for JWT on internal endpoint, got ${res.status}`);
      const json: any = await res.json();
      assert(json.message.includes('Browser or user credentials cannot invoke internal media endpoints'), 'Explains JWT blocked');
    });

    await test('R2 Internal Service: rejects D1 bridge credential cross-substitution (401)', async () => {
      const res = await mf.dispatchFetch('http://localhost/api/internal/media/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'image/jpeg',
          'X-STROOM-Bridge-Secret': bridgeSecret,
        },
        body: sampleJpeg,
      });
      assert(res.status === 401, `Expected 401 Unauthorized for bridge secret on media route, got ${res.status}`);
      const json: any = await res.json();
      assert(json.message.includes('D1 bridge credentials cannot be used for internal media operations'), 'Explains bridge secret rejected');
    });

    await test('R2 Internal Service: rejects origin proxy credential cross-substitution (401)', async () => {
      const res = await mf.dispatchFetch('http://localhost/api/internal/media/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'image/jpeg',
          'X-STROOM-Origin-Secret': originSecret,
        },
        body: sampleJpeg,
      });
      assert(res.status === 401, `Expected 401 Unauthorized for origin secret on media route, got ${res.status}`);
    });

    await test('R2 Internal Service: rejects missing credentials on internal media endpoint (401)', async () => {
      const res = await mf.dispatchFetch('http://localhost/api/internal/media/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'image/jpeg',
        },
        body: sampleJpeg,
      });
      assert(res.status === 401, `Expected 401 Unauthorized for missing secret, got ${res.status}`);
    });

    await test('R2 Internal Service: rejects invalid/corrupted media credential (401)', async () => {
      const res = await mf.dispatchFetch('http://localhost/api/internal/media/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'image/jpeg',
          'X-STROOM-Media-Secret': 'invalid_corrupted_secret_that_does_not_match_at_all',
        },
        body: sampleJpeg,
      });
      assert(res.status === 401, `Expected 401 Unauthorized for invalid secret, got ${res.status}`);
    });

    await test('R2 Internal Service: authorizes service upload with valid dedicated media secret (201 Created)', async () => {
      const res = await mf.dispatchFetch('http://localhost/api/internal/media/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'image/jpeg',
          'X-STROOM-Media-Secret': mediaSecret,
        },
        body: sampleJpeg,
      });
      assert(res.status === 201, `Expected 201 Created, got ${res.status}`);
      const json: any = await res.json();
      assert(json.visibility === 'internal', 'Visibility is internal');
      assert(json.key.startsWith('internal_'), 'Key starts with internal_');
    });

    await test('R2 Media Retrieval: returns 404 Not Found for non-existent key', async () => {
      const res = await mf.dispatchFetch('http://localhost/api/media/pub_nonexistent_key_123.jpg');
      assert(res.status === 404, `Expected 404, got ${res.status}`);
    });

    await test('R2 Media Retrieval: rejects directory traversal path with 400 Bad Request', async () => {
      const res = await mf.dispatchFetch('http://localhost/api/media/..%2F..%2Fetc%2Fpasswd');
      assert(res.status === 400, `Expected 400, got ${res.status}`);
    });

    console.log('\n--- SUITE 3: CLOUDFLARE PAGES HEADERS & SPA CONFIGURATION ---');

    await test('public/_headers enforces strict CSP without unsafe-inline in script-src, and restricted connect-src', async () => {
      const headersContent = fs.readFileSync('public/_headers', 'utf8');
      assert(headersContent.includes('Cache-Control: public, max-age=31536000, immutable'), 'Asset immutable caching');
      assert(headersContent.includes('X-Frame-Options: DENY'), 'X-Frame-Options DENY');
      assert(headersContent.includes('X-Content-Type-Options: nosniff'), 'nosniff header');
      assert(headersContent.includes('Strict-Transport-Security: max-age=31536000'), 'HSTS header');
      assert(!headersContent.includes('preload'), 'HSTS preload must be omitted from default config');
      assert(headersContent.includes("script-src 'self'"), 'CSP script-src self');
      assert(!headersContent.includes("script-src 'self' 'unsafe-inline'"), 'CSP script-src must not have unsafe-inline');
      assert(headersContent.includes("connect-src 'self'"), 'CSP connect-src restricted to self');
      assert(!headersContent.includes("connect-src 'self' https: wss: http:"), 'CSP connect-src must not allow broad wildcard http: or generic https:');
    });

    await test('Built frontend bundle dist/index.html requires zero inline scripts (100% external chunks)', async () => {
      const distHtml = fs.readFileSync('dist/index.html', 'utf8');
      // Assert no inline script content exists (scripts must have src attribute)
      const inlineScriptMatches = distHtml.match(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi);
      assert(!inlineScriptMatches || inlineScriptMatches.length === 0, 'No inline scripts found in dist/index.html');
    });

    await test('public/_redirects enforces client-side SPA deep-linking fallback', async () => {
      const redirectsContent = fs.readFileSync('public/_redirects', 'utf8');
      assert(redirectsContent.includes('/*    /index.html   200') || redirectsContent.includes('/* /index.html 200'), 'SPA fallback rule');
    });

    console.log('\n--- SUITE 4: END-TO-END HYBRID AUTHENTICATION WORKFLOW ---');

    const testUserEmail = `readiness_user_${Date.now()}@stroom.in`;
    const testUserPassword = 'SecurePassword2026!';
    let registeredUserId = '';

    await test('Proxied registration creates user on D1 via Express bridge', async () => {
      const res = await mf.dispatchFetch('http://localhost/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: testUserEmail,
          password: testUserPassword,
          full_name: 'Readiness Test User',
        }),
      });
      assert(res.status === 201, `Expected 201 Created, got ${res.status}`);
      const json: any = await res.json();
      assert(Boolean(json.token), 'JWT token returned');
      assert(json.user?.email === testUserEmail, 'User email matches');
      assert(!json.user?.password_hash, 'Password hash is strictly omitted');
      registeredUserId = json.user.id;
    });

    await test('Proxied login authenticates user from D1 and returns JWT', async () => {
      const res = await mf.dispatchFetch('http://localhost/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: testUserEmail,
          password: testUserPassword,
        }),
      });
      assert(res.status === 200, `Expected 200 OK, got ${res.status}`);
      const json: any = await res.json();
      assert(Boolean(json.token), 'JWT token returned on login');
      assert(json.user?.id === registeredUserId, 'User ID matches');
    });

    await test('Direct access to Express origin without X-STROOM-Origin-Secret blocked (403)', async () => {
      const directRes = await fetch(`http://127.0.0.1:${EXPRESS_PORT}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: testUserEmail,
          password: testUserPassword,
        }),
      });
      assert(directRes.status === 403, `Expected 403 Forbidden, got ${directRes.status}`);
    });
  } finally {
    console.log('\n================================================================');
    console.log('🧹 CLEANING UP READINESS TEST HARNESS');
    console.log('================================================================');

    expressServer.close();
    console.log('✅ Express test server stopped.');

    await mf.dispose();
    console.log('✅ Miniflare instance disposed cleanly.');

    try {
      const { db } = await import('../server/db/database');
      db.close();
      console.log('✅ Disposable SQLite database connection closed.');
    } catch {}

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

    // Post-test database safety verification
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
    console.log(`🏁 PHASE 2.5.2 READINESS TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('================================================================\n');

    if (failed > 0) {
      process.exit(1);
    }
  }
}

runReadinessTests().catch((err) => {
  console.error('[FATAL] Unhandled readiness test error:', err);
  process.exit(1);
});
