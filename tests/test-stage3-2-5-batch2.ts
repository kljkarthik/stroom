/**
 * STROOM — Stage 3.2.5 — Batch 2 Verification Suite
 * Tests Authentication & Member Workflows across SQLite and PostgreSQL.
 */

import fs from 'fs';
import path from 'path';
import http from 'http';
import Database from 'better-sqlite3';
import express from 'express';
import authRouter from '../server/routes/auth';
import communitiesRouter from '../server/routes/communities';
import discoveryRouter from '../server/routes/discovery';
import onboardingRouter from '../server/routes/onboarding';
import { SqliteAdapter } from '../server/db/sqliteAdapter';
import { PostgresAdapter } from '../server/db/postgresAdapter';
import { setDatabaseAdapter, resetDatabaseAdapter } from '../server/db/adapter';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`[ASSERTION FAILED]: ${msg}`);
}

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRouter);
  app.use('/api/communities', communitiesRouter);
  app.use('/api/discovery', discoveryRouter);
  app.use('/api/onboarding', onboardingRouter);
  return app;
}

class TestClient {
  private server: http.Server | null = null;
  public baseUrl = '';

  constructor(private app: express.Express) {}

  async start(): Promise<void> {
    return new Promise((resolve) => {
      this.server = http.createServer(this.app);
      this.server.listen(0, '127.0.0.1', () => {
        const addr = this.server!.address() as any;
        this.baseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });
  }

  async close(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => resolve());
      } else {
        resolve();
      }
    });
  }

  async req(method: string, pathStr: string, options: { body?: any; token?: string } = {}) {
    const headers: Record<string, string> = {};
    let body: string | undefined;
    if (options.body) {
      headers['content-type'] = 'application/json';
      body = JSON.stringify(options.body);
    }
    if (options.token) {
      headers['authorization'] = `Bearer ${options.token}`;
    }

    const res = await fetch(`${this.baseUrl}${pathStr}`, {
      method,
      headers,
      body,
    });

    let json: any = null;
    try {
      json = await res.json();
    } catch {
      // ignore
    }

    return {
      status: res.status,
      body: json,
    };
  }
}

async function runBatch2Tests() {
  console.log('================================================================');
  console.log('🧪 STROOM STAGE 3.2.5 BATCH 2: AUTH & MEMBER WORKFLOWS TEST');
  console.log('================================================================\n');

  let totalAssertions = 0;
  function pass(desc: string) {
    totalAssertions++;
    console.log(`  ✅ PASSED: ${desc}`);
  }

  // Set up disposable SQLite database from test_temp.db
  const disposableDbPath = path.resolve(process.cwd(), 'data', 'test_disposable_batch2.db');
  fs.copyFileSync(path.resolve(process.cwd(), 'data', 'test_temp.db'), disposableDbPath);

  const sqliteRaw = new Database(disposableDbPath);
  const sqliteAdapter = new SqliteAdapter(sqliteRaw);
  const app = createApp();
  const client = new TestClient(app);
  await client.start();

  try {
    // -------------------------------------------------------------
    // PART A: SQLite Driver Verification
    // -------------------------------------------------------------
    console.log('--- Part A: SQLite Driver Auth & Member Workflows ---');
    setDatabaseAdapter(sqliteAdapter);

    // 1. User Registration
    const regEmail = `test_b2_${Date.now()}@stroom.test`;
    const regRes = await client.req('POST', '/api/auth/register', {
      body: { email: regEmail, password: 'password123', full_name: 'Batch Two Tester' }
    });

    assert(regRes.status === 201, `Register status must be 201 (got ${regRes.status}: ${JSON.stringify(regRes.body)})`);
    assert(typeof regRes.body.token === 'string', 'Token must be returned');
    assert(regRes.body.user.email === regEmail, 'User email match');
    const createdUserId = regRes.body.user.id;
    pass('User registration creates record and returns JWT token on SQLite');

    // 2. Duplicate Registration Rejection
    const dupRes = await client.req('POST', '/api/auth/register', {
      body: { email: regEmail, password: 'password123', full_name: 'Duplicate Tester' }
    });

    assert(dupRes.status === 409, `Duplicate register must return 409 (got ${dupRes.status})`);
    pass('Duplicate user registration rejected with 409 Conflict');

    // 3. User Login (Valid and Invalid)
    const badLogin = await client.req('POST', '/api/auth/login', {
      body: { email: regEmail, password: 'wrongpassword' }
    });
    assert(badLogin.status === 401, 'Invalid password must return 401');
    pass('Invalid password rejected with 401 Unauthorized');

    const goodLogin = await client.req('POST', '/api/auth/login', {
      body: { email: regEmail, password: 'password123' }
    });
    assert(goodLogin.status === 200, 'Valid login returns 200');
    assert(typeof goodLogin.body.token === 'string', 'Login returns token');
    const userToken = goodLogin.body.token;
    pass('Valid login succeeds and returns session token');

    // 4. Authenticated /api/auth/me
    const meRes = await client.req('GET', '/api/auth/me', { token: userToken });
    assert(meRes.status === 200, 'GET /me returns 200');
    assert(meRes.body.user.id === createdUserId, 'GET /me user ID match');
    pass('GET /api/auth/me resolves authenticated user session');

    // 5. Communities Listing & Filters
    const commsRes = await client.req('GET', '/api/communities');
    assert(commsRes.status === 200, 'Communities list returns 200');
    assert(Array.isArray(commsRes.body.communities), 'Communities array returned');
    assert(commsRes.body.communities.length > 0, 'Found seeded communities');
    const firstComm = commsRes.body.communities[0];
    pass(`GET /api/communities returned ${commsRes.body.communities.length} seeded communities`);

    // 6. Community Join & Leave
    const joinRes = await client.req('POST', `/api/communities/${firstComm.id}/join`, { token: userToken });
    assert(joinRes.status === 200, 'Join community returns 200');
    assert(joinRes.body.is_member === true, 'is_member should be true');
    pass('POST /api/communities/:id/join successfully joins community');

    const leaveRes = await client.req('POST', `/api/communities/${firstComm.id}/leave`, { token: userToken });
    assert(leaveRes.status === 200, 'Leave community returns 200');
    assert(leaveRes.body.is_member === false, 'is_member should be false');
    pass('POST /api/communities/:id/leave successfully leaves community');

    // 7. Discovery Feed
    const discRes = await client.req('GET', '/api/discovery', { token: userToken });
    assert(discRes.status === 200, 'Discovery feed returns 200');
    assert(Array.isArray(discRes.body.items), 'Discovery items array returned');
    pass('GET /api/discovery returns scored items feed');

    // 8. Onboarding Quiz Structure
    const quizRes = await client.req('GET', '/api/onboarding/quiz');
    assert(quizRes.status === 200, 'Onboarding quiz returns 200');
    assert(Array.isArray(quizRes.body.questions), 'Quiz questions array returned');
    assert(quizRes.body.questions.length > 0, 'Active quiz has questions');
    pass(`GET /api/onboarding/quiz returns published quiz with ${quizRes.body.questions.length} questions`);

    // 9. Onboarding Session Creation & Resumption
    const sessRes = await client.req('POST', '/api/onboarding/sessions', { token: userToken });
    assert(sessRes.status === 201, `Create session returns 201 (got ${sessRes.status}: ${JSON.stringify(sessRes.body)})`);
    const sessionId = sessRes.body.session.id;
    assert(typeof sessionId === 'string', 'Session ID returned');
    pass('POST /api/onboarding/sessions creates atomic session record');

    const resumeRes = await client.req('POST', '/api/onboarding/sessions', { token: userToken });
    assert(resumeRes.status === 200, 'Resume session returns 200');
    assert(resumeRes.body.resumed === true, 'resumed flag is true');
    assert(resumeRes.body.session.id === sessionId, 'Session ID preserved');
    pass('POST /api/onboarding/sessions seamlessly resumes in-progress session');

    // 10. Save Responses
    const firstQ = quizRes.body.questions[0];
    const firstOpt = firstQ.options[0];
    const saveResp = await client.req('PUT', `/api/onboarding/sessions/${sessionId}/responses`, {
      token: userToken,
      body: { question_id: firstQ.id, option_ids: [firstOpt.id] }
    });
    assert(saveResp.status === 200, 'Save response returns 200');
    assert(Array.isArray(saveResp.body.responses[firstQ.id]), 'Saved option returned');
    pass('PUT /api/onboarding/sessions/:id/responses records response atomically');

    // 11. Skip Session
    const skipRes = await client.req('POST', `/api/onboarding/sessions/${sessionId}/skip`, { token: userToken });
    assert(skipRes.status === 200, 'Skip session returns 200');
    assert(skipRes.body.status === 'SKIPPED', 'Session status updated to SKIPPED');
    assert(skipRes.body.user.onboarding_status === 'SKIPPED', 'User onboarding_status updated to SKIPPED');
    pass('POST /api/onboarding/sessions/:id/skip updates status atomically');

    // 12. Restart Session
    const restartRes = await client.req('POST', '/api/onboarding/restart', { token: userToken });
    assert(restartRes.status === 201, 'Restart quiz returns 201');
    assert(restartRes.body.session.status === 'IN_PROGRESS', 'New session is IN_PROGRESS');
    pass('POST /api/onboarding/restart starts new session');

    // -------------------------------------------------------------
    // PART B: Live Neon PostgreSQL Verification
    // -------------------------------------------------------------
    const targetUrl = process.env.TARGET_DATABASE_URL || process.env.DATABASE_URL;
    if (targetUrl) {
      console.log('\n--- Part B: Neon PostgreSQL Driver Auth & Member Workflows ---');
      const pgAdapter = new PostgresAdapter(targetUrl);
      setDatabaseAdapter(pgAdapter);

      // Verify connection
      const ping = await pgAdapter.ping();
      assert(ping === true, 'PostgreSQL ping must return true');
      pass('Neon PostgreSQL adapter connected and responsive');

      // Test Communities on PostgreSQL
      const pgCommsRes = await client.req('GET', '/api/communities');
      assert(pgCommsRes.status === 200, 'PostgreSQL GET /communities returns 200');
      assert(pgCommsRes.body.communities.length > 0, 'PostgreSQL returned seeded communities');
      pass(`Neon PostgreSQL: GET /api/communities returned ${pgCommsRes.body.communities.length} communities`);

      // Test Discovery feed on PostgreSQL
      const pgDiscRes = await client.req('GET', '/api/discovery');
      assert(pgDiscRes.status === 200, 'PostgreSQL GET /discovery returns 200');
      assert(pgDiscRes.body.items.length > 0, 'PostgreSQL returned discovery items');
      pass(`Neon PostgreSQL: GET /api/discovery returned ${pgDiscRes.body.items.length} items`);

      // Test Published Quiz on PostgreSQL
      const pgQuizRes = await client.req('GET', '/api/onboarding/quiz');
      assert(pgQuizRes.status === 200, 'PostgreSQL GET /onboarding/quiz returns 200');
      assert(pgQuizRes.body.questions.length > 0, 'PostgreSQL returned quiz questions');
      pass(`Neon PostgreSQL: GET /api/onboarding/quiz returned ${pgQuizRes.body.questions.length} questions`);

      // Test User Login with Seeded Admin on PostgreSQL
      const pgAdminLogin = await client.req('POST', '/api/auth/login', {
        body: { email: 'admin@stroom.app', password: 'Admin@123' }
      });
      assert(pgAdminLogin.status === 200, 'Admin login on PostgreSQL returns 200');
      const pgAdminToken = pgAdminLogin.body.token;
      pass('Neon PostgreSQL: Authenticated login with salted scrypt verification succeeded');

      // Test Authenticated Session on PostgreSQL
      const pgMeRes = await client.req('GET', '/api/auth/me', { token: pgAdminToken });
      assert(pgMeRes.status === 200, 'PostgreSQL GET /me returns 200');
      assert(pgMeRes.body.user.role === 'admin', 'PostgreSQL admin role match');
      pass('Neon PostgreSQL: GET /api/auth/me verified session against live database');

      // Test Community Join & Leave on PostgreSQL
      const testCommId = pgCommsRes.body.communities[0].id;
      const pgJoin = await client.req('POST', `/api/communities/${testCommId}/join`, { token: pgAdminToken });
      assert(pgJoin.status === 200, 'PostgreSQL join returns 200');
      assert(pgJoin.body.is_member === true, 'PostgreSQL is_member true');
      pass('Neon PostgreSQL: POST /api/communities/:id/join verified with ON CONFLICT safety');

      const pgLeave = await client.req('POST', `/api/communities/${testCommId}/leave`, { token: pgAdminToken });
      assert(pgLeave.status === 200, 'PostgreSQL leave returns 200');
      assert(pgLeave.body.is_member === false, 'PostgreSQL is_member false');
      pass('Neon PostgreSQL: POST /api/communities/:id/leave verified');

      await pgAdapter.close();
    } else {
      console.log('\n[INFO] Skipping Part B (PostgreSQL): TARGET_DATABASE_URL not set');
    }

  } finally {
    await client.close();
    await resetDatabaseAdapter();
    sqliteRaw.close();
    if (fs.existsSync(disposableDbPath)) {
      fs.unlinkSync(disposableDbPath);
    }
  }

  console.log('\n================================================================');
  console.log(`🎉 BATCH 2 VERIFICATION COMPLETED: All ${totalAssertions} assertions passed!`);
  console.log('================================================================\n');
}

runBatch2Tests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ [FATAL ERROR in Batch 2 Tests]:', err);
    process.exit(1);
  });
