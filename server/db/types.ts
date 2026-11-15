/**
 * STROOM Database Abstraction Layer Types
 * Stage 3.2: Dual-Driver Architecture (SQLite / PostgreSQL)
 */

export type DatabaseDriver = 'sqlite' | 'postgres';

export interface QueryResult<T = any> {
  rows: T[];
  rowCount: number;
}

export interface RunResult {
  changes: number;
  lastInsertRowid?: number | string | bigint;
}

export interface IPreparedStatement {
  /** Execute query expecting 0 or 1 row */
  get<T = any>(...params: any[]): Promise<T | undefined>;
  /** Execute query expecting 0 or more rows */
  all<T = any>(...params: any[]): Promise<T[]>;
  /** Execute INSERT/UPDATE/DELETE expecting affected rows count */
  run(...params: any[]): Promise<RunResult>;
}

export interface IDatabaseAdapter {
  readonly driver: DatabaseDriver;

  /** Execute a query and return array of rows */
  query<T = any>(sql: string, params?: any[]): Promise<T[]>;

  /** Execute a query and return a single row or undefined */
  queryOne<T = any>(sql: string, params?: any[]): Promise<T | undefined>;

  /** Execute an INSERT/UPDATE/DELETE statement and return row count */
  execute(sql: string, params?: any[]): Promise<RunResult>;

  /** Prepare a query for execution */
  prepare(sql: string): IPreparedStatement;

  /** Execute a unit of work inside an ACID transaction */
  transaction<T>(callback: (tx: IDatabaseAdapter) => Promise<T>): Promise<T>;

  /** Health check / ping connection to database */
  ping(): Promise<boolean>;

  /** Close connection pool or database handle */
  close(): Promise<void>;
}
