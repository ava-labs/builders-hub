import { NextResponse } from "next/server";
import { EXPLORER_API_BASE } from "@/lib/pchain-explorer";
import {
  FUJI_VALIDATOR_DISCOVERY_URL,
  MAINNET_VALIDATOR_DISCOVERY_URL,
} from "@/constants/validator-discovery";

const PAGE_SIZE = 100;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
// Generous timeout for our /v1 validators/l1Validators cold-start before their
// state cache warms (warmer keeps them hot in steady state).
const FETCH_TIMEOUT = 60000;
const VERSION_FETCH_TIMEOUT = 10000;

interface ValidatorData {
  nodeId: string;
  amountStaked: string;
  delegationFee: string;
  validationStatus: string;
  delegatorCount: number;
  amountDelegated: string;
  validationId?: string;
  weight?: number;
  remainingBalance?: number;
  creationTimestamp?: number;
  blsCredentials?: any;
  remainingBalanceOwner?: {
    addresses: string[];
    threshold: number;
  };
  deactivationOwner?: {
    addresses: string[];
    threshold: number;
  };
  version?: string;
}

interface ValidatorVersion {
  nodeId: string;
  version: string;
}

const cacheStore = new Map<string, {data: ValidatorData[]; timestamp: number; versionBreakdown?: any}>();
const versionCacheStore = new Map<string, {data: Map<string, string>; timestamp: number}>();

async function fetchValidatorVersions(network: "mainnet" | "fuji" = "mainnet"): Promise<Map<string, string>> {
  const now = Date.now();
  const cached = versionCacheStore.get(network);
  
  if (cached && (now - cached.timestamp) < CACHE_DURATION) {
    return cached.data;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), VERSION_FETCH_TIMEOUT);
    const discoveryUrl =
      network === "fuji" ? FUJI_VALIDATOR_DISCOVERY_URL : MAINNET_VALIDATOR_DISCOVERY_URL;

    const response = await fetch(discoveryUrl, {
      signal: controller.signal,
      headers: { 'Accept': 'application/json' },
    });
    
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Failed to fetch versions: ${response.status}`);
    }

    const data: ValidatorVersion[] = await response.json();
    const versionMap = new Map<string, string>();

    for (const validator of data) {
      versionMap.set(validator.nodeId, validator.version?.replace("avalanchego/", "") || "Unknown");
    }

    versionCacheStore.set(network, { data: versionMap, timestamp: now });
    return versionMap;
  } catch (error) {
    console.error('Error fetching validator versions:', error);
    return cached?.data || new Map<string, string>();
  }
}

// Validator data now comes from our own P-chain read API (/v1/networks/{net}/…),
// which serves Glacier-shape validator snapshots from ClickHouse — no Glacier
// SDK. This route runs server-side, so it can hit the plain-HTTP EXPLORER_API_BASE
// directly. Primary Network → /validators; L1 subnets → /l1Validators?subnetId=.
async function fetchAllValidators(subnetId: string, versionMap: Map<string, string>, network: "mainnet" | "fuji" = "mainnet"): Promise<ValidatorData[]> {
  const validators: ValidatorData[] = [];
  const isPrimaryNetwork = subnetId === "11111111111111111111111111111111LpoYY";
  const maxPages = 50;

  const buildUrl = (pageToken?: string): string => {
    const qs = new URLSearchParams({ pageSize: String(PAGE_SIZE) });
    if (pageToken) qs.set("pageToken", pageToken);
    if (isPrimaryNetwork) {
      qs.set("validationStatus", "active");
      return `${EXPLORER_API_BASE}/v1/networks/${network}/validators?${qs.toString()}`;
    }
    qs.set("subnetId", subnetId);
    qs.set("includeInactive", "false");
    return `${EXPLORER_API_BASE}/v1/networks/${network}/l1Validators?${qs.toString()}`;
  };

  try {
    let pageToken: string | undefined;
    for (let pageCount = 0; pageCount < maxPages; pageCount++) {
      const res = await fetch(buildUrl(pageToken), { headers: { Accept: "application/json" } });
      if (!res.ok) throw new Error(`validators upstream ${res.status}`);
      const page = await res.json();

      let pageData: any[] = Array.isArray(page?.validators) ? page.validators : [];
      // For L1 validators, keep zero balances so critical alerts can fire.
      if (!isPrimaryNetwork) {
        pageData = pageData.filter((v: any) => Number.isFinite(Number(v.remainingBalance)) && Number(v.remainingBalance) >= 0);
      }

      const pageValidators = pageData.map((v: any) => {
        const version = versionMap.get(v.nodeId) || "Unknown";

        if (isPrimaryNetwork) {
          return {
            nodeId: v.nodeId,
            amountStaked: v.amountStaked || "0",
            delegationFee: v.delegationFee?.toString() || "0",
            validationStatus: v.validationStatus || "active",
            delegatorCount: v.delegatorCount || 0,
            amountDelegated: v.amountDelegated || "0",
            version,
          };
        }
        // L1 validator: /v1 returns weight as a decimal string; the UI sorts/sums
        // it numerically, so coerce. remainingBalance is nAVAX.
        return {
          nodeId: v.nodeId,
          amountStaked: String(v.weight ?? "0"),
          delegationFee: "0",
          validationStatus: "active",
          delegatorCount: 0,
          amountDelegated: "0",
          validationId: v.validationId,
          weight: Number(v.weight) || 0,
          remainingBalance: Number(v.remainingBalance),
          creationTimestamp: v.creationTimestamp,
          blsCredentials: v.blsCredentials,
          remainingBalanceOwner: v.remainingBalanceOwner,
          deactivationOwner: v.deactivationOwner,
          version,
        };
      });

      validators.push(...pageValidators);
      pageToken = page?.nextPageToken;
      if (!pageToken || pageValidators.length < PAGE_SIZE) break;
    }

    return validators;
  } catch (error: any) {
    console.error('Error fetching validators for subnet:', subnetId, error);
    throw error;
  }
}

function calculateVersionBreakdown(validators: ValidatorData[]) {
  const breakdown: Record<string, { nodes: number; stake: bigint }> = {};
  let totalStake = 0n;

  for (const validator of validators) {
    const version = validator.version || "Unknown";
    const stake = BigInt(validator.amountStaked || validator.weight || 0);
    
    if (!breakdown[version]) {
      breakdown[version] = { nodes: 0, stake: 0n };
    }
    
    breakdown[version].nodes += 1;
    breakdown[version].stake += stake;
    totalStake += stake;
  }

  // Convert to serializable format
  const result: Record<string, { nodes: number; stakeString: string }> = {};
  for (const [version, data] of Object.entries(breakdown)) {
    result[version] = {
      nodes: data.nodes,
      stakeString: data.stake.toString(),
    };
  }

  return {
    byClientVersion: result,
    totalStakeString: totalStake.toString(),
  };
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ subnetId: string }> }
) {
  try {
    const { subnetId } = await params;
    const url = new URL(_request.url);
    const network: "mainnet" | "fuji" = url.searchParams.get('network') === 'testnet' || url.searchParams.get('network') === 'fuji' ? 'fuji' : 'mainnet';

    if (!subnetId) {
      return NextResponse.json(
        { error: "Subnet ID is required" },
        { status: 400 }
      );
    }

    const cacheKey = `${network}:${subnetId}`;
    const now = Date.now();
    const cachedData = cacheStore.get(cacheKey);

    if (cachedData && (now - cachedData.timestamp) < CACHE_DURATION) {
      return NextResponse.json(
        {
          validators: cachedData.data,
          totalCount: cachedData.data.length,
          subnetId,
          cached: true,
          versionBreakdown: cachedData.versionBreakdown,
        },
        {
          headers: {
            'Cache-Control': 'public, max-age=300, stale-while-revalidate=600',
          }
        }
      );
    }

    const versionMap = await fetchValidatorVersions(network);

    const validators = await Promise.race([
      fetchAllValidators(subnetId, versionMap, network),
      new Promise<ValidatorData[]>((_, reject) =>
        setTimeout(() => reject(new Error('Request timeout')), FETCH_TIMEOUT)
      )
    ]);
    
    const versionBreakdown = calculateVersionBreakdown(validators);
    
    cacheStore.set(cacheKey, {
      data: validators,
      timestamp: now,
      versionBreakdown,
    });

    return NextResponse.json(
      {
        validators,
        totalCount: validators.length,
        subnetId,
        cached: false,
        versionBreakdown,
      },
      {
        headers: {
          'Cache-Control': 'public, max-age=300, stale-while-revalidate=600',
        }
      }
    );
  } catch (error: any) {
    console.error('Error fetching validators:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to fetch validators' },
      { status: 500 }
    );
  }
}
