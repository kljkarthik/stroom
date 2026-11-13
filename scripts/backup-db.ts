import { db, initDatabase, createDatabaseBackup } from '../server/db/database';
import path from 'path';

async function runBackup() {
  initDatabase();
  const integrity = db.prepare('PRAGMA integrity_check').get() as { integrity_check: string };
  if (integrity?.integrity_check !== 'ok') {
    throw new Error(`Database integrity check failed before backup: ${JSON.stringify(integrity)}`);
  }

  const dest = await createDatabaseBackup();
  console.log(`[STROOM Backup] Integrity check: OK`);
  console.log(`[STROOM Backup] Saved atomic SQLite snapshot to: ${path.resolve(dest)}`);
}

runBackup().catch((err) => {
  console.error('[STROOM Backup Failed]', err);
  process.exit(1);
});
