import { NextResponse } from 'next/server';
import { EXPLORER_API_BASE } from "@/lib/pchain-explorer";

export const dynamic = 'force-dynamic';

// The snapshot is one fast response, and the validators page reads it for
// live triage (who is offline now), so it is held for minutes, not hours.
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes
const STALE_DURATION = 24 * 60 * 60 * 1000; // 1 day
// Generous timeout for our /v1 validators cold-start (state build) before its
// cache warms; the warmer normally keeps it hot so this rarely bites.
const FETCH_TIMEOUT = 60000;
const CACHE_CONTROL_HEADER = 'public, max-age=600, s-maxage=600, stale-while-revalidate=86400';

interface ValidatorData {
  nodeId: string;
  amountStaked: string;
  delegationFee: string;
  validationStatus: string;
  delegatorCount: number;
  amountDelegated: string;
  version?: string;
  connected?: boolean;
  /** our node's reading of its uptime, percent */
  uptime?: number;
  /** unix seconds the validation ends */
  endTime?: number;
}

interface CacheEntry {
  data: ValidatorData[];
  timestamp: number;
}

type Network = 'mainnet' | 'fuji';

// each network keeps its own copy, its own fetch in flight and its own refresh
const cached = new Map<Network, CacheEntry>();
const pendingRequests = new Map<Network, Promise<ValidatorData[]>>();
const revalidating = new Set<Network>();

async function fetchAllValidators(network: Network): Promise<ValidatorData[]> {
  // Primary-network validators from the explorer-shape snapshot — ONE fast
  // response (the whole current set), instead of paginating ~30 pages of the
  // heavy /v1 validators endpoint (~3s/page → ~90s → 504). Same source the
  // P-chain /validators page uses.
  const res = await fetch(`${EXPLORER_API_BASE}/api/${network}/validators`, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`validators upstream ${res.status}`);
  const j = await res.json();
  const vs: any[] = Array.isArray(j?.validators) ? j.validators : [];
  // Explorer shape → the Glacier-ish ValidatorData the UI expects. weight is the
  // self-stake (nAVAX), delegatorWeight the delegated amount, both numbers.
  return vs.map((v: any) => ({
    nodeId: v.nodeId,
    amountStaked: String(v.weight ?? "0"),
    delegationFee: String(v.delegationFeePercent ?? "0"),
    validationStatus: "active",
    delegatorCount: v.delegatorCount || 0,
    amountDelegated: String(v.delegatorWeight ?? "0"),
    ...(typeof v.version === "string" && v.version ? { version: v.version } : {}),
    ...(typeof v.connected === "boolean" ? { connected: v.connected } : {}),
    // where no crawler watches the network, these stand in for its readings
    ...(typeof v.uptimePercent === "number" ? { uptime: v.uptimePercent } : {}),
    ...(typeof v.endTimestamp === "number" ? { endTime: v.endTimestamp } : {}),
  }));
}

async function fetchWithTimeout(network: Network): Promise<ValidatorData[]> {
  return Promise.race([
    fetchAllValidators(network),
    new Promise<ValidatorData[]>((_, reject) => 
      setTimeout(() => reject(new Error('Request timeout')), FETCH_TIMEOUT)
    )
  ]);
}

async function getValidators(network: Network): Promise<ValidatorData[]> {
  const now = Date.now();
  const cachedData = cached.get(network);
  const cacheAge = cachedData ? now - cachedData.timestamp : Infinity;
  const isCacheValid = cacheAge < CACHE_DURATION;
  const isCacheStale = cachedData && !isCacheValid && cacheAge < STALE_DURATION;

  // a stale copy is served while one background refresh runs, never a second upstream fetch
  if (isCacheStale && cachedData) {
    if (revalidating.has(network)) return cachedData.data;
    revalidating.add(network);
    
    (async () => {
      try {
        const freshData = await fetchWithTimeout(network);
        cached.set(network, { data: freshData, timestamp: Date.now() });
      } catch (error) {
        console.error('[getValidators] Background refresh failed:', error);
      } finally {
        revalidating.delete(network);
      }
    })();
    
    return cachedData.data;
  }

  if (isCacheValid && cachedData) { return cachedData.data; }

  const inFlight = pendingRequests.get(network);
  if (inFlight) { return inFlight; }

  // Start new fetch
  const request = fetchWithTimeout(network);
  pendingRequests.set(network, request);
  request.finally(() => { pendingRequests.delete(network); });

  const freshData = await request;
  cached.set(network, { data: freshData, timestamp: Date.now() });
  return freshData;
}

function createResponse(
  data: { validators: ValidatorData[]; totalCount: number; network: string } | { error: string },
  meta: { source: string; cacheAge?: number; fetchTime?: number },
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

export async function GET(request: Request) {
  const param = new URL(request.url).searchParams.get('network') ?? 'mainnet';
  if (param !== 'mainnet' && param !== 'fuji') {
    return createResponse({ error: `Unknown network "${param}"` }, { source: 'error' }, 400);
  }
  const network: Network = param;
  const cachedData = cached.get(network);
  try {
    const startTime = Date.now();
    const cacheAge = cachedData ? Date.now() - cachedData.timestamp : undefined;
    
    const validators = await getValidators(network);
    const fetchTime = Date.now() - startTime;

    // Determine data source based on response time
    const source = fetchTime < 50 && cachedData ? (cacheAge && cacheAge < CACHE_DURATION ? 'cache' : 'stale-while-revalidate') : 'fresh';

    console.log(`[GET /api/primary-network-validators] Source: ${source}, fetchTime: ${fetchTime}ms`);

    return createResponse(
      {
        validators,
        totalCount: validators.length,
        network,
      },
      { source, cacheAge, fetchTime }
    );
  } catch (error: any) {
    console.error('[GET /api/primary-network-validators] Error:', error);
    
    const fallback = cached.get(network);
    if (fallback && (Date.now() - fallback.timestamp) < STALE_DURATION) {
      console.log(`[GET /api/primary-network-validators] Source: error-fallback-cache`);
      return createResponse(
        {
          validators: fallback.data,
          totalCount: fallback.data.length,
          network,
        },
        { 
          source: 'error-fallback-cache', 
          cacheAge: Date.now() - fallback.timestamp 
        },
        206
      );
    }
    
    return createResponse(
      { error: error?.message || 'Failed to fetch validators' },
      { source: 'error' },
      500
    );
  }
}

