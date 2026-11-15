/**
 * STROOM — Stage 3.2.5 — Batch 3 Verification Suite
 * Tests Events & Registrations Workflows across SQLite and PostgreSQL.
 */

import fs from 'fs';
import path from 'path';
import http from 'http';
import Database from 'better-sqlite3';
import express from 'express';
import eventsRouter from '../server/routes/events';
import passesRouter from '../server/routes/passes';
import authRouter from '../server/routes/auth';
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
  app.use('/api/events', eventsRouter);
  app.use('/api/passes', passesRouter);
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

async function runBatch3Tests() {
  console.log('================================================================');
  console.log('🧪 STROOM STAGE 3.2.5 BATCH 3: EVENTS & REGISTRATIONS TEST');
  console.log('================================================================\n');

  let totalAssertions = 0;
  function pass(desc: string) {
    totalAssertions++;
    console.log(`  ✅ PASSED: ${desc}`);
  }

  // Set up disposable SQLite database from test_temp.db
  const disposableDbPath = path.resolve(process.cwd(), 'data', 'test_disposable_batch3.db');
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
    console.log('--- Part A: SQLite Driver Events & Registrations ---');
    setDatabaseAdapter(sqliteAdapter);

    // 1. User Login
    const loginRes = await client.req('POST', '/api/auth/login', {
      body: { email: 'admin@stroom.app', password: 'Admin@123' }
    });
    assert(loginRes.status === 200, 'Admin login succeeded on SQLite');
    const adminToken = loginRes.body.token;
    pass('Admin login authenticated successfully');

    // 2. Fetch Cities
    const citiesRes = await client.req('GET', '/api/events/cities');
    assert(citiesRes.status === 200, 'GET /api/events/cities returns 200');
    assert(Array.isArray(citiesRes.body.cities) && citiesRes.body.cities.length > 0, 'Cities returned');
    pass(`GET /api/events/cities returned ${citiesRes.body.cities.length} cities`);

    // 3. Fetch Events
    const eventsRes = await client.req('GET', '/api/events');
    assert(eventsRes.status === 200, 'GET /api/events returns 200');
    assert(Array.isArray(eventsRes.body.events) && eventsRes.body.events.length > 0, 'Events returned');
    const testEvent = eventsRes.body.events[0];
    pass(`GET /api/events returned ${eventsRes.body.events.length} events`);

    // 4. Fetch Event Details
    const detailRes = await client.req('GET', `/api/events/${testEvent.id}`, { token: adminToken });
    assert(detailRes.status === 200, 'GET /api/events/:id returns 200');
    assert(detailRes.body.event.id === testEvent.id, 'Event ID match');
    pass('GET /api/events/:id resolved full event details');

    // 5. Register for Event (creates pass & decrements available seats)
    const initialSeatsLeft = detailRes.body.event.seats_left;
    const regRes = await client.req('POST', `/api/events/${testEvent.id}/register`, {
      token: adminToken,
      body: { seat_tier: 'VIP', role: 'Collector' }
    });
    assert(regRes.status === 200, `Register returns 200 (got ${regRes.status})`);
    assert(regRes.body.pass && typeof regRes.body.pass.pass_code === 'string', 'Pass code generated');
    const createdPass = regRes.body.pass;
    pass(`POST /api/events/:id/register generated pass ${createdPass.pass_code}`);

    // 6. Verify Pass via Token
    const verifyRes = await client.req('GET', `/api/passes/verify/${createdPass.qr_token}`);
    assert(verifyRes.status === 200, 'Verify pass returns 200');
    assert(verifyRes.body.valid === true, 'Pass valid is true');
    pass('GET /api/passes/verify/:token verified digital pass');

    // 7. Check In Attendee
    const checkinRes = await client.req('POST', '/api/passes/check-in', {
      token: adminToken,
      body: { qr_token: createdPass.qr_token }
    });
    assert(checkinRes.status === 200, `Check-in returns 200 (got ${checkinRes.status})`);
    assert(checkinRes.body.stampIssued === true, 'Digital stamp issued');
    pass('POST /api/passes/check-in checked in attendee and issued passport stamp');

    // 8. Re-check in prevention
    const reCheckinRes = await client.req('POST', '/api/passes/check-in', {
      token: adminToken,
      body: { qr_token: createdPass.qr_token }
    });
    assert(reCheckinRes.status === 409, 'Duplicate check-in rejected with 409 Conflict');
    pass('Duplicate check-in correctly rejected with 409');

    // 9. Fetch User Passes
    const myPassesRes = await client.req('GET', '/api/passes/my-passes', { token: adminToken });
    assert(myPassesRes.status === 200, 'My passes returns 200');
    assert(Array.isArray(myPassesRes.body.passes), 'Passes array returned');
    assert(myPassesRes.body.passes.some((p: any) => p.id === createdPass.id), 'Created pass found in list');
    pass(`GET /api/passes/my-passes returned ${myPassesRes.body.passes.length} user passes`);

    // -------------------------------------------------------------
    // PART B: Live Neon PostgreSQL Verification
    // -------------------------------------------------------------
    const targetUrl = process.env.TARGET_DATABASE_URL || process.env.DATABASE_URL;
    if (targetUrl) {
      console.log('\n--- Part B: Neon PostgreSQL Driver Events & Registrations ---');
      const pgAdapter = new PostgresAdapter(targetUrl);
      setDatabaseAdapter(pgAdapter);

      // Verify connection
      const ping = await pgAdapter.ping();
      assert(ping === true, 'PostgreSQL ping must return true');
      pass('Neon PostgreSQL adapter connected and responsive');

      // Test Cities on PostgreSQL
      const pgCitiesRes = await client.req('GET', '/api/events/cities');
      assert(pgCitiesRes.status === 200, 'PostgreSQL GET /api/events/cities returns 200');
      assert(pgCitiesRes.body.cities.length > 0, 'PostgreSQL returned cities');
      pass(`Neon PostgreSQL: GET /api/events/cities returned ${pgCitiesRes.body.cities.length} cities`);

      // Test Events on PostgreSQL
      const pgEventsRes = await client.req('GET', '/api/events');
      assert(pgEventsRes.status === 200, 'PostgreSQL GET /api/events returns 200');
      assert(pgEventsRes.body.events.length > 0, 'PostgreSQL returned events');
      const pgTestEvent = pgEventsRes.body.events[0];
      pass(`Neon PostgreSQL: GET /api/events returned ${pgEventsRes.body.events.length} events`);

      // Test Event Detail on PostgreSQL
      const pgDetailRes = await client.req('GET', `/api/events/${pgTestEvent.id}`);
      assert(pgDetailRes.status === 200, 'PostgreSQL GET /api/events/:id returns 200');
      assert(pgDetailRes.body.event.id === pgTestEvent.id, 'PostgreSQL event ID match');
      pass('Neon PostgreSQL: GET /api/events/:id resolved event detail');

      // Test Admin Login on PostgreSQL
      const pgLogin = await client.req('POST', '/api/auth/login', {
        body: { email: 'admin@stroom.app', password: 'Admin@123' }
      });
      assert(pgLogin.status === 200, 'PostgreSQL Admin login returns 200');
      const pgToken = pgLogin.body.token;
      pass('Neon PostgreSQL: Admin login successful');

      // Test Passes List on PostgreSQL
      const pgPassesRes = await client.req('GET', '/api/passes/my-passes', { token: pgToken });
      assert(pgPassesRes.status === 200, 'PostgreSQL GET /api/passes/my-passes returns 200');
      assert(Array.isArray(pgPassesRes.body.passes), 'PostgreSQL passes array returned');
      pass(`Neon PostgreSQL: GET /api/passes/my-passes returned ${pgPassesRes.body.passes.length} passes`);

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
  console.log(`🎉 BATCH 3 VERIFICATION COMPLETED: All ${totalAssertions} assertions passed!`);
  console.log('================================================================\n');
}

runBatch3Tests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ [FATAL ERROR in Batch 3 Tests]:', err);
    process.exit(1);
  });
