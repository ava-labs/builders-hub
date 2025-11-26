import { NextResponse } from 'next/server';
import l1ChainsData from "@/constants/l1-chains.json";

export interface ChainCosmosData {
  id: string;
  chainId?: string; // blockchain chainId for ICM matching
  name: string;
  logo?: string;
  color: string;
  validatorCount: number;
  subnetId?: string;
  // Additional metrics
  activeAddresses?: number;
  txCount?: number;
  icmMessages?: number;
  tps?: number;
  category?: string;
}

interface SubnetStats {
  name: string;
  id: string;
  totalStakeString: string;
  byClientVersion: Record<string, { stakeString: string; nodes: number }>;
  chainLogoURI?: string;
  isL1: boolean;
}

interface ChainOverviewMetrics {
  chainId: string;
  chainName: string;
  chainLogoURI: string;
  txCount: { current_value: number | string };
  activeAddresses: { current_value: number | string };
  icmMessages: { current_value: number | string };
  validatorCount: number | string;
}

// Cache for cosmos data
let cachedCosmosData: { data: ChainCosmosData[]; timestamp: number } | null = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

async function fetchOverviewMetrics(): Promise<Map<string, ChainOverviewMetrics>> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}` 
      : 'http://localhost:3000';
    
    const response = await fetch(`${baseUrl}/api/overview-stats?timeRange=1y`, {
      headers: { 'Accept': 'application/json' },
      next: { revalidate: 300 }
    });

    if (!response.ok) {
      console.error('Failed to fetch overview metrics:', response.status);
      return new Map();
    }

    const data = await response.json();
    const metricsMap = new Map<string, ChainOverviewMetrics>();
    
    if (data.chains && Array.isArray(data.chains)) {
      data.chains.forEach((chain: ChainOverviewMetrics) => {
        metricsMap.set(chain.chainId, chain);
      });
    }
    
    return metricsMap;
  } catch (error) {
    console.error('Error fetching overview metrics:', error);
    return new Map();
  }
}

async function fetchValidatorStats(): Promise<SubnetStats[]> {
  try {
    // Fetch from our own API
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}` 
      : 'http://localhost:3000';
    
    const response = await fetch(`${baseUrl}/api/validator-stats?network=mainnet`, {
      headers: { 'Accept': 'application/json' },
      next: { revalidate: 300 } // Cache for 5 minutes
    });

    if (!response.ok) {
      console.error('Failed to fetch validator stats:', response.status);
      return [];
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching validator stats:', error);
    return [];
  }
}

function getChainCosmosData(
  validatorStats: SubnetStats[], 
  overviewMetrics: Map<string, ChainOverviewMetrics>
): ChainCosmosData[] {
  const chainsMap = new Map<string, ChainCosmosData>();

  // Build a map from l1-chains.json for logo, color, chainId, and category info
  const l1ChainsMap = new Map<string, { 
    logo?: string; 
    color: string; 
    name: string; 
    chainId?: string;
    category?: string;
  }>();
  l1ChainsData.forEach((chain: any) => {
    if (chain.subnetId) {
      l1ChainsMap.set(chain.subnetId, {
        logo: chain.chainLogoURI,
        color: chain.color || '#6366f1',
        name: chain.chainName,
        chainId: chain.chainId,
        category: chain.category || 'General'
      });
    }
  });

  // Process validator stats
  for (const subnet of validatorStats) {
    // Calculate total validators for this subnet
    const totalValidators = Object.values(subnet.byClientVersion).reduce(
      (sum, data) => sum + data.nodes, 
      0
    );

    if (totalValidators === 0) continue;

    // Get chain info from l1-chains.json or use subnet info
    const chainInfo = l1ChainsMap.get(subnet.id);
    const chainId = chainInfo?.chainId;
    
    // Get overview metrics for this chain
    const metrics = chainId ? overviewMetrics.get(chainId) : undefined;
    
    // Calculate TPS from annual tx count
    const txCount = typeof metrics?.txCount?.current_value === 'number' 
      ? metrics.txCount.current_value 
      : 0;
    const secondsInYear = 365 * 24 * 60 * 60;
    const tps = txCount / secondsInYear;
    
    chainsMap.set(subnet.id, {
      id: subnet.id,
      chainId: chainInfo?.chainId,
      name: chainInfo?.name || subnet.name,
      logo: chainInfo?.logo || subnet.chainLogoURI,
      color: chainInfo?.color || generateColorFromName(subnet.name),
      validatorCount: totalValidators,
      subnetId: subnet.id,
      // Additional metrics from overview
      activeAddresses: typeof metrics?.activeAddresses?.current_value === 'number' 
        ? metrics.activeAddresses.current_value 
        : undefined,
      txCount: typeof metrics?.txCount?.current_value === 'number'
        ? Math.round(metrics.txCount.current_value / 365) // Daily average
        : undefined,
      icmMessages: typeof metrics?.icmMessages?.current_value === 'number'
        ? Math.round(metrics.icmMessages.current_value / 365) // Daily average
        : undefined,
      tps: tps > 0 ? parseFloat(tps.toFixed(2)) : undefined,
      category: chainInfo?.category
    });
  }

  // Sort by validator count descending
  return Array.from(chainsMap.values())
    .filter(chain => chain.validatorCount > 0)
    .sort((a, b) => b.validatorCount - a.validatorCount);
}

// Generate a consistent color from chain name
function generateColorFromName(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = hash % 360;
  return `hsl(${hue}, 70%, 50%)`;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const clearCache = searchParams.get('clearCache') === 'true';

    // Check cache
    if (!clearCache && cachedCosmosData && Date.now() - cachedCosmosData.timestamp < CACHE_DURATION) {
      return NextResponse.json(cachedCosmosData.data, {
        headers: {
          'X-Data-Source': 'cache',
          'Cache-Control': 'public, max-age=300',
        }
      });
    }

    // Fetch fresh data in parallel
    const [validatorStats, overviewMetrics] = await Promise.all([
      fetchValidatorStats(),
      fetchOverviewMetrics()
    ]);
    
    const cosmosData = getChainCosmosData(validatorStats, overviewMetrics);

    // Update cache
    cachedCosmosData = { data: cosmosData, timestamp: Date.now() };

    return NextResponse.json(cosmosData, {
      headers: {
        'X-Data-Source': 'fresh',
        'Cache-Control': 'public, max-age=300',
      }
    });
  } catch (error: any) {
    console.error('Error in network-cosmos API:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch network cosmos data' },
      { status: 500 }
    );
  }
}
