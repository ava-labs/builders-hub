import { NextResponse } from 'next/server';
import {
  getProtocolStats,
  getProtocolDailyActivity,
  getProtocolMonthlyActivity,
  getProtocolRecentTransactions,
  type ProtocolStats,
  type DailyActivity,
  type MonthlyActivity,
  type RecentTransaction,
} from '@/lib/clickhouse';
import { getProtocolContracts, getProtocolNameBySlug } from '@/lib/contracts';

// Cache for 5 minutes - these queries are expensive
export const revalidate = 300;

interface RouteParams {
  params: Promise<{ slug: string }>;
}

export interface ProtocolOnChainData {
  protocol: string;
  slug: string;
  contracts: string[];
  stats: ProtocolStats;
  dailyActivity: DailyActivity[];
  monthlyActivity: MonthlyActivity[];
  recentTransactions: RecentTransaction[];
  lastUpdated: string;
}

export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { slug } = await params;
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '0'); // 0 = all time

    const protocolName = getProtocolNameBySlug(slug);

    if (!protocolName) {
      return NextResponse.json(
        { error: 'Protocol not found in contract registry' },
        { status: 404 }
      );
    }

    const contracts = getProtocolContracts(protocolName);
    if (contracts.length === 0) {
      return NextResponse.json(
        { error: 'No contracts found for this protocol' },
        { status: 404 }
      );
    }

    const addresses = contracts.map(c => c.address);

    // Determine activity range based on requested days
    const activityDays = days > 0 ? Math.min(days, 90) : 90;

    // Fetch all data in parallel
    const [stats, dailyActivity, monthlyActivity, recentTransactions] = await Promise.all([
      getProtocolStats(addresses, days), // Respects time range (0 = all time)
      getProtocolDailyActivity(addresses, activityDays),
      getProtocolMonthlyActivity(addresses, days > 0 ? Math.ceil(days / 30) : 24),
      getProtocolRecentTransactions(addresses, 20),
    ]);

    const response: ProtocolOnChainData = {
      protocol: protocolName,
      slug,
      contracts: addresses,
      stats,
      dailyActivity,
      monthlyActivity,
      recentTransactions,
      lastUpdated: new Date().toISOString(),
    };

    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      },
    });
  } catch (error) {
    console.error('Error fetching protocol on-chain data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch on-chain data' },
      { status: 500 }
    );
  }
}
