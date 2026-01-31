"use client";

import { useToolboxStore, useViemChainStore, getToolboxStore } from "@/components/toolbox/stores/toolboxStore";
import { useState, useMemo } from "react";
import { createPublicClient, http } from 'viem';
import ICMDemoABI from "@/contracts/example-contracts/compiled/ICMDemo.json";
import { cb58ToHex } from '@/components/toolbox/console/utilities/format-converter/FormatConverter';
import SelectBlockchainId from "@/components/toolbox/components/SelectBlockchainId";
import { useL1ByChainId, useSelectedL1 } from "@/components/toolbox/stores/l1ListStore";
import { useEffect } from "react";
import { WalletRequirementsConfigKey } from "@/components/toolbox/hooks/useWalletRequirements";
import { BaseConsoleToolProps, ConsoleToolMetadata, withConsoleToolMetadata } from "../../../components/WithConsoleToolMetadata";
import { useConnectedWallet } from "@/components/toolbox/contexts/ConnectedWalletContext";
import useConsoleNotifications from "@/hooks/useConsoleNotifications";
import { generateConsoleToolGitHubUrl } from "@/components/toolbox/utils/github-url";
import { StepCodeViewer, StepConfig } from "@/components/console/step-code-viewer";
import { Check, Send, Search, ArrowRight, AlertCircle, ExternalLink, Radio } from "lucide-react";

const predeployedDemos: Record<string, string> = {
  //fuji
  "yH8D7ThNJkxmtkuv2jgBa4P1Rn3Qpr4pPr7QYNfcdoS6k6HWp": "0x05c474824e7d2cc67cf22b456f7cf60c0e3a1289"
}

const metadata: ConsoleToolMetadata = {
  title: "Send ICM Message",
  description: "Send a test message between L1s using Avalanche's Inter-Chain Messaging (ICM) protocol",
  toolRequirements: [
    WalletRequirementsConfigKey.EVMChainBalance
  ],
  githubUrl: generateConsoleToolGitHubUrl(import.meta.url)
};

const getCodeSteps = (params: {
  sourceChainName: string;
  sourceContractAddress: string;
  destChainName: string;
  destContractAddress: string;
  destBlockchainId: string;
  destRpcUrl: string;
  message: number;
}): StepConfig[] => [
  {
    id: "send-message",
    title: "Send Cross-Chain Message",
    description: "Call sendMessage on source chain",
    codeType: "typescript",
    filename: "send-icm-message.ts",
    code: `import { createWalletClient, createPublicClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";

// Source chain (${params.sourceChainName || "Your L1"})
const sourceClient = createWalletClient({
  chain: sourceChain, // Your source chain config
  transport: http(),
  account: privateKeyToAccount("0x...")
});

const publicClient = createPublicClient({
  chain: sourceChain,
  transport: http()
});

// ICMDemo contract on source chain
const sourceContract = "${params.sourceContractAddress || "0x..."}";

// Destination blockchain ID (hex encoded)
const destinationBlockchainID = "${params.destBlockchainId || "0x..."}";

// Destination contract address
const destinationAddress = "${params.destContractAddress || "0x..."}";

// Message to send (uint256)
const message = ${params.message || 12345}n;

// Simulate the transaction first
const { request } = await publicClient.simulateContract({
  address: sourceContract as \`0x\${string}\`,
  abi: [{
    name: "sendMessage",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "destinationAddress", type: "address" },
      { name: "message", type: "uint256" },
      { name: "destinationBlockchainID", type: "bytes32" }
    ],
    outputs: []
  }],
  functionName: "sendMessage",
  args: [destinationAddress, message, destinationBlockchainID],
  account: sourceClient.account
});

// Send the transaction
const hash = await sourceClient.writeContract(request);
console.log("Message sent! Tx hash:", hash);`,
  },
  {
    id: "relayer-delivery",
    title: "Relayer Delivery",
    description: "How the message is delivered",
    codeType: "typescript",
    filename: "message-flow.ts",
    code: `/**
 * Cross-Chain Message Flow
 * ========================
 *
 * 1. SEND (Source Chain - ${params.sourceChainName || "Your L1"})
 *    └─ ICMDemo.sendMessage() calls TeleporterMessenger.sendCrossChainMessage()
 *    └─ Message is emitted as an event on source chain
 *
 * 2. RELAY (Off-chain)
 *    └─ ICM Relayer monitors TeleporterMessenger events
 *    └─ Relayer picks up the message
 *    └─ Relayer constructs a Warp signature from validators
 *    └─ Relayer submits message to destination chain
 *
 * 3. RECEIVE (Destination Chain - ${params.destChainName || "Destination"})
 *    └─ TeleporterMessenger.receiveCrossChainMessage() is called
 *    └─ Message is verified using Warp signatures
 *    └─ TeleporterMessenger calls ICMDemo.receiveTeleporterMessage()
 *    └─ ICMDemo stores the message in \`lastMessage\`
 *
 * Time: Usually 5-30 seconds depending on finality
 */

// The relayer handles all the complexity!
// You just need to:
// 1. Deploy ICMDemo on both chains
// 2. Run a relayer (or use a managed service)
// 3. Call sendMessage on source chain
// 4. Query lastMessage on destination chain`,
  },
  {
    id: "query-message",
    title: "Query Received Message",
    description: "Read lastMessage on destination",
    codeType: "typescript",
    filename: "query-message.ts",
    code: `import { createPublicClient, http } from "viem";

// Destination chain client (${params.destChainName || "Destination"})
const destClient = createPublicClient({
  transport: http("${params.destRpcUrl || "DESTINATION_RPC_URL"}")
});

// ICMDemo contract on destination chain
const destContract = "${params.destContractAddress || "0x..."}";

// Query the last received message
const lastMessage = await destClient.readContract({
  address: destContract as \`0x\${string}\`,
  abi: [{
    name: "lastMessage",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }]
  }],
  functionName: "lastMessage"
});

console.log("Last received message:", lastMessage.toString());

// Compare with sent message
const expectedMessage = ${params.message || 12345}n;
if (lastMessage === expectedMessage) {
  console.log("✓ Message delivered successfully!");
} else {
  console.log("Message not yet delivered. Try again in a few seconds...");
}`,
  },
];

function SendICMMessage({ onSuccess }: BaseConsoleToolProps) {
  const [criticalError, setCriticalError] = useState<Error | null>(null);
  const { icmReceiverAddress, setIcmReceiverAddress } = useToolboxStore();
  const { coreWalletClient } = useConnectedWallet();
  const selectedL1 = useSelectedL1()();
  const [message, setMessage] = useState(Math.floor(Math.random() * 10000));
  const [destinationChainId, setDestinationChainId] = useState<string>("");
  const [isSending, setIsSending] = useState(false);
  const [lastTxId, setLastTxId] = useState<string>();
  const viemChain = useViemChainStore();
  const [isQuerying, setIsQuerying] = useState(false);
  const [lastReceivedMessage, setLastReceivedMessage] = useState<number>();
  const { notify } = useConsoleNotifications();
  const [activeStep, setActiveStep] = useState(0);

  if (criticalError) {
    throw criticalError;
  }

  const targetToolboxStore = getToolboxStore(destinationChainId)()
  const targetL1 = useL1ByChainId(destinationChainId)();

  const sourceContractError = icmReceiverAddress ? undefined : "Deploy ICMDemo on source chain first";
  const targetContractError = targetToolboxStore.icmReceiverAddress ? undefined : "Deploy ICMDemo on destination chain first";

  let destinationChainError: string | undefined = undefined;
  if (!destinationChainId) {
    destinationChainError = "Please select a destination chain";
  } else if (selectedL1?.id === destinationChainId) {
    destinationChainError = "Source and destination cannot be the same";
  }

  const destinationBlockchainIDHex = useMemo(() => {
    if (!targetL1?.id) return undefined;
    try {
      return cb58ToHex(targetL1.id);
    } catch (e) {
      console.error("Error decoding destination chain ID:", e);
      return undefined;
    }
  }, [targetL1?.id]);

  useEffect(() => {
    if (predeployedDemos[destinationChainId] && !icmReceiverAddress) {
      setIcmReceiverAddress(predeployedDemos[destinationChainId]);
    }

    if (predeployedDemos[destinationChainId] && !targetToolboxStore.icmReceiverAddress) {
      targetToolboxStore.setIcmReceiverAddress(predeployedDemos[destinationChainId]);
    }
  }, [destinationChainId]);

  async function handleSendMessage() {
    if (!icmReceiverAddress || !targetToolboxStore.icmReceiverAddress || !destinationBlockchainIDHex || !viemChain) {
      setCriticalError(new Error('Missing required information to send message.'));
      return;
    }

    setIsSending(true);
    setLastTxId(undefined);
    try {
      const sourceAddress = icmReceiverAddress as `0x${string}`;
      const destinationAddress = targetToolboxStore.icmReceiverAddress as `0x${string}`;

      const publicClient = createPublicClient({
        chain: viemChain,
        transport: http(viemChain.rpcUrls.default.http[0]),
      });

      if (!coreWalletClient.account) {
        throw new Error('No wallet account connected');
      }

      const { request } = await publicClient.simulateContract({
        address: sourceAddress,
        abi: ICMDemoABI.abi,
        functionName: 'sendMessage',
        args: [
          destinationAddress,
          BigInt(message),
          destinationBlockchainIDHex as `0x${string}`
        ],
        account: coreWalletClient.account,
        chain: viemChain,
      });

      const writePromise = coreWalletClient.writeContract(request);

      notify({
        type: 'call',
        name: 'Send ICM Message'
      }, writePromise, viemChain ?? undefined);

      const hash = await writePromise;
      console.log("Transaction hash:", hash);
      setLastTxId(hash);
      onSuccess?.();

    } catch (error) {
      console.error("ICM Send Error:", error);
      setCriticalError(error instanceof Error ? error : new Error(String(error)));
    } finally {
      setIsSending(false);
    }
  }

  async function queryLastMessage() {
    if (!targetL1?.rpcUrl || !targetToolboxStore.icmReceiverAddress) {
      setCriticalError(new Error('Missing required information to query message'));
      return;
    }

    setIsQuerying(true);
    try {
      const destinationClient = createPublicClient({
        transport: http(targetL1.rpcUrl),
      });

      const lastMessage = await destinationClient.readContract({
        address: targetToolboxStore.icmReceiverAddress as `0x${string}`,
        abi: ICMDemoABI.abi,
        functionName: 'lastMessage',
      });

      setLastReceivedMessage(Number(lastMessage));
    } catch (error) {
      console.error("ICM Query Error:", error);
      setCriticalError(error instanceof Error ? error : new Error(String(error)));
    } finally {
      setIsQuerying(false);
    }
  }

  const isButtonDisabled = isSending ||
    !!sourceContractError ||
    !!targetContractError ||
    !!destinationChainError ||
    !message ||
    !destinationBlockchainIDHex;

  const isQueryButtonDisabled = isQuerying ||
    !targetToolboxStore.icmReceiverAddress ||
    !targetL1?.rpcUrl;

  const codeSteps = getCodeSteps({
    sourceChainName: selectedL1?.name || "",
    sourceContractAddress: icmReceiverAddress || "",
    destChainName: targetL1?.name || "",
    destContractAddress: targetToolboxStore.icmReceiverAddress || "",
    destBlockchainId: destinationBlockchainIDHex || "",
    destRpcUrl: targetL1?.rpcUrl || "",
    message: message,
  });

  const messageForm = (
    <div className="flex flex-col rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
      {/* Header */}
      <div className="shrink-0 px-4 py-3 border-b border-zinc-200/80 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50">
        <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
          Send ICM Message
        </h3>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
          Test cross-chain message delivery between L1s
        </p>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4 space-y-4">
        {/* Message Flow Visualization */}
        <div className="p-3 rounded-xl bg-gradient-to-r from-blue-50 to-green-50 dark:from-blue-900/20 dark:to-green-900/20 border border-blue-200 dark:border-blue-800">
          <div className="flex items-center justify-between text-xs">
            <div className="text-center">
              <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center mx-auto mb-1">
                <Radio className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              </div>
              <span className="text-blue-700 dark:text-blue-300 font-medium">
                {selectedL1?.name || 'Source'}
              </span>
            </div>
            <div className="flex-1 flex items-center justify-center">
              <ArrowRight className="w-5 h-5 text-zinc-400" />
            </div>
            <div className="text-center">
              <div className="w-8 h-8 rounded-lg bg-green-100 dark:bg-green-900/50 flex items-center justify-center mx-auto mb-1">
                <Radio className="w-4 h-4 text-green-600 dark:text-green-400" />
              </div>
              <span className="text-green-700 dark:text-green-300 font-medium">
                {targetL1?.name || 'Destination'}
              </span>
            </div>
          </div>
        </div>

        {/* Source Contract */}
        <div>
          <label className="block text-[11px] font-medium text-zinc-500 dark:text-zinc-400 mb-1.5 uppercase tracking-wider">
            Source Contract ({selectedL1?.name})
          </label>
          <div className={`px-3 py-2 rounded-lg border text-sm font-mono ${
            sourceContractError
              ? 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400'
              : 'border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300'
          }`}>
            {icmReceiverAddress || sourceContractError}
          </div>
        </div>

        {/* Message Input */}
        <div>
          <label className="block text-[11px] font-medium text-zinc-500 dark:text-zinc-400 mb-1.5 uppercase tracking-wider">
            Message (Number)
          </label>
          <input
            type="number"
            value={message}
            onChange={(e) => setMessage(Number(e.target.value) || 0)}
            className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-mono"
            placeholder="Enter a number..."
          />
        </div>

        {/* Destination Chain */}
        <div>
          <label className="block text-[11px] font-medium text-zinc-500 dark:text-zinc-400 mb-1.5 uppercase tracking-wider">
            Destination Chain
          </label>
          <SelectBlockchainId
            value={destinationChainId}
            onChange={(value) => setDestinationChainId(value)}
            error={destinationChainError}
          />
        </div>

        {/* Destination Contract */}
        {targetL1 && (
          <div>
            <label className="block text-[11px] font-medium text-zinc-500 dark:text-zinc-400 mb-1.5 uppercase tracking-wider">
              Destination Contract ({targetL1?.name})
            </label>
            <div className={`px-3 py-2 rounded-lg border text-sm font-mono ${
              targetContractError
                ? 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400'
                : 'border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300'
            }`}>
              {targetToolboxStore.icmReceiverAddress || targetContractError}
            </div>
          </div>
        )}

        {/* Send Button */}
        <button
          onClick={handleSendMessage}
          disabled={isButtonDisabled}
          className="w-full py-2.5 text-sm font-medium rounded-lg bg-blue-500 hover:bg-blue-600 text-white disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
        >
          <Send className="w-4 h-4" />
          {isSending ? 'Sending...' : `Send Message to ${targetL1?.name || 'Destination'}`}
        </button>

        {/* Transaction Hash */}
        {lastTxId && (
          <div className="p-3 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
            <div className="flex items-center gap-2 mb-1">
              <Check className="w-4 h-4 text-green-600 dark:text-green-400" />
              <span className="text-sm font-medium text-green-700 dark:text-green-300">
                Message Sent
              </span>
            </div>
            <span className="text-[10px] font-medium text-green-600 dark:text-green-400 uppercase tracking-wider block mb-1">
              Transaction Hash
            </span>
            <code className="text-[11px] font-mono text-green-700 dark:text-green-300 break-all">
              {lastTxId}
            </code>
          </div>
        )}

        {/* Divider */}
        <div className="border-t border-zinc-200 dark:border-zinc-800 pt-4">
          <h4 className="text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-3 flex items-center gap-2">
            <Search className="w-4 h-4 text-zinc-400" />
            Query Received Message
          </h4>

          <button
            onClick={queryLastMessage}
            disabled={isQueryButtonDisabled}
            className="w-full py-2.5 text-sm font-medium rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-700 text-zinc-900 dark:text-zinc-100 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
          >
            <Search className="w-4 h-4" />
            {isQuerying ? 'Querying...' : `Query ${targetL1?.name || 'Destination'}`}
          </button>

          {lastReceivedMessage !== undefined && (
            <div className={`mt-3 p-3 rounded-xl border ${
              lastReceivedMessage === message
                ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                : 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'
            }`}>
              <div className="flex items-center gap-2 mb-1">
                {lastReceivedMessage === message ? (
                  <Check className="w-4 h-4 text-green-600 dark:text-green-400" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                )}
                <span className={`text-sm font-medium ${
                  lastReceivedMessage === message
                    ? 'text-green-700 dark:text-green-300'
                    : 'text-amber-700 dark:text-amber-300'
                }`}>
                  {lastReceivedMessage === message ? 'Message Delivered!' : 'Different Message'}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs mt-2">
                <span className="text-zinc-500 dark:text-zinc-400">Received:</span>
                <code className={`font-mono ${
                  lastReceivedMessage === message
                    ? 'text-green-700 dark:text-green-300'
                    : 'text-amber-700 dark:text-amber-300'
                }`}>
                  {lastReceivedMessage}
                </code>
              </div>
              {lastReceivedMessage !== message && (
                <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-2">
                  Message may still be in transit. Wait a few seconds and query again.
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="shrink-0 px-4 py-2.5 border-t border-zinc-200/80 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 flex items-center justify-between">
        <a
          href="https://build.avax.network/academy/interchain-messaging"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 flex items-center gap-1 transition-colors"
        >
          <ExternalLink className="w-3 h-3" />
          ICM Academy
        </a>
        <span className="text-[11px] text-zinc-400">
          Inter-Chain Messaging
        </span>
      </div>
    </div>
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
      {messageForm}
      <StepCodeViewer
        activeStep={activeStep}
        steps={codeSteps}
        className="h-[700px]"
      />
    </div>
  );
}

export default withConsoleToolMetadata(SendICMMessage, metadata);
