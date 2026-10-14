'use client';

import { useToolboxStore, useViemChainStore, getToolboxStore } from '@/components/toolbox/stores/toolboxStore';
import { useState, useMemo } from 'react';
import { makePublicClientForChain } from '@/components/toolbox/hooks/usePublicClientForChain';
import ICMDemoABI from '@/contracts/example-contracts/compiled/ICMDemo.json';
import { CB58ToHex } from '@avalanche-sdk/client/utils';
import SelectBlockchainId from '@/components/toolbox/components/SelectBlockchainId';
import { useL1ByChainId, useSelectedL1 } from '@/components/toolbox/stores/l1ListStore';
import { useEffect } from 'react';
import { WalletRequirementsConfigKey } from '@/components/toolbox/hooks/useWalletRequirements';
import {
  BaseConsoleToolProps,
  ConsoleToolMetadata,
  withConsoleToolMetadata,
} from '@/components/toolbox/components/WithConsoleToolMetadata';
import { useConnectedWallet } from '@/components/toolbox/contexts/ConnectedWalletContext';
import useConsoleNotifications from '@/hooks/useConsoleNotifications';
import { generateConsoleToolGitHubUrl } from '@/components/toolbox/utils/githubUrl';
import { StepCodeViewer, StepConfig } from '@/components/console/step-code-viewer';
import { cn } from '@/lib/utils';
import { Alert } from '@/components/toolbox/components/Alert';
import { Button } from '@/components/toolbox/components/Button';
import { RawInput } from '@/components/toolbox/components/Input';
import { Success } from '@/components/toolbox/components/Success';
import {
  DocsLink,
  EYEBROW,
  Field,
  Panel,
  StatusDot,
  StatusLine,
  type DotTone,
} from '@/components/toolbox/console/icm/ui';

const predeployedDemos: Record<string, string> = {
  //fuji
  yH8D7ThNJkxmtkuv2jgBa4P1Rn3Qpr4pPr7QYNfcdoS6k6HWp: '0x05c474824e7d2cc67cf22b456f7cf60c0e3a1289',
};

const metadata: ConsoleToolMetadata = {
  title: 'Send ICM Message',
  description: "Send a test message between L1s using Avalanche's Inter-Chain Messaging (ICM) protocol",
  toolRequirements: [WalletRequirementsConfigKey.WalletConnected],
  githubUrl: generateConsoleToolGitHubUrl(import.meta.url),
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
    id: 'send-message',
    title: 'Send Cross-Chain Message',
    description: 'Call sendMessage on source chain',
    codeType: 'typescript',
    filename: 'send-icm-message.ts',
    code: `import { createWalletClient, createPublicClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";

// Source chain (${params.sourceChainName || 'Your L1'})
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
const sourceContract = "${params.sourceContractAddress || '0x...'}";

// Destination blockchain ID (hex encoded)
const destinationBlockchainID = "${params.destBlockchainId || '0x...'}";

// Destination contract address
const destinationAddress = "${params.destContractAddress || '0x...'}";

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
    id: 'relayer-delivery',
    title: 'Relayer Delivery',
    description: 'How the message is delivered',
    codeType: 'typescript',
    filename: 'message-flow.ts',
    code: `/**
 * Cross-Chain Message Flow
 * ========================
 *
 * 1. SEND (Source Chain - ${params.sourceChainName || 'Your L1'})
 *    └─ ICMDemo.sendMessage() calls TeleporterMessenger.sendCrossChainMessage()
 *    └─ Message is emitted as an event on source chain
 *
 * 2. RELAY (Off-chain)
 *    └─ ICM Relayer monitors TeleporterMessenger events
 *    └─ Relayer picks up the message
 *    └─ Relayer constructs a Warp signature from validators
 *    └─ Relayer submits message to destination chain
 *
 * 3. RECEIVE (Destination Chain - ${params.destChainName || 'Destination'})
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
    id: 'query-message',
    title: 'Query Received Message',
    description: 'Read lastMessage on destination',
    codeType: 'typescript',
    filename: 'query-message.ts',
    code: `import { createPublicClient, http } from "viem";

// Destination chain client (${params.destChainName || 'Destination'})
const destClient = createPublicClient({
  transport: http("${params.destRpcUrl || 'DESTINATION_RPC_URL'}")
});

// ICMDemo contract on destination chain
const destContract = "${params.destContractAddress || '0x...'}";

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
  const { walletClient } = useConnectedWallet();
  const selectedL1 = useSelectedL1();
  const [message, setMessage] = useState(Math.floor(Math.random() * 10000));
  const [destinationChainId, setDestinationChainId] = useState<string>('');
  const [isSending, setIsSending] = useState(false);
  const [lastTxId, setLastTxId] = useState<string>();
  const viemChain = useViemChainStore();
  const [isQuerying, setIsQuerying] = useState(false);
  const [lastReceivedMessage, setLastReceivedMessage] = useState<number>();
  const [localError, setLocalError] = useState<string | null>(null);
  const { notify } = useConsoleNotifications();
  const [activeStep, _setActiveStep] = useState(0);

  if (criticalError) {
    throw criticalError;
  }

  const targetToolboxStore = getToolboxStore(destinationChainId)();
  const targetL1 = useL1ByChainId(destinationChainId);

  const sourceContractError = icmReceiverAddress ? undefined : 'Deploy ICMDemo on source chain first';
  const targetContractError = targetToolboxStore.icmReceiverAddress
    ? undefined
    : 'Deploy ICMDemo on destination chain first';

  let destinationChainError: string | undefined = undefined;
  if (!destinationChainId) {
    destinationChainError = 'Please select a destination chain';
  } else if (selectedL1?.id === destinationChainId) {
    destinationChainError = 'Source and destination cannot be the same';
  }

  const destinationBlockchainIDHex = useMemo(() => {
    if (!targetL1?.id) return undefined;
    try {
      return CB58ToHex(targetL1.id);
    } catch (e) {
      console.error('Error decoding destination chain ID:', e);
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
    setLocalError(null);

    if (!icmReceiverAddress || !targetToolboxStore.icmReceiverAddress || !destinationBlockchainIDHex || !viemChain) {
      setCriticalError(new Error('Missing required information to send message.'));
      return;
    }

    const targetChainId = viemChain.id;
    try {
      const currentChainId = await walletClient.getChainId();
      if (currentChainId !== targetChainId) {
        try {
          await walletClient.switchChain({ id: targetChainId });
        } catch {
          setLocalError(
            `Switch your wallet to ${selectedL1?.name ?? `chain ${targetChainId}`} (chain ${targetChainId}) to send the message.`,
          );
          return;
        }
      }
    } catch {
      setLocalError('Could not read the connected wallet chain. Please reconnect and try again.');
      return;
    }

    setIsSending(true);
    setLastTxId(undefined);
    try {
      const sourceAddress = icmReceiverAddress as `0x${string}`;
      const destinationAddress = targetToolboxStore.icmReceiverAddress as `0x${string}`;

      const publicClient = makePublicClientForChain(viemChain.rpcUrls.default.http[0], [], viemChain);
      if (!publicClient) {
        throw new Error('Could not create public client for source chain');
      }

      if (!walletClient.account) {
        throw new Error('No wallet account connected');
      }

      const { request } = await publicClient.simulateContract({
        address: sourceAddress,
        abi: ICMDemoABI.abi,
        functionName: 'sendMessage',
        args: [destinationAddress, BigInt(message), destinationBlockchainIDHex as `0x${string}`],
        account: walletClient.account,
        chain: viemChain,
      });

      const writePromise = walletClient.writeContract(request);

      notify(
        {
          type: 'call',
          name: 'Send ICM Message',
        },
        writePromise,
        viemChain ?? undefined,
      );

      const hash = await writePromise;
      setLastTxId(hash);
      onSuccess?.();
    } catch (error) {
      console.error('ICM Send Error:', error);
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
      const destinationClient = makePublicClientForChain(targetL1.rpcUrl);
      if (!destinationClient) {
        setCriticalError(new Error('Could not resolve destination chain RPC'));
        return;
      }

      const lastMessage = await destinationClient.readContract({
        address: targetToolboxStore.icmReceiverAddress as `0x${string}`,
        abi: ICMDemoABI.abi,
        functionName: 'lastMessage',
      });

      setLastReceivedMessage(Number(lastMessage));
    } catch (error) {
      console.error('ICM Query Error:', error);
      setCriticalError(error instanceof Error ? error : new Error(String(error)));
    } finally {
      setIsQuerying(false);
    }
  }

  const isButtonDisabled =
    isSending ||
    !!sourceContractError ||
    !!targetContractError ||
    !!destinationChainError ||
    !message ||
    !destinationBlockchainIDHex;

  const isQueryButtonDisabled = isQuerying || !targetToolboxStore.icmReceiverAddress || !targetL1?.rpcUrl;

  const codeSteps = getCodeSteps({
    sourceChainName: selectedL1?.name || '',
    sourceContractAddress: icmReceiverAddress || '',
    destChainName: targetL1?.name || '',
    destContractAddress: targetToolboxStore.icmReceiverAddress || '',
    destBlockchainId: destinationBlockchainIDHex || '',
    destRpcUrl: targetL1?.rpcUrl || '',
    message: message,
  });

  const delivered = lastReceivedMessage !== undefined && lastReceivedMessage === message;
  const sourceName = selectedL1?.name || 'Source';
  const destName = targetL1?.name || 'Destination';
  const timeline: { label: string; tone: DotTone; detail?: string }[] = [
    {
      label: `Sent on ${sourceName}`,
      tone: isSending ? 'live' : lastTxId ? 'done' : 'idle',
      detail: isSending ? 'Waiting for your wallet' : lastTxId ? 'Transaction submitted' : undefined,
    },
    {
      label: 'Relayer delivers',
      tone: delivered ? 'done' : lastTxId ? 'live' : 'idle',
      detail: delivered ? 'Delivered' : lastTxId ? 'Usually 5 to 30 seconds' : undefined,
    },
    {
      label: `Received on ${destName}`,
      tone: delivered ? 'done' : lastReceivedMessage !== undefined ? 'warn' : 'idle',
      detail: delivered
        ? `lastMessage = ${lastReceivedMessage}`
        : lastReceivedMessage !== undefined
          ? `lastMessage = ${lastReceivedMessage}, not ${message} yet`
          : undefined,
    },
  ];

  const routeCell = (
    side: string,
    name: string,
    address: string | undefined,
    error: string | undefined,
    placeholder?: string,
  ) => (
    <div className="flex min-w-0 flex-col gap-1.5 bg-white px-4 py-3.5 dark:bg-zinc-950">
      <p className={EYEBROW}>{side}</p>
      <p className="truncate text-[14px] font-semibold text-zinc-900 dark:text-zinc-50">{name}</p>
      {placeholder ? (
        <p className="text-[12px] text-zinc-500 dark:text-zinc-400">{placeholder}</p>
      ) : address ? (
        <span className="font-mono text-[11.5px] text-zinc-600 [overflow-wrap:anywhere] dark:text-zinc-300">
          {address}
        </span>
      ) : (
        <StatusLine tone="error">{error}</StatusLine>
      )}
    </div>
  );

  const messageForm = (
    <Panel
      eyebrow="Live test"
      title="Send an ICM message"
      description="Send a number from this L1 and read it back on the destination once the relayer delivers it."
      footer={
        <>
          <DocsLink href="https://build.avax.network/academy/interchain-messaging">ICM academy</DocsLink>
          <span className="font-mono text-[10.5px] text-zinc-400 dark:text-zinc-500">Inter-Chain Messaging</span>
        </>
      }
    >
      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-stretch border border-zinc-200 bg-zinc-200 dark:border-zinc-800 dark:bg-zinc-800">
        {routeCell('From', sourceName, icmReceiverAddress || undefined, sourceContractError)}
        <span
          aria-hidden
          className="flex items-center bg-white px-3 font-mono text-[13px] text-zinc-400 dark:bg-zinc-950 dark:text-zinc-500"
        >
          →
        </span>
        {routeCell(
          'To',
          destName,
          targetToolboxStore.icmReceiverAddress || undefined,
          targetContractError,
          targetL1 ? undefined : 'Pick a destination below.',
        )}
      </div>

      <Field label="Destination chain">
        <SelectBlockchainId
          value={destinationChainId}
          onChange={(value) => setDestinationChainId(value)}
          error={destinationChainError}
        />
      </Field>

      <Field label="Message (number)" htmlFor="icm-message">
        <RawInput
          id="icm-message"
          type="number"
          value={message}
          onChange={(e) => setMessage(Number(e.target.value) || 0)}
          className="font-mono tabular-nums"
          placeholder="Enter a number"
        />
      </Field>

      {localError && <Alert variant="error">{localError}</Alert>}

      <Button onClick={handleSendMessage} loading={isSending} loadingText="Sending" disabled={isButtonDisabled}>
        Send message to {destName}
      </Button>

      {lastTxId && <Success label="Message transaction" value={lastTxId} />}

      <div className="flex flex-col gap-3 border-t border-zinc-200 pt-5 dark:border-zinc-800">
        <p className={EYEBROW}>Message status</p>
        <ol className="flex flex-col">
          {timeline.map((s, i) => (
            <li key={s.label} className="relative grid grid-cols-[0.75rem_minmax(0,1fr)] gap-x-3 pb-4 last:pb-0">
              <span className="relative flex justify-center pt-[7px]">
                <StatusDot tone={s.tone} />
                {i < timeline.length - 1 && (
                  <span aria-hidden className="absolute bottom-[-3px] top-[17px] w-px bg-zinc-200 dark:bg-zinc-800" />
                )}
              </span>
              <span className="flex min-w-0 flex-col">
                <span
                  className={cn(
                    'font-mono text-[12px]',
                    s.tone === 'idle' ? 'text-zinc-400 dark:text-zinc-500' : 'text-zinc-900 dark:text-zinc-50',
                  )}
                >
                  <span className="mr-2 tabular-nums text-zinc-400 dark:text-zinc-500">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  {s.label}
                </span>
                {s.detail && (
                  <span
                    className={cn(
                      'font-mono text-[11px]',
                      s.tone === 'warn' ? 'text-amber-700 dark:text-amber-300' : 'text-zinc-500 dark:text-zinc-400',
                    )}
                  >
                    {s.detail}
                  </span>
                )}
              </span>
            </li>
          ))}
        </ol>
      </div>

      <div className="flex flex-col gap-3 border-t border-zinc-200 pt-5 dark:border-zinc-800">
        <p className={EYEBROW}>Check delivery</p>
        <Button
          variant="outline"
          onClick={queryLastMessage}
          loading={isQuerying}
          loadingText="Querying"
          disabled={isQueryButtonDisabled}
        >
          Query {destName}
        </Button>
        {lastReceivedMessage !== undefined &&
          (delivered ? (
            <Alert variant="success">
              Delivered. {destName} received <span className="font-mono">{lastReceivedMessage}</span>.
            </Alert>
          ) : (
            <Alert variant="warning">
              {destName} last received <span className="font-mono">{lastReceivedMessage}</span>. The message may still
              be in transit: wait a few seconds and query again.
            </Alert>
          ))}
      </div>
    </Panel>
  );

  return (
    <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
      {messageForm}
      <StepCodeViewer
        activeStep={activeStep}
        steps={codeSteps}
        className="h-[700px] rounded-none border-zinc-200 dark:bg-zinc-950"
      />
    </div>
  );
}

export default withConsoleToolMetadata(SendICMMessage, metadata);
