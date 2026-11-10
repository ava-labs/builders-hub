import { NextResponse } from 'next/server';
import { EXPLORER_API_BASE } from "@/lib/pchain-explorer";
import { type SimpleValidator, type ValidatorVersion, type SubnetStats } from '@/types/validator-stats';
import { MAINNET_VALIDATOR_DISCOVERY_URL, FUJI_VALIDATOR_DISCOVERY_URL } from '@/constants/validator-discovery';
import l1ChainsData from "@/constants/l1-chains.json";
import { minorVersionLine } from "@/lib/node-version";
import { fetchSubnetsById, seatsOf, type ValidatorSeat } from "@/lib/pchain-subnets";
import { pchainPost } from "@/lib/pchain-rpc";
import { PRIMARY_SUBNET_ID } from "@/lib/pchain-node";

// Minimal subnet shape consumed from our /v1 subnets endpoint (Glacier-shape).
// blockchains is null (Go nil slice) for subnets that never created a chain.
type SubnetInfo = { subnetId: string; isL1: boolean; blockchains: { blockchainName: string }[] | null };

export const dynamic = 'force-dynamic';
// The cold aggregate paginates all L1 validators + subnets (pageSize capped at
// 100 upstream). Those lists are cached 24h and the origin serves stale while
// refreshing, so only a genuinely cold instance is slow — give it headroom so
// it can't 504 and leave the cache empty.
export const maxDuration = 60;

const LIST_CACHE_DURATION = 24 * 60 * 60 * 1000;
const PARTIAL_CACHE_DURATION = 60 * 1000;
const VERSION_CACHE_DURATION = 15 * 60 * 1000;
const STATS_CACHE_DURATION = 15 * 60 * 1000;
const PAGE_SIZE = 100;
// Our /v1 validator/subnet endpoints have a heavy cold-start (validators ~10s,
// subnets ~60s) before their state cache warms; give each page fetch generous
// headroom so a cold window doesn't abort and blank the whole aggregate. The
// warmer keeps them hot, so the steady-state path is sub-second.
const FETCH_TIMEOUT = 60000;
const CACHE_CONTROL_HEADER = 'public, max-age=0, s-maxage=900, stale-while-revalidate=3600';
const PCHAIN_TIMEOUT = 10000;

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

/* Fuji's L1 validators from the P-Chain's running sets, in one call. On
   2026-10-07 three reads of the l1Validators list gave Fuji 318, about
   13,000 and 411 rows (100 a page, 2.6 s a page when cold), and the P-Chain
   ran ~330 seats. So a failed P-Chain read does not read the list: it
   serves the last good result, or throws when there is none. A running set
   counts only when its subnet read says L1 (see seatsOf). complete is false
   when a subnet read failed or the last good result stands in. */
let lastFujiL1: SimpleValidator[] | null = null;

async function listFujiL1Validators(): Promise<{ validators: SimpleValidator[]; complete: boolean }> {
  try {
    const res = await pchainPost('fuji', {
      jsonrpc: '2.0', id: 1,
      method: 'platform.getAllValidatorsAt',
      params: { height: 'proposed' },
    }, PCHAIN_TIMEOUT);
    if (!res.ok) throw new Error(`p-chain ${res.status}`);
    const sets = (await res.json())?.result?.validatorSets;
    if (!sets || typeof sets !== 'object') throw new Error('unexpected p-chain response');
    const running = Object.entries(sets as Record<string, { validators?: ValidatorSeat[] } | null>)
      .filter(([subnetId, set]) => subnetId !== PRIMARY_SUBNET_ID && (set?.validators?.length ?? 0) > 0)
      .map(([subnetId]) => subnetId);
    const subnets = await fetchSubnetsById('fuji', running);
    const validators = seatsOf(sets, subnets);
    lastFujiL1 = validators;
    return { validators, complete: subnets.length === running.length };
  } catch (error) {
    if (!lastFujiL1) throw error;
    console.error('[listFujiL1Validators] P-Chain read failed, serving the last good list:', error);
    return { validators: lastFujiL1, complete: false };
  }
}

async function getAllValidators(network: "mainnet" | "fuji"): Promise<SimpleValidator[]> {
  const now = Date.now();
  const cache = validatorsCached[network];

  // Return cached data if still valid
  if (cache && (now - cache.timestamp) < LIST_CACHE_DURATION) {
    return cache.data;
  }

  // If a fetch is already in progress, wait for it
  if (cache?.promise) {
    return cache.promise;
  }

  // Start new fetch
  const promise = (async () => {
    const [l1, classicValidators] = await Promise.all([
      network === 'fuji' ? listFujiL1Validators() : listL1Validators(network).then(validators => ({ validators, complete: true })),
      listClassicValidators(network)
    ]);

    const allValidators = [...l1.validators, ...classicValidators];
    
    // Store in cache with timestamp. An incomplete list holds for 60 s only, so the next request reads again.
    validatorsCached[network] = {
      data: allValidators,
      timestamp: l1.complete ? Date.now() : Date.now() - LIST_CACHE_DURATION + PARTIAL_CACHE_DURATION,
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

  if (cache && (now - cache.timestamp) < LIST_CACHE_DURATION) {
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

/* Fuji has ~8,000 subnets (80 pages, more than 120 s cold), and the stats
   keep only the subnets with stake. So Fuji names only the subnets its
   validators stand on, one read per subnet. A subnet whose read fails gets
   the "Unknown" name, as an unlisted subnet does. */
async function getStakedSubnets(network: "mainnet" | "fuji", validators: SimpleValidator[]): Promise<SubnetInfo[]> {
  const subnets = await fetchSubnetsById(network, validators.map(v => v.subnetId));
  return subnets.map(s => ({
    subnetId: s.subnetId,
    isL1: !!s.isL1,
    blockchains: s.blockchains ? s.blockchains.map(b => ({ blockchainName: b.blockchainName ?? '' })) : null,
  }));
}

async function getValidatorVersions(network: "mainnet" | "fuji"): Promise<Map<string, string>> {
  const now = Date.now();
  const cache = validatorVersionsCached[network];

  // Check if cache exists and is still valid
  if (cache && (now - cache.timestamp) < VERSION_CACHE_DURATION) {
    return cache.data;
  }

  const versionMap = new Map<string, string>();

  // source: our own p_node_info snapshot, surfaced on the validators endpoint.
  try {
    const res = await fetchWithTimeout(`${EXPLORER_API_BASE}/api/${network}/validators`);
    if (res.ok) {
      const j = await res.json();
      for (const v of (Array.isArray(j?.validators) ? j.validators : [])) {
        if (v?.nodeId && v.version) versionMap.set(v.nodeId, v.version);
      }
    }
  } catch {
    // discovery below still covers the set
  }

  // discovery crawler reaches nodes we have not peered with, but reports
  // whatever version it last connected to, which lags badly.
  try {
    const url = network === "mainnet" ? MAINNET_VALIDATOR_DISCOVERY_URL : FUJI_VALIDATOR_DISCOVERY_URL;
    const response = await fetchWithTimeout(url);
    if (response.ok) {
      const data: ValidatorVersion[] = await response.json();
      for (const validator of data) {
        if (!validator.version) continue;
        if (versionMap.has(validator.nodeId)) continue;
        versionMap.set(validator.nodeId, validator.version);
      }
    }
  } catch {
    // both sources down, fall back to the last good map
  }

  // Nothing resolved: keep serving the previous map
  if (versionMap.size === 0) {
    return cache ? cache.data : new Map<string, string>();
  }

  validatorVersionsCached[network] = { data: versionMap, timestamp: now };
  return versionMap;
}

async function getNetworkStatsInternal(network: "mainnet" | "fuji"): Promise<SubnetStats[]> {
  const validatorsRead = getAllValidators(network);
  const [validators, subnets, versionMap] = await Promise.all([
    validatorsRead,
    network === 'fuji' ? validatorsRead.then(v => getStakedSubnets(network, v)) : getAllSubnets(network),
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

    const version = minorVersionLine(versionMap.get(validator.nodeId)) || "Unknown";

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
  const isCacheValid = cacheAge < STATS_CACHE_DURATION;
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
    // the caller gets the error: this chain only frees the slot
    pendingPromise.finally(() => pendingStatsRequests.delete(network)).catch(() => {});
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
    // an error answer is not kept: the next request asks again
    'Cache-Control': status >= 400 ? 'no-store' : CACHE_CONTROL_HEADER, 
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
      (cacheAge && cacheAge < STATS_CACHE_DURATION ? 'cache' : 'stale-while-revalidate') : 
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
