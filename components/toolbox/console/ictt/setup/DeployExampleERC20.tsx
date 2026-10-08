'use client';

import ExampleERC20 from '@/contracts/icm-contracts/compiled/ExampleERC20.json';
import { useToolboxStore } from '@/components/toolbox/stores/toolboxStore';
import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import { useState } from 'react';
import { Button } from '@/components/toolbox/components/Button';
import { Success } from '@/components/toolbox/components/Success';
import { generateConsoleToolGitHubUrl } from '@/components/toolbox/utils/githubUrl';
import { ExternalLink } from 'lucide-react';
import { ConsoleToolMetadata, withConsoleToolMetadata } from '@/components/toolbox/components/WithConsoleToolMetadata';
import { WalletRequirementsConfigKey } from '@/components/toolbox/hooks/useWalletRequirements';
import { useContractDeployer } from '@/components/toolbox/hooks/contracts';
import versions from '@/scripts/versions.json';
import { ContractDeployViewer, type ContractSource } from '@/components/console/contract-deploy-viewer';
import { BODY } from '../bridge/ui';

const ICM_COMMIT = versions['ava-labs/icm-services'];

const CONTRACT_SOURCES: ContractSource[] = [
  {
    name: 'ExampleERC20',
    filename: 'ExampleERC20.sol',
    url: `https://raw.githubusercontent.com/ava-labs/icm-services/${ICM_COMMIT}/contracts/mocks/ExampleERC20.sol`,
    description: 'Mock ERC20 token with 1M supply minted to deployer, for testing ICTT transfers.',
  },
];

const metadata: ConsoleToolMetadata = {
  title: 'Deploy Example ERC20',
  description: 'Deploy an ERC20 token contract for testing. If you already have a token, you can skip this step.',
  toolRequirements: [WalletRequirementsConfigKey.EVMChainBalance],
  githubUrl: generateConsoleToolGitHubUrl(import.meta.url),
};

function DeployExampleERC20() {
  const [criticalError, setCriticalError] = useState<Error | null>(null);
  const { exampleErc20Address, setExampleErc20Address } = useToolboxStore();
  const { walletChainId } = useWalletStore();
  const { deploy, isDeploying } = useContractDeployer();
  // Throw critical errors during render
  if (criticalError) {
    throw criticalError;
  }

  async function handleDeploy() {
    try {
      const result = await deploy({
        abi: ExampleERC20.abi as any,
        bytecode: ExampleERC20.bytecode.object,
        args: [],
        name: 'ExampleERC20',
      });

      setExampleErc20Address(result.contractAddress);
    } catch (error) {
      setCriticalError(error instanceof Error ? error : new Error(String(error)));
    }
  }

  return (
    <ContractDeployViewer contracts={CONTRACT_SOURCES}>
      <div className="not-prose flex flex-col gap-4">
        <div className={`${BODY} flex flex-col gap-2`}>
          <p>
            Deploys an ERC-20 test token on the connected network (chain ID{' '}
            <code className="font-mono text-[12px] text-zinc-900 dark:text-zinc-100">{walletChainId}</code>) and mints
            its full supply of 1,000,000 to your wallet. Use it to try token transfers.
          </p>
          <p>
            For a custom ERC-20, use the{' '}
            <a
              href="https://wizard.openzeppelin.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="group/act inline-flex items-center gap-1 font-medium text-zinc-900 underline decoration-zinc-300 underline-offset-4 transition-colors hover:decoration-zinc-900 dark:text-zinc-100 dark:decoration-zinc-600 dark:hover:decoration-zinc-100"
            >
              OpenZeppelin Contract Wizard
              <ExternalLink className="h-3 w-3 text-zinc-400 transition-colors group-hover/act:text-[#E6212F]" />
            </a>
            .
          </p>
        </div>

        <Button
          variant={exampleErc20Address ? 'secondary' : 'primary'}
          onClick={handleDeploy}
          loading={isDeploying}
          disabled={isDeploying}
        >
          {exampleErc20Address ? 'Re-Deploy ERC20 Token' : 'Deploy ERC20 Token'}
        </Button>

        <Success label="ERC20 Token Address" value={exampleErc20Address || ''} />
      </div>
    </ContractDeployViewer>
  );
}

export default withConsoleToolMetadata(DeployExampleERC20, metadata);
