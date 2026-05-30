import type { StepConfig } from '@/components/console/step-code-viewer';
import versions from '@/scripts/versions.json';

const ICM_COMMIT = versions['ava-labs/icm-services'];

export const PCHAIN_REGISTRATION_CODE = `// Aggregate signatures using Avalanche SDK
import { Avalanche } from "@avalabs/avalanche-sdk";

const sdk = new Avalanche({ network: "fuji" });

// Get the unsigned warp message from the EVM transaction receipt
const receipt = await publicClient.waitForTransactionReceipt({
  hash: initiateRegistrationTxHash
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

// Submit RegisterL1ValidatorTx to P-Chain
const txHash = await walletClient.registerL1Validator({
  signedWarpMessage: signedMessage,
  balance: validatorBalance,
});`;

/**
 * Step source is picked at runtime based on the detected manager type:
 *  - PoA / PoA-Multisig → ValidatorManager.sol
 *  - PoS Native        → NativeTokenStakingManager.sol
 *  - PoS ERC20         → ERC20TokenStakingManager.sol
 *
 * The structure stays uniform; only the highlighted contract source differs.
 */
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
  return [
    { id: 'select-subnet', title: 'Select L1', description: 'Choose your L1 subnet' },
    {
      id: 'initiate-registration',
      title: 'Initiate Validator Registration',
      description:
        flavor === 'PoA'
          ? 'Call initiateValidatorRegistration on ValidatorManager'
          : 'Call initiateValidatorRegistration on the Staking Manager',
      codeType: 'solidity' as const,
      sourceUrl: src.raw,
      githubUrl: src.github,
      highlightFunction: 'initiateValidatorRegistration',
      filename: src.filename,
    },
    {
      id: 'pchain-registration',
      title: 'P-Chain Registration',
      description: 'Aggregate signatures and submit RegisterL1ValidatorTx',
      codeType: 'typescript' as const,
      code: PCHAIN_REGISTRATION_CODE,
      filename: 'registerL1Validator.ts',
      githubUrl: 'https://github.com/ava-labs/avalanche-sdk',
    },
    {
      id: 'complete-registration',
      title: 'Complete Registration',
      description:
        flavor === 'PoA'
          ? 'Call completeValidatorRegistration on ValidatorManager'
          : 'Call completeValidatorRegistration on the Staking Manager',
      codeType: 'solidity' as const,
      sourceUrl: src.raw,
      githubUrl: src.github,
      highlightFunction: 'completeValidatorRegistration',
      filename: src.filename,
    },
  ];
}
