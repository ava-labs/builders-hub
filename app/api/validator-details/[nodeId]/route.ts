import { NextResponse } from 'next/server';
import { Avalanche } from "@avalanche-sdk/chainkit";
import { STATS_CONFIG } from "@/types/stats";

export const dynamic = 'force-dynamic';

const FETCH_TIMEOUT = 15000;
const CACHE_CONTROL_HEADER = 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400';

interface ValidatorDetails {
  txHash: string;
  nodeId: string;
  subnetId: string;
  amountStaked: string;
  delegationFee: string;
  startTimestamp: number;
  endTimestamp: number;
  blsCredentials?: {
    publicKey: string;
    proofOfPossession: string;
  };
  stakePercentage: number;
  validatorHealth?: {
    reachabilityPercent: number;
    benchedPChainRequestsPercent: number;
    benchedXChainRequestsPercent: number;
    benchedCChainRequestsPercent: number;
  };
  delegatorCount: number;
  amountDelegated: string;
  potentialRewards?: {
    validationRewardAmount: string;
    delegationRewardAmount: string;
    rewardAddresses: string[];
  };
  uptimePerformance: number;
  avalancheGoVersion?: string;
  delegationCapacity: string;
  validationStatus: string;
  geolocation?: {
    city: string;
    country: string;
    countryCode: string;
    latitude: number;
    longitude: number;
  };
}

interface CacheEntry {
  data: ValidatorDetails;
  timestamp: number;
}

// Cache for validator details
const cachedData = new Map<string, CacheEntry>();
const revalidatingKeys = new Set<string>();
const pendingRequests = new Map<string, Promise<ValidatorDetails | null>>();

async function fetchValidatorDetails(nodeId: string): Promise<ValidatorDetails | null> {
  const avalanche = new Avalanche({ network: "mainnet" });
  
  try {
    const result = await avalanche.data.primaryNetwork.getValidatorDetails({
      pageSize: 10,
      nodeId: nodeId,
      validationStatus: "active",
      sortOrder: "desc",
    });

    for await (const page of result) {
      const validators = page.result?.validators || [];
      for (const v of validators) {
        if (v.validationStatus === "active") {
          return {
            txHash: v.txHash || "",
            nodeId: v.nodeId,
            subnetId: v.subnetId || "11111111111111111111111111111111LpoYY",
            amountStaked: v.amountStaked || "0",
            delegationFee: v.delegationFee?.toString() || "0",
            startTimestamp: v.startTimestamp || 0,
            endTimestamp: v.endTimestamp || 0,
            blsCredentials: v.blsCredentials ? {
              publicKey: v.blsCredentials.publicKey || "",
              proofOfPossession: v.blsCredentials.proofOfPossession || "",
            } : undefined,
            stakePercentage: v.stakePercentage || 0,
            validatorHealth: v.validatorHealth ? {
              reachabilityPercent: v.validatorHealth.reachabilityPercent || 0,
              benchedPChainRequestsPercent: v.validatorHealth.benchedPChainRequestsPercent || 0,
              benchedXChainRequestsPercent: v.validatorHealth.benchedXChainRequestsPercent || 0,
              benchedCChainRequestsPercent: v.validatorHealth.benchedCChainRequestsPercent || 0,
            } : undefined,
            delegatorCount: v.delegatorCount || 0,
            amountDelegated: v.amountDelegated || "0",
            potentialRewards: v.potentialRewards ? {
              validationRewardAmount: v.potentialRewards.validationRewardAmount || "0",
              delegationRewardAmount: v.potentialRewards.delegationRewardAmount || "0",
              rewardAddresses: v.potentialRewards.rewardAddresses || [],
            } : undefined,
            uptimePerformance: v.uptimePerformance || 0,
            avalancheGoVersion: v.avalancheGoVersion,
            delegationCapacity: v.delegationCapacity || "0",
            validationStatus: v.validationStatus,
            geolocation: v.geolocation ? {
              city: v.geolocation.city || "",
              country: v.geolocation.country || "",
              countryCode: v.geolocation.countryCode || "",
              latitude: v.geolocation.latitude || 0,
              longitude: v.geolocation.longitude || 0,
            } : undefined,
          };
        }
      }
    }
    
    return null;
  } catch (error) {
    console.error(`[fetchValidatorDetails] Error fetching details for ${nodeId}:`, error);
    throw error;
  }
}

async function fetchWithTimeout(nodeId: string): Promise<ValidatorDetails | null> {
  return Promise.race([
    fetchValidatorDetails(nodeId),
    new Promise<ValidatorDetails | null>((_, reject) => 
      setTimeout(() => reject(new Error('Request timeout')), FETCH_TIMEOUT)
    )
  ]);
}

function createResponse(
  data: { validatorDetails: ValidatorDetails } | { error: string },
  meta: { source: string; nodeId?: string; cacheAge?: number; fetchTime?: number },
  status = 200
) {
  const headers: Record<string, string> = {
    'Cache-Control': CACHE_CONTROL_HEADER,
    'X-Data-Source': meta.source,
  };
  if (meta.cacheAge !== undefined) headers['X-Cache-Age'] = `${Math.round(meta.cacheAge / 1000)}s`;
  if (meta.fetchTime !== undefined) headers['X-Fetch-Time'] = `${meta.fetchTime}ms`;

  return NextResponse.json(data, { status, headers });
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ nodeId: string }> }
) {
  try {
    const { nodeId } = await params;
    const { searchParams } = new URL(request.url);
    
    if (!nodeId) { return createResponse({ error: 'Node ID is required' }, { source: 'error' }, 400) }

    if (!nodeId.startsWith('NodeID-')) {
      return createResponse(
        { error: 'Invalid Node ID format. Expected format: NodeID-xxx' },
        { source: 'error' },
        400
      );
    }

    if (searchParams.get('clearCache') === 'true') {
      cachedData.clear();
      revalidatingKeys.clear();
    }

    const now = Date.now();
    const cached = cachedData.get(nodeId);
    const cacheAge = cached ? now - cached.timestamp : Infinity;
    const isCacheValid = cacheAge < STATS_CONFIG.CACHE.LONG_DURATION;
    const isCacheStale = cached && !isCacheValid;

    // Stale-while-revalidate: serve stale data immediately, refresh in background
    if (isCacheStale && !revalidatingKeys.has(nodeId)) {
      revalidatingKeys.add(nodeId);
      (async () => {
        try {
          const freshData = await fetchWithTimeout(nodeId);
          if (freshData) { cachedData.set(nodeId, { data: freshData, timestamp: Date.now() }) }
        } catch (error) {
          console.error(`[GET /api/validator-details/${nodeId}] Background refresh failed:`, error);
        } finally {
          revalidatingKeys.delete(nodeId);
        }
      })();
      return createResponse(
        { validatorDetails: cached.data },
        { source: 'stale-while-revalidate', nodeId, cacheAge }
      );
    }

    // Return valid cache
    if (isCacheValid && cached) {
      console.log(`[GET /api/validator-details/${nodeId}] Source: cache`);
      return createResponse(
        { validatorDetails: cached.data },
        { source: 'cache', nodeId, cacheAge }
      );
    }

    // Deduplicate pending requests for the same nodeId
    let pendingPromise = pendingRequests.get(nodeId);

    if (!pendingPromise) {
      pendingPromise = fetchWithTimeout(nodeId);
      pendingRequests.set(nodeId, pendingPromise);
      pendingPromise.finally(() => pendingRequests.delete(nodeId));
    }

    const startTime = Date.now();
    const validatorDetails = await pendingPromise;
    const fetchTime = Date.now() - startTime;

    if (!validatorDetails) {
      return createResponse(
        { error: 'Validator not found or not currently active' },
        { source: 'error', nodeId },
        404
      );
    }

    // Update cache
    cachedData.set(nodeId, { data: validatorDetails, timestamp: now });

    console.log(`[GET /api/validator-details/${nodeId}] Source: fresh, fetchTime: ${fetchTime}ms`);
    return createResponse(
      { validatorDetails },
      { source: 'fresh', nodeId, fetchTime }
    );
  } catch (error: any) {
    console.error('[GET /api/validator-details] Error:', error);
    const { nodeId } = await params;
    const cached = cachedData.get(nodeId);
    if (cached) {
      console.log(`[GET /api/validator-details/${nodeId}] Source: error-fallback-cache`);
      return createResponse(
        { validatorDetails: cached.data },
        { source: 'error-fallback-cache', nodeId, cacheAge: Date.now() - cached.timestamp },
        206
      );
    }

    return createResponse(
      { error: error?.message || 'Failed to fetch validator details' },
      { source: 'error' },
      500
    );
  }
}
