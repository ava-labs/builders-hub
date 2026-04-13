import { z } from 'zod';
import { Avalanche } from '@avalanche-sdk/chainkit';
import { withApi, ValidationError, successResponse } from '@/lib/api';
import { FUJI_VALIDATOR_DISCOVERY_URL, MAINNET_VALIDATOR_DISCOVERY_URL } from '@/constants/validator-discovery';

const PAGE_SIZE = 100;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
const FETCH_TIMEOUT = 25000;
const VERSION_FETCH_TIMEOUT = 10_000;

const subnetIdSchema = z.object({
  subnetId: z.string().min(1, 'Subnet ID is required').max(60),
});

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

const cacheStore = new Map<string, { data: ValidatorData[]; timestamp: number; versionBreakdown?: any }>();
const versionCacheStore = new Map<string, { data: Map<string, string>; timestamp: number }>();

async function fetchValidatorVersions(network: 'mainnet' | 'fuji' = 'mainnet'): Promise<Map<string, string>> {
  const now = Date.now();
  const cached = versionCacheStore.get(network);

  if (cached && now - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), VERSION_FETCH_TIMEOUT);
    const discoveryUrl = network === 'fuji' ? FUJI_VALIDATOR_DISCOVERY_URL : MAINNET_VALIDATOR_DISCOVERY_URL;

    const response = await fetch(discoveryUrl, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Failed to fetch versions: ${response.status}`);
    }

    const data: ValidatorVersion[] = await response.json();
    const versionMap = new Map<string, string>();

    for (const validator of data) {
      versionMap.set(validator.nodeId, validator.version?.replace('avalanchego/', '') || 'Unknown');
    }

    versionCacheStore.set(network, { data: versionMap, timestamp: now });
    return versionMap;
  } catch {
    return cached?.data || new Map<string, string>();
  }
}

async function fetchAllValidators(
  subnetId: string,
  versionMap: Map<string, string>,
  network: 'mainnet' | 'fuji' = 'mainnet',
): Promise<ValidatorData[]> {
  const avalanche = new Avalanche({ network });
  const validators: ValidatorData[] = [];

  const isPrimaryNetwork = subnetId === '11111111111111111111111111111111LpoYY';

  let result;
  if (isPrimaryNetwork) {
    result = await avalanche.data.primaryNetwork.listValidators({
      pageSize: PAGE_SIZE,
      validationStatus: 'active',
      subnetId: subnetId,
      network,
    });
  } else {
    result = await avalanche.data.primaryNetwork.listL1Validators({
      pageSize: PAGE_SIZE,
      subnetId: subnetId,
      network,
      includeInactiveL1Validators: false,
    });
  }

  let pageCount = 0;
  const maxPages = 50;

  for await (const page of result) {
    pageCount++;

    let pageData: any[] = page.result?.validators || [];

    // For L1 validators, keep zero balances so critical alerts can fire.
    if (!isPrimaryNetwork) {
      pageData = pageData.filter((v: any) => Number.isFinite(v.remainingBalance) && v.remainingBalance >= 0);
    }

    if (!Array.isArray(pageData)) {
      continue;
    }

    const pageValidators = pageData.map((v: any) => {
      const version = versionMap.get(v.nodeId) || 'Unknown';

      if (isPrimaryNetwork) {
        return {
          nodeId: v.nodeId,
          amountStaked: v.amountStaked || '0',
          delegationFee: v.delegationFee?.toString() || '0',
          validationStatus: v.validationStatus || 'active',
          delegatorCount: v.delegatorCount || 0,
          amountDelegated: v.amountDelegated || '0',
          version,
        };
      } else {
        return {
          nodeId: v.nodeId,
          amountStaked: v.weight?.toString() || '0',
          delegationFee: '0',
          validationStatus: 'active',
          delegatorCount: 0,
          amountDelegated: '0',
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
    if (pageCount >= maxPages) {
      break;
    }
    if (pageValidators.length < PAGE_SIZE) {
      break;
    }
  }

  return validators;
}

function calculateVersionBreakdown(validators: ValidatorData[]) {
  const breakdown: Record<string, { nodes: number; stake: bigint }> = {};
  let totalStake = 0n;

  for (const validator of validators) {
    const version = validator.version || 'Unknown';
    const stake = BigInt(validator.amountStaked || validator.weight || 0);

    if (!breakdown[version]) {
      breakdown[version] = { nodes: 0, stake: 0n };
    }

    breakdown[version].nodes += 1;
    breakdown[version].stake += stake;
    totalStake += stake;
  }

  const byClientVersion: Record<string, { nodes: number; stakeString: string }> = {};
  for (const [version, data] of Object.entries(breakdown)) {
    byClientVersion[version] = {
      nodes: data.nodes,
      stakeString: data.stake.toString(),
    };
  }

  return {
    byClientVersion,
    totalStakeString: totalStake.toString(),
  };
}

export const GET = withApi(async (_request, { params }) => {
  const parsed = subnetIdSchema.safeParse(params);
  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues.map((i) => i.message).join('; '));
  }
  const { subnetId } = parsed.data;

  const url = new URL(_request.url);
  const network: 'mainnet' | 'fuji' =
    url.searchParams.get('network') === 'testnet' || url.searchParams.get('network') === 'fuji' ? 'fuji' : 'mainnet';

  const cacheKey = `${network}:${subnetId}`;
  const now = Date.now();
  const cachedData = cacheStore.get(cacheKey);

  if (cachedData && now - cachedData.timestamp < CACHE_DURATION) {
    const resp = successResponse({
      validators: cachedData.data,
      totalCount: cachedData.data.length,
      subnetId,
      cached: true,
      versionBreakdown: cachedData.versionBreakdown,
    });
    resp.headers.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=600');
    return resp;
  }

  const versionMap = await fetchValidatorVersions(network);

  const validators = await Promise.race([
    fetchAllValidators(subnetId, versionMap, network),
    new Promise<ValidatorData[]>((_, reject) => setTimeout(() => reject(new Error('Request timeout')), FETCH_TIMEOUT)),
  ]);

  const versionBreakdown = calculateVersionBreakdown(validators);

  cacheStore.set(cacheKey, {
    data: validators,
    timestamp: now,
    versionBreakdown,
  });

  const resp = successResponse({
    validators,
    totalCount: validators.length,
    subnetId,
    cached: false,
    versionBreakdown,
  });
  resp.headers.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=600');
  return resp;
});
