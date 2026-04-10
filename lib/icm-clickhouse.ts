import l1ChainsData from "@/constants/l1-chains.json";
import { ICMDataPoint } from "@/types/stats";
import bs58 from "bs58";
import { createPublicClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { avalanche } from "viem/chains";
import { x402Client } from "@x402/core/client";
import { wrapFetchWithPayment } from "@x402/fetch";
import { registerExactEvmScheme } from "@x402/evm/exact/client";
import { toClientEvmSigner } from "@x402/evm";

type L1ChainEntry = {
  chainId: string;
  chainName: string;
  chainLogoURI?: string;
  color?: string;
  isTestnet?: boolean;
  blockchainId?: string;
};

const CLICKHOUSE_URL = process.env.CLICKHOUSE_URL || "";
const CLICKHOUSE_PASSWORD = process.env.CLICKHOUSE_PASSWORD || "";
const QUERY_TIMEOUT_MS = 10_000;
const CONTRACT_FEES_QUERY_TIMEOUT_MS = 60_000;

// x402 payer wallet — signs USDC transfer authorizations on Avalanche C-Chain
const X402_PAYER_PRIVATE_KEY = process.env.X402_PAYER_PRIVATE_KEY || "";

async function fetchWithTimeout(
  fetchFn: typeof fetch,
  url: string,
  init: RequestInit,
  timeoutMs = QUERY_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetchFn(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

function createX402Fetch() {
  if (!CLICKHOUSE_URL || !X402_PAYER_PRIVATE_KEY) return null;

  try {
    const account = privateKeyToAccount(X402_PAYER_PRIVATE_KEY as `0x${string}`);
    const publicClient = createPublicClient({ chain: avalanche, transport: http() });
    const signer = toClientEvmSigner(account as Parameters<typeof toClientEvmSigner>[0], publicClient);
    const client = new x402Client();
    registerExactEvmScheme(client, { signer });
    return wrapFetchWithPayment(fetch, client);
  } catch (err) {
    console.warn("[icm-clickhouse] Failed to create x402 fetch client:", err);
    return null;
  }
}

const x402Fetch = createX402Fetch();

async function queryClickHouseX402<T = Record<string, unknown>>(sql: string): Promise<T[]> {
  const proxyUrl = CLICKHOUSE_URL.endsWith("/query") ? CLICKHOUSE_URL : CLICKHOUSE_URL.replace(/\/$/, "") + "/query";

  const response = await fetchWithTimeout(x402Fetch!, proxyUrl, {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    body: sql,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`ClickHouse x402 proxy query failed (${response.status}): ${text.slice(0, 300)}`);
  }

  const text = (await response.text()).trim();
  if (!text) return [];

  return text.split("\n").map((line) => JSON.parse(line) as T);
}

async function queryClickHouseDirect<T = Record<string, unknown>>(
  sql: string,
  timeoutMs = QUERY_TIMEOUT_MS
): Promise<T[]> {
  if (!CLICKHOUSE_URL) {
    console.warn("[icm-clickhouse] CLICKHOUSE_URL not set – returning empty results");
    return [];
  }

  const url = CLICKHOUSE_URL.endsWith("/") ? CLICKHOUSE_URL : CLICKHOUSE_URL + "/";

  const response = await fetchWithTimeout(fetch, url, {
    method: "POST",
    headers: {
      "X-ClickHouse-User": "readonly",
      "X-ClickHouse-Key": CLICKHOUSE_PASSWORD,
      "X-ClickHouse-Database": "default",
      "Content-Type": "text/plain",
    },
    body: sql,
  }, timeoutMs);

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`ClickHouse direct query failed (${response.status}): ${text.slice(0, 300)}`);
  }

  const text = (await response.text()).trim();
  if (!text) return [];

  return text.split("\n").map((line) => JSON.parse(line) as T);
}

async function queryClickHouse<T = Record<string, unknown>>(sql: string): Promise<T[]> {
  // Temporarily bypass the x402 proxy and read directly from ClickHouse.
  // if (CLICKHOUSE_URL && x402Fetch) {
  //   try {
  //     return await queryClickHouseX402<T>(sql);
  //   } catch (err) {
  //     console.warn("[icm-clickhouse] x402 proxy failed, falling back to direct ClickHouse:", err);
  //   }
  // }
  return queryClickHouseDirect<T>(sql);
}

// ReceiveCrossChainMessage(bytes32,bytes32,address,address,(uint256,address,bytes32,address,uint256,address[],(uint256,address)[],bytes))
const RECEIVE_CROSS_CHAIN_MSG_TOPIC0 = "292EE90BBAF70B5D4936025E09D56BA08F3E421156B6A568CF3C2840D9343E34";

// SendCrossChainMessage(bytes32,bytes32,(uint256,address,bytes32,address,uint256,address[],(uint256,address)[],bytes),(address,uint256))
const SEND_CROSS_CHAIN_MSG_TOPIC0 = "2A211AD4A59AB9D003852404F9C57C690704EE755F3C79D2C2812AD32DA99DF8";

// TeleporterMessenger contract address (binary, for unhex comparison)
const TELEPORTER_ADDRESS_HEX = "253b2784c75e510dD0fF1da844684a1aC0aa5fcf";

interface ChainInfo {
  chainId: string;
  chainName: string;
  chainLogoURI: string;
  color: string;
}

function generateColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash % 360);
  return `hsl(${hue}, 70%, 55%)`;
}

const chainMap: Map<string, ChainInfo> = new Map();
for (const c of l1ChainsData) {
  const typed = c as { chainId: string; chainName: string; chainLogoURI?: string; color?: string; isTestnet?: boolean };
  if (typed.isTestnet) continue;
  chainMap.set(typed.chainId, {
    chainId: typed.chainId,
    chainName: typed.chainName,
    chainLogoURI: typed.chainLogoURI || "",
    color: typed.color || generateColor(typed.chainName),
  });
}

function lookupChain(chainIdNum: number): ChainInfo | undefined {
  return chainMap.get(String(chainIdNum));
}

function cb58ToHex(cb58Str: string): string {
  const decoded = bs58.decode(cb58Str);
  const raw = decoded.slice(0, decoded.length - 4);
  return Buffer.from(raw).toString("hex").toUpperCase();
}

const blockchainHexToChainId: Map<string, number> = new Map();
for (const c of l1ChainsData) {
  const typed = c as L1ChainEntry;
  if (!typed.blockchainId) continue;
  try {
    let hex: string;
    if (typed.blockchainId.startsWith("0x")) {
      hex = typed.blockchainId.slice(2).toUpperCase();
    } else {
      hex = cb58ToHex(typed.blockchainId);
    }
    blockchainHexToChainId.set(hex, Number(typed.chainId));
  } catch {
    // Skip entries with unparseable blockchainId
  }
}

interface DailyIncoming {
  chain_id: number;
  day: string;
  incoming_count: number;
}

interface DailyOutgoing {
  chain_id: number;
  day: string;
  outgoing_count: number;
}

interface RawCrossChainFlow {
  dest_chain_id: number;
  source_blockchain_hex: string;
  msg_count: number;
}

interface CrossChainFlow {
  source_chain_id: number;
  dest_chain_id: number;
  msg_count: number;
}

interface ContractFee {
  day: string;
  fees_paid: string;  // comes as string from ClickHouse (UInt256)
  tx_count: number;
}

interface ICMCacheData {
  dailyIncoming: DailyIncoming[];
  dailyOutgoing: DailyOutgoing[];
  crossChainFlows: CrossChainFlow[];
  contractFees: ContractFee[];
  fetchedAt: number;
}

interface ContractFeesCacheData {
  contractFees: ContractFee[];
  fetchedAt: number;
}

type ContractFeesDataSource = "fresh" | "cache" | "stale-cache" | "empty-fallback";

interface ContractFeesCacheResult {
  cacheData: ContractFeesCacheData;
  dataSource: ContractFeesDataSource;
}

const CACHE_TTL = 4 * 60 * 60 * 1000; // 4 hours

let cache: ICMCacheData | null = null;
let fetchPromise: Promise<ICMCacheData> | null = null;
const contractFeesCacheByKey = new Map<string, ContractFeesCacheData>();
const contractFeesFetchPromises = new Map<string, Promise<ContractFeesCacheResult>>();

function getContractFeesQueryConfig(timeRange = "all"): { cacheKey: string; days?: number } {
  switch (timeRange) {
    case "7d":
      return { cacheKey: "7d", days: 7 };
    case "30d":
      return { cacheKey: "30d", days: 30 };
    case "90d":
      return { cacheKey: "90d", days: 90 };
    case "1y":
      return { cacheKey: "1y", days: 365 };
    case "all":
    default:
      return { cacheKey: "all" };
  }
}

function createEmptyContractFeesCache(): ContractFeesCacheData {
  return {
    contractFees: [],
    fetchedAt: Date.now(),
  };
}

function sqlDailyIncoming(): string {
  return `
    SELECT
      chain_id,
      toDate(block_time) AS day,
      count() AS incoming_count
    FROM raw_logs
    WHERE topic0 = unhex('${RECEIVE_CROSS_CHAIN_MSG_TOPIC0}')
    GROUP BY chain_id, day
    ORDER BY chain_id, day
    FORMAT JSONEachRow
  `;
}

function sqlDailyOutgoing(): string {
  return `
    SELECT
      chain_id,
      toDate(block_time) AS day,
      count() AS outgoing_count
    FROM raw_logs
    WHERE topic0 = unhex('${SEND_CROSS_CHAIN_MSG_TOPIC0}')
      AND address = unhex('${TELEPORTER_ADDRESS_HEX}')
    GROUP BY chain_id, day
    ORDER BY chain_id, day
    FORMAT JSONEachRow
  `;
}

// ReceiveCrossChainMessage: topic2 = sourceBlockchainID (indexed bytes32)
// chain_id = destination chain
function sqlCrossChainFlows(days?: number): string {
  const dayFilter =
    days && Number.isFinite(days) && days > 0
      ? `AND block_time >= now() - INTERVAL ${Math.ceil(days)} DAY`
      : "";

  return `
    SELECT
      chain_id AS dest_chain_id,
      hex(topic2) AS source_blockchain_hex,
      count() AS msg_count
    FROM raw_logs
    WHERE topic0 = unhex('${RECEIVE_CROSS_CHAIN_MSG_TOPIC0}')
      ${dayFilter}
    GROUP BY dest_chain_id, source_blockchain_hex
    ORDER BY msg_count DESC
    FORMAT JSONEachRow
  `;
}

function sqlContractFees(days?: number): string {
  const prewhereClauses = ["chain_id = 43114"];
  if (days && Number.isFinite(days) && days > 0) {
    prewhereClauses.push(`block_time >= now() - INTERVAL ${Math.ceil(days)} DAY`);
  }

  return `
    SELECT
      toDate(block_time) AS day,
      toString(sum(toUInt256(gas_used) * toUInt256(gas_price))) AS fees_paid,
      count() AS tx_count
    FROM raw_txs
    PREWHERE ${prewhereClauses.join(" AND ")}
    WHERE \`to\` = unhex('${TELEPORTER_ADDRESS_HEX}')
    GROUP BY day
    ORDER BY day
    FORMAT JSONEachRow
  `;
}

async function refreshCache(): Promise<ICMCacheData> {
  const [dailyIncoming, dailyOutgoing] = await Promise.all([
    queryClickHouse<DailyIncoming>(sqlDailyIncoming()),
    queryClickHouse<DailyOutgoing>(sqlDailyOutgoing()),
  ]);

  return {
    dailyIncoming,
    dailyOutgoing,
    crossChainFlows: cache?.crossChainFlows ?? [],
    contractFees: contractFeesCacheByKey.get("all")?.contractFees ?? [],
    fetchedAt: Date.now(),
  };
}

async function fetchCrossChainFlows(days: number): Promise<CrossChainFlow[]> {
  const rawFlows = await queryClickHouse<RawCrossChainFlow>(sqlCrossChainFlows(days));

  const crossChainFlows: CrossChainFlow[] = [];
  for (const row of rawFlows) {
    const sourceChainId = blockchainHexToChainId.get(row.source_blockchain_hex);
    if (sourceChainId === undefined) continue;
    crossChainFlows.push({
      source_chain_id: sourceChainId,
      dest_chain_id: row.dest_chain_id,
      msg_count: Number(row.msg_count),
    });
  }

  return crossChainFlows;
}

async function getICMCacheData(): Promise<ICMCacheData> {
  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL) {
    return cache;
  }

  // Stale cache – return immediately, trigger background refresh
  if (cache) {
    if (!fetchPromise) {
      fetchPromise = refreshCache()
        .then((data) => {
          cache = data;
          return data;
        })
        .catch((err) => {
          console.error("[icm-clickhouse] Background refresh failed:", err);
          return cache!;
        })
        .finally(() => {
          fetchPromise = null;
        });
    }
    return cache;
  }

  // No cache – block and fetch (dedup concurrent)
  if (!fetchPromise) {
    fetchPromise = refreshCache()
      .then((data) => {
        cache = data;
        return data;
      })
      .finally(() => {
        fetchPromise = null;
      });
  }
  return fetchPromise;
}

async function refreshContractFeesCache(days?: number): Promise<ContractFeesCacheData> {
  const contractFees = await queryClickHouseDirect<ContractFee>(
    sqlContractFees(days),
    CONTRACT_FEES_QUERY_TIMEOUT_MS
  );

  return {
    contractFees,
    fetchedAt: Date.now(),
  };
}

function startContractFeesRefresh(
  cacheKey: string,
  days?: number
): Promise<ContractFeesCacheResult> {
  const refreshPromise = refreshContractFeesCache(days)
    .then((data) => {
      contractFeesCacheByKey.set(cacheKey, data);
      return {
        cacheData: data,
        dataSource: "fresh" as const,
      };
    })
    .catch((err) => {
      const existing = contractFeesCacheByKey.get(cacheKey);
      if (existing) {
        console.warn(
          "[icm-clickhouse] Contract fees query failed; reusing the last successful contract fees snapshot:",
          err
        );
        return {
          cacheData: existing,
          dataSource: "stale-cache" as const,
        };
      }

      console.warn("[icm-clickhouse] Contract fees query failed with no warm cache:", err);
      return {
        cacheData: createEmptyContractFeesCache(),
        dataSource: "empty-fallback" as const,
      };
    })
    .finally(() => {
      contractFeesFetchPromises.delete(cacheKey);
    });

  contractFeesFetchPromises.set(cacheKey, refreshPromise);
  return refreshPromise;
}

async function getContractFeesCacheData(timeRange = "all"): Promise<ContractFeesCacheResult> {
  const { cacheKey, days } = getContractFeesQueryConfig(timeRange);
  const cached = contractFeesCacheByKey.get(cacheKey);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) {
    return {
      cacheData: cached,
      dataSource: "cache",
    };
  }

  if (cached) {
    if (!contractFeesFetchPromises.has(cacheKey)) {
      void startContractFeesRefresh(cacheKey, days);
    }
    return {
      cacheData: cached,
      dataSource: "stale-cache",
    };
  }

  const inFlight = contractFeesFetchPromises.get(cacheKey);
  if (inFlight) {
    return inFlight;
  }

  return startContractFeesRefresh(cacheKey, days);
}

function dayToTimestamp(day: string): number {
  return Math.floor(new Date(day + "T00:00:00Z").getTime() / 1000);
}

interface AggregatedICMDataPoint {
  timestamp: number;
  date: string;
  totalMessageCount: number;
  chainBreakdown: Record<string, number>;
}

export async function getICMStatsData(days: number): Promise<{
  aggregatedData: AggregatedICMDataPoint[];
  icmDataPoints: ICMDataPoint[];
}> {
  const data = await getICMCacheData();
  const cutoff = Date.now() / 1000 - days * 86400;

  // Build per-chain per-day incoming + outgoing → messageCount
  const dayChainMap = new Map<string, Map<string, { incoming: number; outgoing: number }>>();

  for (const row of data.dailyIncoming) {
    const ts = dayToTimestamp(row.day);
    if (ts < cutoff) continue;
    const chain = lookupChain(row.chain_id);
    if (!chain) continue;
    if (!dayChainMap.has(row.day)) dayChainMap.set(row.day, new Map());
    const dayEntry = dayChainMap.get(row.day)!;
    if (!dayEntry.has(chain.chainName)) dayEntry.set(chain.chainName, { incoming: 0, outgoing: 0 });
    dayEntry.get(chain.chainName)!.incoming += Number(row.incoming_count);
  }

  for (const row of data.dailyOutgoing) {
    const ts = dayToTimestamp(row.day);
    if (ts < cutoff) continue;
    const chain = lookupChain(row.chain_id);
    if (!chain) continue;
    if (!dayChainMap.has(row.day)) dayChainMap.set(row.day, new Map());
    const dayEntry = dayChainMap.get(row.day)!;
    if (!dayEntry.has(chain.chainName)) dayEntry.set(chain.chainName, { incoming: 0, outgoing: 0 });
    dayEntry.get(chain.chainName)!.outgoing += Number(row.outgoing_count);
  }

  const aggregatedData: AggregatedICMDataPoint[] = [];
  const icmDataPoints: ICMDataPoint[] = [];

  for (const [day, chains] of dayChainMap.entries()) {
    const timestamp = dayToTimestamp(day);
    const chainBreakdown: Record<string, number> = {};
    let totalMessageCount = 0;
    let totalIncoming = 0;
    let totalOutgoing = 0;

    for (const [chainName, counts] of chains.entries()) {
      // Use only incoming (RECEIVE events) to avoid double-counting.
      // Each cross-chain message generates one SEND on the source chain and
      // one RECEIVE on the destination chain; counting both would double the total.
      chainBreakdown[chainName] = counts.incoming;
      totalMessageCount += counts.incoming;
      totalIncoming += counts.incoming;
      totalOutgoing += counts.outgoing;
    }

    if (totalMessageCount === 0) continue;

    aggregatedData.push({ timestamp, date: day, totalMessageCount, chainBreakdown });
    icmDataPoints.push({
      timestamp,
      date: day,
      messageCount: totalMessageCount,
      incomingCount: totalIncoming,
      outgoingCount: totalOutgoing,
    });
  }

  aggregatedData.sort((a, b) => b.timestamp - a.timestamp);
  icmDataPoints.sort((a, b) => b.timestamp - a.timestamp);

  return { aggregatedData, icmDataPoints };
}

interface ICMFlowData {
  sourceChain: string;
  sourceChainId: string;
  sourceLogo: string;
  sourceColor: string;
  targetChain: string;
  targetChainId: string;
  targetLogo: string;
  targetColor: string;
  messageCount: number;
}

export async function getICMFlowData(days: number): Promise<ICMFlowData[]> {
  const crossChainFlows = await fetchCrossChainFlows(days);

  const flows: ICMFlowData[] = [];
  for (const row of crossChainFlows) {
    const src = lookupChain(row.source_chain_id);
    const dst = lookupChain(row.dest_chain_id);
    if (!src || !dst) continue;

    flows.push({
      sourceChain: src.chainName,
      sourceChainId: src.chainId,
      sourceLogo: src.chainLogoURI,
      sourceColor: src.color,
      targetChain: dst.chainName,
      targetChainId: dst.chainId,
      targetLogo: dst.chainLogoURI,
      targetColor: dst.color,
      messageCount: Number(row.msg_count),
    });
  }

  flows.sort((a, b) => b.messageCount - a.messageCount);
  return flows;
}

interface DailyFeeData {
  date: string;
  timestamp: number;
  feesPaid: number;
  txCount: number;
}

export async function getICMContractFeesData(timeRange = "all"): Promise<{
  data: DailyFeeData[];
  totalFees: number;
  lastUpdated: string;
  dataSource: ContractFeesDataSource;
}> {
  const { cacheData, dataSource } = await getContractFeesCacheData(timeRange);

  const dailyData: DailyFeeData[] = cacheData.contractFees.map((row) => ({
    date: row.day,
    timestamp: dayToTimestamp(row.day),
    feesPaid: Number(row.fees_paid),
    txCount: Number(row.tx_count),
  }));

  dailyData.sort((a, b) => a.timestamp - b.timestamp);

  const totalFees = dailyData.reduce((sum, d) => sum + d.feesPaid, 0);

  return {
    data: dailyData,
    totalFees,
    lastUpdated: new Date(cacheData.fetchedAt).toISOString(),
    dataSource,
  };
}

export async function getChainICMData(
  chainId: string,
  days: number
): Promise<ICMDataPoint[]> {
  const data = await getICMCacheData();
  const cutoff = Date.now() / 1000 - days * 86400;
  const isAll = chainId === "all";
  const numericChainId = isAll ? 0 : Number(chainId);

  // Aggregate incoming + outgoing per day for this chain (or all chains)
  const dayMap = new Map<string, { incoming: number; outgoing: number }>();

  for (const row of data.dailyIncoming) {
    if (!isAll && row.chain_id !== numericChainId) continue;
    const ts = dayToTimestamp(row.day);
    if (ts < cutoff) continue;
    if (!dayMap.has(row.day)) dayMap.set(row.day, { incoming: 0, outgoing: 0 });
    dayMap.get(row.day)!.incoming += Number(row.incoming_count);
  }

  for (const row of data.dailyOutgoing) {
    if (!isAll && row.chain_id !== numericChainId) continue;
    const ts = dayToTimestamp(row.day);
    if (ts < cutoff) continue;
    if (!dayMap.has(row.day)) dayMap.set(row.day, { incoming: 0, outgoing: 0 });
    dayMap.get(row.day)!.outgoing += Number(row.outgoing_count);
  }

  const result: ICMDataPoint[] = [];
  for (const [day, counts] of dayMap.entries()) {
    if (counts.incoming === 0) continue;

    result.push({
      timestamp: dayToTimestamp(day),
      date: day,
      // Use only incoming (RECEIVE events) to deduplicate cross-chain messages.
      messageCount: counts.incoming,
      incomingCount: counts.incoming,
      outgoingCount: counts.outgoing,
    });
  }

  result.sort((a, b) => b.timestamp - a.timestamp);
  return result;
}

/**
 * Sum ICM message counts for the most recent N complete days.
 * Skips today's partial data if present; when data is stale
 * (latest entry is a past day) it treats that as the first complete day.
 */
function sumLatestCompleteDays(
  dataPoints: ICMDataPoint[],
  daysToSum: number
): number {
  const sorted = [...dataPoints].sort((a, b) => b.timestamp - a.timestamp);
  if (sorted.length === 0) return 0;

  const todayStr = new Date().toISOString().split("T")[0];
  const startIndex = sorted[0]?.date === todayStr ? 1 : 0;

  let sum = 0;
  for (let i = startIndex; i < Math.min(startIndex + daysToSum, sorted.length); i++) {
    sum += sorted[i]?.messageCount || 0;
  }
  return sum;
}

export async function getChainICMCount(
  chainId: string,
  daysToSum: number
): Promise<number> {
  const dataPoints = await getChainICMData(chainId, daysToSum + 2);
  return sumLatestCompleteDays(dataPoints, daysToSum);
}
