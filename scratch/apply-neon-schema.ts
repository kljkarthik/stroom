import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';
import { parseDatabaseConfig } from '../server/db/postgresAdapter';

const targetUrl = process.env.TARGET_DATABASE_URL;
if (!targetUrl) {
  console.error('[FATAL] TARGET_DATABASE_URL environment variable is required');
  process.exit(1);
}

async function main() {
  console.log('================================================================');
  console.log('🛠️  APPLYING POSTGRESQL DDL SCHEMA TO NEON STAGING DATABASE');
  console.log('================================================================');

  const pool = new Pool(parseDatabaseConfig(targetUrl, 2));

  try {
    const client = await pool.connect();
    console.log('Connected to Neon successfully.');

    const ddlPath = path.resolve(process.cwd(), 'migrations', 'postgres', '0001_postgres_schema.sql');
    const ddlSql = fs.readFileSync(ddlPath, 'utf8');

    console.log(`Executing DDL from: ${ddlPath} (${ddlSql.length} bytes)...`);
    await client.query(ddlSql);
    console.log('✅ DDL execution completed.');

    // Verify 42 tables
    const tablesRes = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `);

    console.log(`\nVerified Tables Created: ${tablesRes.rows.length} / 42 expected.`);
    tablesRes.rows.forEach((r, idx) => {
      console.log(`  ${String(idx + 1).padStart(2)}. ${r.table_name}`);
    });

    // Verify indexes
    const indexesRes = await client.query(`
      SELECT indexname, tablename 
      FROM pg_indexes 
      WHERE schemaname = 'public' AND indexname NOT LIKE '%_pkey'
      ORDER BY tablename, indexname;
    `);
    console.log(`\nVerified Explicit Indexes: ${indexesRes.rows.length} (at least 33 expected).`);

    // Verify currency precision
    const colsRes = await client.query(`
      SELECT table_name, column_name, data_type, numeric_precision, numeric_scale
      FROM information_schema.columns
      WHERE table_schema = 'public' 
        AND column_name IN ('order_amount', 'min_purchase', 'amount', 'refund_amount')
      ORDER BY table_name, column_name;
    `);
    console.log('\nVerified Currency Columns:');
    colsRes.rows.forEach(c => {
      console.log(`  - ${c.table_name}.${c.column_name}: ${c.data_type}(${c.numeric_precision}, ${c.numeric_scale})`);
    });

    client.release();
  } finally {
    await pool.end();
  }
}

main().catch(err => {
  console.error('[FATAL] Failed applying schema:', err.message);
  process.exit(1);
});
