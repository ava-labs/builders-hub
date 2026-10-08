import React, { useState, useEffect } from 'react';
import { Check, RotateCcw } from 'lucide-react';
import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import { Button } from '@/components/toolbox/components/Button';
import SelectValidationID, { ValidationSelection } from '@/components/toolbox/components/SelectValidationID';
import { Alert } from '@/components/toolbox/components/Alert';
import { MultisigOption } from '@/components/toolbox/components/MultisigOption';
import { useValidatorManager } from '@/components/toolbox/hooks/contracts';
import { useChainPublicClient } from '@/components/toolbox/hooks/useChainPublicClient';

interface InitiateValidatorRemovalProps {
  subnetId: string;
  validatorManagerAddress: string;
  onSuccess: (data: { txHash: `0x${string}`; nodeId: string; validationId: string }) => void;
  onError: (message: string) => void;
  resetForm?: boolean;
  initialNodeId?: string;
  initialValidationId?: string;
  ownershipState: 'contract' | 'currentWallet' | 'differentEOA' | 'loading' | 'error';
  refetchOwnership?: () => void;
  ownershipError?: string | null;
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
  refetchOwnership,
  ownershipError,
}) => {
  const { walletEVMAddress: connectedAddress } = useWalletStore();
  const chainPublicClient = useChainPublicClient();
  const [validation, setValidation] = useState<ValidationSelection>({
    validationId: initialValidationId || '',
    nodeId: initialNodeId || '',
  });

  // Initialize validator manager hook
  const validatorManager = useValidatorManager(validatorManagerAddress || null);
  const [componentKey, setComponentKey] = useState<number>(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setErrorState] = useState<string | null>(null);
  const [txSuccess, setTxSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (resetForm) {
      setValidation({ validationId: initialValidationId || '', nodeId: initialNodeId || '' });
      setComponentKey((prevKey) => prevKey + 1);
      setIsProcessing(false);
      setErrorState(null);
      setTxSuccess(null);
    }
  }, [resetForm, initialValidationId, initialNodeId]);

  const validateInputs = (): boolean => {
    if (!validation.validationId.trim()) {
      setErrorState('Validation ID is required');
      return false;
    }

    if (!validation.nodeId.trim()) {
      setErrorState('Node ID is required');
      return false;
    }

    if (!validatorManagerAddress) {
      setErrorState('Validator Manager Address is required. Please select a valid L1 subnet.');
      return false;
    }

    if (ownershipState === 'differentEOA') {
      setErrorState('You are not the owner of this contract. Only the contract owner can remove validators.');
      return false;
    }

    if (ownershipState === 'loading') {
      setErrorState('Verifying contract ownership... please wait.');
      return false;
    }

    if (ownershipState === 'error') {
      setErrorState('Ownership verification failed. Please retry.');
      return false;
    }

    return true;
  };

  const handleInitiateRemoval = async () => {
    setErrorState(null);
    setTxSuccess(null);

    if (!connectedAddress) {
      setErrorState('Wallet not connected');
      return;
    }

    if (!validateInputs()) {
      return;
    }

    setIsProcessing(true);
    try {
      let hash;
      let receipt;

      try {
        // Use validator manager hook - notification happens automatically
        hash = await validatorManager.initiateValidatorRemoval(validation.validationId);

        // Wait for transaction receipt to check if it was successful
        receipt = await chainPublicClient!.waitForTransactionReceipt({ hash: hash as `0x${string}` });

        if (receipt.status === 'reverted') {
          setErrorState(`Transaction reverted. Hash: ${hash}`);
          onError(`Transaction reverted. Hash: ${hash}`);
          return;
        }

        setTxSuccess(`Transaction successful! Hash: ${hash}`);
        onSuccess({
          txHash: hash as `0x${string}`,
          nodeId: validation.nodeId,
          validationId: validation.validationId,
        });
      } catch (txError: any) {
        const primaryMessage = txError instanceof Error ? txError.message : String(txError);

        // Only attempt resend fallback if the error suggests a pending removal
        // (e.g. InvalidValidatorStatus or generic reverts). For user rejections,
        // insufficient funds, ownership errors, etc. — the hook already parsed these.
        const shouldAttemptFallback =
          primaryMessage.includes('reverted') ||
          primaryMessage.includes('Invalid validator status') ||
          primaryMessage.includes('execution');

        if (!shouldAttemptFallback) {
          setErrorState(`Transaction failed: ${primaryMessage}`);
          onError(`Transaction failed: ${primaryMessage}`);
          return;
        }

        // Attempt resend fallback for possible pending removal
        try {
          const fallbackHash = await validatorManager.resendValidatorRemovalMessage(validation.validationId);
          const fallbackReceipt = await chainPublicClient!.waitForTransactionReceipt({
            hash: fallbackHash as `0x${string}`,
          });

          if (fallbackReceipt.status === 'reverted') {
            setErrorState(`Transaction failed: ${primaryMessage}`);
            onError(`Transaction failed: ${primaryMessage}. Resend also reverted.`);
            return;
          }

          setTxSuccess(`Removal message resent successfully! Hash: ${fallbackHash}`);
          onSuccess({
            txHash: fallbackHash as `0x${string}`,
            nodeId: validation.nodeId,
            validationId: validation.validationId,
          });
        } catch (fallbackError: any) {
          const fallbackMessage = fallbackError instanceof Error ? fallbackError.message : String(fallbackError);
          setErrorState(`Transaction failed: ${primaryMessage}`);
          onError(`Transaction failed: ${primaryMessage}. Resend fallback also failed: ${fallbackMessage}`);
        }
      }
    } catch (err: any) {
      const message = err instanceof Error ? err.message : String(err);
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
    return <p className="text-[13px] text-zinc-500 dark:text-zinc-400">Select an L1 subnet first.</p>;
  }

  // Prepare args for multisig
  const getMultisigArgs = () => {
    if (!validation.validationId) return [];
    return [validation.validationId];
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <SelectValidationID
          key={`validation-selector-${componentKey}-${subnetId}`}
          value={validation.validationId}
          onChange={setValidation}
          subnetId={subnetId}
          format="hex"
        />
        <p className="text-[12px] text-zinc-500 dark:text-zinc-400">
          Pick the validator to remove by its Validation ID.
        </p>
      </div>

      {ownershipState === 'contract' && (
        <MultisigOption
          validatorManagerAddress={validatorManagerAddress}
          functionName="initiateValidatorRemoval"
          args={getMultisigArgs()}
          onSuccess={handleMultisigSuccess}
          onError={handleMultisigError}
          disabled={
            isProcessing ||
            !validation.validationId ||
            !validation.nodeId ||
            !validatorManagerAddress ||
            txSuccess !== null
          }
        >
          <Button
            onClick={handleInitiateRemoval}
            disabled={
              isProcessing ||
              !validation.validationId ||
              !validation.nodeId ||
              !validatorManagerAddress ||
              txSuccess !== null
            }
            loading={isProcessing}
            loadingText="Initiating…"
          >
            Initiate validator removal
          </Button>
        </MultisigOption>
      )}

      {ownershipState === 'currentWallet' && (
        <Button
          onClick={handleInitiateRemoval}
          disabled={
            isProcessing ||
            !validation.validationId ||
            !validation.nodeId ||
            !validatorManagerAddress ||
            txSuccess !== null
          }
          loading={isProcessing}
          loadingText="Initiating…"
          icon={txSuccess ? <Check className="h-3.5 w-3.5" /> : undefined}
          error={!validatorManagerAddress && subnetId ? 'Could not find Validator Manager for this L1.' : undefined}
        >
          {txSuccess ? 'Transaction completed' : 'Initiate validator removal'}
        </Button>
      )}

      {ownershipState === 'differentEOA' && (
        <Button
          onClick={handleInitiateRemoval}
          disabled={true}
          error="This wallet doesn't own the contract. Only the contract owner can remove validators."
        >
          Initiate validator removal
        </Button>
      )}

      {ownershipState === 'loading' && (
        <Button onClick={handleInitiateRemoval} disabled={true} loading={true} loadingText="Verifying ownership…">
          Verifying ownership
        </Button>
      )}

      {ownershipState === 'error' && (
        <Button
          variant="outline"
          onClick={() => refetchOwnership?.()}
          icon={<RotateCcw className="h-3.5 w-3.5" />}
          error={ownershipError || "Couldn't verify contract ownership. Retry the check."}
        >
          Retry ownership check
        </Button>
      )}

      {error && <Alert variant="error">{error}</Alert>}
    </div>
  );
};

export default InitiateValidatorRemoval;
