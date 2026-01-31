"use client";

import { useState, useEffect } from "react";
import { useToolboxStore, useViemChainStore } from "@/components/toolbox/stores/toolboxStore";
import { useWalletStore } from "@/components/toolbox/stores/walletStore";
import { TransferOwnership } from "@/components/toolbox/console/permissioned-l1s/multisig-setup/TransferOwnership";
import { ConsoleToolMetadata, withConsoleToolMetadata, BaseConsoleToolProps } from '../../../components/WithConsoleToolMetadata';
import { generateConsoleToolGitHubUrl } from "@/components/toolbox/utils/github-url";
import { WalletRequirementsConfigKey } from "@/components/toolbox/hooks/useWalletRequirements";
import { Callout } from "fumadocs-ui/components/callout";
import { StepCodeViewer, type StepConfig } from "@/components/console/step-code-viewer";
import versions from "@/scripts/versions.json";

const ICM_COMMIT = versions["ava-labs/icm-contracts"];

const metadata: ConsoleToolMetadata = {
  title: "Transfer Ownership to Staking Manager",
  description: "Transfer the ownership of the Validator Manager to your deployed Staking Manager",
  toolRequirements: [
    WalletRequirementsConfigKey.EVMChainBalance,
  ],
  githubUrl: generateConsoleToolGitHubUrl(import.meta.url)
};

// SDK code examples for ownership transfer
const getCodeSteps = (params: {
  validatorManagerAddress: string;
  stakingManagerAddress: string;
}): StepConfig[] => [
  {
    id: "understand-ownership",
    title: "Understanding Ownership",
    description: "Why ownership transfer is needed",
    codeType: "solidity",
    filename: "ValidatorManager.sol",
    sourceUrl: `https://raw.githubusercontent.com/ava-labs/icm-contracts/${ICM_COMMIT}/contracts/validator-manager/ValidatorManager.sol`,
    highlightFunction: "transferOwnership",
    githubUrl: `https://github.com/ava-labs/icm-contracts/blob/${ICM_COMMIT}/contracts/validator-manager/ValidatorManager.sol`,
  },
  {
    id: "transfer-sdk",
    title: "Transfer via SDK",
    description: "Using viem to transfer ownership",
    codeType: "typescript",
    filename: "transfer-ownership.ts",
    code: `import { createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { avalancheFuji } from "viem/chains";

// ValidatorManager ABI (transferOwnership function)
const abi = [{
  name: "transferOwnership",
  type: "function",
  stateMutability: "nonpayable",
  inputs: [{ name: "newOwner", type: "address" }],
  outputs: []
}] as const;

const walletClient = createWalletClient({
  chain: avalancheFuji,
  transport: http(),
  account: privateKeyToAccount("0x...")
});

// Transfer ownership to the Staking Manager
const hash = await walletClient.writeContract({
  address: "${params.validatorManagerAddress || "0x..."}" as \`0x\${string}\`,
  abi,
  functionName: "transferOwnership",
  args: ["${params.stakingManagerAddress || "0x..."}" as \`0x\${string}\`]
});

console.log("Transfer tx hash:", hash);

// Wait for confirmation
const publicClient = createPublicClient({
  chain: avalancheFuji,
  transport: http()
});

const receipt = await publicClient.waitForTransactionReceipt({ hash });
console.log("Transfer confirmed:", receipt.status);`,
  },
  {
    id: "verify-ownership",
    title: "Verify Ownership",
    description: "Check the new owner address",
    codeType: "typescript",
    filename: "verify-ownership.ts",
    code: `import { createPublicClient, http } from "viem";
import { avalancheFuji } from "viem/chains";

const publicClient = createPublicClient({
  chain: avalancheFuji,
  transport: http()
});

// ValidatorManager ABI (owner function)
const abi = [{
  name: "owner",
  type: "function",
  stateMutability: "view",
  inputs: [],
  outputs: [{ name: "", type: "address" }]
}] as const;

// Read the current owner
const owner = await publicClient.readContract({
  address: "${params.validatorManagerAddress || "0x..."}" as \`0x\${string}\`,
  abi,
  functionName: "owner"
});

console.log("Current owner:", owner);

// Verify it's the Staking Manager
const expectedOwner = "${params.stakingManagerAddress || "0x..."}";
if (owner.toLowerCase() === expectedOwner.toLowerCase()) {
  console.log("✓ Ownership transferred successfully!");
} else {
  console.log("✗ Ownership mismatch!");
}`,
  },
];

function TransferOwnershipToStakingManager({ onSuccess }: BaseConsoleToolProps) {
  const { nativeStakingManagerAddress, erc20StakingManagerAddress } = useToolboxStore();
  const [activeStep, setActiveStep] = useState(0);

  // Prefer ERC20 if both are present
  const stakingManagerAddress = erc20StakingManagerAddress || nativeStakingManagerAddress;
  const stakingManagerType = erc20StakingManagerAddress ? "ERC20 Token" : "Native Token";

  // Generate dynamic code steps
  const codeSteps = getCodeSteps({
    validatorManagerAddress: "", // Will be filled by the TransferOwnership component
    stakingManagerAddress: stakingManagerAddress || "",
  });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
      {/* Left: Transfer Form */}
      <div className="flex flex-col rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
        <div className="flex-1 overflow-auto p-5 space-y-4">
          {stakingManagerAddress && (
            <Callout type="info">
              <p className="font-semibold mb-2">{stakingManagerType} Staking Manager Detected</p>
              <p>Your {stakingManagerType} Staking Manager address has been automatically filled in below:</p>
              <p className="mt-2">
                <code className="text-xs break-all">{stakingManagerAddress}</code>
              </p>
            </Callout>
          )}

          {!stakingManagerAddress && (
            <Callout type="warn">
              <p className="font-semibold mb-2">No Staking Manager Found</p>
              <p>No staking manager address found. Please deploy and initialize a Staking Manager first, or manually enter the address below.</p>
            </Callout>
          )}

          <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800">
            <h3 className="text-sm font-medium text-amber-900 dark:text-amber-100 mb-2">
              Why Transfer Ownership?
            </h3>
            <p className="text-xs text-amber-700 dark:text-amber-300 leading-relaxed">
              The Staking Manager needs ownership of the Validator Manager to register validators
              and manage the validator set. After transfer, only the Staking Manager contract
              can call protected functions like <code className="text-amber-800 dark:text-amber-200">initializeValidatorRegistration</code>.
            </p>
          </div>

          <TransferOwnership
            onSuccess={onSuccess}
            defaultNewOwnerAddress={stakingManagerAddress}
          />
        </div>
      </div>

      {/* Right: Code Viewer */}
      <StepCodeViewer
        activeStep={activeStep}
        steps={codeSteps}
        className="h-[600px]"
      />
    </div>
  );
}

export default withConsoleToolMetadata(TransferOwnershipToStakingManager, metadata);
