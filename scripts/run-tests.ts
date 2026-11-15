import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { spawnSync } from 'child_process';

const PRIMARY_DB = path.resolve(process.cwd(), 'data', 'stroom.db');
const BACKUP_DIR = path.resolve(process.cwd(), 'backups');

console.log('======================================================');
console.log('🛡️  STROOM SAFE TEST LAUNCHER (ISOLATED HARNESS)');
console.log('======================================================\n');

// 1. Verify primary database exists as reference seed
if (!fs.existsSync(PRIMARY_DB)) {
  console.error('[FATAL] Reference seed database does not exist at:', PRIMARY_DB);
  process.exit(1);
}

// 2. Generate unique disposable test database path
const testId = crypto.randomUUID().slice(0, 8);
const testDbName = `test_disposable_${Date.now()}_${testId}.db`;
const testDbPath = path.resolve(process.cwd(), 'data', testDbName);

console.log(`Creating disposable test database: ${testDbName}...`);
fs.copyFileSync(PRIMARY_DB, testDbPath);
if (fs.existsSync(PRIMARY_DB + '-wal')) {
  fs.copyFileSync(PRIMARY_DB + '-wal', testDbPath + '-wal');
}
if (fs.existsSync(PRIMARY_DB + '-shm')) {
  fs.copyFileSync(PRIMARY_DB + '-shm', testDbPath + '-shm');
}

let exitCode = 0;

try {
  console.log(`Setting process.env.DB_PATH = ${testDbPath}`);
  console.log(`Executing test suite...\n`);

  const tsxBin = path.resolve(
    process.cwd(),
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx'
  );

  const result = spawnSync(tsxBin, ['tests/run-all-tests.ts'], {
    cwd: process.cwd(),
    shell: true,
    env: {
      ...process.env,
      NODE_ENV: 'test',
      DB_PATH: testDbPath,
    },
    stdio: 'inherit',
  });

  exitCode = result.status ?? 1;
} catch (err: any) {
  console.error('[FATAL] Test runner error:', err.message);
  exitCode = 1;
} finally {
  console.log('\n======================================================');
  console.log('🧹 CLEANING UP DISPOSABLE TEST ARTIFACTS');
  console.log('======================================================');

  // Safely clean up only this disposable test database and its WAL files
  const filesToClean = [
    testDbPath,
    testDbPath + '-wal',
    testDbPath + '-shm',
  ];

  for (const f of filesToClean) {
    if (fs.existsSync(f)) {
      try {
        fs.unlinkSync(f);
        console.log(`Deleted: ${path.basename(f)}`);
      } catch (err: any) {
        console.warn(`[Warning] Failed to delete ${path.basename(f)}:`, err.message);
      }
    }
  }

  // Safety Assertion: Primary DB and Backups must never be deleted
  if (!fs.existsSync(PRIMARY_DB)) {
    console.error('[CRITICAL ALERT] Primary database is missing after test run!');
    process.exit(1);
  }

  console.log('Protected primary database verified intact at:', PRIMARY_DB);
  console.log('Test launcher completed with exit code:', exitCode);
}

process.exit(exitCode);
