import React, { useState, useEffect } from 'react';
import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import { useViemChainStore } from '@/components/toolbox/stores/toolboxStore';
import { Button } from '@/components/toolbox/components/Button';
import { Input } from '@/components/toolbox/components/Input';
import { AlertCircle } from 'lucide-react';
import { Success } from '@/components/toolbox/components/Success';
import { GetRegistrationJustification } from '@/components/toolbox/console/permissioned-l1s/ValidatorManager/justification';
import { packWarpIntoAccessList } from '@/components/toolbox/console/permissioned-l1s/ValidatorManager/packWarp';
import { hexToBytes, bytesToHex } from 'viem';
import validatorManagerAbi from '@/contracts/icm-contracts/compiled/ValidatorManager.json';
import poaManagerAbi from '@/contracts/icm-contracts/compiled/PoAManager.json';
import { packL1ValidatorRegistration } from '@/components/toolbox/coreViem/utils/convertWarp';
import { getValidationIdHex } from '@/components/toolbox/coreViem/hooks/getValidationID';
import { useAvaCloudSDK } from '@/components/toolbox/stores/useAvaCloudSDK';
import useConsoleNotifications from '@/hooks/useConsoleNotifications';

interface CompleteValidatorRegistrationProps {
  subnetIdL1: string;
  pChainTxId?: string;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
  ownershipState: 'contract' | 'currentWallet' | 'differentEOA' | 'loading';
  validatorManagerAddress: string;
  signingSubnetId: string;
  contractOwner: string | null;
  isLoadingOwnership: boolean;
  ownerType: 'PoAManager' | 'StakingManager' | 'EOA' | null;
}

const CompleteValidatorRegistration: React.FC<CompleteValidatorRegistrationProps> = ({
  subnetIdL1,
  pChainTxId,
  onSuccess,
  onError,
  ownershipState,
  validatorManagerAddress,
  signingSubnetId,
  contractOwner,
  isLoadingOwnership,
  ownerType,
}) => {
  const { coreWalletClient, publicClient, avalancheNetworkID } = useWalletStore();
  const { aggregateSignature } = useAvaCloudSDK();
  const { notify } = useConsoleNotifications();
  const viemChain = useViemChainStore();
  const [pChainTxIdState, setPChainTxId] = useState(pChainTxId || '');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setErrorState] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [transactionHash, setTransactionHash] = useState<string | null>(null);
  const [pChainSignature, setPChainSignature] = useState<string | null>(null);
  const [extractedData, setExtractedData] = useState<{
    subnetID: string;
    nodeID: string;
    blsPublicKey: string;
    expiry: bigint;
    weight: bigint;
    validationId?: string;
  } | null>(null);

  // Determine target contract and ABI based on ownerType
  const useMultisig = ownerType === 'PoAManager';
  const targetContractAddress = useMultisig ? contractOwner : validatorManagerAddress;
  const targetAbi = useMultisig ? poaManagerAbi.abi : validatorManagerAbi.abi;

  // Initialize state with prop value when it becomes available
  useEffect(() => {
    if (pChainTxId && !pChainTxIdState) {
      setPChainTxId(pChainTxId);
    }
  }, [pChainTxId, pChainTxIdState]);

  const handleCompleteRegisterValidator = async () => {
    setErrorState(null);
    setSuccessMessage(null);

    if (!pChainTxIdState.trim()) {
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
    if (ownershipState === 'differentEOA' && !useMultisig) {
      setErrorState("You are not the contract owner. Please contact the contract owner.");
      onError("You are not the contract owner. Please contact the contract owner.");
      return;
    }
    if (useMultisig && !contractOwner?.trim()) {
      setErrorState("PoAManager address could not be fetched. Please ensure the ValidatorManager is owned by a PoAManager.");
      onError("PoAManager address could not be fetched. Please ensure the ValidatorManager is owned by a PoAManager.");
      return;
    }
    if (!coreWalletClient || !publicClient || !viemChain || !coreWalletClient.account) {
      setErrorState("Wallet or chain configuration is not properly initialized.");
      onError("Wallet or chain configuration is not properly initialized.");
      return;
    }

    setIsProcessing(true);
    try {
      // Step 1: Extract RegisterL1ValidatorMessage from P-Chain transaction
      const registrationMessageData = await coreWalletClient.extractRegisterL1ValidatorMessage({
        txId: pChainTxIdState
      });

      setExtractedData({
        subnetID: registrationMessageData.subnetID,
        nodeID: registrationMessageData.nodeID,
        blsPublicKey: registrationMessageData.blsPublicKey,
        expiry: registrationMessageData.expiry,
        weight: registrationMessageData.weight
      });

      // Step 2: Get validation ID from contract using nodeID
      const validationId = await getValidationIdHex(
        publicClient,
        validatorManagerAddress as `0x${string}`,
        registrationMessageData.nodeID
      );

      // Check if validation ID exists (not zero)
      if (validationId === "0x0000000000000000000000000000000000000000000000000000000000000000") {
        throw new Error("No validation ID found for this node. The validator may not be registered yet.");
      }

      // Update extracted data with validation ID
      setExtractedData(prev => prev ? { ...prev, validationId } : null);

      // Step 3: Create L1ValidatorRegistrationMessage (P-Chain response)
      // This message indicates that the validator has been registered on P-Chain
      const validationIDBytes = hexToBytes(validationId);

      const l1ValidatorRegistrationMessage = packL1ValidatorRegistration(
        validationIDBytes,
        true, // true indicates successful registration
        avalancheNetworkID,
        "11111111111111111111111111111111LpoYY" // always use P-Chain ID
      );

      // Step 4: Get justification for the validation
      // For validator registration, we need to find the original registration message
      const justification = await GetRegistrationJustification(
        validationId, // Use the actual validation ID instead of converting nodeID
        subnetIdL1,
        publicClient
      );

      if (!justification) {
        throw new Error("No justification logs found for this validation ID");
      }

      // Step 5: Create P-Chain warp signature using the L1ValidatorRegistrationMessage
      const aggregateSignaturePromise = aggregateSignature({
        message: bytesToHex(l1ValidatorRegistrationMessage),
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

      // Step 6: Complete the validator registration on EVM
      const signedPChainWarpMsgBytes = hexToBytes(`0x${signature.signedMessage}`);
      const accessList = packWarpIntoAccessList(signedPChainWarpMsgBytes);

      const writePromise = coreWalletClient.writeContract({
        address: targetContractAddress as `0x${string}`,
        abi: targetAbi,
        functionName: "completeValidatorRegistration",
        args: [0], // messageIndex
        accessList,
        account: coreWalletClient.account,
        chain: viemChain
      });
      notify({
        type: 'call',
        name: 'Complete Validator Registration'
      }, writePromise, viemChain ?? undefined);

      const hash = await writePromise;
      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      if (receipt.status === 'success') {
        setTransactionHash(hash);
        setSuccessMessage("Validator registration completed successfully!");
        onSuccess("Validator registration completed successfully!");
      } else {
        throw new Error(`Transaction failed with status: ${receipt.status}`);
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

      setErrorState(`Failed to complete validator registration: ${message}`);
      onError(`Failed to complete validator registration: ${message}`);
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
        label="P-Chain RegisterL1ValidatorTx ID"
        value={pChainTxIdState}
        onChange={setPChainTxId}
        placeholder="Enter the P-Chain RegisterL1ValidatorTx ID from step 5"
        disabled={isProcessing}
      />

      {isLoadingOwnership && (
        <div className="text-sm text-zinc-500 dark:text-zinc-400">
          Checking contract ownership...
        </div>
      )}

      <Button
        onClick={handleCompleteRegisterValidator}
        disabled={isProcessing || !pChainTxIdState.trim() || !!successMessage || (ownershipState === 'differentEOA' && !useMultisig) || isLoadingOwnership}
      >
        {isLoadingOwnership ? 'Checking ownership...' : (isProcessing ? 'Processing...' : 'Sign & Complete Validator Registration')}
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

export default CompleteValidatorRegistration;
