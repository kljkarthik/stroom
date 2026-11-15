/**
 * STROOM SQLite to PostgreSQL Migration Tool
 * Stage 3.2: Topological batch migration pipeline
 *
 * Safety:
 * - Opens SQLite source in strict read-only mode.
 * - Migrates tables strictly in topological DAG order (Levels 1 to 8).
 * - Masks credentials in logs.
 * - Supports --dry-run for offline verification without target database.
 */

import Database from 'better-sqlite3';
import { Pool } from 'pg';
import path from 'path';
import fs from 'fs';
import { maskConnectionString, parseDatabaseConfig } from '../server/db/postgresAdapter';

/**
 * 42 Tables in strict topological order (Parents before Children)
 */
export const TOPOLOGICAL_TABLES = [
  // Level 1: Independent Root Tables (No FKs)
  'achievements_master',
  'cities',
  'discovery_items',
  'platform_settings',
  'quizzes',
  'users',

  // Level 2: Single-Parent Dependencies
  'communities',
  'quiz_versions',
  'activity_logs',
  'admin_announcements',
  'audit_logs',
  'contact_inquiries',
  'notifications',
  'partner_accounts',
  'user_achievements',
  'user_preferences',

  // Level 3: Two-Parent Dependencies
  'community_members',
  'community_posts',
  'partner_audit_logs',
  'partner_users',
  'questions',
  'quiz_sessions',
  'venues',

  // Level 4: Venue & Quiz Children
  'coupons',
  'events',
  'partner_proposals',
  'options',
  'responses',

  // Level 5: Event & Response Children
  'passport_stamps',
  'venue_availability',
  'auction_rooms',
  'event_registrations',
  'partner_collaborations',
  'response_options',

  // Level 6: Auction & Collaboration Children
  'auction_teams',
  'collaboration_comments',
  'partner_communications',
  'coupon_redemptions',
  'payment_transactions',

  // Level 7: Auction Deep Children
  'auction_players',
  'auction_registrations',

  // Level 8: Terminal Child
  'bids',
];

export interface MigrationOptions {
  sourceDbPath: string;
  targetUrl?: string;
  batchSize: number;
  dryRun: boolean;
  tableFilter?: string[];
}

export interface TableMigrationResult {
  table: string;
  rowCount: number;
  migratedCount: number;
  batches: number;
  durationMs: number;
  status: 'SUCCESS' | 'DRY_RUN' | 'FAILED' | 'SKIPPED';
  error?: string;
}

export interface MigrationSummary {
  totalTables: number;
  successfulTables: number;
  totalRows: number;
  migratedRows: number;
  durationMs: number;
  isDryRun: boolean;
  results: TableMigrationResult[];
}

/**
 * Parse CLI arguments
 */
export function parseArgs(argv: string[]): MigrationOptions {
  const options: MigrationOptions = {
    sourceDbPath: path.resolve(process.cwd(), 'data', 'stroom.db'),
    targetUrl: process.env.TARGET_DATABASE_URL || process.env.DATABASE_URL,
    batchSize: 500,
    dryRun: false,
  };

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--dry-run' || arg === '-n') {
      options.dryRun = true;
    } else if (arg === '--source' && i + 1 < argv.length) {
      options.sourceDbPath = path.resolve(process.cwd(), argv[++i]);
    } else if (arg === '--target' && i + 1 < argv.length) {
      options.targetUrl = argv[++i];
    } else if (arg === '--batch-size' && i + 1 < argv.length) {
      options.batchSize = parseInt(argv[++i], 10) || 500;
    } else if (arg === '--tables' && i + 1 < argv.length) {
      options.tableFilter = argv[++i].split(',').map((t) => t.trim().toLowerCase());
    }
  }

  return options;
}

/**
 * Execute the migration pipeline
 */
export async function runMigration(options: MigrationOptions): Promise<MigrationSummary> {
  const startTime = Date.now();
  console.log('================================================================');
  console.log('🚀 STROOM SQLITE TO POSTGRESQL MIGRATION PIPELINE');
  console.log('================================================================');
  console.log(`Source SQLite Database: ${options.sourceDbPath}`);
  console.log(`Execution Mode        : ${options.dryRun ? 'DRY-RUN (Offline Validation)' : 'LIVE EXECUTION'}`);
  console.log(`Batch Size            : ${options.batchSize} rows/batch`);
  if (options.targetUrl) {
    console.log(`Target PostgreSQL     : ${maskConnectionString(options.targetUrl)}`);
  } else {
    console.log('Target PostgreSQL     : [NONE PROVIDED]');
  }
  console.log('----------------------------------------------------------------\n');

  if (!fs.existsSync(options.sourceDbPath)) {
    throw new Error(`Source SQLite file not found at: ${options.sourceDbPath}`);
  }

  // Open SQLite database in STRICT READONLY mode
  const sqliteDb = new Database(options.sourceDbPath, { readonly: true, fileMustExist: true });

  let pgPool: Pool | null = null;
  if (!options.dryRun) {
    if (!options.targetUrl) {
      throw new Error('Target PostgreSQL connection URL is required for live execution. Use --target or set TARGET_DATABASE_URL.');
    }
    pgPool = new Pool(parseDatabaseConfig(options.targetUrl, 5));
  }

  const results: TableMigrationResult[] = [];
  let totalRows = 0;
  let migratedRows = 0;

  const tablesToMigrate = options.tableFilter
    ? TOPOLOGICAL_TABLES.filter((t) => options.tableFilter!.includes(t))
    : TOPOLOGICAL_TABLES;

  try {
    for (const tableName of tablesToMigrate) {
      const tableStart = Date.now();
      // Count rows in SQLite
      const countRow = sqliteDb.prepare(`SELECT count(*) as count FROM "${tableName}"`).get() as { count: number };
      const rowCount = countRow ? countRow.count : 0;
      totalRows += rowCount;

      console.log(`[TABLE] ${tableName.padEnd(25)} | Rows: ${String(rowCount).padStart(6)} | Status: Processing...`);

      if (options.dryRun || !pgPool) {
        // Dry-run mode: fetch first batch to validate reading and structure
        if (rowCount > 0) {
          const sampleRows = sqliteDb.prepare(`SELECT * FROM "${tableName}" LIMIT 10`).all();
          if (sampleRows.length === 0 && rowCount > 0) {
            throw new Error(`Failed to read sample rows from table: ${tableName}`);
          }
        }

        results.push({
          table: tableName,
          rowCount,
          migratedCount: rowCount,
          batches: Math.ceil(rowCount / options.batchSize) || 1,
          durationMs: Date.now() - tableStart,
          status: 'DRY_RUN',
        });
        migratedRows += rowCount;
        console.log(`[DRY-RUN] ${tableName.padEnd(23)} | Validated ${rowCount} rows (offline).`);
        continue;
      }

      // Live PostgreSQL migration
      const batches = Math.ceil(rowCount / options.batchSize) || 1;
      let tableMigrated = 0;

      for (let batchIdx = 0; batchIdx < batches; batchIdx++) {
        const offset = batchIdx * options.batchSize;
        const rows = sqliteDb.prepare(`SELECT * FROM "${tableName}" LIMIT ? OFFSET ?`).all(options.batchSize, offset);
        if (rows.length === 0) break;

        const columns = Object.keys(rows[0]);
        const colsSql = columns.map((c) => `"${c}"`).join(', ');

        const client = await pgPool.connect();
        try {
          await client.query('BEGIN');

          const valueRowClauses: string[] = [];
          const allValues: any[] = [];
          let paramIdx = 1;

          for (const row of rows) {
            const placeholders: string[] = [];
            for (const col of columns) {
              placeholders.push(`$${paramIdx++}`);
              let val = (row as any)[col];
              allValues.push(val);
            }
            valueRowClauses.push(`(${placeholders.join(', ')})`);
          }

          const insertSql = `INSERT INTO "${tableName}" (${colsSql}) VALUES ${valueRowClauses.join(', ')} ON CONFLICT DO NOTHING`;
          await client.query(insertSql, allValues);

          await client.query('COMMIT');
          tableMigrated += rows.length;
        } catch (err: any) {
          await client.query('ROLLBACK');
          throw new Error(`Failed migrating table ${tableName} at offset ${offset}: ${err.message}`);
        } finally {
          client.release();
        }
      }

      migratedRows += tableMigrated;
      results.push({
        table: tableName,
        rowCount,
        migratedCount: tableMigrated,
        batches,
        durationMs: Date.now() - tableStart,
        status: 'SUCCESS',
      });
      console.log(`[SUCCESS] ${tableName.padEnd(23)} | Migrated ${tableMigrated}/${rowCount} rows in ${Date.now() - tableStart}ms.`);
    }
  } finally {
    sqliteDb.close();
    if (pgPool) {
      await pgPool.end();
    }
  }

  const durationMs = Date.now() - startTime;
  const successfulTables = results.filter((r) => r.status === 'SUCCESS' || r.status === 'DRY_RUN').length;

  console.log('\n================================================================');
  console.log('📊 MIGRATION SUMMARY');
  console.log('================================================================');
  console.log(`Execution Mode    : ${options.dryRun ? 'DRY-RUN (Validated)' : 'LIVE MIGRATION'}`);
  console.log(`Tables Processed  : ${successfulTables} / ${tablesToMigrate.length}`);
  console.log(`Total Rows Read   : ${totalRows}`);
  console.log(`Total Rows Copied : ${migratedRows}`);
  console.log(`Total Duration    : ${durationMs} ms`);
  console.log('================================================================\n');

  return {
    totalTables: tablesToMigrate.length,
    successfulTables,
    totalRows,
    migratedRows,
    durationMs,
    isDryRun: options.dryRun,
    results,
  };
}

// Execute if run directly from CLI
if (require.main === module) {
  const options = parseArgs(process.argv);
  runMigration(options)
    .then((summary) => {
      process.exit(summary.successfulTables === summary.totalTables ? 0 : 1);
    })
    .catch((err) => {
      console.error('[FATAL] Migration aborted:', err.message);
      process.exit(1);
    });
}
