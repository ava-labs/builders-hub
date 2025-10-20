import React, { useState, useEffect } from 'react';
import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import { Button } from '@/components/toolbox/components/Button';
import { Input } from '@/components/toolbox/components/Input';
import { Success } from '@/components/toolbox/components/Success';
import { Alert } from '@/components/toolbox/components/Alert';
//import { useAvaCloudSDK } from '@/components/toolbox/stores/useAvaCloudSDK';
import { useAvalancheSDK } from '@/components/toolbox/stores/useAvalancheSDK';
import useConsoleNotifications from '@/hooks/useConsoleNotifications';

interface SubmitPChainTxRemovalProps {
  subnetIdL1: string;
  initialEvmTxHash?: string;
  signingSubnetId: string;
  onSuccess: (pChainTxId: string, eventData: {
    validationID: `0x${string}`;
    validatorWeightMessageID: `0x${string}`;
    weight: bigint;
    endTime: bigint;
  }) => void;
  onError: (message: string) => void;
}

const SubmitPChainTxRemoval: React.FC<SubmitPChainTxRemovalProps> = ({
  subnetIdL1,
  initialEvmTxHash,
  signingSubnetId,
  onSuccess,
  onError,
}) => {
  const { coreWalletClient, pChainAddress, publicClient } = useWalletStore();
  // const { aggregateSignature } = useAvaCloudSDK();
  const { aggregateSignature } = useAvalancheSDK();
  const { notify } = useConsoleNotifications();
  const [evmTxHash, setEvmTxHash] = useState(initialEvmTxHash || '');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setErrorState] = useState<string | null>(null);
  const [txSuccess, setTxSuccess] = useState<string | null>(null);
  const [unsignedWarpMessage, setUnsignedWarpMessage] = useState<string | null>(null);
  const [signedWarpMessage, setSignedWarpMessage] = useState<string | null>(null);
  const [eventData, setEventData] = useState<{
    validationID: `0x${string}`;
    validatorWeightMessageID: `0x${string}`;
    weight: bigint;
    endTime: bigint;
  } | null>(null);

  // Update evmTxHash when initialEvmTxHash prop changes
  useEffect(() => {
    if (initialEvmTxHash && initialEvmTxHash !== evmTxHash) {
      setEvmTxHash(initialEvmTxHash);
    }
  }, [initialEvmTxHash]);

  const validateAndCleanTxHash = (hash: string): `0x${string}` | null => {
    if (!hash) return null;
    const cleanHash = hash.trim().toLowerCase();
    if (!cleanHash.startsWith('0x')) return null;
    if (cleanHash.length !== 66) return null;
    return cleanHash as `0x${string}`;
  };

  // Extract warp message and event data when transaction hash changes
  useEffect(() => {
    const extractWarpMessage = async () => {
      const validTxHash = validateAndCleanTxHash(evmTxHash);
      if (!publicClient || !validTxHash) {
        setUnsignedWarpMessage(null);
        setEventData(null);
        setSignedWarpMessage(null);
        return;
      }

      try {
        const receipt = await publicClient.waitForTransactionReceipt({ hash: validTxHash });
        if (!receipt.logs || receipt.logs.length === 0) {
          throw new Error("Failed to get warp message from transaction receipt.");
        }

        console.log("🔍 [SubmitPChainTxRemoval] Transaction receipt:", receipt);
        console.log("🔍 [SubmitPChainTxRemoval] Number of logs:", receipt.logs.length);

        // Log all event topics for debugging
        receipt.logs.forEach((log, index) => {
          console.log(`🔍 [SubmitPChainTxRemoval] Log ${index}:`, {
            address: log.address,
            topics: log.topics,
            data: log.data?.substring(0, 100) + "...",
          });
        });

        // Look for warp message in multiple ways to handle both direct and multisig transactions
        let unsignedWarpMessage: string | null = null;

        // Method 1: Look for the warp message topic (most reliable)
        // This works for both direct and multisig transactions when the warp precompile emits the event
        const warpMessageTopic = "0x56600c567728a800c0aa927500f831cb451df66a7af570eb4df4dfbf4674887d";
        const warpPrecompileAddress = "0x0200000000000000000000000000000000000005";

        const warpEventLog = receipt.logs.find((log) => {
          return log && log.address && log.address.toLowerCase() === warpPrecompileAddress.toLowerCase() &&
            log.topics && log.topics[0] && log.topics[0].toLowerCase() === warpMessageTopic.toLowerCase();
        });

        if (warpEventLog && warpEventLog.data) {
          console.log("🔍 [SubmitPChainTxRemoval] Found warp message from precompile event");
          unsignedWarpMessage = warpEventLog.data;
        } else {
          // Method 2: For multisig transactions, try using log[1].data
          // Multisig transactions often have different log ordering due to Safe contract interactions
          // The actual validator manager event may be in a different position
          if (receipt.logs.length > 1 && receipt.logs[1].data) {
            console.log("🔍 [SubmitPChainTxRemoval] Using receipt.logs[1].data for potential multisig transaction");
            unsignedWarpMessage = receipt.logs[1].data;
          } else if (receipt.logs[0].data) {
            // Method 3: Fallback to first log data (original approach for direct transactions)
            console.log("🔍 [SubmitPChainTxRemoval] Using receipt.logs[0].data as fallback");
            unsignedWarpMessage = receipt.logs[0].data;
          }
        }

        if (!unsignedWarpMessage) {
          throw new Error("Could not extract warp message from any log in the transaction receipt.");
        }

        console.log("🔍 [SubmitPChainTxRemoval] Extracted warp message:", unsignedWarpMessage.substring(0, 60) + "...");
        setUnsignedWarpMessage(unsignedWarpMessage);

        // Extract event data for both InitiatedValidatorRemoval and InitiatedValidatorWeightUpdate
        // InitiatedValidatorRemoval: when initiateValidatorRemoval is used
        // InitiatedValidatorWeightUpdate: when resendValidatorRemovalMessage is used (fallback)
        const removalEventTopic = "0x9e51aa28092b7ac0958967564371c129b31b238c0c0bdb0eb9cb4d1e40d724dc";
        const weightUpdateEventTopic = "0x6e350dd49b060d87f297206fd309234ed43156d890ced0f139ecf704310481d3";

        console.log("🔍 [SubmitPChainTxRemoval] Looking for event topics:");
        console.log("🔍 [SubmitPChainTxRemoval] - InitiatedValidatorRemoval:", removalEventTopic);
        console.log("🔍 [SubmitPChainTxRemoval] - InitiatedValidatorWeightUpdate:", weightUpdateEventTopic);
        console.log("🔍 [SubmitPChainTxRemoval] - Warp Message:", warpMessageTopic);

        // First try to find the Warp message event from the precompile (already found above)
        let eventLog = warpEventLog;

        let isWarpMessageEvent = false;
        let isWeightUpdateEvent = false;

        if (eventLog) {
          console.log("🔍 [SubmitPChainTxRemoval] Found Warp message event from precompile");
          isWarpMessageEvent = true;
        } else {
          // Fallback to looking for validator manager events
          eventLog = receipt.logs.find((log) => {
            return log && log.topics && log.topics[0] && log.topics[0].toLowerCase() === removalEventTopic.toLowerCase();
          });

          if (!eventLog) {
            console.log("🔍 [SubmitPChainTxRemoval] InitiatedValidatorRemoval event not found, trying InitiatedValidatorWeightUpdate...");
            // Try to find InitiatedValidatorWeightUpdate event (for resend fallback)
            eventLog = receipt.logs.find((log) => {
              return log && log.topics && log.topics[0] && log.topics[0].toLowerCase() === weightUpdateEventTopic.toLowerCase();
            });
            isWeightUpdateEvent = true;
          } else {
            console.log("🔍 [SubmitPChainTxRemoval] Found InitiatedValidatorRemoval event");
          }

          if (!eventLog) {
            console.error("🔍 [SubmitPChainTxRemoval] No matching event found. Available topics:");
            receipt.logs.forEach((log, index) => {
              if (log.topics && log.topics[0]) {
                console.error(`🔍 [SubmitPChainTxRemoval] Log ${index} topic[0]:`, log.topics[0]);
              }
            });
            throw new Error("Failed to find InitiatedValidatorRemoval, InitiatedValidatorWeightUpdate, or Warp message event log.");
          }
        }

        console.log("🔍 [SubmitPChainTxRemoval] Found event log:", {
          isWarpMessageEvent,
          address: eventLog.address,
          topics: eventLog.topics,
          data: eventLog.data?.substring(0, 100) + "...",
        });

        // For Warp message events, we don't need to parse event data - we just need the warp message
        let parsedEventData;
        if (isWarpMessageEvent) {
          console.log("🔍 [SubmitPChainTxRemoval] Using Warp message event - creating minimal event data");
          // For Warp message events, create minimal event data since we mainly need the warp message
          parsedEventData = {
            validationID: eventLog.topics[2] as `0x${string}`, // validation ID might be in topics[2]
            validatorWeightMessageID: eventLog.topics[1] as `0x${string}`, // message ID in topics[1]
            weight: BigInt(0), // Weight not available in warp message event
            endTime: BigInt(0), // End time not available in warp message event
          };
        } else if (isWeightUpdateEvent) {
          console.log("🔍 [SubmitPChainTxRemoval] Parsing as InitiatedValidatorWeightUpdate event");
          // InitiatedValidatorWeightUpdate(bytes32 indexed validationID, uint64 nonce, bytes32 weightUpdateMessageID, uint64 weight)
          const dataWithoutPrefix = eventLog.data.slice(2);
          const messageID = "0x" + dataWithoutPrefix.slice(64, 128);
          const weight = BigInt("0x" + dataWithoutPrefix.slice(128, 192));

          parsedEventData = {
            validationID: eventLog.topics[1] as `0x${string}`,
            validatorWeightMessageID: messageID as `0x${string}`,
            weight,
            endTime: BigInt(0), // Not available in weight update event
          };
        } else {
          console.log("🔍 [SubmitPChainTxRemoval] Parsing as InitiatedValidatorRemoval event");
          // InitiatedValidatorRemoval(bytes32 indexed validationID, bytes32 validatorWeightMessageID, uint64 weight, uint64 endTime)
          const dataWithoutPrefix = eventLog.data.slice(2);
          const validatorWeightMessageID = "0x" + dataWithoutPrefix.slice(0, 64);
          const weight = BigInt("0x" + dataWithoutPrefix.slice(64, 128));
          const endTime = BigInt("0x" + dataWithoutPrefix.slice(128, 192));

          parsedEventData = {
            validationID: eventLog.topics[1] as `0x${string}`,
            validatorWeightMessageID: validatorWeightMessageID as `0x${string}`,
            weight,
            endTime,
          };
        }

        console.log("🔍 [SubmitPChainTxRemoval] Parsed event data:", parsedEventData);
        setEventData(parsedEventData);
        setErrorState(null);
      } catch (err: any) {
        const message = err instanceof Error ? err.message : String(err);
        setErrorState(`Failed to extract warp message: ${message}`);
        setUnsignedWarpMessage(null);
        setEventData(null);
        setSignedWarpMessage(null);
      }
    };

    extractWarpMessage();
  }, [evmTxHash, publicClient]);

  const handleSubmitPChainTx = async () => {
    setErrorState(null);
    setTxSuccess(null);
    
    if (!coreWalletClient) {
      setErrorState("Core wallet not found");
      return;
    }

    if (!evmTxHash.trim()) {
      setErrorState("EVM transaction hash is required.");
      onError("EVM transaction hash is required.");
      return;
    }
    if (!subnetIdL1) {
      setErrorState("L1 Subnet ID is required. Please select a subnet first.");
      onError("L1 Subnet ID is required. Please select a subnet first.");
      return;
    }
    if (!unsignedWarpMessage) {
      setErrorState("Unsigned warp message not found. Check the transaction hash.");
      onError("Unsigned warp message not found. Check the transaction hash.");
      return;
    }
    if (!eventData) {
      setErrorState("Event data not found. Check the transaction hash.");
      onError("Event data not found. Check the transaction hash.");
      return;
    }
    if (typeof window === 'undefined' || !window.avalanche) {
      setErrorState("Core wallet not found. Please ensure Core is installed and active.");
      onError("Core wallet not found. Please ensure Core is installed and active.");
      return;
    }
    if (!pChainAddress) {
      setErrorState("P-Chain address is missing from wallet. Please connect your wallet properly.");
      onError("P-Chain address is missing from wallet. Please connect your wallet properly.");
      return;
    }

    setIsProcessing(true);
    try {
      // Step 1: Sign the warp message
      const aggregateSignaturePromise = aggregateSignature({
        message: unsignedWarpMessage,
        signingSubnetId: signingSubnetId || subnetIdL1,
        quorumPercentage: 67,
      });
      notify({
        type: 'local',
        name: 'Aggregate Signatures'
      }, aggregateSignaturePromise);
      const { signedMessage } = await aggregateSignaturePromise;

      setSignedWarpMessage(signedMessage);

      // Step 2: Submit to P-Chain
      const pChainTxIdPromise = coreWalletClient.setL1ValidatorWeight({
        signedWarpMessage: signedMessage,
      });
      notify('setL1ValidatorWeight', pChainTxIdPromise);
      const pChainTxId = await pChainTxIdPromise;

      setTxSuccess(`P-Chain transaction successful! ID: ${pChainTxId}`);
      onSuccess(pChainTxId, eventData);
    } catch (err: any) {
      let message = err instanceof Error ? err.message : String(err);

      // Handle specific error types
      if (message.includes('User rejected')) {
        message = 'Transaction was rejected by user';
      } else if (message.includes('insufficient funds')) {
        message = 'Insufficient funds for transaction';
      } else if (message.includes('execution reverted')) {
        message = `Transaction reverted: ${message}`;
      } else if (message.includes('nonce')) {
        message = 'Transaction nonce error. Please try again.';
      }

      setErrorState(`P-Chain transaction failed: ${message}`);
      onError(`P-Chain transaction failed: ${message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleTxHashChange = (value: string) => {
    setEvmTxHash(value);
    setErrorState(null);
    setTxSuccess(null);
    setSignedWarpMessage(null);
  };

  // Don't render if no subnet is selected
  if (!subnetIdL1) {
    return (
      <div className="text-sm text-zinc-500 dark:text-zinc-400">
        Please select an L1 subnet first.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Input
        label="initiateValidatorRemoval Transaction Hash"
        value={evmTxHash}
        onChange={handleTxHashChange}
        placeholder="Enter the initiateValidatorRemoval transaction hash from step 2 (0x...)"
        disabled={isProcessing || txSuccess !== null}
      />

      <Button
        onClick={handleSubmitPChainTx}
        disabled={isProcessing || !evmTxHash.trim() || !unsignedWarpMessage || !eventData || txSuccess !== null}
      >
        {isProcessing ? 'Processing...' : 'Sign & Submit to P-Chain'}
      </Button>

      {error && (
        <Alert variant="error">{error}</Alert>
      )}

      {txSuccess && (
        <Success
          label="Transaction Hash"
          value={txSuccess.replace('P-Chain transaction successful! ID: ', '')}
        />
      )}
    </div>
  );
};

export default SubmitPChainTxRemoval; 
