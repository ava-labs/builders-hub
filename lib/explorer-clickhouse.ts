// Per-chain transaction count helpers backed by ClickHouse.
//
// Replaces the dead Solokhin endpoints used by `app/api/explorer/[chainId]/route.ts`:
//   - `idx6.solokhin.com/api/<chainId>/stats/cumulative-txs`
//   - `idx6.solokhin.com/api/global/overview/dailyTxsByChainCompact`
//
// Queries target the `raw_txs` table whose sort key is `(chain_id, hash)` —
// see `docs/clickhouse-schema.md`. The 14-day aggregate MUST include an
// explicit `chain_id IN (...)` list to stay performant; without it ClickHouse
// would scan the monthly partition across every chain.
//
// Mirrors the SWR + promise dedup cache pattern from `lib/icm-clickhouse.ts`.
// Known limitation: Fuji (chain_id 43113) has a stale ingestion watermark
// frozen at 2021-12-23, so its lifetime tx count and recent-day series will
// reflect that frozen state until upstream indexing resumes.

import l1ChainsData from '@/constants/l1-chains.json';

export interface TransactionHistoryPoint {
  date: string;
  transactions: number;
}

const QUERY_TIMEOUT_MS = 30_000;
const CUMULATIVE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const DAILY_TTL_MS = 15 * 60 * 1000; // 15 minutes
const DAILY_WINDOW_DAYS = 14;

type L1ChainEntry = {
  chainId: string;
  blockchainId?: string;
};

const trackedEvmChainIds: number[] = (() => {
  const ids = new Set<number>();
  for (const entry of l1ChainsData as L1ChainEntry[]) {
    const n = Number(entry.chainId);
    if (Number.isFinite(n) && n > 0) ids.add(n);
  }
  return Array.from(ids).sort((a, b) => a - b);
})();

async function clickhouseFetch<T>(
  sql: string,
  timeoutMs: number,
): Promise<T[]> {
  const url = process.env.CLICKHOUSE_URL;
  if (!url) {
    console.warn('[explorer-clickhouse] CLICKHOUSE_URL not set — returning empty');
    return [];
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'X-ClickHouse-User': process.env.CLICKHOUSE_USER || 'readonly',
        'X-ClickHouse-Key': process.env.CLICKHOUSE_PASSWORD || '',
        'X-ClickHouse-Database': process.env.CLICKHOUSE_DATABASE || 'default',
        'Content-Type': 'text/plain',
      },
      body: sql,
      signal: controller.signal,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(
        `ClickHouse query failed (${response.status}): ${text.slice(0, 300)}`,
      );
    }

    const text = (await response.text()).trim();
    if (!text) return [];
    return text.split('\n').map((line) => JSON.parse(line) as T);
  } finally {
    clearTimeout(timeoutId);
  }
}

// --- Cumulative tx count per chain --------------------------------------

interface CumulativeRow {
  cumulative_txs: string;
}

interface CumulativeCacheEntry {
  count: number;
  fetchedAt: number;
}

const cumulativeCache = new Map<number, CumulativeCacheEntry>();
const cumulativeInFlight = new Map<number, Promise<number>>();

function sqlCumulativeTxs(chainId: number): string {
  return `
    SELECT toString(count()) AS cumulative_txs
    FROM raw_txs
    WHERE chain_id = ${chainId}
    FORMAT JSONEachRow
  `;
}

async function fetchCumulativeFromCh(chainId: number): Promise<number> {
  try {
    const rows = await clickhouseFetch<CumulativeRow>(
      sqlCumulativeTxs(chainId),
      QUERY_TIMEOUT_MS,
    );
    if (rows.length === 0) return 0;
    const n = Number(rows[0].cumulative_txs);
    return Number.isFinite(n) ? n : 0;
  } catch (err) {
    console.error(
      `[explorer-clickhouse] cumulative-txs query failed for chain ${chainId}:`,
      err,
    );
    return 0;
  }
}

/**
 * Returns the lifetime transaction count for an EVM chain.
 *
 * Replaces the dead Solokhin `/api/<chainId>/stats/cumulative-txs` endpoint.
 * Returns 0 when the chain isn't indexed in `raw_txs` or when ClickHouse is
 * unreachable. Note that chains with a stale `sync_watermark` (e.g. Fuji) will
 * return a frozen count reflecting the last-indexed block.
 */
export async function getCumulativeTxs(evmChainId: number): Promise<number> {
  if (!Number.isFinite(evmChainId) || evmChainId <= 0) return 0;

  const cached = cumulativeCache.get(evmChainId);
  if (cached && Date.now() - cached.fetchedAt < CUMULATIVE_TTL_MS) {
    return cached.count;
  }

  const inFlight = cumulativeInFlight.get(evmChainId);
  if (inFlight) return inFlight;

  const promise = fetchCumulativeFromCh(evmChainId)
    .then((count) => {
      cumulativeCache.set(evmChainId, { count, fetchedAt: Date.now() });
      return count;
    })
    .finally(() => {
      cumulativeInFlight.delete(evmChainId);
    });

  cumulativeInFlight.set(evmChainId, promise);
  return promise;
}

// --- Daily tx count per chain (last 14 days) ----------------------------

interface DailyRow {
  chain_id: number;
  day: string;
  tx_count: string;
}

interface DailyCache {
  data: Map<string, TransactionHistoryPoint[]>;
  fetchedAt: number;
}

let dailyCache: DailyCache | null = null;
let dailyFetchPromise: Promise<DailyCache> | null = null;

function sqlDailyTxs(): string {
  // `chain_id IN (...)` first to leverage the (chain_id, hash) sort key.
  // `toDate(now() - INTERVAL N DAY)` keeps date-aligned partition pruning.
  const ids = trackedEvmChainIds.join(', ');
  return `
    SELECT
      chain_id,
      toDate(block_time) AS day,
      toString(count()) AS tx_count
    FROM raw_txs
    WHERE chain_id IN (${ids})
      AND block_time >= toDate(now() - INTERVAL ${DAILY_WINDOW_DAYS} DAY)
    GROUP BY chain_id, day
    ORDER BY chain_id, day
    FORMAT JSONEachRow
  `;
}

function buildLast14Dates(): string[] {
  // YYYY-MM-DD entries for the last DAILY_WINDOW_DAYS days, oldest first,
  // ending today (UTC). Used to pad chains that have zero-tx days so every
  // chart always renders exactly 14 points.
  const out: string[] = [];
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  for (let i = DAILY_WINDOW_DAYS - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - i);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

function formatDayLabel(isoDate: string): string {
  // Parse ISO date (UTC midnight) and format as "Nov 27". Adding a time
  // component avoids a JS Date timezone gotcha that would otherwise nudge
  // dates back by a day for users west of UTC.
  return new Date(`${isoDate}T00:00:00Z`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

async function fetchDailyFromCh(): Promise<DailyCache> {
  let rows: DailyRow[];
  try {
    rows = await clickhouseFetch<DailyRow>(sqlDailyTxs(), QUERY_TIMEOUT_MS);
  } catch (err) {
    console.error('[explorer-clickhouse] daily-txs query failed:', err);
    return { data: new Map(), fetchedAt: Date.now() };
  }

  // Group raw rows by chain_id into a day -> count map for fast lookup
  // during the pad step below.
  const byChain = new Map<string, Map<string, number>>();
  for (const row of rows) {
    const chainKey = String(row.chain_id);
    const inner =
      byChain.get(chainKey) ?? (new Map() as Map<string, number>);
    inner.set(row.day, Number(row.tx_count) || 0);
    byChain.set(chainKey, inner);
  }

  const last14 = buildLast14Dates();
  const result = new Map<string, TransactionHistoryPoint[]>();

  for (const evmId of trackedEvmChainIds) {
    const chainKey = String(evmId);
    const dayCounts = byChain.get(chainKey);
    if (!dayCounts) {
      result.set(
        chainKey,
        last14.map((iso) => ({
          date: formatDayLabel(iso),
          transactions: 0,
        })),
      );
      continue;
    }
    result.set(
      chainKey,
      last14.map((iso) => ({
        date: formatDayLabel(iso),
        transactions: dayCounts.get(iso) ?? 0,
      })),
    );
  }

  return { data: result, fetchedAt: Date.now() };
}

/**
 * Returns last-14-day daily transaction counts for every tracked EVM chain.
 *
 * Replaces the dead Solokhin `/api/global/overview/dailyTxsByChainCompact`
 * endpoint. Keys the returned `Map` by EVM chainId as a string (matching the
 * previous call site shape). Always pads each chain to exactly 14 entries so
 * the explorer chart x-axis stays stable across chains.
 */
export async function getDailyTxsByChain(): Promise<
  Map<string, TransactionHistoryPoint[]>
> {
  if (dailyCache && Date.now() - dailyCache.fetchedAt < DAILY_TTL_MS) {
    return dailyCache.data;
  }

  if (dailyCache) {
    if (!dailyFetchPromise) {
      dailyFetchPromise = fetchDailyFromCh()
        .then((data) => {
          dailyCache = data;
          return data;
        })
        .catch((err) => {
          console.error(
            '[explorer-clickhouse] daily-txs background refresh failed:',
            err,
          );
          return dailyCache!;
        })
        .finally(() => {
          dailyFetchPromise = null;
        });
    }
    return dailyCache.data;
  }

  if (!dailyFetchPromise) {
    dailyFetchPromise = fetchDailyFromCh()
      .then((data) => {
        dailyCache = data;
        return data;
      })
      .finally(() => {
        dailyFetchPromise = null;
      });
  }
  const fresh = await dailyFetchPromise;
  return fresh.data;
}

export const __internal = {
  sqlCumulativeTxs,
  sqlDailyTxs,
  buildLast14Dates,
  formatDayLabel,
  trackedEvmChainIds,
};
