import { withApi, successResponse } from '@/lib/api';
import { ICMMetric, STATS_CONFIG, createICMMetric } from '@/types/stats';
import { getICMStatsData } from '@/lib/icm-clickhouse';

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

export const GET = withApi(async (req) => {
  const timeRange = req.nextUrl.searchParams.get('timeRange') || '30d';

  let days = 30;
  switch (timeRange) {
    case '1d':
      days = 1;
      break;
    case '7d':
      days = 7;
      break;
    case '30d':
      days = 30;
      break;
    case '90d':
      days = 90;
      break;
    case '1y':
      days = 365;
      break;
    case 'all':
      days = 730;
      break;
    default:
      days = 30;
  }

  if (req.nextUrl.searchParams.get('clearCache') === 'true') {
    cachedData.clear();
  }

  const cached = cachedData.get(timeRange);
  if (cached && Date.now() - cached.timestamp < STATS_CONFIG.CACHE.SHORT_DURATION) {
    return successResponse(cached.data);
  }

  const { aggregatedData, icmDataPoints } = await getICMStatsData(days);

  const dailyMessageVolume = createICMMetric(icmDataPoints);

  const metrics: ICMStats = {
    dailyMessageVolume,
    aggregatedData,
    last_updated: Date.now(),
  };

  cachedData.set(timeRange, {
    data: metrics,
    timestamp: Date.now(),
  });

  return successResponse(metrics);
});
