/**
 * STROOM — Stage 3.2.6: Concurrency & Transaction Stress Verification Suite
 * Tests ACID transaction rollback, concurrent event registration, concurrent bidding,
 * and concurrent coupon redemption across both SQLite and Neon PostgreSQL.
 */

import fs from 'fs';
import path from 'path';
import http from 'http';
import Database from 'better-sqlite3';
import express from 'express';
import { getDatabaseAdapter, setDatabaseAdapter, resetDatabaseAdapter } from '../server/db/adapter';
import { SqliteAdapter } from '../server/db/sqliteAdapter';
import { PostgresAdapter } from '../server/db/postgresAdapter';
import eventsRouter from '../server/routes/events';
import auctionRouter from '../server/routes/auction';
import partnersRouter from '../server/routes/partners';
import authRouter from '../server/routes/auth';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`[ASSERTION FAILED]: ${msg}`);
}

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRouter);
  app.use('/api/events', eventsRouter);
  app.use('/api/auction', auctionRouter);
  app.use('/api/partners', partnersRouter);
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
      // ignore non-json
    }

    return {
      status: res.status,
      body: json,
    };
  }
}

async function runConcurrencySuite() {
  console.log('================================================================');
  console.log('⚡ STROOM STAGE 3.2.6: CONCURRENCY & TRANSACTION STRESS AUDIT');
  console.log('================================================================\n');

  let passedAssertions = 0;
  function pass(desc: string) {
    passedAssertions++;
    console.log(`  ✅ PASSED: ${desc}`);
  }

  // 1. Prepare disposable SQLite db from test_temp.db
  const disposableDbPath = path.resolve(process.cwd(), 'data', 'test_disposable_concurrency.db');
  fs.copyFileSync(path.resolve(process.cwd(), 'data', 'test_temp.db'), disposableDbPath);

  const sqliteRaw = new Database(disposableDbPath);
  const sqliteAdapter = new SqliteAdapter(sqliteRaw);
  const app = createApp();
  const client = new TestClient(app);
  await client.start();

  try {
    // -------------------------------------------------------------
    // PART A: SQLite Engine Concurrency & Transaction Integrity
    // -------------------------------------------------------------
    console.log('--- Part A: SQLite Concurrency & Rollback Verification ---');
    setDatabaseAdapter(sqliteAdapter);

    // Login admin to obtain auth token
    const loginRes = await client.req('POST', '/api/auth/login', {
      body: { email: 'admin@stroom.app', password: 'Admin@123' },
    });
    assert(loginRes.status === 200, 'Admin login succeeded on SQLite');
    const token = loginRes.body.token;

    // A1. Transaction Rollback Verification
    let rollbackThrew = false;
    try {
      await sqliteAdapter.transaction(async (tx) => {
        await tx.execute(`
          INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id)
          VALUES ('audit_rollback_test_sq', 'usr_admin_001', 'TEST_ROLLBACK', 'test', '001')
        `);
        throw new Error('Simulated failure during business transaction');
      });
    } catch (err: any) {
      rollbackThrew = true;
      assert(err.message === 'Simulated failure during business transaction', `Expected simulation error, got: ${err.message}`);
    }
    assert(rollbackThrew, 'Transaction threw error as expected');
    const leakedAuditSqlite = await sqliteAdapter.queryOne("SELECT id FROM audit_logs WHERE id = 'audit_rollback_test_sq'");
    assert(!leakedAuditSqlite, 'Transaction rollback guaranteed: audit log record was not committed');
    pass('SQLite: Transaction rollback integrity verified (0 uncommitted writes persisted)');

    // A2. Concurrent Event Registration
    const events = await sqliteAdapter.query<any>('SELECT id, seats_booked, seats_total FROM events LIMIT 1');
    assert(events.length > 0, 'Event exists in SQLite');
    const targetEvent = events[0];
    const initialSeats = targetEvent.seats_booked;
    const testUserId = 'usr_concurrent_sq_001';

    // Insert user into disposable db if not exists
    await sqliteAdapter.execute(`
      INSERT OR IGNORE INTO users (id, email, password_hash, full_name, role)
      VALUES (?, 'conc_sq@stroom.app', 'hash', 'Concurrent Tester', 'user')
    `, [testUserId]);

    // Issue 10 concurrent registration requests for the same user and event
    const regPromises = Array.from({ length: 10 }, () =>
      sqliteAdapter.transaction(async (tx) => {
        const existing = await tx.queryOne<any>('SELECT * FROM event_registrations WHERE event_id = ? AND user_id = ?', [targetEvent.id, testUserId]);
        if (existing) {
          return { existing: true, pass: existing };
        }
        const regId = 'reg_sq_' + Math.random().toString(36).slice(2, 10);
        try {
          await tx.execute(`
            INSERT INTO event_registrations (id, event_id, user_id, pass_code, qr_token, seat_tier, role_type, checkin_status)
            VALUES (?, ?, ?, 'TEST_PASS_SQ', 'TEST_QR_SQ', 'Standard', 'Attendee', 'confirmed')
          `, [regId, targetEvent.id, testUserId]);
          await tx.execute('UPDATE events SET seats_booked = seats_booked + 1 WHERE id = ?', [targetEvent.id]);
          return { existing: false, regId };
        } catch (err: any) {
          if (err.message?.includes('UNIQUE') || err.code === 'SQLITE_CONSTRAINT_UNIQUE' || err.code === '23505') {
            return { existing: true, pass: null };
          }
          throw err;
        }
      })
    );

    const regResults = await Promise.all(regPromises);
    const newRegistrations = regResults.filter((r) => !r.existing);
    assert(newRegistrations.length === 1, `Exactly 1 registration inserted (got ${newRegistrations.length})`);

    const regCount = (await sqliteAdapter.queryOne<any>('SELECT COUNT(*) as c FROM event_registrations WHERE event_id = ? AND user_id = ?', [targetEvent.id, testUserId]))?.c;
    assert(Number(regCount) === 1, 'Exactly 1 row persisted in event_registrations for concurrent user');

    const updatedEvent = await sqliteAdapter.queryOne<any>('SELECT seats_booked FROM events WHERE id = ?', [targetEvent.id]);
    assert(updatedEvent.seats_booked === initialSeats + 1, 'Event seats_booked incremented by exactly 1');
    pass('SQLite: Handled 10 concurrent registration requests with strict idempotency and zero over-counting');

    // A3. Concurrent Bidding Serialization
    const rooms = await sqliteAdapter.query<any>('SELECT id FROM auction_rooms LIMIT 1');
    assert(rooms.length > 0, 'Auction room exists');
    const roomId = rooms[0].id;
    const players = await sqliteAdapter.query<any>('SELECT id, base_price, current_bid FROM auction_players WHERE auction_id = ? LIMIT 1', [roomId]);
    assert(players.length > 0, 'Auction player exists');
    const player = players[0];
    const initialBid = player.current_bid || player.base_price;

    const teams = await sqliteAdapter.query<any>('SELECT id, purse_remaining FROM auction_teams WHERE auction_id = ? LIMIT 2', [roomId]);
    assert(teams.length >= 2, 'At least 2 auction teams exist');
    const teamA = teams[0];
    const teamB = teams[1];

    // Fire 6 concurrent bids with distinct bid amounts
    const bidAmounts = [initialBid + 10000, initialBid + 20000, initialBid + 30000, initialBid + 40000, initialBid + 50000, initialBid + 60000];
    const bidPromises = bidAmounts.map((amt, idx) => {
      const bidderTeam = idx % 2 === 0 ? teamA : teamB;
      return sqliteAdapter.transaction(async (tx) => {
        const cur = await tx.queryOne<any>('SELECT current_bid FROM auction_players WHERE id = ?', [player.id]);
        if (amt <= cur.current_bid) {
          throw new Error('Bid amount must exceed current highest bid');
        }
        const bidId = 'bid_test_sq_' + Math.random().toString(36).slice(2, 10);
        await tx.execute('INSERT INTO bids (id, auction_id, player_id, team_id, amount) VALUES (?, ?, ?, ?, ?)', [
          bidId, roomId, player.id, bidderTeam.id, amt
        ]);
        await tx.execute('UPDATE auction_players SET current_bid = ?, highest_bidder_team_id = ? WHERE id = ?', [
          amt, bidderTeam.id, player.id
        ]);
        return { success: true, amt };
      }).catch((err) => ({ success: false, error: err.message }));
    });

    const bidResults = await Promise.all(bidPromises);
    const successfulBids = bidResults.filter((r) => r.success);
    assert(successfulBids.length > 0, 'At least one concurrent bid succeeded');
    const finalPlayer = await sqliteAdapter.queryOne<any>('SELECT current_bid FROM auction_players WHERE id = ?', [player.id]);
    assert(finalPlayer.current_bid === Math.max(...bidAmounts), 'Final player current_bid equals the highest submitted valid bid');
    pass(`SQLite: Serialized 6 concurrent bids; final highest bid ₹${finalPlayer.current_bid.toLocaleString('en-IN')} recorded accurately`);

    // A4. Concurrent Coupon Single-Use Redemption
    const couponId = 'cpn_conc_test_sq';
    const testPassCode = 'PASS_CONC_SQ_001';
    const venue = (await sqliteAdapter.queryOne<any>('SELECT id FROM venues LIMIT 1'))?.id || 'ven_roastery_hyd';
    await sqliteAdapter.execute(`
      INSERT OR REPLACE INTO coupons (id, venue_id, title, description, code, discount_type, discount_value, max_redemptions, status, valid_until)
      VALUES (?, ?, 'Single Use Test', 'Test desc', 'SINGLE_SQ', 'percentage', '20', 1, 'active', '2030-01-01')
    `, [couponId, venue]);

    const redeemPromises = Array.from({ length: 5 }, () =>
      sqliteAdapter.transaction(async (tx) => {
        const updateRes = await tx.execute(
          'UPDATE coupons SET actual_redemptions = actual_redemptions + 1 WHERE id = ? AND actual_redemptions < max_redemptions',
          [couponId]
        );
        if (updateRes.changes === 0) {
          throw new Error('Coupon redemption cap reached');
        }
        const redId = 'red_sq_' + Math.random().toString(36).slice(2, 10);
        await tx.execute(`
          INSERT INTO coupon_redemptions (id, coupon_id, venue_id, user_id, pass_code, order_amount)
          VALUES (?, ?, ?, 'usr_admin_001', ?, 500)
        `, [redId, couponId, venue, testPassCode]);
        return { success: true, redId };
      }).catch((err) => ({ success: false, error: err.message }))
    );

    const redeemResults = await Promise.all(redeemPromises);
    const successfulRedeems = redeemResults.filter((r) => r.success);
    const failedRedeems = redeemResults.filter((r) => !r.success);
    assert(successfulRedeems.length === 1, `Exactly 1 coupon redemption succeeded (got ${successfulRedeems.length})`);
    assert(failedRedeems.length === 4, `Exactly 4 concurrent redemptions rejected (got ${failedRedeems.length})`);
    pass('SQLite: Single-use coupon defended against 5 concurrent redemption requests (exactly 1 succeeded, 4 rejected)');

    // -------------------------------------------------------------
    // PART B: Live Neon PostgreSQL Engine Concurrency & Rollback
    // -------------------------------------------------------------
    const targetUrl = process.env.TARGET_DATABASE_URL || process.env.DATABASE_URL;
    if (targetUrl) {
      console.log('\n--- Part B: Neon PostgreSQL Concurrency & Rollback Verification ---');
      const pgAdapter = new PostgresAdapter(targetUrl);
      setDatabaseAdapter(pgAdapter);

      const ping = await pgAdapter.ping();
      assert(ping === true, 'PostgreSQL adapter responsive');
      pass('Neon PostgreSQL: Adapter ping responsive');

      // B1. Transaction Rollback Verification on Neon
      let pgRollbackThrew = false;
      try {
        await pgAdapter.transaction(async (tx) => {
          await tx.execute(`
            INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id)
            VALUES ('audit_rollback_test_pg', 'usr_admin_001', 'TEST_ROLLBACK_PG', 'test', '001')
          `);
          throw new Error('Simulated failure during PostgreSQL transaction');
        });
      } catch (err: any) {
        pgRollbackThrew = true;
        assert(err.message === 'Simulated failure during PostgreSQL transaction', 'Expected simulation error thrown');
      }
      assert(pgRollbackThrew, 'PostgreSQL transaction threw error as expected');
      const leakedAuditPg = await pgAdapter.queryOne("SELECT id FROM audit_logs WHERE id = 'audit_rollback_test_pg'");
      assert(!leakedAuditPg, 'PostgreSQL transaction rollback guaranteed: audit log record was not committed');
      pass('Neon PostgreSQL: Transaction rollback integrity verified (0 uncommitted writes persisted)');

      // B2. Concurrent Registration Idempotency on Neon
      const pgEvents = await pgAdapter.query<any>('SELECT id, seats_booked, seats_total FROM events LIMIT 1');
      assert(pgEvents.length > 0, 'Event exists in Neon');
      const pgTargetEvent = pgEvents[0];
      const pgInitialSeats = Number(pgTargetEvent.seats_booked);
      const pgTestUserId = 'usr_concurrent_pg_001';

      await pgAdapter.execute(`
        INSERT INTO users (id, email, password_hash, full_name, role)
        VALUES (?, 'conc_pg@stroom.app', 'hash', 'Concurrent Tester PG', 'user')
        ON CONFLICT (id) DO NOTHING
      `, [pgTestUserId]);

      const pgRegPromises = Array.from({ length: 10 }, () =>
        pgAdapter.transaction(async (tx) => {
          const existing = await tx.queryOne<any>('SELECT * FROM event_registrations WHERE event_id = ? AND user_id = ?', [pgTargetEvent.id, pgTestUserId]);
          if (existing) {
            return { existing: true, pass: existing };
          }
          const regId = 'reg_pg_' + Math.random().toString(36).slice(2, 10);
          try {
            await tx.execute(`
              INSERT INTO event_registrations (id, event_id, user_id, pass_code, qr_token, seat_tier, role_type, checkin_status)
              VALUES (?, ?, ?, 'TEST_PASS_PG', 'TEST_QR_PG', 'Standard', 'Attendee', 'confirmed')
            `, [regId, pgTargetEvent.id, pgTestUserId]);
            await tx.execute('UPDATE events SET seats_booked = seats_booked + 1 WHERE id = ?', [pgTargetEvent.id]);
            return { existing: false, regId };
          } catch (err: any) {
            if (err.message?.includes('unique') || err.message?.includes('duplicate') || err.code === '23505') {
              return { existing: true, pass: null };
            }
            throw err;
          }
        })
      );

      const pgRegResults = await Promise.all(pgRegPromises);
      const pgNewRegistrations = pgRegResults.filter((r) => !r.existing);
      assert(pgNewRegistrations.length === 1, `PostgreSQL: Exactly 1 registration inserted (got ${pgNewRegistrations.length})`);

      const pgRegCount = (await pgAdapter.queryOne<any>('SELECT COUNT(*) as c FROM event_registrations WHERE event_id = ? AND user_id = ?', [pgTargetEvent.id, pgTestUserId]))?.c;
      assert(Number(pgRegCount) === 1, 'PostgreSQL: Exactly 1 row persisted in event_registrations for concurrent user');

      const pgUpdatedEvent = await pgAdapter.queryOne<any>('SELECT seats_booked FROM events WHERE id = ?', [pgTargetEvent.id]);
      assert(Number(pgUpdatedEvent.seats_booked) === pgInitialSeats + 1, 'PostgreSQL: Event seats_booked incremented by exactly 1');
      pass('Neon PostgreSQL: Handled 10 concurrent registration requests with strict idempotency');

      // Cleanup test registration from Neon
      await pgAdapter.execute('DELETE FROM event_registrations WHERE user_id = ?', [pgTestUserId]);
      await pgAdapter.execute('UPDATE events SET seats_booked = ? WHERE id = ?', [pgInitialSeats, pgTargetEvent.id]);
      await pgAdapter.execute('DELETE FROM users WHERE id = ?', [pgTestUserId]);

      // B3. Concurrent Single-Use Coupon Defense on Neon
      const pgCouponId = 'cpn_conc_test_pg';
      const pgTestPassCode = 'PASS_CONC_PG_001';
      const pgVenue = (await pgAdapter.queryOne<any>('SELECT id FROM venues LIMIT 1'))?.id || 'ven_roastery_hyd';
      await pgAdapter.execute(`
        INSERT INTO coupons (id, venue_id, title, description, code, discount_type, discount_value, max_redemptions, status, valid_until)
        VALUES (?, ?, 'Single Use Test PG', 'Test desc PG', 'SINGLE_PG', 'percentage', '20', 1, 'active', '2030-01-01')
        ON CONFLICT (id) DO NOTHING
      `, [pgCouponId, pgVenue]);

      const pgRedeemPromises = Array.from({ length: 5 }, () =>
        pgAdapter.transaction(async (tx) => {
          const updateRes = await tx.execute(
            'UPDATE coupons SET actual_redemptions = actual_redemptions + 1 WHERE id = ? AND actual_redemptions < max_redemptions',
            [pgCouponId]
          );
          if (updateRes.changes === 0) {
            throw new Error('Coupon redemption cap reached');
          }
          const redId = 'red_pg_' + Math.random().toString(36).slice(2, 10);
          await tx.execute(`
            INSERT INTO coupon_redemptions (id, coupon_id, venue_id, user_id, pass_code, order_amount)
            VALUES (?, ?, ?, 'usr_admin_001', ?, 500)
          `, [redId, pgCouponId, pgVenue, pgTestPassCode]);
          return { success: true, redId };
        }).catch((err) => ({ success: false, error: err.message }))
      );

      const pgRedeemResults = await Promise.all(pgRedeemPromises);
      const pgSuccessfulRedeems = pgRedeemResults.filter((r) => r.success);
      const pgFailedRedeems = pgRedeemResults.filter((r) => !r.success);
      assert(pgSuccessfulRedeems.length === 1, `PostgreSQL: Exactly 1 coupon redemption succeeded (got ${pgSuccessfulRedeems.length})`);
      assert(pgFailedRedeems.length === 4, `PostgreSQL: Exactly 4 concurrent redemptions rejected (got ${pgFailedRedeems.length})`);
      pass('Neon PostgreSQL: Single-use coupon defended against 5 concurrent redemption requests (exactly 1 succeeded, 4 rejected)');

      // Cleanup test coupon from Neon
      await pgAdapter.execute('DELETE FROM coupon_redemptions WHERE coupon_id = ?', [pgCouponId]);
      await pgAdapter.execute('DELETE FROM coupons WHERE id = ?', [pgCouponId]);

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
  console.log(`🎉 CONCURRENCY & TRANSACTION STRESS AUDIT COMPLETE: ${passedAssertions} assertions passed!`);
  console.log('================================================================\n');
}

runConcurrencySuite()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ [FATAL in Concurrency Suite]:', err);
    process.exit(1);
  });
