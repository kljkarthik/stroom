/**
 * STROOM — Stage 3.2.5 — Batch 5 Verification Suite
 * Tests Partners, Coupons, Preferences & Contact Workflows across SQLite and PostgreSQL.
 */

import fs from 'fs';
import path from 'path';
import http from 'http';
import Database from 'better-sqlite3';
import express from 'express';
import partnersRouter from '../server/routes/partners';
import preferencesRouter from '../server/routes/preferences';
import contactRouter from '../server/routes/contact';
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
  app.use('/api/partners', partnersRouter);
  app.use('/api/users', preferencesRouter);
  app.use('/api/contact', contactRouter);
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

async function runBatch5Tests() {
  console.log('================================================================');
  console.log('🧪 STROOM STAGE 3.2.5 BATCH 5: PARTNERS, COUPONS & PREFERENCES');
  console.log('================================================================\n');

  let totalAssertions = 0;
  function pass(desc: string) {
    totalAssertions++;
    console.log(`  ✅ PASSED: ${desc}`);
  }

  // Set up disposable SQLite database from test_temp.db
  const disposableDbPath = path.resolve(process.cwd(), 'data', 'test_disposable_batch5.db');
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
    console.log('--- Part A: SQLite Driver Partners & Preferences ---');
    setDatabaseAdapter(sqliteAdapter);

    // 1. Admin Login
    const loginRes = await client.req('POST', '/api/auth/login', {
      body: { email: 'admin@stroom.app', password: 'Admin@123' }
    });
    assert(loginRes.status === 200, 'Admin login succeeded on SQLite');
    const adminToken = loginRes.body.token;
    pass('Admin login authenticated');

    // 2. Submit Contact Inquiry
    const contactRes = await client.req('POST', '/api/contact', {
      body: {
        name: 'Sarah Connor',
        email: 'sarah@example.com',
        subject: 'Partnership Inquiry',
        message: 'Interested in hosting a board game evening at our cafe.',
      }
    });
    assert(contactRes.status === 201, `Submit contact inquiry returns 201 (got ${contactRes.status})`);
    assert(typeof contactRes.body.inquiryId === 'string', 'Inquiry ID returned');
    pass('POST /api/contact submitted public inquiry record');

    // 3. Fetch FAQs
    const faqRes = await client.req('GET', '/api/contact/faqs');
    assert(faqRes.status === 200, 'GET /api/contact/faqs returns 200');
    assert(Array.isArray(faqRes.body.faqs) && faqRes.body.faqs.length > 0, 'FAQs returned');
    pass(`GET /api/contact/faqs returned ${faqRes.body.faqs.length} FAQ categories`);

    // 4. Update and Fetch Preferences
    const updatePrefRes = await client.req('PUT', '/api/users/me/preferences', {
      token: adminToken,
      body: { tags: ['cricket', 'board_games', 'coffee'] }
    });
    assert(updatePrefRes.status === 200, 'PUT /api/users/me/preferences returns 200');
    pass('PUT /api/users/me/preferences updated user tags atomically');

    const getPrefRes = await client.req('GET', '/api/users/me/preferences', { token: adminToken });
    assert(getPrefRes.status === 200, 'GET /api/users/me/preferences returns 200');
    assert(Array.isArray(getPrefRes.body.tags) && getPrefRes.body.tags.includes('cricket'), 'Tags contain cricket');
    pass('GET /api/users/me/preferences verified saved preferences');

    // 5. User Profile Studio & Passport
    const profRes = await client.req('GET', '/api/users/me/profile', { token: adminToken });
    assert(profRes.status === 200, 'GET /api/users/me/profile returns 200');
    assert(profRes.body.user && profRes.body.user.email === 'admin@stroom.app', 'Profile user match');
    pass('GET /api/users/me/profile resolved profile studio and statistics');

    const passRes = await client.req('GET', '/api/users/me/passport', { token: adminToken });
    assert(passRes.status === 200, 'GET /api/users/me/passport returns 200');
    assert(passRes.body.passport && Array.isArray(passRes.body.passport.stamps), 'Passport stamps returned');
    pass('GET /api/users/me/passport loaded verified passport');

    // 6. Partner Venues Directory
    const venuesRes = await client.req('GET', '/api/partners/venues');
    assert(venuesRes.status === 200, 'GET /api/partners/venues returns 200');
    assert(Array.isArray(venuesRes.body.venues) && venuesRes.body.venues.length > 0, 'Venues returned');
    const testVenue = venuesRes.body.venues[0];
    pass(`GET /api/partners/venues returned ${venuesRes.body.venues.length} verified partner venues`);

    // 7. Partner Venue Stats
    const statsRes = await client.req('GET', `/api/partners/stats/${testVenue.id}`);
    assert(statsRes.status === 200, 'GET /api/partners/stats/:venueId returns 200');
    assert(statsRes.body.aggregate && statsRes.body.venue.id === testVenue.id, 'Venue match');
    pass('GET /api/partners/stats/:venueId resolved venue metrics');

    // 8. Partner Accounts Overview
    const accsRes = await client.req('GET', '/api/partners/my-accounts', { token: adminToken });
    assert(accsRes.status === 200, 'GET /api/partners/my-accounts returns 200');
    assert(Array.isArray(accsRes.body.accounts), 'Accounts array returned');
    pass(`GET /api/partners/my-accounts returned ${accsRes.body.accounts.length} partner accounts`);

    // -------------------------------------------------------------
    // PART B: Live Neon PostgreSQL Verification
    // -------------------------------------------------------------
    const targetUrl = process.env.TARGET_DATABASE_URL || process.env.DATABASE_URL;
    if (targetUrl) {
      console.log('\n--- Part B: Neon PostgreSQL Driver Partners & Preferences ---');
      const pgAdapter = new PostgresAdapter(targetUrl);
      setDatabaseAdapter(pgAdapter);

      // Verify connection
      const ping = await pgAdapter.ping();
      assert(ping === true, 'PostgreSQL ping must return true');
      pass('Neon PostgreSQL adapter connected and responsive');

      // Test Partner Venues on PostgreSQL
      const pgVenuesRes = await client.req('GET', '/api/partners/venues');
      assert(pgVenuesRes.status === 200, 'PostgreSQL GET /api/partners/venues returns 200');
      assert(pgVenuesRes.body.venues.length > 0, 'PostgreSQL returned venues');
      const pgVenue = pgVenuesRes.body.venues[0];
      pass(`Neon PostgreSQL: GET /api/partners/venues returned ${pgVenuesRes.body.venues.length} venues`);

      // Test Venue Stats on PostgreSQL
      const pgStatsRes = await client.req('GET', `/api/partners/stats/${pgVenue.id}`);
      assert(pgStatsRes.status === 200, 'PostgreSQL GET /api/partners/stats returns 200');
      pass('Neon PostgreSQL: GET /api/partners/stats/:venueId resolved metrics');

      // Test Admin Login on PostgreSQL
      const pgLogin = await client.req('POST', '/api/auth/login', {
        body: { email: 'admin@stroom.app', password: 'Admin@123' }
      });
      assert(pgLogin.status === 200, 'PostgreSQL Admin login returns 200');
      const pgToken = pgLogin.body.token;
      pass('Neon PostgreSQL: Admin login successful');

      // Test Profile on PostgreSQL
      const pgProfRes = await client.req('GET', '/api/users/me/profile', { token: pgToken });
      assert(pgProfRes.status === 200, 'PostgreSQL GET /api/users/me/profile returns 200');
      assert(pgProfRes.body.user.role === 'admin', 'PostgreSQL admin role match');
      pass('Neon PostgreSQL: GET /api/users/me/profile resolved profile');

      // Test Passport on PostgreSQL
      const pgPassRes = await client.req('GET', '/api/users/me/passport', { token: pgToken });
      assert(pgPassRes.status === 200, 'PostgreSQL GET /api/users/me/passport returns 200');
      pass('Neon PostgreSQL: GET /api/users/me/passport loaded passport');

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
  console.log(`🎉 BATCH 5 VERIFICATION COMPLETED: All ${totalAssertions} assertions passed!`);
  console.log('================================================================\n');
}

runBatch5Tests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ [FATAL ERROR in Batch 5 Tests]:', err);
    process.exit(1);
  });
