/* The gate every model-written query passes before ClickHouse sees it.
   One SELECT, over the raw tables only, on one chain, capped in rows.
   The guard is the safety boundary; the prompt is only advice. */

export const ALLOWED_TABLES = ["raw_blocks", "raw_txs", "raw_logs", "raw_traces"] as const;
export type AllowedTable = (typeof ALLOWED_TABLES)[number];

/** the most rows one answer may carry back to the browser */
export const MAX_ROWS = 2000;

const KEYWORDS = /\b(INSERT|UPDATE|DELETE|ALTER|DROP|CREATE|TRUNCATE|ATTACH|DETACH|OPTIMIZE|SYSTEM|KILL|GRANT|REVOKE|RENAME|EXCHANGE|USE|OUTFILE|SET|SETTINGS|FORMAT)\b/i;
/** table functions that read outside the database or spawn work */
const TABLE_FUNCTIONS = /\b(url|file|remote|remoteSecure|s3|s3Cluster|hdfs|azureBlobStorage|mysql|postgresql|sqlite|mongodb|redis|jdbc|odbc|executable|input|merge|cluster|clusterAllReplicas|dictionary|view|values|format|fileCluster|urlCluster|deltaLake|iceberg|hudi)\s*\(/i;

export type GuardResult = { ok: true; sql: string; tables: AllowedTable[] } | { ok: false; error: string };

export function guardSql(raw: string, chainId: number): GuardResult {
  let sql = String(raw ?? "").trim().replace(/;+\s*$/, "").trim();
  if (!sql) return { ok: false, error: "empty query" };
  if (sql.length > 6000) return { ok: false, error: "query too long (6000 chars max)" };
  if (sql.includes(";")) return { ok: false, error: "one statement only; no semicolons" };
  if (/--|\/\*|\*\//.test(sql)) return { ok: false, error: "no comments in the query" };
  if (!/^(SELECT|WITH)\b/i.test(sql)) return { ok: false, error: "the query must start with SELECT or WITH" };
  const kw = sql.match(KEYWORDS);
  if (kw) return { ok: false, error: `${kw[1].toUpperCase()} is not allowed; write a plain SELECT (the server sets FORMAT and settings)` };
  const fn = sql.match(TABLE_FUNCTIONS);
  if (fn) return { ok: false, error: `table function ${fn[1]}() is not allowed` };
  if (/\bsystem\b/i.test(sql) || /\binformation_schema\b/i.test(sql)) return { ok: false, error: "system tables are not readable here" };

  // every table read must be one of the raw tables
  const tables = new Set<AllowedTable>();
  const refs = sql.matchAll(/\b(?:FROM|JOIN)\s+(?!\()([`"]?)([A-Za-z_][\w.]*)\1/gi);
  for (const m of refs) {
    const ident = m[2].replace(/^default\./i, "");
    if (!(ALLOWED_TABLES as readonly string[]).includes(ident)) {
      return { ok: false, error: `table ${m[2]} is not readable here; use ${ALLOWED_TABLES.join(", ")}` };
    }
    tables.add(ident as AllowedTable);
  }
  if (tables.size === 0) return { ok: false, error: `the query reads no table; use ${ALLOWED_TABLES.join(", ")}` };

  // one chain: the sort keys start with chain_id, so this is also what
  // keeps a query from scanning every chain in the partition
  const chainRe = new RegExp(`\\bchain_id\\s*(=|==)\\s*${chainId}\\b`);
  if (!chainRe.test(sql)) return { ok: false, error: `filter every table on chain_id = ${chainId}` };
  const otherChain = sql.match(/\bchain_id\s*(=|==)\s*(\d+)/g)?.find((s) => !new RegExp(`\\b${chainId}\\b`).test(s));
  if (otherChain) return { ok: false, error: `only chain_id = ${chainId} is readable on this page` };

  // rows: cap what comes back
  const lim = sql.match(/\bLIMIT\s+(\d+)(?:\s*,\s*(\d+))?/i);
  if (!lim) sql = `${sql}\nLIMIT ${MAX_ROWS}`;
  else {
    const n = Number(lim[2] ?? lim[1]);
    if (n > MAX_ROWS) return { ok: false, error: `LIMIT at most ${MAX_ROWS}; aggregate further or narrow the window` };
  }
  return { ok: true, sql, tables: [...tables] };
}
