import React, { useState, useEffect } from 'react';
import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import { useViemChainStore } from '@/components/toolbox/stores/toolboxStore';
import { Button } from '@/components/toolbox/components/Button';
import { Input } from '@/components/toolbox/components/Input';
import { AlertCircle } from 'lucide-react';
import { Success } from '@/components/toolbox/components/Success';
import { bytesToHex, hexToBytes } from 'viem';
import validatorManagerAbi from '@/contracts/icm-contracts/compiled/ValidatorManager.json';
import poaManagerAbi from '@/contracts/icm-contracts/compiled/PoAManager.json';
import { GetRegistrationJustification } from '../ValidatorManager/justification';
import { packL1ValidatorRegistration } from '@/components/toolbox/coreViem/utils/convertWarp';
import { packWarpIntoAccessList } from '../ValidatorManager/packWarp';
import { useAvaCloudSDK } from '@/components/toolbox/stores/useAvaCloudSDK';
import useConsoleNotifications from '@/hooks/useConsoleNotifications';

interface CompleteValidatorRemovalProps {
  subnetIdL1: string;
  validationId: string;
  pChainTxId: string;
  eventData: {
    validationID: `0x${string}`;
    nonce: bigint;
    weight: bigint;
    messageID: `0x${string}`;
  } | null;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
  isContractOwner: boolean | null;
  validatorManagerAddress: string;
  signingSubnetId: string;
  contractOwner: string | null;
  isLoadingOwnership: boolean;
  ownerType: 'PoAManager' | 'StakingManager' | 'EOA' | null;
}

const CompleteValidatorRemoval: React.FC<CompleteValidatorRemovalProps> = ({
  subnetIdL1,
  pChainTxId: initialPChainTxId,
  onSuccess,
  onError,
  isContractOwner,
  validatorManagerAddress,
  signingSubnetId,
  contractOwner,
  isLoadingOwnership,
  ownerType,
}) => {
  const { coreWalletClient, publicClient, avalancheNetworkID, walletEVMAddress } = useWalletStore();
  const { aggregateSignature } = useAvaCloudSDK();
  const viemChain = useViemChainStore();
  const [pChainTxId, setPChainTxId] = useState(initialPChainTxId || '');
  const { notify } = useConsoleNotifications();
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setErrorState] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [transactionHash, setTransactionHash] = useState<string | null>(null);
  const [pChainSignature, setPChainSignature] = useState<string | null>(null);
  const [extractedData, setExtractedData] = useState<{
    validationID: string;
    nonce: bigint;
    weight: bigint;
  } | null>(null);

  // Determine target contract and ABI based on ownerType
  const useMultisig = ownerType === 'PoAManager';
  const targetContractAddress = useMultisig ? contractOwner : validatorManagerAddress;
  const targetAbi = useMultisig ? poaManagerAbi.abi : validatorManagerAbi.abi;

  // Update pChainTxId when the prop changes
  useEffect(() => {
    if (initialPChainTxId && initialPChainTxId !== pChainTxId) {
      setPChainTxId(initialPChainTxId);
    }
  }, [initialPChainTxId]);

  const handleCompleteRemoval = async () => {
    setErrorState(null);
    setSuccessMessage(null);

    if (!pChainTxId.trim()) {
      setErrorState("P-Chain transaction ID is required.");
      onError("P-Chain transaction ID is required.");
      return;
    }
    if (!subnetIdL1) {
      setErrorState("L1 Subnet ID is required. Please select a subnet first.");
      onError("L1 Subnet ID is required. Please select a subnet first.");
      return;
    }
    if (!validatorManagerAddress) {
      setErrorState("Validator Manager address is not set. Check L1 Subnet selection.");
      onError("Validator Manager address is not set. Check L1 Subnet selection.");
      return;
    }
    if (isContractOwner === false && !useMultisig) {
      setErrorState("You are not the contract owner. Please contact the contract owner.");
      onError("You are not the contract owner. Please contact the contract owner.");
      return;
    }
    if (useMultisig && !contractOwner?.trim()) {
      setErrorState("PoAManager address could not be fetched. Please ensure the ValidatorManager is owned by a PoAManager.");
      onError("PoAManager address could not be fetched. Please ensure the ValidatorManager is owned by a PoAManager.");
      return;
    }
    if (!coreWalletClient || !publicClient || !viemChain) {
      setErrorState("Wallet or chain configuration is not properly initialized.");
      onError("Wallet or chain configuration is not properly initialized.");
      return;
    }

    setIsProcessing(true);
    try {
      // Step 1: Extract L1ValidatorWeightMessage from P-Chain transaction
      const weightMessageData = await coreWalletClient.extractL1ValidatorWeightMessage({
        txId: pChainTxId
      });

      setExtractedData({
        validationID: weightMessageData.validationID,
        nonce: weightMessageData.nonce,
        weight: weightMessageData.weight
      });

      // Step 2: Get justification for the validation (using the extracted validation ID)
      const justification = await GetRegistrationJustification(
        weightMessageData.validationID,
        subnetIdL1,
        publicClient
      );

      if (!justification) {
        throw new Error("No justification logs found for this validation ID");
      }

      // Step 3: Create P-Chain warp signature for validator removal
      const validationIDBytes = hexToBytes(weightMessageData.validationID as `0x${string}`);
      const removeValidatorMessage = packL1ValidatorRegistration(
        validationIDBytes,
        false, // false for removal
        avalancheNetworkID,
        "11111111111111111111111111111111LpoYY" // always use P-Chain ID
      );

      const aggregateSignaturePromise = aggregateSignature({
        message: bytesToHex(removeValidatorMessage),
        justification: bytesToHex(justification),
        signingSubnetId: signingSubnetId || subnetIdL1,
        quorumPercentage: 67,
      });
      notify({
        type: 'local',
        name: 'Aggregate Signatures'
      }, aggregateSignaturePromise);
      const signature = await aggregateSignaturePromise;

      setPChainSignature(signature.signedMessage);

      // Step 4: Complete the validator removal on EVM
      const signedPChainWarpMsgBytes = hexToBytes(`0x${signature.signedMessage}`);
      const accessList = packWarpIntoAccessList(signedPChainWarpMsgBytes);

      const writePromise = coreWalletClient.writeContract({
        address: targetContractAddress as `0x${string}`,
        abi: targetAbi,
        functionName: "completeValidatorRemoval",
        args: [0], // As per original, arg is 0
        accessList,
        account: walletEVMAddress as `0x${string}`,
        chain: viemChain,
      });
      notify({
        type: 'call',
        name: 'Complete Validator Removal'
      }, writePromise, viemChain ?? undefined);

      const hash = await writePromise;
      const finalReceipt = await publicClient.waitForTransactionReceipt({ hash });
      if (finalReceipt.status !== 'success') {
        throw new Error(`Transaction failed with status: ${finalReceipt.status}`);
      }

      setTransactionHash(hash);
      const successMsg = `Validator removal completed successfully.`;
      setSuccessMessage(successMsg);
      onSuccess(successMsg);
    } catch (err: any) {
      const message = err instanceof Error ? err.message : String(err);
      setErrorState(`Failed to complete validator removal: ${message}`);
      onError(`Failed to complete validator removal: ${message}`);
    } finally {
      setIsProcessing(false);
    }
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
      {error && (
        <div className="p-3 rounded-md bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm">
          <div className="flex items-center">
            <AlertCircle className="h-4 w-4 text-red-500 mr-2 flex-shrink-0" />
            <span>{error}</span>
          </div>
        </div>
      )}

      <Input
        label="P-Chain SetL1ValidatorWeightTx ID"
        value={pChainTxId}
        onChange={setPChainTxId}
        placeholder="Enter the P-Chain SetL1ValidatorWeightTx ID from step 3"
        disabled={isProcessing}
      />

      {isLoadingOwnership && (
        <div className="text-sm text-zinc-500 dark:text-zinc-400">
          Checking contract ownership...
        </div>
      )}

      <Button
        onClick={handleCompleteRemoval}
        disabled={isProcessing || !pChainTxId.trim() || !!successMessage || (isContractOwner === false && !useMultisig) || isLoadingOwnership}
      >
        {isLoadingOwnership ? 'Checking ownership...' : (isProcessing ? 'Processing...' : 'Sign & Complete Validator Removal')}
      </Button>

      {transactionHash && (
        <Success
          label="Transaction Hash"
          value={transactionHash}
        />
      )}
    </div>
  );
};

export default CompleteValidatorRemoval;
