import React, { useState, useEffect } from 'react';
import { useWalletStore } from '../../../stores/walletStore';
import { useValidatorManagerDetails } from '../../hooks/useValidatorManagerDetails';
import { AvaCloudSDK } from '@avalabs/avacloud-sdk';
import { Button } from '../../../components/Button';
import { Input } from '../../../components/Input';
import { AlertCircle } from 'lucide-react';
import { Success } from '../../../components/Success';
import { networkIDs } from '@avalabs/avalanchejs';

interface SubmitPChainTxRegisterL1ValidatorProps {
  subnetIdL1: string;
  validatorBalance?: string;
  blsProofOfPossession?: string;
  evmTxHash?: string;
  onSuccess: (pChainTxId: string) => void;
  onError: (message: string) => void;
}

const SubmitPChainTxRegisterL1Validator: React.FC<SubmitPChainTxRegisterL1ValidatorProps> = ({
  subnetIdL1,
  validatorBalance,
  blsProofOfPossession,
  evmTxHash,
  onSuccess,
  onError,
}) => {
  const { coreWalletClient, pChainAddress, avalancheNetworkID, publicClient } = useWalletStore();
  const [evmTxHashState, setEvmTxHashState] = useState(evmTxHash || '');
  const [balance, setBalance] = useState('');
  const [blsProofOfPossessionState, setBlsProofOfPossessionState] = useState('');
  const { signingSubnetId } = useValidatorManagerDetails({ subnetId: subnetIdL1 });
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setErrorState] = useState<string | null>(null);
  const [txSuccess, setTxSuccess] = useState<string | null>(null);
  const [unsignedWarpMessage, setUnsignedWarpMessage] = useState<string | null>(null);
  const [signedWarpMessage, setSignedWarpMessage] = useState<string | null>(null);
  const [balanceError, setBalanceError] = useState<string | null>(null);
  const [blsError, setBlsError] = useState<string | null>(null);
  const [evmTxHashError, setEvmTxHashError] = useState<string | null>(null);

  const networkName = avalancheNetworkID === networkIDs.MainnetID ? "mainnet" : "fuji";

  // Initialize state with prop values when they become available
  useEffect(() => {
    if (validatorBalance && !balance) {
      // Balance is already in AVAX format from the parent component
      setBalance(validatorBalance);
    }
    if (blsProofOfPossession && !blsProofOfPossessionState) {
      setBlsProofOfPossessionState(blsProofOfPossession);
    }
    if (evmTxHash && !evmTxHashState) {
      setEvmTxHashState(evmTxHash);
    }
  }, [validatorBalance, blsProofOfPossession, evmTxHash, balance, blsProofOfPossessionState, evmTxHashState]);

  const validateAndCleanTxHash = (hash: string): `0x${string}` | null => {
    if (!hash) return null;
    const cleanHash = hash.trim().toLowerCase();
    if (!cleanHash.startsWith('0x')) return null;
    if (cleanHash.length !== 66) return null;
    return cleanHash as `0x${string}`;
  };

  const validateBalance = (value: string): string | null => {
    if (!value.trim()) return "Balance is required";
    const num = parseFloat(value);
    if (isNaN(num)) return "Balance must be a valid number";
    if (num <= 0) return "Balance must be greater than 0";
    if (num > 1000000) return "Balance seems too large";
    return null;
  };

  const validateBlsProofOfPossession = (value: string): string | null => {
    if (!value.trim()) return "BLS Proof of Possession is required";
    const cleanValue = value.trim();
    const hexValue = cleanValue.startsWith('0x') ? cleanValue.slice(2) : cleanValue;
    if (!/^[0-9a-fA-F]+$/.test(hexValue)) return "BLS Proof of Possession must be a valid hex string";
    if (hexValue.length !== 192) return "BLS Proof of Possession must be 96 bytes (192 hex characters)";
    return null;
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
    
    // Validate all inputs
    const balanceValidation = validateBalance(balance);
    const blsValidation = validateBlsProofOfPossession(blsProofOfPossessionState || '');
    const evmTxValidation = !evmTxHashState.trim() ? "EVM transaction hash is required" : null;
    
    setBalanceError(balanceValidation);
    setBlsError(blsValidation);
    setEvmTxHashError(evmTxValidation);
    
    if (balanceValidation || blsValidation || evmTxValidation) {
      const firstError = evmTxValidation || balanceValidation || blsValidation || "Validation error";
      setErrorState(firstError);
      onError(firstError);
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
      const { signedMessage } = await new AvaCloudSDK().data.signatureAggregator.aggregateSignatures({
        network: networkName,
        signatureAggregatorRequest: {
          message: unsignedWarpMessage,
          signingSubnetId: signingSubnetId || subnetIdL1,
          quorumPercentage: 67,
        },
      });
      
      setSignedWarpMessage(signedMessage);

      // Submit to P-Chain using registerL1Validator with all required parameters
      const pChainTxId = await coreWalletClient.registerL1Validator({
        pChainAddress: pChainAddress!,
        balance: balance.trim(),
        blsProofOfPossession: blsProofOfPossessionState?.trim() || '',
        signedWarpMessage: signedMessage,
      });

      setTxSuccess(`P-Chain transaction successful! ID: ${pChainTxId}`);
      onSuccess(pChainTxId);
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
    setEvmTxHashState(value);
    setEvmTxHashError(null);
    setErrorState(null);
    setTxSuccess(null);
    setSignedWarpMessage(null);
  };

  const handleBalanceChange = (value: string) => {
    setBalance(value);
    setBalanceError(null);
    setErrorState(null);
    setTxSuccess(null);
  };

  const handleBlsChange = (value: string) => {
    setBlsProofOfPossessionState(value);
    setBlsError(null);
    setErrorState(null);
    setTxSuccess(null);
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
        label="EVM Transaction Hash"
        value={evmTxHashState}
        onChange={handleTxHashChange}
        placeholder="Enter the transaction hash from step 1 (0x...)"
        disabled={isProcessing || txSuccess !== null}
        error={evmTxHashError}
      />

      <Input
        label="Initial AVAX Balance"
        value={balance}
        onChange={handleBalanceChange}
        placeholder="Enter initial balance in AVAX (e.g., 0.1)"
        disabled={isProcessing || txSuccess !== null}
        error={balanceError}
      />

      <Input
        label="BLS Proof of Possession"
        value={blsProofOfPossessionState}
        onChange={handleBlsChange}
        placeholder="Enter BLS Proof of Possession (0x... or hex string)"
        disabled={isProcessing || txSuccess !== null}
        error={blsError}
      />

      {unsignedWarpMessage && (
        <div className="text-sm text-zinc-600 dark:text-zinc-400">
          <p><strong>Unsigned Warp Message:</strong> {unsignedWarpMessage.substring(0,50)}...</p>
          {signedWarpMessage && (
            <p><strong>Signed Warp Message:</strong> {signedWarpMessage.substring(0,50)}...</p>
          )}
        </div>
      )}
      
      <Button 
        onClick={handleSubmitPChainTx} 
        disabled={isProcessing || !evmTxHashState.trim() || !balance.trim() || !blsProofOfPossessionState || !unsignedWarpMessage || txSuccess !== null}
      >
        {isProcessing ? 'Processing...' : 'Sign & Submit to P-Chain'}
      </Button>

      {error && (
        <div className="p-3 rounded-md bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm">
          <div className="flex items-center">
            <AlertCircle className="h-4 w-4 text-red-500 mr-2 flex-shrink-0" />
            <span>{error}</span>
          </div>
        </div>
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
