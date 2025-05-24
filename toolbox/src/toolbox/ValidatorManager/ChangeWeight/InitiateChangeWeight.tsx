import React, { useState, useEffect } from 'react';
import { useViemChainStore } from '../../../stores/toolboxStore';
import { useWalletStore } from '../../../stores/walletStore';
import { Input } from '../../../components/Input';
import { Button } from '../../../components/Button';
import SelectValidationID, { ValidationSelection } from '../../../components/SelectValidationID';
import { validateContractOwner } from '../../../coreViem/hooks/validateContractOwner';
import { getValidatorWeight } from '../../../coreViem/hooks/getValidatorWeight';
import { validateStakePercentage } from '../../../coreViem/hooks/getTotalStake';
import { useValidatorManagerDetails } from '../../hooks/useValidatorManagerDetails';
import validatorManagerAbi from '../../../../contracts/icm-contracts/compiled/ValidatorManager.json';
import { AlertCircle } from 'lucide-react';
import { Success } from '../../../components/Success';
import { MultisigOption } from '../../../components/MultisigOption';

interface InitiateChangeWeightProps {
  subnetId: string;
  validatorManagerAddress: string;
  onSuccess: (data: {
    txHash: `0x${string}`;
    nodeId: string;
    validationId: string;
    weight: string;
  }) => void;
  onError: (message: string) => void;
  resetForm?: boolean;
  initialNodeId?: string;
  initialValidationId?: string;
  initialWeight?: string;
}

const InitiateChangeWeight: React.FC<InitiateChangeWeightProps> = ({
  subnetId,
  validatorManagerAddress,
  onSuccess,
  onError,
  resetForm,
  initialNodeId,
  initialValidationId,
  initialWeight,
}) => {
  const { coreWalletClient, publicClient } = useWalletStore();
  const viemChain = useViemChainStore();

  const [validation, setValidation] = useState<ValidationSelection>({ 
    validationId: initialValidationId || '', 
    nodeId: initialNodeId || '' 
  });
  const [weight, setWeight] = useState(initialWeight || '');
  const { contractTotalWeight } = useValidatorManagerDetails({ subnetId });
  const [isContractOwner, setIsContractOwner] = useState<boolean | null>(null);
  const [componentKey, setComponentKey] = useState<number>(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setErrorState] = useState<string | null>(null);
  const [txSuccess, setTxSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (resetForm) {
      setValidation({ validationId: initialValidationId || '', nodeId: initialNodeId || '' });
      setWeight(initialWeight || '');
      setComponentKey(prevKey => prevKey + 1);
      setIsProcessing(false);
      setErrorState(null);
      setTxSuccess(null);
      setIsContractOwner(null);
    }
  }, [resetForm]);

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

  const handleInitiateChangeWeight = async () => {
    setErrorState(null);
    setTxSuccess(null);
    if (!validation.validationId.trim()) {
      setErrorState("Validation ID is required"); return;
    }
    if (!validation.nodeId.trim()) {
      setErrorState("Node ID is required"); return;
    }
    if (!weight.trim()) {
      setErrorState("Weight is required"); return;
    }
    const weightNum = Number(weight);
    if (isNaN(weightNum) || weightNum <= 0) {
      setErrorState("Weight must be a positive number"); return;
    }
    if (!validatorManagerAddress) {
      setErrorState("Validator Manager Address is required. Please select a valid L1 subnet."); return;
    }
    if (isContractOwner === false) {
      setErrorState("You are not the owner of this contract. Only the contract owner can change validator weights."); return;
    }
    if (isContractOwner === null) {
      setErrorState("Verifying contract ownership... please wait."); return;
    }

    setIsProcessing(true);
    try {
      let validatorCurrentWeight: bigint | null = null;
      if (validation.validationId) {
        validatorCurrentWeight = await getValidatorWeight(
          publicClient,
          validatorManagerAddress as `0x${string}`,
          validation.validationId
        );
      }

      if (contractTotalWeight > 0n) {
        const weightBigInt = BigInt(weight);
        const validationDetails = validateStakePercentage(
          contractTotalWeight,
          weightBigInt,
          validatorCurrentWeight || 0n
        );
        if (validationDetails.exceedsMaximum) {
          const currentWeightDisplay = validatorCurrentWeight?.toString() || "0";
          const errorMessage = `The proposed weight change from ${currentWeightDisplay} to ${weight} represents ${validationDetails.percentageChange.toFixed(2)}% of the current total L1 stake (${contractTotalWeight}). This adjustment percentage must be less than 20%.`;
          setErrorState(errorMessage);
          setIsProcessing(false);
          return;
        }
      }

      const weightBigInt = BigInt(weight);
      const changeWeightTx = await coreWalletClient.writeContract({
        address: validatorManagerAddress as `0x${string}`,
        abi: validatorManagerAbi.abi,
        functionName: 'initiateValidatorWeightUpdate',
        args: [validation.validationId, weightBigInt],
        chain: viemChain,
        account: coreWalletClient.account,
      });

      // Wait for transaction receipt to check if it was successful
      const receipt = await publicClient.waitForTransactionReceipt({
        hash: changeWeightTx,
      });

      if (receipt.status === 'reverted') {
        setErrorState(`Transaction reverted. Hash: ${changeWeightTx}`);
        onError(`Transaction reverted. Hash: ${changeWeightTx}`);
        return;
      }

      setTxSuccess(`Transaction successful! Hash: ${changeWeightTx}`);
      onSuccess({ 
        txHash: changeWeightTx,
        nodeId: validation.nodeId,
        validationId: validation.validationId,
        weight: weight,
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

  const handleMultisigSuccess = (txHash: string) => {
    setTxSuccess(`Multisig transaction proposed! Hash: ${txHash}`);
    onSuccess({ 
      txHash: txHash as `0x${string}`,
      nodeId: validation.nodeId,
      validationId: validation.validationId,
      weight: weight,
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

  return (
    <div className="space-y-4">
      <SelectValidationID
        key={`validation-selector-${componentKey}-${subnetId}`}
        value={validation.validationId}
        onChange={setValidation}
        subnetId={subnetId}
        format="hex"
      />
      
      <Input
        id="weight"
        type="text"
        value={weight}
        onChange={(e) => setWeight(e)}
        placeholder="Enter new weight"
        label="New Weight"
        disabled={isProcessing || !subnetId}
        error={error && (error.includes("Weight") || error.includes("positive number")) ? error : undefined}
      />
      
      <MultisigOption
        isContractOwner={isContractOwner}
        validatorManagerAddress={validatorManagerAddress}
        functionName="initiateValidatorWeightUpdate"
        args={[validation.validationId, BigInt(weight || 0)]}
        onSuccess={handleMultisigSuccess}
        onError={handleMultisigError}
        disabled={isProcessing || !validation.validationId || !validation.nodeId || !weight || !validatorManagerAddress || txSuccess !== null}
      >
        <Button
          onClick={handleInitiateChangeWeight}
          disabled={isProcessing || !validation.validationId || !validation.nodeId || !weight || !validatorManagerAddress || isContractOwner === false || (isContractOwner === null && !txSuccess) || txSuccess !== null}
          error={(!validatorManagerAddress && subnetId ? "Could not find Validator Manager for this L1." : undefined) || 
                 (isContractOwner === false && !txSuccess ? "Not contract owner." : undefined) ||
                 (isContractOwner === null && validatorManagerAddress && !txSuccess ? "Verifying ownership..." : undefined)
              }
        >
          {txSuccess ? 'Transaction Completed' : (isProcessing ? 'Processing...' : (isContractOwner === null && validatorManagerAddress && !txSuccess ? 'Verifying...' : 'Initiate Change Weight'))}
        </Button>
      </MultisigOption>

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
          value={txSuccess.replace('Transaction successful! Hash: ', '').replace('Multisig transaction proposed! Hash: ', '')}
        />
      )}
    </div>
  );
};

export default InitiateChangeWeight; 