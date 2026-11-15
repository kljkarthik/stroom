import { TOPOLOGICAL_TABLES } from './migrate-sqlite-to-d1';

export interface RollbackOptions {
  d1Database: any;
  dropSystemTables?: boolean; // When true, drops edge internal bridge nonces table; default true for full reset
  log?: (message: string) => void;
}

export interface RollbackResult {
  success: boolean;
  droppedApplicationTables: string[];
  droppedSystemTables: string[];
  droppedTables: string[]; // Union of all dropped tables (application + system)
  reappliedMigrations: boolean;
  durationMs: number;
}

export async function rollbackD1Migration(options: RollbackOptions): Promise<RollbackResult> {
  const startTime = Date.now();
  const log = options.log || console.log;
  const d1 = options.d1Database;
  const dropSystem = options.dropSystemTables !== false; // default true for full reset

  log('[ROLLBACK] Initiating Cloudflare D1 migration rollback...');
  const result: RollbackResult = {
    success: true,
    droppedApplicationTables: [],
    droppedSystemTables: [],
    droppedTables: [],
    reappliedMigrations: false,
    durationMs: 0,
  };

  try {
    // 1. Drop 42 Application Tables in reverse topological order (children first, parents last)
    const reverseOrder = [...TOPOLOGICAL_TABLES].reverse();

    for (const table of reverseOrder) {
      log(`[ROLLBACK] Dropping application table: "${table}"...`);
      try {
        await d1.prepare(`DROP TABLE IF EXISTS "${table}"`).run();
        result.droppedApplicationTables.push(table);
        result.droppedTables.push(table);
      } catch (err: any) {
        log(`[ROLLBACK WARNING] Error dropping "${table}": ${err.message}`);
      }
    }

    // 2. Drop Migration 0003 System Table (_internal_bridge_nonces) if full reset requested
    if (dropSystem) {
      log('[ROLLBACK] Dropping edge system table: "_internal_bridge_nonces"...');
      try {
        await d1.prepare('DROP TABLE IF EXISTS _internal_bridge_nonces').run();
        result.droppedSystemTables.push('_internal_bridge_nonces');
        result.droppedTables.push('_internal_bridge_nonces');
      } catch (err: any) {
        log(`[ROLLBACK WARNING] Error dropping "_internal_bridge_nonces": ${err.message}`);
      }
    } else {
      log('[ROLLBACK NOTE] Preserving edge system table "_internal_bridge_nonces" (dropSystemTables: false).');
    }

    // Safety check: Never drop SQLite internal (sqlite_*) or Cloudflare runtime (_cf_*) metadata tables
    result.durationMs = Date.now() - startTime;
    log(`[ROLLBACK COMPLETE] Dropped ${result.droppedApplicationTables.length} application tables + ${result.droppedSystemTables.length} system tables (${result.droppedTables.length} total) in ${result.durationMs}ms.`);
    return result;
  } catch (err: any) {
    result.success = false;
    log(`[ROLLBACK FAILED] Error during rollback: ${err.message}`);
    throw err;
  }
}
