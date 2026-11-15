/**
 * STROOM Target Database Preflight Verification
 * Stage 3.3: Identity & Empty Slate Verification
 */

import { Pool } from 'pg';
import { maskConnectionString, parseDatabaseConfig } from '../server/db/postgresAdapter';

async function main() {
  const targetUrl = process.env.TARGET_DATABASE_URL || process.env.DATABASE_URL;

  console.log('================================================================');
  console.log('🛡️  STROOM PRODUCTION DATABASE PREFLIGHT VERIFICATION');
  console.log('================================================================');

  if (!targetUrl) {
    console.error('❌ FATAL: TARGET_DATABASE_URL is not set.');
    process.exit(1);
  }

  console.log(`Target URL : ${maskConnectionString(targetUrl)}`);

  // Guard against staging database
  if (targetUrl.includes('ep-ancient-water-bdpcn0w7')) {
    console.error('❌ SAFETY ABORT: Connection targets the Neon STAGING database (ep-ancient-water-bdpcn0w7). Refusing to proceed.');
    process.exit(1);
  }

  let pool: Pool | null = null;
  try {
    const config = parseDatabaseConfig(targetUrl, 2);
    pool = new Pool(config);

    const client = await pool.connect();
    try {
      const idRes = await client.query('SELECT current_database() as db, current_user as usr, version() as ver');
      const { db, usr, ver } = idRes.rows[0];
      console.log(`✅ Connected successfully to PostgreSQL.`);
      console.log(`   Database : ${db}`);
      console.log(`   User     : ${usr}`);
      console.log(`   Version  : ${ver.split(' ')[0]} ${ver.split(' ')[1]}`);

      if (db !== 'neondb') {
        console.warn(`⚠️ Warning: Expected database name 'neondb', got '${db}'`);
      }

      // Check existing public tables
      const tablesRes = await client.query(`
        SELECT count(*) as count 
        FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      `);
      const tableCount = parseInt(tablesRes.rows[0].count, 10);
      console.log(`   Public Tables Count: ${tableCount}`);

      if (tableCount > 0) {
        console.error(`❌ SAFETY ABORT: Target database is NOT empty (found ${tableCount} existing tables). Refusing to overwrite.`);
        process.exit(1);
      }

      console.log('✅ Gate 1 & 2 Passed: Target is valid, isolated, and completely empty.');
    } finally {
      client.release();
    }
  } catch (err: any) {
    console.error(`❌ Connection / verification failed: ${err.message}`);
    process.exit(1);
  } finally {
    if (pool) {
      await pool.end();
    }
  }
}

main();
