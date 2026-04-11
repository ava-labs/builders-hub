import React, { useState, useEffect } from 'react';
import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import { Button } from '@/components/toolbox/components/Button';
import { Input } from '@/components/toolbox/components/Input';
import { Success } from '@/components/toolbox/components/Success';
import { Alert } from '@/components/toolbox/components/Alert';
import { bytesToHex, hexToBytes, encodeFunctionData, Abi } from 'viem';
import { GetRegistrationJustification } from '../validator-manager/justification';
import { packL1ValidatorRegistration } from '@/components/toolbox/coreViem/utils/convertWarp';
import { packWarpIntoAccessList } from '../validator-manager/packWarp';
import { useAvalancheSDKChainkit } from '@/components/toolbox/stores/useAvalancheSDKChainkit';
import useConsoleNotifications from '@/hooks/useConsoleNotifications';
import { useValidatorManager, usePoAManager } from '@/components/toolbox/hooks/contracts';
import { fetchL1ValidatorWeightData } from '../../shared/fetchL1ValidatorWeightData';
import { useChainPublicClient } from '@/components/toolbox/hooks/useChainPublicClient';
import { useViemChainStore } from '@/components/toolbox/stores/toolboxStore';
import ValidatorManagerABI from '@/contracts/icm-contracts/compiled/ValidatorManager.json';
import { DynamicCodeBlock } from 'fumadocs-ui/components/dynamic-codeblock';
import { Check } from 'lucide-react';
import { StepFlowCard } from '@/components/toolbox/components/StepCard';
import { generateCastSendCommand } from '@/components/toolbox/utils/castCommand';

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
  const { avalancheNetworkID, isTestnet } = useWalletStore();
  const walletType = useWalletStore((s) => s.walletType);
  const isCoreWallet = walletType === 'core';
  const chainPublicClient = useChainPublicClient();
  const viemChain = useViemChainStore();
  const { aggregateSignature } = useAvalancheSDKChainkit();
  const [pChainTxId, setPChainTxId] = useState(initialPChainTxId || '');
  const { notify } = useConsoleNotifications();

  // Determine target contract and ABI based on ownerType
  const useMultisig = ownerType === 'PoAManager';
  const targetContractAddress = useMultisig ? contractOwner : validatorManagerAddress;

  const validatorManager = useValidatorManager(!useMultisig ? validatorManagerAddress : null);
  const poaManager = usePoAManager(useMultisig ? contractOwner : null);

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
  const [castAccessList, setCastAccessList] = useState<any[] | null>(null);

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
    if (!chainPublicClient) {
      setErrorState("Wallet or chain configuration is not properly initialized.");
      onError("Wallet or chain configuration is not properly initialized.");
      return;
    }

    setIsProcessing(true);
    try {
      // Step 1: Extract L1ValidatorWeightMessage from P-Chain transaction
      const weightMessageData = await fetchL1ValidatorWeightData(pChainTxId, isTestnet);

      setExtractedData({
        validationID: weightMessageData.validationID,
        nonce: weightMessageData.nonce,
        weight: weightMessageData.weight
      });

      // Step 2: Get justification for the validation (using the extracted validation ID)
      const justification = await GetRegistrationJustification(
        weightMessageData.validationID,
        subnetIdL1,
        chainPublicClient
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
        signingSubnetId,
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
      setCastAccessList(accessList);

      // Non-Core wallet: stop here and show cast command
      if (!isCoreWallet) {
        return;
      }

      // Use appropriate hook based on ownerType
      const hash = useMultisig
        ? await poaManager.completeValidatorRemoval(0, accessList)
        : await validatorManager.completeValidatorRemoval(0, accessList);

      const finalReceipt = await chainPublicClient!.waitForTransactionReceipt({ hash: hash as `0x${string}` });
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

  function generateCastCommand(): string {
    if (!pChainSignature || !castAccessList) return '';
    const rpcUrl = viemChain?.rpcUrls?.default?.http?.[0] || '<L1_RPC_URL>';
    const addr = targetContractAddress || '<CONTRACT_ADDRESS>';

    const calldata = encodeFunctionData({
      abi: ValidatorManagerABI.abi as Abi,
      functionName: 'completeValidatorRemoval',
      args: [0],
    });

    return generateCastSendCommand({ address: addr, calldata, accessList: castAccessList, rpcUrl });
  }

  // Don't render if no subnet is selected
  if (!subnetIdL1) {
    return (
      <div className="text-sm text-zinc-500 dark:text-zinc-400">
        Please select an L1 subnet first.
      </div>
    );
  }

  const step1Complete = !!pChainTxId.trim();
  const step2Complete = !!transactionHash;

  return (
    <div className="space-y-3">
      {error && (
        <Alert variant="error">{error}</Alert>
      )}

      {isLoadingOwnership && (
        <div className="text-sm text-zinc-500 dark:text-zinc-400">
          Checking contract ownership...
        </div>
      )}

      {/* Step 1: Enter P-Chain Transaction */}
      <div className={`p-3 rounded-xl border transition-colors ${
        step1Complete
          ? "bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800"
          : "bg-zinc-50 dark:bg-zinc-800/50 border-zinc-200 dark:border-zinc-700"
      }`}>
        <div className="flex items-start gap-3">
          <div className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
            step1Complete
              ? "bg-green-500 text-white"
              : "bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300"
          }`}>
            {step1Complete ? <Check className="w-3 h-3" /> : "1"}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Enter P-Chain Transaction</h3>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              Provide the P-Chain SetL1ValidatorWeightTx ID to extract validator weight data
            </p>
            <div className="mt-2">
              <Input
                label="P-Chain SetL1ValidatorWeightTx ID"
                value={pChainTxId}
                onChange={setPChainTxId}
                placeholder="Enter the P-Chain SetL1ValidatorWeightTx ID from step 3"
                disabled={isProcessing || !!transactionHash}
              />
            </div>
            {step1Complete && extractedData && (
              <div className="mt-2 space-y-1">
                <div className="flex items-center gap-1.5 text-xs text-green-700 dark:text-green-400 font-mono">
                  <span className="text-green-600 font-sans font-medium">Validation ID:</span>
                  <code className="bg-green-100 dark:bg-green-900/30 px-1.5 py-0.5 rounded text-[10px]">{extractedData.validationID}</code>
                </div>
                <div className="flex items-center gap-1.5 text-xs">
                  <span className="text-green-600 dark:text-green-400 font-medium">Weight:</span>
                  <code className="bg-green-100 dark:bg-green-900/30 px-1.5 py-0.5 rounded text-[10px] font-mono">{extractedData.weight.toString()}</code>
                </div>
                <div className="flex items-center gap-1.5 text-xs">
                  <span className="text-green-600 dark:text-green-400 font-medium">Nonce:</span>
                  <code className="bg-green-100 dark:bg-green-900/30 px-1.5 py-0.5 rounded text-[10px] font-mono">{extractedData.nonce.toString()}</code>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Step 2: Aggregate & Complete Removal */}
      <div className={`p-3 rounded-xl border transition-colors ${
        step2Complete
          ? "bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800"
          : step1Complete || isProcessing
          ? "bg-zinc-50 dark:bg-zinc-800/50 border-zinc-200 dark:border-zinc-700"
          : "bg-zinc-50/50 dark:bg-zinc-800/20 border-zinc-200/50 dark:border-zinc-800 opacity-50"
      }`}>
        <div className="flex items-start gap-3">
          <div className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
            step2Complete
              ? "bg-green-500 text-white"
              : step1Complete || isProcessing
              ? "bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300"
              : "bg-zinc-200/50 dark:bg-zinc-800 text-zinc-400"
          }`}>
            {step2Complete ? <Check className="w-3 h-3" /> : "2"}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className={`text-sm font-medium ${step1Complete || isProcessing ? "text-zinc-900 dark:text-zinc-100" : "text-zinc-400 dark:text-zinc-600"}`}>
              Aggregate & Complete Removal
            </h3>
            <p className={`mt-1 text-xs ${step1Complete || isProcessing ? "text-zinc-500 dark:text-zinc-400" : "text-zinc-400 dark:text-zinc-600"}`}>
              Aggregate BLS signatures and submit the completeValidatorRemoval transaction
            </p>

            {step2Complete ? (
              <div className="mt-2 flex items-center gap-1.5 text-green-600 dark:text-green-400">
                <Check className="w-3.5 h-3.5" />
                <span className="text-xs font-medium">Validator removal completed</span>
              </div>
            ) : pChainSignature && !isCoreWallet ? (
              <div className="mt-2 flex items-center gap-1.5 text-green-600 dark:text-green-400">
                <Check className="w-3.5 h-3.5" />
                <span className="text-xs font-medium">Signatures aggregated</span>
              </div>
            ) : !step2Complete ? (
              <div className="mt-2">
                <Button
                  onClick={handleCompleteRemoval}
                  disabled={isProcessing || !pChainTxId.trim() || !!successMessage || (isContractOwner === false && !useMultisig) || isLoadingOwnership || (!isCoreWallet && !!pChainSignature)}
                  loading={isProcessing}
                  className="w-full"
                >
                  {isLoadingOwnership ? 'Checking ownership...' : (isProcessing ? 'Processing...' : (isCoreWallet ? 'Sign & Complete Validator Removal' : 'Aggregate Signatures'))}
                </Button>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* Non-Core: CLI command panel after aggregation */}
      {!isCoreWallet && pChainSignature && !transactionHash && (
        <div className="p-3 rounded-xl border bg-zinc-50 dark:bg-zinc-800/50 border-zinc-200 dark:border-zinc-700 space-y-3">
          <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
            Signatures aggregated. Run this command to complete the validator removal:
          </p>
          <DynamicCodeBlock lang="bash" code={generateCastCommand()} />
        </div>
      )}

      {/* Success */}
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
