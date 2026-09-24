/* Runs a guarded query against the read-only ClickHouse and describes
   the tables it may read. The schema card is read from the database
   itself, so the model always sees the real columns and types. */

import { ALLOWED_TABLES, MAX_ROWS } from "./guard";

export interface ColumnMeta {
  name: string;
  type: string;
}

export interface QueryResult {
  columns: ColumnMeta[];
  rows: Record<string, unknown>[];
  rowCount: number;
  /** what ClickHouse reports it spent */
  elapsedMs: number;
  rowsRead: number;
  bytesRead: number;
  /** the row cap cut the result */
  truncated: boolean;
  ranAt: string;
}

const QUERY_TIMEOUT_S = 45;

function endpoint(): string {
  const url = process.env.QUERY_CLICKHOUSE_URL || process.env.CLICKHOUSE_URL;
  if (!url) throw new Error("CLICKHOUSE_URL is not set");
  return url;
}

function headers(): Record<string, string> {
  return {
    "X-ClickHouse-User": process.env.QUERY_CLICKHOUSE_USER || process.env.CLICKHOUSE_USER || "readonly",
    "X-ClickHouse-Key": process.env.QUERY_CLICKHOUSE_PASSWORD ?? process.env.CLICKHOUSE_PASSWORD ?? "",
    "X-ClickHouse-Database": process.env.CLICKHOUSE_DATABASE || "default",
    "Content-Type": "text/plain",
  };
}

/** every knob is set here, on the request, never in the query text */
const SETTINGS: Record<string, string> = {
  max_execution_time: String(QUERY_TIMEOUT_S),
  max_result_rows: String(MAX_ROWS),
  result_overflow_mode: "break",
  output_format_json_quote_64bit_integers: "0",
  output_format_json_quote_denormals: "1",
  max_bytes_before_external_group_by: "3000000000",
  max_memory_usage: "9000000000",
  max_rows_to_read: "20000000000",
  // a SELECT that aliases hex(method_id) AS method_id must still filter on
  // the column in WHERE, not on its own alias
  prefer_column_name_to_alias: "1",
};

interface RawJson {
  meta: ColumnMeta[];
  data: Record<string, unknown>[];
  rows: number;
  rows_before_limit_at_least?: number;
  statistics?: { elapsed: number; rows_read: number; bytes_read: number };
}

export async function runQuery(sql: string): Promise<QueryResult> {
  const base = endpoint();
  const qs = new URLSearchParams(SETTINGS);
  const res = await fetch(`${base.replace(/\/$/, "")}/?${qs}`, {
    method: "POST",
    headers: headers(),
    body: `${sql}\nFORMAT JSON`,
    signal: AbortSignal.timeout((QUERY_TIMEOUT_S + 5) * 1000),
  });
  const text = await res.text();
  if (!res.ok) {
    // ClickHouse puts the readable reason on one line after the code
    const line = text.split("\n").find((l) => /DB::Exception/.test(l)) ?? text;
    throw new Error(line.replace(/^Code:\s*\d+\.\s*/, "").slice(0, 500));
  }
  const body = JSON.parse(text) as RawJson;
  return {
    columns: body.meta,
    rows: body.data,
    rowCount: body.rows,
    elapsedMs: Math.round((body.statistics?.elapsed ?? 0) * 1000),
    rowsRead: body.statistics?.rows_read ?? 0,
    bytesRead: body.statistics?.bytes_read ?? 0,
    truncated: body.rows >= MAX_ROWS,
    ranAt: new Date().toISOString(),
  };
}

/* ------------------------------------------------------------------ */
/* the schema card                                                     */

let schemaCache: { at: number; text: string } | null = null;
const SCHEMA_TTL_MS = 60 * 60_000;

/** the tables as the database describes them, one line per table */
export async function schemaCard(): Promise<string> {
  if (schemaCache && Date.now() - schemaCache.at < SCHEMA_TTL_MS) return schemaCache.text;
  const list = ALLOWED_TABLES.map((t) => `'${t}'`).join(", ");
  const r = await runQuery(
    `SELECT table, name, type FROM system.columns WHERE database = currentDatabase() AND table IN (${list}) ORDER BY table, position`,
  );
  const by = new Map<string, string[]>();
  for (const row of r.rows) {
    const t = String(row.table);
    (by.get(t) ?? by.set(t, []).get(t)!).push(`${row.name} ${row.type}`);
  }
  const text = ALLOWED_TABLES.filter((t) => by.has(t))
    .map((t) => `${t}(${by.get(t)!.join(", ")})`)
    .join("\n");
  if (!text) throw new Error("schema card empty");
  schemaCache = { at: Date.now(), text };
  return text;
}

const coverageCache = new Map<number, { at: number; text: string }>();
const COVERAGE_TTL_MS = 10 * 60_000;

/** what window of this chain the database holds */
export async function coverage(chainId: number): Promise<string | null> {
  const hit = coverageCache.get(chainId);
  if (hit && Date.now() - hit.at < COVERAGE_TTL_MS) return hit.text;
  try {
    const r = await runQuery(
      `SELECT toString(min(block_time)) AS since, toString(max(block_time)) AS until, min(block_number) AS lo, max(block_number) AS hi, count() AS blocks FROM raw_blocks WHERE chain_id = ${chainId}`,
    );
    const row = r.rows[0];
    if (!row || !row.blocks) return null;
    const text = `raw_blocks holds ${row.blocks} blocks for chain ${chainId}: #${row.lo} to #${row.hi}, ${row.since} to ${row.until} UTC.`;
    coverageCache.set(chainId, { at: Date.now(), text });
    return text;
  } catch {
    return null;
  }
}
