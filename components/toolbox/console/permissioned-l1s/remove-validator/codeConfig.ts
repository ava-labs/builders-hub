import type { StepConfig } from "@/components/console/step-code-viewer";
import versions from "@/scripts/versions.json";

const ICM_COMMIT = versions["ava-labs/icm-contracts"];

export const PCHAIN_REMOVAL_CODE = `// Step 3a: Aggregate signatures using Avalanche SDK
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

// Step 3b: Submit SetL1ValidatorWeightTx to P-Chain
// Sets the validator weight to 0, effectively removing them
const txHash = await walletClient.setL1ValidatorWeight({
  signedWarpMessage: signedMessage,
});`;

export const STEP_CONFIG: StepConfig[] = [
  { id: "select-subnet", title: "Select L1", description: "Choose your L1 subnet" },
  {
    id: "initiate-removal",
    title: "Initiate Removal",
    description: "Call initiateValidatorRemoval on ValidatorManager",
    codeType: "solidity" as const,
    sourceUrl: `https://raw.githubusercontent.com/ava-labs/icm-contracts/${ICM_COMMIT}/contracts/validator-manager/ValidatorManager.sol`,
    githubUrl: `https://github.com/ava-labs/icm-contracts/blob/${ICM_COMMIT}/contracts/validator-manager/ValidatorManager.sol`,
    highlightFunction: "initiateValidatorRemoval",
    filename: "ValidatorManager.sol",
  },
  {
    id: "pchain-removal",
    title: "P-Chain Weight Update",
    description: "Aggregate signatures and submit SetL1ValidatorWeightTx",
    codeType: "typescript" as const,
    code: PCHAIN_REMOVAL_CODE,
    filename: "setL1ValidatorWeight.ts",
    githubUrl: "https://github.com/ava-labs/avalanche-sdk",
  },
  {
    id: "complete-removal",
    title: "Complete Removal",
    description: "Call completeValidatorRemoval on ValidatorManager",
    codeType: "solidity" as const,
    sourceUrl: `https://raw.githubusercontent.com/ava-labs/icm-contracts/${ICM_COMMIT}/contracts/validator-manager/ValidatorManager.sol`,
    githubUrl: `https://github.com/ava-labs/icm-contracts/blob/${ICM_COMMIT}/contracts/validator-manager/ValidatorManager.sol`,
    highlightFunction: "completeValidatorRemoval",
    filename: "ValidatorManager.sol",
  },
];
