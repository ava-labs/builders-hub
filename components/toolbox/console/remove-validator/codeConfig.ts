import type { StepConfig } from '@/components/console/step-code-viewer';
import versions from '@/scripts/versions.json';

const ICM_COMMIT = versions['ava-labs/icm-services'];

export const PCHAIN_REMOVAL_CODE = `// Aggregate signatures using Avalanche SDK
import { Avalanche } from "@avalabs/avalanche-sdk";

const sdk = new Avalanche({ network: "fuji" });

// Get the unsigned warp message from the EVM transaction receipt
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

// Submit SetL1ValidatorWeightTx to P-Chain — sets weight to 0
const txHash = await walletClient.setL1ValidatorWeight({
  signedWarpMessage: signedMessage,
});`;

export type ManagerCodeFlavor = 'PoA' | 'PoS-Native' | 'PoS-ERC20';

const SOURCE_BY_FLAVOR: Record<ManagerCodeFlavor, { filename: string; raw: string; github: string }> = {
  PoA: {
    filename: 'ValidatorManager.sol',
    raw: `https://raw.githubusercontent.com/ava-labs/icm-services/${ICM_COMMIT}/contracts/validator-manager/ValidatorManager.sol`,
    github: `https://github.com/ava-labs/icm-services/blob/${ICM_COMMIT}/contracts/validator-manager/ValidatorManager.sol`,
  },
  'PoS-Native': {
    filename: 'NativeTokenStakingManager.sol',
    raw: `https://raw.githubusercontent.com/ava-labs/icm-services/${ICM_COMMIT}/contracts/validator-manager/NativeTokenStakingManager.sol`,
    github: `https://github.com/ava-labs/icm-services/blob/${ICM_COMMIT}/contracts/validator-manager/NativeTokenStakingManager.sol`,
  },
  'PoS-ERC20': {
    filename: 'ERC20TokenStakingManager.sol',
    raw: `https://raw.githubusercontent.com/ava-labs/icm-services/${ICM_COMMIT}/contracts/validator-manager/ERC20TokenStakingManager.sol`,
    github: `https://github.com/ava-labs/icm-services/blob/${ICM_COMMIT}/contracts/validator-manager/ERC20TokenStakingManager.sol`,
  },
};

export function buildStepConfig(flavor: ManagerCodeFlavor): StepConfig[] {
  const src = SOURCE_BY_FLAVOR[flavor];
  const config: StepConfig[] = [
    { id: 'select-subnet', title: 'Select L1', description: 'Choose your L1 subnet' },
    {
      id: 'initiate-removal',
      title: 'Initiate Removal',
      description:
        flavor === 'PoA'
          ? 'Call initiateValidatorRemoval on ValidatorManager'
          : 'Call initiateValidatorRemoval (with uptime proof) on the Staking Manager — falls back to forceInitiateValidatorRemoval if rewards-ineligible',
      codeType: 'solidity' as const,
      sourceUrl: src.raw,
      githubUrl: src.github,
      highlightFunction: 'initiateValidatorRemoval',
      filename: src.filename,
    },
    {
      id: 'pchain-removal',
      title: 'P-Chain Weight Update',
      description: 'Aggregate signatures and submit SetL1ValidatorWeightTx',
      codeType: 'typescript' as const,
      code: PCHAIN_REMOVAL_CODE,
      filename: 'setL1ValidatorWeight.ts',
      githubUrl: 'https://github.com/ava-labs/avalanche-sdk',
    },
    {
      id: 'complete-removal',
      title: 'Complete Removal',
      description:
        flavor === 'PoA'
          ? 'Call completeValidatorRemoval on ValidatorManager'
          : 'Call completeValidatorRemoval on the Staking Manager',
      codeType: 'solidity' as const,
      sourceUrl: src.raw,
      githubUrl: src.github,
      highlightFunction: 'completeValidatorRemoval',
      filename: src.filename,
    },
  ];

  // claim-fees only meaningful for PoS staking managers — the code-viewer
  // sidebar still wants an entry for it (so the step index lines up).
  if (flavor !== 'PoA') {
    config.push({
      id: 'claim-fees',
      title: 'Claim Delegation Fees',
      description: 'Call claimDelegationFees on the Staking Manager',
      codeType: 'solidity' as const,
      sourceUrl: src.raw,
      githubUrl: src.github,
      highlightFunction: 'claimDelegationFees',
      filename: src.filename,
    });
  }

  return config;
}
