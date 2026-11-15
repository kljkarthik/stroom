/**
 * STROOM Unified Database Adapter Factory
 * Stage 3.2: Dual-driver abstraction layer (defaulting to SQLite)
 */

import { IDatabaseAdapter, DatabaseDriver } from './types';
import { SqliteAdapter } from './sqliteAdapter';
import { PostgresAdapter } from './postgresAdapter';
import { db } from './database';

export * from './types';
export * from './sqlConverter';
export * from './sqliteAdapter';
export * from './postgresAdapter';

let globalAdapterInstance: IDatabaseAdapter | null = null;

/**
 * Returns the currently active database driver based on environment.
 * Strictly defaults to 'sqlite' unless DATABASE_DRIVER is explicitly 'postgres'.
 */
export function getActiveDriver(): DatabaseDriver {
  const driverEnv = (process.env.DATABASE_DRIVER || 'sqlite').toLowerCase().trim();
  if (driverEnv === 'postgres' || driverEnv === 'postgresql') {
    return 'postgres';
  }
  return 'sqlite';
}

/**
 * Factory function to create an isolated database adapter.
 * Useful for tests, migrations, and background workers.
 */
export function createDatabaseAdapter(
  driver: DatabaseDriver = getActiveDriver(),
  config?: any
): IDatabaseAdapter {
  if (driver === 'postgres') {
    const connectionString =
      (typeof config === 'string' ? config : config?.connectionString) ||
      process.env.DATABASE_URL ||
      process.env.TARGET_DATABASE_URL;

    if (!connectionString) {
      throw new Error(
        'PostgreSQL driver requested but DATABASE_URL is not set in environment or config'
      );
    }
    return new PostgresAdapter(typeof config === 'object' && !('connectionString' in config) ? config : connectionString);
  }

  // SQLite driver
  if (config) {
    return new SqliteAdapter(config);
  }
  return new SqliteAdapter(db);
}

/**
 * Get or initialize the global database adapter singleton.
 * Safe for use across Express route handlers.
 */
export function getDatabaseAdapter(): IDatabaseAdapter {
  if (!globalAdapterInstance) {
    const driver = getActiveDriver();
    if (driver === 'postgres') {
      const url = process.env.DATABASE_URL || process.env.TARGET_DATABASE_URL;
      if (!url) {
        console.warn(
          '[DB_ADAPTER] Warning: DATABASE_DRIVER=postgres but DATABASE_URL is missing. Falling back to SQLite.'
        );
        globalAdapterInstance = new SqliteAdapter(db);
      } else {
        globalAdapterInstance = new PostgresAdapter(url);
      }
    } else {
      globalAdapterInstance = new SqliteAdapter(db);
    }
  }
  return globalAdapterInstance;
}

/**
 * Set or override the global database adapter singleton (useful for isolated tests).
 */
export function setDatabaseAdapter(adapter: IDatabaseAdapter | null): void {
  globalAdapterInstance = adapter;
}

/**
 * Reset the global adapter singleton (primarily for testing purposes).
 */
export async function resetDatabaseAdapter(): Promise<void> {
  if (globalAdapterInstance) {
    await globalAdapterInstance.close();
    globalAdapterInstance = null;
  }
}
