"use client";

import { useState } from "react";
import { useWalletStore } from "../../lib/walletStore";
import { useViemChainStore } from "../toolboxStore";
import { Button } from "../../components/Button";
import { Container } from "../components/Container";
import { EVMAddressInput } from "../components/EVMAddressInput";
import { ResultField } from "../components/ResultField";
import { AllowListWrapper } from "../components/AllowListComponents";
import warpMessengerAbi from "../../../contracts/precompiles/WarpMessenger.json";

// Default Warp Messenger address
const DEFAULT_WARP_MESSENGER_ADDRESS =
  "0x0200000000000000000000000000000000000005";

export default function WarpMessenger() {
  const { coreWalletClient, publicClient, walletEVMAddress } = useWalletStore();
  const viemChain = useViemChainStore();
  const [warpMessengerAddress, setWarpMessengerAddress] = useState<string>(
    DEFAULT_WARP_MESSENGER_ADDRESS
  );
  const [messagePayload, setMessagePayload] = useState<string>("");
  const [blockIndex, setBlockIndex] = useState<string>("");
  const [messageIndex, setMessageIndex] = useState<string>("");
  const [blockchainID, setBlockchainID] = useState<string | null>(null);
  const [warpBlockHash, setWarpBlockHash] = useState<any>(null);
  const [warpMessage, setWarpMessage] = useState<any>(null);
  const [messageID, setMessageID] = useState<string | null>(null);
  const [isAddressSet, setIsAddressSet] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [isGettingBlockHash, setIsGettingBlockHash] = useState(false);
  const [isGettingMessage, setIsGettingMessage] = useState(false);
  const [isGettingBlockchainID, setIsGettingBlockchainID] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);

  const handleSetAddress = async () => {
    setIsProcessing(true);

    if (warpMessengerAddress === DEFAULT_WARP_MESSENGER_ADDRESS) {
      setIsAddressSet(true);
      setIsProcessing(false);
      return;
    }

    const code = await publicClient.getBytecode({
      address: warpMessengerAddress as `0x${string}`,
    });

    if (!code || code === "0x") {
      throw new Error("Invalid contract address");
    }

    setIsAddressSet(true);
    setIsProcessing(false);
  };

  const handleSendWarpMessage = async () => {
    if (!coreWalletClient) throw new Error("Wallet client not found");

    setIsSendingMessage(true);

    try {
      const hash = await coreWalletClient.writeContract({
        address: warpMessengerAddress as `0x${string}`,
        abi: warpMessengerAbi.abi,
        functionName: "sendWarpMessage",
        args: [messagePayload],
        account: walletEVMAddress as `0x${string}`,
        chain: viemChain,
      });

      const receipt = await publicClient.waitForTransactionReceipt({ hash });

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

    const result = await publicClient.readContract({
      address: warpMessengerAddress as `0x${string}`,
      abi: warpMessengerAbi.abi,
      functionName: "getBlockchainID",
    });

    setBlockchainID(result as string);
    setIsGettingBlockchainID(false);
  };

  const handleGetVerifiedWarpBlockHash = async () => {
    setIsGettingBlockHash(true);

    const result = await publicClient.readContract({
      address: warpMessengerAddress as `0x${string}`,
      abi: warpMessengerAbi.abi,
      functionName: "getVerifiedWarpBlockHash",
      args: [parseInt(blockIndex)],
    });

    setWarpBlockHash(result);
    setIsGettingBlockHash(false);
  };

  const handleGetVerifiedWarpMessage = async () => {
    setIsGettingMessage(true);

    const result = await publicClient.readContract({
      address: warpMessengerAddress as `0x${string}`,
      abi: warpMessengerAbi.abi,
      functionName: "getVerifiedWarpMessage",
      args: [parseInt(messageIndex)],
    });

    setWarpMessage(result);
    setIsGettingMessage(false);
  };

  const canSetAddress = Boolean(
    warpMessengerAddress &&
    walletEVMAddress &&
    !isProcessing
  );

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
    isProcessing ||
    isSendingMessage ||
    isGettingBlockHash ||
    isGettingMessage ||
    isGettingBlockchainID
  );

  if (!isAddressSet) {
    return (
      <Container
        title="Configure Warp Messenger"
        description="Set the address of the Warp Messenger precompile contract. The default address is pre-filled, but you can change it if needed."
      >
        <div className="space-y-4">
          <EVMAddressInput
            value={warpMessengerAddress}
            onChange={setWarpMessengerAddress}
            label="Warp Messenger Address"
            disabled={isProcessing}
          />

          <div className="flex space-x-4">
            <Button
              variant="primary"
              onClick={handleSetAddress}
              disabled={!canSetAddress}
              loading={isProcessing}
            >
              Use Default Address
            </Button>
            <Button
              variant="secondary"
              onClick={() => setWarpMessengerAddress("")}
              disabled={isProcessing}
            >
              Clear Address
            </Button>
          </div>
        </div>
      </Container>
    );
  }

  return (
    <div className="space-y-6">
      <Container
        title="Warp Messenger"
        description="Send and verify cross-chain messages."
      >
        <div className="space-y-4">
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
              <ResultField label="Blockchain ID" value={blockchainID} />
            )}

            <div className="space-y-2">
              <input
                type="text"
                placeholder="Message Payload (hex)"
                value={messagePayload}
                onChange={(e) => setMessagePayload(e.target.value)}
                className="w-full p-2 border rounded"
                disabled={isAnyOperationInProgress}
              />
              <Button
                variant="primary"
                onClick={handleSendWarpMessage}
                loading={isSendingMessage}
                disabled={!canSendMessage}
              >
                Send Warp Message
              </Button>
            </div>

            {messageID && <ResultField label="Message ID" value={messageID} />}

            <div className="space-y-2">
              <input
                type="number"
                placeholder="Block Index"
                value={blockIndex}
                onChange={(e) => setBlockIndex(e.target.value)}
                className="w-full p-2 border rounded"
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
                <ResultField
                  label="Source Chain ID"
                  value={warpBlockHash[0].sourceChainID}
                />
                <ResultField
                  label="Block Hash"
                  value={warpBlockHash[0].blockHash}
                />
                <ResultField
                  label="Valid"
                  value={warpBlockHash[1] ? "Yes" : "No"}
                />
              </div>
            )}

            <div className="space-y-2">
              <input
                type="number"
                placeholder="Message Index"
                value={messageIndex}
                onChange={(e) => setMessageIndex(e.target.value)}
                className="w-full p-2 border rounded"
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
                <ResultField
                  label="Source Chain ID"
                  value={warpMessage[0].sourceChainID}
                />
                <ResultField
                  label="Origin Sender Address"
                  value={warpMessage[0].originSenderAddress}
                />
                <ResultField label="Payload" value={warpMessage[0].payload} />
                <ResultField
                  label="Valid"
                  value={warpMessage[1] ? "Yes" : "No"}
                />
              </div>
            )}
          </div>

          {txHash && (
            <ResultField
              label="Transaction Successful"
              value={txHash}
              showCheck={true}
            />
          )}
        </div>
      </Container>

      <div className="w-full">
        <AllowListWrapper
          precompileAddress={warpMessengerAddress}
          precompileType="Warp Messenger"
        />
      </div>
    </div>
  );
}
