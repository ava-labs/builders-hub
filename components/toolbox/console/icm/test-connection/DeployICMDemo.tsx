"use client";

import { useToolboxStore, useViemChainStore } from "@/components/toolbox/stores/toolboxStore";
import { useWalletStore } from "@/components/toolbox/stores/walletStore";
import { useState, useEffect } from "react";
import ICMDemoABI from "@/contracts/example-contracts/compiled/ICMDemo.json";
import TeleporterMessengerAddress from '@/contracts/icm-contracts-releases/v1.0.0/TeleporterMessenger_Contract_Address_v1.0.0.txt.json';
import { useSelectedL1 } from "@/components/toolbox/stores/l1ListStore";
import { WalletRequirementsConfigKey } from "@/components/toolbox/hooks/useWalletRequirements";
import useConsoleNotifications from "@/hooks/useConsoleNotifications";
import { BaseConsoleToolProps, ConsoleToolMetadata, withConsoleToolMetadata } from "../../../components/WithConsoleToolMetadata";
import { useConnectedWallet } from "@/components/toolbox/contexts/ConnectedWalletContext";
import { generateConsoleToolGitHubUrl } from "@/components/toolbox/utils/github-url";
import { StepCodeViewer, StepConfig } from "@/components/console/step-code-viewer";
import { Check, Rocket, AlertCircle, ExternalLink, ArrowRight, Radio } from "lucide-react";

const SENDER_C_CHAIN_ADDRESS = "0x05c474824e7d2cc67cf22b456f7cf60c0e3a1289";

const metadata: ConsoleToolMetadata = {
  title: "Deploy ICM Demo Contract",
  description: "Deploy a demo contract that can receive messages from the C-Chain using Avalanche's Inter-Chain Messaging (ICM) protocol",
  toolRequirements: [
    WalletRequirementsConfigKey.EVMChainBalance
  ],
  githubUrl: generateConsoleToolGitHubUrl(import.meta.url)
};

// ICMDemo contract source code
const ICM_DEMO_SOURCE = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "./ITeleporterMessenger.sol";
import "./ITeleporterReceiver.sol";

contract ICMDemo is ITeleporterReceiver {
    ITeleporterMessenger public immutable messenger =
        ITeleporterMessenger(0x253b2784c75e510dD0fF1da844684a1aC0aa5fcf);

    uint256 public lastMessage;

    /**
     * @dev Sends a message to another chain.
     */
    function sendMessage(
        address destinationAddress,
        uint256 message,
        bytes32 destinationBlockchainID
    ) external {
        messenger.sendCrossChainMessage(
            TeleporterMessageInput({
                destinationBlockchainID: destinationBlockchainID,
                destinationAddress: destinationAddress,
                feeInfo: TeleporterFeeInfo({
                    feeTokenAddress: address(0),
                    amount: 0
                }),
                requiredGasLimit: 100000,
                allowedRelayerAddresses: new address[](0),
                message: abi.encode(message)
            })
        );
    }

    function receiveTeleporterMessage(
        bytes32,
        address,
        bytes calldata message
    ) external override {
        // Only the Teleporter receiver can deliver a message.
        require(
            msg.sender == address(messenger),
            "SenderReceiver: unauthorized TeleporterMessenger"
        );

        // Store the message.
        lastMessage = abi.decode(message, (uint256));
    }
}`;

const getCodeSteps = (params: {
  chainId: string;
  rpcUrl: string;
  contractAddress: string;
}): StepConfig[] => [
  {
    id: "contract-source",
    title: "ICMDemo Contract",
    description: "Cross-chain sender and receiver",
    codeType: "solidity",
    filename: "ICMDemo.sol",
    code: ICM_DEMO_SOURCE,
    githubUrl: "https://github.com/ava-labs/avalanche-starter-kit/blob/main/contracts/interchain-messaging/send-receive/",
  },
  {
    id: "deploy-sdk",
    title: "Deploy via SDK",
    description: "Using viem to deploy the contract",
    codeType: "typescript",
    filename: "deploy-icm-demo.ts",
    code: `import { createWalletClient, createPublicClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";

// Your L1 chain configuration
const chain = {
  id: ${params.chainId || "YOUR_CHAIN_ID"},
  name: "Your L1",
  rpcUrls: { default: { http: ["${params.rpcUrl || "YOUR_RPC_URL"}"] } },
  nativeCurrency: { name: "Token", symbol: "TKN", decimals: 18 }
};

const walletClient = createWalletClient({
  chain,
  transport: http(),
  account: privateKeyToAccount("0x...")
});

const publicClient = createPublicClient({
  chain,
  transport: http()
});

// Deploy ICMDemo contract
const hash = await walletClient.deployContract({
  abi: ICMDemoABI.abi,
  bytecode: ICMDemoABI.bytecode as \`0x\${string}\`,
  args: []
});

const receipt = await publicClient.waitForTransactionReceipt({ hash });
console.log("ICMDemo deployed at:", receipt.contractAddress);`,
  },
  {
    id: "verify-deployment",
    title: "Verify Deployment",
    description: "Check the contract is working",
    codeType: "typescript",
    filename: "verify-icm-demo.ts",
    code: `import { createPublicClient, http } from "viem";

const publicClient = createPublicClient({
  transport: http("${params.rpcUrl || "YOUR_RPC_URL"}")
});

// Read the TeleporterMessenger address from the contract
const messengerAddress = await publicClient.readContract({
  address: "${params.contractAddress || "0x..."}",
  abi: [{
    name: "messenger",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }]
  }],
  functionName: "messenger"
});

console.log("TeleporterMessenger:", messengerAddress);
// Expected: 0x253b2784c75e510dD0fF1da844684a1aC0aa5fcf

// Read the last received message
const lastMessage = await publicClient.readContract({
  address: "${params.contractAddress || "0x..."}",
  abi: [{
    name: "lastMessage",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }]
  }],
  functionName: "lastMessage"
});

console.log("Last message:", lastMessage.toString());`,
  },
];

function DeployICMDemo({ onSuccess }: BaseConsoleToolProps) {
  const { setIcmReceiverAddress, icmReceiverAddress } = useToolboxStore();
  const { publicClient, walletEVMAddress } = useWalletStore();
  const { coreWalletClient } = useConnectedWallet();
  const viemChain = useViemChainStore();
  const [isDeploying, setIsDeploying] = useState(false);
  const [isTeleporterDeployed, setIsTeleporterDeployed] = useState(false);
  const [criticalError, setCriticalError] = useState<Error | null>(null);
  const selectedL1 = useSelectedL1()();
  const { notify } = useConsoleNotifications();
  const [activeStep, setActiveStep] = useState(0);

  if (criticalError) {
    throw criticalError;
  }

  useEffect(() => {
    async function checkTeleporterExists() {
      try {
        const code = await publicClient.getBytecode({
          address: TeleporterMessengerAddress.content as `0x${string}`,
        });

        setIsTeleporterDeployed(!!code);
      } catch (error) {
        setIsTeleporterDeployed(false);
      }
    }

    checkTeleporterExists();
  }, [selectedL1?.evmChainId]);

  async function handleDeploy() {
    setIsDeploying(true);
    setIcmReceiverAddress("");
    try {
      const deployPromise = coreWalletClient.deployContract({
        abi: ICMDemoABI.abi as any,
        bytecode: ICMDemoABI.bytecode.object as `0x${string}`,
        args: [],
        account: walletEVMAddress as `0x${string}`,
        chain: viemChain
      });

      notify({
        type: 'deploy',
        name: 'ICMDemo'
      }, deployPromise, viemChain ?? undefined);

      const hash = await deployPromise;
      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      if (!receipt.contractAddress) {
        throw new Error('No contract address in receipt');
      }

      setIcmReceiverAddress(receipt.contractAddress);
      onSuccess?.();
    } catch (error) {
      setCriticalError(error instanceof Error ? error : new Error(String(error)));
    } finally {
      setIsDeploying(false);
    }
  }

  const codeSteps = getCodeSteps({
    chainId: selectedL1?.evmChainId?.toString() || "",
    rpcUrl: selectedL1?.rpcUrl || "",
    contractAddress: icmReceiverAddress || "",
  });

  const deployForm = (
    <div className="flex flex-col rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
      {/* Header */}
      <div className="shrink-0 px-4 py-3 border-b border-zinc-200/80 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50">
        <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
          Deploy ICM Demo
        </h3>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
          Test cross-chain messaging with a simple sender/receiver contract
        </p>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4 space-y-4">
        {/* Info callout */}
        <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
          <p className="text-xs text-blue-700 dark:text-blue-300 leading-relaxed">
            ICMDemo is a combined sender/receiver contract that demonstrates Avalanche's
            Inter-Chain Messaging protocol. It can both send and receive cross-chain messages.
          </p>
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

        {/* Teleporter Status */}
        <div className={`p-3 rounded-xl border ${
          isTeleporterDeployed
            ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
            : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
        }`}>
          <div className="flex items-center gap-2">
            {isTeleporterDeployed ? (
              <Check className="w-4 h-4 text-green-600 dark:text-green-400" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
            )}
            <span className={`text-sm font-medium ${
              isTeleporterDeployed
                ? 'text-green-700 dark:text-green-300'
                : 'text-red-700 dark:text-red-300'
            }`}>
              {isTeleporterDeployed ? 'TeleporterMessenger Detected' : 'TeleporterMessenger Not Found'}
            </span>
          </div>
          <p className={`text-xs mt-1 ${
            isTeleporterDeployed
              ? 'text-green-600 dark:text-green-400'
              : 'text-red-600 dark:text-red-400'
          }`}>
            {isTeleporterDeployed
              ? `Found at ${TeleporterMessengerAddress.content.slice(0, 10)}...`
              : 'Deploy TeleporterMessenger first to enable cross-chain messaging.'
            }
          </p>
        </div>

        {/* C-Chain Sender Info */}
        <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
          <div className="flex items-center gap-2 mb-2">
            <Radio className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            <span className="text-sm font-medium text-amber-700 dark:text-amber-300">
              C-Chain Pre-deployed Sender
            </span>
          </div>
          <p className="text-xs text-amber-600 dark:text-amber-400 leading-relaxed mb-2">
            Use the pre-deployed sender contract on C-Chain to send test messages to your L1.
          </p>
          <div className="flex items-center gap-2">
            <code className="text-[10px] font-mono text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/30 px-2 py-1 rounded">
              {SENDER_C_CHAIN_ADDRESS}
            </code>
            <a
              href={`https://subnets-test.avax.network/c-chain/address/${SENDER_C_CHAIN_ADDRESS}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300"
            >
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>

        {/* Deploy Button / Success */}
        {icmReceiverAddress ? (
          <div className="space-y-3">
            <div className="p-3 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
              <div className="flex items-center gap-2 mb-2">
                <Check className="w-4 h-4 text-green-600 dark:text-green-400" />
                <span className="text-sm font-medium text-green-700 dark:text-green-300">
                  ICMDemo Deployed Successfully
                </span>
              </div>
              <div className="space-y-1">
                <span className="text-[10px] font-medium text-green-600 dark:text-green-400 uppercase tracking-wider block">
                  Contract Address
                </span>
                <code className="text-[11px] font-mono text-green-700 dark:text-green-300 break-all">
                  {icmReceiverAddress}
                </code>
              </div>
            </div>

            <div className="flex items-center gap-2 p-3 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-xs text-zinc-600 dark:text-zinc-400">
              <ArrowRight className="w-4 h-4" />
              Ready to send cross-chain messages. Proceed to the next step.
            </div>

            <button
              onClick={handleDeploy}
              disabled={isDeploying || !isTeleporterDeployed}
              className="w-full py-2.5 text-sm font-medium rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-700 text-zinc-900 dark:text-zinc-100 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
            >
              <Rocket className="w-4 h-4" />
              {isDeploying ? 'Deploying...' : 'Re-Deploy ICMDemo'}
            </button>
          </div>
        ) : (
          <button
            onClick={handleDeploy}
            disabled={isDeploying || !isTeleporterDeployed}
            className="w-full py-2.5 text-sm font-medium rounded-lg bg-blue-500 hover:bg-blue-600 text-white disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
          >
            <Rocket className="w-4 h-4" />
            {isDeploying ? 'Deploying...' : 'Deploy ICMDemo'}
          </button>
        )}
      </div>

      {/* Footer */}
      <div className="shrink-0 px-4 py-2.5 border-t border-zinc-200/80 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 flex items-center justify-between">
        <a
          href="https://build.avax.network/academy/interchain-messaging/04-icm-basics/06-create-receiver-contract"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 flex items-center gap-1 transition-colors"
        >
          <ExternalLink className="w-3 h-3" />
          ICM Basics Tutorial
        </a>
        <span className="text-[11px] text-zinc-400">
          avalanche-starter-kit
        </span>
      </div>
    </div>
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
      {deployForm}
      <StepCodeViewer
        activeStep={activeStep}
        steps={codeSteps}
        className="h-[600px]"
      />
    </div>
  );
}

export default withConsoleToolMetadata(DeployICMDemo, metadata);
