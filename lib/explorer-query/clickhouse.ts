/* Runs a guarded query against the read-only ClickHouse and describes
   the tables it may read. The schema card is read from the database
   itself, so the model always sees the real columns and types. */

import { withQuerySlot } from "@/lib/clickhouse/client";
import { MAX_ROWS } from "./guard";
import { targetOf } from "./target";

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
  // every time on the page is UTC, whatever zone the server runs in
  session_timezone: "UTC",
};

interface RawJson {
  meta: ColumnMeta[];
  data: Record<string, unknown>[];
  rows: number;
  rows_before_limit_at_least?: number;
  statistics?: { elapsed: number; rows_read: number; bytes_read: number };
}

/* Two ways in. ClickHouse now sits inside the stats-api cluster with no
   public port, so the usual path is stats-api's own query endpoint
   (/v2/query, a key per holder). A direct URL (QUERY_CLICKHOUSE_URL, the
   local test harness) still wins when it is set. */
const STATS_QUERY_URL = process.env.STATS_QUERY_URL || "https://stats-api.avax.network/v2/query";

interface StatsQueryJson {
  columns: string[];
  types: string[];
  rows: unknown[][];
  rowCount: number;
  truncated: boolean;
  elapsedMs: number;
  complete: boolean;
  error?: string;
  message?: string;
}

/* the endpoint runs two ad-hoc queries at once and turns a third away
   (503), so this instance holds its own two slots and waits for one */
const STATS_SLOTS = 2;
let statsBusy = 0;
const statsQueue: (() => void)[] = [];

async function statsSlot<T>(run: () => Promise<T>): Promise<T> {
  if (statsBusy >= STATS_SLOTS) await new Promise<void>((r) => statsQueue.push(r));
  statsBusy += 1;
  try {
    return await run();
  } finally {
    statsBusy -= 1;
    statsQueue.shift()?.();
  }
}

async function postStats(sql: string): Promise<RawJson> {
  const key = process.env.STATS_QUERY_KEY;
  if (!key) throw new Error("STATS_QUERY_KEY is not set");
  // busy (503) and over the rate (429) are worth a short wait; other
  // instances share the key, so this one's slots are not the whole story
  let res: Response | null = null;
  let text = "";
  for (let attempt = 0; attempt < 4; attempt += 1) {
    // the rows stream: the query runs until the body is read, so the slot is held until then
    const got = await statsSlot(async () => {
      const r = await fetch(STATS_QUERY_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Query-Key": key },
        body: JSON.stringify({ sql, maxRows: MAX_ROWS, timeoutSeconds: QUERY_TIMEOUT_S, format: "json" }),
        signal: AbortSignal.timeout((QUERY_TIMEOUT_S + 10) * 1000),
      });
      return { r, t: await r.text() };
    });
    res = got.r;
    text = got.t;
    // ClickHouse's per-minute quota on the shared stats-api user comes back
    // as an error body: every visitor's queries count against one window,
    // so only a wait of a good part of that minute clears it
    const quota = /QUOTA_EXCEEDED/.test(text);
    if (!quota && res.status !== 429 && res.status !== 503) break;
    if (attempt === 3) break;
    const after = Number(res.headers.get("retry-after"));
    const waitS = quota ? 15 : Math.min(8, Number.isFinite(after) && after > 0 ? after : 1 + attempt);
    await new Promise((r) => setTimeout(r, waitS * 1000));
  }
  if (!res) throw new Error("stats-api did not answer");
  let body: StatsQueryJson;
  try {
    body = JSON.parse(text) as StatsQueryJson;
  } catch {
    throw new Error(`stats-api ${res.status}: ${text.slice(0, 200)}`);
  }
  // the endpoint streams, so a query can fail after the rows began: the trailer says so
  if (!res.ok || body.error || body.complete === false) {
    // the reason is in message ("clickhouse: … code: 47, message: …"); error is only the status text
    const why = body.message ?? body.error ?? `stats-api ${res.status}`;
    const inner = why.match(/message:\s*(.+?)(?:\s*\(version [^)]*\))?$/s)?.[1] ?? why;
    throw new Error(inner.replace(/^clickhouse:\s*/, "").slice(0, 500));
  }
  // an empty answer can carry null in place of its lists
  const meta = (body.columns ?? []).map((name, i) => ({ name, type: body.types?.[i] ?? "String" }));
  // the endpoint writes times as ISO (2026-09-24T16:25:46Z); ClickHouse's own
  // format (2026-09-24 16:25:46) is what the page reads as time
  const times = new Set(meta.filter((c) => /^(Nullable\()?DateTime/.test(c.type)).map((c) => c.name));
  const days = new Set(meta.filter((c) => /^(Nullable\()?Date(32)?(\)|$)/.test(c.type)).map((c) => c.name));
  const tidy = (name: string, v: unknown) => {
    if (typeof v !== "string") return v;
    if (days.has(name)) return v.slice(0, 10);
    return times.has(name) ? v.replace("T", " ").replace(/(\.\d+)?Z$/, "") : v;
  };
  const data = (body.rows ?? []).map((r) => Object.fromEntries(meta.map((c, i) => [c.name, tidy(c.name, r[i])])));
  return { meta, data, rows: body.rowCount ?? data.length, statistics: { elapsed: body.elapsedMs / 1000, rows_read: 0, bytes_read: 0 } };
}

async function post(sql: string): Promise<RawJson> {
  if (!process.env.QUERY_CLICKHOUSE_URL && process.env.STATS_QUERY_KEY) return postStats(sql);
  const base = endpoint();
  const qs = new URLSearchParams(SETTINGS);
  // the box rejects a fifth concurrent query outright; share the site's gate
  const { res, text } = await withQuerySlot(async () => {
    const res = await fetch(`${base.replace(/\/$/, "")}/?${qs}`, {
      method: "POST",
      headers: headers(),
      body: `${sql}\nFORMAT JSON`,
      signal: AbortSignal.timeout((QUERY_TIMEOUT_S + 5) * 1000),
    });
    return { res, text: await res.text() };
  });
  if (!res.ok) {
    // ClickHouse puts the readable reason on one line after the code
    const line = text.split("\n").find((l) => /DB::Exception/.test(l)) ?? text;
    throw new Error(line.replace(/^Code:\s*\d+\.\s*/, "").slice(0, 500));
  }
  return JSON.parse(text) as RawJson;
}

/** a column of raw bytes: an address, a hash, calldata. JSON cannot carry
    bytes, so these arrive mangled and must be asked for again as hex */
function binaryColumns(body: RawJson): string[] {
  return body.meta
    .filter((c) => {
      const t = c.type.replace(/^(Nullable|LowCardinality)\((.*)\)$/, "$2");
      if (/^FixedString\(/.test(t)) return true;
      return t === "String" && body.data.some((r) => typeof r[c.name] === "string" && /[\uFFFD\u0000-\u0008\u000E-\u001F]/.test(r[c.name] as string));
    })
    .map((c) => c.name);
}

export async function runQuery(sql: string): Promise<QueryResult> {
  let body = await post(sql);
  // a query that returned bytes (a model forgot hex()) runs once more with
  // those columns as 0x text, so the page never shows mangled bytes
  const bytes = binaryColumns(body);
  if (bytes.length) {
    const cols = body.meta
      .map((c) => {
        const q = "`" + c.name.replace(/`/g, "") + "`";
        return bytes.includes(c.name) ? `lower(concat('0x', hex(${q}))) AS ${q}` : q;
      })
      .join(", ");
    body = await post(`SELECT ${cols} FROM (${sql.replace(/\nLIMIT (\d+)$/, " LIMIT $1")})`);
  }
  // an address read from a log topic is left-padded to 32 bytes; show the 20
  for (const c of body.meta) {
    if (!/address|^from|^to|sender|recipient|caller|contract/i.test(c.name)) continue;
    for (const r of body.data) {
      const v = r[c.name];
      if (typeof v === "string" && /^0x0{24}[0-9a-fA-F]{40}$/.test(v)) r[c.name] = `0x${v.slice(26).toLowerCase()}`;
    }
  }
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

const schemaCache = new Map<string, { at: number; text: string }>();
const SCHEMA_TTL_MS = 60 * 60_000;

/** the tables as the database describes them, one line per table */
export async function schemaCard(chainId: number): Promise<string> {
  const { kind, tables } = targetOf(chainId);
  const hit = schemaCache.get(kind);
  if (hit && Date.now() - hit.at < SCHEMA_TTL_MS) return hit.text;
  const list = tables.map((t) => `'${t}'`).join(", ");
  const r = await runQuery(
    `SELECT table, name, type FROM system.columns WHERE database = currentDatabase() AND table IN (${list}) ORDER BY table, position`,
  );
  const by = new Map<string, string[]>();
  for (const row of r.rows) {
    const t = String(row.table);
    (by.get(t) ?? by.set(t, []).get(t)!).push(`${row.name} ${row.type}`);
  }
  const text = tables.filter((t) => by.has(t))
    .map((t) => `${t}(${by.get(t)!.join(", ")})`)
    .join("\n");
  if (!text) throw new Error("schema card empty");
  schemaCache.set(kind, { at: Date.now(), text });
  return text;
}

export interface Coverage {
  since: string;
  until: string;
  untilUnix: number;
  lo: number;
  hi: number;
  blocks: number;
}

const coverageCache = new Map<number, { at: number; value: Coverage | null }>();
const COVERAGE_TTL_MS = 10 * 60_000;
/** a chain with no rows is asked again after an hour, not every ten minutes */
const EMPTY_TTL_MS = 60 * 60_000;

/** the window of this chain the database holds; null when it holds no rows. Throws when the database cannot be read. */
async function readCoverage(chainId: number): Promise<Coverage | null> {
  const hit = coverageCache.get(chainId);
  if (hit && Date.now() - hit.at < (hit.value ? COVERAGE_TTL_MS : EMPTY_TTL_MS)) return hit.value;
  const r = await runQuery(
    targetOf(chainId).kind === "pchain"
      ? `SELECT toString(min(block_time), 'UTC') AS since, toString(max(block_time), 'UTC') AS until, toUnixTimestamp(max(block_time)) AS until_unix, min(block_height) AS lo, max(block_height) AS hi, count() AS blocks FROM raw_p_blocks WHERE chain_id = ${chainId}`
      : `SELECT toString(min(block_time), 'UTC') AS since, toString(max(block_time), 'UTC') AS until, toUnixTimestamp(max(block_time)) AS until_unix, min(block_number) AS lo, max(block_number) AS hi, count() AS blocks FROM raw_blocks WHERE chain_id = ${chainId}`,
  );
  const row = r.rows[0];
  const value: Coverage | null =
    row && row.blocks
      ? { since: String(row.since), until: String(row.until), untilUnix: Number(row.until_unix), lo: Number(row.lo), hi: Number(row.hi), blocks: Number(row.blocks) }
      : null;
  coverageCache.set(chainId, { at: Date.now(), value });
  return value;
}

/** what window of this chain the database holds */
export async function coverage(chainId: number): Promise<Coverage | null> {
  try {
    return await readCoverage(chainId);
  } catch {
    return null;
  }
}

/** for the page: the chain's window, "empty" when nothing is indexed, or
    null when the database did not answer in time (the page then says nothing) */
export async function indexState(chainId: number, timeoutMs = 4000): Promise<Coverage | "empty" | null> {
  const read = readCoverage(chainId).then(
    (c) => c ?? ("empty" as const),
    () => null,
  );
  const late = new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs));
  return Promise.race([read, late]);
}

export function coverageText(chainId: number, c: Coverage): string {
  const table = targetOf(chainId).kind === "pchain" ? "raw_p_blocks" : "raw_blocks";
  return `${table} holds ${c.blocks} blocks for chain ${chainId}: heights ${c.lo} to ${c.hi}, ${c.since} to ${c.until} UTC.`;
}

/** how far behind the clock the index may run before "now" means its last block */
const LAG_S = 15 * 60;

/** "now" as the data knows it. When the index runs behind the clock, a
    window such as the last hour would end past the data and come back
    empty; so now() is read as the time of the last indexed block. The
    query as written keeps now(), so it stays right once the index is live. */
export async function anchored(sql: string, chainId: number): Promise<{ sql: string; anchor: string | null }> {
  if (!/\bnow\(\s*\)/i.test(sql)) return { sql, anchor: null };
  const c = await coverage(chainId);
  if (!c) return { sql, anchor: null };
  if (!Number.isFinite(c.untilUnix) || Date.now() / 1000 - c.untilUnix < LAG_S) return { sql, anchor: null };
  return { sql: sql.replace(/\bnow\(\s*\)/gi, `toDateTime(${Math.floor(c.untilUnix)})`), anchor: c.until };
}
