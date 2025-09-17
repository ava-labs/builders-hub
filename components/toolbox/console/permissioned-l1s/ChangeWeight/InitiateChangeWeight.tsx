import React, { useState, useEffect } from 'react';
import { useViemChainStore } from '@/components/toolbox/stores/toolboxStore';
import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import { Input } from '@/components/toolbox/components/Input';
import { Button } from '@/components/toolbox/components/Button';
import SelectValidationID, { ValidationSelection } from '@/components/toolbox/components/SelectValidationID';
import { getValidatorWeight } from '@/components/toolbox/coreViem/hooks/getValidatorWeight';
import { validateStakePercentage } from '@/components/toolbox/coreViem/hooks/getTotalStake';
import validatorManagerAbi from '@/contracts/icm-contracts/compiled/ValidatorManager.json';
import { AlertCircle } from 'lucide-react';
import { Success } from '@/components/toolbox/components/Success';
import { MultisigOption } from '@/components/toolbox/components/MultisigOption';

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
  ownershipState: 'contract' | 'currentWallet' | 'differentEOA' | 'loading';
  contractTotalWeight: bigint;
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
  ownershipState,
  contractTotalWeight,
}) => {
  const { coreWalletClient, publicClient } = useWalletStore();
  const viemChain = useViemChainStore();

  const [validation, setValidation] = useState<ValidationSelection>({
    validationId: initialValidationId || '',
    nodeId: initialNodeId || ''
  });
  const [weight, setWeight] = useState(initialWeight || '');
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
    }
  }, [resetForm]);

  const handleInitiateChangeWeight = async () => {
    setErrorState(null);
    setTxSuccess(null);

    if (!coreWalletClient) {
      setErrorState("Core wallet not found");
      return;
    }

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
    if (ownershipState === 'differentEOA') {
      setErrorState("You are not the owner of this contract. Only the contract owner can change validator weights."); return;
    }
    if (ownershipState === 'loading') {
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

      {ownershipState === 'contract' && (
        <MultisigOption
          validatorManagerAddress={validatorManagerAddress}
          functionName="initiateValidatorWeightUpdate"
          args={[validation.validationId, BigInt(weight || 0)]}
          onSuccess={handleMultisigSuccess}
          onError={handleMultisigError}
          disabled={isProcessing || !validation.validationId || !validation.nodeId || !weight || !validatorManagerAddress || txSuccess !== null}
        >
          <Button
            onClick={handleInitiateChangeWeight}
            disabled={isProcessing || !validation.validationId || !validation.nodeId || !weight || !validatorManagerAddress || txSuccess !== null}
          >
            Initiate Change Weight
          </Button>
        </MultisigOption>
      )}

      {ownershipState === 'currentWallet' && (
        <Button
          onClick={handleInitiateChangeWeight}
          disabled={isProcessing || !validation.validationId || !validation.nodeId || !weight || !validatorManagerAddress || txSuccess !== null}
          error={!validatorManagerAddress && subnetId ? "Could not find Validator Manager for this L1." : undefined}
        >
          {txSuccess ? 'Transaction Completed' : (isProcessing ? 'Processing...' : 'Initiate Change Weight')}
        </Button>
      )}

      {(ownershipState === 'differentEOA' || ownershipState === 'loading') && (
        <Button
          onClick={handleInitiateChangeWeight}
          disabled={true}
          error={
            ownershipState === 'differentEOA'
              ? "You are not the owner of this contract. Only the contract owner can change validator weights."
              : ownershipState === 'loading'
                ? "Verifying ownership..."
                : (!validatorManagerAddress && subnetId ? "Could not find Validator Manager for this L1." : undefined)
          }
        >
          {ownershipState === 'loading' ? 'Verifying...' : 'Initiate Change Weight'}
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
          value={txSuccess.replace('Transaction successful! Hash: ', '').replace('Multisig transaction proposed! Hash: ', '')}
        />
      )}
    </div>
  );
};

export default InitiateChangeWeight; 
