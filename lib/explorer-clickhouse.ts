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
// The staking money-flow charts read better with a wider window: 30 bars
// of rewards behind, 30 of unlocks ahead.
const STAKING_WINDOW_DAYS = 30;

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

function buildPastDates(days: number = DAILY_WINDOW_DAYS): string[] {
  // YYYY-MM-DD entries for the last `days` days, oldest first, ending
  // today (UTC). Used to pad zero-activity days so every chart always
  // renders exactly its window's point count.
  const out: string[] = [];
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  for (let i = days - 1; i >= 0; i--) {
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

  const last14 = buildPastDates();
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

// --- P-Chain staking economics ----------------------------------------------
// The P-Chain's real story is money, not tx counts: AVAX paid out to
// stakers (RewardValidatorTx mints, read from the reward-UTXO archive) and
// AVAX about to unlock (validator/delegator end_times from the snapshot
// tables). The past STAKING_WINDOW_DAYS on one side, the next on the other.

const PCHAIN_NETWORK_IDS: Record<string, number> = {
  mainnet: 1,
  fuji: 5,
  devnet: 0,
};

export interface PchainRewardPoint {
  date: string;
  /** AVAX minted to stakers that day */
  avax: number;
  /** reward UTXOs created (≈ stake periods that ended) */
  payouts: number;
}

export interface PchainUnlockPoint {
  date: string;
  /** AVAX whose staking period ends that day (validators + delegators) */
  avax: number;
  /** stake entries ending */
  stakers: number;
}

export interface PchainStakingSeries {
  rewards: PchainRewardPoint[];
  unlocks: PchainUnlockPoint[];
}

// A reward UTXO's amount sits at a fixed offset in its serialization:
// codec(2) + txID(32) + outputIndex(4) + assetID(32) + outputTypeID(4),
// then the 8-byte big-endian amount — bytes 75..82, 1-indexed. Verified
// against the independent supply_p_history current_supply diffs.
const REWARD_AMOUNT_EXPR =
  "reinterpretAsUInt64(reverse(substring(utxo_bytes, 75, 8)))";

function sqlPchainDailyRewards(networkId: number): string {
  return `
    SELECT
      toDate(block_time) AS day,
      toString(count()) AS payouts,
      toString(round(sum(${REWARD_AMOUNT_EXPR}) / 1e9, 2)) AS avax
    FROM raw_p_reward_utxos
    WHERE chain_id = ${networkId}
      AND block_time >= toDate(now() - INTERVAL ${STAKING_WINDOW_DAYS} DAY)
    GROUP BY day
    ORDER BY day
    FORMAT JSONEachRow
  `;
}

// Primary Network subnet id is 32 zero bytes; L1/subnet validators don't
// carry meaningful end_times, so unlocks are primary-only by construction.
function sqlPchainUnlocks(networkId: number, table: string, amountCol: string): string {
  const subnetFilter =
    table === "p_validator_snapshots"
      ? "AND subnet_id = toFixedString(unhex(repeat('00', 32)), 32)"
      : "";
  return `
    SELECT
      toDate(end_time) AS day,
      toString(round(sum(${amountCol}) / 1e9, 2)) AS avax,
      toString(count()) AS n
    FROM ${table}
    WHERE chain_id = ${networkId}
      AND snapshot_time = (SELECT max(snapshot_time) FROM ${table} WHERE chain_id = ${networkId})
      ${subnetFilter}
      AND end_time >= now()
      AND end_time < now() + INTERVAL ${STAKING_WINDOW_DAYS} DAY
    GROUP BY day
    ORDER BY day
    FORMAT JSONEachRow
  `;
}

function buildFutureDates(days: number): string[] {
  const dates: string[] = [];
  const today = new Date();
  for (let i = 0; i < days; i++) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() + i);
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}

const pchainStakingCache = new Map<
  string,
  { data: PchainStakingSeries; fetchedAt: number }
>();

/**
 * Staking money-flow series for one network: AVAX rewards paid per day
 * (the past STAKING_WINDOW_DAYS) and stake unlocking per day (the next),
 * each padded to exactly that many points. Returns null for unknown
 * networks or when ClickHouse is unreachable with no cache to fall on.
 */
export async function getPchainStakingSeries(
  network: string,
): Promise<PchainStakingSeries | null> {
  const networkId = PCHAIN_NETWORK_IDS[network];
  if (networkId === undefined) return null;

  const cached = pchainStakingCache.get(network);
  if (cached && Date.now() - cached.fetchedAt < DAILY_TTL_MS) {
    return cached.data;
  }

  try {
    type Row = { day: string; avax: string; n?: string; payouts?: string };
    const [rewardRows, validatorRows, delegatorRows] = await Promise.all([
      clickhouseFetch<Row>(sqlPchainDailyRewards(networkId), QUERY_TIMEOUT_MS),
      clickhouseFetch<Row>(
        sqlPchainUnlocks(networkId, "p_validator_snapshots", "weight"),
        QUERY_TIMEOUT_MS,
      ),
      clickhouseFetch<Row>(
        sqlPchainUnlocks(networkId, "p_delegator_snapshots", "stake_amount"),
        QUERY_TIMEOUT_MS,
      ),
    ]);

    const rewardsByDay = new Map(rewardRows.map((r) => [r.day, r]));
    const rewards = buildPastDates(STAKING_WINDOW_DAYS).map((iso) => ({
      date: formatDayLabel(iso),
      avax: Number(rewardsByDay.get(iso)?.avax) || 0,
      payouts: Number(rewardsByDay.get(iso)?.payouts) || 0,
    }));

    const unlocksByDay = new Map<string, { avax: number; stakers: number }>();
    for (const r of [...validatorRows, ...delegatorRows]) {
      const day = unlocksByDay.get(r.day) ?? { avax: 0, stakers: 0 };
      day.avax += Number(r.avax) || 0;
      day.stakers += Number(r.n) || 0;
      unlocksByDay.set(r.day, day);
    }
    const unlocks = buildFutureDates(STAKING_WINDOW_DAYS).map((iso) => ({
      date: formatDayLabel(iso),
      avax: Math.round(unlocksByDay.get(iso)?.avax ?? 0),
      stakers: unlocksByDay.get(iso)?.stakers ?? 0,
    }));

    const data = { rewards, unlocks };
    pchainStakingCache.set(network, { data, fetchedAt: Date.now() });
    return data;
  } catch (err) {
    console.error('[explorer-clickhouse] pchain staking-series query failed:', err);
    return cached?.data ?? null;
  }
}

// --- C-Chain activity by behavior --------------------------------------------
// Categorize each tx by what its event logs SAY it did — no contract-label
// curation needed. Priority per tx: DeFi swap beats NFT transfer beats
// token transfer; txs with no matching logs (plain AVAX sends, simple
// calls) land in "other" via the daily-total diff.

export interface CchainActivityPoint {
  date: string;
  defi: number;
  nft: number;
  tokens: number;
  other: number;
}

// topic0 signatures: UniV2 Swap, UniV3 Swap, LFJ LiquidityBook Swap;
// ERC-20/721 Transfer (721 has an indexed tokenId → topic3 present);
// ERC-1155 TransferSingle / TransferBatch
const TOPIC_SWAP_V2 = "d78ad95fa46c994b6551d0da85fc275fe613ce37657fb8d5e3d130840159d822";
const TOPIC_SWAP_V3 = "c42079f94a6350d7e6235f29174924f928cc2ac818eb64fed8004e115fbcca67";
const TOPIC_SWAP_LB = "ad7d6f97abf51ce18e17a38f4d70e975be9c0708474987bb3e26ad21bd93ca70";
const TOPIC_TRANSFER = "ddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
const TOPIC_1155_SINGLE = "c3d58168c5ae7397731d063d5bbf3d657854427343f4c083240f7aacaa2d0f62";
const TOPIC_1155_BATCH = "4a39dc06d4c0dbc64b70af90fd698a233a518aa5d07e595d983b8c0526c8f7fb";

const CCHAIN_EVM_ID = 43114;
// ~80M logs in the window — give the classification room to run
const CCHAIN_ACTIVITY_TIMEOUT_MS = 60_000;

function sqlCchainClassified(): string {
  return `
    SELECT
      day,
      toString(countIf(cls = 3)) AS defi,
      toString(countIf(cls = 2)) AS nft,
      toString(countIf(cls = 1)) AS tokens
    FROM (
      SELECT
        toDate(block_time) AS day,
        transaction_hash,
        max(multiIf(
          topic0 IN (unhex('${TOPIC_SWAP_V2}'), unhex('${TOPIC_SWAP_V3}'), unhex('${TOPIC_SWAP_LB}')), 3,
          topic0 = unhex('${TOPIC_TRANSFER}') AND topic3 IS NOT NULL, 2,
          topic0 IN (unhex('${TOPIC_1155_SINGLE}'), unhex('${TOPIC_1155_BATCH}')), 2,
          topic0 = unhex('${TOPIC_TRANSFER}'), 1,
          0
        )) AS cls
      FROM raw_logs
      WHERE chain_id = ${CCHAIN_EVM_ID}
        AND block_time >= toDate(now() - INTERVAL ${DAILY_WINDOW_DAYS} DAY)
      GROUP BY day, transaction_hash
    )
    GROUP BY day
    ORDER BY day
    FORMAT JSONEachRow
  `;
}

function sqlCchainDailyTotals(): string {
  return `
    SELECT toDate(block_time) AS day, toString(count()) AS total
    FROM evm_txs
    WHERE chain_id = ${CCHAIN_EVM_ID}
      AND block_time >= toDate(now() - INTERVAL ${DAILY_WINDOW_DAYS} DAY)
    GROUP BY day
    ORDER BY day
    FORMAT JSONEachRow
  `;
}

let cchainActivityCache: { data: CchainActivityPoint[]; fetchedAt: number } | null = null;

/**
 * Last-14-day C-Chain activity split by on-chain behavior (DeFi swaps /
 * NFT transfers / token transfers / everything else), padded to exactly
 * 14 points. Mainnet only — that's the chain the log archive covers.
 */
export async function getCchainDailyActivity(): Promise<CchainActivityPoint[] | null> {
  if (cchainActivityCache && Date.now() - cchainActivityCache.fetchedAt < DAILY_TTL_MS) {
    return cchainActivityCache.data;
  }

  try {
    const [classified, totals] = await Promise.all([
      clickhouseFetch<{ day: string; defi: string; nft: string; tokens: string }>(
        sqlCchainClassified(),
        CCHAIN_ACTIVITY_TIMEOUT_MS,
      ),
      clickhouseFetch<{ day: string; total: string }>(sqlCchainDailyTotals(), QUERY_TIMEOUT_MS),
    ]);
    const classifiedByDay = new Map(classified.map((r) => [r.day, r]));
    const totalsByDay = new Map(totals.map((r) => [r.day, Number(r.total) || 0]));
    const data = buildPastDates().map((iso) => {
      const c = classifiedByDay.get(iso);
      const defi = Number(c?.defi) || 0;
      const nft = Number(c?.nft) || 0;
      const tokens = Number(c?.tokens) || 0;
      const total = totalsByDay.get(iso) ?? 0;
      return {
        date: formatDayLabel(iso),
        defi,
        nft,
        tokens,
        other: Math.max(0, total - defi - nft - tokens),
      };
    });
    cchainActivityCache = { data, fetchedAt: Date.now() };
    return data;
  } catch (err) {
    console.error('[explorer-clickhouse] cchain activity query failed:', err);
    return cchainActivityCache?.data ?? null;
  }
}

export const __internal = {
  sqlCumulativeTxs,
  sqlDailyTxs,
  buildPastDates,
  formatDayLabel,
  trackedEvmChainIds,
};
