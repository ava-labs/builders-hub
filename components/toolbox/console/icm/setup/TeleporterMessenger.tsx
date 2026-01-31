"use client";

import { useState, useEffect } from "react";
import { formatEther, parseEther } from 'viem';
import { useViemChainStore } from "@/components/toolbox/stores/toolboxStore";
import { useWalletStore } from "@/components/toolbox/stores/walletStore";
import TeleporterMessengerDeploymentTransaction from '@/contracts/icm-contracts-releases/v1.0.0/TeleporterMessenger_Deployment_Transaction_v1.0.0.txt.json';
import TeleporterMessengerDeployerAddress from '@/contracts/icm-contracts-releases/v1.0.0/TeleporterMessenger_Deployer_Address_v1.0.0.txt.json';
import TeleporterMessengerAddress from '@/contracts/icm-contracts-releases/v1.0.0/TeleporterMessenger_Contract_Address_v1.0.0.txt.json';
import { WalletRequirementsConfigKey } from "@/components/toolbox/hooks/useWalletRequirements";
import { BaseConsoleToolProps, ConsoleToolMetadata, withConsoleToolMetadata } from "../../../components/WithConsoleToolMetadata";
import { useConnectedWallet } from "@/components/toolbox/contexts/ConnectedWalletContext";
import versions from '@/scripts/versions.json';
import { generateConsoleToolGitHubUrl } from "@/components/toolbox/utils/github-url";
import { ContractDeployViewer, ContractSource } from "@/components/console/contract-deploy-viewer";
import { Check, Wallet, Rocket, AlertCircle, ExternalLink, Copy } from "lucide-react";

const MINIMUM_BALANCE = parseEther('11');

const ICM_COMMIT = versions["ava-labs/icm-contracts"];

const CONTRACT_SOURCES: ContractSource[] = [
  {
    name: "TeleporterMessenger",
    filename: "TeleporterMessenger.sol",
    url: `https://raw.githubusercontent.com/ava-labs/icm-contracts/${ICM_COMMIT}/contracts/teleporter/TeleporterMessenger.sol`,
    description: "Core ICM contract for cross-chain message sending and receiving",
  },
  {
    name: "ITeleporterMessenger",
    filename: "ITeleporterMessenger.sol",
    url: `https://raw.githubusercontent.com/ava-labs/icm-contracts/${ICM_COMMIT}/contracts/teleporter/ITeleporterMessenger.sol`,
    description: "Interface defining the Teleporter messenger protocol",
  },
];

const metadata: ConsoleToolMetadata = {
  title: "Deploy ICM Messenger",
  description: "Deploy the ICM messenger contract to your L1 to enable cross-L1 messaging and applications like ICTT",
  toolRequirements: [
    WalletRequirementsConfigKey.EVMChainBalance
  ],
  githubUrl: generateConsoleToolGitHubUrl(import.meta.url)
};

function TeleporterMessenger({ onSuccess }: BaseConsoleToolProps) {
  const [criticalError, setCriticalError] = useState<Error | null>(null);
  const { publicClient, walletEVMAddress } = useWalletStore();
  const { coreWalletClient } = useConnectedWallet();
  const viemChain = useViemChainStore();
  const [isDeploying, setIsDeploying] = useState(false);
  const [deployerBalance, setDeployerBalance] = useState(BigInt(0));
  const [isCheckingBalance, setIsCheckingBalance] = useState(true);
  const [isDeployed, setIsDeployed] = useState(false);
  const [txHash, setTxHash] = useState("");
  const [amount, setAmount] = useState(formatEther(MINIMUM_BALANCE));
  const [isSending, setIsSending] = useState(false);
  const [copied, setCopied] = useState(false);

  if (criticalError) {
    throw criticalError;
  }

  const deployerAddress = TeleporterMessengerDeployerAddress.content as `0x${string}`;
  const expectedContractAddress = TeleporterMessengerAddress.content;

  const checkDeployerBalance = async () => {
    setIsCheckingBalance(true);
    try {
      const balance = await publicClient.getBalance({
        address: deployerAddress,
      });

      setDeployerBalance(balance);

      const code = await publicClient.getBytecode({
        address: expectedContractAddress as `0x${string}`,
      });

      setIsDeployed(code !== undefined && code !== '0x');
    } catch (error) {
      console.error("Failed to check balance:", error);
    } finally {
      setIsCheckingBalance(false);
    }
  };

  useEffect(() => {
    checkDeployerBalance();
  }, []);

  const handleTopUp = async () => {
    setIsSending(true);
    try {
      const hash = await coreWalletClient.sendTransaction({
        to: deployerAddress as `0x${string}`,
        value: parseEther(amount),
        chain: viemChain,
        account: walletEVMAddress as `0x${string}`,
      });

      await publicClient.waitForTransactionReceipt({ hash });
      await checkDeployerBalance();
    } catch (error) {
      setCriticalError(error instanceof Error ? error : new Error(String(error)));
    } finally {
      setIsSending(false);
    }
  };

  const handleDeploy = async () => {
    setIsDeploying(true);
    try {
      const hash = await coreWalletClient.sendRawTransaction({
        serializedTransaction: TeleporterMessengerDeploymentTransaction.content as `0x${string}`,
      });

      setTxHash(hash);

      await publicClient.waitForTransactionReceipt({ hash });
      setIsDeployed(true);
      onSuccess?.();

      await checkDeployerBalance();
    } catch (error) {
      setCriticalError(error instanceof Error ? error : new Error(String(error)));
    } finally {
      setIsDeploying(false);
    }
  };

  const handleCopy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const hasEnoughBalance = deployerBalance >= MINIMUM_BALANCE;

  const deployForm = (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="shrink-0 px-4 py-3 border-b border-zinc-200/80 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50">
        <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
          Deploy TeleporterMessenger
        </h3>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
          Core contract for cross-chain message sending and receiving
        </p>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-auto p-4 space-y-4">
        {/* Info callout */}
        <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
          <p className="text-xs text-blue-700 dark:text-blue-300 leading-relaxed">
            TeleporterMessenger uses a deterministic deployment. The contract address is the same
            across all chains. Fund the deployer address, then broadcast the pre-signed transaction.
          </p>
        </div>

        {/* Step 1: Deployer Info */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
              hasEnoughBalance || isDeployed
                ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
            }`}>
              {hasEnoughBalance || isDeployed ? <Check className="w-3 h-3" /> : '1'}
            </div>
            <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
              Fund Deployer Address
            </span>
          </div>

          {/* Deployer Address Card */}
          <div className="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                Deployer Address
              </span>
              <button
                onClick={() => handleCopy(deployerAddress)}
                className="p-1 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
              >
                {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3 text-zinc-400" />}
              </button>
            </div>
            <code className="text-[11px] font-mono text-zinc-700 dark:text-zinc-300 break-all">
              {deployerAddress}
            </code>
          </div>

          {/* Balance Status */}
          {!isDeployed && (
            <div className="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider block mb-1">
                    Deployer Balance
                  </span>
                  {isCheckingBalance ? (
                    <span className="text-xs text-zinc-500">Checking...</span>
                  ) : (
                    <span className={`text-sm font-mono ${hasEnoughBalance ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'}`}>
                      {formatEther(deployerBalance)} coins
                    </span>
                  )}
                </div>
                <div className={`text-[10px] px-2 py-1 rounded-full ${
                  hasEnoughBalance
                    ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                    : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
                }`}>
                  {hasEnoughBalance ? 'Sufficient' : `Need ${formatEther(MINIMUM_BALANCE)}`}
                </div>
              </div>
            </div>
          )}

          {/* Top Up Form */}
          {!hasEnoughBalance && !isDeployed && (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="flex-1 px-3 py-2 text-sm rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-mono"
                placeholder="Amount"
              />
              <button
                onClick={handleTopUp}
                disabled={isSending}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-amber-500 hover:bg-amber-600 text-white disabled:opacity-50 transition-colors flex items-center gap-2"
              >
                <Wallet className="w-4 h-4" />
                {isSending ? 'Sending...' : 'Send'}
              </button>
            </div>
          )}
        </div>

        {/* Step 2: Deploy */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
              isDeployed
                ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400'
            }`}>
              {isDeployed ? <Check className="w-3 h-3" /> : '2'}
            </div>
            <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
              Deploy Contract
            </span>
          </div>

          {/* Expected Contract Address */}
          <div className="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                Contract Address (Deterministic)
              </span>
              <button
                onClick={() => handleCopy(expectedContractAddress)}
                className="p-1 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
              >
                <Copy className="w-3 h-3 text-zinc-400" />
              </button>
            </div>
            <code className="text-[11px] font-mono text-zinc-700 dark:text-zinc-300 break-all">
              {expectedContractAddress}
            </code>
          </div>

          {isDeployed ? (
            <div className="p-3 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-green-600 dark:text-green-400" />
                <span className="text-sm font-medium text-green-700 dark:text-green-300">
                  Contract Already Deployed
                </span>
              </div>
              <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                TeleporterMessenger is ready for cross-chain messaging.
              </p>
            </div>
          ) : (
            <button
              onClick={handleDeploy}
              disabled={isDeploying || !hasEnoughBalance}
              className="w-full py-2.5 text-sm font-medium rounded-lg bg-blue-500 hover:bg-blue-600 text-white disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
            >
              <Rocket className="w-4 h-4" />
              {isDeploying ? 'Deploying...' : 'Deploy TeleporterMessenger'}
            </button>
          )}
        </div>

        {/* Transaction Hash */}
        {txHash && (
          <div className="p-3 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
            <span className="text-[10px] font-medium text-green-600 dark:text-green-400 uppercase tracking-wider block mb-1">
              Transaction Hash
            </span>
            <code className="text-[11px] font-mono text-green-700 dark:text-green-300 break-all">
              {txHash}
            </code>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="shrink-0 px-4 py-2.5 border-t border-zinc-200/80 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 flex items-center justify-between">
        <a
          href="https://github.com/ava-labs/icm-contracts/blob/main/contracts/teleporter/README.md"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 flex items-center gap-1 transition-colors"
        >
          <ExternalLink className="w-3 h-3" />
          Teleporter Docs
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

export default withConsoleToolMetadata(TeleporterMessenger, metadata);
