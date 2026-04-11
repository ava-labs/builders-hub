'use client';

import ExampleERC20Mintable from '@/contracts/icm-contracts/compiled/ExampleERC20Mintable.json';
import { useToolboxStore } from '@/components/toolbox/stores/toolboxStore';
import { useState } from 'react';
import { Button } from '@/components/toolbox/components/Button';
import { generateConsoleToolGitHubUrl } from '@/components/toolbox/utils/githubUrl';
import { ConsoleToolMetadata, withConsoleToolMetadata } from '@/components/toolbox/components/WithConsoleToolMetadata';
import { WalletRequirementsConfigKey } from '@/components/toolbox/hooks/useWalletRequirements';
import { useContractDeployer } from '@/components/toolbox/hooks/contracts';
import { ManualAddressInput } from '@/components/toolbox/console/permissioned-l1s/validator-manager-setup/ManualAddressInput';
import { StepFlowCard } from '@/components/toolbox/components/StepCard';
import { SDKCodeViewer, type SDKCodeSource } from '@/components/console/sdk-code-viewer';
import versions from '@/scripts/versions.json';

const ICM_COMMIT = versions['ava-labs/icm-contracts'];

const DEPLOY_CODE = `import ExampleERC20Mintable from "./ExampleERC20Mintable.json";

// ExampleERC20Mintable uses OpenZeppelin AccessControl
// Deployer receives MINTER_ROLE and DEFAULT_ADMIN_ROLE
// 10M tokens minted to deployer on construction

const hash = await walletClient.deployContract({
  abi: ExampleERC20Mintable.abi,
  bytecode: ExampleERC20Mintable.bytecode,
  args: [],
});

const receipt = await publicClient.waitForTransactionReceipt({ hash });
const tokenAddress = receipt.contractAddress;`;

const SDK_SOURCES: SDKCodeSource[] = [
  {
    name: 'Deploy ERC20',
    filename: 'deployExampleERC20.ts',
    code: DEPLOY_CODE,
    description: 'Deploy an ERC20 token with AccessControl for staking reward minting.',
    githubUrl: `https://github.com/ava-labs/icm-contracts/tree/${ICM_COMMIT}`,
  },
];

const metadata: ConsoleToolMetadata = {
  title: 'Deploy Example ERC20 (Staking)',
  description:
    'Deploy an ERC20 token with AccessControl for staking. The deployer receives MINTER_ROLE and can grant it to the Staking Manager.',
  toolRequirements: [WalletRequirementsConfigKey.EVMChainBalance],
  githubUrl: generateConsoleToolGitHubUrl(import.meta.url),
};

function DeployStakingERC20() {
  const [criticalError, setCriticalError] = useState<Error | null>(null);
  const { exampleErc20Address, setExampleErc20Address } = useToolboxStore();
  const { deploy, isDeploying } = useContractDeployer();

  if (criticalError) {
    throw criticalError;
  }

  async function handleDeploy() {
    try {
      setExampleErc20Address('');
      const result = await deploy({
        abi: ExampleERC20Mintable.abi as any,
        bytecode: ExampleERC20Mintable.bytecode.object,
        args: [],
        name: 'ExampleERC20 (Mintable)',
      });

      setExampleErc20Address(result.contractAddress);
    } catch (error) {
      setCriticalError(error instanceof Error ? error : new Error(String(error)));
    }
  }

  const isComplete = !!exampleErc20Address;

  return (
    <SDKCodeViewer sources={SDK_SOURCES} height="auto">
      <div className="flex flex-col rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
        <div className="p-5 space-y-4">
          <StepFlowCard
            step={1}
            title="Deploy Example ERC20 Token"
            description="Deploys an ERC20 token with OpenZeppelin AccessControl. The deployer receives MINTER_ROLE and DEFAULT_ADMIN_ROLE, with 10M tokens minted to your wallet."
            isComplete={isComplete}
          >
            <div className="mt-3 space-y-2">
              {isComplete ? (
                <div className="flex items-center gap-2">
                  <code className="px-2 py-1 rounded bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 font-mono text-xs">
                    {exampleErc20Address.slice(0, 10)}...{exampleErc20Address.slice(-6)}
                  </code>
                  <button
                    type="button"
                    onClick={handleDeploy}
                    disabled={isDeploying}
                    className="px-2 py-1 text-xs font-medium text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 border border-zinc-200 dark:border-zinc-700 rounded-md hover:border-zinc-300 dark:hover:border-zinc-600 transition-colors"
                  >
                    Redeploy
                  </button>
                </div>
              ) : (
                <Button variant="primary" onClick={handleDeploy} loading={isDeploying} disabled={isDeploying}>
                  Deploy ERC20 Token
                </Button>
              )}
              <ManualAddressInput
                value={exampleErc20Address || ''}
                onChange={setExampleErc20Address}
                label="Or enter existing address"
              />
            </div>
          </StepFlowCard>
        </div>

        <div className="shrink-0 px-5 py-3 border-t border-zinc-200/80 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 flex items-center justify-between mt-auto">
          <span className="text-xs text-zinc-500">ExampleERC20Mintable</span>
          <a
            href={`https://github.com/ava-labs/icm-contracts/tree/${ICM_COMMIT}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 font-mono transition-colors"
          >
            @{ICM_COMMIT.slice(0, 7)}
          </a>
        </div>
      </div>
    </SDKCodeViewer>
  );
}

export default withConsoleToolMetadata(DeployStakingERC20, metadata);
