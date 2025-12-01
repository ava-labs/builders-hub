import { NextResponse } from "next/server";
import { Avalanche } from "@avalanche-sdk/chainkit";
import { MAINNET_VALIDATOR_DISCOVERY_URL } from "@/constants/validator-discovery";

const PAGE_SIZE = 100;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
const FETCH_TIMEOUT = 25000;
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

async function fetchValidatorVersions(): Promise<Map<string, string>> {
  const now = Date.now();
  const cached = versionCacheStore.get('mainnet');
  
  if (cached && (now - cached.timestamp) < CACHE_DURATION) {
    return cached.data;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), VERSION_FETCH_TIMEOUT);

    const response = await fetch(MAINNET_VALIDATOR_DISCOVERY_URL, {
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

    versionCacheStore.set('mainnet', { data: versionMap, timestamp: now });
    return versionMap;
  } catch (error) {
    console.error('Error fetching validator versions:', error);
    return cached?.data || new Map<string, string>();
  }
}

async function fetchAllValidators(subnetId: string, versionMap: Map<string, string>): Promise<ValidatorData[]> {
  const avalanche = new Avalanche({ network: "mainnet" });
  const validators: ValidatorData[] = [];
  
  try {
    const isPrimaryNetwork = subnetId === "11111111111111111111111111111111LpoYY";
    
    let result;
    if (isPrimaryNetwork) {
      // Use listValidators for Primary Network
      result = await avalanche.data.primaryNetwork.listValidators({
        pageSize: PAGE_SIZE,
        validationStatus: "active",
        subnetId: subnetId,
        network: "mainnet",
      });
    } else {
      // Use listL1Validators for L1 subnets
      result = await avalanche.data.primaryNetwork.listL1Validators({
        pageSize: PAGE_SIZE,
        subnetId: subnetId,
        network: "mainnet",
        includeInactiveL1Validators: false,
      });
    }

    let pageCount = 0;
    const maxPages = 50;
    
    for await (const page of result) {
      pageCount++;
      
      // Handle different response structures
      // Both Primary Network and L1 validators use page.result.validators
      let pageData: any[] = page.result?.validators || [];
      
      // For L1 validators, filter by remainingBalance > 0
      if (!isPrimaryNetwork) {
        pageData = pageData.filter((v: any) => v.remainingBalance > 0);
      }
      
      if (!Array.isArray(pageData)) { 
        console.warn(`Page ${pageCount}: pageData is not an array`, typeof pageData);
        console.warn(`Available keys:`, Object.keys(page));
        continue; 
      }
      
      const pageValidators = pageData.map((v: any) => {
        const version = versionMap.get(v.nodeId) || "Unknown";
        
        if (isPrimaryNetwork) {
          // Primary Network validator structure
          return {
            nodeId: v.nodeId,
            amountStaked: v.amountStaked || "0",
            delegationFee: v.delegationFee?.toString() || "0",
            validationStatus: v.validationStatus || "active",
            delegatorCount: v.delegatorCount || 0,
            amountDelegated: v.amountDelegated || "0",
            version,
          };
        } else {
          // L1 validator structure - using weight as stake
          return {
            nodeId: v.nodeId,
            amountStaked: v.weight?.toString() || "0",
            delegationFee: "0", // L1 validators don't have delegation fees
            validationStatus: "active",
            delegatorCount: 0, // L1 validators don't have delegators in the same way
            amountDelegated: "0",
            validationId: v.validationId,
            weight: v.weight,
            remainingBalance: v.remainingBalance,
            creationTimestamp: v.creationTimestamp,
            blsCredentials: v.blsCredentials,
            remainingBalanceOwner: v.remainingBalanceOwner,
            deactivationOwner: v.deactivationOwner,
            version,
          };
        }
      });
      
      validators.push(...pageValidators);     
      if (pageCount >= maxPages) { break; }   
      if (pageValidators.length < PAGE_SIZE) { break; }
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
    
    if (!subnetId) {
      return NextResponse.json(
        { error: "Subnet ID is required" },
        { status: 400 }
      );
    }

    const now = Date.now();
    const cachedData = cacheStore.get(subnetId);

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

    const versionMap = await fetchValidatorVersions();
    
    const validators = await Promise.race([
      fetchAllValidators(subnetId, versionMap),
      new Promise<ValidatorData[]>((_, reject) => 
        setTimeout(() => reject(new Error('Request timeout')), FETCH_TIMEOUT)
      )
    ]);
    
    const versionBreakdown = calculateVersionBreakdown(validators);
    
    cacheStore.set(subnetId, {
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

