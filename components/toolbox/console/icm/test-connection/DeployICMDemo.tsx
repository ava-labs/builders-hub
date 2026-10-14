'use client';

import { useToolboxStore, useViemChainStore } from '@/components/toolbox/stores/toolboxStore';
import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import { useState, useEffect } from 'react';
import ICMDemoABI from '@/contracts/example-contracts/compiled/ICMDemo.json';
import TeleporterMessengerAddress from '@/contracts/icm-contracts-releases/v1.0.0/TeleporterMessenger_Contract_Address_v1.0.0.txt.json';
import { useSelectedL1 } from '@/components/toolbox/stores/l1ListStore';
import { WalletRequirementsConfigKey } from '@/components/toolbox/hooks/useWalletRequirements';
import useConsoleNotifications from '@/hooks/useConsoleNotifications';
import {
  BaseConsoleToolProps,
  ConsoleToolMetadata,
  withConsoleToolMetadata,
} from '@/components/toolbox/components/WithConsoleToolMetadata';
import { useConnectedWallet } from '@/components/toolbox/contexts/ConnectedWalletContext';
import { generateConsoleToolGitHubUrl } from '@/components/toolbox/utils/githubUrl';
import { StepCodeViewer, StepConfig } from '@/components/console/step-code-viewer';
import { Alert } from '@/components/toolbox/components/Alert';
import { Button } from '@/components/toolbox/components/Button';
import { Success } from '@/components/toolbox/components/Success';
import { DocsLink, Fact, Facts, HoverArrow, Panel, StatusLine } from '@/components/toolbox/console/icm/ui';

const SENDER_C_CHAIN_ADDRESS = '0x05c474824e7d2cc67cf22b456f7cf60c0e3a1289';

const metadata: ConsoleToolMetadata = {
  title: 'Deploy ICM Demo Contract',
  description:
    "Deploy a demo contract that can receive messages from the C-Chain using Avalanche's Inter-Chain Messaging (ICM) protocol",
  toolRequirements: [WalletRequirementsConfigKey.WalletConnected],
  githubUrl: generateConsoleToolGitHubUrl(import.meta.url),
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

const getCodeSteps = (params: { chainId: string; rpcUrl: string; contractAddress: string }): StepConfig[] => [
  {
    id: 'contract-source',
    title: 'ICMDemo Contract',
    description: 'Cross-chain sender and receiver',
    codeType: 'solidity',
    filename: 'ICMDemo.sol',
    code: ICM_DEMO_SOURCE,
    githubUrl:
      'https://github.com/ava-labs/avalanche-starter-kit/blob/main/contracts/interchain-messaging/send-receive/',
  },
  {
    id: 'deploy-sdk',
    title: 'Deploy via SDK',
    description: 'Using viem to deploy the contract',
    codeType: 'typescript',
    filename: 'deploy-icm-demo.ts',
    code: `import { createWalletClient, createPublicClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";

// Your L1 chain configuration
const chain = {
  id: ${params.chainId || 'YOUR_CHAIN_ID'},
  name: "Your L1",
  rpcUrls: { default: { http: ["${params.rpcUrl || 'YOUR_RPC_URL'}"] } },
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
    id: 'verify-deployment',
    title: 'Verify Deployment',
    description: 'Check the contract is working',
    codeType: 'typescript',
    filename: 'verify-icm-demo.ts',
    code: `import { createPublicClient, http } from "viem";

const publicClient = createPublicClient({
  transport: http("${params.rpcUrl || 'YOUR_RPC_URL'}")
});

// Read the TeleporterMessenger address from the contract
const messengerAddress = await publicClient.readContract({
  address: "${params.contractAddress || '0x...'}",
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
  address: "${params.contractAddress || '0x...'}",
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
  const { walletClient } = useConnectedWallet();
  const viemChain = useViemChainStore();
  const [isDeploying, setIsDeploying] = useState(false);
  const [isTeleporterDeployed, setIsTeleporterDeployed] = useState(false);
  const [criticalError, setCriticalError] = useState<Error | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const selectedL1 = useSelectedL1();
  const { notify } = useConsoleNotifications();
  const [activeStep, _setActiveStep] = useState(0);

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
      } catch {
        setIsTeleporterDeployed(false);
      }
    }

    checkTeleporterExists();
  }, [selectedL1?.evmChainId]);

  async function handleDeploy() {
    setLocalError(null);

    const targetChainId = viemChain?.id;
    if (!targetChainId) {
      setLocalError('No target chain selected.');
      return;
    }

    try {
      const currentChainId = await walletClient.getChainId();
      if (currentChainId !== targetChainId) {
        try {
          await walletClient.switchChain({ id: targetChainId });
        } catch {
          setLocalError(
            `Switch your wallet to ${selectedL1?.name ?? `chain ${targetChainId}`} (chain ${targetChainId}) to deploy.`,
          );
          return;
        }
      }
    } catch {
      setLocalError('Could not read the connected wallet chain. Please reconnect and try again.');
      return;
    }

    setIsDeploying(true);
    setIcmReceiverAddress('');
    try {
      const deployPromise = walletClient.deployContract({
        abi: ICMDemoABI.abi as any,
        bytecode: ICMDemoABI.bytecode.object as `0x${string}`,
        args: [],
        account: walletEVMAddress as `0x${string}`,
        chain: viemChain,
      });

      notify(
        {
          type: 'deploy',
          name: 'ICMDemo',
        },
        deployPromise,
        viemChain ?? undefined,
      );

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
    chainId: selectedL1?.evmChainId?.toString() || '',
    rpcUrl: selectedL1?.rpcUrl || '',
    contractAddress: icmReceiverAddress || '',
  });

  const deployForm = (
    <Panel
      eyebrow="Demo contract"
      title="Deploy ICMDemo"
      description="One contract that both sends and receives cross-chain messages, for testing delivery between L1s."
      footer={
        <>
          <DocsLink href="https://build.avax.network/academy/avalanche-l1/interchain-messaging/03-icm-protocol/04-receiving-a-message">
            ICM basics tutorial
          </DocsLink>
          <span className="font-mono text-[10.5px] text-zinc-400 dark:text-zinc-500">ICM demo</span>
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
        <Fact label="Messenger">
          {isTeleporterDeployed ? (
            <span className="flex flex-col gap-1">
              <StatusLine tone="done">Found on this chain</StatusLine>
              <span className="font-mono text-[11.5px] text-zinc-500 dark:text-zinc-400">
                {TeleporterMessengerAddress.content}
              </span>
            </span>
          ) : (
            <StatusLine tone="error">Not found on this chain</StatusLine>
          )}
        </Fact>
        <Fact label="C-Chain sender">
          <span className="flex flex-col gap-1">
            <a
              href={`/explorer/fuji/c-chain/address/${SENDER_C_CHAIN_ADDRESS}`}
              target="_blank"
              rel="noopener noreferrer"
              className="group/link inline-flex max-w-full items-center gap-1.5 font-mono text-[12.5px] text-[#0061E2] underline-offset-4 hover:underline dark:text-[#5f9dff]"
            >
              <span className="min-w-0 break-all">{SENDER_C_CHAIN_ADDRESS}</span>
              <HoverArrow />
            </a>
            <span className="text-[12px] font-normal text-zinc-500 dark:text-zinc-400">
              Pre-deployed on the C-Chain. Use it to send test messages to your L1.
            </span>
          </span>
        </Fact>
      </Facts>

      {!isTeleporterDeployed && (
        <Alert variant="error">Deploy TeleporterMessenger on this chain first to enable cross-chain messages.</Alert>
      )}

      {localError && <Alert variant="error">{localError}</Alert>}

      {icmReceiverAddress ? (
        <>
          <Success label="ICMDemo address" value={icmReceiverAddress} confirmed />
          <StatusLine tone="done">Ready to send messages. Continue to the next step.</StatusLine>
          <Button
            variant="outline"
            onClick={handleDeploy}
            loading={isDeploying}
            loadingText="Deploying"
            disabled={!isTeleporterDeployed}
          >
            Redeploy ICMDemo
          </Button>
        </>
      ) : (
        <Button onClick={handleDeploy} loading={isDeploying} loadingText="Deploying" disabled={!isTeleporterDeployed}>
          Deploy ICMDemo
        </Button>
      )}
    </Panel>
  );

  return (
    <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
      {deployForm}
      <StepCodeViewer
        activeStep={activeStep}
        steps={codeSteps}
        className="h-[600px] rounded-none border-zinc-200 dark:bg-zinc-950"
      />
    </div>
  );
}

export default withConsoleToolMetadata(DeployICMDemo, metadata);
