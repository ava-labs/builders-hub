/**
 * P-Chain RPC Helper
 * Provides methods for interacting with the Avalanche P-Chain via JSON-RPC
 */

export type PChainNetwork = 'mainnet' | 'fuji';

// RPC endpoints for P-Chain
const RPC_ENDPOINTS: Record<PChainNetwork, string> = {
  mainnet: 'https://api.avax.network/ext/bc/P',
  fuji: 'https://api.avax-test.network/ext/bc/P',
};

// Request timeout in milliseconds
const RPC_TIMEOUT = 15000;

/**
 * Makes a JSON-RPC call to the P-Chain
 */
export async function pchainRpc<T>(
  method: string,
  params: Record<string, unknown> = {},
  network: PChainNetwork = 'mainnet'
): Promise<T> {
  const endpoint = RPC_ENDPOINTS[network];
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), RPC_TIMEOUT);

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: `platform.${method}`,
        params,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.log(response);
      throw new Error(`P-Chain RPC request failed: ${response.status}`);
    }

    const data = await response.json();
    if (data.error) {
      throw new Error(data.error.message || 'P-Chain RPC error');
    }

    return data.result as T;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('P-Chain RPC request timed out');
    }
    throw error;
  }
}

// ============================================================================
// Type Definitions for P-Chain RPC Responses
// ============================================================================

export interface PChainBlock {
  id?: string;
  parentID: string;
  height: number;
  time?: number; // Unix timestamp (available on some blocks)
  txs?: PChainBlockTransaction[];
  tx?: PChainBlockTransaction; // Some blocks have single tx instead of txs array
}

export interface PChainBlockTransaction {
  unsignedTx: {
    networkID?: number;
    blockchainID?: string;
    outputs?: PChainOutput[];
    inputs?: PChainInput[];
    memo?: string;
    // Validator-specific fields
    validator?: {
      nodeID: string;
      start: number;
      end: number;
      weight: number;
    };
    stake?: PChainOutput[];
    rewardsOwner?: PChainOwner;
    shares?: number;
    // Subnet-specific fields
    subnetID?: string;
    chainName?: string;
    vmID?: string;
    genesisData?: string;
    // Export/Import fields
    destinationChain?: string;
    sourceChain?: string;
    exportedOutputs?: PChainOutput[];
    importedInputs?: PChainInput[];
    // L1 Validator fields (Etna upgrade)
    validationID?: string;
    balance?: number;
    proofOfPossession?: number[];
    message?: string;
    disableAuthorization?: {
      signatureIndices: number[];
    };
    weight?: number; // For SetL1ValidatorWeightTx
  };
  credentials?: Array<{
    signatures: string[];
  }>;
  id?: string;
}

export interface PChainOutput {
  assetID: string;
  fxID: string;
  output: {
    addresses: string[];
    amount: number;
    locktime: number;
    threshold: number;
  };
}

export interface PChainInput {
  txID: string;
  outputIndex: number;
  assetID: string;
  fxID: string;
  input: {
    amount: number;
    signatureIndices: number[];
  };
}

export interface PChainOwner {
  addresses: string[];
  locktime: number;
  threshold: number;
}

export interface GetHeightResponse {
  height: string;
}

export interface GetBlockResponse {
  block: PChainBlock | string;
  encoding: string;
}

export interface GetTxResponse {
  tx: PChainBlockTransaction | string;
  encoding: string;
}

export interface GetTxStatusResponse {
  status: 'Committed' | 'Processing' | 'Dropped' | 'Unknown';
  reason?: string;
}

export interface ValidatorInfo {
  txID: string;
  startTime: string;
  endTime: string;
  stakeAmount?: string;
  nodeID: string;
  weight: string;
  validationRewardOwner?: PChainOwner;
  delegationRewardOwner?: PChainOwner;
  potentialReward: string;
  delegationFee: string;
  uptime: string;
  connected: boolean;
  signer?: {
    publicKey: string;
    proofOfPossession: string;
  };
  // Delegator count as a string - use this instead of delegators array length
  delegatorCount: string;
  delegatorWeight: string;
  // Note: delegators array is NOT returned by default in getCurrentValidators
  // It's only available when querying a specific nodeID
  delegators?: DelegatorInfo[];
}

export interface DelegatorInfo {
  txID: string;
  startTime: string;
  endTime: string;
  stakeAmount: string;
  nodeID: string;
  rewardOwner?: PChainOwner;
  potentialReward: string;
}

export interface GetCurrentValidatorsResponse {
  validators: ValidatorInfo[];
}

export interface GetPendingValidatorsResponse {
  validators: ValidatorInfo[];
  delegators: DelegatorInfo[];
}

export interface SubnetInfo {
  id: string;
  controlKeys: string[];
  threshold: string;
}

export interface GetSubnetsResponse {
  subnets: SubnetInfo[];
}

export interface BlockchainInfo {
  id: string;
  name: string;
  subnetID: string;
  vmID: string;
}

export interface GetBlockchainsResponse {
  blockchains: BlockchainInfo[];
}

export interface GetBalanceResponse {
  balance: string;
  unlocked: string;
  lockedStakeable: string;
  lockedNotStakeable: string;
  balances?: Record<string, string>;
  unlockeds?: Record<string, string>;
  lockedStakeables?: Record<string, string>;
  lockedNotStakeables?: Record<string, string>;
  utxoIDs: Array<{
    txID: string;
    outputIndex: number;
  }>;
}

export interface GetStakeResponse {
  staked: string;
  stakeds?: Record<string, string>;
  stakedOutputs: string[];
  encoding: string;
}

export interface GetUTXOsResponse {
  numFetched: string;
  utxos: string[];
  endIndex: {
    address: string;
    utxo: string;
  };
  encoding: string;
}

export interface GetCurrentSupplyResponse {
  supply: string;
}

export interface GetTotalStakeResponse {
  weight: string;
}

export interface GetMinStakeResponse {
  minValidatorStake: string;
  minDelegatorStake: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get the current block height
 */
export async function getHeight(network: PChainNetwork = 'mainnet'): Promise<number> {
  const result = await pchainRpc<GetHeightResponse>('getHeight', {}, network);
  return parseInt(result.height, 10);
}

/**
 * Get a block by height with JSON encoding
 */
export async function getBlockByHeight(
  height: number,
  network: PChainNetwork = 'mainnet'
): Promise<PChainBlock> {
  const result = await pchainRpc<GetBlockResponse>(
    'getBlockByHeight',
    { height, encoding: 'json' },
    network
  );
  return result.block as PChainBlock;
}

/**
 * Get a block by ID with JSON encoding
 */
export async function getBlock(
  blockID: string,
  network: PChainNetwork = 'mainnet'
): Promise<PChainBlock> {
  const result = await pchainRpc<GetBlockResponse>(
    'getBlock',
    { blockID, encoding: 'json' },
    network
  );
  return result.block as PChainBlock;
}

/**
 * Get a transaction by ID with JSON encoding
 */
export async function getTx(
  txID: string,
  network: PChainNetwork = 'mainnet'
): Promise<PChainBlockTransaction> {
  const result = await pchainRpc<GetTxResponse>(
    'getTx',
    { txID, encoding: 'json' },
    network
  );
  return result.tx as PChainBlockTransaction;
}

/**
 * Get transaction status
 */
export async function getTxStatus(
  txID: string,
  network: PChainNetwork = 'mainnet'
): Promise<GetTxStatusResponse> {
  return pchainRpc<GetTxStatusResponse>('getTxStatus', { txID }, network);
}

/**
 * Get current validators
 */
export async function getCurrentValidators(
  subnetID?: string,
  nodeIDs?: string[],
  network: PChainNetwork = 'mainnet'
): Promise<GetCurrentValidatorsResponse> {
  const params: Record<string, unknown> = {};
  if (subnetID) params.subnetID = subnetID;
  if (nodeIDs) params.nodeIDs = nodeIDs;
  return pchainRpc<GetCurrentValidatorsResponse>('getCurrentValidators', params, network);
}

/**
 * Get pending validators
 */
export async function getPendingValidators(
  subnetID?: string,
  nodeIDs?: string[],
  network: PChainNetwork = 'mainnet'
): Promise<GetPendingValidatorsResponse> {
  const params: Record<string, unknown> = {};
  if (subnetID) params.subnetID = subnetID;
  if (nodeIDs) params.nodeIDs = nodeIDs;
  return pchainRpc<GetPendingValidatorsResponse>('getPendingValidators', params, network);
}

/**
 * Get subnets
 */
export async function getSubnets(
  ids?: string[],
  network: PChainNetwork = 'mainnet'
): Promise<GetSubnetsResponse> {
  const params: Record<string, unknown> = {};
  if (ids) params.ids = ids;
  return pchainRpc<GetSubnetsResponse>('getSubnets', params, network);
}

/**
 * Get blockchains
 */
export async function getBlockchains(
  network: PChainNetwork = 'mainnet'
): Promise<GetBlockchainsResponse> {
  return pchainRpc<GetBlockchainsResponse>('getBlockchains', {}, network);
}

/**
 * Get balance for addresses
 */
export async function getBalance(
  addresses: string[],
  network: PChainNetwork = 'mainnet'
): Promise<GetBalanceResponse> {
  return pchainRpc<GetBalanceResponse>('getBalance', { addresses }, network);
}

/**
 * Get stake for addresses
 */
export async function getStake(
  addresses: string[],
  network: PChainNetwork = 'mainnet'
): Promise<GetStakeResponse> {
  return pchainRpc<GetStakeResponse>('getStake', { addresses, encoding: 'hex' }, network);
}

/**
 * Get UTXOs for addresses
 */
export async function getUTXOs(
  addresses: string[],
  limit?: number,
  startIndex?: { address: string; utxo: string },
  network: PChainNetwork = 'mainnet'
): Promise<GetUTXOsResponse> {
  const params: Record<string, unknown> = { addresses, encoding: 'hex' };
  if (limit) params.limit = limit;
  if (startIndex) params.startIndex = startIndex;
  return pchainRpc<GetUTXOsResponse>('getUTXOs', params, network);
}

/**
 * Get current supply
 */
export async function getCurrentSupply(
  network: PChainNetwork = 'mainnet'
): Promise<bigint> {
  const result = await pchainRpc<GetCurrentSupplyResponse>('getCurrentSupply', {}, network);
  return BigInt(result.supply);
}

/**
 * Get total stake for Primary Network
 */
export async function getTotalStake(
  subnetID: string = '11111111111111111111111111111111LpoYY',
  network: PChainNetwork = 'mainnet'
): Promise<bigint> {
  const result = await pchainRpc<GetTotalStakeResponse>('getTotalStake', { subnetID }, network);
  return BigInt(result.weight);
}

/**
 * Get minimum stake amounts
 */
export async function getMinStake(
  network: PChainNetwork = 'mainnet'
): Promise<{ minValidatorStake: bigint; minDelegatorStake: bigint }> {
  const result = await pchainRpc<GetMinStakeResponse>('getMinStake', {}, network);
  return {
    minValidatorStake: BigInt(result.minValidatorStake),
    minDelegatorStake: BigInt(result.minDelegatorStake),
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Convert nAVAX to AVAX
 */
export function nAvaxToAvax(nAvax: bigint | string | number): number {
  const amount = typeof nAvax === 'bigint' ? nAvax : BigInt(nAvax);
  return Number(amount) / 1e9;
}

/**
 * Format AVAX amount with proper decimals
 */
export function formatAvax(nAvax: bigint | string | number, decimals: number = 4): string {
  const avax = nAvaxToAvax(nAvax);
  if (avax === 0) return '0';
  if (avax < 0.0001) return '<0.0001';
  return avax.toLocaleString(undefined, { 
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals 
  });
}

/**
 * Format timestamp from Unix seconds to ISO string
 */
export function formatTimestamp(unixSeconds: number | string): string {
  const timestamp = typeof unixSeconds === 'string' ? parseInt(unixSeconds, 10) : unixSeconds;
  return new Date(timestamp * 1000).toISOString();
}

/**
 * Parse P-Chain address to get the raw address without prefix
 */
export function parseAddress(address: string): string {
  // P-Chain addresses are in format "P-avax1..." or "P-fuji1..."
  if (address.startsWith('P-')) {
    return address;
  }
  return address;
}

/**
 * Get network prefix for addresses
 */
export function getAddressPrefix(network: PChainNetwork): string {
  return network === 'mainnet' ? 'P-avax' : 'P-fuji';
}

