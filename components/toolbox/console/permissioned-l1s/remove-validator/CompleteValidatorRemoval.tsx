import React, { useState, useEffect } from 'react';
import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import { getPChainRpcUrl } from '@/components/toolbox/utils/avalancheEndpoints';
import { Button } from '@/components/toolbox/components/Button';
import { Input } from '@/components/toolbox/components/Input';
import { Alert } from '@/components/toolbox/components/Alert';
import { bytesToHex, hexToBytes, encodeFunctionData, Abi } from 'viem';
import {
  getRegistrationJustification,
  newL1ValidatorRegistrationMessage,
  newWarpMessage,
  packWarpIntoAccessList,
} from '@avalanche-sdk/interchain/warp';
import { hexToCB58 } from '@avalanche-sdk/client/utils';
import { useAvalancheSDKChainkit } from '@/components/toolbox/stores/useAvalancheSDKChainkit';
import useConsoleNotifications from '@/hooks/useConsoleNotifications';
import { useValidatorManager, usePoAManager } from '@/components/toolbox/hooks/contracts';
import { extractL1ValidatorWeightMessageFromPChainTx } from '@avalanche-sdk/interchain/validator-manager';
import { useChainPublicClient } from '@/components/toolbox/hooks/useChainPublicClient';
import { useViemChainStore } from '@/components/toolbox/stores/toolboxStore';
import ValidatorManagerABI from '@/contracts/icm-contracts/compiled/ValidatorManager.json';
import { Check, Loader2 } from 'lucide-react';
import { HashChip } from '@/components/explorer-v2/ui';
import { Steps, Step } from '@/components/toolbox/components/Steps';
import { Field, Status } from '@/components/toolbox/console/shared/validator-flow-ui';
import { generateCastSendCommand } from '@/components/toolbox/utils/castCommand';
import { CliAlternative } from '@/components/console/cli-alternative';
import { ProposerVMPreflightCard } from '@/components/toolbox/console/shared/ProposerVMPreflightCard';
import {
  AggregationRemediation,
  parseAggregationError,
  type RemediationLink,
} from '@/components/toolbox/hooks/contracts/parseAggregationError';

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
  const [aggRemediation, setAggRemediation] = useState<RemediationLink[] | null>(null);
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
      setErrorState('P-Chain transaction ID is required.');
      onError('P-Chain transaction ID is required.');
      return;
    }
    if (!subnetIdL1) {
      setErrorState('L1 Subnet ID is required. Please select a subnet first.');
      onError('L1 Subnet ID is required. Please select a subnet first.');
      return;
    }
    if (!validatorManagerAddress) {
      setErrorState('Validator Manager address is not set. Check L1 Subnet selection.');
      onError('Validator Manager address is not set. Check L1 Subnet selection.');
      return;
    }
    if (isContractOwner === false && !useMultisig) {
      setErrorState('You are not the contract owner. Please contact the contract owner.');
      onError('You are not the contract owner. Please contact the contract owner.');
      return;
    }
    if (useMultisig && !contractOwner?.trim()) {
      setErrorState(
        'PoAManager address could not be fetched. Please ensure the ValidatorManager is owned by a PoAManager.',
      );
      onError('PoAManager address could not be fetched. Please ensure the ValidatorManager is owned by a PoAManager.');
      return;
    }
    if (!chainPublicClient) {
      setErrorState('Wallet or chain configuration is not properly initialized.');
      onError('Wallet or chain configuration is not properly initialized.');
      return;
    }

    setIsProcessing(true);
    try {
      // Step 1: Extract L1ValidatorWeightMessage from P-Chain transaction
      const weightMessageData = await extractL1ValidatorWeightMessageFromPChainTx({
        txId: pChainTxId,
        pChainRpcUrl: getPChainRpcUrl(isTestnet),
      });

      setExtractedData({
        validationID: weightMessageData.validationIdHex,
        nonce: weightMessageData.nonce,
        weight: weightMessageData.weight,
      });

      // Step 2: Get justification for the validation (using the extracted validation ID)
      const justification = await getRegistrationJustification(
        weightMessageData.validationIdHex,
        subnetIdL1,
        chainPublicClient,
      );

      if (!justification) {
        throw new Error('No justification logs found for this validation ID');
      }

      // Step 3: Create P-Chain warp signature for validator removal
      const innerRemovalMsg = newL1ValidatorRegistrationMessage(
        hexToCB58(weightMessageData.validationIdHex as `0x${string}`),
        false, // false for removal
      );
      const unsignedRemovalMsg = newWarpMessage(
        avalancheNetworkID,
        '11111111111111111111111111111111LpoYY', // always use P-Chain ID
        '',
        innerRemovalMsg.toHex(),
      );
      const removeValidatorMessage = hexToBytes(unsignedRemovalMsg.toHex() as `0x${string}`);

      const aggregateSignaturePromise = aggregateSignature({
        message: bytesToHex(removeValidatorMessage),
        justification: bytesToHex(justification),
        signingSubnetId,
      });
      notify(
        {
          type: 'local',
          name: 'Aggregate Signatures',
        },
        aggregateSignaturePromise,
      );
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
      const mapped = parseAggregationError(err);
      setAggRemediation(mapped?.remediation ?? null);
      const display = mapped?.message ?? `Failed to complete validator removal: ${message}`;
      setErrorState(display);
      onError(display);
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
    return <p className="text-[13px] text-zinc-500 dark:text-zinc-400">Select an L1 subnet first.</p>;
  }

  const step1Complete = !!pChainTxId.trim();
  const step2Complete = !!transactionHash;

  return (
    <div className="flex flex-col gap-5">
      <ProposerVMPreflightCard requiredTxId={pChainTxId.trim() || null} />
      {error && (
        <Alert variant="error">
          <div>
            {error}
            {aggRemediation && <AggregationRemediation items={aggRemediation} />}
          </div>
        </Alert>
      )}

      {isLoadingOwnership && (
        <p
          role="status"
          className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400"
        >
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Checking contract ownership
        </p>
      )}

      <Steps>
        <Step>
          <div>
            <h3 className="flex items-center justify-between gap-3">
              Enter the P-Chain transaction
              {step1Complete && <Status tone="ok">Entered</Status>}
            </h3>
            <p>The validator&apos;s weight data is read from this SetL1ValidatorWeightTx.</p>
          </div>
          <Input
            label="P-Chain SetL1ValidatorWeightTx ID"
            value={pChainTxId}
            onChange={setPChainTxId}
            placeholder="SetL1ValidatorWeightTx ID from the previous step"
            disabled={isProcessing || !!transactionHash}
          />
          {step1Complete && extractedData && (
            <div className="flex flex-col gap-3">
              <Field label="Validation ID">
                <HashChip value={extractedData.validationID} len={18} />
              </Field>
              <Field label="Weight">
                <span className="font-mono tabular-nums">{extractedData.weight.toString()}</span>
              </Field>
              <Field label="Nonce">
                <span className="font-mono tabular-nums">{extractedData.nonce.toString()}</span>
              </Field>
            </div>
          )}
        </Step>

        <Step>
          <div>
            <h3 className="flex items-center justify-between gap-3">
              Aggregate and complete removal
              {step2Complete ? (
                <Status tone="ok">Completed</Status>
              ) : pChainSignature ? (
                <Status tone="ok">Aggregated</Status>
              ) : null}
            </h3>
            <p>
              Aggregates BLS signatures and submits the{' '}
              <code className="font-mono text-[12px] text-zinc-900 dark:text-zinc-100">completeValidatorRemoval</code>{' '}
              transaction.
            </p>
          </div>

          {step2Complete ? (
            <p className="flex items-center gap-1.5 text-[13px] text-emerald-700 dark:text-emerald-400">
              <Check className="h-3.5 w-3.5" />
              Validator removal completed
            </p>
          ) : pChainSignature && !isCoreWallet ? (
            <p className="flex items-center gap-1.5 text-[13px] text-emerald-700 dark:text-emerald-400">
              <Check className="h-3.5 w-3.5" />
              Signatures aggregated
            </p>
          ) : !step2Complete ? (
            <div>
              <Button
                onClick={handleCompleteRemoval}
                disabled={
                  isProcessing ||
                  !pChainTxId.trim() ||
                  !!successMessage ||
                  (isContractOwner === false && !useMultisig) ||
                  isLoadingOwnership ||
                  (!isCoreWallet && !!pChainSignature)
                }
                loading={isProcessing}
                loadingText={isCoreWallet ? 'Completing…' : 'Aggregating…'}
                className="w-full"
              >
                {isLoadingOwnership
                  ? 'Checking ownership…'
                  : isCoreWallet
                    ? 'Sign and complete validator removal'
                    : 'Aggregate signatures'}
              </Button>
            </div>
          ) : null}

          {/* Non-Core: CLI command panel after aggregation */}
          {!isCoreWallet && pChainSignature && !transactionHash && <CliAlternative command={generateCastCommand()} />}
        </Step>
      </Steps>
    </div>
  );
};

export default CompleteValidatorRemoval;
