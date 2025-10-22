import React, { useState, useEffect } from 'react';
import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import { Button } from '@/components/toolbox/components/Button';
import { Input } from '@/components/toolbox/components/Input';
import { Success } from '@/components/toolbox/components/Success';
import { useAvalancheSDKChainkit } from '@/components/toolbox/stores/useAvalancheSDKChainkit';
import useConsoleNotifications from '@/hooks/useConsoleNotifications';
import { Alert } from '@/components/toolbox/components/Alert';

interface SubmitPChainTxRegisterL1ValidatorProps {
  subnetIdL1: string;
  validatorBalance?: string;
  userPChainBalanceNavax?: bigint | null;
  blsProofOfPossession?: string;
  evmTxHash?: string;
  signingSubnetId: string;
  onSuccess: (pChainTxId: string) => void;
  onError: (message: string) => void;
}

const SubmitPChainTxRegisterL1Validator: React.FC<SubmitPChainTxRegisterL1ValidatorProps> = ({
  subnetIdL1,
  validatorBalance,
  userPChainBalanceNavax,
  blsProofOfPossession,
  evmTxHash,
  signingSubnetId,
  onSuccess,
  onError,
}) => {
  const { coreWalletClient, pChainAddress, publicClient } = useWalletStore();
  const { aggregateSignature } = useAvalancheSDKChainkit();
  const { notify } = useConsoleNotifications();
  const [evmTxHashState, setEvmTxHashState] = useState(evmTxHash || '');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setErrorState] = useState<string | null>(null);
  const [txSuccess, setTxSuccess] = useState<string | null>(null);
  const [unsignedWarpMessage, setUnsignedWarpMessage] = useState<string | null>(null);
  const [signedWarpMessage, setSignedWarpMessage] = useState<string | null>(null);
  const [evmTxHashError, setEvmTxHashError] = useState<string | null>(null);

  // Initialize EVM transaction hash when it becomes available
  useEffect(() => {
    if (evmTxHash && !evmTxHashState) {
      setEvmTxHashState(evmTxHash);
    }
  }, [evmTxHash, evmTxHashState]);

  const validateAndCleanTxHash = (hash: string): `0x${string}` | null => {
    if (!hash) return null;
    const cleanHash = hash.trim().toLowerCase();
    if (!cleanHash.startsWith('0x')) return null;
    if (cleanHash.length !== 66) return null;
    return cleanHash as `0x${string}`;
  };

  // Extract warp message when transaction hash changes
  useEffect(() => {
    const extractWarpMessage = async () => {
      const validTxHash = validateAndCleanTxHash(evmTxHashState);
      if (!publicClient || !validTxHash) {
        setUnsignedWarpMessage(null);
        setSignedWarpMessage(null);
        return;
      }

      try {
        const receipt = await publicClient.waitForTransactionReceipt({ hash: validTxHash });
        if (!receipt.logs || receipt.logs.length === 0) {
          throw new Error("Failed to get warp message from transaction receipt.");
        }

        console.log("[WarpExtract] Transaction receipt:", receipt);
        console.log("[WarpExtract] Number of logs:", receipt.logs.length);

        // Log all transaction logs for debugging
        receipt.logs.forEach((log, index) => {
          console.log(`[WarpExtract] Log #${index}:`, {
            address: log.address,
            topics: log.topics,
            data: log.data?.substring(0, 100) + "...",
            logIndex: log.logIndex,
            transactionIndex: log.transactionIndex,
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
          console.log("[WarpExtract] Found warp message from precompile event");
          unsignedWarpMessage = warpEventLog.data;
        } else {
          // Method 2: For multisig transactions, try using log[1].data
          // Multisig transactions often have different log ordering due to Safe contract interactions
          // The actual validator manager event may be in a different position
          if (receipt.logs.length > 1 && receipt.logs[1].data) {
            console.log("[WarpExtract] Using receipt.logs[1].data for potential multisig transaction");
            unsignedWarpMessage = receipt.logs[1].data;
          } else if (receipt.logs[0].data) {
            // Method 3: Fallback to first log data (original approach for direct transactions)
            console.log("[WarpExtract] Using receipt.logs[0].data as fallback");
            unsignedWarpMessage = receipt.logs[0].data;
          }
        }

        if (!unsignedWarpMessage) {
          throw new Error("Could not extract warp message from any log in the transaction receipt.");
        }

        console.log("[WarpExtract] Extracted warp message:", unsignedWarpMessage.substring(0, 60) + "...");
        console.log("[WarpExtract] Message length:", unsignedWarpMessage.length);
        console.log("[WarpExtract] Message format validation:");
        console.log("  - Is hex string:", /^0x[0-9a-fA-F]*$/.test(unsignedWarpMessage));
        console.log("  - Byte length (excluding 0x):", (unsignedWarpMessage.length - 2) / 2);

        setUnsignedWarpMessage(unsignedWarpMessage);
        setErrorState(null);
      } catch (err: any) {
        const message = err instanceof Error ? err.message : String(err);
        setErrorState(`Failed to extract warp message: ${message}`);
        setUnsignedWarpMessage(null);
        setSignedWarpMessage(null);
      }
    };

    extractWarpMessage();
  }, [evmTxHashState, publicClient]);

  const handleSubmitPChainTx = async () => {
    setErrorState(null);
    setTxSuccess(null);

    if (!coreWalletClient) {
      setErrorState("Core wallet not found");
      return;
    }

    // Validate required inputs
    const evmTxValidation = !evmTxHashState.trim() ? "EVM transaction hash is required" : null;

    setEvmTxHashError(evmTxValidation);

    if (evmTxValidation) {
      setErrorState(evmTxValidation);
      onError(evmTxValidation);
      return;
    }

    if (!subnetIdL1) {
      setErrorState("L1 Subnet ID is required. Please select a subnet first.");
      onError("L1 Subnet ID is required. Please select a subnet first.");
      return;
    }

    if (!validatorBalance) {
      setErrorState("Validator balance is required. Please complete the previous step.");
      onError("Validator balance is required. Please complete the previous step.");
      return;
    }

    if (!blsProofOfPossession) {
      setErrorState("BLS Proof of Possession is required. Please complete the previous step.");
      onError("BLS Proof of Possession is required. Please complete the previous step.");
      return;
    }

    if (!unsignedWarpMessage) {
      setErrorState("Unsigned warp message not found. Check the transaction hash.");
      onError("Unsigned warp message not found. Check the transaction hash.");
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
      // Sign the warp message
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

      // Submit to P-Chain using registerL1Validator with all required parameters
      const registerL1ValidatorPromise = coreWalletClient.registerL1Validator({
        balance: validatorBalance.trim(),
        blsProofOfPossession: blsProofOfPossession.trim(),
        signedWarpMessage: signedMessage,
      });
      notify('registerL1Validator', registerL1ValidatorPromise);

      const pChainTxId = await registerL1ValidatorPromise;
      setTxSuccess(`P-Chain transaction successful! ID: ${pChainTxId}`);
      onSuccess(pChainTxId);
    } catch (err: any) {
      let message = '';

      // Better error extraction
      if (err instanceof Error) {
        message = err.message;
      } else if (typeof err === 'string') {
        message = err;
      } else if (err?.message) {
        message = err.message;
      } else if (err?.error?.message) {
        message = err.error.message;
      } else if (err?.reason) {
        message = err.reason;
      } else {
        // Last resort - try to get some useful info
        try {
          message = JSON.stringify(err);
        } catch {
          message = 'Unknown error occurred';
        }
      }

      // Handle specific error types
      if (message.includes('User rejected') || message.includes('user rejected')) {
        message = 'Transaction was rejected by user';
      } else if (message.includes('insufficient funds')) {
        message = 'Insufficient funds for transaction';
      } else if (message.includes('execution reverted')) {
        message = `Transaction reverted: ${message}`;
      } else if (message.includes('nonce')) {
        message = 'Transaction nonce error. Please try again.';
      }

      console.error('P-Chain transaction error:', err);
      setErrorState(`P-Chain transaction failed: ${message}`);
      onError(`P-Chain transaction failed: ${message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleTxHashChange = (value: string) => {
    setEvmTxHashState(value);
    setEvmTxHashError(null);
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
        label="initiateValidatorRegistration Transaction Hash"
        value={evmTxHashState}
        onChange={handleTxHashChange}
        placeholder="Enter the initiateValidatorRegistration transaction hash from step 4 (0x...)"
        disabled={isProcessing || txSuccess !== null}
        error={evmTxHashError}
      />

      {/* Display validator details from previous steps */}
      {(validatorBalance || blsProofOfPossession) && (
        <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-lg p-4 border border-zinc-200 dark:border-zinc-700">
          <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-3">
            Validator Details (collected from step 3)
          </h3>
          <div className="space-y-2 text-sm text-zinc-600 dark:text-zinc-400">
            {validatorBalance && (
              <p><span className="font-medium">Initial AVAX Balance:</span> {validatorBalance} AVAX</p>
            )}
            {userPChainBalanceNavax && validatorBalance && BigInt(Number(validatorBalance) * 1e9) > userPChainBalanceNavax && (
              <p className="text-xs mt-1 text-red-500 dark:text-red-400">
                Validator balance ({validatorBalance} AVAX) exceeds your P-Chain balance ({(Number(userPChainBalanceNavax) / 1e9).toFixed(2)} AVAX).
              </p>
            )}
            {blsProofOfPossession && (
              <p><span className="font-medium">BLS Proof of Possession:</span> {blsProofOfPossession.substring(0, 50)}...</p>
            )}
          </div>
        </div>
      )}

      <Button
        onClick={handleSubmitPChainTx}
        disabled={isProcessing || !evmTxHashState.trim() || !validatorBalance || !blsProofOfPossession || !unsignedWarpMessage || txSuccess !== null}
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

export default SubmitPChainTxRegisterL1Validator;
