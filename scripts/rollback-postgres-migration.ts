/**
 * STROOM PostgreSQL Migration Rollback Tool
 * Stage 3.2: Reverse topological teardown for PostgreSQL target database
 *
 * Safety:
 * - Operates EXCLUSIVELY on target PostgreSQL database.
 * - Leaves SQLite primary database completely untouched.
 * - Drops tables in reverse topological order (Level 8 down to Level 1).
 * - Requires explicit confirmation flag (--confirm).
 */

import { Pool } from 'pg';
import { TOPOLOGICAL_TABLES } from './migrate-sqlite-to-postgres';
import { maskConnectionString, parseDatabaseConfig } from '../server/db/postgresAdapter';

export async function rollbackPostgres(postgresUrl?: string, confirm: boolean = false): Promise<void> {
  const targetUrl = postgresUrl || process.env.TARGET_DATABASE_URL || process.env.DATABASE_URL;

  console.log('================================================================');
  console.log('⚠️  STROOM POSTGRESQL MIGRATION ROLLBACK TOOL');
  console.log('================================================================');
  console.log(`Target Database: ${targetUrl ? maskConnectionString(targetUrl) : '[NONE]'}`);
  console.log(`Confirmed      : ${confirm ? 'YES (--confirm provided)' : 'NO (DRY-RUN ONLY)'}`);
  console.log('----------------------------------------------------------------\n');

  const reverseTables = [...TOPOLOGICAL_TABLES].reverse();

  if (!confirm) {
    console.log('[DRY-RUN] Rollback plan (Reverse Topological Teardown):');
    reverseTables.forEach((table, idx) => {
      console.log(`  ${String(idx + 1).padStart(2)}. DROP TABLE IF EXISTS "${table}" CASCADE;`);
    });
    console.log('\n[INFO] To execute actual teardown, provide connection URL and pass --confirm to CLI.');
    return;
  }

  if (!targetUrl) {
    throw new Error('Target PostgreSQL connection string is required for live rollback execution.');
  }

  const pool = new Pool(parseDatabaseConfig(targetUrl, 2));

  const client = await pool.connect();
  try {
    for (const table of reverseTables) {
      console.log(`Dropping table: "${table}" CASCADE...`);
      await client.query(`DROP TABLE IF EXISTS "${table}" CASCADE;`);
    }
    console.log('\n✅ Rollback completed successfully. All 42 tables removed from PostgreSQL target.');
  } finally {
    client.release();
    await pool.end();
  }
}

if (require.main === module) {
  const confirm = process.argv.includes('--confirm');
  const targetUrl = process.env.TARGET_DATABASE_URL || process.env.DATABASE_URL;
  rollbackPostgres(targetUrl, confirm)
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[FATAL] Rollback failed:', err.message);
      process.exit(1);
    });
}
