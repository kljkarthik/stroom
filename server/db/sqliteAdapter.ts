/**
 * STROOM SQLite Database Adapter
 * Stage 3.2: Promise-wrapped adapter for better-sqlite3
 */

import Database, { Database as DatabaseType, Statement } from 'better-sqlite3';
import { IDatabaseAdapter, IPreparedStatement, RunResult } from './types';

class SqlitePreparedStatement implements IPreparedStatement {
  private stmt: Statement;

  constructor(stmt: Statement) {
    this.stmt = stmt;
  }

  async get<T = any>(...params: any[]): Promise<T | undefined> {
    const flatParams = params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
    return this.stmt.get(...flatParams) as T | undefined;
  }

  async all<T = any>(...params: any[]): Promise<T[]> {
    const flatParams = params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
    return this.stmt.all(...flatParams) as T[];
  }

  async run(...params: any[]): Promise<RunResult> {
    const flatParams = params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
    const info = this.stmt.run(...flatParams);
    return {
      changes: info.changes,
      lastInsertRowid: info.lastInsertRowid,
    };
  }
}

class SqliteTransactionAdapter implements IDatabaseAdapter {
  readonly driver = 'sqlite' as const;

  constructor(private db: DatabaseType) {}

  async query<T = any>(sql: string, params?: any[]): Promise<T[]> {
    return this.prepare(sql).all<T>(...(params || []));
  }

  async queryOne<T = any>(sql: string, params?: any[]): Promise<T | undefined> {
    return this.prepare(sql).get<T>(...(params || []));
  }

  async execute(sql: string, params?: any[]): Promise<RunResult> {
    return this.prepare(sql).run(...(params || []));
  }

  prepare(sql: string): IPreparedStatement {
    return new SqlitePreparedStatement(this.db.prepare(sql));
  }

  async transaction<T>(callback: (tx: IDatabaseAdapter) => Promise<T>): Promise<T> {
    const savepoint = `sp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    this.db.exec(`SAVEPOINT ${savepoint}`);
    try {
      const result = await callback(this);
      this.db.exec(`RELEASE SAVEPOINT ${savepoint}`);
      return result;
    } catch (err) {
      try {
        this.db.exec(`ROLLBACK TO SAVEPOINT ${savepoint}`);
      } catch {
        // Suppress rollback error
      }
      throw err;
    }
  }

  async ping(): Promise<boolean> {
    try {
      const row = this.db.prepare('SELECT 1 as ping').get() as { ping: number } | undefined;
      return row?.ping === 1;
    } catch {
      return false;
    }
  }

  async close(): Promise<void> {
    // Nested transaction adapter does not close connection
  }
}

export class SqliteAdapter implements IDatabaseAdapter {
  readonly driver = 'sqlite' as const;
  private db: DatabaseType;
  private shouldCloseOnDispose: boolean;
  private isClosed = false;
  private txMutex: Promise<void> = Promise.resolve();

  constructor(dbOrPath: DatabaseType | string) {
    if (typeof dbOrPath === 'string') {
      this.db = new Database(dbOrPath);
      this.db.pragma('journal_mode = WAL');
      this.db.pragma('busy_timeout = 5000');
      this.db.pragma('foreign_keys = ON');
      this.shouldCloseOnDispose = true;
    } else {
      this.db = dbOrPath;
      this.shouldCloseOnDispose = false;
    }
  }

  /**
   * Access the underlying better-sqlite3 database instance directly if required.
   */
  get rawDatabase(): DatabaseType {
    return this.db;
  }

  async query<T = any>(sql: string, params?: any[]): Promise<T[]> {
    return this.prepare(sql).all<T>(...(params || []));
  }

  async queryOne<T = any>(sql: string, params?: any[]): Promise<T | undefined> {
    return this.prepare(sql).get<T>(...(params || []));
  }

  async execute(sql: string, params?: any[]): Promise<RunResult> {
    return this.prepare(sql).run(...(params || []));
  }

  prepare(sql: string): IPreparedStatement {
    const stmt = this.db.prepare(sql);
    return new SqlitePreparedStatement(stmt);
  }

  /**
   * Execute an asynchronous transaction using SQLite BEGIN IMMEDIATE and COMMIT/ROLLBACK.
   * Serializes top-level transactions across concurrent async requests.
   * Supports nested transactions via SAVEPOINT inside SqliteTransactionAdapter.
   */
  async transaction<T>(callback: (tx: IDatabaseAdapter) => Promise<T>): Promise<T> {
    let releaseMutex: () => void;
    const nextMutex = new Promise<void>((resolve) => {
      releaseMutex = resolve;
    });

    const prevMutex = this.txMutex;
    this.txMutex = this.txMutex.then(() => nextMutex, () => nextMutex);

    await prevMutex;

    try {
      this.db.exec('BEGIN IMMEDIATE');
      const txAdapter = new SqliteTransactionAdapter(this.db);
      try {
        const result = await callback(txAdapter);
        this.db.exec('COMMIT');
        return result;
      } catch (err) {
        try {
          this.db.exec('ROLLBACK');
        } catch {
          // Suppress rollback error
        }
        throw err;
      }
    } finally {
      releaseMutex!();
    }
  }

  /**
   * Health check / ping connection to database.
   */
  async ping(): Promise<boolean> {
    try {
      const row = this.db.prepare('SELECT 1 as ping').get() as { ping: number } | undefined;
      return row?.ping === 1;
    } catch {
      return false;
    }
  }

  async close(): Promise<void> {
    if (!this.isClosed) {
      this.isClosed = true;
      if (this.shouldCloseOnDispose) {
        this.db.close();
      }
    }
  }
}
