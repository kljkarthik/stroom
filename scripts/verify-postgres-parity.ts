/**
 * STROOM PostgreSQL Parity Verification Tool
 * Stage 3.2: Deterministic SHA-256 Table Hashing & Row Count Reconciliation
 */

import Database from 'better-sqlite3';
import { Pool } from 'pg';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import { TOPOLOGICAL_TABLES } from './migrate-sqlite-to-postgres';
import { maskConnectionString, parseDatabaseConfig } from '../server/db/postgresAdapter';

export interface TableParityResult {
  table: string;
  sqliteCount: number;
  postgresCount: number | null;
  sqliteHash: string;
  postgresHash: string | null;
  countMatch: boolean;
  hashMatch: boolean;
  status: 'MATCH' | 'MISMATCH' | 'SQLITE_BASELINE_ONLY' | 'ERROR';
  error?: string;
}

export interface ParitySummary {
  totalTables: number;
  matchingTables: number;
  mismatchTables: number;
  sqliteTotalRows: number;
  postgresTotalRows: number | null;
  durationMs: number;
  results: TableParityResult[];
}

/**
 * Determine ordering column for deterministic table hashing
 */
function getOrderingColumn(table: string): string {
  if (table === 'platform_settings') return 'key';
  if (table === 'response_options') return 'response_id, option_id';
  return 'id';
}

/**
 * Normalize and deterministically hash a single database row
 */
export function hashRow(row: Record<string, any>): string {
  const sortedKeys = Object.keys(row).sort();
  const canonicalObj: Record<string, any> = {};

  for (const key of sortedKeys) {
    let val = row[key];
    // Normalize boolean representation (1/0 vs true/false)
    if (typeof val === 'boolean') {
      val = val ? 1 : 0;
    }
    // Normalize null/undefined
    if (val === undefined) {
      val = null;
    }
    // Normalize Postgres NUMERIC string format '123.45' / '850.00' to number
    if (typeof val === 'string' && /^-?\d+\.\d+$/.test(val)) {
      const num = Number(val);
      if (!isNaN(num)) {
        val = num;
      }
    }
    canonicalObj[key] = val;
  }

  const jsonStr = JSON.stringify(canonicalObj);
  return crypto.createHash('sha256').update(jsonStr, 'utf8').digest('hex');
}

/**
 * Compute composite table hash from row hashes
 */
export function computeTableHash(rowHashes: string[]): string {
  if (rowHashes.length === 0) {
    return '0'.repeat(64); // Empty table hash sentinel
  }
  const combined = rowHashes.join(':');
  return crypto.createHash('sha256').update(combined, 'utf8').digest('hex');
}

/**
 * Compute SHA-256 hash of a SQLite table
 */
export function hashSqliteTable(db: Database.Database, table: string): { count: number; hash: string } {
  const orderCol = getOrderingColumn(table);
  const rows = db.prepare(`SELECT * FROM "${table}" ORDER BY ${orderCol}`).all() as Record<string, any>[];
  const rowHashes = rows.map(hashRow);
  const hash = computeTableHash(rowHashes);
  return { count: rows.length, hash };
}

/**
 * Compute SHA-256 hash of a PostgreSQL table
 */
export async function hashPostgresTable(client: any, table: string): Promise<{ count: number; hash: string }> {
  const orderCol = getOrderingColumn(table);
  const orderColsSql = orderCol.split(',').map((c) => `"${c.trim()}"`).join(', ');
  const res = await client.query(`SELECT * FROM "${table}" ORDER BY ${orderColsSql}`);
  const rowHashes = res.rows.map(hashRow);
  const hash = computeTableHash(rowHashes);
  return { count: res.rows.length, hash };
}

export async function verifyParity(
  sqlitePath: string = path.resolve(process.cwd(), 'data', 'stroom.db'),
  postgresUrl?: string
): Promise<ParitySummary> {
  const startTime = Date.now();
  console.log('================================================================');
  console.log('🔍 STROOM DATABASE PARITY & RECONCILIATION AUDIT');
  console.log('================================================================');
  console.log(`Source SQLite   : ${sqlitePath}`);
  console.log(`Target Postgres : ${postgresUrl ? maskConnectionString(postgresUrl) : '[NONE - BASELINE CALCULATION]'}`);
  console.log('----------------------------------------------------------------\n');

  if (!fs.existsSync(sqlitePath)) {
    throw new Error(`Source SQLite file not found at: ${sqlitePath}`);
  }

  const sqliteDb = new Database(sqlitePath, { readonly: true, fileMustExist: true });
  let pgPool: Pool | null = null;

  if (postgresUrl) {
    pgPool = new Pool(parseDatabaseConfig(postgresUrl, 2));
  }

  const results: TableParityResult[] = [];
  let sqliteTotalRows = 0;
  let postgresTotalRows: number | null = pgPool ? 0 : null;

  try {
    let pgClient: any = null;
    if (pgPool) {
      pgClient = await pgPool.connect();
    }

    for (const table of TOPOLOGICAL_TABLES) {
      try {
        const sqliteData = hashSqliteTable(sqliteDb, table);
        sqliteTotalRows += sqliteData.count;

        if (!pgClient) {
          // Baseline calculation only
          results.push({
            table,
            sqliteCount: sqliteData.count,
            postgresCount: null,
            sqliteHash: sqliteData.hash,
            postgresHash: null,
            countMatch: true,
            hashMatch: true,
            status: 'SQLITE_BASELINE_ONLY',
          });
          console.log(`[BASELINE] ${table.padEnd(25)} | Rows: ${String(sqliteData.count).padStart(6)} | Hash: ${sqliteData.hash.slice(0, 16)}...`);
          continue;
        }

        // Both DBs present: compare
        const pgData = await hashPostgresTable(pgClient, table);
        if (postgresTotalRows !== null) {
          postgresTotalRows += pgData.count;
        }

        const countMatch = sqliteData.count === pgData.count;
        const hashMatch = sqliteData.hash === pgData.hash;
        const status = countMatch && hashMatch ? 'MATCH' : 'MISMATCH';

        results.push({
          table,
          sqliteCount: sqliteData.count,
          postgresCount: pgData.count,
          sqliteHash: sqliteData.hash,
          postgresHash: pgData.hash,
          countMatch,
          hashMatch,
          status,
        });

        const icon = status === 'MATCH' ? '✅' : '❌';
        console.log(`${icon} [${status.padEnd(8)}] ${table.padEnd(25)} | SQLite: ${String(sqliteData.count).padStart(6)} | PG: ${String(pgData.count).padStart(6)} | Hash Match: ${hashMatch}`);
      } catch (err: any) {
        results.push({
          table,
          sqliteCount: 0,
          postgresCount: null,
          sqliteHash: '',
          postgresHash: null,
          countMatch: false,
          hashMatch: false,
          status: 'ERROR',
          error: err.message,
        });
        console.error(`❌ [ERROR] ${table.padEnd(25)}: ${err.message}`);
      }
    }

    if (pgClient) {
      pgClient.release();
    }
  } finally {
    sqliteDb.close();
    if (pgPool) {
      await pgPool.end();
    }
  }

  const durationMs = Date.now() - startTime;
  const matchingTables = results.filter((r) => r.status === 'MATCH' || r.status === 'SQLITE_BASELINE_ONLY').length;
  const mismatchTables = results.filter((r) => r.status === 'MISMATCH' || r.status === 'ERROR').length;

  console.log('\n================================================================');
  console.log('📊 PARITY AUDIT SUMMARY');
  console.log('================================================================');
  console.log(`Total Tables Audited : ${TOPOLOGICAL_TABLES.length}`);
  console.log(`Matching Tables      : ${matchingTables}`);
  console.log(`Mismatched Tables    : ${mismatchTables}`);
  console.log(`SQLite Total Rows    : ${sqliteTotalRows}`);
  if (postgresTotalRows !== null) {
    console.log(`PostgreSQL Total Rows: ${postgresTotalRows}`);
  }
  console.log(`Duration             : ${durationMs} ms`);
  console.log('================================================================\n');

  return {
    totalTables: TOPOLOGICAL_TABLES.length,
    matchingTables,
    mismatchTables,
    sqliteTotalRows,
    postgresTotalRows,
    durationMs,
    results,
  };
}

if (require.main === module) {
  let sqlitePath: string = path.resolve(process.cwd(), 'data', 'stroom.db');
  let pgUrl: string | undefined = process.env.TARGET_DATABASE_URL || process.env.DATABASE_URL;

  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--source' && i + 1 < args.length) {
      sqlitePath = path.resolve(process.cwd(), args[++i]);
    } else if (args[i] === '--target' && i + 1 < args.length) {
      pgUrl = args[++i];
    }
  }

  verifyParity(sqlitePath, pgUrl)
    .then((summary) => {
      process.exit(summary.mismatchTables === 0 ? 0 : 1);
    })
    .catch((err) => {
      console.error('[FATAL] Parity check failed:', err.message);
      process.exit(1);
    });
}
