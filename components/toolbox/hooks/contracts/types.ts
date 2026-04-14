/**
 * Shared types used across contract hooks.
 *
 * Centralised here so that multiple hooks (core, staking, bridge, precompiles)
 * can import from one place instead of reaching into each other.
 */

// ---------------------------------------------------------------------------
// Validator Manager (core)
// ---------------------------------------------------------------------------

export interface PChainOwner {
  threshold: number;
  addresses: string[];
}

export interface ValidatorRegistrationParams {
  nodeID: string;
  blsPublicKey: string;
  remainingBalanceOwner: PChainOwner;
  disableOwner: PChainOwner;
  weight: bigint;
}

export interface ValidatorData {
  status: number;
  nodeID: string;
  startingWeight: bigint;
  sentNonce: bigint;
  receivedNonce: bigint;
  weight: bigint;
  startTime: bigint;
  endTime: bigint;
}

export interface ValidatorSetParams {
  subnetID: string;
  validatorManagerBlockchainID: string;
  validatorManagerAddress: string;
  initialValidators: Array<{
    nodeID: string;
    blsPublicKey: string;
    weight: bigint;
  }>;
}

export interface InitParams {
  settings: {
    admin: string;
    subnetID: string;
    churnPeriodSeconds: bigint;
    maximumChurnPercentage: number;
  };
}

export interface MigrationParams {
  validationID: string;
  receivedNonce: number;
}

// ---------------------------------------------------------------------------
// Staking Manager
// ---------------------------------------------------------------------------

export interface StakingManagerSettings {
  manager: string;
  minimumStakeAmount: bigint;
  maximumStakeAmount: bigint;
  minimumStakeDuration: bigint;
  minimumDelegationFeeBips: number;
  maximumStakeMultiplier: number;
  weightToValueFactor: bigint;
  rewardCalculator: string;
  uptimeBlockchainID: string;
}

// ---------------------------------------------------------------------------
// Token Bridge
// ---------------------------------------------------------------------------

export type TokenType = 'erc20' | 'native';

export interface SendTokensInput {
  destinationBlockchainID: string;
  destinationTokenTransferrerAddress: string;
  recipient: string;
  primaryFeeTokenAddress: string;
  primaryFee: bigint;
  secondaryFee: bigint;
  requiredGasLimit: bigint;
  multiHopFallback: string;
}

export interface RemoteTokenTransferrerSettings {
  registered: boolean;
  collateralNeeded: bigint;
  tokenMultiplierNumerator: bigint;
  tokenMultiplierDenominator: bigint;
}

export interface TokenMultiplier {
  numerator: bigint;
  denominator: bigint;
}

// ---------------------------------------------------------------------------
// Precompiles
// ---------------------------------------------------------------------------

export interface FeeConfig {
  gasLimit: bigint;
  targetBlockRate: bigint;
  minBaseFee: bigint;
  targetGas: bigint;
  baseFeeChangeDenominator: bigint;
  minBlockGasCost: bigint;
  maxBlockGasCost: bigint;
  blockGasCostStep: bigint;
}
