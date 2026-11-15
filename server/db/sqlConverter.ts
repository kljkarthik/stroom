/**
 * STROOM SQL Dialect & Parameter Converter
 * Stage 3.2: SQLite -> PostgreSQL Query Translation Layer
 */

export interface SqlConversionResult {
  sql: string;
  parameterCount: number;
}

/**
 * Known primary keys for STROOM schema tables.
 * Used for automatic upsert / ON CONFLICT target resolution.
 */
const TABLE_PRIMARY_KEYS: Record<string, string> = {
  platform_settings: 'key',
  response_options: 'response_id, option_id',
  // All other 40 tables in STROOM use 'id' as primary key
};

/**
 * Convert positional SQLite query parameters ('?') to PostgreSQL numbered tokens ('$1', '$2', ...).
 * Ignores '?' occurrences inside single-quoted strings, double-quoted identifiers,
 * dollar-quoted blocks, or SQL comments.
 */
export function convertPlaceholders(sql: string, startParamIndex: number = 1): SqlConversionResult {
  let paramIndex = startParamIndex;
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let inLineComment = false;
  let inBlockComment = false;
  let inDollarQuote = false;
  let dollarTag = '';
  let result = '';

  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];
    const nextCh = i + 1 < sql.length ? sql[i + 1] : '';

    // Handle line comments: -- ...
    if (inLineComment) {
      result += ch;
      if (ch === '\n') {
        inLineComment = false;
      }
      continue;
    }

    // Handle block comments: /* ... */
    if (inBlockComment) {
      result += ch;
      if (ch === '*' && nextCh === '/') {
        result += nextCh;
        i++;
        inBlockComment = false;
      }
      continue;
    }

    // Handle single-quote literals: '...' (escaped as '')
    if (inSingleQuote) {
      result += ch;
      if (ch === "'") {
        if (nextCh === "'") {
          result += nextCh;
          i++; // Skip escaped quote
        } else {
          inSingleQuote = false;
        }
      }
      continue;
    }

    // Handle double-quote identifiers: "..."
    if (inDoubleQuote) {
      result += ch;
      if (ch === '"') {
        if (nextCh === '"') {
          result += nextCh;
          i++; // Skip escaped double quote
        } else {
          inDoubleQuote = false;
        }
      }
      continue;
    }

    // Handle dollar-quoted literals: $$...$$ or $tag$...$tag$
    if (inDollarQuote) {
      result += ch;
      if (ch === '$') {
        const remaining = sql.slice(i);
        if (remaining.startsWith(dollarTag)) {
          result += dollarTag.slice(1);
          i += dollarTag.length - 1;
          inDollarQuote = false;
          dollarTag = '';
        }
      }
      continue;
    }

    // Start comment checks
    if (ch === '-' && nextCh === '-') {
      inLineComment = true;
      result += '--';
      i++;
      continue;
    }
    if (ch === '/' && nextCh === '*') {
      inBlockComment = true;
      result += '/*';
      i++;
      continue;
    }

    // Start string literal checks
    if (ch === "'") {
      inSingleQuote = true;
      result += ch;
      continue;
    }
    if (ch === '"') {
      inDoubleQuote = true;
      result += ch;
      continue;
    }
    if (ch === '$' && nextCh === '$') {
      inDollarQuote = true;
      dollarTag = '$$';
      result += '$$';
      i++;
      continue;
    }

    // Parameter placeholder replacement outside strings and comments
    if (ch === '?') {
      result += `$${paramIndex}`;
      paramIndex++;
      continue;
    }

    result += ch;
  }

  return {
    sql: result,
    parameterCount: paramIndex - startParamIndex,
  };
}

/**
 * Convert SQLite dialect functions and syntax to standard PostgreSQL.
 */
export function convertDialectFunctions(sql: string): string {
  let converted = sql;

  // 1. Convert datetime('now', '-X days/hours/minutes/months')
  converted = converted.replace(
    /datetime\s*\(\s*'now'\s*,\s*'-(\d+)\s+([a-zA-Z]+)'\s*\)/gi,
    "(CURRENT_TIMESTAMP - INTERVAL '$1 $2')"
  );

  // 2. Convert datetime('now', '+X days/hours/minutes/months')
  converted = converted.replace(
    /datetime\s*\(\s*'now'\s*,\s*'\+(\d+)\s+([a-zA-Z]+)'\s*\)/gi,
    "(CURRENT_TIMESTAMP + INTERVAL '$1 $2')"
  );

  // 3. Convert datetime('now') -> CURRENT_TIMESTAMP
  converted = converted.replace(/datetime\s*\(\s*'now'\s*\)/gi, 'CURRENT_TIMESTAMP');

  // 4. Convert datetime(col) -> CAST(col AS TIMESTAMP)
  converted = converted.replace(/datetime\s*\(\s*([a-zA-Z0-9_.]+)\s*\)/gi, 'CAST($1 AS TIMESTAMP)');

  // 5. Convert strftime('%Y-%m', col) -> TO_CHAR(CAST(col AS TIMESTAMP), 'YYYY-MM')
  converted = converted.replace(
    /strftime\s*\(\s*'%Y-%m'\s*,\s*([a-zA-Z0-9_.]+)\s*\)/gi,
    "TO_CHAR(CAST($1 AS TIMESTAMP), 'YYYY-MM')"
  );

  // 6. Convert date(col) -> CAST(col AS DATE)
  converted = converted.replace(/date\s*\(\s*([a-zA-Z0-9_.]+)\s*\)/gi, 'CAST($1 AS DATE)');

  // 7. Convert INSERT OR IGNORE INTO table (...) VALUES (...)
  // PostgreSQL equivalent: INSERT INTO table (...) VALUES (...) ON CONFLICT DO NOTHING
  if (/^INSERT\s+OR\s+IGNORE\s+INTO\s+/i.test(converted.trim())) {
    converted = converted.trim().replace(/^INSERT\s+OR\s+IGNORE\s+INTO\s+/i, 'INSERT INTO ');
    if (!/ON\s+CONFLICT/i.test(converted)) {
      // If ends with semicolon, insert before semicolon
      if (converted.endsWith(';')) {
        converted = converted.slice(0, -1) + ' ON CONFLICT DO NOTHING;';
      } else {
        converted = converted + ' ON CONFLICT DO NOTHING';
      }
    }
  }

  // 8. Convert INSERT OR REPLACE INTO table (col1, col2, ...) VALUES (...)
  // PostgreSQL equivalent: INSERT INTO table (...) VALUES (...) ON CONFLICT (pk) DO UPDATE SET col2 = EXCLUDED.col2, ...
  const insertOrReplaceRegex = /^INSERT\s+OR\s+REPLACE\s+INTO\s+([a-zA-Z0-9_]+)\s*\(([^)]+)\)\s*VALUES\s*(.*)$/is;
  const matchReplace = converted.trim().match(insertOrReplaceRegex);
  if (matchReplace) {
    const tableName = matchReplace[1].toLowerCase();
    const columnsStr = matchReplace[2];
    const valuesRest = matchReplace[3];

    const columns = columnsStr.split(',').map((c) => c.trim().toLowerCase());
    const pkCol = TABLE_PRIMARY_KEYS[tableName] || 'id';
    const pkCols = pkCol.split(',').map((c) => c.trim().toLowerCase());

    const updateCols = columns.filter((col) => !pkCols.includes(col));
    const setClause = updateCols.map((col) => `${col} = EXCLUDED.${col}`).join(', ');

    let cleanValuesRest = valuesRest.trim();
    let hasSemicolon = false;
    if (cleanValuesRest.endsWith(';')) {
      hasSemicolon = true;
      cleanValuesRest = cleanValuesRest.slice(0, -1).trim();
    }

    converted = `INSERT INTO ${tableName} (${columnsStr}) VALUES ${cleanValuesRest} ON CONFLICT (${pkCol}) DO UPDATE SET ${setClause}${hasSemicolon ? ';' : ''}`;
  }

  return converted;
}

/**
 * Full query translation pipeline:
 * 1. Convert SQLite dialect functions and conflict clauses.
 * 2. Translate parameter placeholders '?' -> '$1, $2, ...'.
 */
export function convertSqlForPostgres(sql: string, startParamIndex: number = 1): SqlConversionResult {
  const dialectAdjusted = convertDialectFunctions(sql);
  return convertPlaceholders(dialectAdjusted, startParamIndex);
}
