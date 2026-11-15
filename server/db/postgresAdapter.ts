/**
 * STROOM PostgreSQL Database Adapter
 * Stage 3.2: Production-grade asynchronous PostgreSQL client wrapper
 */

import { Pool, PoolClient, PoolConfig } from 'pg';
import { IDatabaseAdapter, IPreparedStatement, RunResult } from './types';
import { convertSqlForPostgres } from './sqlConverter';

const CONNECTION_MASK_REGEX = /(postgres(?:ql)?:\/\/[^:\/\s]+:)(.*)(@[^:\/\s]+(?::\d+)?(?:\/|\?|\s|$))/gi;

/**
 * Mask sensitive passwords in PostgreSQL connection strings for safe logging and error reporting.
 */
export function maskConnectionString(url: string): string {
  try {
    return url.replace(CONNECTION_MASK_REGEX, '$1***$3');
  } catch {
    return '[REDACTED_CONNECTION_STRING]';
  }
}

/**
 * Sanitize error message to prevent credential or host leaks.
 */
export function sanitizeDatabaseError(error: any): Error {
  if (!error || typeof error.message !== 'string') {
    return new Error('Unknown database error occurred');
  }
  const sanitizedMessage = error.message.replace(CONNECTION_MASK_REGEX, '$1***$3');
  const sanitized = new Error(sanitizedMessage);
  if (error.code) {
    (sanitized as any).code = error.code;
  }
  if (error.detail) {
    (sanitized as any).detail = error.detail.replace(CONNECTION_MASK_REGEX, '$1***$3');
  }
  return sanitized;
}

/**
 * Common query executor interface matching pg.Pool and pg.PoolClient.
 */
interface Queryable {
  query(queryTextOrConfig: any, values?: any[]): Promise<any>;
}

/**
 * Prepared statement implementation for PostgreSQL queries.
 */
class PostgresPreparedStatement implements IPreparedStatement {
  constructor(
    private client: Queryable,
    private rawSql: string
  ) {}

  async get<T = any>(...params: any[]): Promise<T | undefined> {
    const flatParams = params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
    const { sql } = convertSqlForPostgres(this.rawSql);
    try {
      const res = await this.client.query(sql, flatParams);
      return res.rows[0] as T | undefined;
    } catch (err) {
      throw sanitizeDatabaseError(err);
    }
  }

  async all<T = any>(...params: any[]): Promise<T[]> {
    const flatParams = params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
    const { sql } = convertSqlForPostgres(this.rawSql);
    try {
      const res = await this.client.query(sql, flatParams);
      return res.rows as T[];
    } catch (err) {
      throw sanitizeDatabaseError(err);
    }
  }

  async run(...params: any[]): Promise<RunResult> {
    const flatParams = params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
    const { sql } = convertSqlForPostgres(this.rawSql);
    try {
      const res = await this.client.query(sql, flatParams);
      return {
        changes: res.rowCount ?? 0,
        lastInsertRowid: undefined,
      };
    } catch (err) {
      throw sanitizeDatabaseError(err);
    }
  }
}

/**
 * Transaction-scoped PostgreSQL adapter running within an active client checkout.
 */
class PostgresTransactionAdapter implements IDatabaseAdapter {
  readonly driver = 'postgres' as const;

  constructor(private client: PoolClient) {}

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
    return new PostgresPreparedStatement(this.client, sql);
  }

  async transaction<T>(callback: (tx: IDatabaseAdapter) => Promise<T>): Promise<T> {
    // Nested transaction support using SAVEPOINT
    const savepointId = `sp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    await this.client.query(`SAVEPOINT ${savepointId}`);
    try {
      const result = await callback(this);
      await this.client.query(`RELEASE SAVEPOINT ${savepointId}`);
      return result;
    } catch (err) {
      try {
        await this.client.query(`ROLLBACK TO SAVEPOINT ${savepointId}`);
      } catch {
        // Suppress rollback errors to rethrow root error
      }
      throw sanitizeDatabaseError(err);
    }
  }

  async ping(): Promise<boolean> {
    try {
      const res = await this.client.query('SELECT 1 as ping');
      return res.rows[0]?.ping === 1;
    } catch {
      return false;
    }
  }

  async close(): Promise<void> {
    // Transaction adapter does not close pool connection; managed by parent
  }
}

/**
 * Parse and configure PostgreSQL pool settings with safe cloud endpoint SNI negotiation.
 */
export function parseDatabaseConfig(configOrUrl: string | PoolConfig, max: number = 20): PoolConfig {
  if (typeof configOrUrl !== 'string') {
    return { max, ...configOrUrl };
  }

  try {
    const url = new URL(configOrUrl);
    const isLocal = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
    let host = url.hostname;
    // Fallback IP resolution for newer AWS Neon clusters where OS local DNS cache may lag
    if (url.hostname.includes('c-8.us-east-2.aws.neon.tech')) {
      host = '3.142.41.151';
    }

    return {
      host,
      port: Number(url.port) || 5432,
      user: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
      database: url.pathname.replace(/^\//, ''),
      ssl: isLocal
        ? false
        : {
            servername: url.hostname,
            rejectUnauthorized: false,
          },
      max,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    };
  } catch {
    const isSslRequired = !configOrUrl.includes('localhost') && !configOrUrl.includes('127.0.0.1');
    return {
      connectionString: configOrUrl,
      ssl: isSslRequired ? { rejectUnauthorized: false } : false,
      max,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    };
  }
}

/**
 * Primary PostgreSQL Database Adapter.
 * Manages connection pooling, automated parameter conversion, and async transactions.
 */
export class PostgresAdapter implements IDatabaseAdapter {
  readonly driver = 'postgres' as const;
  private pool: Pool;
  private isClosed = false;

  constructor(configOrPool?: string | PoolConfig | Pool) {
    if (configOrPool instanceof Pool) {
      this.pool = configOrPool;
    } else if (configOrPool) {
      this.pool = new Pool(parseDatabaseConfig(configOrPool, 20));
    } else {
      this.pool = new Pool({
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
      });
    }
  }

  /**
   * Health check / ping connection to database.
   */
  async ping(): Promise<boolean> {
    try {
      const res = await this.pool.query('SELECT 1 as ping');
      return res.rows[0]?.ping === 1;
    } catch {
      return false;
    }
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
    return new PostgresPreparedStatement(this.pool, sql);
  }

  /**
   * Execute an asynchronous transaction on a dedicated checked-out client.
   * Guarantees client checkout release back to the pool in all outcomes.
   */
  async transaction<T>(callback: (tx: IDatabaseAdapter) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const txAdapter = new PostgresTransactionAdapter(client);
      const result = await callback(txAdapter);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      try {
        await client.query('ROLLBACK');
      } catch {
        // Suppress rollback errors to preserve primary failure
      }
      throw sanitizeDatabaseError(err);
    } finally {
      client.release();
    }
  }

  async close(): Promise<void> {
    if (!this.isClosed) {
      this.isClosed = true;
      await this.pool.end();
    }
  }
}
