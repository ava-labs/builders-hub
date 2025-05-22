import React, { useState } from 'react';
import { useWalletStore } from '../../stores/walletStore';
import { useViemChainStore } from '../../stores/toolboxStore';
import { useValidatorManagerDetails } from '../hooks/useValidatorManagerDetails';
import { GetRegistrationJustification } from './justification';
import { packL1ValidatorWeightMessage } from '../../coreViem/utils/convertWarp';
import { packWarpIntoAccessList } from './packWarp';
import { extractL1ValidatorWeightMessage } from '../../coreViem/methods/extractL1ValidatorWeightMessage';
import { AvaCloudSDK } from '@avalabs/avacloud-sdk';
import { hexToBytes, bytesToHex } from 'viem';
import { networkIDs } from '@avalabs/avalanchejs';
import validatorManagerAbi from '../../../contracts/icm-contracts/compiled/ValidatorManager.json';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { AlertCircle } from 'lucide-react';
import { Success } from '../../components/Success';

interface CompleteChangeWeightProps {
  subnetIdL1: string;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
}

const CompleteChangeWeight: React.FC<CompleteChangeWeightProps> = ({
  subnetIdL1,
  onSuccess,
  onError,
}) => {
  const { coreWalletClient, publicClient, avalancheNetworkID } = useWalletStore();
  const viemChain = useViemChainStore();
  const [pChainTxId, setPChainTxId] = useState('');
  const { validatorManagerAddress, signingSubnetId } = useValidatorManagerDetails({ subnetId: subnetIdL1 });

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

  const networkName = avalancheNetworkID === networkIDs.MainnetID ? 'mainnet' : 'fuji';

  const handleCompleteChangeWeight = async () => {
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
    if (!coreWalletClient || !publicClient || !viemChain) {
      setErrorState("Wallet or chain configuration is not properly initialized.");
      onError("Wallet or chain configuration is not properly initialized.");
      return;
    }

    setIsProcessing(true);
    try {
      // Step 1: Extract L1ValidatorWeightMessage from P-Chain transaction
      const weightMessageData = await extractL1ValidatorWeightMessage(coreWalletClient, {
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

      // Step 3: Create P-Chain warp signature using the extracted weight message data
      const warpValidationID = hexToBytes(weightMessageData.validationID as `0x${string}`);
      const warpNonce = weightMessageData.nonce;
      const warpWeight = weightMessageData.weight;

      const changeWeightMessage = packL1ValidatorWeightMessage(
        {
          validationID: warpValidationID,
          nonce: warpNonce,
          weight: warpWeight,
        },
        avalancheNetworkID,
        "11111111111111111111111111111111LpoYY" // always use P-Chain ID
      );

      const signature = await new AvaCloudSDK().data.signatureAggregator.aggregateSignatures({
        network: networkName,
        signatureAggregatorRequest: {
          message: bytesToHex(changeWeightMessage),
          justification: bytesToHex(justification),
          signingSubnetId: signingSubnetId || subnetIdL1,
          quorumPercentage: 67,
        },
      });

      setPChainSignature(signature.signedMessage);

      // Step 4: Complete the weight change on EVM
      const signedPChainWarpMsgBytes = hexToBytes(`0x${signature.signedMessage}`);
      const accessList = packWarpIntoAccessList(signedPChainWarpMsgBytes);

      const hash = await coreWalletClient.writeContract({
        address: validatorManagerAddress as `0x${string}`,
        abi: validatorManagerAbi.abi,
        functionName: "completeValidatorWeightUpdate",
        args: [0], // As per original, arg is 0
        accessList,
        account: coreWalletClient.account,
        chain: viemChain,
      });

      const finalReceipt = await publicClient.waitForTransactionReceipt({ hash });
      if (finalReceipt.status !== 'success') {
        throw new Error(`Transaction failed with status: ${finalReceipt.status}`);
      }
      
      setTransactionHash(hash);
      const successMsg = `Validator weight changed to ${weightMessageData.weight.toString()}.`;
      setSuccessMessage(successMsg);
      onSuccess(successMsg);
    } catch (err: any) {
      const message = err instanceof Error ? err.message : String(err);
      setErrorState(`Failed to complete weight change: ${message}`);
      onError(`Failed to complete weight change: ${message}`);
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
        value={pChainTxId}
        onChange={setPChainTxId}
        placeholder="Enter the P-Chain transaction ID from step 2"
        disabled={isProcessing}
      />
      <div className="text-sm text-zinc-600 dark:text-zinc-400">
        {extractedData && (
          <div className="mt-2 space-y-1">
            <p><strong>P-Chain Validation ID:</strong> {extractedData.validationID}</p>
            <p><strong>Nonce:</strong> {extractedData.nonce.toString()}</p>
            <p><strong>New Weight:</strong> {extractedData.weight.toString()}</p>
          </div>
        )}
        {pChainSignature && (
          <p className="mt-2"><strong>P-Chain Signature:</strong> {pChainSignature.substring(0,50)}...</p>
        )}
      </div>
      <Button 
        onClick={handleCompleteChangeWeight} 
        disabled={isProcessing || !pChainTxId.trim() || !!successMessage}
      >
        {isProcessing ? 'Processing...' : 'Sign & Complete Weight Change'}
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

export default CompleteChangeWeight; 