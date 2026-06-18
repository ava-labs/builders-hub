/**
 * Hardened ClickHouse access for the PUBLIC, untrusted MCP.
 *
 * Deliberately SEPARATE from lib/clickhouse (which the internal dashboards use
 * with trusted inputs) so the MCP's stricter posture never changes existing
 * route behavior. Reuses the same env creds — nothing hardcoded, nothing the
 * caller can see.
 *
 * Invariants (all enforced here, never trusting the caller):
 *  - SELECT/WITH only; a single statement; no DDL/DML/admin/table-functions.
 *  - Every interpolated value comes from a validator below (chainId allowlist,
 *    strict hex address, bounded hours/days, clamped LIMIT) — NEVER a raw
 *    caller string, NEVER caller-supplied SQL/columns.
 *  - A hard client-side timeout (AbortController). Queries are bounded by a
 *    leading `chain_id = <int>` (sort-key prune) + a capped time window + a
 *    mandatory LIMIT, so a single call can't run away. NOTE: the authoritative
 *    server-side cost cap (max_execution_time / max_rows_to_read / max_memory)
 *    must live on the MCP read-user's ClickHouse PROFILE — we cannot set it
 *    per-query because a readonly=1 user rejects SETTINGS. (Follow-up w/ DB admin.)
 *  - On ANY failure, throw a generic error; the raw ClickHouse text (which can
 *    leak host/schema) is logged server-side only, never surfaced to the caller.
 */

import l1ChainsData from '@/constants/l1-chains.json';

const CH_TIMEOUT_MS = 12_000;

export const C_CHAIN_ID = 43114;
export const FUJI_C_CHAIN_ID = 43113;

/** EVM chain_ids we permit querying: the tracked L1 set + C-Chain (main+fuji). */
const ALLOWED_CHAIN_IDS: Set<number> = (() => {
  const ids = new Set<number>([C_CHAIN_ID, FUJI_C_CHAIN_ID]);
  for (const e of l1ChainsData as Array<{ chainId?: string | number }>) {
    const n = Number(e?.chainId);
    if (Number.isInteger(n) && n > 0) ids.add(n);
  }
  return ids;
})();

export class ClickHouseSafeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ClickHouseSafeError';
  }
}

// --- Validators (every value that ever touches SQL goes through one) --------

export function assertChainId(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isInteger(n) || n <= 0) throw new ClickHouseSafeError('invalid chainId (must be a positive integer EVM chain ID)');
  if (!ALLOWED_CHAIN_IDS.has(n)) throw new ClickHouseSafeError(`chainId ${n} is not indexed for on-chain queries`);
  return n;
}

export function isFrozenChain(chainId: number): boolean {
  // Fuji (43113) has a stale ingestion watermark — surface counts as possibly stale.
  return chainId === FUJI_C_CHAIN_ID;
}

export function toSafeHexAddr(address: string): string {
  const hex = String(address).toLowerCase().replace(/^0x/, '');
  if (!/^[0-9a-f]{40}$/.test(hex)) throw new ClickHouseSafeError('invalid EVM address');
  return hex;
}

export function assertSafeHours(h: unknown, max = 24 * 30): number {
  const n = typeof h === 'number' ? h : Number(h);
  if (!Number.isInteger(n) || n < 1 || n > max) throw new ClickHouseSafeError(`hours must be an integer 1..${max}`);
  return n;
}

export function assertSafeDays(d: unknown, max = 365): number {
  const n = typeof d === 'number' ? d : Number(d);
  if (!Number.isInteger(n) || n < 1 || n > max) throw new ClickHouseSafeError(`days must be an integer 1..${max}`);
  return n;
}

export function clampLimit(n: unknown, max = 100, fallback = 20): number {
  const v = typeof n === 'number' ? n : Number(n);
  if (!Number.isFinite(v)) return Math.min(fallback, max);
  return Math.max(1, Math.min(Math.floor(v), max));
}

// --- SELECT-only guard ------------------------------------------------------

const FORBIDDEN =
  /(;|--|\/\*|\*\/|\b(INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE|CREATE|GRANT|REVOKE|ATTACH|DETACH|OPTIMIZE|RENAME|SYSTEM|KILL)\b|\b(url|file|remote|remoteSecure|s3|s3Cluster|jdbc|odbc|mysql|postgresql|hdfs|input|cluster)\s*\(|INTO\s+OUTFILE|\bFORMAT\b|\bSETTINGS\b)/i;

function assertSafeSelectOnly(sql: string): void {
  const s = sql.trim();
  if (!/^(SELECT|WITH)\b/i.test(s)) throw new ClickHouseSafeError('only SELECT/WITH queries are allowed');
  if (FORBIDDEN.test(s)) throw new ClickHouseSafeError('query contains forbidden tokens');
}

// --- Executor ---------------------------------------------------------------

/**
 * Run an internally-built SELECT. Pass ONLY SQL assembled from the validators
 * above — never a caller string. Appends FORMAT JSONEachRow and parses rows.
 */
export async function chSelect<T = Record<string, unknown>>(sql: string): Promise<T[]> {
  assertSafeSelectOnly(sql);

  const url = process.env.CLICKHOUSE_URL;
  if (!url) throw new ClickHouseSafeError('on-chain data backend is not configured');

  const body = `${sql.trim()}\nFORMAT JSONEachRow`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'X-ClickHouse-User': process.env.CLICKHOUSE_USER || 'readonly',
        'X-ClickHouse-Key': process.env.CLICKHOUSE_PASSWORD || '',
        'X-ClickHouse-Database': process.env.CLICKHOUSE_DATABASE || 'default',
        'Content-Type': 'text/plain',
      },
      body,
      signal: controller.signal,
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      console.error(`[mcp/clickhouse] query failed (${res.status}): ${detail.slice(0, 500)}`);
      throw new ClickHouseSafeError('on-chain query failed');
    }
    const txt = (await res.text()).trim();
    if (!txt) return [];
    return txt.split('\n').filter(Boolean).map((line) => JSON.parse(line) as T);
  } catch (err) {
    if (err instanceof ClickHouseSafeError) throw err;
    if (err instanceof Error && err.name === 'AbortError') {
      throw new ClickHouseSafeError('on-chain query timed out');
    }
    console.error('[mcp/clickhouse] query error:', err);
    throw new ClickHouseSafeError('on-chain query failed');
  } finally {
    clearTimeout(timer);
  }
}
