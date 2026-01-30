"use client";

import { useToolboxStore, useViemChainStore } from "@/components/toolbox/stores/toolboxStore";
import { useWalletStore } from "@/components/toolbox/stores/walletStore";
import { useState } from "react";
import { Button } from "@/components/toolbox/components/Button";
import ValidatorManagerABI from "@/contracts/icm-contracts/compiled/ValidatorManager.json";
import ValidatorMessagesABI from "@/contracts/icm-contracts/compiled/ValidatorMessages.json";
import { WalletRequirementsConfigKey } from "@/components/toolbox/hooks/useWalletRequirements";
import { BaseConsoleToolProps, ConsoleToolMetadata, withConsoleToolMetadata } from "../../../components/WithConsoleToolMetadata";
import { useConnectedWallet } from "@/components/toolbox/contexts/ConnectedWalletContext";
import versions from "@/scripts/versions.json";
import useConsoleNotifications from "@/hooks/useConsoleNotifications";
import { generateConsoleToolGitHubUrl } from "@/components/toolbox/utils/github-url";
import { getLinkedBytecode } from "@/components/toolbox/utils/contract-deployment";
import { ContractDeployViewer, type ContractSource } from "@/components/console/contract-deploy-viewer";
import { Check, BookOpen, GraduationCap } from "lucide-react";
import Link from "next/link";

const ICM_COMMIT = versions["ava-labs/icm-contracts"];

// GitHub raw URLs for source code
const CONTRACT_SOURCES: ContractSource[] = [
  {
    name: "ValidatorManager",
    filename: "ValidatorManager.sol",
    url: `https://raw.githubusercontent.com/ava-labs/icm-contracts/${ICM_COMMIT}/contracts/validator-manager/ValidatorManager.sol`,
    description: "Core contract for managing L1 validators. Emits ICM messages to update the validator set on P-Chain.",
  },
  {
    name: "ValidatorMessages",
    filename: "ValidatorMessages.sol",
    url: `https://raw.githubusercontent.com/ava-labs/icm-contracts/${ICM_COMMIT}/contracts/validator-manager/ValidatorMessages.sol`,
    description: "Library for encoding/decoding validator management messages sent via ICM.",
  },
];

const metadata: ConsoleToolMetadata = {
  title: "Deploy Validator Contracts",
  description: "Deploy the ValidatorMessages library and ValidatorManager contract",
  toolRequirements: [WalletRequirementsConfigKey.EVMChainBalance],
  githubUrl: generateConsoleToolGitHubUrl(import.meta.url),
};

function DeployValidatorContracts({ onSuccess }: BaseConsoleToolProps) {
  const {
    validatorMessagesLibAddress,
    setValidatorMessagesLibAddress,
    setValidatorManagerAddress,
    validatorManagerAddress,
  } = useToolboxStore();
  const { publicClient, walletEVMAddress } = useWalletStore();
  const { coreWalletClient } = useConnectedWallet();
  const [isDeployingMessages, setIsDeployingMessages] = useState(false);
  const [isDeployingManager, setIsDeployingManager] = useState(false);
  const viemChain = useViemChainStore();
  const { notify } = useConsoleNotifications();

  const getLinkedValidatorManagerBytecode = () => {
    if (!validatorMessagesLibAddress) {
      throw new Error("ValidatorMessages library must be deployed first");
    }
    return getLinkedBytecode(ValidatorManagerABI.bytecode, validatorMessagesLibAddress);
  };

  async function deployValidatorMessages() {
    setIsDeployingMessages(true);
    setValidatorMessagesLibAddress("");

    if (!viemChain) throw new Error("Viem chain not found");
    await coreWalletClient.addChain({ chain: viemChain });
    await coreWalletClient.switchChain({ id: viemChain.id });

    const deployPromise = coreWalletClient.deployContract({
      abi: ValidatorMessagesABI.abi as any,
      bytecode: ValidatorMessagesABI.bytecode.object as `0x${string}`,
      args: [],
      chain: viemChain,
      account: walletEVMAddress as `0x${string}`,
    });

    notify({ type: "deploy", name: "ValidatorMessages Library" }, deployPromise, viemChain ?? undefined);

    const hash = await deployPromise;
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    if (!receipt.contractAddress) {
      throw new Error("No contract address in receipt");
    }
    setValidatorMessagesLibAddress(receipt.contractAddress as string);
    setIsDeployingMessages(false);
  }

  async function deployValidatorManager() {
    setIsDeployingManager(true);
    setValidatorManagerAddress("");

    if (!viemChain) throw new Error("Viem chain not found");
    await coreWalletClient.addChain({ chain: viemChain });
    await coreWalletClient.switchChain({ id: viemChain.id });

    const deployPromise = coreWalletClient.deployContract({
      abi: ValidatorManagerABI.abi as any,
      bytecode: getLinkedValidatorManagerBytecode(),
      args: [0],
      chain: viemChain,
      account: walletEVMAddress as `0x${string}`,
    });

    notify({ type: "deploy", name: "ValidatorManager" }, deployPromise, viemChain ?? undefined);

    const hash = await deployPromise;
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    if (!receipt.contractAddress) {
      throw new Error("No contract address in receipt");
    }
    setValidatorManagerAddress(receipt.contractAddress as string);
    setIsDeployingManager(false);
    onSuccess?.();
  }

  const step1Complete = !!validatorMessagesLibAddress;
  const step2Complete = !!validatorManagerAddress;

  return (
    <ContractDeployViewer contracts={CONTRACT_SOURCES}>
      <div className="flex flex-col h-[500px] rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
        {/* Scrollable content area */}
        <div className="flex-1 overflow-auto p-5 space-y-4">
          {/* Step 1: Deploy Library */}
          <div
            className={`p-4 rounded-xl border transition-colors ${
              step1Complete
                ? "bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800"
                : "bg-zinc-50 dark:bg-zinc-800/50 border-zinc-200 dark:border-zinc-700"
            }`}
          >
            <div className="flex items-start gap-3">
              <div
                className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-sm font-medium ${
                  step1Complete
                    ? "bg-green-500 text-white"
                    : "bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300"
                }`}
              >
                {step1Complete ? <Check className="w-4 h-4" /> : "1"}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  Deploy ValidatorMessages Library
                </h3>
                <p className="mt-1.5 text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                  Shared library for message encoding/decoding with P-Chain. Handles validator
                  registration messages and responses.
                </p>

                {step1Complete ? (
                  <div className="mt-3 flex items-center gap-2">
                    <code className="px-2 py-1 rounded bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 font-mono text-xs">
                      {validatorMessagesLibAddress.slice(0, 10)}...{validatorMessagesLibAddress.slice(-6)}
                    </code>
                  </div>
                ) : (
                  <Button
                    variant="primary"
                    onClick={deployValidatorMessages}
                    loading={isDeployingMessages}
                    disabled={isDeployingMessages}
                    className="mt-3"
                  >
                    Deploy Library
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Step 2: Deploy Manager */}
          <div
            className={`p-4 rounded-xl border transition-colors ${
              step2Complete
                ? "bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800"
                : step1Complete
                ? "bg-zinc-50 dark:bg-zinc-800/50 border-zinc-200 dark:border-zinc-700"
                : "bg-zinc-50/50 dark:bg-zinc-800/20 border-zinc-200/50 dark:border-zinc-800 opacity-50"
            }`}
          >
            <div className="flex items-start gap-3">
              <div
                className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-sm font-medium ${
                  step2Complete
                    ? "bg-green-500 text-white"
                    : step1Complete
                    ? "bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300"
                    : "bg-zinc-200/50 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-600"
                }`}
              >
                {step2Complete ? <Check className="w-4 h-4" /> : "2"}
              </div>
              <div className="flex-1 min-w-0">
                <h3
                  className={`text-sm font-medium ${
                    step1Complete ? "text-zinc-900 dark:text-zinc-100" : "text-zinc-400 dark:text-zinc-600"
                  }`}
                >
                  Deploy ValidatorManager Contract
                </h3>
                <p
                  className={`mt-1.5 text-xs leading-relaxed ${
                    step1Complete ? "text-zinc-600 dark:text-zinc-400" : "text-zinc-400 dark:text-zinc-600"
                  }`}
                >
                  Core contract implementing{" "}
                  <Link
                    href="/docs/acps/99-validatorsetmanager-contract"
                    className="text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    ACP-99
                  </Link>{" "}
                  for validator lifecycle management. Part of{" "}
                  <Link
                    href="/docs/acps/77-reinventing-subnets"
                    className="text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    ACP-77
                  </Link>{" "}
                  architecture.
                </p>

                {step2Complete ? (
                  <div className="mt-3 flex items-center gap-2">
                    <code className="px-2 py-1 rounded bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 font-mono text-xs">
                      {validatorManagerAddress.slice(0, 10)}...{validatorManagerAddress.slice(-6)}
                    </code>
                  </div>
                ) : (
                  <Button
                    variant="primary"
                    onClick={deployValidatorManager}
                    loading={isDeployingManager}
                    disabled={isDeployingManager || !step1Complete}
                    className="mt-3"
                  >
                    Deploy Contract
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Fixed footer */}
        <div className="shrink-0 px-5 py-4 border-t border-zinc-200/80 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Link
                href="/docs/avalanche-l1s/validator-manager/contract"
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors"
              >
                <BookOpen className="w-3.5 h-3.5" />
                Docs
              </Link>
              <Link
                href="/academy/avalanche-l1/permissioned-l1s/validator-manager-deployment"
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors"
              >
                <GraduationCap className="w-3.5 h-3.5" />
                Academy
              </Link>
            </div>
            <a
              href={`https://github.com/ava-labs/icm-contracts/tree/${ICM_COMMIT}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 font-mono transition-colors"
            >
              @{ICM_COMMIT.slice(0, 7)}
            </a>
          </div>
        </div>
      </div>
    </ContractDeployViewer>
  );
}

export default withConsoleToolMetadata(DeployValidatorContracts, metadata);
