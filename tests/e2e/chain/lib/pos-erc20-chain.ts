// Public chain reads for the PoS-ERC20 chain test (chain/pos-erc20-cchain.e2e.ts): the ERC20 staking manager, the
// test token (ExampleERC20Mintable), the reward calculator, and Glacier's record of a subnet's chains.
//
// The same rules as chain/lib/chain.ts: public endpoints only, and every request goes through its throttle (2 per
// second, stop at the first HTTP 429). The C-Chain client here sends through chain.ts jsonRpc for that reason.
//
// The ABI parts are copied from the contracts the Console deploys (contracts/icm-contracts/compiled/
// ERC20TokenStakingManager.json, ExampleERC20Mintable.json, ExampleRewardCalculator.json), so the test reads no repo
// file. The contract source is ava-labs/icm-services at the commit in scripts/versions.json.

import { createPublicClient, custom, encodePacked, getAddress, keccak256, toHex, type Address, type Hex } from 'viem';
import { avalancheFuji } from 'viem/chains';
import { FUJI, jsonRpc, pollUntil, throttledFetch, validationIdToHex, type PollOptions } from './chain.ts';

/** One token of the test ERC20 (18 decimals). The staking settings use the same unit. */
export const ONE_TOKEN = 10n ** 18n;

/** AccessControl roles of ExampleERC20Mintable. */
export const MINTER_ROLE = keccak256(toHex('MINTER_ROLE'));
export const DEFAULT_ADMIN_ROLE: Hex = `0x${'0'.repeat(64)}`;

/** enum DelegatorStatus of the StakingManager. A completed delegation is deleted, so it reads as Unknown. */
export const DelegatorStatus = { Unknown: 0, PendingAdded: 1, Active: 2, PendingRemoved: 3 } as const;

export const STAKING_MANAGER_ABI = [
  { type: 'function', name: 'erc20', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'address' }] },
  {
    type: 'function',
    name: 'getStakingManagerSettings',
    stateMutability: 'view',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          { name: 'manager', type: 'address' },
          { name: 'minimumStakeAmount', type: 'uint256' },
          { name: 'maximumStakeAmount', type: 'uint256' },
          { name: 'minimumStakeDuration', type: 'uint64' },
          { name: 'minimumDelegationFeeBips', type: 'uint16' },
          { name: 'maximumStakeMultiplier', type: 'uint8' },
          { name: 'weightToValueFactor', type: 'uint256' },
          { name: 'rewardCalculator', type: 'address' },
          { name: 'uptimeBlockchainID', type: 'bytes32' },
        ],
      },
    ],
  },
  {
    type: 'function',
    name: 'getStakingValidator',
    stateMutability: 'view',
    inputs: [{ name: 'validationID', type: 'bytes32' }],
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          { name: 'owner', type: 'address' },
          { name: 'delegationFeeBips', type: 'uint16' },
          { name: 'minStakeDuration', type: 'uint64' },
          { name: 'uptimeSeconds', type: 'uint64' },
        ],
      },
    ],
  },
  {
    type: 'function',
    name: 'getDelegatorInfo',
    stateMutability: 'view',
    inputs: [{ name: 'delegationID', type: 'bytes32' }],
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          { name: 'status', type: 'uint8' },
          { name: 'owner', type: 'address' },
          { name: 'validationID', type: 'bytes32' },
          { name: 'weight', type: 'uint64' },
          { name: 'startTime', type: 'uint64' },
          { name: 'startingNonce', type: 'uint64' },
          { name: 'endingNonce', type: 'uint64' },
        ],
      },
    ],
  },
  {
    type: 'event',
    name: 'InitiatedStakingValidatorRegistration',
    inputs: [
      { name: 'validationID', type: 'bytes32', indexed: true },
      { name: 'owner', type: 'address', indexed: true },
      { name: 'delegationFeeBips', type: 'uint16', indexed: false },
      { name: 'minStakeDuration', type: 'uint64', indexed: false },
      { name: 'rewardRecipient', type: 'address', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'InitiatedDelegatorRegistration',
    inputs: [
      { name: 'delegationID', type: 'bytes32', indexed: true },
      { name: 'validationID', type: 'bytes32', indexed: true },
      { name: 'delegatorAddress', type: 'address', indexed: true },
      { name: 'nonce', type: 'uint64', indexed: false },
      { name: 'validatorWeight', type: 'uint64', indexed: false },
      { name: 'delegatorWeight', type: 'uint64', indexed: false },
      { name: 'setWeightMessageID', type: 'bytes32', indexed: false },
      { name: 'rewardRecipient', type: 'address', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'CompletedDelegatorRegistration',
    inputs: [
      { name: 'delegationID', type: 'bytes32', indexed: true },
      { name: 'validationID', type: 'bytes32', indexed: true },
      { name: 'startTime', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'InitiatedDelegatorRemoval',
    inputs: [
      { name: 'delegationID', type: 'bytes32', indexed: true },
      { name: 'validationID', type: 'bytes32', indexed: true },
    ],
  },
  {
    type: 'event',
    name: 'CompletedDelegatorRemoval',
    inputs: [
      { name: 'delegationID', type: 'bytes32', indexed: true },
      { name: 'validationID', type: 'bytes32', indexed: true },
      { name: 'rewards', type: 'uint256', indexed: false },
      { name: 'fees', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'ValidatorRewardClaimed',
    inputs: [
      { name: 'validationID', type: 'bytes32', indexed: true },
      { name: 'recipient', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
    ],
  },
] as const;

const TOKEN_ABI = [
  {
    type: 'function',
    name: 'balanceOf',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'allowance',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'totalSupply',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  { type: 'function', name: 'symbol', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'string' }] },
  {
    type: 'function',
    name: 'hasRole',
    stateMutability: 'view',
    inputs: [
      { name: 'role', type: 'bytes32' },
      { name: 'account', type: 'address' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const;

const REWARD_CALCULATOR_ABI = [
  {
    type: 'function',
    name: 'rewardBasisPoints',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint64' }],
  },
] as const;

/** viem client for the Fuji C-Chain. Its requests share chain.ts's slot and 429 stop, and viem does not retry. */
const client = createPublicClient({
  chain: avalancheFuji,
  transport: custom({ request: ({ method, params }) => jsonRpc(FUJI.cRpc, method, params ?? []) }, { retryCount: 0 }),
});

export interface StakingSettings {
  manager: Address;
  minimumStakeAmount: bigint;
  maximumStakeAmount: bigint;
  minimumStakeDuration: bigint;
  minimumDelegationFeeBips: number;
  maximumStakeMultiplier: number;
  weightToValueFactor: bigint;
  rewardCalculator: Address;
  uptimeBlockchainID: Hex;
}

/** getStakingManagerSettings(). Before initialize every field is zero. */
export async function stakingSettings(stakingManager: Address): Promise<StakingSettings> {
  const s = await client.readContract({
    address: stakingManager,
    abi: STAKING_MANAGER_ABI,
    functionName: 'getStakingManagerSettings',
  });
  return {
    ...s,
    manager: getAddress(s.manager),
    rewardCalculator: getAddress(s.rewardCalculator),
    minimumDelegationFeeBips: Number(s.minimumDelegationFeeBips),
    maximumStakeMultiplier: Number(s.maximumStakeMultiplier),
  };
}

/** The token that the staking manager locks (erc20()). The zero address before initialize. */
export async function stakingToken(stakingManager: Address): Promise<Address> {
  return getAddress(
    await client.readContract({ address: stakingManager, abi: STAKING_MANAGER_ABI, functionName: 'erc20' }),
  );
}

/** The PoS record of a validator. A validator that is not PoS (V0) has the zero owner. */
export async function stakingValidator(
  stakingManager: Address,
  validationId: string,
): Promise<{ owner: Address; delegationFeeBips: number; minStakeDuration: bigint; uptimeSeconds: bigint }> {
  const v = await client.readContract({
    address: stakingManager,
    abi: STAKING_MANAGER_ABI,
    functionName: 'getStakingValidator',
    args: [validationIdToHex(validationId)],
  });
  return { ...v, owner: getAddress(v.owner), delegationFeeBips: Number(v.delegationFeeBips) };
}

export interface DelegatorInfo {
  status: number;
  owner: Address;
  validationID: Hex;
  weight: bigint;
  startTime: bigint;
  startingNonce: bigint;
  endingNonce: bigint;
}

/** The staking manager's record of a delegation. A completed delegation is deleted: status Unknown, weight 0. */
export async function delegatorInfo(stakingManager: Address, delegationId: Hex): Promise<DelegatorInfo> {
  const d = await client.readContract({
    address: stakingManager,
    abi: STAKING_MANAGER_ABI,
    functionName: 'getDelegatorInfo',
    args: [delegationId],
  });
  return { ...d, status: Number(d.status), owner: getAddress(d.owner) };
}

/** The delegation ID that the staking manager gives: keccak256(abi.encodePacked(validationID, nonce)). */
export function delegationIdOf(validationId: string, nonce: bigint): Hex {
  return keccak256(encodePacked(['bytes32', 'uint64'], [validationIdToHex(validationId), nonce]));
}

export async function tokenBalance(token: Address, account: Address): Promise<bigint> {
  return client.readContract({ address: token, abi: TOKEN_ABI, functionName: 'balanceOf', args: [account] });
}

export async function tokenAllowance(token: Address, owner: Address, spender: Address): Promise<bigint> {
  return client.readContract({ address: token, abi: TOKEN_ABI, functionName: 'allowance', args: [owner, spender] });
}

export async function tokenTotalSupply(token: Address): Promise<bigint> {
  return client.readContract({ address: token, abi: TOKEN_ABI, functionName: 'totalSupply' });
}

export async function tokenSymbol(token: Address): Promise<string> {
  return client.readContract({ address: token, abi: TOKEN_ABI, functionName: 'symbol' });
}

export async function tokenHasRole(token: Address, role: Hex, account: Address): Promise<boolean> {
  return client.readContract({ address: token, abi: TOKEN_ABI, functionName: 'hasRole', args: [role, account] });
}

/** The reward rate of an ExampleRewardCalculator, in basis points per year. */
export async function rewardBasisPoints(calculator: Address): Promise<bigint> {
  return client.readContract({ address: calculator, abi: REWARD_CALCULATOR_ABI, functionName: 'rewardBasisPoints' });
}

/** The runtime code at an address, as lower-case hex ('0x' when there is none). */
export async function cCode(address: Address): Promise<Hex> {
  return ((await client.getCode({ address })) ?? '0x').toLowerCase() as Hex;
}

/**
 * The blockchain IDs that Glacier lists for a subnet, or null while Glacier does not know the subnet as an L1 with a
 * Validator Manager. The Console takes the first one as the uptime chain of a staking manager (hooks/useVMCAddress.ts,
 * `subnetInfo.blockchains?.[0]`), and falls back to the manager's own chain (the C-Chain) while the list is empty.
 */
async function glacierL1Chains(subnetId: string): Promise<string[] | null> {
  const res = await throttledFetch(`${FUJI.glacier}/subnets/${subnetId}`, {
    headers: { accept: 'application/json', 'cache-control': 'no-cache' },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Glacier /subnets/${subnetId}: HTTP ${res.status}`);
  const subnet = (await res.json()) as {
    isL1?: boolean;
    l1ValidatorManagerDetails?: unknown;
    blockchains?: { blockchainId?: string }[];
  };
  if (!subnet.isL1 || !subnet.l1ValidatorManagerDetails) return null;
  return (subnet.blockchains ?? []).map((b) => b.blockchainId ?? '').filter(Boolean);
}

/** Waits until Glacier lists the chain as the first chain of the L1. Returns the wait, for the ledger. */
export async function waitForGlacierL1Chain(
  subnetId: string,
  blockchainId: string,
  options: PollOptions = {},
): Promise<{ waitedMs: number }> {
  const { waitedMs } = await pollUntil(
    `Glacier lists chain ${blockchainId} first on L1 ${subnetId}`,
    async () => (await glacierL1Chains(subnetId))?.[0] === blockchainId,
    { timeoutMs: 15 * 60_000, intervalMs: 5_000, ...options },
  );
  return { waitedMs };
}
