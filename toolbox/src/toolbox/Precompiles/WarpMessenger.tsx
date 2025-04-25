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
  const { coreWalletClient, publicClient, walletEVMAddress, walletChainId } =
    useWalletStore();
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
  const [error, setError] = useState<string | null>(null);
  const [isAddressSet, setIsAddressSet] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);

  const verifyChainConnection = async () => {
    try {
      const currentChainId = await publicClient.getChainId();
      console.log("Current chain ID:", currentChainId);

      const blockNumber = await publicClient.getBlockNumber();
      console.log("Current block number:", blockNumber);

      return true;
    } catch (error) {
      console.error("Chain verification failed:", error);
      return false;
    }
  };

  const handleSetAddress = async () => {
    if (!warpMessengerAddress) {
      setError("Warp Messenger address is required");
      return;
    }

    if (!walletEVMAddress) {
      setError("Please connect your wallet first");
      return;
    }

    try {
      const isConnected = await verifyChainConnection();
      if (!isConnected) {
        setError(
          "Failed to connect to the network. Please ensure your wallet is connected to the correct L1 chain (Current Chain ID: " +
            walletChainId +
            ")"
        );
        return;
      }

      if (warpMessengerAddress === DEFAULT_WARP_MESSENGER_ADDRESS) {
        setIsAddressSet(true);
        setError(null);
        return;
      }

      const code = await publicClient.getBytecode({
        address: warpMessengerAddress as `0x${string}`,
      });

      if (!code || code === "0x") {
        setError("Invalid contract address");
        return;
      }

      setIsAddressSet(true);
      setError(null);
    } catch (error) {
      console.error("Error verifying contract:", error);
      if (warpMessengerAddress === DEFAULT_WARP_MESSENGER_ADDRESS) {
        setIsAddressSet(true);
        setError(null);
      } else {
        setError(
          error instanceof Error
            ? error.message
            : "Failed to verify contract address"
        );
      }
    }
  };

  const handleSendWarpMessage = async () => {
    if (!walletEVMAddress) {
      setError("Please connect your wallet first");
      return;
    }

    if (!messagePayload) {
      setError("Message payload is required");
      return;
    }

    setIsProcessing(true);
    setError(null);

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
        setError("Transaction failed");
      }
    } catch (error) {
      console.error("Error sending warp message:", error);
      setError(
        error instanceof Error ? error.message : "Failed to send warp message"
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const handleGetBlockchainID = async () => {
    try {
      const result = await publicClient.readContract({
        address: warpMessengerAddress as `0x${string}`,
        abi: warpMessengerAbi.abi,
        functionName: "getBlockchainID",
      });

      setBlockchainID(result as string);
    } catch (error) {
      console.error("Error getting blockchain ID:", error);
      setError(
        error instanceof Error ? error.message : "Failed to get blockchain ID"
      );
    }
  };

  const handleGetVerifiedWarpBlockHash = async () => {
    if (!blockIndex) {
      setError("Block index is required");
      return;
    }

    try {
      const result = await publicClient.readContract({
        address: warpMessengerAddress as `0x${string}`,
        abi: warpMessengerAbi.abi,
        functionName: "getVerifiedWarpBlockHash",
        args: [parseInt(blockIndex)],
      });

      setWarpBlockHash(result);
    } catch (error) {
      console.error("Error getting verified warp block hash:", error);
      setError(
        error instanceof Error
          ? error.message
          : "Failed to get verified warp block hash"
      );
    }
  };

  const handleGetVerifiedWarpMessage = async () => {
    if (!messageIndex) {
      setError("Message index is required");
      return;
    }

    try {
      const result = await publicClient.readContract({
        address: warpMessengerAddress as `0x${string}`,
        abi: warpMessengerAbi.abi,
        functionName: "getVerifiedWarpMessage",
        args: [parseInt(messageIndex)],
      });

      setWarpMessage(result);
    } catch (error) {
      console.error("Error getting verified warp message:", error);
      setError(
        error instanceof Error
          ? error.message
          : "Failed to get verified warp message"
      );
    }
  };

  if (!isAddressSet) {
    return (
      <Container
        title="Configure Warp Messenger"
        description="Set the address of the Warp Messenger precompile contract. The default address is pre-filled, but you can change it if needed."
      >
        <div className="space-y-4">
          {error && (
            <div className="p-4 text-red-700 bg-red-100 rounded-md">
              {error}
            </div>
          )}

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
              disabled={!warpMessengerAddress || !walletEVMAddress}
            >
              Use Default Address
            </Button>
            <Button
              variant="secondary"
              onClick={() => setWarpMessengerAddress("")}
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
          {error && (
            <div className="p-4 text-red-700 bg-red-100 rounded-md">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div className="flex space-x-4">
              <Button
                variant="primary"
                onClick={handleGetBlockchainID}
                disabled={!walletEVMAddress}
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
              />
              <Button
                variant="primary"
                onClick={handleSendWarpMessage}
                loading={isProcessing}
                disabled={!walletEVMAddress || !messagePayload}
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
              />
              <Button
                variant="secondary"
                onClick={handleGetVerifiedWarpBlockHash}
                disabled={!walletEVMAddress || !blockIndex}
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
              />
              <Button
                variant="secondary"
                onClick={handleGetVerifiedWarpMessage}
                disabled={!walletEVMAddress || !messageIndex}
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
