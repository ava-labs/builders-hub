import { NextResponse } from 'next/server';
import { unstable_cache } from 'next/cache';
import icttTokens from '@/constants/ictt-tokens.json';
import { getChainICMCount, getChainICMData, getICMFlowData } from '@/lib/icm-clickhouse';

interface TokenInfo {
  name: string;
  symbol: string;
  coingeckoId?: string;
}

interface ICTTTransfer {
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

interface ICTTSummary {
  /** Total bridge transfers where this L1 is the home chain (outbound). */
  outboundTransfers: number;
  /** Total bridge transfers where this L1 is a remote chain (inbound). */
  inboundTransfers: number;
  /** Top token by transfer count for routes touching this L1. */
  topToken: { name: string; symbol: string; count: number } | null;
  /** Number of unique counterparty chains seen across all routes. */
  counterpartyCount: number;
}

interface ICMSummary {
  msgs24h: number;
  msgs7d: number;
  /** Top inbound or outbound counterparty chain by message count over 7 days. */
  topPair: { chainName: string; chainId: number; messageCount: number } | null;
}

interface CrossChainStatsResponse {
  blockchainId: string;
  evmChainId: number | null;
  ictt: ICTTSummary | null;
  icm: ICMSummary | null;
  /** When `true`, at least one upstream source returned partial / empty data
   *  but the response itself is valid. UI uses this to decide skeletons vs
   *  empty states. */
  degraded: boolean;
  lastUpdated: string;
}

function getTokenInfo(address: string): TokenInfo {
  const normalized = address.toLowerCase();
  const tokens = icttTokens as Record<string, TokenInfo>;
  return (
    tokens[normalized] ??
    tokens[address] ?? {
      name: `${address.slice(0, 6)}…${address.slice(-4)}`,
      symbol: 'UNKNOWN',
    }
  );
}

// Single shared fetch of the upstream global ICTT dataset. Cached at the
// fetch layer so a flurry of per-chain calls hits the upstream once.
const fetchGlobalIctt = unstable_cache(
  async (): Promise<ICTTTransfer[]> => {
    const endTs = Math.floor(Date.now() / 1000);
    const res = await fetch(
      `https://idx6.solokhin.com/api/global/ictt/transfers?startTs=0&endTs=${endTs}`,
      { next: { revalidate: 1800 } },
    );
    if (!res.ok) return [];
    return (await res.json()) as ICTTTransfer[];
  },
  ['global-ictt-transfers'],
  { revalidate: 1800 }, // 30 minutes
);

async function buildIcttSummary(blockchainId: string): Promise<ICTTSummary | null> {
  try {
    const all = await fetchGlobalIctt();
    const touching = all.filter(
      (t) => t.homeChainBlockchainId === blockchainId || t.remoteChainBlockchainId === blockchainId,
    );
    if (touching.length === 0) {
      return { outboundTransfers: 0, inboundTransfers: 0, topToken: null, counterpartyCount: 0 };
    }

    let outbound = 0;
    let inbound = 0;
    const counterparties = new Set<string>();
    const tokenCounts = new Map<string, { name: string; symbol: string; count: number }>();

    for (const t of touching) {
      if (t.homeChainBlockchainId === blockchainId) {
        outbound += t.transferCount;
        counterparties.add(t.remoteChainBlockchainId);
      } else {
        inbound += t.transferCount;
        counterparties.add(t.homeChainBlockchainId);
      }
      const info = getTokenInfo(t.coinAddress);
      const key = t.coinAddress.toLowerCase();
      const existing = tokenCounts.get(key);
      if (existing) existing.count += t.transferCount;
      else tokenCounts.set(key, { name: info.name, symbol: info.symbol, count: t.transferCount });
    }

    const topToken =
      Array.from(tokenCounts.values()).sort((a, b) => b.count - a.count)[0] ?? null;

    return {
      outboundTransfers: outbound,
      inboundTransfers: inbound,
      topToken,
      counterpartyCount: counterparties.size,
    };
  } catch (err) {
    console.error('cross-chain-stats: failed to build ICTT summary', err);
    return null;
  }
}

async function buildIcmSummary(evmChainId: number): Promise<ICMSummary | null> {
  try {
    const [msgs24h, msgs7d, flows] = await Promise.all([
      getChainICMCount(String(evmChainId), 1),
      getChainICMCount(String(evmChainId), 7),
      getICMFlowData(7),
    ]);

    // Aggregate counterparty msg counts across both directions so the "top
    // partner" reflects total cross-chain message flux with this L1. The
    // flow rows surface chainId as a string (`ICMFlowData.sourceChainId`),
    // so compare against the evmChainId as a string too.
    const evmChainIdStr = String(evmChainId);
    const counterpartyCounts = new Map<string, { chainName: string; messageCount: number }>();
    for (const f of flows) {
      if (f.sourceChainId === evmChainIdStr) {
        const cur = counterpartyCounts.get(f.targetChainId) ?? { chainName: f.targetChain, messageCount: 0 };
        cur.messageCount += f.messageCount;
        counterpartyCounts.set(f.targetChainId, cur);
      } else if (f.targetChainId === evmChainIdStr) {
        const cur = counterpartyCounts.get(f.sourceChainId) ?? { chainName: f.sourceChain, messageCount: 0 };
        cur.messageCount += f.messageCount;
        counterpartyCounts.set(f.sourceChainId, cur);
      }
    }
    const topEntry = Array.from(counterpartyCounts.entries()).sort(
      (a, b) => b[1].messageCount - a[1].messageCount,
    )[0];
    const topPair = topEntry
      ? { chainId: Number(topEntry[0]) || 0, chainName: topEntry[1].chainName, messageCount: topEntry[1].messageCount }
      : null;

    return { msgs24h, msgs7d, topPair };
  } catch (err) {
    console.error('cross-chain-stats: failed to build ICM summary', err);
    return null;
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ blockchainId: string }> },
) {
  const { blockchainId } = await params;
  const evmChainIdParam = new URL(request.url).searchParams.get('evmChainId');
  const evmChainId = evmChainIdParam ? Number(evmChainIdParam) : null;

  if (!blockchainId) {
    return NextResponse.json({ error: 'blockchainId is required' }, { status: 400 });
  }

  const [ictt, icm] = await Promise.all([
    buildIcttSummary(blockchainId),
    evmChainId !== null && !Number.isNaN(evmChainId) ? buildIcmSummary(evmChainId) : Promise.resolve(null),
  ]);

  const response: CrossChainStatsResponse = {
    blockchainId,
    evmChainId,
    ictt,
    icm,
    degraded: ictt === null || icm === null,
    lastUpdated: new Date().toISOString(),
  };

  return NextResponse.json(response, {
    headers: {
      // Same shape as other /api/console routes — short browser cache, longer
      // server-side via unstable_cache on the upstream fetch.
      'Cache-Control': 'public, max-age=60, stale-while-revalidate=300',
    },
  });
}

// Co-locate the response type with the route so hooks/clients can import it
// for type safety without duplicating shapes.
export type { CrossChainStatsResponse, ICTTSummary, ICMSummary };
