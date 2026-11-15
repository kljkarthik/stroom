import { D1Database, D1PreparedStatement, D1Result } from '@cloudflare/workers-types';

export interface D1QueryResult<T> {
  results: T[];
  success: boolean;
  meta: any;
}

export class D1Client {
  private db: D1Database;

  constructor(db: D1Database) {
    if (!db) {
      throw new Error(
        '[STROOM D1 Safety] Database binding "DB" is not configured or undefined. Strict fallback prevention: connection to physical SQLite files is prohibited.'
      );
    }
    this.db = db;
  }

  /**
   * Prepares a SQL statement with parameterized bindings.
   * STRICT SAFETY: Enforces parameter binding; rejects undefined bindings.
   */
  prepare(query: string, ...params: any[]): D1PreparedStatement {
    const stmt = this.db.prepare(query);
    if (params.length > 0) {
      return stmt.bind(...params);
    }
    return stmt;
  }

  /**
   * Executes a read query returning the first matching row, or null if empty.
   */
  async first<T = Record<string, any>>(query: string, ...params: any[]): Promise<T | null> {
    try {
      const stmt = this.prepare(query, ...params);
      const row = await stmt.first<T>();
      return row ?? null;
    } catch (err: any) {
      this.handleError('first', err);
    }
  }

  /**
   * Executes a read query returning all matching rows.
   */
  async all<T = Record<string, any>>(query: string, ...params: any[]): Promise<T[]> {
    try {
      const stmt = this.prepare(query, ...params);
      const res = await stmt.all<T>();
      return (res.results as T[]) ?? [];
    } catch (err: any) {
      this.handleError('all', err);
    }
  }

  /**
   * Executes a write or mutation statement (INSERT, UPDATE, DELETE).
   */
  async run(query: string, ...params: any[]): Promise<D1Result> {
    try {
      const stmt = this.prepare(query, ...params);
      return await stmt.run();
    } catch (err: any) {
      this.handleError('run', err);
    }
  }

  /**
   * Executes an atomic batch of prepared statements in a single transaction.
   */
  async batch<T = any>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]> {
    if (!statements || statements.length === 0) {
      return [];
    }
    if (statements.length > 50) {
      throw new Error('[STROOM D1 Safety] D1 batch limit exceeded: maximum 50 statements allowed per batch.');
    }
    try {
      return await this.db.batch<T>(statements);
    } catch (err: any) {
      this.handleError('batch', err);
    }
  }

  /**
   * Safe read-only health probe query.
   */
  async probeHealth(): Promise<{ ok: boolean; timestamp: string }> {
    try {
      const res = await this.db.prepare("SELECT 1 as probe, datetime('now') as ts").first<{ probe: number; ts: string }>();
      return {
        ok: res?.probe === 1,
        timestamp: res?.ts || new Date().toISOString(),
      };
    } catch {
      return {
        ok: false,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Retrieves the count of application tables in D1 (excluding SQLite internal and migration tables).
   */
  async getApplicationTableCount(): Promise<number> {
    try {
      const res = await this.db
        .prepare(
          "SELECT count(*) as count FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' AND name NOT LIKE '_internal_%' AND name != 'd1_migrations'"
        )
        .first<{ count: number }>();
      return Number(res?.count ?? 0);
    } catch {
      return 0;
    }
  }

  /**
   * Sanitized error handling preventing internal path or credential leakage.
   */
  private handleError(operation: string, error: any): never {
    const rawMessage = error?.message || 'Database error occurred';
    const sanitized = rawMessage.replace(/[a-zA-Z]:\\[^ \n\r\t]+/g, '[REDACTED_PATH]');
    throw new Error(`[D1 Operation Error: ${operation}] ${sanitized}`);
  }
}

export function createD1Client(db: D1Database): D1Client {
  return new D1Client(db);
}
