'use client';

import { useSelectedL1, useSetTeleporterRegistryAddress } from '@/components/toolbox/stores/l1ListStore';
import { useToolboxStore, useViemChainStore } from '@/components/toolbox/stores/toolboxStore';
import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import { useState } from 'react';
import TeleporterRegistryBytecode from '@/contracts/icm-contracts-releases/v1.0.0/TeleporterRegistry_Bytecode_v1.0.0.txt.json';
import TeleporterMessengerAddress from '@/contracts/icm-contracts-releases/v1.0.0/TeleporterMessenger_Contract_Address_v1.0.0.txt.json';
import TeleporterRegistryManualyCompiled from '@/contracts/icm-contracts/compiled/TeleporterRegistry.json';
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
import { ContractDeployViewer, ContractSource } from '@/components/console/contract-deploy-viewer';
import { Button } from '@/components/toolbox/components/Button';
import { Success } from '@/components/toolbox/components/Success';
import { CopyValue, DocsLink, Fact, Facts, Panel } from '@/components/toolbox/console/icm/ui';

const ICM_COMMIT = versions['ava-labs/icm-services'];

const CONTRACT_SOURCES: ContractSource[] = [
  {
    name: 'TeleporterRegistry',
    filename: 'TeleporterRegistry.sol',
    url: `https://raw.githubusercontent.com/ava-labs/icm-services/${ICM_COMMIT}/contracts/teleporter/registry/TeleporterRegistry.sol`,
    description: 'Registry contract for versioned Teleporter protocol management',
  },
  {
    name: 'TeleporterRegistryApp',
    filename: 'TeleporterRegistryApp.sol',
    url: `https://raw.githubusercontent.com/ava-labs/icm-services/${ICM_COMMIT}/contracts/teleporter/registry/TeleporterRegistryApp.sol`,
    description: 'Base contract for apps that use the Teleporter Registry',
  },
];

const metadata: ConsoleToolMetadata = {
  title: 'Deploy ICM Registry',
  description: 'Deploy the ICM Registry contract to your L1',
  toolRequirements: [WalletRequirementsConfigKey.EVMChainBalance],
  githubUrl: generateConsoleToolGitHubUrl(import.meta.url),
};

function TeleporterRegistry({ onSuccess }: BaseConsoleToolProps) {
  const [criticalError, setCriticalError] = useState<Error | null>(null);
  const { setTeleporterRegistryAddress, teleporterRegistryAddress } = useToolboxStore();
  const setTeleporterRegistryOnL1 = useSetTeleporterRegistryAddress();
  const { publicClient, walletEVMAddress } = useWalletStore();
  const { walletClient } = useConnectedWallet();
  const [isDeploying, setIsDeploying] = useState(false);
  const viemChain = useViemChainStore();
  const selectedL1 = useSelectedL1();
  const { notify } = useConsoleNotifications();

  if (criticalError) {
    throw criticalError;
  }

  const messengerAddress = TeleporterMessengerAddress.content.trim();

  async function handleDeploy() {
    setIsDeploying(true);
    setTeleporterRegistryAddress('');
    try {
      const deployPromise = walletClient.deployContract({
        bytecode: TeleporterRegistryBytecode.content.trim() as `0x${string}`,
        abi: TeleporterRegistryManualyCompiled.abi as any,
        args: [[{ version: 1n, protocolAddress: messengerAddress }]],
        account: walletEVMAddress as `0x${string}`,
        chain: viemChain,
      });
      notify(
        {
          type: 'deploy',
          name: 'TeleporterRegistry',
        },
        deployPromise,
        viemChain ?? undefined,
      );

      const hash = await deployPromise;
      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      if (!receipt.contractAddress) {
        throw new Error('No contract address in receipt');
      }

      setTeleporterRegistryAddress(receipt.contractAddress);
      // Propagate the registry into the L1ListStore so downstream surfaces
      // (ICTT bridge inspectors, My L1 dashboard's setup-progress bar) see
      // ICM as configured for this L1 without having to know about
      // `toolboxStore`. Single source of truth: `wellKnownTeleporterRegistryAddress`.
      setTeleporterRegistryOnL1(receipt.contractAddress);
      onSuccess?.();
    } catch (error) {
      setCriticalError(error instanceof Error ? error : new Error(String(error)));
    } finally {
      setIsDeploying(false);
    }
  }

  const deployForm = (
    <Panel
      eyebrow="Registry"
      title="Deploy TeleporterRegistry"
      description="Tracks Teleporter versions so apps can move to a new version without breaking older messages."
      footer={
        <>
          <DocsLink href="https://github.com/ava-labs/icm-services/tree/main/icm-contracts/avalanche/teleporter/registry">
            Registry docs
          </DocsLink>
          <span className="font-mono text-[10.5px] text-zinc-400 dark:text-zinc-500">@{ICM_COMMIT.slice(0, 7)}</span>
        </>
      }
    >
      <Facts>
        <Fact label="Target network">
          <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span>{selectedL1?.name || 'Unknown'}</span>
            <span className="font-mono text-[11.5px] text-zinc-500 dark:text-zinc-400">
              Chain ID {selectedL1?.evmChainId}
            </span>
          </span>
        </Fact>
        <Fact label="Messenger arg">
          <CopyValue value={messengerAddress} />
        </Fact>
        <Fact label="Initial version">
          <span className="font-mono">1</span>
        </Fact>
      </Facts>

      {teleporterRegistryAddress ? (
        <>
          <Success label="Registry address" value={teleporterRegistryAddress} confirmed />
          <Button variant="outline" onClick={handleDeploy} loading={isDeploying} loadingText="Deploying">
            Redeploy registry
          </Button>
        </>
      ) : (
        <Button onClick={handleDeploy} loading={isDeploying} loadingText="Deploying">
          Deploy TeleporterRegistry
        </Button>
      )}
    </Panel>
  );

  return <ContractDeployViewer contracts={CONTRACT_SOURCES}>{deployForm}</ContractDeployViewer>;
}

export default withConsoleToolMetadata(TeleporterRegistry, metadata);
