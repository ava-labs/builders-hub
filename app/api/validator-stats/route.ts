import { NextResponse } from 'next/server';
import { EXPLORER_API_BASE } from "@/lib/pchain-explorer";
import { type SimpleValidator, type ValidatorVersion, type SubnetStats } from '@/types/validator-stats';
import { MAINNET_VALIDATOR_DISCOVERY_URL, FUJI_VALIDATOR_DISCOVERY_URL } from '@/constants/validator-discovery';
import l1ChainsData from "@/constants/l1-chains.json";

// Minimal subnet shape consumed from our /v1 subnets endpoint (Glacier-shape).
// blockchains is null (Go nil slice) for subnets that never created a chain.
type SubnetInfo = { subnetId: string; isL1: boolean; blockchains: { blockchainName: string }[] | null };

export const dynamic = 'force-dynamic';
// The cold aggregate paginates all L1 validators + subnets (pageSize capped at
// 100 upstream). Result is cached 24h with stale-while-revalidate, so only the
// first request after expiry is slow — give it headroom so it can't 504 and
// leave the cache empty.
export const maxDuration = 60;

const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours
const VERSION_CACHE_DURATION = 24 * 60 * 60 * 1000;
const PAGE_SIZE = 100;
// Our /v1 validator/subnet endpoints have a heavy cold-start (validators ~10s,
// subnets ~60s) before their state cache warms; give each page fetch generous
// headroom so a cold window doesn't abort and blank the whole aggregate. The
// warmer keeps them hot, so the steady-state path is sub-second.
const FETCH_TIMEOUT = 60000;
// max-age=0: the CDN holds the day-long copy (s-maxage); browsers must
// revalidate every time, so one bad response cached during an outage can't
// pin a client's dashboards to a dash for 24 hours
const CACHE_CONTROL_HEADER = 'public, max-age=0, s-maxage=86400, stale-while-revalidate=172800';

const validatorsCached: Partial<Record<string, { data: SimpleValidator[]; timestamp: number; promise?: Promise<SimpleValidator[]> }>> = {};
const subnetsCached: Partial<Record<string, { data: SubnetInfo[]; timestamp: number; promise?: Promise<SubnetInfo[]> }>> = {};
const validatorVersionsCached: Partial<Record<string, { data: Map<string, string>; timestamp: number }>> = {};
const statsCached: Partial<Record<string, { data: SubnetStats[]; timestamp: number }>> = {};
const revalidatingKeys = new Set<string>();
const pendingStatsRequests = new Map<string, Promise<SubnetStats[]>>();

async function fetchWithTimeout(url: string, timeout: number = FETCH_TIMEOUT): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'Accept': 'application/json' },
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

// Fetch every page of a /v1 list endpoint (pageToken pagination), collecting the
// named array field. Server-side, so it hits the plain-HTTP EXPLORER_API_BASE
// directly. Replaces the Glacier SDK's async pager.
async function fetchAllPages<T>(path: string, field: string): Promise<T[]> {
  const out: T[] = [];
  let pageToken: string | undefined;
  for (let i = 0; i < 200; i++) {
    const sep = path.includes("?") ? "&" : "?";
    const tok = pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : "";
    const res = await fetchWithTimeout(`${EXPLORER_API_BASE}${path}${sep}pageSize=${PAGE_SIZE}${tok}`);
    if (!res.ok) throw new Error(`validators upstream ${res.status} for ${path}`);
    const page = await res.json();
    const arr: T[] = Array.isArray(page?.[field]) ? page[field] : [];
    out.push(...arr);
    pageToken = page?.nextPageToken;
    if (!pageToken || arr.length < PAGE_SIZE) break;
  }
  return out;
}

async function listClassicValidators(network: "mainnet" | "fuji"): Promise<SimpleValidator[]> {
  // Primary-network validators from the explorer-shape snapshot — ONE fast
  // response (the whole current set), instead of paginating ~30 pages of the
  // heavy /v1 validators endpoint (~3s/page → ~90s → 504). Same source the
  // P-chain /validators page uses, so counts stay consistent.
  const res = await fetchWithTimeout(`${EXPLORER_API_BASE}/api/${network}/validators`);
  if (!res.ok) throw new Error(`validators upstream ${res.status}`);
  const j = await res.json();
  const vs: any[] = Array.isArray(j?.validators) ? j.validators : [];
  return vs.map(v => ({
    nodeId: v.nodeId,
    subnetId: v.subnetId,
    weight: Number(v.totalStake ?? v.weight),
  }));
}

async function listL1Validators(network: "mainnet" | "fuji"): Promise<SimpleValidator[]> {
  // Active L1 validators across all subnets from our P-chain read API.
  //
  // Upstream fixed 2026-07-24 (stats-api PR #8): the endpoint used to ship
  // removed validators (weight-0 rows with stale balances — Coqnet reported
  // 1,231 "active" vs 6 on the node) because the replay had ACP-77 removal
  // and disable semantics inverted. The weight/balance filter below is kept
  // as a cheap defense against regressions; post-fix it drops nothing the
  // endpoint should have sent. Counts here are REGISTERED ACTIVE seats —
  // remainingBalance is still gross of continuous-fee burn upstream, so
  // drained-but-not-removed seats pass the balance check.
  const vs = await fetchAllPages<any>(`/v1/networks/${network}/l1Validators?includeInactive=false`, "validators");
  return vs
    .filter(v => Number(v.weight) > 0 && Number(v.remainingBalance) > 0)
    .map(v => ({
      nodeId: v.nodeId,
      subnetId: v.subnetId,
      weight: Number(v.weight),
    }));
}

async function getAllValidators(network: "mainnet" | "fuji"): Promise<SimpleValidator[]> {
  const now = Date.now();
  const cache = validatorsCached[network];

  // Return cached data if still valid
  if (cache && (now - cache.timestamp) < CACHE_DURATION) {
    return cache.data;
  }

  // If a fetch is already in progress, wait for it
  if (cache?.promise) {
    return cache.promise;
  }

  // Start new fetch
  const promise = (async () => {
    const [l1Validators, classicValidators] = await Promise.all([
      listL1Validators(network),
      listClassicValidators(network)
    ]);

    const allValidators = [...l1Validators, ...classicValidators];
    
    // Store in cache with timestamp
    validatorsCached[network] = {
      data: allValidators,
      timestamp: Date.now(),
    };
    
    return allValidators;
  })();

  validatorsCached[network] = {
    data: cache?.data || [],
    timestamp: cache?.timestamp || 0,
    promise,
  };

  promise.catch(() => {
    if (validatorsCached[network]?.promise === promise) {
      delete validatorsCached[network]?.promise;
    }
  });

  return promise;
}

async function getAllSubnets(network: "mainnet" | "fuji"): Promise<SubnetInfo[]> {
  const now = Date.now();
  const cache = subnetsCached[network];

  if (cache && (now - cache.timestamp) < CACHE_DURATION) {
    return cache.data;
  }

  if (cache?.promise) {
    return cache.promise;
  }

  // Start new fetch
  const promise = (async () => {
    // Subnet list (subnetId, isL1, blockchain names) from our P-chain read API.
    const allSubnets = await fetchAllPages<SubnetInfo>(`/v1/networks/${network}/subnets`, "subnets");

    subnetsCached[network] = {
      data: allSubnets,
      timestamp: Date.now(),
    };
    
    return allSubnets;
  })();

  subnetsCached[network] = {
    data: cache?.data || [],
    timestamp: cache?.timestamp || 0,
    promise,
  };

  promise.catch(() => {
    if (subnetsCached[network]?.promise === promise) {
      delete subnetsCached[network]?.promise;
    }
  });

  return promise;
}

async function getValidatorVersions(network: "mainnet" | "fuji"): Promise<Map<string, string>> {
  const now = Date.now();
  const cache = validatorVersionsCached[network];

  // Check if cache exists and is still valid
  if (cache && (now - cache.timestamp) < VERSION_CACHE_DURATION) {
    return cache.data;
  }

  const url = network === "mainnet" ? MAINNET_VALIDATOR_DISCOVERY_URL : FUJI_VALIDATOR_DISCOVERY_URL;
  
  try {
    const response = await fetchWithTimeout(url);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch validator versions: ${response.status}`);
    }

    const data: ValidatorVersion[] = await response.json();
    const versionMap = new Map<string, string>();

    for (const validator of data) {
      versionMap.set(validator.nodeId, validator.version || "Unknown");
    }

    // Update cache
    validatorVersionsCached[network] = {
      data: versionMap,
      timestamp: now
    };

    return versionMap;
  } catch (error: any) {
    // Return cached data if available, even if stale
    if (cache) {
      return cache.data;
    }
    return new Map<string, string>();
  }
}

async function getNetworkStatsInternal(network: "mainnet" | "fuji"): Promise<SubnetStats[]> {
  const [validators, subnets, versionMap] = await Promise.all([
    getAllValidators(network),
    getAllSubnets(network),
    getValidatorVersions(network)
  ]);

  const subnetAccumulators: Record<string, {
    name: string;
    id: string;
    totalStake: bigint;
    byClientVersion: Record<string, { stake: bigint; nodes: number }>;
    isL1: boolean;
  }> = {};

  // Create a map of subnetId to isL1 from subnets
  const subnetIsL1Map = new Map<string, boolean>();
  for (const subnet of subnets) {
    subnetIsL1Map.set(subnet.subnetId, subnet.isL1);
    if (subnetAccumulators[subnet.subnetId]) continue;
    subnetAccumulators[subnet.subnetId] = {
      name: (subnet.blockchains ?? []).map(blockchain => blockchain.blockchainName).join('/') || `Subnet (${subnet.subnetId.slice(0, 8)}…)`,
      id: subnet.subnetId,
      byClientVersion: {},
      totalStake: 0n,
      isL1: subnet.isL1,
    };
  }

  for (const validator of validators) {
    const subnetId = validator.subnetId;

    if (!subnetAccumulators[subnetId]) {
      subnetAccumulators[subnetId] = {
        name: `Unknown (${subnetId})`,
        id: subnetId,
        byClientVersion: {},
        totalStake: 0n,
        isL1: subnetIsL1Map.get(subnetId) || false,
      };
    }

    const stake = BigInt(validator.weight);
    subnetAccumulators[subnetId].totalStake += stake;

    const version = versionMap.get(validator.nodeId)?.replace("avalanchego/", "") || "Unknown";

    if (!subnetAccumulators[subnetId].byClientVersion[version]) {
      subnetAccumulators[subnetId].byClientVersion[version] = {
        stake: 0n,
        nodes: 0
      };
    }
    subnetAccumulators[subnetId].byClientVersion[version].stake += stake;
    subnetAccumulators[subnetId].byClientVersion[version].nodes += 1;
  }

  // Create maps of subnetId to chainLogoURI and chainName from l1-chains.json
  const subnetLogoMap = new Map<string, string>();
  const subnetNameMap = new Map<string, string>();
  l1ChainsData.forEach((chain: any) => {
    if (chain.subnetId) {
      if (chain.chainLogoURI) {
        subnetLogoMap.set(chain.subnetId, chain.chainLogoURI);
      }
      if (chain.chainName) {
        subnetNameMap.set(chain.subnetId, chain.chainName);
      }
    }
  });

  const result: SubnetStats[] = [];
  for (const subnet of Object.values(subnetAccumulators)) {
    if (subnet.totalStake === 0n) continue;

    const byClientVersion: Record<string, { stakeString: string; nodes: number }> = {};
    for (const [version, data] of Object.entries(subnet.byClientVersion)) {
      byClientVersion[version] = {
        stakeString: data.stake.toString(),
        nodes: data.nodes
      };
    }

    const chainName = subnetNameMap.get(subnet.id) || subnet.name;

    result.push({
      name: chainName,
      id: subnet.id,
      totalStakeString: subnet.totalStake.toString(),
      byClientVersion,
      chainLogoURI: subnetLogoMap.get(subnet.id) || undefined,
      isL1: subnet.isL1
    });
  }

  return result;
}

async function getNetworkStats(network: "mainnet" | "fuji"): Promise<SubnetStats[]> {
  const now = Date.now();
  const cache = statsCached[network];
  const cacheAge = cache ? now - cache.timestamp : Infinity;
  const isCacheValid = cacheAge < CACHE_DURATION;
  const isCacheStale = cache && !isCacheValid;

  if (isCacheStale && !revalidatingKeys.has(network)) {
    revalidatingKeys.add(network);
    
    // Background refresh
    (async () => {
      try {
        const freshData = await getNetworkStatsInternal(network);
        statsCached[network] = { data: freshData, timestamp: Date.now() };
      } catch (error) {
        console.error(`[getNetworkStats] Background refresh failed for ${network}:`, error);
      } finally {
        revalidatingKeys.delete(network);
      }
    })();
    
    return cache.data;
  }
  
  // Return valid cache
  if (isCacheValid && cache) { return cache.data; }
  
  let pendingPromise = pendingStatsRequests.get(network);
  
  if (!pendingPromise) {
    pendingPromise = getNetworkStatsInternal(network);
    pendingStatsRequests.set(network, pendingPromise);
    pendingPromise.finally(() => pendingStatsRequests.delete(network));
  }
  
  const freshData = await pendingPromise; 
  statsCached[network] = { data: freshData, timestamp: Date.now() };
  return freshData;
}

function createResponse(
  data: SubnetStats[] | { error: string },
  meta: { source: string; network?: string; cacheAge?: number; fetchTime?: number },
  status = 200
) {
  const headers: Record<string, string> = { 
    'Cache-Control': CACHE_CONTROL_HEADER, 
    'X-Data-Source': meta.source 
  };
  if (meta.network) headers['X-Network'] = meta.network;
  if (meta.cacheAge !== undefined) headers['X-Cache-Age'] = `${Math.round(meta.cacheAge / 1000)}s`;
  if (meta.fetchTime !== undefined) headers['X-Fetch-Time'] = `${meta.fetchTime}ms`;
  return NextResponse.json(data, { status, headers });
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const network = searchParams.get('network');

    if (!network || (network !== 'mainnet' && network !== 'fuji')) {
      return createResponse(
        { error: 'Invalid or missing network parameter. Use ?network=mainnet or ?network=fuji' },
        { source: 'error' },
        400
      );
    }

    const startTime = Date.now();
    const cache = statsCached[network];
    const cacheAge = cache ? Date.now() - cache.timestamp : undefined;
    
    const stats = await getNetworkStats(network);
    const fetchTime = Date.now() - startTime;

    const source = fetchTime < 50 && cache ? 
      (cacheAge && cacheAge < CACHE_DURATION ? 'cache' : 'stale-while-revalidate') : 
      'fresh';
    
    console.log(`[GET /api/validator-stats] Network: ${network}, Source: ${source}, fetchTime: ${fetchTime}ms`);

    return createResponse(stats, { 
      source, 
      network, 
      cacheAge,
      fetchTime 
    });
  } catch (error: any) {
    const { searchParams } = new URL(request.url);
    const network = searchParams.get('network') || 'unknown';
    console.error(`[GET /api/validator-stats] Error (${network}):`, error);

    if (network === 'mainnet' || network === 'fuji') {
      const cache = statsCached[network];
      if (cache) {
        console.log(`[GET /api/validator-stats] Network: ${network}, Source: error-fallback-cache`);
        return createResponse(cache.data, { 
          source: 'error-fallback-cache', 
          network,
          cacheAge: Date.now() - cache.timestamp
        }, 206);
      }
    }
    
    return createResponse(
      { error: error?.message || `Failed to fetch validator stats for ${network}` },
      { source: 'error', network },
      500
    );
  }
}
