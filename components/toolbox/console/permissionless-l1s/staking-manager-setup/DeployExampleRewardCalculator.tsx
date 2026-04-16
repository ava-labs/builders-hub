'use client';

import { useToolboxStore, useViemChainStore } from '@/components/toolbox/stores/toolboxStore';
import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import { useChainPublicClient } from '@/components/toolbox/hooks/useChainPublicClient';
import { useState } from 'react';
import { Button } from '@/components/toolbox/components/Button';
import { Input } from '@/components/toolbox/components/Input';
import { WalletRequirementsConfigKey } from '@/components/toolbox/hooks/useWalletRequirements';
import {
  BaseConsoleToolProps,
  ConsoleToolMetadata,
  withConsoleToolMetadata,
} from '@/components/toolbox/components/WithConsoleToolMetadata';
import { useConnectedWallet } from '@/components/toolbox/contexts/ConnectedWalletContext';
import versions from '@/scripts/versions.json';
import useConsoleNotifications from '@/hooks/useConsoleNotifications';
import { generateConsoleToolGitHubUrl } from '@/components/toolbox/utils/githubUrl';
import { ContractDeployViewer, type ContractSource } from '@/components/console/contract-deploy-viewer';
import ExampleRewardCalculator from '@/contracts/icm-contracts/compiled/ExampleRewardCalculator.json';
import { Check, BookOpen } from 'lucide-react';
import Link from 'next/link';
import { ManualAddressInput } from '@/components/toolbox/console/permissioned-l1s/validator-manager-setup/ManualAddressInput';

const ICM_COMMIT = versions['ava-labs/icm-contracts'];

// GitHub raw URLs for source code
const CONTRACT_SOURCES: ContractSource[] = [
  {
    name: 'ExampleRewardCalculator',
    filename: 'ExampleRewardCalculator.sol',
    url: `https://raw.githubusercontent.com/ava-labs/icm-contracts/${ICM_COMMIT}/contracts/validator-manager/ExampleRewardCalculator.sol`,
    description:
      'Implements linear, non-compounding rewards. Rewards a set percentage of tokens per year based on stake duration.',
  },
  {
    name: 'IRewardCalculator',
    filename: 'IRewardCalculator.sol',
    url: `https://raw.githubusercontent.com/ava-labs/icm-contracts/${ICM_COMMIT}/contracts/validator-manager/interfaces/IRewardCalculator.sol`,
    description: 'Interface for reward calculators. Implement this to create custom reward strategies.',
  },
];

const metadata: ConsoleToolMetadata = {
  title: 'Deploy Example Reward Calculator',
  description: 'Deploy a reward calculator contract for calculating staking rewards',
  toolRequirements: [WalletRequirementsConfigKey.EVMChainBalance],
  githubUrl: generateConsoleToolGitHubUrl(import.meta.url),
};

function DeployExampleRewardCalculator({ onSuccess }: BaseConsoleToolProps) {
  const { rewardCalculatorAddress, setRewardCalculatorAddress } = useToolboxStore();
  const { walletEVMAddress } = useWalletStore();
  const chainPublicClient = useChainPublicClient();
  const { walletClient } = useConnectedWallet();
  const [isDeploying, setIsDeploying] = useState(false);
  const [rewardBasisPoints, setRewardBasisPoints] = useState<string>('500'); // Default 5% APR
  const viemChain = useViemChainStore();
  const { notify } = useConsoleNotifications();

  async function deployRewardCalculator() {
    setIsDeploying(true);
    setRewardCalculatorAddress('');

    if (!viemChain) throw new Error('Viem chain not found');
    await walletClient.addChain({ chain: viemChain });
    await walletClient.switchChain({ id: viemChain.id });

    const deployPromise = walletClient.deployContract({
      abi: ExampleRewardCalculator.abi as any,
      bytecode: ExampleRewardCalculator.bytecode.object as `0x${string}`,
      args: [BigInt(rewardBasisPoints)], // Constructor takes uint64 rewardBasisPoints
      chain: viemChain,
      account: walletEVMAddress as `0x${string}`,
    });

    notify({ type: 'deploy', name: 'ExampleRewardCalculator' }, deployPromise, viemChain ?? undefined);

    const hash = await deployPromise;
    const receipt = await chainPublicClient!.waitForTransactionReceipt({ hash });
    if (!receipt.contractAddress) {
      throw new Error('No contract address in receipt');
    }
    setRewardCalculatorAddress(receipt.contractAddress as string);
    setIsDeploying(false);
    onSuccess?.();
  }

  const isComplete = !!rewardCalculatorAddress;
  const aprPercentage = Number(rewardBasisPoints) / 100;

  return (
    <ContractDeployViewer contracts={CONTRACT_SOURCES}>
      <div className="flex flex-col rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
        <div className="p-5 space-y-4">
          {/* Configuration step */}
          <div
            className={`p-4 rounded-xl border transition-colors ${
              isComplete
                ? 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800'
                : 'bg-zinc-50 dark:bg-zinc-800/50 border-zinc-200 dark:border-zinc-700'
            }`}
          >
            <div className="flex items-start gap-3">
              <div
                className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-sm font-medium ${
                  isComplete
                    ? 'bg-green-500 text-white'
                    : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300'
                }`}
              >
                {isComplete ? <Check className="w-4 h-4" /> : '1'}
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
                        <span className="font-mono font-medium text-zinc-900 dark:text-zinc-100">{aprPercentage}%</span>
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
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <code className="px-2 py-1 rounded bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 font-mono text-xs">
                        {rewardCalculatorAddress.slice(0, 10)}...{rewardCalculatorAddress.slice(-6)}
                      </code>
                      <span className="text-xs text-green-600 dark:text-green-400">@ {aprPercentage}% APR</span>
                      <button
                        type="button"
                        onClick={() => {
                          setRewardCalculatorAddress('');
                        }}
                        className="px-2 py-1 text-xs font-medium text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 border border-zinc-200 dark:border-zinc-700 rounded-md hover:border-zinc-300 dark:hover:border-zinc-600 transition-colors"
                      >
                        Redeploy
                      </button>
                    </div>
                    <ManualAddressInput
                      value={rewardCalculatorAddress}
                      onChange={setRewardCalculatorAddress}
                      label="Or enter existing address"
                    />
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Button
                      variant="primary"
                      onClick={deployRewardCalculator}
                      loading={isDeploying}
                      disabled={isDeploying || !rewardBasisPoints || Number(rewardBasisPoints) <= 0}
                    >
                      Deploy Reward Calculator
                    </Button>
                    <ManualAddressInput
                      value={rewardCalculatorAddress}
                      onChange={setRewardCalculatorAddress}
                      label="Or enter existing address"
                    />
                  </div>
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
