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
import { getContractInfo, PROTOCOL_SLUGS } from '@/lib/contracts';

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
/** windows the staking money-flow feed serves (past rewards / future unlocks) */
export type PchainStakingDays = 30 | 90 | 365;

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
};

export interface PchainRewardPoint {
  /** UTC day, YYYY-MM-DD; display formatting is the client's job */
  date: string;
  /** AVAX minted to stakers that day */
  avax: number;
  /** reward UTXOs created (≈ stake periods that ended) */
  payouts: number;
}

export interface PchainUnlockPoint {
  /** UTC day, YYYY-MM-DD; display formatting is the client's job */
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

function sqlPchainDailyRewards(networkId: number, days: PchainStakingDays): string {
  return `
    SELECT
      toDate(block_time) AS day,
      toString(count()) AS payouts,
      toString(round(sum(${REWARD_AMOUNT_EXPR}) / 1e9, 2)) AS avax
    FROM raw_p_reward_utxos
    WHERE chain_id = ${networkId}
      AND block_time >= toDate(now() - INTERVAL ${days} DAY)
    GROUP BY day
    ORDER BY day
    FORMAT JSONEachRow
  `;
}

// Primary Network subnet id is 32 zero bytes; L1/subnet validators don't
// carry meaningful end_times, so unlocks are primary-only by construction.
function sqlPchainUnlocks(networkId: number, table: string, amountCol: string, days: PchainStakingDays): string {
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
      AND end_time < now() + INTERVAL ${days} DAY
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
  days: PchainStakingDays = STAKING_WINDOW_DAYS,
): Promise<PchainStakingSeries | null> {
  const networkId = PCHAIN_NETWORK_IDS[network];
  if (networkId === undefined) return null;

  const cacheKey = `${network}:${days}`;
  const cached = pchainStakingCache.get(cacheKey);
  if (cached && Date.now() - cached.fetchedAt < DAILY_TTL_MS) {
    return cached.data;
  }

  try {
    type Row = { day: string; avax: string; n?: string; payouts?: string };
    const [rewardRows, validatorRows, delegatorRows] = await Promise.all([
      clickhouseFetch<Row>(sqlPchainDailyRewards(networkId, days), QUERY_TIMEOUT_MS),
      clickhouseFetch<Row>(
        sqlPchainUnlocks(networkId, "p_validator_snapshots", "weight", days),
        QUERY_TIMEOUT_MS,
      ),
      clickhouseFetch<Row>(
        sqlPchainUnlocks(networkId, "p_delegator_snapshots", "stake_amount", days),
        QUERY_TIMEOUT_MS,
      ),
    ]);

    const rewardsByDay = new Map(rewardRows.map((r) => [r.day, r]));
    const rewards = buildPastDates(days).map((iso) => ({
      date: iso,
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
    const unlocks = buildFutureDates(days).map((iso) => ({
      date: iso,
      avax: Math.round(unlocksByDay.get(iso)?.avax ?? 0),
      stakers: unlocksByDay.get(iso)?.stakers ?? 0,
    }));

    const data = { rewards, unlocks };
    pchainStakingCache.set(cacheKey, { data, fetchedAt: Date.now() });
    return data;
  } catch (err) {
    console.error('[explorer-clickhouse] pchain staking-series query failed:', err);
    return cached?.data ?? null;
  }
}

// --- P-Chain L1 operations ----------------------------------------------------
// The P-Chain's own view of the L1 world: every seat registration, weight
// set, disable, top-up, and subnet conversion is a P-Chain transaction it
// processed. Daily counts by type (the ops ledger) plus the all-time
// cumulative conversion curve — the ACP-77 adoption story.

export type PchainL1OpsDays = 30 | 90 | 365;

export interface PchainL1OpsPoint {
  date: string;
  register: number;
  setWeight: number;
  disable: number;
  topUp: number;
  convert: number;
}

export interface PchainL1ConversionPoint {
  /** YYYY-MM */
  month: string;
  cumulative: number;
}

export interface PchainL1Ops {
  ops: PchainL1OpsPoint[];
  conversions: PchainL1ConversionPoint[];
}

const L1_OP_TYPES = [
  "RegisterL1ValidatorTx",
  "SetL1ValidatorWeightTx",
  "DisableL1ValidatorTx",
  "IncreaseL1ValidatorBalanceTx",
  "ConvertSubnetToL1Tx",
] as const;

function sqlPchainL1Ops(networkId: number, days: PchainL1OpsDays): string {
  const types = L1_OP_TYPES.map((t) => `'${t}'`).join(",");
  return `
    SELECT toDate(block_time) AS day, tx_type, toString(count()) AS n
    FROM decoded_p_txs
    WHERE chain_id = ${networkId}
      AND tx_type IN (${types})
      AND block_time >= toDate(now() - INTERVAL ${days} DAY)
    GROUP BY day, tx_type
    ORDER BY day
    FORMAT JSONEachRow
  `;
}

function sqlPchainL1Conversions(networkId: number): string {
  return `
    SELECT toString(toStartOfMonth(block_time)) AS month, toString(count()) AS n
    FROM decoded_p_txs
    WHERE chain_id = ${networkId} AND tx_type = 'ConvertSubnetToL1Tx'
    GROUP BY month
    ORDER BY month
    FORMAT JSONEachRow
  `;
}

const pchainL1OpsCache = new Map<string, { data: PchainL1Ops; fetchedAt: number }>();

export async function getPchainL1Ops(
  network: string,
  days: PchainL1OpsDays = 30,
): Promise<PchainL1Ops | null> {
  const networkId = PCHAIN_NETWORK_IDS[network];
  if (networkId === undefined) return null;

  const cacheKey = `${network}:${days}`;
  const cached = pchainL1OpsCache.get(cacheKey);
  if (cached && Date.now() - cached.fetchedAt < DAILY_TTL_MS) {
    return cached.data;
  }

  try {
    type OpRow = { day: string; tx_type: string; n: string };
    type ConvRow = { month: string; n: string };
    const [opRows, convRows] = await Promise.all([
      clickhouseFetch<OpRow>(sqlPchainL1Ops(networkId, days), QUERY_TIMEOUT_MS),
      clickhouseFetch<ConvRow>(sqlPchainL1Conversions(networkId), QUERY_TIMEOUT_MS),
    ]);

    const byDay = new Map<string, PchainL1OpsPoint>();
    for (const iso of buildPastDates(days)) {
      byDay.set(iso, {
        date: formatDayLabel(iso),
        register: 0,
        setWeight: 0,
        disable: 0,
        topUp: 0,
        convert: 0,
      });
    }
    const FIELD: Record<string, keyof Omit<PchainL1OpsPoint, "date">> = {
      RegisterL1ValidatorTx: "register",
      SetL1ValidatorWeightTx: "setWeight",
      DisableL1ValidatorTx: "disable",
      IncreaseL1ValidatorBalanceTx: "topUp",
      ConvertSubnetToL1Tx: "convert",
    };
    for (const r of opRows) {
      const p = byDay.get(r.day);
      const f = FIELD[r.tx_type];
      if (p && f) p[f] += Number(r.n) || 0;
    }

    // continuous month axis from the first conversion to now — a
    // cumulative curve must never skip a quiet month
    const convByMonth = new Map(convRows.map((r) => [r.month.slice(0, 7), Number(r.n) || 0]));
    const conversions: PchainL1ConversionPoint[] = [];
    const months = [...convByMonth.keys()].sort();
    if (months.length) {
      let cum = 0;
      const now = new Date().toISOString().slice(0, 7);
      for (let d = new Date(`${months[0]}-01T00:00:00Z`); ; d.setUTCMonth(d.getUTCMonth() + 1)) {
        const m = d.toISOString().slice(0, 7);
        cum += convByMonth.get(m) ?? 0;
        conversions.push({ month: m, cumulative: cum });
        if (m >= now) break;
      }
    }

    const data = { ops: [...byDay.values()], conversions };
    pchainL1OpsCache.set(cacheKey, { data, fetchedAt: Date.now() });
    return data;
  } catch (err) {
    console.error("[explorer-clickhouse] pchain l1-ops query failed:", err);
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
// ~80M logs in a fortnight — give the classification room to run
const CCHAIN_ACTIVITY_TIMEOUT_MS = 60_000;

/** the page-clock windows the activity chart serves; 90 is the ceiling —
 *  the per-tx classification over raw_logs spills to disk past a month
 *  and a full year quadruples the spill for no extra story */
export type CchainActivityDays = 7 | 30 | 90;

function sqlCchainClassified(days: CchainActivityDays): string {
  // GROUP BY (day, tx) must hold every tx key in the window at once; the
  // box caps a query at ~9.3 GiB, which the 32-byte hashes blow past a
  // month. cityHash64 shrinks the key 4x and external_group_by lets the
  // rest spill to disk (~10s at 90d, fine behind the 15-minute cache).
  return `
    SELECT
      day,
      toString(countIf(cls = 3)) AS defi,
      toString(countIf(cls = 2)) AS nft,
      toString(countIf(cls = 1)) AS tokens
    FROM (
      SELECT
        toDate(block_time) AS day,
        cityHash64(transaction_hash) AS tx,
        max(multiIf(
          topic0 IN (unhex('${TOPIC_SWAP_V2}'), unhex('${TOPIC_SWAP_V3}'), unhex('${TOPIC_SWAP_LB}')), 3,
          topic0 = unhex('${TOPIC_TRANSFER}') AND topic3 IS NOT NULL, 2,
          topic0 IN (unhex('${TOPIC_1155_SINGLE}'), unhex('${TOPIC_1155_BATCH}')), 2,
          topic0 = unhex('${TOPIC_TRANSFER}'), 1,
          0
        )) AS cls
      FROM raw_logs
      WHERE chain_id = ${CCHAIN_EVM_ID}
        AND block_time >= toDate(now() - INTERVAL ${days} DAY)
      GROUP BY day, tx
    )
    GROUP BY day
    ORDER BY day
    SETTINGS max_bytes_before_external_group_by = 3000000000
    FORMAT JSONEachRow
  `;
}

function sqlCchainDailyTotals(days: CchainActivityDays): string {
  return `
    SELECT toDate(block_time) AS day, toString(count()) AS total
    FROM evm_txs
    WHERE chain_id = ${CCHAIN_EVM_ID}
      AND block_time >= toDate(now() - INTERVAL ${days} DAY)
    GROUP BY day
    ORDER BY day
    FORMAT JSONEachRow
  `;
}

const cchainActivityCache = new Map<
  CchainActivityDays,
  { data: CchainActivityPoint[]; fetchedAt: number }
>();
const cchainActivityInFlight = new Map<
  CchainActivityDays,
  Promise<CchainActivityPoint[] | null>
>();

/**
 * C-Chain activity for the page clock's window, split by on-chain behavior
 * (DeFi swaps / NFT transfers / token transfers / everything else), padded
 * to exactly `days` points. Mainnet only — that's the chain the log
 * archive covers. Cached per window; concurrent first-hits share one query
 * (the 90d classification takes ~10s cold).
 */
export async function getCchainDailyActivity(
  days: CchainActivityDays = 7,
): Promise<CchainActivityPoint[] | null> {
  const cached = cchainActivityCache.get(days);
  if (cached && Date.now() - cached.fetchedAt < DAILY_TTL_MS) {
    return cached.data;
  }
  const inFlight = cchainActivityInFlight.get(days);
  if (inFlight) return inFlight;

  const run = (async () => {
    try {
      const [classified, totals] = await Promise.all([
        clickhouseFetch<{ day: string; defi: string; nft: string; tokens: string }>(
          sqlCchainClassified(days),
          CCHAIN_ACTIVITY_TIMEOUT_MS,
        ),
        clickhouseFetch<{ day: string; total: string }>(sqlCchainDailyTotals(days), QUERY_TIMEOUT_MS),
      ]);
      const classifiedByDay = new Map(classified.map((r) => [r.day, r]));
      const totalsByDay = new Map(totals.map((r) => [r.day, Number(r.total) || 0]));
      const data = buildPastDates(days).map((iso) => {
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
      cchainActivityCache.set(days, { data, fetchedAt: Date.now() });
      return data;
    } catch (err) {
      console.error('[explorer-clickhouse] cchain activity query failed:', err);
      return cchainActivityCache.get(days)?.data ?? null;
    } finally {
      cchainActivityInFlight.delete(days);
    }
  })();
  cchainActivityInFlight.set(days, run);
  return run;
}

// --- Gas market (per-chain fee history + top consumers) -------------------
//
// Backs /api/gas-market/[chainId] → the explorer's Gas page. All three
// queries ride the raw_blocks/raw_txs sort key (chain_id, …) with the
// monthly partition pruned by block_time, so each runs in ~0.1s (verified
// 2026-07-21 against 43114).

export interface GasHourPoint {
  /** ISO hour, e.g. "2026-07-21T14:00" */
  t: string;
  /** base fee percentiles, nAVAX (= gwei of the native token) */
  p25: number;
  p50: number;
  p75: number;
  p95: number;
  /** total gas used in the hour */
  gas: number;
}

export interface GasDayPoint {
  /** ISO date */
  d: string;
  p25: number;
  p50: number;
  p75: number;
  p95: number;
  gas: number;
  /** mean per-block gas_used/gas_limit, percent */
  utilPct: number;
  blocks: number;
}

export interface GasConsumer {
  address: string;
  gas: number;
  txs: number;
  senders: number;
  /** total fees paid to this contract's txs, AVAX */
  feesAvax: number;
}

/** A blockspace buyer, aggregated to protocol level via the contract
 *  registry; unregistered contracts stay as single-address entries. */
export interface GasProtocol {
  /** registry protocol name, or the contract address for unknowns */
  key: string;
  name: string;
  /** registry category; null for unregistered contracts */
  category: string | null;
  /** dapp-page slug when the registry has one */
  slug: string | null;
  /** the contract address when the entry is a single unregistered contract */
  address: string | null;
  gas: number;
  txs: number;
  senders: number;
  feesAvax: number;
  /** share of the window's total gas, percent */
  sharePct: number;
  /** gas change vs the previous window, percent; null when it wasn't seen there */
  deltaPct: number | null;
}

export interface GasHeatCell {
  /** 1 = Monday … 7 = Sunday (ClickHouse toDayOfWeek) */
  dow: number;
  /** 0-23, UTC */
  hour: number;
  /** median base fee in the cell, nAVAX */
  p50: number;
}

export interface GasUtilBucket {
  /** bucket label, e.g. "5-10%" */
  bucket: string;
  blocks: number;
}

export interface GasSelector {
  /** 0x-prefixed 4-byte selector, or "native" for plain transfers */
  selector: string;
  /** full signature from Sourcify's signature database, e.g.
   *  "transfer(address,uint256)" — null when the selector is unknown */
  name: string | null;
  gas: number;
  txs: number;
}

export interface GasReverted {
  /** last-24h totals across all txs */
  gas: number;
  txs: number;
  revertedGas: number;
  revertedTxs: number;
}

export type GasRangeDays = 1 | 7 | 30 | 90;

export interface GasMarket {
  /** the window (days) the demand sections below are computed over */
  rangeDays: GasRangeDays;
  hourly: GasHourPoint[];
  daily: GasDayPoint[];
  /** blockspace buyers over the range, protocol-attributed */
  protocols: GasProtocol[];
  /** total gas across ALL txs in the range (denominator for shares) */
  rangeTotalGas: number;
  /** hour-of-week fee seasonality over the range (min a week, so every
   *  weekday cell has at least one sample) */
  heatmap: GasHeatCell[];
  /** block-fullness distribution over the range */
  histogram: GasUtilBucket[];
  /** demand by 4-byte method selector over the range */
  selectors: GasSelector[];
  reverted: GasReverted | null;
}

const GAS_MARKET_TTL_MS = 5 * 60 * 1000;
const GAS_DAILY_WINDOW_DAYS = 60;
const GAS_HOURLY_WINDOW_HOURS = 48;
// deep enough that registry protocols aggregate meaningfully before the cut
const GAS_CONSUMERS_LIMIT = 60;
// protocol entries surfaced to the page; the rest fold into "Long tail"
const GAS_PROTOCOLS_SHOWN = 13;

function sqlGasHourly(chainId: number): string {
  return `
    SELECT
      formatDateTime(toStartOfHour(block_time), '%FT%R') AS t,
      round(quantile(0.25)(base_fee_per_gas) / 1e9, 4) AS p25,
      round(quantile(0.5)(base_fee_per_gas) / 1e9, 4) AS p50,
      round(quantile(0.75)(base_fee_per_gas) / 1e9, 4) AS p75,
      round(quantile(0.95)(base_fee_per_gas) / 1e9, 4) AS p95,
      toString(sum(toUInt64(gas_used))) AS gas
    FROM raw_blocks
    WHERE chain_id = ${chainId}
      AND block_time >= now() - INTERVAL ${GAS_HOURLY_WINDOW_HOURS} HOUR
    GROUP BY t
    ORDER BY t
    FORMAT JSONEachRow
  `;
}

function sqlGasDaily(chainId: number, days: number = GAS_DAILY_WINDOW_DAYS): string {
  return `
    SELECT
      toString(toDate(block_time)) AS d,
      round(quantile(0.25)(base_fee_per_gas) / 1e9, 4) AS p25,
      round(quantile(0.5)(base_fee_per_gas) / 1e9, 4) AS p50,
      round(quantile(0.75)(base_fee_per_gas) / 1e9, 4) AS p75,
      round(quantile(0.95)(base_fee_per_gas) / 1e9, 4) AS p95,
      toString(sum(toUInt64(gas_used))) AS gas,
      round(avg(gas_used / gas_limit) * 100, 2) AS utilPct,
      toString(count()) AS blocks
    FROM raw_blocks
    WHERE chain_id = ${chainId}
      AND block_time >= toDate(now() - INTERVAL ${days} DAY)
    GROUP BY d
    ORDER BY d
    FORMAT JSONEachRow
  `;
}

function sqlGasHeatmap(chainId: number, days: number): string {
  return `
    SELECT
      toDayOfWeek(block_time) AS dow,
      toHour(block_time) AS hour,
      round(quantile(0.5)(base_fee_per_gas) / 1e9, 4) AS p50
    FROM raw_blocks
    WHERE chain_id = ${chainId}
      AND block_time >= now() - INTERVAL ${days} DAY
    GROUP BY dow, hour
    ORDER BY dow, hour
    FORMAT JSONEachRow
  `;
}

// Post-Etna the C-Chain idles near 10% full, so the buckets are dense at
// the low end where the signal lives.
const UTIL_BUCKETS = "['0-2%','2-5%','5-10%','10-15%','15-25%','25-50%','50-100%']";

function sqlGasHistogram(chainId: number, hours: number): string {
  return `
    SELECT
      multiIf(
        u < 0.02, '0-2%',
        u < 0.05, '2-5%',
        u < 0.10, '5-10%',
        u < 0.15, '10-15%',
        u < 0.25, '15-25%',
        u < 0.50, '25-50%',
        '50-100%'
      ) AS bucket,
      toString(count()) AS blocks
    FROM (
      SELECT gas_used / gas_limit AS u
      FROM raw_blocks
      WHERE chain_id = ${chainId}
        AND block_time >= now() - INTERVAL ${hours} HOUR
    )
    GROUP BY bucket
    ORDER BY indexOf(${UTIL_BUCKETS}, bucket)
    FORMAT JSONEachRow
  `;
}

function sqlGasSelectors(chainId: number, hours: number): string {
  // plain value transfers carry no calldata — fold them into one
  // "native" row so the decomposition covers all gas, not just contracts
  return `
    SELECT
      if(length(input) >= 4, concat('0x', lower(hex(substring(input, 1, 4)))), 'native') AS selector,
      toString(sum(toUInt64(gas_used))) AS gas,
      toString(count()) AS txs
    FROM raw_txs
    WHERE chain_id = ${chainId}
      AND block_time >= now() - INTERVAL ${hours} HOUR
    GROUP BY selector
    ORDER BY sum(toUInt64(gas_used)) DESC
    LIMIT 10
    FORMAT JSONEachRow
  `;
}

// Selector → signature via Sourcify's signature database (the openchain
// dataset Sourcify took over). One batched lookup per gas-market build;
// a selector's decoding never changes, so answers cache for the process
// lifetime — including definitive misses, but not transport failures.
const SIGNATURE_LOOKUP_URL = "https://api.4byte.sourcify.dev/signature-database/v1/lookup";
const SIGNATURE_LOOKUP_TIMEOUT_MS = 5_000;
const selectorNameCache = new Map<string, string | null>();

async function decodeSelectorNames(selectors: string[]): Promise<Map<string, string>> {
  const pending = selectors.filter(
    (s) => /^0x[0-9a-f]{8}$/.test(s) && !selectorNameCache.has(s),
  );
  if (pending.length > 0) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), SIGNATURE_LOOKUP_TIMEOUT_MS);
    try {
      const response = await fetch(
        `${SIGNATURE_LOOKUP_URL}?function=${pending.join(",")}&filter=true`,
        { signal: controller.signal },
      );
      if (response.ok) {
        const body = (await response.json()) as {
          result?: {
            function?: Record<string, { name: string; hasVerifiedContract?: boolean }[] | null>;
          };
        };
        const fns = body.result?.function ?? {};
        for (const sel of pending) {
          const candidates = fns[sel] ?? [];
          // collisions are real (mint, 0x00000000 spam) — trust a signature
          // seen in a verified contract over a merely-submitted one
          const best =
            candidates.find((c) => c.hasVerifiedContract) ?? candidates[0];
          selectorNameCache.set(sel, best?.name ?? null);
        }
      }
    } catch {
      // decoding is decorative — undecoded selectors render as hex
    } finally {
      clearTimeout(timeoutId);
    }
  }
  const names = new Map<string, string>();
  for (const s of selectors) {
    const name = selectorNameCache.get(s);
    if (name) names.set(s, name);
  }
  return names;
}

function sqlGasReverted(chainId: number, hours: number): string {
  return `
    SELECT
      toString(sum(toUInt64(gas_used))) AS gas,
      toString(count()) AS txs,
      toString(sumIf(toUInt64(gas_used), success = 0)) AS revertedGas,
      toString(countIf(success = 0)) AS revertedTxs
    FROM raw_txs
    WHERE chain_id = ${chainId}
      AND block_time >= now() - INTERVAL ${hours} HOUR
    FORMAT JSONEachRow
  `;
}

function sqlGasConsumers(chainId: number, fromHoursAgo: number, toHoursAgo: number): string {
  // effective price (gas_price) × gas_used = what senders actually paid;
  // on the C-Chain all of it burns. Windowed [from, to) hours ago so the
  // same builder serves the current window and the delta baseline.
  return `
    SELECT
      concat('0x', lower(hex(\`to\`))) AS address,
      toString(sum(toUInt64(gas_used))) AS gas,
      toString(count()) AS txs,
      toString(uniq(\`from\`)) AS senders,
      round(sum(toUInt64(gas_used) * gas_price) / 1e18, 4) AS feesAvax
    FROM raw_txs
    WHERE chain_id = ${chainId}
      AND block_time >= now() - INTERVAL ${fromHoursAgo} HOUR
      AND block_time < now() - INTERVAL ${toHoursAgo} HOUR
      AND \`to\` IS NOT NULL
    GROUP BY \`to\`
    ORDER BY sum(toUInt64(gas_used)) DESC
    LIMIT ${GAS_CONSUMERS_LIMIT}
    FORMAT JSONEachRow
  `;
}

/* Fold the address-level consumer rows into protocol groups via the
   contract registry (the same attribution the retired /stats/dapps/treemap
   used, minus its full-history scans). Unregistered contracts stay as
   single-address entries so sourcify names can label them client-side.
   Caveats, deliberate: a protocol's senders are summed across its
   contracts (a wallet touching router + pool counts twice), and deltas
   compare top-${GAS_CONSUMERS_LIMIT} windows, so tail entries can miss a
   baseline — those show as null, not 0. */
function aggregateProtocols(
  current: GasConsumer[],
  previous: GasConsumer[],
  rangeTotalGas: number,
): GasProtocol[] {
  const groupKey = (address: string) => getContractInfo(address)?.protocol ?? address;

  const prevGas = new Map<string, number>();
  for (const c of previous) {
    const k = groupKey(c.address);
    prevGas.set(k, (prevGas.get(k) ?? 0) + c.gas);
  }

  const groups = new Map<string, GasProtocol>();
  for (const c of current) {
    const info = getContractInfo(c.address);
    const key = info?.protocol ?? c.address;
    const existing = groups.get(key);
    if (existing) {
      existing.gas += c.gas;
      existing.txs += c.txs;
      existing.senders += c.senders;
      existing.feesAvax += c.feesAvax;
    } else {
      groups.set(key, {
        key,
        name: info?.protocol ?? c.address,
        category: info?.category ?? null,
        slug: info ? (PROTOCOL_SLUGS[info.protocol] ?? null) : null,
        address: info ? null : c.address,
        gas: c.gas,
        txs: c.txs,
        senders: c.senders,
        feesAvax: c.feesAvax,
        sharePct: 0,
        deltaPct: null,
      });
    }
  }

  const ranked = Array.from(groups.values()).sort((a, b) => b.gas - a.gas);
  const shown = ranked.slice(0, GAS_PROTOCOLS_SHOWN);
  const tail = ranked.slice(GAS_PROTOCOLS_SHOWN);
  if (tail.length) {
    shown.push({
      key: '__longtail',
      name: `Long tail · ${tail.length} contracts`,
      category: null,
      slug: null,
      address: null,
      gas: tail.reduce((s, p) => s + p.gas, 0),
      txs: tail.reduce((s, p) => s + p.txs, 0),
      senders: tail.reduce((s, p) => s + p.senders, 0),
      feesAvax: tail.reduce((s, p) => s + p.feesAvax, 0),
      sharePct: 0,
      deltaPct: null,
    });
  }

  for (const p of shown) {
    p.sharePct = rangeTotalGas > 0 ? (p.gas / rangeTotalGas) * 100 : 0;
    p.feesAvax = Math.round(p.feesAvax * 10000) / 10000;
    if (p.key !== '__longtail') {
      const prev = prevGas.get(p.key);
      p.deltaPct = prev ? ((p.gas - prev) / prev) * 100 : null;
    }
  }
  return shown;
}

const gasMarketCache = new Map<string, { data: GasMarket; fetchedAt: number }>();
const gasMarketInFlight = new Map<string, Promise<GasMarket | null>>();

// The box caps the readonly user at 4 concurrent queries with instant
// rejection (TOO_MANY_SIMULTANEOUS_QUERIES) — same reason
// lib/clickhouse/client.ts gates at 3. Run the gas-market batch through a
// 3-slot pool, leaving headroom for other routes on the shared user.
async function allLimited<T>(limit: number, tasks: (() => Promise<T>)[]): Promise<T[]> {
  const results: T[] = new Array(tasks.length);
  let next = 0;
  const worker = async () => {
    while (next < tasks.length) {
      const i = next++;
      results[i] = await tasks[i]();
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, worker));
  return results;
}

interface RawConsumerRow {
  address: string;
  gas: string;
  txs: string;
  senders: string;
  feesAvax: number;
}

function parseConsumers(rows: RawConsumerRow[]): GasConsumer[] {
  return rows.map((r) => ({
    address: r.address,
    gas: Number(r.gas) || 0,
    txs: Number(r.txs) || 0,
    senders: Number(r.senders) || 0,
    feesAvax: Number(r.feesAvax) || 0,
  }));
}

/**
 * Gas market snapshot for one EVM chain. The fee time-series (48h hourly,
 * 60d daily) and seasonality heatmap are range-independent; the demand
 * sections (protocols, selectors, histogram, reverted) are computed over
 * `rangeDays`, with protocol deltas against the preceding window of the
 * same length. Returns null when the chain has no rows in raw_blocks.
 */
export async function getGasMarket(
  evmChainId: number,
  rangeDays: GasRangeDays = 1,
): Promise<GasMarket | null> {
  const cacheKey = `${evmChainId}:${rangeDays}`;
  const cached = gasMarketCache.get(cacheKey);
  if (cached && Date.now() - cached.fetchedAt < GAS_MARKET_TTL_MS) {
    return cached.data;
  }
  const inFlight = gasMarketInFlight.get(cacheKey);
  if (inFlight) return inFlight;

  const hours = rangeDays * 24;

  const fetchPromise = (async (): Promise<GasMarket | null> => {
    try {
      const [
        hourlyRows,
        dailyRows,
        consumerRows,
        prevConsumerRows,
        heatRows,
        histRows,
        selectorRows,
        revertedRows,
      ] = (await allLimited(3, [
        () => clickhouseFetch(sqlGasHourly(evmChainId), QUERY_TIMEOUT_MS),
        () => clickhouseFetch(sqlGasDaily(evmChainId), QUERY_TIMEOUT_MS),
        () => clickhouseFetch(sqlGasConsumers(evmChainId, hours, 0), QUERY_TIMEOUT_MS),
        () => clickhouseFetch(sqlGasConsumers(evmChainId, hours * 2, hours), QUERY_TIMEOUT_MS),
        () => clickhouseFetch(sqlGasHeatmap(evmChainId, Math.max(7, rangeDays)), QUERY_TIMEOUT_MS),
        () => clickhouseFetch(sqlGasHistogram(evmChainId, hours), QUERY_TIMEOUT_MS),
        () => clickhouseFetch(sqlGasSelectors(evmChainId, hours), QUERY_TIMEOUT_MS),
        () => clickhouseFetch(sqlGasReverted(evmChainId, hours), QUERY_TIMEOUT_MS),
      ] as (() => Promise<unknown>)[])) as [
        { t: string; p25: number; p50: number; p75: number; p95: number; gas: string }[],
        {
          d: string;
          p25: number;
          p50: number;
          p75: number;
          p95: number;
          gas: string;
          utilPct: number;
          blocks: string;
        }[],
        RawConsumerRow[],
        RawConsumerRow[],
        { dow: number; hour: number; p50: number }[],
        { bucket: string; blocks: string }[],
        { selector: string; gas: string; txs: string }[],
        { gas: string; txs: string; revertedGas: string; revertedTxs: string }[],
      ];

      if (dailyRows.length === 0 && hourlyRows.length === 0) return null;

      const selectorNames = await decodeSelectorNames(selectorRows.map((r) => r.selector));
      const rev = revertedRows[0];
      const rangeTotalGas = rev ? Number(rev.gas) || 0 : 0;
      const data: GasMarket = {
        rangeDays,
        rangeTotalGas,
        hourly: hourlyRows.map((r) => ({
          t: r.t,
          p25: Number(r.p25) || 0,
          p50: Number(r.p50) || 0,
          p75: Number(r.p75) || 0,
          p95: Number(r.p95) || 0,
          gas: Number(r.gas) || 0,
        })),
        daily: dailyRows.map((r) => ({
          d: r.d,
          p25: Number(r.p25) || 0,
          p50: Number(r.p50) || 0,
          p75: Number(r.p75) || 0,
          p95: Number(r.p95) || 0,
          gas: Number(r.gas) || 0,
          utilPct: Number(r.utilPct) || 0,
          blocks: Number(r.blocks) || 0,
        })),
        protocols: aggregateProtocols(
          parseConsumers(consumerRows),
          parseConsumers(prevConsumerRows),
          rangeTotalGas,
        ),
        heatmap: heatRows.map((r) => ({
          dow: Number(r.dow) || 0,
          hour: Number(r.hour) || 0,
          p50: Number(r.p50) || 0,
        })),
        histogram: histRows.map((r) => ({
          bucket: r.bucket,
          blocks: Number(r.blocks) || 0,
        })),
        selectors: selectorRows.map((r) => ({
          selector: r.selector,
          name: selectorNames.get(r.selector) ?? null,
          gas: Number(r.gas) || 0,
          txs: Number(r.txs) || 0,
        })),
        reverted: rev
          ? {
              gas: rangeTotalGas,
              txs: Number(rev.txs) || 0,
              revertedGas: Number(rev.revertedGas) || 0,
              revertedTxs: Number(rev.revertedTxs) || 0,
            }
          : null,
      };
      gasMarketCache.set(cacheKey, { data, fetchedAt: Date.now() });
      return data;
    } catch (err) {
      console.error(`[explorer-clickhouse] gas market query failed for ${evmChainId}:`, err);
      return gasMarketCache.get(cacheKey)?.data ?? null;
    } finally {
      gasMarketInFlight.delete(cacheKey);
    }
  })();

  gasMarketInFlight.set(cacheKey, fetchPromise);
  return fetchPromise;
}

/* ---------------------------------------------------------------- */
/* per-metric deep history — the gas detail sheets' long spine        */
/* ---------------------------------------------------------------- */

export type GasHistoryDays = 7 | 30 | 90 | 365;

// daily buckets close once a day; an hour of staleness is invisible
const GAS_HISTORY_TTL_MS = 60 * 60 * 1000;
const gasHistoryCache = new Map<string, { data: GasDayPoint[]; fetchedAt: number }>();
const gasHistoryInFlight = new Map<string, Promise<GasDayPoint[]>>();

/**
 * Daily fee percentiles + utilization over up to a year. Blocks-only —
 * raw_blocks stays cheap even at 365d, unlike the raw_txs demand
 * aggregations that cap the market snapshot at 90d.
 */
export async function getGasHistory(evmChainId: number, days: GasHistoryDays): Promise<GasDayPoint[]> {
  const key = `${evmChainId}:${days}`;
  const cached = gasHistoryCache.get(key);
  if (cached && Date.now() - cached.fetchedAt < GAS_HISTORY_TTL_MS) return cached.data;
  const inFlight = gasHistoryInFlight.get(key);
  if (inFlight) return inFlight;

  const fetchPromise = (async (): Promise<GasDayPoint[]> => {
    try {
      const rows = (await clickhouseFetch(sqlGasDaily(evmChainId, days), QUERY_TIMEOUT_MS)) as {
        d: string;
        p25: number;
        p50: number;
        p75: number;
        p95: number;
        gas: string;
        utilPct: number;
        blocks: string;
      }[];
      const data: GasDayPoint[] = rows.map((r) => ({
        d: r.d,
        p25: Number(r.p25) || 0,
        p50: Number(r.p50) || 0,
        p75: Number(r.p75) || 0,
        p95: Number(r.p95) || 0,
        gas: Number(r.gas) || 0,
        utilPct: Number(r.utilPct) || 0,
        blocks: Number(r.blocks) || 0,
      }));
      gasHistoryCache.set(key, { data, fetchedAt: Date.now() });
      return data;
    } catch (err) {
      console.error(`[explorer-clickhouse] gas history query failed for ${evmChainId}:`, err);
      return gasHistoryCache.get(key)?.data ?? [];
    } finally {
      gasHistoryInFlight.delete(key);
    }
  })();

  gasHistoryInFlight.set(key, fetchPromise);
  return fetchPromise;
}

// --- Accounts leaderboards -----------------------------------------------

export interface AccountLeader {
  /** 0x-prefixed EVM address */
  address: string;
  txs: number;
  gas: number;
  /** distinct counterparties over the range: senders for a called
   *  address, destinations for a sender */
  counterparties: number;
  /** native value moved through the address over the range, whole tokens */
  native: number;
  /** fees the traffic paid, whole native tokens */
  feesNative: number;
}

export interface AccountsActivity {
  rangeDays: GasRangeDays;
  /** most-called addresses (contracts and hot receivers) over the range */
  called: AccountLeader[];
  /** busiest senders over the range */
  senders: AccountLeader[];
}

const ACCOUNTS_TTL_MS = 5 * 60 * 1000;
const ACCOUNTS_LIMIT = 15;

interface RawLeaderRow {
  address: string;
  txs: string;
  gas: string;
  counterparties: string;
  native: number;
  feesNative: number;
}

// The two sides of every transaction, each ranked by how often it appears.
// Same shape either way; `col` picks the perspective and `other` counts the
// far side. Grouping `to` includes EOAs that just receive a lot — that's
// signal too (bridges, exchange deposits), so they rank rather than filter.
function sqlAccountLeaders(chainId: number, hours: number, col: "to" | "from"): string {
  const other = col === "to" ? "from" : "to";
  return `
    SELECT
      concat('0x', lower(hex(\`${col}\`))) AS address,
      toString(count()) AS txs,
      toString(sum(toUInt64(gas_used))) AS gas,
      toString(uniq(\`${other}\`)) AS counterparties,
      round(sum(value) / 1e18, 4) AS native,
      round(sum(toUInt64(gas_used) * gas_price) / 1e18, 4) AS feesNative
    FROM raw_txs
    WHERE chain_id = ${chainId}
      AND block_time >= now() - INTERVAL ${hours} HOUR
      AND \`${col}\` IS NOT NULL
    GROUP BY \`${col}\`
    ORDER BY count() DESC
    LIMIT ${ACCOUNTS_LIMIT}
    FORMAT JSONEachRow
  `;
}

function parseLeaders(rows: RawLeaderRow[]): AccountLeader[] {
  return rows.map((r) => ({
    address: r.address,
    txs: Number(r.txs) || 0,
    gas: Number(r.gas) || 0,
    counterparties: Number(r.counterparties) || 0,
    native: Number(r.native) || 0,
    feesNative: Number(r.feesNative) || 0,
  }));
}

const accountsCache = new Map<string, { data: AccountsActivity; fetchedAt: number }>();
const accountsInFlight = new Map<string, Promise<AccountsActivity | null>>();

/**
 * Who the chain's traffic actually is, over `rangeDays`: the most-called
 * addresses and the busiest senders. Returns null when the chain has no
 * rows in raw_txs (not ingested), so the route can 404 and the page can
 * say so honestly.
 */
export async function getAccountsActivity(
  evmChainId: number,
  rangeDays: GasRangeDays = 1,
): Promise<AccountsActivity | null> {
  const cacheKey = `${evmChainId}:${rangeDays}`;
  const cached = accountsCache.get(cacheKey);
  if (cached && Date.now() - cached.fetchedAt < ACCOUNTS_TTL_MS) {
    return cached.data;
  }
  const inFlight = accountsInFlight.get(cacheKey);
  if (inFlight) return inFlight;

  const hours = rangeDays * 24;
  const fetchPromise = (async (): Promise<AccountsActivity | null> => {
    try {
      const [calledRows, senderRows] = (await allLimited(2, [
        () => clickhouseFetch(sqlAccountLeaders(evmChainId, hours, "to"), QUERY_TIMEOUT_MS),
        () => clickhouseFetch(sqlAccountLeaders(evmChainId, hours, "from"), QUERY_TIMEOUT_MS),
      ] as (() => Promise<unknown>)[])) as [RawLeaderRow[], RawLeaderRow[]];

      if (calledRows.length === 0 && senderRows.length === 0) return null;

      const data: AccountsActivity = {
        rangeDays,
        called: parseLeaders(calledRows),
        senders: parseLeaders(senderRows),
      };
      accountsCache.set(cacheKey, { data, fetchedAt: Date.now() });
      return data;
    } catch (err) {
      console.error(`[explorer-clickhouse] accounts query failed for ${evmChainId}:`, err);
      return accountsCache.get(cacheKey)?.data ?? null;
    } finally {
      accountsInFlight.delete(cacheKey);
    }
  })();

  accountsInFlight.set(cacheKey, fetchPromise);
  return fetchPromise;
}

export const __internal = {
  sqlCumulativeTxs,
  sqlDailyTxs,
  buildPastDates,
  formatDayLabel,
  trackedEvmChainIds,
};
