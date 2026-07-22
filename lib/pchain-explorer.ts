// P-Chain explorer config + types + client.
//
// The explorer API is the dedicated P-chain read API (UTXO-shaped) served over
// plain HTTP on an IP, so it is ONLY reached server-side via the proxy route
// (app/api/pchain/[network]/[...path]/route.ts) — never from the browser (the
// site is HTTPS; mixed content would be blocked). Client code fetches the
// same-origin `/api/pchain/...` paths via the `pchainApi()` helper.
//
// URL scheme (finalized, chain-family agnostic so L1s slot in later):
//   /explorer/{network}/{chain}/{resource}
//   network  = mainnet | fuji | devnet
//   chain    = p-chain (+ future L1 slugs)
//   resource = "" (home) | blocks | block/{id} | txs | tx/{id}
//              | address/{addr} | node/{nodeId} | validators

export const EXPLORER_API_BASE =
  process.env.EXPLORER_API_URL || "http://44.221.18.159";

// --- networks -------------------------------------------------------------

export const PCHAIN_NETWORKS = ["mainnet", "fuji", "devnet"] as const;
export type PchainNetwork = (typeof PCHAIN_NETWORKS)[number];

export function isPchainNetwork(v: string): v is PchainNetwork {
  return (PCHAIN_NETWORKS as readonly string[]).includes(v);
}

export const NETWORK_LABEL: Record<PchainNetwork, string> = {
  mainnet: "Mainnet",
  fuji: "Fuji",
  devnet: "Devnet",
};

// --- chain registry (future L1 explorers register here) -------------------

export type ChainKind = "pchain" | "evm";

export interface ExplorerChain {
  slug: string; // URL segment
  name: string; // display (breadcrumb / nav)
  title: string; // page headline
  kind: ChainKind;
  networks: readonly string[];
  defaultNetwork: string;
}

export const EXPLORER_CHAINS: Record<string, ExplorerChain> = {
  "p-chain": {
    slug: "p-chain",
    name: "P-Chain",
    title: "Platform Chain",
    kind: "pchain",
    networks: PCHAIN_NETWORKS,
    defaultNetwork: "mainnet",
  },
};

export function getExplorerChain(slug: string): ExplorerChain | undefined {
  return EXPLORER_CHAINS[slug];
}

// Well-known blockchain IDs (CB58) → display name, for cross-chain
// source/destination labels (import/export). Mirrors the server-side
// wellKnownChains map.
const WELL_KNOWN_CHAINS: Record<string, string> = {
  "2q9e4r6Mu3U68nU1fYjgbR6JvwrRx36CohpAX5UQxse55x1Q5": "C-Chain",
  "2oYMBNV4eNHyqk2fjjV5nVQLDbtmNJzq5s3qs3Lo6ftnC6FByM": "X-Chain",
  yH8D7ThNJkxmtkuv2jgBa4P1Rn3Qpr4pPr7QYNfcdoS6k6HWp: "C-Chain",
  "2JVSBoinj9C2J33VntvzYtVJNZdN2NKiwwKjcumHUWEb5DbBrm": "X-Chain",
  "2CpuZMeuT19nECGuqUo1oZveNFvsjXV7xbVapiaaqSPnTKuWzH": "C-Chain",
};

export function chainDisplayName(cb58?: string): string | undefined {
  if (!cb58) return undefined;
  return WELL_KNOWN_CHAINS[cb58] ?? `${cb58.slice(0, 8)}…`;
}

/** The friendly name only when the chain is recognized; else undefined (so the
 *  caller can fall back to a copyable full ID). */
export function knownChainName(cb58?: string): string | undefined {
  return cb58 ? WELL_KNOWN_CHAINS[cb58] : undefined;
}

// --- client fetch helper (same-origin proxy) ------------------------------

/** Builds the same-origin proxy path for an explorer API call. */
export function pchainApiPath(
  network: string,
  resource: string,
  query?: Record<string, string | number | undefined>,
): string {
  const qs = query
    ? Object.entries(query)
        .filter(([, v]) => v !== undefined && v !== "")
        .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`)
        .join("&")
    : "";
  const base = `/api/pchain/${network}/${resource.replace(/^\//, "")}`;
  return qs ? `${base}?${qs}` : base;
}

// ==========================================================================
// Response types — mirror the explorer API JSON contract exactly.
// ==========================================================================

export interface Stats {
  tipHeight: number;
  tipTimestamp: number;
  txCount24h: number;
  validatorCount: number;
  delegatorCount: number;
  l1ValidatorCount: number;
  currentSupply?: string;
  snapshotTimestamp?: number;
}

export interface TxSummary {
  txHash: string;
  txType: string;
  blockHeight: number;
  blockTimestamp: number;
  nodeId?: string;
  period?: number;
  periodHuman?: string;
  autoCompoundPercent?: number;
  isAutoRenew: boolean;
}

export interface BlockSummary {
  blockNumber: number;
  blockHash: string;
  blockType: string;
  blockTimestamp: number;
  txCount: number;
  blockSizeBytes: number;
  proposerNodeId?: string;
}

export interface BlocksList {
  blocks: BlockSummary[];
  nextBefore?: number;
}

export interface AssetAmount {
  assetId: string;
  name: string;
  symbol: string;
  denomination: number;
  type?: string;
  amount: string;
}

export interface Utxo {
  addresses: string[];
  utxoId: string;
  txHash: string;
  outputIndex: number;
  blockTimestamp: number;
  blockNumber: string;
  consumingTxHash?: string;
  consumingBlockTimestamp?: number;
  consumingBlockNumber?: string;
  assetId: string;
  asset: AssetAmount;
  utxoType: string;
  amount: string;
  platformLocktime: number;
  threshold: number;
  createdOnChainId: string;
  consumedOnChainId: string;
  staked: boolean;
}

export interface TxDetails {
  weight?: number;
  delegationFeePercent?: number;
  stakingTxId?: string;
  rewardPaid?: boolean;
  chainName?: string;
  vmId?: string;
  genesisDataHash?: string;
  subnetOwners?: string[];
  subnetThreshold?: number;
  subnetLocktime?: number;
  validationId?: string;
  l1Balance?: number;
  sourceChain?: string;
  destinationChain?: string;
  blsPublicKey?: string;
}

export interface ImportedExport {
  txHash: string;
  utxoCount: number;
  evmSenders?: string[];
  amount?: string;
}

export interface ImportedFrom {
  chainId: string;
  chainName?: string;
  exports: ImportedExport[];
}

export interface Tx {
  txHash: string;
  txType: string;
  blockTimestamp: number;
  blockNumber: string;
  blockHash: string;
  memo: string;
  rewardAddresses?: string[];
  estimatedReward?: string;
  startTimestamp?: number;
  endTimestamp?: number;
  nodeId?: string;
  subnetId?: string;
  period?: number;
  periodHuman?: string;
  autoCompoundRewardShares?: number;
  autoCompoundPercent?: number;
  validatorAuthority?: string[];
  details?: TxDetails;
  importedFrom?: ImportedFrom;
  consumedUtxos: Utxo[];
  emittedUtxos: Utxo[];
  value: AssetAmount[];
  amountBurned: AssetAmount[];
  amountStaked: AssetAmount[];
}

export interface BlockTx {
  txHash: string;
  txType: string;
}

export interface Block {
  blockNumber: string;
  blockHash: string;
  parentHash: string;
  blockType: string;
  timestamp: number;
  txCount: number;
  blockSizeBytes: number;
  proposerNodeId?: string;
  proposerPChainHeight?: number;
  proposerTimestamp?: number;
  transactions: BlockTx[];
}

export interface AddressUtxo {
  utxoId: string;
  txHash: string;
  outputIndex: number;
  assetId: string;
  amount: string;
  platformLocktime: number;
  threshold: number;
  staked: boolean;
  utxoKind: string;
  blockNumber: string;
  blockTimestamp: number;
}

export interface FundedBy {
  txHash: string;
  blockTimestamp: number;
  amount: string;
  funders: string[];
}

export interface Address {
  address: string;
  balance: { total: string; unlocked: string; locked: string; staked: string };
  utxoCount: number;
  fundedBy?: FundedBy;
  utxos: AddressUtxo[];
}

export interface AddressTx {
  txHash: string;
  txType: string;
  blockHeight: number;
  blockTimestamp: number;
  received: string;
  sent: string;
  net: string;
}

export interface AddressTxs {
  address: string;
  txs: AddressTx[];
  truncated: boolean;
  nextBefore?: number;
}

export interface NodeValidation {
  kind: "staking" | "l1";
  subnetId: string;
  validationId?: string;
  weight: number;
  balance?: number;
  potentialReward?: number;
  connected?: boolean;
  endTimestamp?: number;
}

export interface NodeDelegator {
  txId: string;
  stakeAmount: number;
  potentialReward: number;
  startTimestamp: number;
  endTimestamp: number;
}

export interface NodeStakingTx {
  txHash: string;
  txType: string;
  blockTimestamp: number;
  weight?: number;
  subnetId?: string;
  period?: number;
}

export interface NodeResponse {
  nodeId: string;
  lastSnapshotTimestamp: number;
  hasSnapshot: boolean;
  validator: {
    txId: string;
    validationId?: string;
    subnetId: string;
    weight: number;
    delegatorCount: number;
    delegatorWeight: number;
    totalStake: number;
    delegationFeePercent: number;
    potentialReward: number;
    connected: boolean;
    startTimestamp: number;
    endTimestamp: number;
    daysLeft: number;
  };
  history: NodeStakingTx[];
  validations: NodeValidation[];
  delegators: NodeDelegator[];
  delegatorsPotentialReward: number;
  uptime: { sampleCount: number; currentP50: number; min: number; max: number; avg: number; p50: number; p95: number };
  uptimeHistory: { bucket: string; p50Uptime: number }[];
  proposedBlocks14d: number;
  nodeInfo?: { version: string; publicIp: string; benched: string[]; observedUptime: number };
}

export interface ValidatorSummary {
  nodeId: string;
  subnetId: string;
  weight: number;
  delegatorCount: number;
  delegatorWeight: number;
  totalStake: number;
  delegationFeePercent: number;
  potentialReward: number;
  uptimePercent: number;
  connected: boolean;
  endTimestamp: number;
  period?: number;
  periodHuman?: string;
  autoCompoundPercent?: number;
}

export interface ValidatorsResponse {
  snapshotTimestamp: number;
  validators: ValidatorSummary[];
}

export interface SearchResult {
  type: "block" | "tx" | "address" | "node" | "none";
  id: string;
}
