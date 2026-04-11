'use client';

import ExampleERC20Mintable from '@/contracts/icm-contracts/compiled/ExampleERC20Mintable.json';
import { useToolboxStore } from '@/components/toolbox/stores/toolboxStore';
import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import { useState } from 'react';
import { Button } from '@/components/toolbox/components/Button';
import { Success } from '@/components/toolbox/components/Success';
import { generateConsoleToolGitHubUrl } from '@/components/toolbox/utils/githubUrl';
import { ConsoleToolMetadata, withConsoleToolMetadata } from '@/components/toolbox/components/WithConsoleToolMetadata';
import { WalletRequirementsConfigKey } from '@/components/toolbox/hooks/useWalletRequirements';
import { useContractDeployer } from '@/components/toolbox/hooks/contracts';

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
  const { walletChainId } = useWalletStore();
  const { deploy, isDeploying } = useContractDeployer();

  if (criticalError) {
    throw criticalError;
  }

  async function handleDeploy() {
    try {
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

  return (
    <div className="space-y-4">
      <div className="text-sm text-zinc-600 dark:text-zinc-400">
        This deploys an ERC20 token with <strong>OpenZeppelin AccessControl</strong> on your connected network (Chain
        ID: <code>{walletChainId}</code>). The deployer receives the <code>MINTER_ROLE</code> and{' '}
        <code>DEFAULT_ADMIN_ROLE</code>, with 10M tokens minted to your wallet. You must grant <code>MINTER_ROLE</code>{' '}
        to the Staking Manager in the next step for reward minting to work.
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
  );
}

export default withConsoleToolMetadata(DeployStakingERC20, metadata);
