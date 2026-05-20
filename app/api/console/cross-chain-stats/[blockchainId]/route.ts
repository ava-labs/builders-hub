import { NextResponse } from 'next/server';
import icttTokens from '@/constants/ictt-tokens.json';
import { getChainICMCount, getICMFlowData } from '@/lib/icm-clickhouse';
import { getChainICTTSummary, type ICTTSummary } from '@/lib/ictt-clickhouse';

interface TokenInfo {
  name: string;
  symbol: string;
  coingeckoId?: string;
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
    getChainICTTSummary(blockchainId, getTokenInfo),
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
      // server-side via the ClickHouse module's in-memory cache.
      'Cache-Control': 'public, max-age=60, stale-while-revalidate=300',
    },
  });
}

// Co-locate the response type with the route so hooks/clients can import it
// for type safety without duplicating shapes.
export type { CrossChainStatsResponse, ICTTSummary, ICMSummary };
