'use client';

import React, { useState } from 'react';
import { Check } from 'lucide-react';
import { hexToBytes, bytesToHex, encodeFunctionData, Abi } from 'viem';
import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import { useChainPublicClient } from '@/components/toolbox/hooks/useChainPublicClient';
import { useViemChainStore } from '@/components/toolbox/stores/toolboxStore';
import { useAvalancheSDKChainkit } from '@/components/toolbox/stores/useAvalancheSDKChainkit';
import { useResolvedWalletClient } from '@/components/toolbox/hooks/useResolvedWalletClient';
import { useNativeTokenStakingManager, useERC20TokenStakingManager } from '@/components/toolbox/hooks/contracts';
import useConsoleNotifications from '@/hooks/useConsoleNotifications';
import { Button } from '@/components/toolbox/components/Button';
import { Input } from '@/components/toolbox/components/Input';
import { Alert } from '@/components/toolbox/components/Alert';
import { CoreWalletTransactionButton } from '@/components/toolbox/components/CoreWalletTransactionButton';
import { StepFlowCard } from '@/components/toolbox/components/StepCard';
import { CliAlternative } from '@/components/console/cli-alternative';
import { packL1ValidatorRegistration } from '@/components/toolbox/coreViem/utils/convertWarp';
import { GetRegistrationJustification } from '@/components/toolbox/console/permissioned-l1s/validator-manager/justification';
import { packWarpIntoAccessList } from '@/components/toolbox/console/permissioned-l1s/validator-manager/packWarp';
import { generateCastSendCommand } from '@/components/toolbox/utils/castCommand';
import NativeTokenStakingManager from '@/contracts/icm-contracts/compiled/NativeTokenStakingManager.json';
import ERC20TokenStakingManager from '@/contracts/icm-contracts/compiled/ERC20TokenStakingManager.json';

type TokenType = 'native' | 'erc20';

// StakingManager.completeValidatorRemoval expects exactly one warp at index 0.
const WARP_MESSAGE_INDEX = 0;

interface CompleteValidatorRemovalProps {
  validationID?: string;
  stakingManagerAddress: string;
  tokenType: TokenType;
  subnetIdL1: string;
  signingSubnetId?: string;
  pChainTxId?: string;
  onSuccess: (data: { txHash: string; message: string }) => void;
  onError: (message: string) => void;
}

/**
 * PoS Complete Validator Removal.
 *
 * The on-chain mechanics here mirror PoA's CompleteValidatorRemoval one-to-one,
 * and they MUST. The previous implementation used L1ValidatorWeightMessage,
 * which is the wrong primitive: once P-Chain finalizes a SetL1ValidatorWeightTx
 * with weight=0, the validator is removed from P-Chain's active set entirely
 * (s.state.GetL1Validator returns ErrNotFound). P-Chain validators then refuse
 * to sign L1ValidatorWeight messages about non-existent validators — see
 * avalanchego vms/platformvm/network/warp.go:332-340, which literally tells you
 * to use L1ValidatorRegistration(registered=false) instead. The aggregator just
 * hangs forever on signature collection.
 *
 * Correct flow (same as PoA, same as ICM-contracts' StakingManager expects per
 * `unpackL1ValidatorRegistrationMessage` in completeValidatorRemoval):
 *   1. Fetch the registration justification preimage from the L1's logs
 *      (GetRegistrationJustification walks the WarpMessenger event history)
 *   2. Pack L1ValidatorRegistration(validationID, registered=false) with
 *      sourceChainID = P-Chain (zero ID)
 *   3. Aggregate signatures against the L1's signing subnet
 *   4. Submit to StakingManager.completeValidatorRemoval with the signed warp
 */
const CompleteValidatorRemoval: React.FC<CompleteValidatorRemovalProps> = ({
  validationID,
  stakingManagerAddress,
  tokenType,
  subnetIdL1,
  signingSubnetId,
  pChainTxId: initialPChainTxId,
  onSuccess,
  onError,
}) => {
  const { avalancheNetworkID } = useWalletStore();
  const chainPublicClient = useChainPublicClient();
  const walletClient = useResolvedWalletClient();
  const viemChain = useViemChainStore();
  const { aggregateSignature } = useAvalancheSDKChainkit();
  const { notify } = useConsoleNotifications();

  const nativeStakingManager = useNativeTokenStakingManager(tokenType === 'native' ? stakingManagerAddress : null);
  const erc20StakingManager = useERC20TokenStakingManager(tokenType === 'erc20' ? stakingManagerAddress : null);

  const [pChainTxId, setPChainTxId] = useState<string>(initialPChainTxId || '');

  const [signedWarpMessage, setSignedWarpMessage] = useState<string | null>(null);
  const [isAggregating, setIsAggregating] = useState(false);

  const [txHash, setTxHash] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [error, setLocalError] = useState<string | null>(null);

  // We don't need to parse the P-Chain tx — the L1ValidatorRegistration message
  // only needs the validationID. The P-Chain tx ID stays in the UI as a
  // confirmation breadcrumb that the user did the prior step.
  const step1Complete = !!validationID;
  const step2Complete = !!signedWarpMessage;
  const step3Complete = !!txHash;

  const handleAggregate = async () => {
    setLocalError(null);

    if (!validationID) {
      const msg = 'Validation ID missing — go back to the Initiate Removal step.';
      setLocalError(msg);
      onError(msg);
      return;
    }
    if (!subnetIdL1) {
      const msg = 'L1 Subnet ID is required.';
      setLocalError(msg);
      onError(msg);
      return;
    }
    if (!chainPublicClient) {
      const msg = 'Chain client unavailable.';
      setLocalError(msg);
      onError(msg);
      return;
    }

    setIsAggregating(true);
    try {
      // Fetch the registration justification from the L1's WarpMessenger logs.
      // This is the preimage that proves the validationID corresponds to a
      // validator that was previously registered — required by P-Chain's
      // verifyL1ValidatorRegistration for the registered=false case.
      const justification = await GetRegistrationJustification(validationID, subnetIdL1, chainPublicClient);
      if (!justification) {
        throw new Error(
          'No registration justification found for this validation ID. The validator may not have been registered through the standard flow, or its registration logs may be on a chain we cannot reach.',
        );
      }

      const validationIDBytes = hexToBytes(validationID as `0x${string}`);
      const removeValidatorMessage = packL1ValidatorRegistration(
        validationIDBytes,
        false, // registered = false → "this validator no longer exists on P-Chain"
        avalancheNetworkID,
        '11111111111111111111111111111111LpoYY', // sourceChainID = P-Chain (zero ID)
      );

      const aggregateSignaturePromise = aggregateSignature({
        message: bytesToHex(removeValidatorMessage),
        justification: bytesToHex(justification),
        signingSubnetId: signingSubnetId || subnetIdL1,
      });

      notify({ type: 'local', name: 'Aggregate P-Chain Signatures' }, aggregateSignaturePromise);

      const { signedMessage } = await aggregateSignaturePromise;
      setSignedWarpMessage(signedMessage);
    } catch (err: any) {
      const message = err instanceof Error ? err.message : String(err);
      setLocalError(`Signature aggregation failed: ${message}`);
      onError(`Signature aggregation failed: ${message}`);
    } finally {
      setIsAggregating(false);
    }
  };

  const handleSubmit = async () => {
    setLocalError(null);

    if (!signedWarpMessage) {
      const msg = 'No signed warp message — aggregate signatures first.';
      setLocalError(msg);
      onError(msg);
      return;
    }
    if (!walletClient || !chainPublicClient || !viemChain) {
      const msg = 'Wallet or chain configuration is not properly initialized.';
      setLocalError(msg);
      onError(msg);
      return;
    }

    setIsSubmitting(true);
    try {
      const signedWarpBytes = hexToBytes(`0x${signedWarpMessage}`);
      const accessList = packWarpIntoAccessList(signedWarpBytes);

      const hash =
        tokenType === 'native'
          ? await nativeStakingManager.completeValidatorRemoval(WARP_MESSAGE_INDEX, accessList)
          : await erc20StakingManager.completeValidatorRemoval(WARP_MESSAGE_INDEX, accessList);

      setTxHash(hash);
      const receipt = await chainPublicClient.waitForTransactionReceipt({ hash: hash as `0x${string}` });
      if (receipt.status !== 'success') {
        throw new Error(`Transaction failed with status: ${receipt.status}`);
      }

      const hasRemovalEvent = receipt.logs.some(
        (log) => log.topics[0]?.toLowerCase().includes('removal') || log.topics[0]?.toLowerCase().includes('complete'),
      );
      const successMsg = hasRemovalEvent
        ? 'Validator removal completed and rewards distributed successfully.'
        : 'Validator removal completed successfully.';

      onSuccess({ txHash: hash, message: successMsg });
    } catch (err: any) {
      let message = err instanceof Error ? err.message : String(err);
      if (message.includes('User rejected')) {
        message = 'Transaction was rejected by user';
      } else if (message.includes('InvalidValidationID')) {
        message = 'Invalid validation ID. The validator may not exist or removal was not initiated.';
      } else if (message.includes('ValidatorNotRemovable')) {
        message = 'Validator cannot be removed yet. Ensure you have initiated removal first.';
      } else if (message.includes('InvalidValidatorStatus')) {
        message = 'Validator is not in the correct status for completion. Check if removal was initiated.';
      } else if (message.includes('UnexpectedRegistrationStatus')) {
        message =
          "Contract rejected the warp's registration status. Make sure the SetL1ValidatorWeightTx (weight=0) has been accepted by P-Chain before completing here.";
      }
      setLocalError(`Failed to complete validator removal: ${message}`);
      onError(`Failed to complete validator removal: ${message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  function generateCastCommand(): string {
    if (!signedWarpMessage) return '';
    const rpcUrl = viemChain?.rpcUrls?.default?.http?.[0] || '<L1_RPC_URL>';
    const addr = stakingManagerAddress || '<STAKING_MANAGER_ADDRESS>';
    const abi = tokenType === 'native' ? NativeTokenStakingManager.abi : ERC20TokenStakingManager.abi;
    const signedWarpBytes = hexToBytes(`0x${signedWarpMessage}`);
    const accessList = packWarpIntoAccessList(signedWarpBytes);
    const calldata = encodeFunctionData({
      abi: abi as Abi,
      functionName: 'completeValidatorRemoval',
      args: [WARP_MESSAGE_INDEX],
    });
    return generateCastSendCommand({ address: addr, calldata, accessList, rpcUrl });
  }

  return (
    <div className="space-y-3">
      {error && <Alert variant="error">{error}</Alert>}

      {/* Step 1 — Confirm we have what we need from the previous step */}
      <StepFlowCard
        step={1}
        title="Verify Prior Steps"
        description="Confirm the validation ID and P-Chain transaction from earlier steps"
        isComplete={step1Complete}
      >
        <div className="mt-2 space-y-2">
          {validationID ? (
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-green-600 dark:text-green-400">
                <Check className="w-3.5 h-3.5" />
                <span className="text-xs font-medium">Validation ID present</span>
              </div>
              <code className="block font-mono text-[11px] break-all bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded">
                {validationID}
              </code>
            </div>
          ) : (
            <Alert variant="warning">Validation ID missing — go back to Initiate Removal.</Alert>
          )}
          <Input
            label="P-Chain Transaction ID"
            value={pChainTxId}
            onChange={setPChainTxId}
            placeholder="From the P-Chain Weight Update step"
            disabled={isAggregating || isSubmitting || !!txHash}
            helperText="For your reference — this Complete step uses the validation ID directly, not the tx contents."
          />
        </div>
      </StepFlowCard>

      {/* Step 2 — Aggregate signatures */}
      <StepFlowCard
        step={2}
        title="Aggregate Signatures"
        description="Build L1ValidatorRegistration(registered=false) + collect 67% quorum"
        isComplete={step2Complete}
        isActive={step1Complete && !step2Complete}
      >
        {step2Complete && !step3Complete && (
          <div className="mt-2 space-y-2">
            <div className="flex items-center gap-1.5 text-green-600 dark:text-green-400">
              <Check className="w-3.5 h-3.5" />
              <span className="text-xs font-medium">Signatures aggregated</span>
            </div>
            <button
              type="button"
              onClick={handleAggregate}
              disabled={isAggregating || isSubmitting}
              className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline disabled:opacity-50"
            >
              Re-aggregate signatures
            </button>
          </div>
        )}
        {!step2Complete && step1Complete && !step3Complete && (
          <div className="mt-2">
            <Button
              onClick={handleAggregate}
              disabled={isAggregating || !validationID}
              loading={isAggregating}
              className="w-full"
            >
              {isAggregating ? 'Aggregating signatures…' : 'Aggregate Signatures'}
            </Button>
          </div>
        )}
      </StepFlowCard>

      {/* Step 3 — Submit to L1 */}
      <StepFlowCard
        step={3}
        title="Submit to L1"
        description="Call completeValidatorRemoval on the Staking Manager"
        isComplete={step3Complete}
        isActive={step2Complete && !step3Complete}
      >
        {step3Complete && txHash && (
          <div className="mt-2 flex items-center gap-1.5 text-green-600 dark:text-green-400">
            <Check className="w-3.5 h-3.5" />
            <span className="text-xs font-medium">
              Removal complete:{' '}
              <code className="font-mono text-[11px] bg-green-100 dark:bg-green-900/30 px-1.5 py-0.5 rounded">
                {txHash}
              </code>
            </span>
          </div>
        )}
        {!step3Complete && step2Complete && (
          <div className="mt-2">
            <CoreWalletTransactionButton
              onClick={handleSubmit}
              loading={isSubmitting}
              loadingText="Submitting…"
              disabled={isSubmitting || !signedWarpMessage}
              className="w-full"
            >
              Complete Removal & Distribute Rewards
            </CoreWalletTransactionButton>
            <div className="mt-3">
              <CliAlternative command={generateCastCommand()} />
            </div>
          </div>
        )}
      </StepFlowCard>

      <Alert variant="info">
        <p className="text-sm font-medium">What happens when you complete removal:</p>
        <ul className="list-disc list-inside text-sm mt-2 space-y-1">
          <li>Validator stake will be returned</li>
          <li>Rewards will be calculated and distributed based on uptime</li>
          <li>If applicable, delegation fees will become claimable</li>
          <li>Validator will be removed from the active set</li>
        </ul>
      </Alert>
    </div>
  );
};

export default CompleteValidatorRemoval;
