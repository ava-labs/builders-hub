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

// Clickhouse x402 proxy server (sole data path — no direct fallback)
const CLICKHOUSE_PROXY_URL = process.env.CLICKHOUSE_PROXY_URL || "";

// x402 payer wallet — signs USDC transfer authorizations on Avalanche C-Chain
const X402_PAYER_PRIVATE_KEY = process.env.X402_PAYER_PRIVATE_KEY || "";

function createX402Fetch() {
  if (!CLICKHOUSE_PROXY_URL || !X402_PAYER_PRIVATE_KEY) return null;

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
  const proxyUrl = CLICKHOUSE_PROXY_URL.endsWith("/query") ? CLICKHOUSE_PROXY_URL : CLICKHOUSE_PROXY_URL.replace(/\/$/, "") + "/query";

  const response = await x402Fetch!(proxyUrl, {
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

async function queryClickHouse<T = Record<string, unknown>>(sql: string): Promise<T[]> {
  if (!CLICKHOUSE_PROXY_URL || !x402Fetch) {
    console.warn("[icm-clickhouse] CLICKHOUSE_PROXY_URL or x402 client not configured – returning empty results");
    return [];
  }

  return queryClickHouseX402<T>(sql);
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

const CACHE_TTL = 4 * 60 * 60 * 1000; // 4 hours

let cache: ICMCacheData | null = null;
let fetchPromise: Promise<ICMCacheData> | null = null;

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
function sqlCrossChainFlows(): string {
  return `
    SELECT
      chain_id AS dest_chain_id,
      hex(topic2) AS source_blockchain_hex,
      count() AS msg_count
    FROM raw_logs
    WHERE topic0 = unhex('${RECEIVE_CROSS_CHAIN_MSG_TOPIC0}')
    GROUP BY dest_chain_id, source_blockchain_hex
    ORDER BY msg_count DESC
    FORMAT JSONEachRow
  `;
}

function sqlContractFees(): string {
  return `
    SELECT
      toDate(block_time) AS day,
      toString(sum(toUInt256(gas_used) * toUInt256(gas_price))) AS fees_paid,
      count() AS tx_count
    FROM raw_txs
    WHERE chain_id = 43114
      AND \`to\` = unhex('${TELEPORTER_ADDRESS_HEX}')
    GROUP BY day
    ORDER BY day
    FORMAT JSONEachRow
  `;
}

async function refreshCache(): Promise<ICMCacheData> {
  const [dailyIncoming, dailyOutgoing, rawFlows, contractFees] = await Promise.all([
    queryClickHouse<DailyIncoming>(sqlDailyIncoming()),
    queryClickHouse<DailyOutgoing>(sqlDailyOutgoing()),
    queryClickHouse<RawCrossChainFlow>(sqlCrossChainFlows()),
    queryClickHouse<ContractFee>(sqlContractFees()),
  ]);

  // Resolve source_blockchain_hex → source_chain_id using the static mapping
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

  return {
    dailyIncoming,
    dailyOutgoing,
    crossChainFlows,
    contractFees,
    fetchedAt: Date.now(),
  };
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

export async function getICMFlowData(_days: number): Promise<ICMFlowData[]> {
  const data = await getICMCacheData();

  const flows: ICMFlowData[] = [];
  for (const row of data.crossChainFlows) {
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

export async function getICMContractFeesData(): Promise<{
  data: DailyFeeData[];
  totalFees: number;
  lastUpdated: string;
}> {
  const cacheData = await getICMCacheData();

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
    lastUpdated: new Date().toISOString(),
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

export async function getChainICMCount(
  chainId: string,
  daysToSum: number
): Promise<number> {
  const dataPoints = await getChainICMData(chainId, daysToSum + 2);
  const sorted = dataPoints.sort((a, b) => b.timestamp - a.timestamp);
  let sum = 0;
  for (let i = 1; i <= Math.min(daysToSum, sorted.length - 1); i++) {
    sum += sorted[i]?.messageCount || 0;
  }
  return sum;
}
