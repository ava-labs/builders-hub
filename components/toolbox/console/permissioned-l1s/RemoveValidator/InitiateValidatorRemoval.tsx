import React, { useState, useEffect } from 'react';
import { useViemChainStore } from '@/components/toolbox/stores/toolboxStore';
import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import { Button } from '@/components/toolbox/components/Button';
import SelectValidationID, { ValidationSelection } from '@/components/toolbox/components/SelectValidationID';
import validatorManagerAbi from '@/contracts/icm-contracts/compiled/ValidatorManager.json';
import { AlertCircle } from 'lucide-react';
import { Success } from '@/components/toolbox/components/Success';
import { MultisigOption } from '@/components/toolbox/components/MultisigOption';

interface InitiateValidatorRemovalProps {
  subnetId: string;
  validatorManagerAddress: string;
  onSuccess: (data: {
    txHash: `0x${string}`;
    nodeId: string;
    validationId: string;
  }) => void;
  onError: (message: string) => void;
  resetForm?: boolean;
  initialNodeId?: string;
  initialValidationId?: string;
  ownershipState: 'contract' | 'currentWallet' | 'differentEOA' | 'loading';
}

const InitiateValidatorRemoval: React.FC<InitiateValidatorRemovalProps> = ({
  subnetId,
  validatorManagerAddress,
  onSuccess,
  onError,
  resetForm,
  initialNodeId,
  initialValidationId,
  ownershipState,
}) => {
  const { coreWalletClient, publicClient } = useWalletStore();
  const viemChain = useViemChainStore();

  const [validation, setValidation] = useState<ValidationSelection>({
    validationId: initialValidationId || '',
    nodeId: initialNodeId || ''
  });
  const [componentKey, setComponentKey] = useState<number>(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setErrorState] = useState<string | null>(null);
  const [txSuccess, setTxSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (resetForm) {
      setValidation({ validationId: initialValidationId || '', nodeId: initialNodeId || '' });
      setComponentKey(prevKey => prevKey + 1);
      setIsProcessing(false);
      setErrorState(null);
      setTxSuccess(null);
    }
  }, [resetForm, initialValidationId, initialNodeId]);

  const validateInputs = (): boolean => {
    if (!validation.validationId.trim()) {
      setErrorState("Validation ID is required");
      return false;
    }

    if (!validation.nodeId.trim()) {
      setErrorState("Node ID is required");
      return false;
    }

    if (!validatorManagerAddress) {
      setErrorState("Validator Manager Address is required. Please select a valid L1 subnet.");
      return false;
    }

    if (ownershipState === 'differentEOA') {
      setErrorState("You are not the owner of this contract. Only the contract owner can remove validators.");
      return false;
    }

    if (ownershipState === 'loading') {
      setErrorState("Verifying contract ownership... please wait.");
      return false;
    }

    return true;
  };

  const handleInitiateRemoval = async () => {
    setErrorState(null);
    setTxSuccess(null);

    if (!validateInputs()) {
      return;
    }

    setIsProcessing(true);
    try {
      const [account] = await coreWalletClient.requestAddresses();

      let hash;
      let receipt;

      try {
        // Try initiateValidatorRemoval directly (no simulation first)
        hash = await coreWalletClient.writeContract({
          address: validatorManagerAddress as `0x${string}`,
          abi: validatorManagerAbi.abi,
          functionName: 'initiateValidatorRemoval',
          args: [validation.validationId],
          account,
          chain: viemChain
        });

        // Wait for transaction receipt to check if it was successful
        receipt = await publicClient.waitForTransactionReceipt({ hash });

        if (receipt.status === 'reverted') {
          setErrorState(`Transaction reverted. Hash: ${hash}`);
          onError(`Transaction reverted. Hash: ${hash}`);
          return;
        }

        setTxSuccess(`Transaction successful! Hash: ${hash}`);
        onSuccess({
          txHash: hash,
          nodeId: validation.nodeId,
          validationId: validation.validationId,
        });

      } catch (txError) {
        // Use resendValidatorRemovalMessage as fallback
        try {
          const fallbackHash = await coreWalletClient.writeContract({
            address: validatorManagerAddress as `0x${string}`,
            abi: validatorManagerAbi.abi,
            functionName: 'resendValidatorRemovalMessage',
            args: [validation.validationId],
            account,
            chain: viemChain
          });

          const fallbackReceipt = await publicClient.waitForTransactionReceipt({ hash: fallbackHash });

          if (fallbackReceipt.status === 'reverted') {
            setErrorState(`Fallback transaction reverted. Hash: ${fallbackHash}`);
            onError(`Fallback transaction reverted. Hash: ${fallbackHash}`);
            return;
          }

          setTxSuccess(`Fallback transaction successful! Hash: ${fallbackHash}`);
          onSuccess({
            txHash: fallbackHash,
            nodeId: validation.nodeId,
            validationId: validation.validationId,
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
    onSuccess({
      txHash: txHash as `0x${string}`,
      nodeId: validation.nodeId,
      validationId: validation.validationId,
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

  // Prepare args for multisig
  const getMultisigArgs = () => {
    if (!validation.validationId) return [];
    return [validation.validationId];
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <SelectValidationID
          key={`validation-selector-${componentKey}-${subnetId}`}
          value={validation.validationId}
          onChange={setValidation}
          subnetId={subnetId}
          format="hex"
        />
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Select the validator you want to remove by its Validation ID
        </p>
      </div>

      {ownershipState === 'contract' && (
        <MultisigOption
          validatorManagerAddress={validatorManagerAddress}
          functionName="initiateValidatorRemoval"
          args={getMultisigArgs()}
          onSuccess={handleMultisigSuccess}
          onError={handleMultisigError}
          disabled={isProcessing || !validation.validationId || !validation.nodeId || !validatorManagerAddress || txSuccess !== null}
        >
          <Button
            onClick={handleInitiateRemoval}
            disabled={isProcessing || !validation.validationId || !validation.nodeId || !validatorManagerAddress || txSuccess !== null}
          >
            Initiate Validator Removal
          </Button>
        </MultisigOption>
      )}

      {ownershipState === 'currentWallet' && (
        <Button
          onClick={handleInitiateRemoval}
          disabled={isProcessing || !validation.validationId || !validation.nodeId || !validatorManagerAddress || txSuccess !== null}
          error={!validatorManagerAddress && subnetId ? "Could not find Validator Manager for this L1." : undefined}
        >
          {txSuccess ? 'Transaction Completed' : (isProcessing ? 'Processing...' : 'Initiate Validator Removal')}
        </Button>
      )}

      {(ownershipState === 'differentEOA' || ownershipState === 'loading') && (
        <Button
          onClick={handleInitiateRemoval}
          disabled={true}
          error={
            ownershipState === 'differentEOA'
              ? "You are not the owner of this contract. Only the contract owner can remove validators."
              : ownershipState === 'loading'
                ? "Verifying ownership..."
                : (!validatorManagerAddress && subnetId ? "Could not find Validator Manager for this L1." : undefined)
          }
        >
          {ownershipState === 'loading' ? 'Verifying...' : 'Initiate Validator Removal'}
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

export default InitiateValidatorRemoval;
