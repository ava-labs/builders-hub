// P-Chain reads (blockchains, subnets, L1 validators, transactions) from our Stats API.
// Its /v1/networks routes have the shape of the Glacier (Data API) routes they replace.

import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import { networkIDs } from '@avalabs/avalanchejs';
import { STATS_API_BASE } from '@/lib/stats-api';

/**
 * A Stats API response that is not OK. `status` is its HTTP status, so a caller can tell a miss from an outage.
 */
export class StatsApiHttpError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'StatsApiHttpError';
    this.status = status;
  }
}

type Network = 'mainnet' | 'testnet' | 'fuji';

/**
 * The browser reads through the same-origin relay (app/api/stats-api), because a cached Stats API response can carry
 * its CORS header twice, which the browser refuses. The server reads the Stats API directly.
 */
function networksUrl(network: Network, path: string): string {
  const base = typeof window === 'undefined' ? `${STATS_API_BASE}/v1/networks` : '/api/stats-api';
  return `${base}/${network}/${path}`;
}

async function getJson<T>(network: Network, path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(networksUrl(network, path), {
    headers: { accept: 'application/json' },
    cache: 'no-store',
    signal,
  });
  if (!response.ok) {
    throw new StatsApiHttpError(`Stats API returned ${response.status} for ${path.split('?')[0]}`, response.status);
  }
  return (await response.json()) as T;
}

function currentAndOtherNetwork(): ['mainnet' | 'testnet', 'mainnet' | 'testnet'] {
  const { avalancheNetworkID } = useWalletStore.getState();
  return avalancheNetworkID === networkIDs.MainnetID ? ['mainnet', 'testnet'] : ['testnet', 'mainnet'];
}

interface BlockchainInfo {
  createBlockTimestamp: number;
  createBlockNumber: string;
  blockchainId: string;
  vmId: string;
  subnetId: string;
  blockchainName: string;
  evmChainId: number;
}

interface SubnetOwnershipInfo {
  addresses: string[];
  locktime: number;
  threshold: number;
}

interface L1ValidatorManagerDetails {
  blockchainId: string;
  contractAddress: string;
}

export interface SubnetInfo {
  createBlockTimestamp: number;
  createBlockIndex: string;
  subnetId: string;
  ownerAddresses: string[];
  threshold: number;
  locktime: number;
  subnetOwnershipInfo: SubnetOwnershipInfo;
  isL1: boolean;
  /** Absent until the subnet converts to an L1, and always absent for the Primary Network. */
  l1ConversionTransactionHash?: string;
  l1ValidatorManagerDetails?: L1ValidatorManagerDetails;
  blockchains: BlockchainInfo[];
}

// The Stats API indexes the chains that a CreateChainTx made, so it does not know the X-Chain, the C-Chain or the
// Primary Network subnet, which genesis made. These are the values that Glacier returned for them.
const PRIMARY_NETWORK_SUBNET_ID = '11111111111111111111111111111111LpoYY';
const GENESIS_TIMESTAMP = 1599696000;

function genesisChain(blockchainId: string, vmId: string, blockchainName: string, evmChainId?: number): BlockchainInfo {
  return {
    createBlockTimestamp: GENESIS_TIMESTAMP,
    createBlockNumber: '-1',
    blockchainId,
    vmId,
    subnetId: PRIMARY_NETWORK_SUBNET_ID,
    blockchainName,
    ...(evmChainId === undefined ? {} : { evmChainId }),
  } as BlockchainInfo;
}

const PRIMARY_NETWORK_CHAINS: Record<'mainnet' | 'testnet', BlockchainInfo[]> = {
  mainnet: [
    genesisChain(PRIMARY_NETWORK_SUBNET_ID, 'platformvm', 'P-Chain'),
    genesisChain(
      '2oYMBNV4eNHyqk2fjjV5nVQLDbtmNJzq5s3qs3Lo6ftnC6FByM',
      'jvYyfQTxGMJLuGWa55kdP2p2zSUYsQ5Raupu4TW34ZAUBAbtq',
      'X-Chain',
    ),
    genesisChain(
      '2q9e4r6Mu3U68nU1fYjgbR6JvwrRx36CohpAX5UQxse55x1Q5',
      'mgj786NP7uDwBCcq6YwThhaN8FLyybkCa4zBWTQbNgmK6k9A6',
      'C-Chain',
      43114,
    ),
  ],
  testnet: [
    genesisChain(PRIMARY_NETWORK_SUBNET_ID, 'platformvm', 'P-Chain'),
    genesisChain(
      '2JVSBoinj9C2J33VntvzYtVJNZdN2NKiwwKjcumHUWEb5DbBrm',
      'jvYyfQTxGMJLuGWa55kdP2p2zSUYsQ5Raupu4TW34ZAUBAbtq',
      'X-Chain',
    ),
    genesisChain(
      'yH8D7ThNJkxmtkuv2jgBa4P1Rn3Qpr4pPr7QYNfcdoS6k6HWp',
      'mgj786NP7uDwBCcq6YwThhaN8FLyybkCa4zBWTQbNgmK6k9A6',
      'C-Chain',
      43113,
    ),
  ],
};

function primaryNetworkChains(network: Network): BlockchainInfo[] {
  return PRIMARY_NETWORK_CHAINS[network === 'mainnet' ? 'mainnet' : 'testnet'];
}

function primaryNetworkSubnet(network: Network): SubnetInfo {
  return {
    createBlockTimestamp: GENESIS_TIMESTAMP,
    createBlockIndex: '-1',
    subnetId: PRIMARY_NETWORK_SUBNET_ID,
    ownerAddresses: [''],
    threshold: 0,
    locktime: 0,
    subnetOwnershipInfo: { addresses: [''], locktime: 0, threshold: 0 },
    isL1: false,
    blockchains: primaryNetworkChains(network),
  };
}

export async function getBlockchainInfo(
  blockchainId: string,
  signal?: AbortSignal,
): Promise<BlockchainInfo & { isTestnet: boolean }> {
  const [currentNetwork, otherNetwork] = currentAndOtherNetwork();

  try {
    // Try current network first
    const info = await getBlockchainInfoForNetwork(currentNetwork, blockchainId, signal);
    return { ...info, isTestnet: currentNetwork === 'testnet' };
  } catch (error) {
    // If request was aborted, don't try the other network
    if (signal?.aborted) {
      throw error;
    }
    // If blockchain doesn't exist on current network, try the other network
    const info = await getBlockchainInfoForNetwork(otherNetwork, blockchainId, signal);
    return { ...info, isTestnet: otherNetwork === 'testnet' };
  }
}

export async function getBlockchainInfoForNetwork(
  network: Network,
  blockchainId: string,
  signal?: AbortSignal,
): Promise<BlockchainInfo> {
  const genesis = primaryNetworkChains(network).find((chain) => chain.blockchainId === blockchainId);
  if (genesis) return { ...genesis };
  return getJson<BlockchainInfo>(network, `blockchains/${encodeURIComponent(blockchainId)}`, signal);
}

export async function getSubnetInfo(
  subnetId: string,
  signal?: AbortSignal,
): Promise<SubnetInfo & { isTestnet: boolean }> {
  const [currentNetwork, otherNetwork] = currentAndOtherNetwork();

  try {
    // Try current network first
    const info = await getSubnetInfoForNetwork(currentNetwork, subnetId, signal);
    return { ...info, isTestnet: currentNetwork === 'testnet' };
  } catch (error) {
    // If request was aborted, don't try the other network
    if (signal?.aborted) {
      throw error;
    }
    // If subnet doesn't exist on current network, try the other network
    const info = await getSubnetInfoForNetwork(otherNetwork, subnetId, signal);
    return { ...info, isTestnet: otherNetwork === 'testnet' };
  }
}

export async function getSubnetInfoForNetwork(
  network: Network,
  subnetId: string,
  signal?: AbortSignal,
): Promise<SubnetInfo> {
  if (subnetId === PRIMARY_NETWORK_SUBNET_ID) return primaryNetworkSubnet(network);
  const data = await getJson<SubnetInfo>(network, `subnets/${encodeURIComponent(subnetId)}`, signal);
  // The Stats API sends null, not [], for a subnet with no chains.
  return { ...data, blockchains: data.blockchains ?? [] };
}

/** An L1 validator in the shape that Glacier sent: `weight` is a number (the Stats API sends a string). */
export interface L1Validator {
  validationId: string;
  /** 0x-prefixed (Glacier sent it without the prefix). */
  validationIdHex: string;
  nodeId: string;
  subnetId: string;
  weight: number;
  /** nAVAX. */
  remainingBalance: number;
  creationTimestamp: number;
  /** 0x-prefixed (Glacier sent them without the prefix). */
  blsCredentials: { publicKey: string; proofOfPossession: string };
  remainingBalanceOwner: { addresses: string[]; threshold: number };
  deactivationOwner: { addresses: string[]; threshold: number };
}

type StatsApiL1Validator = Omit<L1Validator, 'weight' | 'remainingBalance'> & {
  weight: string | number;
  remainingBalance: string | number;
};

const L1_VALIDATORS_PAGE_SIZE = 100; // the Stats API maximum
const L1_VALIDATORS_MAX_PAGES = 200;

/**
 * Every validator of an L1, read page by page.
 *
 * By default, the validators that are still in the L1's P-Chain validator set (weight above 0), with the ones whose
 * balance ran out. This is the set that platform.getCurrentValidators returns, and what Glacier returned without
 * includeInactiveL1Validators. The default of the Stats API omits validators whose balance ran out, so the read asks
 * for all of them and drops the removed ones here. `includeRemoved` keeps the removed ones (weight 0).
 */
export async function listL1Validators(
  network: Network,
  subnetId: string,
  { includeRemoved = false, signal }: { includeRemoved?: boolean; signal?: AbortSignal } = {},
): Promise<L1Validator[]> {
  const validators: L1Validator[] = [];
  let pageToken: string | undefined;
  for (let page = 0; page < L1_VALIDATORS_MAX_PAGES; page++) {
    const query = new URLSearchParams({
      subnetId,
      pageSize: String(L1_VALIDATORS_PAGE_SIZE),
      includeInactive: 'true',
    });
    if (pageToken) query.set('pageToken', pageToken);
    const data = await getJson<{ validators?: StatsApiL1Validator[] | null; nextPageToken?: string }>(
      network,
      `l1Validators?${query}`,
      signal,
    );
    for (const v of data.validators ?? []) {
      validators.push({ ...v, weight: Number(v.weight), remainingBalance: Number(v.remainingBalance) });
    }
    if (!data.nextPageToken || data.nextPageToken === pageToken) break;
    pageToken = data.nextPageToken;
  }
  return includeRemoved ? validators : validators.filter((v) => v.weight > 0);
}

/**
 * P-Chain block height a transaction landed in (the `blockNumber` field),
 * or null when it cannot be resolved (unknown tx, indexer lag, Stats API down).
 * Callers treat null as "requirement unknown" and degrade, never throw.
 */
export async function getPChainTxBlockHeight(
  txHash: string,
  network: Network,
  signal?: AbortSignal,
): Promise<bigint | null> {
  try {
    const data = await getJson<{ blockNumber?: number | string }>(
      network,
      `blockchains/p-chain/transactions/${encodeURIComponent(txHash)}`,
      signal,
    );
    const blockNumber = data?.blockNumber;
    if (typeof blockNumber !== 'number' && (typeof blockNumber !== 'string' || blockNumber === '')) {
      return null;
    }
    return BigInt(blockNumber);
  } catch {
    return null;
  }
}
