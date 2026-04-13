import type { StepConfig } from '@/components/console/step-code-viewer';
import versions from '@/scripts/versions.json';

const ICM_COMMIT = versions['ava-labs/icm-contracts'];

export const PCHAIN_WEIGHT_UPDATE_CODE = `// Aggregate signatures using Avalanche SDK
import { Avalanche } from "@avalabs/avalanche-sdk";

const sdk = new Avalanche({ network: "fuji" });

// Get the unsigned warp message from the removal transaction
const receipt = await publicClient.waitForTransactionReceipt({
  hash: initiateRemovalTxHash
});
const unsignedWarpMessage = receipt.logs[0].data;

// Aggregate signatures from the subnet validators (67% quorum)
const { signedMessage } = await sdk.data.signatureAggregator.aggregate({
  signatureAggregatorRequest: {
    message: unsignedWarpMessage,
    signingSubnetId: subnetId,
    quorumPercentage: 67,
  }
});

// Submit SetL1ValidatorWeightTx to P-Chain
const txHash = await walletClient.setL1ValidatorWeight({
  signedWarpMessage: signedMessage,
});`;

export const VALIDATOR_REMOVAL_STEPS: StepConfig[] = [
  {
    id: 'initiate-removal',
    title: 'Initiate Validator Removal',
    description: 'Call forceInitiateValidatorRemoval on the Staking Manager',
    codeType: 'solidity' as const,
    sourceUrl: `https://raw.githubusercontent.com/ava-labs/icm-contracts/${ICM_COMMIT}/contracts/validator-manager/StakingManager.sol`,
    githubUrl: `https://github.com/ava-labs/icm-contracts/blob/${ICM_COMMIT}/contracts/validator-manager/StakingManager.sol`,
    highlightFunction: 'forceInitiateValidatorRemoval',
    filename: 'StakingManager.sol',
  },
  {
    id: 'pchain-weight-update',
    title: 'P-Chain Weight Update',
    description: 'Aggregate signatures and submit SetL1ValidatorWeightTx',
    codeType: 'typescript' as const,
    code: PCHAIN_WEIGHT_UPDATE_CODE,
    filename: 'setL1ValidatorWeight.ts',
    githubUrl: 'https://github.com/ava-labs/avalanche-sdk',
  },
  {
    id: 'complete-removal',
    title: 'Complete Validator Removal',
    description: 'Call completeValidatorRemoval on the Staking Manager',
    codeType: 'solidity' as const,
    sourceUrl: `https://raw.githubusercontent.com/ava-labs/icm-contracts/${ICM_COMMIT}/contracts/validator-manager/StakingManager.sol`,
    githubUrl: `https://github.com/ava-labs/icm-contracts/blob/${ICM_COMMIT}/contracts/validator-manager/StakingManager.sol`,
    highlightFunction: 'completeValidatorRemoval',
    filename: 'StakingManager.sol',
  },
  {
    id: 'claim-fees',
    title: 'Claim Delegation Fees',
    description: 'Call claimDelegationFees on the Staking Manager',
    codeType: 'solidity' as const,
    sourceUrl: `https://raw.githubusercontent.com/ava-labs/icm-contracts/${ICM_COMMIT}/contracts/validator-manager/StakingManager.sol`,
    githubUrl: `https://github.com/ava-labs/icm-contracts/blob/${ICM_COMMIT}/contracts/validator-manager/StakingManager.sol`,
    highlightFunction: 'claimDelegationFees',
    filename: 'StakingManager.sol',
  },
];

export const DELEGATION_REMOVAL_STEPS: StepConfig[] = [
  {
    id: 'initiate-removal',
    title: 'Initiate Delegator Removal',
    description: 'Call forceInitiateDelegatorRemoval on the Staking Manager',
    codeType: 'solidity' as const,
    sourceUrl: `https://raw.githubusercontent.com/ava-labs/icm-contracts/${ICM_COMMIT}/contracts/validator-manager/StakingManager.sol`,
    githubUrl: `https://github.com/ava-labs/icm-contracts/blob/${ICM_COMMIT}/contracts/validator-manager/StakingManager.sol`,
    highlightFunction: 'forceInitiateDelegatorRemoval',
    filename: 'StakingManager.sol',
  },
  {
    id: 'pchain-weight-update',
    title: 'P-Chain Weight Update',
    description: 'Aggregate signatures and submit SetL1ValidatorWeightTx',
    codeType: 'typescript' as const,
    code: PCHAIN_WEIGHT_UPDATE_CODE,
    filename: 'setL1ValidatorWeight.ts',
    githubUrl: 'https://github.com/ava-labs/avalanche-sdk',
  },
  {
    id: 'complete-removal',
    title: 'Complete Delegator Removal',
    description: 'Call completeDelegatorRemoval on the Staking Manager',
    codeType: 'solidity' as const,
    sourceUrl: `https://raw.githubusercontent.com/ava-labs/icm-contracts/${ICM_COMMIT}/contracts/validator-manager/StakingManager.sol`,
    githubUrl: `https://github.com/ava-labs/icm-contracts/blob/${ICM_COMMIT}/contracts/validator-manager/StakingManager.sol`,
    highlightFunction: 'completeDelegatorRemoval',
    filename: 'StakingManager.sol',
  },
];
