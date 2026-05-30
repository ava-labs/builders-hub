import type { StepConfig } from '@/components/console/step-code-viewer';
import versions from '@/scripts/versions.json';

const ICM_COMMIT = versions['ava-labs/icm-services'];

export const PCHAIN_WEIGHT_CODE = `// Step 3a: Aggregate signatures using Avalanche SDK
import { Avalanche } from "@avalabs/avalanche-sdk";

const sdk = new Avalanche({ network: "fuji" });

// Get the unsigned warp message from the EVM transaction receipt
const receipt = await publicClient.waitForTransactionReceipt({
  hash: initiateWeightUpdateTxHash
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

// Step 3b: Submit SetL1ValidatorWeightTx to P-Chain
// Updates the validator's weight on the P-Chain
const txHash = await walletClient.setL1ValidatorWeight({
  signedWarpMessage: signedMessage,
});`;

export const STEP_CONFIG: StepConfig[] = [
  { id: 'select-subnet', title: 'Select L1', description: 'Choose your L1 subnet' },
  {
    id: 'initiate-weight-change',
    title: 'Initiate Weight Change',
    description: 'Call initiateValidatorWeightUpdate on ValidatorManager',
    codeType: 'solidity' as const,
    sourceUrl: `https://raw.githubusercontent.com/ava-labs/icm-services/${ICM_COMMIT}/contracts/validator-manager/ValidatorManager.sol`,
    githubUrl: `https://github.com/ava-labs/icm-services/blob/${ICM_COMMIT}/contracts/validator-manager/ValidatorManager.sol`,
    highlightFunction: 'initiateValidatorWeightUpdate',
    filename: 'ValidatorManager.sol',
  },
  {
    id: 'pchain-weight-update',
    title: 'P-Chain Weight Update',
    description: 'Aggregate signatures and submit SetL1ValidatorWeightTx',
    codeType: 'typescript' as const,
    code: PCHAIN_WEIGHT_CODE,
    filename: 'setL1ValidatorWeight.ts',
    githubUrl: 'https://github.com/ava-labs/avalanche-sdk',
  },
  {
    id: 'complete-weight-change',
    title: 'Complete Weight Change',
    description: 'Call completeValidatorWeightUpdate on ValidatorManager',
    codeType: 'solidity' as const,
    sourceUrl: `https://raw.githubusercontent.com/ava-labs/icm-services/${ICM_COMMIT}/contracts/validator-manager/ValidatorManager.sol`,
    githubUrl: `https://github.com/ava-labs/icm-services/blob/${ICM_COMMIT}/contracts/validator-manager/ValidatorManager.sol`,
    highlightFunction: 'completeValidatorWeightUpdate',
    filename: 'ValidatorManager.sol',
  },
];
