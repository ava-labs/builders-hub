// ICTT (Inter-Chain Token Transfer) bridge data from ClickHouse.
//
// Replaces the dead `https://idx6.solokhin.com/api/global/ictt/transfers`
// upstream by aggregating `TokensSent` + `TokensAndCallSent` logs from the
// `raw_logs` table. See `docs/clickhouse-schema.md` for schema and
// `.claude/commands/ch-query.md` for query patterns. Mirrors the cache /
// SWR / dedup approach used in `lib/icm-clickhouse.ts`.
//
// Known limitation (v1): we emit `direction = "out"` on every row because
// the home/remote classification requires a contract-pair registry that
// does not exist yet. The two route consumers only sum `transferCount`,
// so totals remain correct — only contract-role labeling is implicit.

import bs58 from 'bs58';
import l1ChainsData from '@/constants/l1-chains.json';

const TOKENS_SENT_TOPIC0 = '93f19bf1ec58a15dc643b37e7e18a1c13e85e06cd11929e283154691ace9fb52';
const TOKENS_AND_CALL_SENT_TOPIC0 = '5d76dff81bf773b908b050fa113d39f7d8135bb4175398f313ea19cd3a1a0b16';

const CACHE_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours
const QUERY_TIMEOUT_MS = 30_000;

export interface ICTTTransfer {
  homeChainBlockchainId: string;
  homeChainName: string;
  remoteChainBlockchainId: string;
  remoteChainName: string;
  direction: string;
  contractAddress: string;
  coinAddress: string;
  transferCount: number;
  transferCoinsTotal: number;
}

export interface ICTTSummary {
  outboundTransfers: number;
  inboundTransfers: number;
  topToken: { name: string; symbol: string; count: number } | null;
  counterpartyCount: number;
}

type L1ChainEntry = {
  chainId: string;
  chainName: string;
  blockchainId?: string;
};

interface ChainInfo {
  blockchainId: string;
  chainName: string;
}

function cb58ToHex(cb58Str: string): string {
  const decoded = bs58.decode(cb58Str);
  const raw = decoded.slice(0, decoded.length - 4);
  return Buffer.from(raw).toString('hex').toLowerCase();
}

const chainByEvmId = new Map<number, ChainInfo>();
const chainByBlockchainHex = new Map<string, ChainInfo>();

for (const entry of l1ChainsData as L1ChainEntry[]) {
  if (!entry.blockchainId) continue;
  let hex: string;
  try {
    hex = entry.blockchainId.startsWith('0x')
      ? entry.blockchainId.slice(2).toLowerCase()
      : cb58ToHex(entry.blockchainId);
  } catch {
    continue;
  }
  const info: ChainInfo = {
    blockchainId: entry.blockchainId,
    chainName: entry.chainName,
  };
  const evmId = Number(entry.chainId);
  if (Number.isFinite(evmId)) {
    chainByEvmId.set(evmId, info);
  }
  chainByBlockchainHex.set(hex, info);
}

function resolveBySourceChainId(chainId: number): ChainInfo {
  const info = chainByEvmId.get(chainId);
  if (info) return info;
  return {
    blockchainId: `chain-${chainId}`,
    chainName: `Chain ${chainId}`,
  };
}

function resolveByBlockchainHex(hex: string): ChainInfo {
  const info = chainByBlockchainHex.get(hex);
  if (info) return info;
  const short = `${hex.slice(0, 6)}…${hex.slice(-4)}`;
  return {
    blockchainId: hex,
    chainName: `Unknown (${short})`,
  };
}

interface RawTransferRow {
  source_chain_id: string;
  contract_address: string;
  dest_blockchain_hex: string;
  transfer_count: string;
  transfer_amount_raw: string;
}

function buildAggregationSql(): string {
  // Unified query over both event signatures.
  //
  // TokensSent (static tuple): destinationBlockchainID at bytes 1..32, amount at bytes 257..288.
  // TokensAndCallSent (dynamic tuple, dynamic `bytes` field inside): outer encoding is
  //   slot 0 = offset to tuple data (always 0x40), slot 1 = amount, slot 2 = first
  //   field of tuple (destinationBlockchainID) at bytes 65..96.
  // `reverse(...)` flips byte order before reinterpretAsUInt256 because raw_logs.data
  // is stored as-is and the EVM encodes uint256 big-endian.
  return `
    SELECT
      toString(chain_id) AS source_chain_id,
      lower(hex(address)) AS contract_address,
      lower(hex(
        CASE
          WHEN topic0 = unhex('${TOKENS_SENT_TOPIC0}') THEN substring(data, 1, 32)
          ELSE substring(data, 65, 32)
        END
      )) AS dest_blockchain_hex,
      toString(count()) AS transfer_count,
      toString(sum(reinterpretAsUInt256(reverse(
        CASE
          WHEN topic0 = unhex('${TOKENS_SENT_TOPIC0}') THEN substring(data, 257, 32)
          ELSE substring(data, 33, 32)
        END
      )))) AS transfer_amount_raw
    FROM raw_logs
    WHERE topic0 IN (unhex('${TOKENS_SENT_TOPIC0}'), unhex('${TOKENS_AND_CALL_SENT_TOPIC0}'))
      AND length(data) >= 96
    GROUP BY source_chain_id, contract_address, dest_blockchain_hex
    ORDER BY count() DESC
    FORMAT JSONEachRow
  `;
}

async function queryClickHouse(): Promise<RawTransferRow[]> {
  const url = process.env.CLICKHOUSE_URL;
  if (!url) {
    console.warn('[ictt-clickhouse] CLICKHOUSE_URL not set — returning empty');
    return [];
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), QUERY_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'X-ClickHouse-User': process.env.CLICKHOUSE_USER || 'readonly',
        'X-ClickHouse-Key': process.env.CLICKHOUSE_PASSWORD || '',
        'X-ClickHouse-Database': process.env.CLICKHOUSE_DATABASE || 'default',
        'Content-Type': 'text/plain',
      },
      body: buildAggregationSql(),
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
    return text.split('\n').map((line) => JSON.parse(line) as RawTransferRow);
  } finally {
    clearTimeout(timeoutId);
  }
}

function shortenAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function toIcttTransfers(rows: RawTransferRow[]): ICTTTransfer[] {
  const out: ICTTTransfer[] = [];
  for (const row of rows) {
    const sourceChainId = Number(row.source_chain_id);
    if (!Number.isFinite(sourceChainId)) continue;

    const home = resolveBySourceChainId(sourceChainId);
    const remote = resolveByBlockchainHex(row.dest_blockchain_hex);
    const contractAddress = `0x${row.contract_address}`;

    const transferCount = Number(row.transfer_count);
    // Cast UInt256 string to a JS number — lossy above 2^53 but matches the
    // Solokhin shape (`transferCoinsTotal: number`) the consumers expect.
    // For sane bridge amounts this is fine; very large totals will warn.
    const amountStr = row.transfer_amount_raw;
    const transferCoinsTotal = Number(amountStr);
    if (!Number.isFinite(transferCoinsTotal)) {
      console.warn(
        `[ictt-clickhouse] transferCoinsTotal overflowed Number for contract ${contractAddress}: ${amountStr}`,
      );
    }

    out.push({
      homeChainBlockchainId: home.blockchainId,
      homeChainName: home.chainName,
      remoteChainBlockchainId: remote.blockchainId,
      remoteChainName: remote.chainName,
      direction: 'out',
      contractAddress,
      coinAddress: contractAddress,
      transferCount,
      transferCoinsTotal: Number.isFinite(transferCoinsTotal)
        ? transferCoinsTotal
        : 0,
    });
  }
  return out;
}

interface IcttCache {
  transfers: ICTTTransfer[];
  fetchedAt: number;
}

let cache: IcttCache | null = null;
let fetchPromise: Promise<IcttCache> | null = null;

async function refreshCache(): Promise<IcttCache> {
  const rows = await queryClickHouse();
  return {
    transfers: toIcttTransfers(rows),
    fetchedAt: Date.now(),
  };
}

async function getCache(): Promise<IcttCache> {
  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
    return cache;
  }

  // Stale cache: serve immediately, refresh in background.
  if (cache) {
    if (!fetchPromise) {
      fetchPromise = refreshCache()
        .then((data) => {
          cache = data;
          return data;
        })
        .catch((err) => {
          console.error('[ictt-clickhouse] Background refresh failed:', err);
          return cache!;
        })
        .finally(() => {
          fetchPromise = null;
        });
    }
    return cache;
  }

  // No cache: block until first fetch resolves; dedup concurrent waiters.
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

/**
 * Returns every ICTT transfer aggregation row across all indexed chains.
 *
 * Used by `app/api/ictt-stats/route.ts` to power the global bridge dashboard.
 */
export async function getGlobalICTTTransfers(): Promise<ICTTTransfer[]> {
  try {
    const { transfers } = await getCache();
    return transfers;
  } catch (err) {
    console.error('[ictt-clickhouse] getGlobalICTTTransfers failed:', err);
    return [];
  }
}

interface TokenInfoLite {
  name: string;
  symbol: string;
}

/**
 * Returns the bridge-activity summary for a single L1, identified by its
 * Avalanche `blockchainId` (CB58 or 0x-hex form, matching `l1-chains.json`).
 *
 * Used by `app/api/console/cross-chain-stats/[blockchainId]/route.ts`. Returns
 * `null` if the upstream ClickHouse query fails so callers can surface a
 * `degraded` UI state instead of silent zeros.
 */
export async function getChainICTTSummary(
  blockchainId: string,
  tokenLookup: (address: string) => TokenInfoLite,
): Promise<ICTTSummary | null> {
  let transfers: ICTTTransfer[];
  try {
    ({ transfers } = await getCache());
  } catch (err) {
    console.error('[ictt-clickhouse] getChainICTTSummary failed:', err);
    return null;
  }

  const touching = transfers.filter(
    (t) =>
      t.homeChainBlockchainId === blockchainId ||
      t.remoteChainBlockchainId === blockchainId,
  );

  if (touching.length === 0) {
    return {
      outboundTransfers: 0,
      inboundTransfers: 0,
      topToken: null,
      counterpartyCount: 0,
    };
  }

  let outbound = 0;
  let inbound = 0;
  const counterparties = new Set<string>();
  const tokenCounts = new Map<
    string,
    { name: string; symbol: string; count: number }
  >();

  for (const t of touching) {
    if (t.homeChainBlockchainId === blockchainId) {
      outbound += t.transferCount;
      counterparties.add(t.remoteChainBlockchainId);
    } else {
      inbound += t.transferCount;
      counterparties.add(t.homeChainBlockchainId);
    }

    const info = tokenLookup(t.coinAddress);
    const key = t.coinAddress.toLowerCase();
    const existing = tokenCounts.get(key);
    if (existing) {
      existing.count += t.transferCount;
    } else {
      tokenCounts.set(key, {
        name: info.name,
        symbol: info.symbol,
        count: t.transferCount,
      });
    }
  }

  const topToken =
    Array.from(tokenCounts.values()).sort((a, b) => b.count - a.count)[0] ??
    null;

  return {
    outboundTransfers: outbound,
    inboundTransfers: inbound,
    topToken,
    counterpartyCount: counterparties.size,
  };
}

// Exported for tests / debugging only — not for production import paths.
export const __internal = {
  buildAggregationSql,
  toIcttTransfers,
  resolveBySourceChainId,
  resolveByBlockchainHex,
  shortenAddress,
};
