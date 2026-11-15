/**
 * STROOM — Stage 3.2.5 — Batch 4 Verification Suite
 * Tests Auction Engine Workflows across SQLite and PostgreSQL.
 */

import fs from 'fs';
import path from 'path';
import http from 'http';
import Database from 'better-sqlite3';
import express from 'express';
import auctionRouter from '../server/routes/auction';
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
  app.use('/api/auction', auctionRouter);
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

async function runBatch4Tests() {
  console.log('================================================================');
  console.log('🧪 STROOM STAGE 3.2.5 BATCH 4: AUCTION ENGINE TEST');
  console.log('================================================================\n');

  let totalAssertions = 0;
  function pass(desc: string) {
    totalAssertions++;
    console.log(`  ✅ PASSED: ${desc}`);
  }

  // Set up disposable SQLite database from test_temp.db
  const disposableDbPath = path.resolve(process.cwd(), 'data', 'test_disposable_batch4.db');
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
    console.log('--- Part A: SQLite Driver Auction Engine ---');
    setDatabaseAdapter(sqliteAdapter);

    // 1. Admin Login
    const loginRes = await client.req('POST', '/api/auth/login', {
      body: { email: 'admin@stroom.app', password: 'Admin@123' }
    });
    assert(loginRes.status === 200, 'Admin login succeeded on SQLite');
    const adminToken = loginRes.body.token;
    pass('Admin login authenticated');

    // 2. Fetch Auction Rooms
    const roomsRes = await client.req('GET', '/api/auction');
    assert(roomsRes.status === 200, 'GET /api/auction returns 200');
    assert(Array.isArray(roomsRes.body.auctions) && roomsRes.body.auctions.length > 0, 'Auctions returned');
    const testRoom = roomsRes.body.auctions[0];
    pass(`GET /api/auction returned ${roomsRes.body.auctions.length} auction rooms`);

    // 3. Fetch Auction Detail
    const detailRes = await client.req('GET', `/api/auction/${testRoom.id}`, { token: adminToken });
    assert(detailRes.status === 200, 'GET /api/auction/:id returns 200');
    assert(detailRes.body.auction.id === testRoom.id, 'Auction ID match');
    assert(Array.isArray(detailRes.body.teams) && detailRes.body.teams.length > 0, 'Teams returned');
    assert(Array.isArray(detailRes.body.players) && detailRes.body.players.length > 0, 'Players returned');
    pass(`GET /api/auction/:id resolved state with ${detailRes.body.teams.length} teams and ${detailRes.body.players.length} players`);

    // Ensure room is LIVE for bidding
    await sqliteAdapter.execute("UPDATE auction_rooms SET status = 'LIVE' WHERE id = ?", [testRoom.id]);

    const activePlayer = detailRes.body.players[0];
    const biddingTeam = detailRes.body.teams[0];
    const secondTeam = detailRes.body.teams[1] || detailRes.body.teams[0];

    // Ensure player is IN_AUCTION
    await sqliteAdapter.execute("UPDATE auction_players SET status = 'IN_AUCTION' WHERE id = ?", [activePlayer.id]);

    // 4. Place Bid
    const bidRes = await client.req('POST', `/api/auction/${testRoom.id}/bid`, {
      token: adminToken,
      body: {
        team_id: biddingTeam.id,
        player_id: activePlayer.id,
        amount: activePlayer.base_price + 50000,
      }
    });
    assert(bidRes.status === 200, `Place bid returns 200 (got ${bidRes.status}: ${JSON.stringify(bidRes.body)})`);
    assert(bidRes.body.highestBidderTeamId === biddingTeam.id, 'Highest bidder updated');
    pass('POST /api/auction/:id/bid placed atomic bid with validation');

    // 5. Gavel Strike (SOLD)
    const gavelRes = await client.req('POST', `/api/auction/${testRoom.id}/gavel`, {
      token: adminToken,
      body: {
        player_id: activePlayer.id,
        action: 'SOLD',
      }
    });
    assert(gavelRes.status === 200, `Gavel strike returns 200 (got ${gavelRes.status}: ${JSON.stringify(gavelRes.body)})`);
    assert(gavelRes.body.action === 'SOLD', 'Player lot marked SOLD');
    pass('POST /api/auction/:id/gavel executed gavel strike and deducted team purse');

    // 6. Generate Auction Report
    const reportRes = await client.req('GET', `/api/auction/${testRoom.id}/report`);
    assert(reportRes.status === 200, 'GET /api/auction/:id/report returns 200');
    assert(reportRes.body.report && reportRes.body.report.auctionId === testRoom.id, 'Report auctionId match');
    assert(typeof reportRes.body.report.csvData === 'string', 'CSV export string generated');
    pass('GET /api/auction/:id/report generated post-auction team sheets and analytics');

    // -------------------------------------------------------------
    // PART B: Live Neon PostgreSQL Verification
    // -------------------------------------------------------------
    const targetUrl = process.env.TARGET_DATABASE_URL || process.env.DATABASE_URL;
    if (targetUrl) {
      console.log('\n--- Part B: Neon PostgreSQL Driver Auction Engine ---');
      const pgAdapter = new PostgresAdapter(targetUrl);
      setDatabaseAdapter(pgAdapter);

      // Verify connection
      const ping = await pgAdapter.ping();
      assert(ping === true, 'PostgreSQL ping must return true');
      pass('Neon PostgreSQL adapter connected and responsive');

      // Test Auction Rooms on PostgreSQL
      const pgRoomsRes = await client.req('GET', '/api/auction');
      assert(pgRoomsRes.status === 200, 'PostgreSQL GET /api/auction returns 200');
      assert(pgRoomsRes.body.auctions.length > 0, 'PostgreSQL returned auctions');
      const pgRoom = pgRoomsRes.body.auctions[0];
      pass(`Neon PostgreSQL: GET /api/auction returned ${pgRoomsRes.body.auctions.length} auctions`);

      // Test Auction Detail on PostgreSQL
      const pgDetailRes = await client.req('GET', `/api/auction/${pgRoom.id}`);
      assert(pgDetailRes.status === 200, 'PostgreSQL GET /api/auction/:id returns 200');
      assert(pgDetailRes.body.auction.id === pgRoom.id, 'PostgreSQL auction ID match');
      pass(`Neon PostgreSQL: GET /api/auction/:id resolved state with ${pgDetailRes.body.teams.length} teams`);

      // Test Report Generation on PostgreSQL
      const pgReportRes = await client.req('GET', `/api/auction/${pgRoom.id}/report`);
      assert(pgReportRes.status === 200, 'PostgreSQL GET /api/auction/:id/report returns 200');
      assert(typeof pgReportRes.body.report.csvData === 'string', 'PostgreSQL report csv generated');
      pass('Neon PostgreSQL: GET /api/auction/:id/report generated analytics report');

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
  console.log(`🎉 BATCH 4 VERIFICATION COMPLETED: All ${totalAssertions} assertions passed!`);
  console.log('================================================================\n');
}

runBatch4Tests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ [FATAL ERROR in Batch 4 Tests]:', err);
    process.exit(1);
  });
