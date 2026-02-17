"use client";

import { useToolboxStore, useViemChainStore } from "@/components/toolbox/stores/toolboxStore";
import { useWalletStore } from "@/components/toolbox/stores/walletStore";
import { useState } from "react";
import { Button } from "@/components/toolbox/components/Button";
import { Input } from "@/components/toolbox/components/Input";
import { WalletRequirementsConfigKey } from "@/components/toolbox/hooks/useWalletRequirements";
import { BaseConsoleToolProps, ConsoleToolMetadata, withConsoleToolMetadata } from '../../../components/WithConsoleToolMetadata';
import { useConnectedWallet } from "@/components/toolbox/contexts/ConnectedWalletContext";
import versions from "@/scripts/versions.json";
import useConsoleNotifications from "@/hooks/useConsoleNotifications";
import { generateConsoleToolGitHubUrl } from "@/components/toolbox/utils/github-url";
import { ContractDeployViewer, type ContractSource } from "@/components/console/contract-deploy-viewer";
import ExampleRewardCalculator from "@/contracts/icm-contracts/compiled/ExampleRewardCalculator.json";
import { Check, BookOpen, Calculator } from "lucide-react";
import Link from "next/link";

const ICM_COMMIT = versions["ava-labs/icm-contracts"];

// GitHub raw URLs for source code
const CONTRACT_SOURCES: ContractSource[] = [
  {
    name: "ExampleRewardCalculator",
    filename: "ExampleRewardCalculator.sol",
    url: `https://raw.githubusercontent.com/ava-labs/icm-contracts/${ICM_COMMIT}/contracts/validator-manager/ExampleRewardCalculator.sol`,
    description: "Implements linear, non-compounding rewards. Rewards a set percentage of tokens per year based on stake duration.",
  },
  {
    name: "IRewardCalculator",
    filename: "IRewardCalculator.sol",
    url: `https://raw.githubusercontent.com/ava-labs/icm-contracts/${ICM_COMMIT}/contracts/validator-manager/interfaces/IRewardCalculator.sol`,
    description: "Interface for reward calculators. Implement this to create custom reward strategies.",
  },
];

const metadata: ConsoleToolMetadata = {
  title: "Deploy Example Reward Calculator",
  description: "Deploy a reward calculator contract for calculating staking rewards",
  toolRequirements: [WalletRequirementsConfigKey.EVMChainBalance],
  githubUrl: generateConsoleToolGitHubUrl(import.meta.url),
};

function DeployExampleRewardCalculator({ onSuccess }: BaseConsoleToolProps) {
  const { rewardCalculatorAddress, setRewardCalculatorAddress } = useToolboxStore();
  const { publicClient, walletEVMAddress } = useWalletStore();
  const { coreWalletClient } = useConnectedWallet();
  const [isDeploying, setIsDeploying] = useState(false);
  const [rewardBasisPoints, setRewardBasisPoints] = useState<string>("500"); // Default 5% APR
  const viemChain = useViemChainStore();
  const { notify } = useConsoleNotifications();

  async function deployRewardCalculator() {
    setIsDeploying(true);
    setRewardCalculatorAddress("");

    if (!viemChain) throw new Error("Viem chain not found");
    await coreWalletClient.addChain({ chain: viemChain });
    await coreWalletClient.switchChain({ id: viemChain.id });

    const deployPromise = coreWalletClient.deployContract({
      abi: ExampleRewardCalculator.abi as any,
      bytecode: ExampleRewardCalculator.bytecode.object as `0x${string}`,
      args: [BigInt(rewardBasisPoints)], // Constructor takes uint64 rewardBasisPoints
      chain: viemChain,
      account: walletEVMAddress as `0x${string}`,
    });

    notify({ type: "deploy", name: "ExampleRewardCalculator" }, deployPromise, viemChain ?? undefined);

    const hash = await deployPromise;
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    if (!receipt.contractAddress) {
      throw new Error("No contract address in receipt");
    }
    setRewardCalculatorAddress(receipt.contractAddress as string);
    setIsDeploying(false);
    onSuccess?.();
  }

  const isComplete = !!rewardCalculatorAddress;
  const aprPercentage = Number(rewardBasisPoints) / 100;

  return (
    <ContractDeployViewer contracts={CONTRACT_SOURCES}>
      <div className="flex flex-col h-[500px] rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
        {/* Scrollable content area */}
        <div className="flex-1 overflow-auto p-5 space-y-4">
          {/* Info section */}
          <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800">
            <div className="flex items-start gap-3">
              <Calculator className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-medium text-blue-900 dark:text-blue-100">
                  About Reward Calculators
                </h3>
                <p className="mt-1.5 text-xs text-blue-700 dark:text-blue-300 leading-relaxed">
                  Reward calculators determine how staking rewards are distributed. The example calculator
                  implements a simple linear, non-compounding reward formula based on stake duration.
                </p>
              </div>
            </div>
          </div>

          {/* Configuration step */}
          <div
            className={`p-4 rounded-xl border transition-colors ${
              isComplete
                ? "bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800"
                : "bg-zinc-50 dark:bg-zinc-800/50 border-zinc-200 dark:border-zinc-700"
            }`}
          >
            <div className="flex items-start gap-3">
              <div
                className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-sm font-medium ${
                  isComplete
                    ? "bg-green-500 text-white"
                    : "bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300"
                }`}
              >
                {isComplete ? <Check className="w-4 h-4" /> : "1"}
              </div>
              <div className="flex-1 min-w-0 space-y-4">
                <div>
                  <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    Configure & Deploy Reward Calculator
                  </h3>
                  <p className="mt-1.5 text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                    Set the annual reward rate and deploy the contract.
                  </p>
                </div>

                {!isComplete && (
                  <div className="space-y-3">
                    <div>
                      <Input
                        label="Reward Rate (basis points)"
                        value={rewardBasisPoints}
                        onChange={setRewardBasisPoints}
                        type="number"
                        min="0"
                        max="10000"
                        disabled={isDeploying}
                        placeholder="500"
                        helperText={`${aprPercentage}% APR (100 basis points = 1%)`}
                      />
                    </div>

                    {/* APR preview */}
                    <div className="p-3 rounded-lg bg-zinc-100 dark:bg-zinc-800">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-zinc-600 dark:text-zinc-400">Annual Percentage Rate:</span>
                        <span className="font-mono font-medium text-zinc-900 dark:text-zinc-100">
                          {aprPercentage}%
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs mt-1">
                        <span className="text-zinc-600 dark:text-zinc-400">Per 1000 tokens staked:</span>
                        <span className="font-mono font-medium text-zinc-900 dark:text-zinc-100">
                          +{(aprPercentage * 10).toFixed(2)} tokens/year
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {isComplete ? (
                  <div className="flex items-center gap-2">
                    <code className="px-2 py-1 rounded bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 font-mono text-xs">
                      {rewardCalculatorAddress.slice(0, 10)}...{rewardCalculatorAddress.slice(-6)}
                    </code>
                    <span className="text-xs text-green-600 dark:text-green-400">
                      @ {aprPercentage}% APR
                    </span>
                  </div>
                ) : (
                  <Button
                    variant="primary"
                    onClick={deployRewardCalculator}
                    loading={isDeploying}
                    disabled={isDeploying || !rewardBasisPoints || Number(rewardBasisPoints) <= 0}
                  >
                    Deploy Reward Calculator
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
                href="/docs/avalanche-l1s/validator-manager/native-token-staking"
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors"
              >
                <BookOpen className="w-3.5 h-3.5" />
                Docs
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

export default withConsoleToolMetadata(DeployExampleRewardCalculator, metadata);
