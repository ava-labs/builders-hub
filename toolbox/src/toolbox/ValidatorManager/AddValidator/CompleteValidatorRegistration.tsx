import React, { useState, useEffect } from 'react';
import { useWalletStore } from '../../../stores/walletStore';
import { useViemChainStore } from '../../../stores/toolboxStore';
import { useValidatorManagerDetails } from '../../hooks/useValidatorManagerDetails';
import { AvaCloudSDK } from '@avalabs/avacloud-sdk';
import { Button } from '../../../components/Button';
import { Input } from '../../../components/Input';
import { AlertCircle } from 'lucide-react';
import { Success } from '../../../components/Success';
import { networkIDs } from '@avalabs/avalanchejs';
import { extractRegisterL1ValidatorMessage } from '../../../coreViem/methods/extractRegisterL1ValidatorMessage';
import { GetRegistrationJustification } from '../justification';
import { packWarpIntoAccessList } from '../packWarp';
import { hexToBytes, bytesToHex } from 'viem';
import validatorManagerAbi from '../../../../contracts/icm-contracts/compiled/ValidatorManager.json';
import { packL1ValidatorRegistration } from '../../../coreViem/utils/convertWarp';

interface CompleteValidatorRegistrationProps {
  subnetIdL1: string;
  pChainTxId?: string;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
}

const CompleteValidatorRegistration: React.FC<CompleteValidatorRegistrationProps> = ({
  subnetIdL1,
  pChainTxId,
  onSuccess,
  onError,
}) => {
  const { coreWalletClient, publicClient, avalancheNetworkID } = useWalletStore();
  const viemChain = useViemChainStore();
  const [pChainTxIdState, setPChainTxId] = useState(pChainTxId || '');
  const { validatorManagerAddress, signingSubnetId } = useValidatorManagerDetails({ subnetId: subnetIdL1 });

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

  const networkName = avalancheNetworkID === networkIDs.MainnetID ? 'mainnet' : 'fuji';

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
    if (!coreWalletClient || !publicClient || !viemChain) {
      setErrorState("Wallet or chain configuration is not properly initialized.");
      onError("Wallet or chain configuration is not properly initialized.");
      return;
    }

    setIsProcessing(true);
    try {
      // Step 1: Extract RegisterL1ValidatorMessage from P-Chain transaction
      const registrationMessageData = await extractRegisterL1ValidatorMessage(coreWalletClient, {
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
      const validationId = await publicClient.readContract({
        address: validatorManagerAddress as `0x${string}`,
        abi: validatorManagerAbi.abi,
        functionName: "registeredValidators",
        args: [registrationMessageData.nodeID],
      }) as `0x${string}`;

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
      const signature = await new AvaCloudSDK().data.signatureAggregator.aggregateSignatures({
        network: networkName,
        signatureAggregatorRequest: {
          message: bytesToHex(l1ValidatorRegistrationMessage),
          justification: bytesToHex(justification),
          signingSubnetId: signingSubnetId || subnetIdL1,
          quorumPercentage: 67,
        },
      });

      setPChainSignature(signature.signedMessage);

      // Step 6: Complete the validator registration on EVM
      const signedPChainWarpMsgBytes = hexToBytes(`0x${signature.signedMessage}`);
      const accessList = packWarpIntoAccessList(signedPChainWarpMsgBytes);

      const hash = await coreWalletClient.writeContract({
        address: validatorManagerAddress as `0x${string}`,
        abi: validatorManagerAbi.abi,
        functionName: "completeValidatorRegistration",
        args: [0], // messageIndex
        accessList,
        account: coreWalletClient.account,
        chain: viemChain
      });

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
        label="P-Chain Transaction ID"
        value={pChainTxIdState}
        onChange={setPChainTxId}
        placeholder="Enter the P-Chain transaction ID from step 2"
        disabled={isProcessing}
      />
      
      <div className="text-sm text-zinc-600 dark:text-zinc-400">
        {extractedData && (
          <div className="mt-2 space-y-1">
            <p><strong>Subnet ID:</strong> {extractedData.subnetID}</p>
            <p><strong>Node ID:</strong> {extractedData.nodeID}</p>
            <p><strong>BLS Public Key:</strong> {extractedData.blsPublicKey.substring(0,50)}...</p>
            <p><strong>Expiry:</strong> {extractedData.expiry.toString()}</p>
            <p><strong>Weight:</strong> {extractedData.weight.toString()}</p>
            {extractedData.validationId && (
              <p><strong>Validation ID:</strong> {extractedData.validationId}</p>
            )}
          </div>
        )}
        {pChainSignature && (
          <p className="mt-2"><strong>P-Chain Signature:</strong> {pChainSignature.substring(0,50)}...</p>
        )}
      </div>
      
      <Button 
        onClick={handleCompleteRegisterValidator} 
        disabled={isProcessing || !pChainTxIdState.trim() || !!successMessage}
      >
        {isProcessing ? 'Processing...' : 'Sign & Complete Validator Registration'}
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
