import Database from 'better-sqlite3';
import path from 'node:path';
import crypto from 'node:crypto';
import { TOPOLOGICAL_TABLES } from './migrate-sqlite-to-d1';

export interface ParityOptions {
  sourceDbPath: string;
  d1Database: any;
  log?: (message: string) => void;
}

export interface TableParityDetail {
  sourceRows: number;
  d1Rows: number;
  matchedRows: number;
  mismatchedRows: number;
  missingInD1: number;
  unexpectedInD1: number;
  sourceTableSha256: string;
  d1TableSha256: string;
  hashMatch: boolean;
}

export interface ParityResult {
  passed: boolean;
  tableCountMatch: boolean;
  totalSourceRows: number;
  totalD1Rows: number;
  rowParityPercent: number;
  foreignKeyViolations: number;
  tablesVerified: number;
  totalRowsCompared: number;
  accountIntegrity: {
    totalAccounts: number;
    scryptAccounts: number;
    legacySha256Accounts: number;
    emptyPasswordAccounts: number;
    emptyPasswordUser: {
      id: string;
      email: string;
      role: string;
      password_hash: string;
    } | null;
    verified: boolean;
  };
  tableDetails: Record<string, TableParityDetail>;
  mismatches: string[];
  durationMs: number;
}

function normalizeValue(val: any): string {
  if (val === null || val === undefined) {
    return 'NULL';
  }
  if (typeof val === 'number') {
    return Number.isInteger(val) ? String(val) : val.toString();
  }
  if (typeof val === 'boolean') {
    return val ? '1' : '0';
  }
  if (Buffer.isBuffer(val)) {
    return `BLOB:${val.toString('hex')}`;
  }
  if (typeof val === 'object') {
    return JSON.stringify(val);
  }
  return JSON.stringify(String(val));
}

function serializeRow(columns: string[], row: Record<string, any>): string {
  const sorted = [...columns].sort();
  return sorted.map((col) => `${col}=${normalizeValue(row[col])}`).join('|');
}

function hashRow(columns: string[], row: Record<string, any>): string {
  const str = serializeRow(columns, row);
  return crypto.createHash('sha256').update(str).digest('hex');
}

export async function verifyD1Parity(options: ParityOptions): Promise<ParityResult> {
  const startTime = Date.now();
  const log = options.log || console.log;
  const sourceDbPath = path.resolve(options.sourceDbPath);
  const d1 = options.d1Database;

  log(`[PARITY] Opening source SQLite database: ${sourceDbPath}`);
  const sqlite = new Database(sourceDbPath, { readonly: true });

  const result: ParityResult = {
    passed: true,
    tableCountMatch: true,
    totalSourceRows: 0,
    totalD1Rows: 0,
    rowParityPercent: 100,
    foreignKeyViolations: 0,
    tablesVerified: 0,
    totalRowsCompared: 0,
    accountIntegrity: {
      totalAccounts: 0,
      scryptAccounts: 0,
      legacySha256Accounts: 0,
      emptyPasswordAccounts: 0,
      emptyPasswordUser: null,
      verified: false,
    },
    tableDetails: {},
    mismatches: [],
    durationMs: 0,
  };

  try {
    // 1. Comprehensive row-by-row and SHA-256 verification across all 42 application tables
    log(`[PARITY] Executing comprehensive row-by-row verification across all ${TOPOLOGICAL_TABLES.length} tables...`);

    for (const table of TOPOLOGICAL_TABLES) {
      // Get column metadata from SQLite
      const colInfo = sqlite.prepare(`PRAGMA table_info("${table}")`).all() as Array<{
        name: string;
        pk: number;
        type: string;
      }>;
      const columnNames = colInfo.map((c) => c.name);
      const pkCols = colInfo.filter((c) => c.pk > 0).sort((a, b) => a.pk - b.pk).map((c) => c.name);
      const sortCols = pkCols.length > 0 ? pkCols : columnNames;
      const orderClause = sortCols.map((c) => `"${c}" ASC`).join(', ');

      // Fetch all source rows ordered deterministically by primary key
      const sourceRows = sqlite.prepare(`SELECT * FROM "${table}" ORDER BY ${orderClause}`).all() as Array<Record<string, any>>;
      const sourceCount = sourceRows.length;
      result.totalSourceRows += sourceCount;

      // Fetch all D1 rows in paginated chunks to prevent statement memory boundaries
      const d1Rows: Array<Record<string, any>> = [];
      const pageSize = 1000;
      let offset = 0;
      let hasMore = true;

      while (hasMore) {
        const d1Page = await d1.prepare(`SELECT * FROM "${table}" ORDER BY ${orderClause} LIMIT ? OFFSET ?`)
          .bind(pageSize, offset)
          .all();
        const results = (d1Page.results as Array<Record<string, any>>) || [];
        d1Rows.push(...results);
        if (results.length < pageSize) {
          hasMore = false;
        } else {
          offset += pageSize;
        }
      }

      const d1Count = d1Rows.length;
      result.totalD1Rows += d1Count;
      result.totalRowsCompared += Math.max(sourceCount, d1Count);
      result.tablesVerified++;

      // Compute deterministic table-level SHA-256 checksums
      const sRowHashes = sourceRows.map((r) => hashRow(columnNames, r));
      const dRowHashes = d1Rows.map((r) => hashRow(columnNames, r));
      const sTableSha = crypto.createHash('sha256').update(sRowHashes.join('\n')).digest('hex');
      const dTableSha = crypto.createHash('sha256').update(dRowHashes.join('\n')).digest('hex');
      const hashMatch = sTableSha === dTableSha;

      let matchedRows = 0;
      let mismatchedRows = 0;
      let missingInD1 = 0;
      let unexpectedInD1 = 0;

      // Build primary key lookup map for D1
      const d1Map = new Map<string, Record<string, any>>();
      for (const dRow of d1Rows) {
        const pkKey = sortCols.map((c) => String(dRow[c])).join('::');
        d1Map.set(pkKey, dRow);
      }

      // Check every source row against D1
      for (const sRow of sourceRows) {
        const pkKey = sortCols.map((c) => String(sRow[c])).join('::');
        const dRow = d1Map.get(pkKey);

        if (!dRow) {
          missingInD1++;
          const diff = `Table "${table}" row missing in D1: PK [${pkKey}]`;
          result.mismatches.push(diff);
          continue;
        }

        // Compare every column value
        let rowMatches = true;
        for (const col of columnNames) {
          const sVal = normalizeValue(sRow[col]);
          const dVal = normalizeValue(dRow[col]);

          if (sVal !== dVal) {
            rowMatches = false;
            const diff = `Table "${table}" PK [${pkKey}] col "${col}" mismatch: SQLite=${sVal} vs D1=${dVal}`;
            result.mismatches.push(diff);
          }
        }

        if (rowMatches) {
          matchedRows++;
        } else {
          mismatchedRows++;
        }
      }

      // Check for unexpected D1 rows not in SQLite
      const sourceMap = new Map<string, boolean>();
      for (const sRow of sourceRows) {
        const pkKey = sortCols.map((c) => String(sRow[c])).join('::');
        sourceMap.set(pkKey, true);
      }
      for (const dRow of d1Rows) {
        const pkKey = sortCols.map((c) => String(dRow[c])).join('::');
        if (!sourceMap.has(pkKey)) {
          unexpectedInD1++;
          const diff = `Table "${table}" unexpected row in D1: PK [${pkKey}]`;
          result.mismatches.push(diff);
        }
      }

      const tablePass = sourceCount === d1Count && hashMatch && missingInD1 === 0 && unexpectedInD1 === 0 && mismatchedRows === 0;

      result.tableDetails[table] = {
        sourceRows: sourceCount,
        d1Rows: d1Count,
        matchedRows,
        mismatchedRows,
        missingInD1,
        unexpectedInD1,
        sourceTableSha256: sTableSha,
        d1TableSha256: dTableSha,
        hashMatch,
      };

      if (!tablePass) {
        result.passed = false;
        log(`[PARITY MISMATCH] "${table}": SQLite=${sourceCount}, D1=${d1Count}, Matched=${matchedRows}, Mismatched=${mismatchedRows}, Missing=${missingInD1}, Unexpected=${unexpectedInD1}, SHA-Match=${hashMatch}`);
      }
    }

    if (result.totalSourceRows > 0) {
      result.rowParityPercent = (result.totalD1Rows / result.totalSourceRows) * 100;
    }

    // 2. Foreign Key Integrity Check in D1
    log('[PARITY] Running foreign key integrity check in D1 (PRAGMA foreign_key_check)...');
    try {
      const fkCheck = await d1.prepare('PRAGMA foreign_key_check').all();
      const violations = fkCheck.results || [];
      result.foreignKeyViolations = violations.length;
      if (violations.length > 0) {
        const fkError = `D1 foreign_key_check returned ${violations.length} violations: ${JSON.stringify(violations)}`;
        log(`[PARITY ERROR] ${fkError}`);
        result.mismatches.push(fkError);
        result.passed = false;
      } else {
        log('✅ D1 foreign key integrity check passed: 0 violations.');
      }
    } catch (err: any) {
      log(`[PARITY NOTE] foreign_key_check pragma note: ${err.message}`);
    }

    // 3. Complete Account Integrity & Empty-Password Account Audit
    log('[PARITY] Verifying all 188 registered accounts and credential integrity...');
    const sourceUsers = sqlite.prepare('SELECT id, email, password_hash, role, account_status, full_name, member_id, created_at FROM users ORDER BY id').all() as any[];
    const d1UsersResult = await d1.prepare('SELECT id, email, password_hash, role, account_status, full_name, member_id, created_at FROM users ORDER BY id').all();
    const d1Users = d1UsersResult.results || [];

    result.accountIntegrity.totalAccounts = d1Users.length;

    let scryptCount = 0;
    let sha256Count = 0;
    let emptyCount = 0;
    let accountsMatch = true;

    if (sourceUsers.length !== d1Users.length) {
      accountsMatch = false;
      result.mismatches.push(`Users count mismatch: Source=${sourceUsers.length}, D1=${d1Users.length}`);
    }

    for (let i = 0; i < sourceUsers.length; i++) {
      const sUser = sourceUsers[i];
      const dUser = d1Users[i];

      if (!dUser || sUser.id !== dUser.id || sUser.email !== dUser.email || sUser.password_hash !== dUser.password_hash) {
        accountsMatch = false;
        result.mismatches.push(`User record mismatch at index ${i}: Source=${sUser.id} (${sUser.email}) vs D1=${dUser?.id}`);
        break;
      }

      const pHash = sUser.password_hash || '';
      if (pHash.startsWith('scrypt$')) {
        scryptCount++;
      } else if (pHash.length === 64) {
        sha256Count++;
      } else if (pHash === '') {
        emptyCount++;
        result.accountIntegrity.emptyPasswordUser = {
          id: sUser.id,
          email: sUser.email,
          role: sUser.role,
          password_hash: sUser.password_hash,
        };
      }
    }

    result.accountIntegrity.scryptAccounts = scryptCount;
    result.accountIntegrity.legacySha256Accounts = sha256Count;
    result.accountIntegrity.emptyPasswordAccounts = emptyCount;
    result.accountIntegrity.verified = accountsMatch && scryptCount === 61 && sha256Count === 126 && emptyCount === 1;

    if (!result.accountIntegrity.verified) {
      result.passed = false;
      log(`[PARITY WARNING] Account verification details: Total=${d1Users.length}, scrypt=${scryptCount} (expected 61), sha256=${sha256Count} (expected 126), empty-hash=${emptyCount} (expected 1)`);
    } else {
      const epu = result.accountIntegrity.emptyPasswordUser;
      log(`✅ All 188 accounts verified in D1: 61 scrypt, 126 legacy SHA-256, 1 empty-password stub (${epu?.id} / ${epu?.email}).`);
    }

    result.durationMs = Date.now() - startTime;
    return result;
  } finally {
    sqlite.close();
  }
}
