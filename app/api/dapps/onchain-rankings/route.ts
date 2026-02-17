import { NextResponse } from 'next/server';
import {
  getProtocolGasRankings,
  getCChainOverview,
  type ProtocolGasRanking,
  type ChainOverviewStats,
} from '@/lib/clickhouse';
import { CONTRACT_REGISTRY, PROTOCOL_SLUGS } from '@/lib/contracts';

// Cache for 10 minutes - this is an expensive aggregation query
export const dynamic = 'force-dynamic';
export const revalidate = 600;

export interface OnChainRankingsResponse {
  chainStats: ChainOverviewStats;
  protocolRankings: (ProtocolGasRanking & { slug: string | null })[];
  timeRange: string;
  lastUpdated: string;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '30');

    // Build protocol -> addresses map from contract registry
    const protocolContracts = new Map<string, string[]>();

    for (const contract of Object.values(CONTRACT_REGISTRY)) {
      const existing = protocolContracts.get(contract.protocol) || [];
      existing.push(contract.address);
      protocolContracts.set(contract.protocol, existing);
    }

    // Fetch data in parallel
    const [chainStats, rankings] = await Promise.all([
      getCChainOverview(),
      getProtocolGasRankings(protocolContracts, days),
    ]);

    // Add slug to each ranking
    const rankingsWithSlug = rankings.map(r => ({
      ...r,
      slug: PROTOCOL_SLUGS[r.protocol] || null,
    }));

    const response: OnChainRankingsResponse = {
      chainStats,
      protocolRankings: rankingsWithSlug,
      timeRange: `${days} days`,
      lastUpdated: new Date().toISOString(),
    };

    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=1200',
      },
    });
  } catch (error) {
    console.error('Error fetching on-chain rankings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch on-chain rankings' },
      { status: 500 }
    );
  }
}
