/**
 * STROOM — Stage 3.2.5 — Batch 1 Verification Suite
 * Tests Database Foundation & Authentication Middleware across both SQLite and PostgreSQL.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import Database from 'better-sqlite3';
import { requireAuth, requireAdmin, requirePermission, optionalAuth, generateToken, AuthRequest } from '../server/middleware/auth';
import { recordAuditLog } from '../server/services/auditService';
import { SqliteAdapter } from '../server/db/sqliteAdapter';
import { PostgresAdapter } from '../server/db/postgresAdapter';
import { setDatabaseAdapter, resetDatabaseAdapter, getDatabaseAdapter } from '../server/db/adapter';
import { config } from '../server/config/env';

const JWT_SECRET = config.jwtSecret;

function createMockResponse() {
  const res: any = {
    statusCode: 200,
    headers: {},
    jsonData: null,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(data: any) {
      this.jsonData = data;
      return this;
    },
    setHeader(name: string, val: string) {
      this.headers[name] = val;
    },
  };
  return res;
}

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`[ASSERTION FAILED]: ${msg}`);
}

async function runBatch1Tests() {
  console.log('================================================================');
  console.log('🧪 STROOM STAGE 3.2.5 BATCH 1: FOUNDATION & AUTH MIDDLEWARE TEST');
  console.log('================================================================\n');

  let totalAssertions = 0;
  function pass(desc: string) {
    totalAssertions++;
    console.log(`  ✅ PASSED: ${desc}`);
  }

  // Set up disposable SQLite database from test_temp.db
  const disposableDbPath = path.resolve(process.cwd(), 'data', 'test_disposable_batch1.db');
  fs.copyFileSync(path.resolve(process.cwd(), 'data', 'test_temp.db'), disposableDbPath);

  const sqliteRaw = new Database(disposableDbPath);
  const sqliteAdapter = new SqliteAdapter(sqliteRaw);

  try {
    // -------------------------------------------------------------
    // PART A: SQLite Engine Authentication & Middleware Tests
    // -------------------------------------------------------------
    console.log('--- Part A: SQLite Driver Foundation & Middleware Verification ---');
    setDatabaseAdapter(sqliteAdapter);

    // 1. Missing Token Handling
    {
      const req: any = { headers: {} };
      const res = createMockResponse();
      let nextCalled = false;
      await requireAuth(req, res, () => { nextCalled = true; });
      assert(!nextCalled, 'next() must not be called when token is missing');
      assert(res.statusCode === 401, 'Must return 401 on missing token');
      pass('Missing Bearer token returns 401 Unauthorized');
    }

    // 2. Malformed / Invalid Token Rejection
    {
      const req: any = { headers: { authorization: 'Bearer invalid.token.value' } };
      const res = createMockResponse();
      let nextCalled = false;
      await requireAuth(req, res, () => { nextCalled = true; });
      assert(!nextCalled, 'next() must not be called on invalid token');
      assert(res.statusCode === 401, 'Must return 401 on invalid token');
      assert(res.jsonData?.error === 'Invalid or expired token.', 'Error message match');
      pass('Invalid JWT token returns 401 Unauthorized');
    }

    // 3. Expired Token Rejection
    {
      const expiredToken = jwt.sign(
        { id: 'usr_admin_001', email: 'admin@stroom.in', role: 'super_admin' },
        JWT_SECRET,
        { expiresIn: '-1s' }
      );
      const req: any = { headers: { authorization: `Bearer ${expiredToken}` } };
      const res = createMockResponse();
      let nextCalled = false;
      await requireAuth(req, res, () => { nextCalled = true; });
      assert(!nextCalled, 'next() must not be called on expired token');
      assert(res.statusCode === 401, 'Must return 401 on expired token');
      pass('Expired token returns 401 Unauthorized');
    }

    // 4. Valid Token & Session Verification (Admin User)
    {
      const validToken = generateToken({ id: 'usr_admin_001', email: 'admin@stroom.app', role: 'admin' });
      const req: any = { headers: { authorization: `Bearer ${validToken}` } };
      const res = createMockResponse();
      let nextCalled = false;
      await requireAuth(req, res, () => { nextCalled = true; });
      assert(nextCalled, 'next() must be called on valid token');
      assert(req.user?.id === 'usr_admin_001', 'User must be attached to req');
      assert(req.user?.role === 'admin', 'Role must match user record');
      pass('Valid Bearer token resolves user asynchronously and attaches to req.user');
    }

    // 5. Suspended Account Lockout
    {
      // Create a temporary suspended user in disposable DB
      sqliteRaw.prepare(`
        INSERT INTO users (id, email, password_hash, full_name, role, account_status)
        VALUES ('usr_suspended_test', 'suspended@test.com', 'dummy_hash', 'Suspended User', 'user', 'suspended')
      `).run();

      const token = generateToken({ id: 'usr_suspended_test', email: 'suspended@test.com', role: 'user' });
      const req: any = { headers: { authorization: `Bearer ${token}` } };
      const res = createMockResponse();
      let nextCalled = false;
      await requireAuth(req, res, () => { nextCalled = true; });
      assert(!nextCalled, 'Suspended user must not proceed');
      assert(res.statusCode === 403, 'Must return 403 Forbidden for suspended user');
      assert(res.jsonData?.error.includes('Account suspended'), 'Error message mentions suspension');
      pass('Suspended account is locked out with 403 Forbidden');
    }

    // 6. Role-Based Access Control (requireAdmin & requirePermission)
    {
      // Super admin passes requireAdmin
      const adminReq: any = { user: { id: 'usr_admin_001', role: 'super_admin' } };
      const adminRes = createMockResponse();
      let adminNext = false;
      requireAdmin(adminReq, adminRes, () => { adminNext = true; });
      assert(adminNext, 'Super admin must pass requireAdmin');
      pass('Super admin passes requireAdmin guard');

      // Regular user fails requireAdmin
      const userReq: any = { user: { id: 'usr_reg_001', role: 'user' } };
      const userRes = createMockResponse();
      let userNext = false;
      requireAdmin(userReq, userRes, () => { userNext = true; });
      assert(!userNext, 'Regular user must fail requireAdmin');
      assert(userRes.statusCode === 403, 'Must return 403 Forbidden');
      pass('Regular user rejected by requireAdmin with 403 Forbidden');

      // requirePermission guard
      const permMiddleware = requirePermission('settings.manage');
      let permPassed = false;
      permMiddleware(adminReq, adminRes, () => { permPassed = true; });
      assert(permPassed, 'Super admin must have settings.manage permission');
      pass('requirePermission allows authorized admin role');

      let permBlocked = false;
      const staffReq: any = { user: { id: 'usr_staff_001', role: 'support_staff' } };
      const staffRes = createMockResponse();
      permMiddleware(staffReq, staffRes, () => { permBlocked = true; });
      assert(!permBlocked, 'support_staff lacks settings.manage permission');
      assert(staffRes.statusCode === 403, 'Must return 403 for missing permission');
      pass('requirePermission rejects unauthorized staff role with 403 Forbidden');
    }

    // 7. Optional Authentication
    {
      // Unauthenticated request in optionalAuth passes through with req.user undefined
      const reqNoAuth: any = { headers: {} };
      const res = createMockResponse();
      let nextCalled = false;
      await optionalAuth(reqNoAuth, res, () => { nextCalled = true; });
      assert(nextCalled, 'next() must be called');
      assert(reqNoAuth.user === undefined, 'req.user remains undefined');
      pass('optionalAuth allows unauthenticated requests without throwing');

      // Authenticated request in optionalAuth populates req.user
      const validToken = generateToken({ id: 'usr_admin_001', email: 'admin@stroom.app', role: 'admin' });
      const reqAuth: any = { headers: { authorization: `Bearer ${validToken}` } };
      let nextAuth = false;
      await optionalAuth(reqAuth, res, () => { nextAuth = true; });
      assert(nextAuth, 'next() must be called');
      assert(reqAuth.user?.id === 'usr_admin_001', 'req.user populated');
      pass('optionalAuth attaches user when valid token is supplied');
    }

    // 8. Concurrent Authentication Requests
    {
      const token = generateToken({ id: 'usr_admin_001', email: 'admin@stroom.app', role: 'admin' });
      const concurrentCount = 10;
      const promises = Array.from({ length: concurrentCount }, async (_, idx) => {
        const req: any = { headers: { authorization: `Bearer ${token}` } };
        const res = createMockResponse();
        let called = false;
        await requireAuth(req, res, () => { called = true; });
        return { called, userId: req.user?.id };
      });

      const results = await Promise.all(promises);
      assert(results.every((r) => r.called && r.userId === 'usr_admin_001'), 'All concurrent requests succeeded');
      pass(`Handled ${concurrentCount} concurrent requireAuth invocations without shared mutable state errors`);
    }

    // 9. Async Audit Logging on SQLite
    {
      const auditId = await recordAuditLog({
        actorId: 'usr_admin_001',
        actorName: 'Administrator',
        actorRole: 'admin',
        action: 'test.batch1.sqlite',
        entityType: 'test',
        entityId: 'ent_001',
        details: { token: 'secret_jwt_val', safeInfo: 'verified' },
      });

      assert(typeof auditId === 'string' && auditId.startsWith('aud_'), 'Audit log must return valid ID');
      const row = sqliteRaw.prepare('SELECT * FROM audit_logs WHERE id = ?').get(auditId) as any;
      assert(row !== undefined, 'Audit log row persisted in database');
      assert(row.action === 'test.batch1.sqlite', 'Action match');
      assert(row.details_json.includes('[REDACTED]'), 'Sensitive fields redacted in audit log');
      assert(!row.details_json.includes('secret_jwt_val'), 'Raw token secret purged');
      pass('recordAuditLog executes asynchronously with automated redaction on SQLite');
    }

    // -------------------------------------------------------------
    // PART B: Live Neon PostgreSQL Integration Tests
    // -------------------------------------------------------------
    const targetUrl = process.env.TARGET_DATABASE_URL || process.env.DATABASE_URL;
    if (targetUrl) {
      console.log('\n--- Part B: Neon PostgreSQL Driver Foundation & Middleware Verification ---');
      const pgAdapter = new PostgresAdapter(targetUrl);
      setDatabaseAdapter(pgAdapter);

      // Verify connection
      const ping = await pgAdapter.ping();
      assert(ping === true, 'PostgreSQL adapter ping must return true');
      pass('PostgreSQL adapter ping verified on live Neon staging database');

      // Test requireAuth on PostgreSQL
      {
        const token = generateToken({ id: 'usr_admin_001', email: 'admin@stroom.app', role: 'admin' });
        const req: any = { headers: { authorization: `Bearer ${token}` } };
        const res = createMockResponse();
        let nextCalled = false;
        await requireAuth(req, res, () => { nextCalled = true; });
        assert(nextCalled, 'next() must be called on PostgreSQL adapter');
        assert(req.user?.id === 'usr_admin_001', 'User resolved from Neon database');
        assert(req.user?.role === 'admin', 'Role resolved from Neon database');
        pass('requireAuth asynchronously fetches user from live Neon PostgreSQL instance');
      }

      // Test optionalAuth on PostgreSQL
      {
        const token = generateToken({ id: 'usr_admin_001', email: 'admin@stroom.app', role: 'admin' });
        const req: any = { headers: { authorization: `Bearer ${token}` } };
        const res = createMockResponse();
        let nextCalled = false;
        await optionalAuth(req, res, () => { nextCalled = true; });
        assert(nextCalled, 'optionalAuth next() called');
        assert(req.user?.id === 'usr_admin_001', 'req.user populated from Neon');
        pass('optionalAuth asynchronously attaches user from live Neon PostgreSQL instance');
      }

      // Test async recordAuditLog on PostgreSQL
      {
        const auditId = await recordAuditLog({
          actorId: 'usr_admin_001',
          actorName: 'Administrator',
          actorRole: 'admin',
          action: 'test.batch1.neon_postgres',
          entityType: 'test',
          entityId: 'ent_neon_001',
          details: { password: 'secret_password_123', status: 'ok' },
        });

        assert(typeof auditId === 'string' && auditId.startsWith('aud_'), 'Audit log returns ID on Postgres');
        const pgRow = await pgAdapter.queryOne('SELECT * FROM audit_logs WHERE id = ?', [auditId]);
        assert(pgRow !== undefined, 'Audit log row persisted in Neon PostgreSQL');
        assert(pgRow.action === 'test.batch1.neon_postgres', 'Postgres audit action match');
        assert(JSON.stringify(pgRow.details_json).includes('[REDACTED]'), 'Postgres audit redaction confirmed');
        pass('recordAuditLog executes asynchronously and persists with CURRENT_TIMESTAMP on Neon PostgreSQL');

        // Clean up test audit log from Neon
        await pgAdapter.execute('DELETE FROM audit_logs WHERE id = ?', [auditId]);
        pass('Test audit log entry cleaned up from Neon PostgreSQL');
      }

      await pgAdapter.close();
    } else {
      console.log('\n[INFO] Skipping Part B (PostgreSQL): TARGET_DATABASE_URL not set in process');
    }

  } finally {
    // Teardown & cleanup
    await resetDatabaseAdapter();
    sqliteRaw.close();
    if (fs.existsSync(disposableDbPath)) {
      fs.unlinkSync(disposableDbPath);
    }
  }

  console.log('\n================================================================');
  console.log(`🎉 BATCH 1 VERIFICATION COMPLETED: All ${totalAssertions} assertions passed!`);
  console.log('================================================================\n');
}

runBatch1Tests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ [FATAL ERROR in Batch 1 Tests]:', err);
    process.exit(1);
  });
