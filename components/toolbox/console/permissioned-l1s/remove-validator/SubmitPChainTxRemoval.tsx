import React, { useState, useEffect } from 'react';
import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import { Button } from '@/components/toolbox/components/Button';
import { Input } from '@/components/toolbox/components/Input';
import { Success } from '@/components/toolbox/components/Success';
import { Alert } from '@/components/toolbox/components/Alert';
import { useAvalancheSDKChainkit } from '@/components/toolbox/stores/useAvalancheSDKChainkit';
import useConsoleNotifications from '@/hooks/useConsoleNotifications';
import { DynamicCodeBlock } from 'fumadocs-ui/components/dynamic-codeblock';
import { useChainPublicClient } from '@/components/toolbox/hooks/useChainPublicClient';
import { ensureCoreNetworkMode, restoreCoreChain } from '@/components/toolbox/coreViem';
import { Check } from 'lucide-react';
import { WARP_PRECOMPILE_ADDRESS, WARP_MESSAGE_TOPIC, validateAndCleanTxHash } from '@/components/toolbox/utils/warp';
import { PChainManualSubmit } from '@/components/toolbox/components/PChainManualSubmit';
import { StepFlowCard } from '@/components/toolbox/components/StepCard';

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
  const { coreWalletClient, pChainAddress, isTestnet } = useWalletStore();
  const chainPublicClient = useChainPublicClient();
  const walletType = useWalletStore((s) => s.walletType);
  const isCoreWallet = walletType === 'core';
  const { aggregateSignature } = useAvalancheSDKChainkit();
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
  const [manualPChainTxId, setManualPChainTxId] = useState('');

  // Update evmTxHash when initialEvmTxHash prop changes
  useEffect(() => {
    if (initialEvmTxHash && initialEvmTxHash !== evmTxHash) {
      setEvmTxHash(initialEvmTxHash);
    }
  }, [initialEvmTxHash]);

  // Extract warp message and event data when transaction hash changes
  useEffect(() => {
    let cancelled = false;
    const extractWarpMessage = async () => {
      const validTxHash = validateAndCleanTxHash(evmTxHash);
      if (!chainPublicClient || !validTxHash) {
        setUnsignedWarpMessage(null);
        setEventData(null);
        setSignedWarpMessage(null);
        return;
      }

      try {
        const receipt = await chainPublicClient.waitForTransactionReceipt({ hash: validTxHash });
        if (cancelled) return;
        if (!receipt.logs || receipt.logs.length === 0) {
          throw new Error("Failed to get warp message from transaction receipt.");
        }

        // Look for warp message in multiple ways to handle both direct and multisig transactions
        let unsignedWarpMessage: string | null = null;

        // Method 1: Look for the warp message topic (most reliable)
        // This works for both direct and multisig transactions when the warp precompile emits the event
        const warpEventLog = receipt.logs.find((log) => {
          return log && log.address && log.address.toLowerCase() === WARP_PRECOMPILE_ADDRESS.toLowerCase() &&
            log.topics && log.topics[0] && log.topics[0].toLowerCase() === WARP_MESSAGE_TOPIC.toLowerCase();
        });

        if (warpEventLog && warpEventLog.data) {
          unsignedWarpMessage = warpEventLog.data;
        } else {
          // Method 2: For multisig transactions, try using log[1].data
          if (receipt.logs.length > 1 && receipt.logs[1].data) {
            unsignedWarpMessage = receipt.logs[1].data;
          } else if (receipt.logs[0].data) {
            // Method 3: Fallback to first log data
            unsignedWarpMessage = receipt.logs[0].data;
          }
        }

        if (!unsignedWarpMessage) {
          throw new Error("Could not extract warp message from any log in the transaction receipt.");
        }

        if (cancelled) return;
        setUnsignedWarpMessage(unsignedWarpMessage);

        // Extract event data for both InitiatedValidatorRemoval and InitiatedValidatorWeightUpdate
        // InitiatedValidatorRemoval: when initiateValidatorRemoval is used
        // InitiatedValidatorWeightUpdate: when resendValidatorRemovalMessage is used (fallback)
        const removalEventTopic = "0x9e51aa28092b7ac0958967564371c129b31b238c0c0bdb0eb9cb4d1e40d724dc";
        const weightUpdateEventTopic = "0x6e350dd49b060d87f297206fd309234ed43156d890ced0f139ecf704310481d3";

        // First try to find the Warp message event from the precompile (already found above)
        let eventLog = warpEventLog;

        let isWarpMessageEvent = false;
        let isWeightUpdateEvent = false;

        if (eventLog) {
          isWarpMessageEvent = true;
        } else {
          // Fallback to looking for validator manager events
          eventLog = receipt.logs.find((log) => {
            return log && log.topics && log.topics[0] && log.topics[0].toLowerCase() === removalEventTopic.toLowerCase();
          });

          if (!eventLog) {
            // Try to find InitiatedValidatorWeightUpdate event (for resend fallback)
            eventLog = receipt.logs.find((log) => {
              return log && log.topics && log.topics[0] && log.topics[0].toLowerCase() === weightUpdateEventTopic.toLowerCase();
            });
            isWeightUpdateEvent = true;
          }

          if (!eventLog) {
            throw new Error("Failed to find InitiatedValidatorRemoval, InitiatedValidatorWeightUpdate, or Warp message event log.");
          }
        }

        // For Warp message events, we don't need to parse event data - we just need the warp message
        let parsedEventData;
        if (isWarpMessageEvent) {
          // For Warp message events, create minimal event data since we mainly need the warp message
          parsedEventData = {
            validationID: eventLog.topics[2] as `0x${string}`, // validation ID might be in topics[2]
            validatorWeightMessageID: eventLog.topics[1] as `0x${string}`, // message ID in topics[1]
            weight: BigInt(0), // Weight not available in warp message event
            endTime: BigInt(0), // End time not available in warp message event
          };
        } else if (isWeightUpdateEvent) {
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

        if (cancelled) return;
        setEventData(parsedEventData);
        setErrorState(null);
      } catch (err: any) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : String(err);
        setErrorState(`Failed to extract warp message: ${message}`);
        setUnsignedWarpMessage(null);
        setEventData(null);
        setSignedWarpMessage(null);
      }
    };

    extractWarpMessage();
    return () => { cancelled = true; };
  }, [evmTxHash, chainPublicClient]);

  const handleSubmitPChainTx = async () => {
    setErrorState(null);
    setTxSuccess(null);

    if (isCoreWallet && !coreWalletClient) {
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
    if (isCoreWallet) {
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
    }

    setIsProcessing(true);
    try {
      // Step 1: Sign the warp message
      const aggregateSignaturePromise = aggregateSignature({
        message: unsignedWarpMessage,
        signingSubnetId,
      });
      notify({
        type: 'local',
        name: 'Aggregate Signatures'
      }, aggregateSignaturePromise);
      const { signedMessage } = await aggregateSignaturePromise;

      setSignedWarpMessage(signedMessage);

      if (!isCoreWallet) {
        // Generic wallet: aggregation done, CLI command shown in render
        return;
      }

      // Ensure Core Wallet is in the correct network mode for P-Chain ops
      const previousChainId = await ensureCoreNetworkMode(isTestnet);
      // Re-read the client from the store after mode switch — the closure's client
      // may be configured for the wrong network.
      const freshClient = useWalletStore.getState().coreWalletClient;
      if (!freshClient) throw new Error("Core wallet client lost after network mode switch. Please reconnect.");

      // Step 2: Submit to P-Chain
      const pChainTxIdPromise = freshClient.setL1ValidatorWeight({
        signedWarpMessage: signedMessage,
      });
      notify('setL1ValidatorWeight', pChainTxIdPromise);
      const pChainTxId = await pChainTxIdPromise;

      if (previousChainId) await restoreCoreChain(previousChainId);

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
    setManualPChainTxId('');
  };

  const handleContinueWithManualTxId = () => {
    if (!manualPChainTxId.trim()) {
      setErrorState("P-Chain transaction ID is required");
      return;
    }
    if (!eventData) {
      setErrorState("Event data not found. Check the transaction hash.");
      return;
    }
    setTxSuccess(`P-Chain transaction submitted! ID: ${manualPChainTxId}`);
    onSuccess(manualPChainTxId, eventData);
  };

  const generateCLICommand = () => {
    if (!signedWarpMessage) return '';
    const network = isTestnet ? 'fuji' : 'mainnet';
    return [
      `platform l1 set-weight \\`,
      `  --message "${signedWarpMessage}" \\`,
      `  --network ${network} \\`,
      `  --key-name <your-key-name>`,
    ].join('\n');
  };

  // Don't render if no subnet is selected
  if (!subnetIdL1) {
    return (
      <div className="text-sm text-zinc-500 dark:text-zinc-400">
        Please select an L1 subnet first.
      </div>
    );
  }

  const step1Complete = !!unsignedWarpMessage;
  const step2Complete = !!signedWarpMessage;
  const step3Complete = !!txSuccess;

  return (
    <div className="space-y-3">
      {error && (
        <Alert variant="error">{error}</Alert>
      )}

      {/* Step 1: Extract Warp Message */}
      <StepFlowCard step={1} title="Extract Warp Message" description="Enter the EVM transaction hash to extract the unsigned Warp message" isComplete={step1Complete}>
        <div className="mt-2">
          <Input
            label="initiateValidatorRemoval Transaction Hash"
            value={evmTxHash}
            onChange={handleTxHashChange}
            placeholder="Enter the initiateValidatorRemoval transaction hash from step 2 (0x...)"
            disabled={isProcessing || txSuccess !== null}
          />
        </div>
        {step1Complete && eventData && (
          <div className="mt-2 space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-green-700 dark:text-green-400 font-mono">
              <span className="text-green-600 font-sans font-medium">Validation ID:</span>
              <code className="bg-green-100 dark:bg-green-900/30 px-1.5 py-0.5 rounded text-[10px]">{eventData.validationID}</code>
            </div>
            {eventData.weight > 0n && (
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-green-600 dark:text-green-400 font-medium">Weight:</span>
                <code className="bg-green-100 dark:bg-green-900/30 px-1.5 py-0.5 rounded text-[10px] font-mono">{eventData.weight.toString()}</code>
              </div>
            )}
            {eventData.endTime > 0n && (
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-green-600 dark:text-green-400 font-medium">End Time:</span>
                <code className="bg-green-100 dark:bg-green-900/30 px-1.5 py-0.5 rounded text-[10px] font-mono">{eventData.endTime.toString()}</code>
              </div>
            )}
            <details className="mt-1">
              <summary className="text-[10px] text-zinc-400 cursor-pointer hover:text-zinc-600 dark:hover:text-zinc-300">
                Show unsigned Warp message ({unsignedWarpMessage ? unsignedWarpMessage.length / 2 : 0} bytes)
              </summary>
              <div className="mt-1">
                <DynamicCodeBlock lang="text" code={unsignedWarpMessage || ''} />
              </div>
            </details>
          </div>
        )}
      </StepFlowCard>

      {/* Step 2: Sign & Submit to P-Chain */}
      <StepFlowCard step={2} title="Sign & Submit to P-Chain" description="Aggregate BLS signatures from L1 validators and submit the removal to P-Chain" isComplete={step2Complete} isActive={step1Complete}>
        {step2Complete ? (
          <div className="mt-2 space-y-1">
            <div className="flex items-center gap-1.5 text-green-600 dark:text-green-400">
              <Check className="w-3.5 h-3.5" />
              <span className="text-xs font-medium">Signatures aggregated</span>
            </div>
            <details>
              <summary className="text-[10px] text-zinc-400 cursor-pointer hover:text-zinc-600 dark:hover:text-zinc-300">
                Show signed Warp message ({signedWarpMessage ? signedWarpMessage.length / 2 : 0} bytes)
              </summary>
              <div className="mt-1">
                <DynamicCodeBlock lang="text" code={signedWarpMessage || ''} />
              </div>
            </details>
          </div>
        ) : step1Complete && !step3Complete ? (
          <div className="mt-2">
            <Button
              onClick={handleSubmitPChainTx}
              disabled={isProcessing || !unsignedWarpMessage || !eventData || (!!signedWarpMessage && !isCoreWallet)}
              loading={isProcessing}
              className="w-full"
            >
              {isProcessing ? 'Processing...' : (isCoreWallet ? 'Sign & Submit to P-Chain' : 'Aggregate Signatures')}
            </Button>
          </div>
        ) : null}
      </StepFlowCard>

      {/* Non-Core: CLI command panel */}
      {!isCoreWallet && signedWarpMessage && !txSuccess && (
        <PChainManualSubmit
          cliCommand={generateCLICommand()}
          onSubmit={handleContinueWithManualTxId}
        />
      )}

      {/* Success */}
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
