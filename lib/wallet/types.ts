export interface GenesisAllocation {
  avaxAddr: string
  ethAddr: string
  initialAmount: number
  unlockSchedule: UnlockSchedule[]
}

export interface UnlockSchedule {
  amount: number
  locktime: number
}

export interface AddressInfo {
  raw: string
  xChain: string
  pChain: string
  cChain?: string
}

export interface WalletProfile {
  address: AddressInfo
  isGenesis: boolean
  genesisAllocation?: GenesisAllocation
  balances: ChainBalances
  recentTxs: TransactionSummary[]
}

export interface ChainBalances {
  xChain?: BalanceInfo
  pChain?: BalanceInfo
  cChain?: BalanceInfo
}

export interface BalanceInfo {
  balance: string
  unlocked?: string
  lockedStakeable?: string
  lockedNotStakeable?: string
}

export interface TransactionSummary {
  txHash: string
  chain: 'X' | 'P' | 'C'
  type: string
  timestamp?: string
  amountNanoAvax?: string
  fromAddresses?: string[]
  toAddresses?: string[]
}

export interface FundTrace {
  address: string
  chain: 'X' | 'P'
  depth: number
  isGenesis: boolean
  genesisAllocation?: GenesisAllocation
  txHash?: string
  amountNanoAvax?: string
  sources: FundTrace[]
}

export interface ValidatorProfile {
  nodeId: string
  status: 'active' | 'pending' | 'inactive'
  stakeAmountNanoAvax?: string
  startTime?: string
  endTime?: string
  delegationFee?: string
  uptime?: string
  connected?: boolean
  rewardAddress?: string
  stakingAddresses: string[]
  fundSources: FundTrace[]
  genesisLinks: GenesisLink[]
}

export interface GenesisLink {
  genesisAddress: string
  allocation: GenesisAllocation
  path: string[]
  depth: number
}

export interface EntityCluster {
  addresses: ClusterAddress[]
  evidence: ClusterEvidence[]
  totalAddresses: number
}

export interface ClusterAddress {
  address: string
  chain: 'X' | 'P' | 'C'
  discoveryMethod: 'seed' | 'co-spent' | 'pubkey-derivation' | 'cross-chain'
}

export interface ClusterEvidence {
  method: 'co-spent' | 'pubkey-derivation' | 'cross-chain'
  txHash?: string
  details: string
  addressA: string
  addressB: string
}

export interface GlacierTxResponse {
  transactions: GlacierTransaction[]
  nextPageToken?: string
}

export interface GlacierTransaction {
  txHash: string
  txType: string
  blockTimestamp?: number
  consumedUtxos?: GlacierUtxo[]
  emittedUtxos?: GlacierUtxo[]
  amountUnlocked?: GlacierAmountDetail[]
  amountStaked?: GlacierAmountDetail[]
  memo?: string
}

export interface GlacierUtxo {
  utxoId: string
  txHash: string
  outputIndex: number
  assetId: string
  amount: string
  addresses: string[]
  creationTxHash?: string
}

export interface GlacierAmountDetail {
  assetId: string
  amount: string
}

export interface PChainTxResult {
  tx: {
    unsignedTx: Record<string, unknown>
    credentials?: PChainCredential[]
  }
  encoding: string
}

export interface PChainCredential {
  signatures: string[]
  fxID?: string
}

export interface PChainValidatorResult {
  validators: PChainValidator[]
}

export interface PChainValidator {
  nodeID: string
  stakeAmount?: string
  weight?: string
  startTime: string
  endTime: string
  delegationFee?: string
  connected?: boolean
  uptime?: string
  delegators?: unknown[]
  delegatorWeight?: string
  delegatorCount?: string
  potentialReward?: string
  rewardOwner?: {
    addresses: string[]
    locktime: string
    threshold: string
  }
  stakeOwners?: {
    addresses: string[]
    locktime: string
    threshold: string
  }
}
