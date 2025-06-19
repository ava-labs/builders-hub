import React, { useState, useEffect } from 'react';
import { useViemChainStore } from '../../../stores/toolboxStore';
import { useWalletStore } from '../../../stores/walletStore';
import { Button } from '../../../components/Button';
import { ConvertToL1Validator } from '../../../components/ValidatorListInput';
import { validateStakePercentage } from '../../../coreViem/hooks/getTotalStake';
import validatorManagerAbi from '../../../../contracts/icm-contracts/compiled/ValidatorManager.json';
import { AlertCircle } from 'lucide-react';
import { Success } from '../../../components/Success';
import { parseNodeID } from '../../../coreViem/utils/ids';
import { fromBytes } from 'viem';
import { utils } from '@avalabs/avalanchejs';
import { formatAvaxBalance } from '../../../coreViem/utils/format';
import { getPChainBalance } from '../../../coreViem/methods/getPChainbalance';
import { MultisigOption } from '../../../components/MultisigOption';
import { getValidationIdHex } from '../../../coreViem/hooks/getValidationID';

interface InitiateValidatorRegistrationProps {
  subnetId: string;
  validatorManagerAddress: string;
  validators: ConvertToL1Validator[];
  onSuccess: (data: {
    txHash: `0x${string}`;
    nodeId: string;
    validationId: string;
    weight: string;
    unsignedWarpMessage: string;
    validatorBalance: string;
    blsProofOfPossession: string;
  }) => void;
  onError: (message: string) => void;
  ownershipState: 'contract' | 'currentWallet' | 'differentEOA' | 'loading';
  contractTotalWeight: bigint;
  l1WeightError: string | null;
}

const InitiateValidatorRegistration: React.FC<InitiateValidatorRegistrationProps> = ({
  subnetId,
  validatorManagerAddress,
  validators,
  onSuccess,
  onError,
  ownershipState,
  contractTotalWeight,
}) => {
  const { coreWalletClient, publicClient, pChainAddress } = useWalletStore();
  const viemChain = useViemChainStore();

  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setErrorState] = useState<string | null>(null);
  const [txSuccess, setTxSuccess] = useState<string | null>(null);
  const [balance, setBalance] = useState("0");

  // Fetch P-Chain balance when component mounts
  useEffect(() => {
    const fetchBalance = async () => {
      if (!pChainAddress || !coreWalletClient) return;

      try {
        const balanceValue = await getPChainBalance(coreWalletClient);
        const formattedBalance = formatAvaxBalance(balanceValue);
        setBalance(formattedBalance);
      } catch (balanceError) {
        console.error("Error fetching balance:", balanceError);
      }
    };

    fetchBalance();
  }, [pChainAddress, coreWalletClient]);

  const validateInputs = (): boolean => {
    if (validators.length === 0) {
      setErrorState("Please add a validator to continue");
      return false;
    }

    // Check ownership permissions
    if (ownershipState === 'differentEOA') {
      setErrorState("You are not the owner of this contract. Only the contract owner can add validators.");
      return false;
    }

    const validator = validators[0];

    // Skip balance check if we couldn't fetch the balance
    if (balance) {
      // Extract numerical value from balance string (remove " AVAX" and commas)
      const balanceValue = parseFloat(balance.replace(" AVAX", "").replace(/,/g, ""));
      const requiredBalance = Number(validator.validatorBalance) / 1000000000;

      if (balanceValue < requiredBalance) {
        setErrorState(`Insufficient P-Chain balance. You need at least ${requiredBalance.toFixed(2)} AVAX.`);
        return false;
      }
    }

    // Use contract total weight for validation if available
    if (contractTotalWeight > 0n) {
      // Ensure validator weight is treated as BigInt
      const validatorWeightBigInt = BigInt(validator.validatorWeight.toString());

      // For a new validator, its currentWeight is 0n.
      // percentageChange will be: newValidatorWeight / contractTotalWeight (current L1 total)
      const { percentageChange, exceedsMaximum } = validateStakePercentage(
        contractTotalWeight,
        validatorWeightBigInt,
        0n // currentWeightOfValidatorToChange is 0 for a new validator
      );

      if (exceedsMaximum) {
        setErrorState(`The new validator's proposed weight (${validator.validatorWeight}) represents ${percentageChange.toFixed(2)}% of the current total L1 stake (${contractTotalWeight}). This must be less than 20%.`);
        return false;
      }
    }

    return true;
  };

  const handleInitiateValidatorRegistration = async () => {
    setErrorState(null);
    setTxSuccess(null);
    
    if (!validateInputs()) {
      return;
    }

    if (!validatorManagerAddress) {
      setErrorState("Validator Manager Address is required. Please select a valid L1 subnet.");
      return;
    }

    if (ownershipState === 'differentEOA') {
      setErrorState("You are not the owner of this contract. Only the contract owner can add validators.");
      return;
    }

    if (ownershipState === 'loading') {
      setErrorState("Verifying contract ownership... please wait.");
      return;
    }

    setIsProcessing(true);
    try {
      const validator = validators[0];
      const [account] = await coreWalletClient.requestAddresses();
      
      // Process P-Chain Address
      const pChainAddressBytes = utils.bech32ToBytes(pChainAddress!);
      const pChainAddressHex = fromBytes(pChainAddressBytes, "hex");
      
      // Build arguments for transaction
      const args = [
        parseNodeID(validator.nodeID),
        validator.nodePOP.publicKey,
        {
          threshold: 1,
          addresses: [pChainAddressHex],
        },
        {
          threshold: 1,
          addresses: [pChainAddressHex],
        },
        validator.validatorWeight
      ];

      let hash;
      let receipt;

      try {
        // Try initiateValidatorRegistration directly (no simulation first)
        hash = await coreWalletClient.writeContract({
          address: validatorManagerAddress as `0x${string}`,
          abi: validatorManagerAbi.abi,
          functionName: "initiateValidatorRegistration",
          args,
          account,
          chain: viemChain
        });

        // Get receipt to extract warp message and validation ID
        receipt = await publicClient.waitForTransactionReceipt({ hash });

        if (receipt.status === 'reverted') {
          setErrorState(`Transaction reverted. Hash: ${hash}`);
          onError(`Transaction reverted. Hash: ${hash}`);
          return;
        }

        const unsignedWarpMessage = receipt.logs[0].data ?? "";
        const validationIdHex = receipt.logs[1].topics[1] ?? "";

        setTxSuccess(`Transaction successful! Hash: ${hash}`);
        onSuccess({ 
          txHash: hash,
          nodeId: validator.nodeID,
          validationId: validationIdHex,
          weight: validator.validatorWeight.toString(),
          unsignedWarpMessage: unsignedWarpMessage,
          validatorBalance: (Number(validator.validatorBalance) / 1e9).toString(), // Convert from nAVAX to AVAX
          blsProofOfPossession: validator.nodePOP.proofOfPossession,
        });

      } catch (txError) {
        // Attempt to get existing validation ID for fallback
        try {
          const nodeIdBytes = parseNodeID(validator.nodeID);
          const validationId = await getValidationIdHex(
            publicClient,
            validatorManagerAddress as `0x${string}`,
            nodeIdBytes
          );

          // Check if validation ID exists (not zero)
          if (validationId === "0x0000000000000000000000000000000000000000000000000000000000000000") {
            setErrorState("Transaction failed and no existing validation ID found for this node.");
            onError("Transaction failed and no existing validation ID found for this node.");
            return;
          }

          // Use resendRegisterValidatorMessage as fallback
          const fallbackHash = await coreWalletClient.writeContract({
            address: validatorManagerAddress as `0x${string}`,
            abi: validatorManagerAbi.abi,
            functionName: "resendRegisterValidatorMessage",
            args: [validationId],
            account,
            chain: viemChain
          });

          const fallbackReceipt = await publicClient.waitForTransactionReceipt({ hash: fallbackHash });
          
          if (fallbackReceipt.status === 'reverted') {
            setErrorState(`Fallback transaction reverted. Hash: ${fallbackHash}`);
            onError(`Fallback transaction reverted. Hash: ${fallbackHash}`);
            return;
          }

          const unsignedWarpMessage = fallbackReceipt.logs[0].data ?? "";
          
          setTxSuccess(`Fallback transaction successful! Hash: ${fallbackHash}`);
          onSuccess({ 
            txHash: fallbackHash,
            nodeId: validator.nodeID,
            validationId: validationId,
            weight: validator.validatorWeight.toString(),
            unsignedWarpMessage: unsignedWarpMessage,
            validatorBalance: (Number(validator.validatorBalance) / 1e9).toString(), // Convert from nAVAX to AVAX
            blsProofOfPossession: validator.nodePOP.proofOfPossession,
          });

        } catch (fallbackError: any) {
          let fallbackMessage = fallbackError instanceof Error ? fallbackError.message : String(fallbackError);
          
          // Handle specific fallback error types
          if (fallbackMessage.includes('User rejected')) {
            fallbackMessage = 'Transaction was rejected by user';
          } else if (fallbackMessage.includes('insufficient funds')) {
            fallbackMessage = 'Insufficient funds for transaction';
          }
          
          setErrorState(`Both primary transaction and fallback failed: ${fallbackMessage}`);
          onError(`Both primary transaction and fallback failed: ${fallbackMessage}`);
        }
      }
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
      
      setErrorState(`Transaction failed: ${message}`);
      onError(`Transaction failed: ${message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleMultisigSuccess = (txHash: string) => {
    setTxSuccess(`Multisig transaction proposed! Hash: ${txHash}`);
    // For multisig, we can't extract logs immediately, so we provide minimal data
    const validator = validators[0];
    onSuccess({ 
      txHash: txHash as `0x${string}`,
      nodeId: validator.nodeID,
      validationId: "0x0000000000000000000000000000000000000000000000000000000000000000", // Will be available after execution
      weight: validator.validatorWeight.toString(),
      unsignedWarpMessage: "", // Will be available after execution
      validatorBalance: (Number(validator.validatorBalance) / 1e9).toString(),
      blsProofOfPossession: validator.nodePOP.proofOfPossession,
    });
  };

  const handleMultisigError = (errorMessage: string) => {
    setErrorState(errorMessage);
    onError(errorMessage);
  };

  // Don't render if no subnet is selected
  if (!subnetId) {
    return (
      <div className="text-sm text-zinc-500 dark:text-zinc-400">
        Please select an L1 subnet first.
      </div>
    );
  }

  // Don't render if no validators are added
  if (validators.length === 0) {
    return (
      <div className="text-sm text-zinc-500 dark:text-zinc-400">
        Please add a validator in the previous step.
      </div>
    );
  }

  // Prepare args for multisig
  const getMultisigArgs = () => {
    if (validators.length === 0 || !pChainAddress) return [];
    
    const validator = validators[0];
    const pChainAddressBytes = utils.bech32ToBytes(pChainAddress);
    const pChainAddressHex = fromBytes(pChainAddressBytes, "hex");
    
    return [
      parseNodeID(validator.nodeID),
      validator.nodePOP.publicKey,
      {
        threshold: 1,
        addresses: [pChainAddressHex],
      },
      {
        threshold: 1,
        addresses: [pChainAddressHex],
      },
      validator.validatorWeight
    ];
  };

  return (
    <div className="space-y-4">
      {ownershipState === 'contract' && (
        <MultisigOption
          validatorManagerAddress={validatorManagerAddress}
          functionName="initiateValidatorRegistration"
          args={getMultisigArgs()}
          onSuccess={handleMultisigSuccess}
          onError={handleMultisigError}
          disabled={isProcessing || validators.length === 0 || !validatorManagerAddress || txSuccess !== null}
        >
          <Button
            onClick={handleInitiateValidatorRegistration}
            disabled={isProcessing || validators.length === 0 || !validatorManagerAddress || txSuccess !== null}
          >
            Initiate Validator Registration
          </Button>
        </MultisigOption>
      )}

      {ownershipState === 'currentWallet' && (
        <Button
          onClick={handleInitiateValidatorRegistration}
          disabled={isProcessing || validators.length === 0 || !validatorManagerAddress || txSuccess !== null}
          error={!validatorManagerAddress && subnetId ? "Could not find Validator Manager for this L1." : undefined}
        >
          {txSuccess ? 'Transaction Completed' : (isProcessing ? 'Processing...' : 'Initiate Validator Registration')}
        </Button>
      )}

      {(ownershipState === 'differentEOA' || ownershipState === 'loading') && (
        <Button
          onClick={handleInitiateValidatorRegistration}
          disabled={true}
          error={
            ownershipState === 'differentEOA' 
              ? "You are not the owner of this contract. Only the contract owner can add validators."
              : ownershipState === 'loading' 
                ? "Verifying ownership..."
                : (!validatorManagerAddress && subnetId ? "Could not find Validator Manager for this L1." : undefined)
          }
        >
          {ownershipState === 'loading' ? 'Verifying...' : 'Initiate Validator Registration'}
        </Button>
      )}

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
          value={txSuccess.replace('Transaction successful! Hash: ', '').replace('Fallback transaction successful! Hash: ', '').replace('Multisig transaction proposed! Hash: ', '')}
        />
      )}
    </div>
  );
};

export default InitiateValidatorRegistration;
