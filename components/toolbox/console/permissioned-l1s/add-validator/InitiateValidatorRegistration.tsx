import React, { useState } from 'react';
import { Check, RotateCcw } from 'lucide-react';
import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import { Button } from '@/components/toolbox/components/Button';
import { ConvertToL1Validator } from '@/components/toolbox/components/ValidatorListInput';
import { validateStakePercentage } from '@/components/toolbox/coreViem/hooks/getTotalStake';
import { parseNodeID, parsePChainAddress } from '@/components/toolbox/coreViem/utils/ids';
import { MultisigOption } from '@/components/toolbox/components/MultisigOption';
import { getValidationIdHex } from '@/components/toolbox/coreViem/hooks/getValidationID';
import { Alert } from '@/components/toolbox/components/Alert';
import { useValidatorManager } from '@/components/toolbox/hooks/contracts';
import { useChainPublicClient } from '@/components/toolbox/hooks/useChainPublicClient';
import { WARP_PRECOMPILE_ADDRESS } from '@avalanche-sdk/interchain/warp';

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
  ownershipState: 'contract' | 'currentWallet' | 'differentEOA' | 'loading' | 'error';
  contractTotalWeight: bigint;
  l1WeightError: string | null;
  refetchOwnership?: () => void;
  ownershipError?: string | null;
}

const InitiateValidatorRegistration: React.FC<InitiateValidatorRegistrationProps> = ({
  subnetId,
  validatorManagerAddress,
  validators,
  onSuccess,
  onError,
  ownershipState,
  contractTotalWeight,
  refetchOwnership,
  ownershipError,
}) => {
  const { walletEVMAddress: connectedAddress } = useWalletStore();
  const chainPublicClient = useChainPublicClient();
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setErrorState] = useState<string | null>(null);
  const [txSuccess, setTxSuccess] = useState<string | null>(null);

  // Initialize validator manager hook
  const validatorManager = useValidatorManager(validatorManagerAddress || null);

  const validateInputs = (): boolean => {
    if (validators.length === 0) {
      setErrorState('Please add a validator to continue');
      return false;
    }

    // Check ownership permissions
    if (ownershipState === 'differentEOA') {
      setErrorState('You are not the owner of this contract. Only the contract owner can add validators.');
      return false;
    }

    const validator = validators[0];

    // Use contract total weight for validation if available
    if (contractTotalWeight > 0n) {
      // Ensure validator weight is treated as BigInt
      const validatorWeightBigInt = BigInt(validator.validatorWeight.toString());

      // For a new validator, its currentWeight is 0n.
      // percentageChange will be: newValidatorWeight / contractTotalWeight (current L1 total)
      const { percentageChange, exceedsMaximum } = validateStakePercentage(
        contractTotalWeight,
        validatorWeightBigInt,
        0n, // currentWeightOfValidatorToChange is 0 for a new validator
      );

      if (exceedsMaximum) {
        setErrorState(
          `The new validator's proposed weight (${validator.validatorWeight}) represents ${percentageChange.toFixed(2)}% of the current total L1 stake (${contractTotalWeight}). This must be less than 20%.`,
        );
        return false;
      }
    }

    return true;
  };

  const handleInitiateValidatorRegistration = async () => {
    setErrorState(null);
    setTxSuccess(null);

    if (!connectedAddress) {
      setErrorState('Wallet not connected');
      return;
    }

    if (!validateInputs()) {
      return;
    }

    if (!validatorManagerAddress) {
      setErrorState('Validator Manager Address is required. Please select a valid L1 subnet.');
      return;
    }

    if (ownershipState === 'differentEOA') {
      setErrorState('You are not the owner of this contract. Only the contract owner can add validators.');
      return;
    }

    if (ownershipState === 'loading') {
      setErrorState('Verifying contract ownership... please wait.');
      return;
    }

    setIsProcessing(true);
    try {
      const validator = validators[0];

      // Process P-Chain Addresses using shared utility
      const pChainRemainingBalanceOwnerAddressesHex = validator.remainingBalanceOwner.addresses.map(parsePChainAddress);
      const pChainDisableOwnerAddressesHex = validator.deactivationOwner.addresses.map(parsePChainAddress);

      let hash;
      let receipt;

      try {
        // Use validator manager hook - notification happens automatically
        hash = await validatorManager.initiateValidatorRegistration({
          nodeID: parseNodeID(validator.nodeID),
          blsPublicKey: validator.nodePOP.publicKey,
          remainingBalanceOwner: {
            threshold: validator.remainingBalanceOwner.threshold,
            addresses: pChainRemainingBalanceOwnerAddressesHex,
          },
          disableOwner: {
            threshold: validator.deactivationOwner.threshold,
            addresses: pChainDisableOwnerAddressesHex,
          },
          weight: validator.validatorWeight,
        });

        // Get receipt to extract warp message and validation ID
        receipt = await chainPublicClient!.waitForTransactionReceipt({ hash: hash as `0x${string}` });

        if (receipt.status === 'reverted') {
          setErrorState(`Transaction reverted. Hash: ${hash}`);
          onError(`Transaction reverted. Hash: ${hash}`);
          return;
        }

        // Filter by emitter address rather than position — any intermediate
        // contract emitting a log would shift indices and cause us to read
        // wrong data (or throw on undefined).
        const warpLog = receipt.logs.find((l) => l.address.toLowerCase() === WARP_PRECOMPILE_ADDRESS.toLowerCase());
        const registrationLog = receipt.logs.find(
          (l) => l.address.toLowerCase() === (validatorManagerAddress as string).toLowerCase() && l.topics.length >= 2,
        );
        if (!warpLog || !registrationLog) {
          const msg =
            'Registration tx was mined but the expected warp/registration events are missing from the receipt.';
          setErrorState(msg);
          onError(msg);
          return;
        }
        const unsignedWarpMessage = warpLog.data ?? '';
        const validationIdHex = registrationLog.topics[1] ?? '';

        setTxSuccess(`Transaction successful! Hash: ${hash}`);
        onSuccess({
          txHash: receipt.transactionHash as `0x${string}`,
          nodeId: validator.nodeID,
          validationId: validationIdHex,
          weight: validator.validatorWeight.toString(),
          unsignedWarpMessage: unsignedWarpMessage,
          validatorBalance: (Number(validator.validatorBalance) / 1e9).toString(), // Convert from nAVAX to AVAX
          blsProofOfPossession: validator.nodePOP.proofOfPossession,
        });
      } catch (txError: any) {
        const primaryMessage = txError instanceof Error ? txError.message : String(txError);

        // Only attempt the resend fallback if the error suggests the node might already
        // have a pending registration (e.g. InvalidValidatorStatus or generic reverts).
        // For user rejections, insufficient funds, bad BLS keys, etc. — surface directly.
        const shouldAttemptFallback =
          primaryMessage.includes('reverted') ||
          primaryMessage.includes('Invalid validator status') ||
          primaryMessage.includes('execution');

        if (!shouldAttemptFallback) {
          setErrorState(`Transaction failed: ${primaryMessage}`);
          onError(`Transaction failed: ${primaryMessage}`);
          return;
        }

        // Attempt resend fallback for possible duplicate registration
        try {
          const nodeIdBytes = parseNodeID(validator.nodeID);
          const validationId = await getValidationIdHex(
            chainPublicClient!,
            validatorManagerAddress as `0x${string}`,
            nodeIdBytes,
          );

          // No existing validation ID — the node was never registered, so the primary error is the real problem
          if (validationId === '0x0000000000000000000000000000000000000000000000000000000000000000') {
            setErrorState(`Transaction failed: ${primaryMessage}`);
            onError(`Transaction failed: ${primaryMessage}`);
            return;
          }

          // Existing validation ID found — attempt to resend the registration message
          const fallbackHash = await validatorManager.resendRegisterValidatorMessage(validationId);

          const fallbackReceipt = await chainPublicClient!.waitForTransactionReceipt({
            hash: fallbackHash as `0x${string}`,
          });

          if (fallbackReceipt.status === 'reverted') {
            setErrorState(
              `Resend registration message reverted. The node may already be fully registered. Hash: ${fallbackHash}`,
            );
            onError(`Resend registration message reverted. Hash: ${fallbackHash}`);
            return;
          }

          const unsignedWarpMessage = fallbackReceipt.logs[0].data ?? '';

          setTxSuccess(`Registration message resent successfully! Hash: ${fallbackHash}`);
          onSuccess({
            txHash: fallbackHash as `0x${string}`,
            nodeId: validator.nodeID,
            validationId: validationId,
            weight: validator.validatorWeight.toString(),
            unsignedWarpMessage: unsignedWarpMessage,
            validatorBalance: (Number(validator.validatorBalance) / 1e9).toString(),
            blsProofOfPossession: validator.nodePOP.proofOfPossession,
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
    // For multisig, we can't extract logs immediately, so we provide minimal data
    const validator = validators[0];
    onSuccess({
      txHash: txHash as `0x${string}`,
      nodeId: validator.nodeID,
      validationId: '0x0000000000000000000000000000000000000000000000000000000000000000', // Will be available after execution
      weight: validator.validatorWeight.toString(),
      unsignedWarpMessage: '', // Will be available after execution
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
    return <p className="text-[13px] text-zinc-500 dark:text-zinc-400">Select an L1 subnet first.</p>;
  }

  // Don't render if no validators are added
  if (validators.length === 0) {
    return <p className="text-[13px] text-zinc-500 dark:text-zinc-400">Add a validator above first.</p>;
  }

  // Prepare args for multisig
  const getMultisigArgs = () => {
    if (validators.length === 0) return [];

    const validator = validators[0];

    // Process all P-Chain addresses for multisig using shared utility
    const pChainRemainingBalanceOwnerAddressesHex = validator.remainingBalanceOwner.addresses.map(parsePChainAddress);
    const pChainDisableOwnerAddressesHex = validator.deactivationOwner.addresses.map(parsePChainAddress);

    return [
      parseNodeID(validator.nodeID),
      validator.nodePOP.publicKey,
      {
        threshold: validator.remainingBalanceOwner.threshold,
        addresses: pChainRemainingBalanceOwnerAddressesHex,
      },
      {
        threshold: validator.deactivationOwner.threshold,
        addresses: pChainDisableOwnerAddressesHex,
      },
      validator.validatorWeight,
    ];
  };

  return (
    <div className="flex flex-col gap-4">
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
            loading={isProcessing}
            loadingText="Initiating…"
          >
            Initiate validator registration
          </Button>
        </MultisigOption>
      )}

      {ownershipState === 'currentWallet' && (
        <Button
          onClick={handleInitiateValidatorRegistration}
          disabled={isProcessing || validators.length === 0 || !validatorManagerAddress || txSuccess !== null}
          loading={isProcessing}
          loadingText="Initiating…"
          icon={txSuccess ? <Check className="h-3.5 w-3.5" /> : undefined}
          error={!validatorManagerAddress && subnetId ? 'Could not find Validator Manager for this L1.' : undefined}
        >
          {txSuccess ? 'Transaction completed' : 'Initiate validator registration'}
        </Button>
      )}

      {ownershipState === 'differentEOA' && (
        <Button
          onClick={handleInitiateValidatorRegistration}
          disabled={true}
          error="This wallet doesn't own the contract. Only the contract owner can add validators."
        >
          Initiate validator registration
        </Button>
      )}

      {ownershipState === 'loading' && (
        <Button
          onClick={handleInitiateValidatorRegistration}
          disabled={true}
          loading={true}
          loadingText="Verifying ownership…"
        >
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

export default InitiateValidatorRegistration;
