"use client";

import { useState } from "react";
import { useWalletStore } from "../../lib/walletStore";
import { useViemChainStore, useSelectedL1 } from "../toolboxStore";
import { Button } from "../../components/Button";
import { Container } from "../components/Container";
import { Input } from "../../components/Input";
import { Success } from "../../components/Success";
import { AllowlistComponent } from "../components/AllowListComponents";
import warpMessengerAbi from "../../../contracts/precompiles/WarpMessenger.json";
import { utils } from "@avalabs/avalanchejs";
import { RadioGroup } from "../../components/RadioGroup";
import { avalancheFuji } from 'viem/chains';
import { createPublicClient, http } from 'viem';

// Default Warp Messenger address
const DEFAULT_WARP_MESSENGER_ADDRESS =
  "0x0200000000000000000000000000000000000005";

type MessageDirection = "CtoL1" | "L1toC";

export default function WarpMessenger() {
  const { coreWalletClient, publicClient, walletEVMAddress } = useWalletStore();
  const viemChain = useViemChainStore();
  const selectedL1 = useSelectedL1()();
  const [messagePayload, setMessagePayload] = useState<string>("");
  const [blockIndex, setBlockIndex] = useState<string>("");
  const [messageIndex, setMessageIndex] = useState<string>("");
  const [blockchainID, setBlockchainID] = useState<string | null>(null);
  const [warpBlockHash, setWarpBlockHash] = useState<any>(null);
  const [warpMessage, setWarpMessage] = useState<any>(null);
  const [messageID, setMessageID] = useState<string | null>(null);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [isGettingBlockHash, setIsGettingBlockHash] = useState(false);
  const [isGettingMessage, setIsGettingMessage] = useState(false);
  const [isGettingBlockchainID, setIsGettingBlockchainID] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [messageDirection, setMessageDirection] = useState<MessageDirection>("CtoL1");

  const directionOptions = [
    { value: "CtoL1", label: "C-Chain to Subnet (L1)" },
    { value: "L1toC", label: "Subnet (L1) to C-Chain" },
  ];

  // Get the appropriate chain for the current direction
  const requiredChain = messageDirection === "CtoL1" ? avalancheFuji : viemChain;

  // Create a client for the required chain
  const selectedPublicClient = createPublicClient({
    transport: http(requiredChain?.rpcUrls.default.http[0]),
  });

  const handleSendWarpMessage = async () => {
    if (!coreWalletClient) throw new Error("Wallet client not found");
    if (!requiredChain) throw new Error("Invalid chain");

    setIsSendingMessage(true);

    try {
      const { request } = await selectedPublicClient.simulateContract({
        address: DEFAULT_WARP_MESSENGER_ADDRESS as `0x${string}`,
        abi: warpMessengerAbi.abi,
        functionName: "sendWarpMessage",
        args: [messagePayload],
        chain: requiredChain,
      });

      const hash = await coreWalletClient.writeContract(request);
      const receipt = await selectedPublicClient.waitForTransactionReceipt({ hash });

      if (receipt.status === "success") {
        setTxHash(hash);
        // Get the message ID from the event logs
        const event = receipt.logs.find(
          (log) =>
            log.topics[0] ===
            "0x" +
            warpMessengerAbi.abi
              .find(
                (item) =>
                  item.type === "event" && item.name === "SendWarpMessage"
              )
              ?.name?.toLowerCase()
        );
        if (event && event.topics[1]) {
          setMessageID(event.topics[1]);
        }
      } else {
        throw new Error("Transaction failed");
      }
    } finally {
      setIsSendingMessage(false);
    }
  };

  const handleGetBlockchainID = async () => {
    setIsGettingBlockchainID(true);

    const result = await selectedPublicClient.readContract({
      address: DEFAULT_WARP_MESSENGER_ADDRESS as `0x${string}`,
      abi: warpMessengerAbi.abi,
      functionName: "getBlockchainID",
    });

    setBlockchainID(result as string);
    setIsGettingBlockchainID(false);
  };

  const handleGetVerifiedWarpBlockHash = async () => {
    setIsGettingBlockHash(true);

    const result = await selectedPublicClient.readContract({
      address: DEFAULT_WARP_MESSENGER_ADDRESS as `0x${string}`,
      abi: warpMessengerAbi.abi,
      functionName: "getVerifiedWarpBlockHash",
      args: [parseInt(blockIndex)],
    });

    setWarpBlockHash(result);
    setIsGettingBlockHash(false);
  };

  const handleGetVerifiedWarpMessage = async () => {
    setIsGettingMessage(true);

    const result = await selectedPublicClient.readContract({
      address: DEFAULT_WARP_MESSENGER_ADDRESS as `0x${string}`,
      abi: warpMessengerAbi.abi,
      functionName: "getVerifiedWarpMessage",
      args: [parseInt(messageIndex)],
    });

    setWarpMessage(result);
    setIsGettingMessage(false);
  };

  const canSendMessage = Boolean(
    messagePayload &&
    walletEVMAddress &&
    coreWalletClient &&
    !isSendingMessage
  );

  const canGetBlockHash = Boolean(
    blockIndex &&
    !isGettingBlockHash &&
    !isSendingMessage
  );

  const canGetMessage = Boolean(
    messageIndex &&
    !isGettingMessage &&
    !isSendingMessage
  );

  const isAnyOperationInProgress = Boolean(
    isSendingMessage ||
    isGettingBlockHash ||
    isGettingMessage ||
    isGettingBlockchainID
  );

  const sourceChainText = messageDirection === "CtoL1" ? "C-Chain" : "Subnet (L1)";
  const destinationChainText = messageDirection === "CtoL1" ? "Subnet (L1)" : "C-Chain";

  return (
    <div className="space-y-6">
      <Container
        title="Warp Messenger"
        description="Send and verify cross-chain messages using the Warp protocol."
      >
        <div className="space-y-4">
          <div className="p-4 border rounded-md bg-gray-50 dark:bg-gray-900/50">
            <RadioGroup
              items={directionOptions}
              value={messageDirection}
              onChange={(value) => setMessageDirection(value as MessageDirection)}
              idPrefix="message-direction-"
            />
          </div>

          <div className="space-y-4">
            <div className="flex space-x-4">
              <Button
                variant="primary"
                onClick={handleGetBlockchainID}
                disabled={isAnyOperationInProgress}
                loading={isGettingBlockchainID}
              >
                Get Blockchain ID
              </Button>
            </div>

            {blockchainID && (
              <Success label="Blockchain ID" value={blockchainID} />
            )}

            <div className="space-y-2">
              <Input
                label="Message Payload (hex)"
                value={messagePayload}
                onChange={setMessagePayload}
                disabled={isAnyOperationInProgress}
              />
              <Button
                variant="primary"
                onClick={handleSendWarpMessage}
                loading={isSendingMessage}
                disabled={!canSendMessage}
              >
                Send Warp Message from {sourceChainText} to {destinationChainText}
              </Button>
            </div>

            {messageID && <Success label="Message ID" value={messageID} />}

            <div className="space-y-2">
              <Input
                label="Block Index"
                value={blockIndex}
                onChange={setBlockIndex}
                type="number"
                min="0"
                disabled={isAnyOperationInProgress}
              />
              <Button
                variant="secondary"
                onClick={handleGetVerifiedWarpBlockHash}
                loading={isGettingBlockHash}
                disabled={!canGetBlockHash}
              >
                Get Verified Warp Block Hash
              </Button>
            </div>

            {warpBlockHash && (
              <div className="space-y-2">
                <Success
                  label="Source Chain ID"
                  value={warpBlockHash[0].sourceChainID}
                />
                <Success
                  label="Block Hash"
                  value={warpBlockHash[0].blockHash}
                />
                <Success
                  label="Valid"
                  value={warpBlockHash[1] ? "Yes" : "No"}
                />
              </div>
            )}

            <div className="space-y-2">
              <Input
                label="Message Index"
                value={messageIndex}
                onChange={setMessageIndex}
                type="number"
                min="0"
                disabled={isAnyOperationInProgress}
              />
              <Button
                variant="secondary"
                onClick={handleGetVerifiedWarpMessage}
                loading={isGettingMessage}
                disabled={!canGetMessage}
              >
                Get Verified Warp Message
              </Button>
            </div>

            {warpMessage && (
              <div className="space-y-2">
                <Success
                  label="Source Chain ID"
                  value={warpMessage[0].sourceChainID}
                />
                <Success
                  label="Origin Sender Address"
                  value={warpMessage[0].originSenderAddress}
                />
                <Success
                  label="Payload"
                  value={warpMessage[0].payload}
                />
                <Success
                  label="Valid"
                  value={warpMessage[1] ? "Yes" : "No"}
                />
              </div>
            )}
          </div>

          {txHash && (
            <div className="space-y-2">
              <Success
                label="Transaction Successful"
                value={txHash}
              />
              {txHash && (
                <a
                  href={`https://subnets-test.avax.network/${messageDirection === "CtoL1" ? "c-chain" : viemChain?.name?.toLowerCase()}/tx/${txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-500 hover:underline"
                >
                  View on Explorer
                </a>
              )}
            </div>
          )}
        </div>
      </Container>

      <div className="w-full">
        <AllowlistComponent
          precompileAddress={DEFAULT_WARP_MESSENGER_ADDRESS}
          precompileType="Warp Messenger"
        />
      </div>
    </div>
  );
}
