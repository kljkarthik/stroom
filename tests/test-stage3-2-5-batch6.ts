/**
 * STROOM — Stage 3.2.5 — Batch 6 Verification Suite
 * Tests Admin Control Center, Auditing & Healthcheck Workflows across SQLite and PostgreSQL.
 */

import fs from 'fs';
import path from 'path';
import http from 'http';
import Database from 'better-sqlite3';
import express from 'express';
import authRouter from '../server/routes/auth';
import adminRouter from '../server/routes/admin';
import { getDatabaseAdapter, setDatabaseAdapter, resetDatabaseAdapter } from '../server/db/adapter';
import { SqliteAdapter } from '../server/db/sqliteAdapter';
import { PostgresAdapter } from '../server/db/postgresAdapter';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`[ASSERTION FAILED]: ${msg}`);
}

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRouter);
  app.use('/api/admin', adminRouter);

  // Health endpoint test
  app.get('/api/health', async (req, res) => {
    try {
      const adapter = getDatabaseAdapter();
      const ok = await adapter.ping();
      if (!ok) return res.status(503).json({ status: 'degraded' });
      return res.json({ status: 'ok', database: 'connected' });
    } catch {
      return res.status(503).json({ status: 'error' });
    }
  });

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

async function runBatch6Tests() {
  console.log('================================================================');
  console.log('🧪 STROOM STAGE 3.2.5 BATCH 6: ADMIN CONTROL CENTER & AUDITING');
  console.log('================================================================\n');

  let totalAssertions = 0;
  function pass(desc: string) {
    totalAssertions++;
    console.log(`  ✅ PASSED: ${desc}`);
  }

  // Set up disposable SQLite database from test_temp.db
  const disposableDbPath = path.resolve(process.cwd(), 'data', 'test_disposable_batch6.db');
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
    console.log('--- Part A: SQLite Driver Admin Control Center ---');
    setDatabaseAdapter(sqliteAdapter);

    // 1. Healthcheck
    const healthRes = await client.req('GET', '/api/health');
    assert(healthRes.status === 200, 'Health check returns 200');
    assert(healthRes.body.database === 'connected', 'Database reported connected');
    pass('GET /api/health verifies live database connectivity');

    // 2. Admin Login
    const loginRes = await client.req('POST', '/api/auth/login', {
      body: { email: 'admin@stroom.app', password: 'Admin@123' }
    });
    assert(loginRes.status === 200, 'Admin login succeeded on SQLite');
    const adminToken = loginRes.body.token;
    pass('Admin login authenticated');

    // 3. Admin Permissions
    const permRes = await client.req('GET', '/api/admin/me/permissions', { token: adminToken });
    assert(permRes.status === 200, 'GET /api/admin/me/permissions returns 200');
    assert(Array.isArray(permRes.body.permissions), 'Permissions array returned');
    pass(`GET /api/admin/me/permissions returned ${permRes.body.permissions.length} RBAC permissions`);

    // 4. Global Search
    const searchRes = await client.req('GET', '/api/admin/global-search?q=Hyderabad', { token: adminToken });
    assert(searchRes.status === 200, 'GET /api/admin/global-search returns 200');
    assert(searchRes.body.results, 'Search results returned');
    pass('GET /api/admin/global-search searched across all platform entities');

    // 5. Dashboard Overview
    const dashRes = await client.req('GET', '/api/admin/dashboard-overview', { token: adminToken });
    assert(dashRes.status === 200, 'GET /api/admin/dashboard-overview returns 200');
    assert(dashRes.body.metrics, 'Metrics object returned');
    pass('GET /api/admin/dashboard-overview aggregated system KPIs');

    // 6. Quizzes
    const quizRes = await client.req('GET', '/api/admin/quizzes', { token: adminToken });
    assert(quizRes.status === 200, 'GET /api/admin/quizzes returns 200');
    assert(Array.isArray(quizRes.body.quizzes), 'Quizzes returned');
    pass(`GET /api/admin/quizzes returned ${quizRes.body.quizzes.length} quizzes`);

    // 7. Events Management
    const eventsRes = await client.req('GET', '/api/admin/events', { token: adminToken });
    assert(eventsRes.status === 200, 'GET /api/admin/events returns 200');
    assert(Array.isArray(eventsRes.body.events), 'Events list returned');
    pass(`GET /api/admin/events returned ${eventsRes.body.events.length} events`);

    // 8. Members Directory
    const membersRes = await client.req('GET', '/api/admin/members-directory', { token: adminToken });
    assert(membersRes.status === 200, 'GET /api/admin/members-directory returns 200');
    assert(Array.isArray(membersRes.body.members), 'Members list returned');
    pass(`GET /api/admin/members-directory returned ${membersRes.body.members.length} members`);

    // 9. Platform Settings
    const settingsRes = await client.req('GET', '/api/admin/settings', { token: adminToken });
    assert(settingsRes.status === 200, 'GET /api/admin/settings returns 200');
    assert(settingsRes.body.settings, 'Settings returned');
    pass('GET /api/admin/settings loaded platform settings');

    // 10. Audit Logs
    const auditRes = await client.req('GET', '/api/admin/audit-logs', { token: adminToken });
    assert(auditRes.status === 200, 'GET /api/admin/audit-logs returns 200');
    assert(Array.isArray(auditRes.body.logs), 'Audit logs array returned');
    pass(`GET /api/admin/audit-logs returned ${auditRes.body.logs.length} immutable audit logs`);

    // -------------------------------------------------------------
    // PART B: Live Neon PostgreSQL Verification
    // -------------------------------------------------------------
    const targetUrl = process.env.TARGET_DATABASE_URL || process.env.DATABASE_URL;
    if (targetUrl) {
      console.log('\n--- Part B: Neon PostgreSQL Driver Admin Control Center ---');
      const pgAdapter = new PostgresAdapter(targetUrl);
      setDatabaseAdapter(pgAdapter);

      // Verify connection
      const ping = await pgAdapter.ping();
      assert(ping === true, 'PostgreSQL ping must return true');
      pass('Neon PostgreSQL adapter connected and responsive');

      // Healthcheck on PostgreSQL
      const pgHealthRes = await client.req('GET', '/api/health');
      assert(pgHealthRes.status === 200, 'PostgreSQL health check returns 200');
      assert(pgHealthRes.body.database === 'connected', 'Database reported connected');
      pass('Neon PostgreSQL: GET /api/health verified live connection');

      // Admin Login on PostgreSQL
      const pgLogin = await client.req('POST', '/api/auth/login', {
        body: { email: 'admin@stroom.app', password: 'Admin@123' }
      });
      assert(pgLogin.status === 200, 'PostgreSQL Admin login returns 200');
      const pgToken = pgLogin.body.token;
      pass('Neon PostgreSQL: Admin login successful');

      // Dashboard Overview on PostgreSQL
      const pgDashRes = await client.req('GET', '/api/admin/dashboard-overview', { token: pgToken });
      assert(pgDashRes.status === 200, 'PostgreSQL GET /api/admin/dashboard-overview returns 200');
      assert(pgDashRes.body.metrics, 'PostgreSQL metrics returned');
      pass('Neon PostgreSQL: GET /api/admin/dashboard-overview aggregated system KPIs');

      // Quizzes on PostgreSQL
      const pgQuizRes = await client.req('GET', '/api/admin/quizzes', { token: pgToken });
      assert(pgQuizRes.status === 200, 'PostgreSQL GET /api/admin/quizzes returns 200');
      assert(Array.isArray(pgQuizRes.body.quizzes), 'PostgreSQL quizzes returned');
      pass(`Neon PostgreSQL: GET /api/admin/quizzes returned ${pgQuizRes.body.quizzes.length} quizzes`);

      // Audit Logs on PostgreSQL
      const pgAuditRes = await client.req('GET', '/api/admin/audit-logs', { token: pgToken });
      assert(pgAuditRes.status === 200, 'PostgreSQL GET /api/admin/audit-logs returns 200');
      assert(Array.isArray(pgAuditRes.body.logs), 'PostgreSQL audit logs returned');
      pass(`Neon PostgreSQL: GET /api/admin/audit-logs returned ${pgAuditRes.body.logs.length} audit logs`);

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
  console.log(`🎉 BATCH 6 VERIFICATION COMPLETED: All ${totalAssertions} assertions passed!`);
  console.log('================================================================\n');
}

runBatch6Tests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ [FATAL ERROR in Batch 6 Tests]:', err);
    process.exit(1);
  });
