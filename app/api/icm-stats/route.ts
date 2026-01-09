import { NextResponse } from 'next/server';
import { ICMDataPoint, ICMMetric, STATS_CONFIG, createICMMetric } from "@/types/stats";
import l1ChainsData from "@/constants/l1-chains.json";

interface ChainICMDataPoint extends ICMDataPoint {
  chainId: string;
  chainName: string;
}

interface AggregatedICMDataPoint {
  timestamp: number;
  date: string;
  totalMessageCount: number;
  chainBreakdown: Record<string, number>; // chainName -> messageCount
}

interface ICMStats {
  dailyMessageVolume: ICMMetric;
  aggregatedData: AggregatedICMDataPoint[];
  last_updated: number;
}

let cachedData: Map<string, { data: ICMStats; timestamp: number }> = new Map();

async function getICMDataForChain(chainId: string, chainName: string, days: number): Promise<ChainICMDataPoint[]> {
  try {
    const response = await fetch(`https://idx6.solokhin.com/api/${chainId}/metrics/dailyMessageVolume?days=${days}`, {
      headers: { 'Accept': 'application/json' },
    });

    if (!response.ok) { 
      return []; 
    }
    
    const data = await response.json();
    if (!Array.isArray(data)) { return []; }

    return data.map((item: any) => ({
      timestamp: item.timestamp,
      date: item.date,
      messageCount: item.messageCount || 0,
      incomingCount: item.incomingCount || 0,
      outgoingCount: item.outgoingCount || 0,
      chainId,
      chainName,
    }));
  } catch (error) {
    return [];
  }
}

async function getAllChainsICMData(days: number): Promise<AggregatedICMDataPoint[]> {
  const chainPromises = l1ChainsData.map(chain => 
    getICMDataForChain(chain.chainId, chain.chainName, days)
  );

  const allChainData = await Promise.all(chainPromises);

  const dateMap = new Map<string, { timestamp: number; chains: Record<string, number> }>();

  allChainData.forEach(chainData => {
    chainData.forEach(point => {
      if (!dateMap.has(point.date)) {
        dateMap.set(point.date, {
          timestamp: point.timestamp,
          chains: {}
        });
      }
      const dateEntry = dateMap.get(point.date)!;
      dateEntry.chains[point.chainName] = (dateEntry.chains[point.chainName] || 0) + point.messageCount;
    });
  });

  const aggregated: AggregatedICMDataPoint[] = Array.from(dateMap.entries())
    .map(([date, data]) => {
      const totalMessageCount = Object.values(data.chains).reduce((sum, count) => sum + count, 0);
      return {
        timestamp: data.timestamp,
        date,
        totalMessageCount,
        chainBreakdown: data.chains,
      };
    })
    .sort((a, b) => b.timestamp - a.timestamp);

  return aggregated;
}

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
      case 'all': days = 365; break;
      default: days = 30;
    }

    if (searchParams.get('clearCache') === 'true') {
      cachedData.clear();
    }
    
    const cached = cachedData.get(timeRange);
    if (cached && Date.now() - cached.timestamp < STATS_CONFIG.CACHE.SHORT_DURATION) {
      return NextResponse.json(cached.data, {
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'X-Data-Source': 'cache',
          'X-Cache-Timestamp': new Date(cached.timestamp).toISOString(),
        }
      });
    }
    
    const startTime = Date.now();
    const aggregatedData = await getAllChainsICMData(days);
    
    const icmData: ICMDataPoint[] = aggregatedData.map(point => ({
      timestamp: point.timestamp,
      date: point.date,
      messageCount: point.totalMessageCount,
      incomingCount: 0,
      outgoingCount: 0,
    }));
    
    const dailyMessageVolume = createICMMetric(icmData);

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
        'Cache-Control': 'no-cache, no-store, must-revalidate',
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

