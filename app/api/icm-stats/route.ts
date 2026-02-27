import { NextResponse } from 'next/server';
import { ICMMetric, STATS_CONFIG, createICMMetric } from "@/types/stats";
import { getICMStatsData } from "@/lib/icm-clickhouse";

const CACHE_CONTROL_HEADER = 'public, max-age=14400, s-maxage=14400, stale-while-revalidate=86400';

interface AggregatedICMDataPoint {
  timestamp: number;
  date: string;
  totalMessageCount: number;
  chainBreakdown: Record<string, number>;
}

interface ICMStats {
  dailyMessageVolume: ICMMetric;
  aggregatedData: AggregatedICMDataPoint[];
  last_updated: number;
}

let cachedData: Map<string, { data: ICMStats; timestamp: number }> = new Map();

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const timeRange = searchParams.get('timeRange') || '30d';

    let days = 30;
    switch (timeRange) {
      case '1d': days = 1; break;
      case '7d': days = 7; break;
      case '30d': days = 30; break;
      case '90d': days = 90; break;
      case '1y': days = 365; break;
      case 'all': days = 730; break;
      default: days = 30;
    }

    if (searchParams.get('clearCache') === 'true') {
      cachedData.clear();
    }

    const cached = cachedData.get(timeRange);
    if (cached && Date.now() - cached.timestamp < STATS_CONFIG.CACHE.SHORT_DURATION) {
      return NextResponse.json(cached.data, {
        headers: {
          'Cache-Control': CACHE_CONTROL_HEADER,
          'X-Data-Source': 'cache',
          'X-Cache-Timestamp': new Date(cached.timestamp).toISOString(),
        }
      });
    }

    const startTime = Date.now();
    const { aggregatedData, icmDataPoints } = await getICMStatsData(days);

    const dailyMessageVolume = createICMMetric(icmDataPoints);

    const metrics: ICMStats = {
      dailyMessageVolume,
      aggregatedData,
      last_updated: Date.now()
    };

    cachedData.set(timeRange, {
      data: metrics,
      timestamp: Date.now()
    });

    const fetchTime = Date.now() - startTime;

    return NextResponse.json(metrics, {
      headers: {
        'Cache-Control': CACHE_CONTROL_HEADER,
        'X-Data-Source': 'fresh',
        'X-Fetch-Time': `${fetchTime}ms`,
      }
    });

  } catch (error) {
    console.error('Error fetching ICM stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch ICM stats' },
      { status: 500 }
    );
  }
}
