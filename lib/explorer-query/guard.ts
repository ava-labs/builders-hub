/* The gate every model-written query passes before ClickHouse sees it.
   One SELECT, over the raw tables only, on one chain, capped in rows.
   The guard is the safety boundary; the prompt is only advice. */

import { EVM_TABLES, targetOf } from "./target";

/** the EVM chains' tables; each target carries its own list (target.ts) */
export const ALLOWED_TABLES = EVM_TABLES;
export type AllowedTable = string;

/** the most rows one answer may carry back to the browser */
export const MAX_ROWS = 2000;

const KEYWORDS = /\b(INSERT|UPDATE|DELETE|ALTER|DROP|CREATE|TRUNCATE|ATTACH|DETACH|OPTIMIZE|SYSTEM|KILL|GRANT|REVOKE|RENAME|EXCHANGE|USE|OUTFILE|SET|SETTINGS|FORMAT)\b/i;
/** table functions that read outside the database or spawn work */
const TABLE_FUNCTIONS = /\b(url|file|remote|remoteSecure|s3|s3Cluster|hdfs|azureBlobStorage|mysql|postgresql|sqlite|mongodb|redis|jdbc|odbc|executable|input|merge|cluster|clusterAllReplicas|dictionary|view|values|format|fileCluster|urlCluster|deltaLake|iceberg|hudi)\s*\(/i;

export type GuardResult = { ok: true; sql: string; tables: AllowedTable[] } | { ok: false; error: string };

export function guardSql(raw: string, chainId: number): GuardResult {
  const target = targetOf(chainId);
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
  // names a WITH defines (WITH snaps AS (…)) are the query's own, not tables
  const ctes = new Set([...sql.matchAll(/(?:\bWITH|,)\s*([A-Za-z_]\w*)\s+AS\s*\(/gi)].map((m) => m[1].toLowerCase()));
  const tables = new Set<AllowedTable>();
  const refs = sql.matchAll(/\b(?:FROM|JOIN)\s+(?!\()([`"]?)([A-Za-z_][\w.]*)\1/gi);
  for (const m of refs) {
    const ident = m[2].replace(/^default\./i, "");
    if (ctes.has(ident.toLowerCase())) continue;
    if (!target.tables.includes(ident)) {
      return { ok: false, error: `table ${m[2]} is not readable here; use ${target.tables.join(", ")}` };
    }
    tables.add(ident as AllowedTable);
  }
  if (tables.size === 0) return { ok: false, error: `the query reads no table; use ${target.tables.join(", ")}` };

  // one chain: the sort keys start with chain_id, so this is also what
  // keeps a query from scanning every chain in the partition
  const chainRe = new RegExp(`\\bchain_id\\s*(=|==)\\s*${chainId}\\b`);
  if (!chainRe.test(sql)) return { ok: false, error: `filter every table on chain_id = ${chainId}` };
  const otherChain = sql.match(/\bchain_id\s*(=|==)\s*(\d+)/g)?.find((s) => !new RegExp(`\\b${chainId}\\b`).test(s));
  if (otherChain) return { ok: false, error: `only chain_id = ${chainId} is readable on this page` };

  // the big tables hold years; a read with no window scans all of them
  const wide = [...tables].filter((t) => target.wide.includes(t));
  if (wide.length && !target.bound.test(sql)) {
    return {
      ok: false,
      error:
        target.kind === "pchain"
          ? `bound ${wide.join(", ")} on its time or height (block_time, snapshot_time, created_time, block_height; for snapshots, the latest snapshot_time)`
          : `bound ${wide.join(", ")} on block_time or block_number (for example block_time >= now() - INTERVAL 1 DAY)`,
    };
  }

  // rows: cap what comes back
  const lim = sql.match(/\bLIMIT\s+(\d+)(?:\s*,\s*(\d+))?/i);
  if (!lim) sql = `${sql}\nLIMIT ${MAX_ROWS}`;
  else {
    const n = Number(lim[2] ?? lim[1]);
    if (n > MAX_ROWS) return { ok: false, error: `LIMIT at most ${MAX_ROWS}; aggregate further or narrow the window` };
  }
  return { ok: true, sql, tables: [...tables] };
}
