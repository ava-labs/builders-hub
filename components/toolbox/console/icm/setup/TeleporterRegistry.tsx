"use client";

import { useSelectedL1 } from "@/components/toolbox/stores/l1ListStore";
import { useToolboxStore, useViemChainStore } from "@/components/toolbox/stores/toolboxStore";
import { useWalletStore } from "@/components/toolbox/stores/walletStore";
import { useState } from "react";
import TeleporterRegistryBytecode from '@/contracts/icm-contracts-releases/v1.0.0/TeleporterRegistry_Bytecode_v1.0.0.txt.json';
import TeleporterMessengerAddress from '@/contracts/icm-contracts-releases/v1.0.0/TeleporterMessenger_Contract_Address_v1.0.0.txt.json';
import TeleporterRegistryManualyCompiled from '@/contracts/icm-contracts/compiled/TeleporterRegistry.json';
import { WalletRequirementsConfigKey } from "@/components/toolbox/hooks/useWalletRequirements";
import { BaseConsoleToolProps, ConsoleToolMetadata, withConsoleToolMetadata } from "../../../components/WithConsoleToolMetadata";
import { useConnectedWallet } from "@/components/toolbox/contexts/ConnectedWalletContext";
import versions from '@/scripts/versions.json';
import useConsoleNotifications from "@/hooks/useConsoleNotifications";
import { generateConsoleToolGitHubUrl } from "@/components/toolbox/utils/github-url";
import { ContractDeployViewer, ContractSource } from "@/components/console/contract-deploy-viewer";
import { Check, Rocket, ExternalLink, Copy, Info, FileCode } from "lucide-react";

const ICM_COMMIT = versions["ava-labs/icm-contracts"];

const CONTRACT_SOURCES: ContractSource[] = [
  {
    name: "TeleporterRegistry",
    filename: "TeleporterRegistry.sol",
    url: `https://raw.githubusercontent.com/ava-labs/icm-contracts/${ICM_COMMIT}/contracts/teleporter/registry/TeleporterRegistry.sol`,
    description: "Registry contract for versioned Teleporter protocol management",
  },
  {
    name: "TeleporterRegistryApp",
    filename: "TeleporterRegistryApp.sol",
    url: `https://raw.githubusercontent.com/ava-labs/icm-contracts/${ICM_COMMIT}/contracts/teleporter/registry/TeleporterRegistryApp.sol`,
    description: "Base contract for apps that use the Teleporter Registry",
  },
];

const metadata: ConsoleToolMetadata = {
  title: "Deploy ICM Registry",
  description: "Deploy the ICM Registry contract to your L1",
  toolRequirements: [
    WalletRequirementsConfigKey.EVMChainBalance
  ],
  githubUrl: generateConsoleToolGitHubUrl(import.meta.url)
};

function TeleporterRegistry({ onSuccess }: BaseConsoleToolProps) {
  const [criticalError, setCriticalError] = useState<Error | null>(null);
  const { setTeleporterRegistryAddress, teleporterRegistryAddress } = useToolboxStore();
  const { publicClient, walletEVMAddress } = useWalletStore();
  const { coreWalletClient } = useConnectedWallet();
  const [isDeploying, setIsDeploying] = useState(false);
  const viemChain = useViemChainStore();
  const selectedL1 = useSelectedL1()();
  const { notify } = useConsoleNotifications();
  const [copied, setCopied] = useState(false);

  if (criticalError) {
    throw criticalError;
  }

  const messengerAddress = TeleporterMessengerAddress.content.trim();

  async function handleDeploy() {
    setIsDeploying(true);
    setTeleporterRegistryAddress("");
    try {
      const deployPromise = coreWalletClient.deployContract({
        bytecode: TeleporterRegistryBytecode.content.trim() as `0x${string}`,
        abi: TeleporterRegistryManualyCompiled.abi as any,
        args: [
          [{ version: 1n, protocolAddress: messengerAddress }]
        ],
        account: walletEVMAddress as `0x${string}`,
        chain: viemChain,
      });
      notify({
        type: 'deploy',
        name: 'TeleporterRegistry'
      }, deployPromise, viemChain ?? undefined);

      const hash = await deployPromise;
      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      if (!receipt.contractAddress) {
        throw new Error('No contract address in receipt');
      }

      setTeleporterRegistryAddress(receipt.contractAddress);
      onSuccess?.();
    } catch (error) {
      setCriticalError(error instanceof Error ? error : new Error(String(error)));
    } finally {
      setIsDeploying(false);
    }
  }

  const handleCopy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const deployForm = (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="shrink-0 px-4 py-3 border-b border-zinc-200/80 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50">
        <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
          Deploy TeleporterRegistry
        </h3>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
          Registry for versioned Teleporter protocol upgrades
        </p>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-auto p-4 space-y-4">
        {/* Info callout */}
        <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
          <div className="flex items-start gap-2">
            <Info className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
            <p className="text-xs text-blue-700 dark:text-blue-300 leading-relaxed">
              TeleporterRegistry manages protocol versions. It allows applications to upgrade
              to new Teleporter versions seamlessly while maintaining backwards compatibility.
            </p>
          </div>
        </div>

        {/* Target Network */}
        <div className="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700">
          <span className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider block mb-1">
            Target Network
          </span>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
              {selectedL1?.name || 'Unknown'}
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400 font-mono">
              Chain ID: {selectedL1?.evmChainId}
            </span>
          </div>
        </div>

        {/* Constructor Arguments */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <FileCode className="w-4 h-4 text-zinc-400" />
            <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
              Constructor Arguments
            </span>
          </div>

          <div className="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                TeleporterMessenger Address
              </span>
              <button
                onClick={() => handleCopy(messengerAddress)}
                className="p-1 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
              >
                {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3 text-zinc-400" />}
              </button>
            </div>
            <code className="text-[11px] font-mono text-zinc-700 dark:text-zinc-300 break-all">
              {messengerAddress}
            </code>
            <p className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-2">
              Initial protocol entry: version <code className="text-amber-600 dark:text-amber-400">1</code>
            </p>
          </div>
        </div>

        {/* Deploy Button / Success */}
        {teleporterRegistryAddress ? (
          <div className="space-y-3">
            <div className="p-3 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
              <div className="flex items-center gap-2 mb-2">
                <Check className="w-4 h-4 text-green-600 dark:text-green-400" />
                <span className="text-sm font-medium text-green-700 dark:text-green-300">
                  Registry Deployed Successfully
                </span>
              </div>
              <div className="space-y-1">
                <span className="text-[10px] font-medium text-green-600 dark:text-green-400 uppercase tracking-wider block">
                  Contract Address
                </span>
                <code className="text-[11px] font-mono text-green-700 dark:text-green-300 break-all">
                  {teleporterRegistryAddress}
                </code>
              </div>
            </div>

            <button
              onClick={handleDeploy}
              disabled={isDeploying}
              className="w-full py-2.5 text-sm font-medium rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-700 text-zinc-900 dark:text-zinc-100 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
            >
              <Rocket className="w-4 h-4" />
              {isDeploying ? 'Deploying...' : 'Redeploy Registry'}
            </button>
          </div>
        ) : (
          <button
            onClick={handleDeploy}
            disabled={isDeploying}
            className="w-full py-2.5 text-sm font-medium rounded-lg bg-blue-500 hover:bg-blue-600 text-white disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
          >
            <Rocket className="w-4 h-4" />
            {isDeploying ? 'Deploying...' : 'Deploy TeleporterRegistry'}
          </button>
        )}
      </div>

      {/* Footer */}
      <div className="shrink-0 px-4 py-2.5 border-t border-zinc-200/80 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 flex items-center justify-between">
        <a
          href="https://github.com/ava-labs/icm-contracts/tree/main/contracts/teleporter/registry"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 flex items-center gap-1 transition-colors"
        >
          <ExternalLink className="w-3 h-3" />
          Registry Docs
        </a>
        <span className="text-[11px] text-zinc-400 font-mono">
          @{ICM_COMMIT.slice(0, 7)}
        </span>
      </div>
    </div>
  );

  return (
    <ContractDeployViewer
      contracts={CONTRACT_SOURCES}
    >
      {deployForm}
    </ContractDeployViewer>
  );
}

export default withConsoleToolMetadata(TeleporterRegistry, metadata);
