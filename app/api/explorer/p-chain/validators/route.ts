import { NextRequest, NextResponse } from 'next/server';
import {
  PChainNetwork,
  getCurrentValidators,
  getPendingValidators,
  getTotalStake,
  nAvaxToAvax,
  formatAvax,
} from '@/lib/pchain/rpc';

// ============================================================================
// Types
// ============================================================================

interface ValidatorSummary {
  nodeId: string;
  txId: string;
  startTime: string;
  endTime: string;
  remainingTime: string;
  stakeAmount: string;
  stakeAmountAvax: number;
  delegationFee: string;
  uptime: string;
  connected: boolean;
  delegatorCount: number;
  delegatorWeight: string;
  delegatorWeightAvax: number;
  potentialReward: string;
  potentialRewardAvax: number;
  stakePercentage: number;
}

interface DelegatorSummary {
  nodeId: string;
  txId: string;
  startTime: string;
  endTime: string;
  stakeAmount: string;
  stakeAmountAvax: number;
  potentialReward: string;
  potentialRewardAvax: number;
}

interface ValidatorsResponse {
  network: PChainNetwork;
  totalStake: string;
  totalStakeAvax: number;
  validatorCount: number;
  delegatorCount: number;
  pendingValidatorCount: number;
  pendingDelegatorCount: number;
  validators: ValidatorSummary[];
  pendingValidators: ValidatorSummary[];
  pendingDelegators: DelegatorSummary[];
}

// ============================================================================
// Cache
// ============================================================================

interface CacheEntry {
  data: ValidatorsResponse;
  timestamp: number;
}

const cache: Record<string, CacheEntry> = {};
const CACHE_TTL = 30000; // 30 seconds

function getCachedData(network: PChainNetwork): ValidatorsResponse | null {
  const entry = cache[network];
  if (entry && Date.now() - entry.timestamp < CACHE_TTL) {
    return entry.data;
  }
  return null;
}

function setCachedData(network: PChainNetwork, data: ValidatorsResponse): void {
  cache[network] = {
    data,
    timestamp: Date.now(),
  };
}

// ============================================================================
// Helpers
// ============================================================================

function formatRemainingTime(endTimeStr: string): string {
  const endTime = parseInt(endTimeStr) * 1000;
  const now = Date.now();
  const remaining = endTime - now;
  
  if (remaining <= 0) return 'Ended';
  
  const days = Math.floor(remaining / (1000 * 60 * 60 * 24));
  const hours = Math.floor((remaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  
  if (days > 30) {
    const months = Math.floor(days / 30);
    return `${months} month${months > 1 ? 's' : ''}`;
  }
  if (days > 0) {
    return `${days} day${days > 1 ? 's' : ''}`;
  }
  return `${hours} hour${hours > 1 ? 's' : ''}`;
}

// ============================================================================
// Route Handler
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    // Get network from query params (default to mainnet)
    const { searchParams } = new URL(request.url);
    const networkParam = searchParams.get('network');
    const network: PChainNetwork = networkParam === 'fuji' ? 'fuji' : 'mainnet';

    // Check cache first
    const cached = getCachedData(network);
    if (cached) {
      return NextResponse.json(cached);
    }

    // Fetch validators data in parallel
    const [currentValidators, pendingValidators, totalStake] = await Promise.all([
      getCurrentValidators(undefined, undefined, network),
      getPendingValidators(undefined, undefined, network),
      getTotalStake(undefined, network),
    ]);

    const totalStakeNum = nAvaxToAvax(totalStake);

    // Process current validators
    let totalDelegatorCount = 0;
    const validators: ValidatorSummary[] = currentValidators.validators.map((v) => {
      const delegatorCount = v.delegators?.length || parseInt(v.delegatorCount || '0', 10);
      totalDelegatorCount += delegatorCount;
      
      const stakeAmountAvax = nAvaxToAvax(v.stakeAmount || v.weight);
      const stakePercentage = totalStakeNum > 0 ? (stakeAmountAvax / totalStakeNum) * 100 : 0;

      return {
        nodeId: v.nodeID,
        txId: v.txID,
        startTime: new Date(parseInt(v.startTime) * 1000).toISOString(),
        endTime: new Date(parseInt(v.endTime) * 1000).toISOString(),
        remainingTime: formatRemainingTime(v.endTime),
        stakeAmount: v.stakeAmount || v.weight,
        stakeAmountAvax,
        delegationFee: v.delegationFee || '0',
        uptime: v.uptime || '0',
        connected: v.connected,
        delegatorCount,
        delegatorWeight: v.delegatorWeight || '0',
        delegatorWeightAvax: nAvaxToAvax(v.delegatorWeight || '0'),
        potentialReward: v.potentialReward,
        potentialRewardAvax: nAvaxToAvax(v.potentialReward),
        stakePercentage: Math.round(stakePercentage * 100) / 100,
      };
    });

    // Sort by stake amount (descending)
    validators.sort((a, b) => b.stakeAmountAvax - a.stakeAmountAvax);

    // Process pending validators
    const pendingValidatorsList: ValidatorSummary[] = pendingValidators.validators.map((v) => ({
      nodeId: v.nodeID,
      txId: v.txID,
      startTime: new Date(parseInt(v.startTime) * 1000).toISOString(),
      endTime: new Date(parseInt(v.endTime) * 1000).toISOString(),
      remainingTime: formatRemainingTime(v.endTime),
      stakeAmount: v.stakeAmount || v.weight,
      stakeAmountAvax: nAvaxToAvax(v.stakeAmount || v.weight),
      delegationFee: v.delegationFee || '0',
      uptime: '0',
      connected: v.connected,
      delegatorCount: 0,
      delegatorWeight: '0',
      delegatorWeightAvax: 0,
      potentialReward: '0',
      potentialRewardAvax: 0,
      stakePercentage: 0,
    }));

    // Process pending delegators
    const pendingDelegatorsList: DelegatorSummary[] = pendingValidators.delegators.map((d) => ({
      nodeId: d.nodeID,
      txId: d.txID,
      startTime: new Date(parseInt(d.startTime) * 1000).toISOString(),
      endTime: new Date(parseInt(d.endTime) * 1000).toISOString(),
      stakeAmount: d.stakeAmount,
      stakeAmountAvax: nAvaxToAvax(d.stakeAmount),
      potentialReward: '0',
      potentialRewardAvax: 0,
    }));

    const response: ValidatorsResponse = {
      network,
      totalStake: totalStake.toString(),
      totalStakeAvax: totalStakeNum,
      validatorCount: validators.length,
      delegatorCount: totalDelegatorCount,
      pendingValidatorCount: pendingValidatorsList.length,
      pendingDelegatorCount: pendingDelegatorsList.length,
      validators,
      pendingValidators: pendingValidatorsList,
      pendingDelegators: pendingDelegatorsList,
    };

    // Cache the result
    setCachedData(network, response);

    return NextResponse.json(response);
  } catch (error) {
    console.error('P-Chain validators error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch validators' },
      { status: 500 }
    );
  }
}

