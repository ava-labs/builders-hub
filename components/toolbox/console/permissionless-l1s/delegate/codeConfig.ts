import type { StepConfig } from '@/components/console/step-code-viewer';
import versions from '@/scripts/versions.json';

const ICM_COMMIT = versions['ava-labs/icm-services'];

export const PCHAIN_WEIGHT_UPDATE_CODE = `// Aggregate signatures using Avalanche SDK
import { Avalanche } from "@avalabs/avalanche-sdk";

const sdk = new Avalanche({ network: "fuji" });

// Get the unsigned warp message from the EVM transaction receipt
const receipt = await publicClient.waitForTransactionReceipt({
  hash: initiateDelegationTxHash
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

export const NATIVE_STEP_CONFIG: StepConfig[] = [
  {
    id: 'initiate-delegation',
    title: 'Initiate Delegation',
    description: 'Call initiateDelegatorRegistration on the Staking Manager',
    codeType: 'solidity' as const,
    sourceUrl: `https://raw.githubusercontent.com/ava-labs/icm-services/${ICM_COMMIT}/contracts/validator-manager/NativeTokenStakingManager.sol`,
    githubUrl: `https://github.com/ava-labs/icm-services/blob/${ICM_COMMIT}/contracts/validator-manager/NativeTokenStakingManager.sol`,
    highlightFunction: 'initiateDelegatorRegistration',
    filename: 'NativeTokenStakingManager.sol',
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
    id: 'complete-delegation',
    title: 'Complete Delegation',
    description: 'Call completeDelegatorRegistration on the Staking Manager',
    codeType: 'solidity' as const,
    sourceUrl: `https://raw.githubusercontent.com/ava-labs/icm-services/${ICM_COMMIT}/contracts/validator-manager/StakingManager.sol`,
    githubUrl: `https://github.com/ava-labs/icm-services/blob/${ICM_COMMIT}/contracts/validator-manager/StakingManager.sol`,
    highlightFunction: 'completeDelegatorRegistration',
    filename: 'StakingManager.sol',
  },
];

export const ERC20_STEP_CONFIG: StepConfig[] = [
  {
    ...NATIVE_STEP_CONFIG[0],
    sourceUrl: `https://raw.githubusercontent.com/ava-labs/icm-services/${ICM_COMMIT}/contracts/validator-manager/ERC20TokenStakingManager.sol`,
    githubUrl: `https://github.com/ava-labs/icm-services/blob/${ICM_COMMIT}/contracts/validator-manager/ERC20TokenStakingManager.sol`,
    filename: 'ERC20TokenStakingManager.sol',
  },
  NATIVE_STEP_CONFIG[1],
  NATIVE_STEP_CONFIG[2],
];
