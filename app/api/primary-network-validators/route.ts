import { NextResponse } from 'next/server';
import { Avalanche } from "@avalanche-sdk/chainkit";

export const dynamic = 'force-dynamic';

const CACHE_DURATION = 4 * 60 * 60 * 1000; // 4 hours
const STALE_DURATION = 24 * 60 * 60 * 1000; // 1 day
const PAGE_SIZE = 100;
const FETCH_TIMEOUT = 30000;
const CACHE_CONTROL_HEADER = 'public, max-age=14400, s-maxage=14400, stale-while-revalidate=86400';

interface ValidatorData {
  nodeId: string;
  amountStaked: string;
  delegationFee: string;
  validationStatus: string;
  delegatorCount: number;
  amountDelegated: string;
}

interface CacheEntry {
  data: ValidatorData[];
  timestamp: number;
}

let cachedData: CacheEntry | null = null;
let pendingRequest: Promise<ValidatorData[]> | null = null;
let isRevalidating = false;

async function fetchAllValidators(): Promise<ValidatorData[]> {
  const avalanche = new Avalanche({ network: "mainnet" });
  const validators: ValidatorData[] = [];
  
  const result = await avalanche.data.primaryNetwork.listValidators({
    pageSize: PAGE_SIZE,
    validationStatus: "active",
    subnetId: "11111111111111111111111111111111LpoYY",
    network: "mainnet",
  });

  let pageCount = 0;
  const maxPages = 50;
  
  for await (const page of result) {
    pageCount++;
    const pageData = page.result.validators || [];
    if (!Array.isArray(pageData)) { continue; }
    
    const pageValidators = pageData.map((v: any) => ({
      nodeId: v.nodeId,
      amountStaked: v.amountStaked,
      delegationFee: v.delegationFee,
      validationStatus: v.validationStatus,
      delegatorCount: v.delegatorCount || 0,
      amountDelegated: v.amountDelegated || "0",
    }));
    
    validators.push(...pageValidators);     
    if (pageCount >= maxPages) { break; }   
    if (pageValidators.length < PAGE_SIZE) { break; }
  }
  return validators;
}

async function fetchWithTimeout(): Promise<ValidatorData[]> {
  return Promise.race([
    fetchAllValidators(),
    new Promise<ValidatorData[]>((_, reject) => 
      setTimeout(() => reject(new Error('Request timeout')), FETCH_TIMEOUT)
    )
  ]);
}

async function getValidators(): Promise<ValidatorData[]> {
  const now = Date.now();
  const cacheAge = cachedData ? now - cachedData.timestamp : Infinity;
  const isCacheValid = cacheAge < CACHE_DURATION;
  const isCacheStale = cachedData && !isCacheValid && cacheAge < STALE_DURATION;

  if (isCacheStale && cachedData && !isRevalidating) {
    isRevalidating = true;
    
    (async () => {
      try {
        const freshData = await fetchWithTimeout();
        cachedData = { data: freshData, timestamp: Date.now() };
      } catch (error) {
        console.error('[getValidators] Background refresh failed:', error);
      } finally {
        isRevalidating = false;
      }
    })();
    
    return cachedData.data;
  }

  if (isCacheValid && cachedData) { return cachedData.data; }

  if (pendingRequest) { return pendingRequest; }

  // Start new fetch
  pendingRequest = fetchWithTimeout();
  pendingRequest.finally(() => { pendingRequest = null; });

  const freshData = await pendingRequest;
  cachedData = { data: freshData, timestamp: Date.now() };
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

export async function GET(_request: Request) {
  try {
    const startTime = Date.now();
    const cacheAge = cachedData ? Date.now() - cachedData.timestamp : undefined;
    
    const validators = await getValidators();
    const fetchTime = Date.now() - startTime;

    // Determine data source based on response time
    const source = fetchTime < 50 && cachedData ? (cacheAge && cacheAge < CACHE_DURATION ? 'cache' : 'stale-while-revalidate') : 'fresh';

    console.log(`[GET /api/primary-network-validators] Source: ${source}, fetchTime: ${fetchTime}ms`);

    return createResponse(
      {
        validators,
        totalCount: validators.length,
        network: 'mainnet',
      },
      { source, cacheAge, fetchTime }
    );
  } catch (error: any) {
    console.error('[GET /api/primary-network-validators] Error:', error);
    
    if (cachedData && (Date.now() - cachedData.timestamp) < STALE_DURATION) {
      console.log(`[GET /api/primary-network-validators] Source: error-fallback-cache`);
      return createResponse(
        {
          validators: cachedData.data,
          totalCount: cachedData.data.length,
          network: 'mainnet',
        },
        { 
          source: 'error-fallback-cache', 
          cacheAge: Date.now() - cachedData.timestamp 
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

