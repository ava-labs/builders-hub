import type { StepConfig } from "@/components/console/step-code-viewer";
import versions from "@/scripts/versions.json";

const ICM_COMMIT = versions["ava-labs/icm-contracts"];

export const PCHAIN_REGISTRATION_CODE = `// Step 5a: Aggregate signatures using Avalanche SDK
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

// Step 5b: Submit RegisterL1ValidatorTx to P-Chain
// Registers the new validator on the P-Chain
const txHash = await walletClient.registerL1Validator({
  signedWarpMessage: signedMessage,
  balance: validatorBalance,
});`;

export const STEP_CONFIG: StepConfig[] = [
  { id: "ensure-node", title: "L1 Node", description: "Ensure your L1 node is running" },
  { id: "select-subnet", title: "Select L1", description: "Choose your L1 subnet" },
  { id: "validator-details", title: "Validator Details", description: "Add node credentials and configuration" },
  {
    id: "initiate-registration",
    title: "Initiate Registration",
    description: "Call initiateValidatorRegistration on ValidatorManager",
    codeType: "solidity" as const,
    sourceUrl: `https://raw.githubusercontent.com/ava-labs/icm-contracts/${ICM_COMMIT}/contracts/validator-manager/ValidatorManager.sol`,
    githubUrl: `https://github.com/ava-labs/icm-contracts/blob/${ICM_COMMIT}/contracts/validator-manager/ValidatorManager.sol`,
    highlightFunction: "initiateValidatorRegistration",
    filename: "ValidatorManager.sol",
  },
  {
    id: "pchain-registration",
    title: "P-Chain Registration",
    description: "Aggregate signatures and submit RegisterL1ValidatorTx",
    codeType: "typescript" as const,
    code: PCHAIN_REGISTRATION_CODE,
    filename: "registerL1Validator.ts",
    githubUrl: "https://github.com/ava-labs/avalanche-sdk",
  },
  {
    id: "complete-registration",
    title: "Complete Registration",
    description: "Call completeValidatorRegistration on ValidatorManager",
    codeType: "solidity" as const,
    sourceUrl: `https://raw.githubusercontent.com/ava-labs/icm-contracts/${ICM_COMMIT}/contracts/validator-manager/ValidatorManager.sol`,
    githubUrl: `https://github.com/ava-labs/icm-contracts/blob/${ICM_COMMIT}/contracts/validator-manager/ValidatorManager.sol`,
    highlightFunction: "completeValidatorRegistration",
    filename: "ValidatorManager.sol",
  },
];
