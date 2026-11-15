import Database from 'better-sqlite3';
import path from 'node:path';

export interface MigrationOptions {
  sourceDbPath: string;
  d1Database: any; // Miniflare or Cloudflare D1 binding
  batchSize?: number;
  insertMode?: 'INSERT_OR_REPLACE' | 'INSERT_INTO' | 'INSERT_OR_IGNORE';
  cleanTargetFirst?: boolean;
  log?: (message: string) => void;
}

export interface MigrationResult {
  success: boolean;
  totalTables: number;
  totalRecordsMigrated: number;
  tableDetails: Record<string, { count: number; status: 'SUCCESS' | 'FAILED'; error?: string }>;
  durationMs: number;
}

// 42 application tables in topologically sorted dependency order (Parents before Children)
export const TOPOLOGICAL_TABLES = [
  'achievements_master',
  'users',
  'activity_logs',
  'admin_announcements',
  'partner_accounts',
  'cities',
  'venues',
  'events',
  'auction_rooms',
  'auction_teams',
  'auction_players',
  'auction_registrations',
  'audit_logs',
  'bids',
  'partner_collaborations',
  'collaboration_comments',
  'communities',
  'community_members',
  'community_posts',
  'contact_inquiries',
  'coupons',
  'coupon_redemptions',
  'discovery_items',
  'event_registrations',
  'notifications',
  'quizzes',
  'quiz_versions',
  'questions',
  'options',
  'partner_audit_logs',
  'partner_communications',
  'partner_proposals',
  'partner_users',
  'passport_stamps',
  'payment_transactions',
  'platform_settings',
  'quiz_sessions',
  'responses',
  'response_options',
  'user_achievements',
  'user_preferences',
  'venue_availability',
];

export async function migrateSqliteToD1(options: MigrationOptions): Promise<MigrationResult> {
  const startTime = Date.now();
  const log = options.log || console.log;
  const batchSize = options.batchSize || 50;
  const insertMode = options.insertMode || 'INSERT_OR_REPLACE';
  const sourceDbPath = path.resolve(options.sourceDbPath);
  const d1 = options.d1Database;

  // Optional clean-slate pre-truncation in reverse topological order (children before parents)
  // to eliminate cascade deletion and foreign key restrict collisions
  if (options.cleanTargetFirst) {
    log('[MIGRATION SAFETY] cleanTargetFirst requested. Truncating target tables in reverse topological order...');
    const reverseOrder = [...TOPOLOGICAL_TABLES].reverse();
    for (const tbl of reverseOrder) {
      try {
        await d1.prepare(`DELETE FROM "${tbl}"`).run();
      } catch (err: any) {
        log(`[MIGRATION WARNING] Failed pre-truncating "${tbl}": ${err.message}`);
      }
    }
    log('[MIGRATION SAFETY] Target tables cleaned. Safe topological insertion will proceed.');
  }

  log(`[MIGRATION] Opening source SQLite database (read-only): ${sourceDbPath}`);
  const sqlite = new Database(sourceDbPath, { readonly: true });

  const result: MigrationResult = {
    success: true,
    totalTables: TOPOLOGICAL_TABLES.length,
    totalRecordsMigrated: 0,
    tableDetails: {},
    durationMs: 0,
  };

  try {
    for (const table of TOPOLOGICAL_TABLES) {
      log(`[MIGRATION] Processing table: "${table}"...`);

      // Read columns from SQLite
      const colInfo = sqlite.prepare(`PRAGMA table_info("${table}")`).all() as Array<{ name: string }>;
      if (!colInfo || colInfo.length === 0) {
        log(`[MIGRATION] Warning: Table "${table}" has no column info in source SQLite.`);
        result.tableDetails[table] = { count: 0, status: 'SUCCESS' };
        continue;
      }

      const columnNames = colInfo.map((c) => c.name);
      const quotedColumns = columnNames.map((c) => `"${c}"`).join(', ');
      const placeholders = columnNames.map(() => '?').join(', ');
      let insertVerb = 'INSERT OR REPLACE INTO';
      if (insertMode === 'INSERT_INTO') insertVerb = 'INSERT INTO';
      if (insertMode === 'INSERT_OR_IGNORE') insertVerb = 'INSERT OR IGNORE INTO';
      const insertSql = `${insertVerb} "${table}" (${quotedColumns}) VALUES (${placeholders})`;

      // Fetch all rows from source SQLite
      const rows = sqlite.prepare(`SELECT * FROM "${table}"`).all() as Array<Record<string, any>>;
      const tableRowCount = rows.length;

      if (tableRowCount === 0) {
        log(`[MIGRATION] Table "${table}" has 0 rows. Skipping insertion.`);
        result.tableDetails[table] = { count: 0, status: 'SUCCESS' };
        continue;
      }

      // Chunk rows into batches
      for (let i = 0; i < rows.length; i += batchSize) {
        const chunk = rows.slice(i, i + batchSize);
        const statements = chunk.map((row) => {
          const values = columnNames.map((col) => {
            const val = row[col];
            // SQLite may return Buffer for BLOBs, or null/undefined
            if (val === undefined) return null;
            return val;
          });
          return d1.prepare(insertSql).bind(...values);
        });

        try {
          await d1.batch(statements);
        } catch (batchErr: any) {
          const msg = `Failed batch for table "${table}" (offset ${i}): ${batchErr.message}`;
          log(`[MIGRATION ERROR] ${msg}`);
          result.tableDetails[table] = { count: i, status: 'FAILED', error: msg };
          result.success = false;
          throw new Error(msg);
        }
      }

      result.tableDetails[table] = { count: tableRowCount, status: 'SUCCESS' };
      result.totalRecordsMigrated += tableRowCount;
      log(`[MIGRATION] Successfully migrated ${tableRowCount} rows for "${table}".`);
    }

    result.durationMs = Date.now() - startTime;
    log(`[MIGRATION COMPLETE] Total records migrated: ${result.totalRecordsMigrated} across ${TOPOLOGICAL_TABLES.length} tables in ${result.durationMs}ms.`);
    return result;
  } finally {
    sqlite.close();
  }
}
