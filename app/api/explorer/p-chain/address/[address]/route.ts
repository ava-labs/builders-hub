import { NextRequest, NextResponse } from 'next/server';
import {
  PChainNetwork,
  getBalance,
  getStake,
  getUTXOs,
  getCurrentValidators,
  nAvaxToAvax,
  formatAvax,
  type GetBalanceResponse,
  type ValidatorInfo,
  type DelegatorInfo,
} from '@/lib/pchain/rpc';
import { getAddressTransactions, type GlacierTransaction } from '@/lib/pchain/glacier';

// ============================================================================
// Types
// ============================================================================

interface AddressBalance {
  total: string;
  totalAvax: number;
  unlocked: string;
  unlockedAvax: number;
  lockedStakeable: string;
  lockedStakeableAvax: number;
  lockedNotStakeable: string;
  lockedNotStakeableAvax: number;
}

interface AddressStake {
  staked: string;
  stakedAvax: number;
}

interface UTXOInfo {
  txId: string;
  outputIndex: number;
}

interface ValidationInfo {
  nodeId: string;
  txId: string;
  startTime: string;
  endTime: string;
  stakeAmount: string;
  stakeAmountAvax: number;
  potentialReward: string;
  potentialRewardAvax: number;
  isValidator: boolean; // true = validator, false = delegator
  delegationFee?: string;
  uptime?: string;
  connected?: boolean;
}

interface AddressDetailResponse {
  address: string;
  network: PChainNetwork;
  balance: AddressBalance;
  stake: AddressStake;
  utxoCount: number;
  utxos: UTXOInfo[];
  validations: ValidationInfo[];
  transactions: GlacierTransaction[];
  nextPageToken?: string;
}

// ============================================================================
// Route Handler
// ============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
  try {
    const { address } = await params;
    
    // Get network from query params (default to mainnet)
    const { searchParams } = new URL(request.url);
    const networkParam = searchParams.get('network');
    const network: PChainNetwork = networkParam === 'fuji' ? 'fuji' : 'mainnet';
    const pageToken = searchParams.get('pageToken') ?? undefined;

    // Ensure address has proper P-Chain prefix
    let formattedAddress = address;
    if (!address.startsWith('P-')) {
      formattedAddress = `P-${address}`;
    }

    // Fetch balance, stake, UTXOs, validations, and transactions in parallel
    const [balanceResult, stakeResult, utxosResult, validatorsResult, txResult] = await Promise.all([
      getBalance([formattedAddress], network).catch(() => null),
      getStake([formattedAddress], network).catch(() => null),
      getUTXOs([formattedAddress], 100, undefined, network).catch(() => null),
      getCurrentValidators(undefined, undefined, network).catch(() => null),
      getAddressTransactions(formattedAddress, network, 25, pageToken).catch(() => null),
    ]);

    // Process balance
    const balance: AddressBalance = {
      total: balanceResult?.balance || '0',
      totalAvax: nAvaxToAvax(balanceResult?.balance || '0'),
      unlocked: balanceResult?.unlocked || '0',
      unlockedAvax: nAvaxToAvax(balanceResult?.unlocked || '0'),
      lockedStakeable: balanceResult?.lockedStakeable || '0',
      lockedStakeableAvax: nAvaxToAvax(balanceResult?.lockedStakeable || '0'),
      lockedNotStakeable: balanceResult?.lockedNotStakeable || '0',
      lockedNotStakeableAvax: nAvaxToAvax(balanceResult?.lockedNotStakeable || '0'),
    };

    // Process stake
    const stake: AddressStake = {
      staked: stakeResult?.staked || '0',
      stakedAvax: nAvaxToAvax(stakeResult?.staked || '0'),
    };

    // Process UTXOs
    const utxos: UTXOInfo[] = (balanceResult?.utxoIDs || []).map((utxo) => ({
      txId: utxo.txID,
      outputIndex: utxo.outputIndex,
    }));

    // Find validations/delegations for this address
    const validations: ValidationInfo[] = [];
    
    if (validatorsResult?.validators) {
      for (const validator of validatorsResult.validators) {
        // Check if this address is the validator's reward owner
        const isValidator = validator.validationRewardOwner?.addresses?.some(
          (addr) => addr.toLowerCase() === formattedAddress.toLowerCase()
        );
        
        if (isValidator) {
          validations.push({
            nodeId: validator.nodeID,
            txId: validator.txID,
            startTime: new Date(parseInt(validator.startTime) * 1000).toISOString(),
            endTime: new Date(parseInt(validator.endTime) * 1000).toISOString(),
            stakeAmount: validator.stakeAmount || validator.weight,
            stakeAmountAvax: nAvaxToAvax(validator.stakeAmount || validator.weight),
            potentialReward: validator.potentialReward,
            potentialRewardAvax: nAvaxToAvax(validator.potentialReward),
            isValidator: true,
            delegationFee: validator.delegationFee,
            uptime: validator.uptime,
            connected: validator.connected,
          });
        }

        // Check delegators
        if (validator.delegators) {
          for (const delegator of validator.delegators) {
            const isDelegator = delegator.rewardOwner?.addresses?.some(
              (addr) => addr.toLowerCase() === formattedAddress.toLowerCase()
            );
            
            if (isDelegator) {
              validations.push({
                nodeId: delegator.nodeID,
                txId: delegator.txID,
                startTime: new Date(parseInt(delegator.startTime) * 1000).toISOString(),
                endTime: new Date(parseInt(delegator.endTime) * 1000).toISOString(),
                stakeAmount: delegator.stakeAmount,
                stakeAmountAvax: nAvaxToAvax(delegator.stakeAmount),
                potentialReward: delegator.potentialReward,
                potentialRewardAvax: nAvaxToAvax(delegator.potentialReward),
                isValidator: false,
              });
            }
          }
        }
      }
    }

    const response: AddressDetailResponse = {
      address: formattedAddress,
      network,
      balance,
      stake,
      utxoCount: utxos.length,
      utxos,
      validations,
      transactions: txResult?.transactions ?? [],
      nextPageToken: txResult?.nextPageToken,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('P-Chain address detail error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch address data' },
      { status: 500 }
    );
  }
}

