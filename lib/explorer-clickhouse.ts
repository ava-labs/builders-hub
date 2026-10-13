// The explorer's reads through stats-api, which runs them on ClickHouse: a chain's lifetime transaction count, the
// daily transactions of every tracked chain, P-Chain L1 operations, C-Chain daily activity, the gas market and its
// history, and a chain's busiest accounts. Each read keeps a stale-while-revalidate cache with one request in flight
// per key, the pattern of `lib/icm-clickhouse.ts`.
//
// Fuji (chain_id 43113) has an ingestion watermark frozen at 2021-12-23, so its lifetime count and recent days show
// that frozen state until upstream indexing resumes.

import l1ChainsData from '@/constants/l1-chains.json';
import { getContractInfo, PROTOCOL_SLUGS } from '@/lib/contracts';
import { statsApi } from '@/lib/stats-api';
import { toDayPoint, toHourPoint, type FeeFloor, type RawGasDay, type RawGasHour } from '@/lib/gas-history-rows';

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

// --- Cumulative tx count per chain --------------------------------------

interface CumulativeCacheEntry {
  count: number;
  fetchedAt: number;
}

const cumulativeCache = new Map<number, CumulativeCacheEntry>();
const cumulativeInFlight = new Map<number, Promise<number>>();

async function fetchCumulativeFromCh(chainId: number): Promise<number> {
  const body = await statsApi<{ txCount?: number }>(
    `/evm-api/${chainId}/cumulative-txs`,
    QUERY_TIMEOUT_MS,
  );
  const n = Number(body?.txCount);
  return Number.isFinite(n) ? n : 0;
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

function buildPastDates(days: number = DAILY_WINDOW_DAYS, completeOnly = false): string[] {
  // YYYY-MM-DD entries for the last `days` days, oldest first, ending
  // today (UTC), or yesterday with `completeOnly` so a partial day never
  // reads as a collapse. Used to pad zero-activity days so every chart
  // always renders exactly its window's point count.
  const out: string[] = [];
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  if (completeOnly) today.setUTCDate(today.getUTCDate() - 1);
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
  const body = await statsApi<{ chains?: { chainId: number; day: string; txCount: number }[] }>(
    `/evm-api/daily-txs?days=${DAILY_WINDOW_DAYS}`,
    QUERY_TIMEOUT_MS,
  );
  if (!body?.chains) return { data: new Map(), fetchedAt: Date.now() };
  const rows: DailyRow[] = body.chains.map((c) => ({
    chain_id: c.chainId,
    day: c.day,
    tx_count: String(c.txCount),
  }));

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
    const body = await statsApi<{
      ops?: { date: string; register: number; setWeight: number; disable: number; topUp: number; convert: number }[];
      conversions?: { month: string; cumulative: number }[];
    }>(`/api/${network}/l1-ops?days=${days}`, QUERY_TIMEOUT_MS);
    if (!body?.ops) throw new Error("l1-ops unavailable");

    const data: PchainL1Ops = {
      ops: body.ops.map((o) => ({ ...o, date: formatDayLabel(o.date) })),
      conversions: body.conversions ?? [],
    };
    pchainL1OpsCache.set(cacheKey, { data, fetchedAt: Date.now() });
    return data;
  } catch (err) {
    console.error("[explorer-clickhouse] pchain l1-ops fetch failed:", err);
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


const CCHAIN_EVM_ID = 43114;
// ~80M logs in a fortnight — give the classification room to run
const CCHAIN_ACTIVITY_TIMEOUT_MS = 60_000;

/** the page-clock windows the activity chart serves; 90 is the ceiling —
 *  the per-tx classification over raw_logs spills to disk past a month
 *  and a full year quadruples the spill for no extra story */
export type CchainActivityDays = 7 | 30 | 90;

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
      const body = await statsApi<{
        activity?: { day: string; defi: number; nft: number; tokens: number; other: number }[];
      }>(`/evm-api/${CCHAIN_EVM_ID}/activity?days=${days}`, CCHAIN_ACTIVITY_TIMEOUT_MS);
      if (!body?.activity) throw new Error("activity unavailable");

      // The endpoint returns only days that had traffic; pad to the full
      // window so the chart keeps a stable x-axis. Complete UTC days only:
      // the same window the chain-stats indexer sums, so the two agree.
      const byDay = new Map(body.activity.map((a) => [a.day, a]));
      const data = buildPastDates(days, true).map((iso) => {
        const a = byDay.get(iso);
        return {
          date: formatDayLabel(iso),
          defi: a?.defi ?? 0,
          nft: a?.nft ?? 0,
          tokens: a?.tokens ?? 0,
          other: a?.other ?? 0,
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
  floor: FeeFloor | null;
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
  floor: FeeFloor | null;
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
  /** the group's busiest contract in the window, where a click on the protocol lands */
  topContract: string | null;
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
// protocol entries surfaced to the page; the rest fold into "Long tail"
const GAS_PROTOCOLS_SHOWN = 13;

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
        // rows arrive busiest first, so the first contract seen leads the group
        topContract: c.address,
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
      topContract: null,
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

  const fetchPromise = (async (): Promise<GasMarket | null> => {
    try {
      // Two endpoints: the fee time-series is range-independent and cached on
      // its own, the demand side is windowed. Fetched together.
      const [history, market] = await Promise.all([
        statsApi<{
          hourly?: RawGasHour[];
          daily?: RawGasDay[];
        }>(`/evm-api/${evmChainId}/gas-history`, QUERY_TIMEOUT_MS),
        statsApi<{
          consumers?: RawConsumerRow[];
          consumersPrevious?: RawConsumerRow[];
          selectors?: { selector: string; gas: string; txs: number }[];
          heatmap?: { dow: number; hour: number; p50: number }[];
          histogram?: { bucket: string; blocks: number }[];
          reverted?: { gas: string; txs: number; revertedGas: string; revertedTxs: number };
        }>(`/evm-api/${evmChainId}/gas-market?days=${rangeDays}`, QUERY_TIMEOUT_MS),
      ]);
      // A 404 from gas-market means the chain is not indexed at all.
      if (!market) return null;

      const hourlyRows = history?.hourly ?? [];
      const dailyRows = history?.daily ?? [];
      const consumerRows = market.consumers ?? [];
      const prevConsumerRows = market.consumersPrevious ?? [];
      const heatRows = market.heatmap ?? [];
      const histRows = (market.histogram ?? []).map((h) => ({ bucket: h.bucket, blocks: String(h.blocks) }));
      const selectorRows = (market.selectors ?? []).map((x) => ({ ...x, txs: String(x.txs) }));
      const revertedRows = market.reverted
        ? [{ ...market.reverted, txs: String(market.reverted.txs), revertedTxs: String(market.reverted.revertedTxs) }]
        : [];

      if (dailyRows.length === 0 && hourlyRows.length === 0) return null;

      const selectorNames = await decodeSelectorNames(selectorRows.map((r) => r.selector));
      const rev = revertedRows[0];
      const rangeTotalGas = rev ? Number(rev.gas) || 0 : 0;
      const data: GasMarket = {
        rangeDays,
        rangeTotalGas,
        hourly: hourlyRows.map(toHourPoint),
        daily: dailyRows.map(toDayPoint),
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
      const body = await statsApi<{
        daily?: RawGasDay[];
      }>(`/evm-api/${evmChainId}/gas-history`, QUERY_TIMEOUT_MS);
      if (!body?.daily) throw new Error("gas-history unavailable");
      const data = body.daily.slice(-days).map(toDayPoint);
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

interface RawLeaderRow {
  address: string;
  txs: string;
  gas: string;
  counterparties: string;
  native: number;
  feesNative: number;
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

  const fetchPromise = (async (): Promise<AccountsActivity | null> => {
    try {
      const body = await statsApi<{
        called?: RawLeaderRow[];
        senders?: RawLeaderRow[];
      }>(`/evm-api/${evmChainId}/accounts?days=${rangeDays}`, QUERY_TIMEOUT_MS);
      if (!body) return null;
      const calledRows = body.called ?? [];
      const senderRows = body.senders ?? [];
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

