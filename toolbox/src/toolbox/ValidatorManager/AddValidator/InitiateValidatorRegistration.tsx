import React, { useState, useEffect } from 'react';
import { useViemChainStore } from '../../../stores/toolboxStore';
import { useWalletStore } from '../../../stores/walletStore';
import { Button } from '../../../components/Button';
import { ValidatorListInput, ConvertToL1Validator } from '../../../components/ValidatorListInput';
import { validateContractOwner } from '../../../coreViem/hooks/validateContractOwner';
import { validateStakePercentage } from '../../../coreViem/hooks/getTotalStake';
import { useValidatorManagerDetails } from '../../hooks/useValidatorManagerDetails';
import validatorManagerAbi from '../../../../contracts/icm-contracts/compiled/ValidatorManager.json';
import { AlertCircle } from 'lucide-react';
import { Success } from '../../../components/Success';
import { parseNodeID } from '../../../coreViem/utils/ids';
import { fromBytes } from 'viem';
import { utils } from '@avalabs/avalanchejs';
import { formatAvaxBalance } from '../../../coreViem/utils/format';
import { getPChainBalance } from '../../../coreViem/methods/getPChainbalance';

interface InitiateValidatorRegistrationProps {
  subnetId: string;
  validatorManagerAddress: string;
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
  resetForm?: boolean;
  initialValidators?: ConvertToL1Validator[];
}

const InitiateValidatorRegistration: React.FC<InitiateValidatorRegistrationProps> = ({
  subnetId,
  validatorManagerAddress,
  onSuccess,
  onError,
  resetForm,
  initialValidators,
}) => {
  const { coreWalletClient, publicClient, pChainAddress } = useWalletStore();
  const viemChain = useViemChainStore();

  const [validators, setValidators] = useState<ConvertToL1Validator[]>(initialValidators || []);
  const { contractTotalWeight, l1WeightError } = useValidatorManagerDetails({ subnetId });
  const [isContractOwner, setIsContractOwner] = useState<boolean | null>(null);
  const [componentKey, setComponentKey] = useState<number>(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setErrorState] = useState<string | null>(null);
  const [txSuccess, setTxSuccess] = useState<string | null>(null);
  const [rawPChainBalanceNavax, setRawPChainBalanceNavax] = useState<bigint | null>(null);
  const [balance, setBalance] = useState("0");

  useEffect(() => {
    if (resetForm) {
      setValidators(initialValidators || []);
      setComponentKey(prevKey => prevKey + 1);
      setIsProcessing(false);
      setErrorState(null);
      setTxSuccess(null);
      setIsContractOwner(null);
    }
  }, [resetForm, initialValidators]);

  // Fetch P-Chain balance when component mounts
  useEffect(() => {
    const fetchBalance = async () => {
      if (!pChainAddress || !coreWalletClient) return;

      try {
        const balanceValue = await getPChainBalance(coreWalletClient);
        const formattedBalance = formatAvaxBalance(balanceValue);
        setBalance(formattedBalance);
        setRawPChainBalanceNavax(balanceValue);
      } catch (balanceError) {
        console.error("Error fetching balance:", balanceError);
      }
    };

    fetchBalance();
  }, [pChainAddress, coreWalletClient]);

  useEffect(() => {
    const checkOwnership = async () => {
      // Don't check ownership if transaction was successful
      if (txSuccess) return;
      
      if (validatorManagerAddress && publicClient && coreWalletClient) {
        setIsContractOwner(null);
        try {
          const [account] = await coreWalletClient.requestAddresses();
          const ownershipValidated = await validateContractOwner(
            publicClient,
            validatorManagerAddress as `0x${string}`,
            account
          );
          setIsContractOwner(ownershipValidated);
        } catch (err) {
          setIsContractOwner(false);
        }
      }
    };
    checkOwnership();
  }, [validatorManagerAddress, publicClient, coreWalletClient, txSuccess]);

  const validateInputs = (): boolean => {
    if (validators.length === 0) {
      setErrorState("Please add a validator to continue");
      return false;
    }

    // Check if user is contract owner
    if (isContractOwner === false) {
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

    if (isContractOwner === false) {
      setErrorState("You are not the owner of this contract. Only the contract owner can add validators.");
      return;
    }

    if (isContractOwner === null) {
      setErrorState("Verifying contract ownership... please wait.");
      return;
    }

    setIsProcessing(true);
    try {
      const validator = validators[0];
      
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

      // First, simulate the transaction
      let simulationFailed = false;
      try {
        await publicClient.simulateContract({
          address: validatorManagerAddress as `0x${string}`,
          abi: validatorManagerAbi.abi,
          functionName: "initiateValidatorRegistration",
          args,
          account: coreWalletClient.account,
        });
      } catch (simulationError: any) {
        console.warn("Transaction simulation failed, attempting fallback:", simulationError);
        simulationFailed = true;
        setErrorState("Transaction simulation failed. Attempting fallback method...");
      }

      // If simulation failed, try the fallback method immediately
      if (simulationFailed) {
        try {
          // Get validation ID from registeredValidators using nodeID
          const nodeIdBytes = parseNodeID(validator.nodeID);
          const validationId = await publicClient.readContract({
            address: validatorManagerAddress as `0x${string}`,
            abi: validatorManagerAbi.abi,
            functionName: "registeredValidators",
            args: [nodeIdBytes],
          }) as `0x${string}`;

          // Check if validation ID exists (not zero)
          if (validationId === "0x0000000000000000000000000000000000000000000000000000000000000000") {
            setErrorState("No existing validation ID found for this node. Cannot use fallback method.");
            onError("No existing validation ID found for this node. Cannot use fallback method.");
            return;
          }

          // Use resendRegisterValidatorMessage as fallback
          const fallbackHash = await coreWalletClient.writeContract({
            address: validatorManagerAddress as `0x${string}`,
            abi: validatorManagerAbi.abi,
            functionName: "resendRegisterValidatorMessage",
            args: [validationId],
            account: coreWalletClient.account,
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
          return;
        } catch (fallbackError: any) {
          let fallbackMessage = fallbackError instanceof Error ? fallbackError.message : String(fallbackError);
          
          // Handle specific fallback error types
          if (fallbackMessage.includes('User rejected')) {
            fallbackMessage = 'Fallback transaction was rejected by user';
          } else if (fallbackMessage.includes('insufficient funds')) {
            fallbackMessage = 'Insufficient funds for fallback transaction';
          }
          
          setErrorState(`Fallback method failed: ${fallbackMessage}`);
          onError(`Fallback method failed: ${fallbackMessage}`);
          return;
        }
      }

      // If simulation succeeded, proceed with original transaction
      const hash = await coreWalletClient.writeContract({
        address: validatorManagerAddress as `0x${string}`,
        abi: validatorManagerAbi.abi,
        functionName: "initiateValidatorRegistration",
        args,
        account: coreWalletClient.account,
        chain: viemChain
      });

      // Get receipt to extract warp message and validation ID
      const receipt = await publicClient.waitForTransactionReceipt({ hash });

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

  // Don't render if no subnet is selected
  if (!subnetId) {
    return (
      <div className="text-sm text-zinc-500 dark:text-zinc-400">
        Please select an L1 subnet first.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <ValidatorListInput
        key={`validator-input-${componentKey}`}
        validators={validators}
        onChange={setValidators}
        defaultAddress={pChainAddress ? pChainAddress : ""}
        label="Add New Validator"
        description="Add a validator to your L1 by pasting the JSON response from your node"
        l1TotalInitializedWeight={!l1WeightError && contractTotalWeight > 0n ? contractTotalWeight : null}
        userPChainBalanceNavax={rawPChainBalanceNavax}
        maxValidators={1}
      />
      
      <Button
        onClick={handleInitiateValidatorRegistration}
        disabled={isProcessing || validators.length === 0 || !validatorManagerAddress || isContractOwner === false || (isContractOwner === null && !txSuccess) || txSuccess !== null}
        error={(!validatorManagerAddress && subnetId ? "Could not find Validator Manager for this L1." : undefined) || 
               (isContractOwner === false && !txSuccess ? "Not contract owner." : undefined) ||
               (isContractOwner === null && validatorManagerAddress && !txSuccess ? "Verifying ownership..." : undefined)
            }
      >
        {txSuccess ? 'Transaction Completed' : (isProcessing ? 'Processing...' : (isContractOwner === null && validatorManagerAddress && !txSuccess ? 'Verifying...' : 'Initiate Validator Registration'))}
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
          value={txSuccess.replace('Transaction successful! Hash: ', '')}
        />
      )}
    </div>
  );
};

export default InitiateValidatorRegistration;
