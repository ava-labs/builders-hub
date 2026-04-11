'use client';

import { useState } from 'react';
import { useToolboxStore } from '@/components/toolbox/stores/toolboxStore';
import { TransferOwnership } from '@/components/toolbox/console/permissioned-l1s/multisig-setup/TransferOwnership';
import {
  ConsoleToolMetadata,
  withConsoleToolMetadata,
  BaseConsoleToolProps,
} from '../../../components/WithConsoleToolMetadata';
import { generateConsoleToolGitHubUrl } from '@/components/toolbox/utils/githubUrl';
import { WalletRequirementsConfigKey } from '@/components/toolbox/hooks/useWalletRequirements';
import { ContractDeployViewer, type ContractSource } from '@/components/console/contract-deploy-viewer';
import { StepFlowCard } from '@/components/toolbox/components/StepCard';
import { Alert } from '@/components/toolbox/components/Alert';
import versions from '@/scripts/versions.json';

const ICM_COMMIT = versions['ava-labs/icm-contracts'];

const metadata: ConsoleToolMetadata = {
  title: 'Transfer Ownership to Staking Manager',
  description: 'Transfer the ownership of the Validator Manager to your deployed Staking Manager',
  toolRequirements: [WalletRequirementsConfigKey.EVMChainBalance],
  githubUrl: generateConsoleToolGitHubUrl(import.meta.url),
};

const CONTRACT_SOURCES: ContractSource[] = [
  {
    name: 'ValidatorManager',
    filename: 'ValidatorManager.sol',
    url: `https://raw.githubusercontent.com/ava-labs/icm-contracts/${ICM_COMMIT}/contracts/validator-manager/ValidatorManager.sol`,
    description: 'Inherited by staking managers. transferOwnership() grants control of the validator set.',
  },
];

function TransferOwnershipToStakingManager({ onSuccess }: BaseConsoleToolProps) {
  const { nativeStakingManagerAddress, erc20StakingManagerAddress } = useToolboxStore();
  const [transferComplete, setTransferComplete] = useState(false);

  // Prefer ERC20 if both are present
  const stakingManagerAddress = erc20StakingManagerAddress || nativeStakingManagerAddress;
  const stakingManagerType = erc20StakingManagerAddress ? 'ERC20 Token' : 'Native Token';

  function handleTransferSuccess() {
    setTransferComplete(true);
    onSuccess?.();
  }

  return (
    <ContractDeployViewer contracts={CONTRACT_SOURCES}>
      <div className="flex flex-col rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
        <div className="p-5 space-y-4">
          <StepFlowCard
            step={1}
            title="Transfer Ownership to Staking Manager"
            description="The Staking Manager needs ownership of the Validator Manager to register validators and manage the validator set."
            isComplete={transferComplete}
          >
            {stakingManagerAddress && (
              <div className="mt-2">
                <span className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">
                  {stakingManagerType} Staking Manager:{' '}
                </span>
                <code className="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-mono text-xs break-all">
                  {stakingManagerAddress}
                </code>
              </div>
            )}
          </StepFlowCard>

          {!stakingManagerAddress && (
            <Alert variant="warning">No staking manager address found. Deploy and initialize first.</Alert>
          )}

          <TransferOwnership onSuccess={handleTransferSuccess} defaultNewOwnerAddress={stakingManagerAddress} />
        </div>

        {/* Footer */}
        <div className="shrink-0 px-5 py-3 border-t border-zinc-200/80 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 flex items-center justify-between mt-auto">
          <span className="text-xs text-zinc-500">Calls transferOwnership(newOwner)</span>
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
    </ContractDeployViewer>
  );
}

export default withConsoleToolMetadata(TransferOwnershipToStakingManager, metadata);
