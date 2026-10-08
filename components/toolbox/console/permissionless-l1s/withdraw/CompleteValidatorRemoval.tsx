'use client';

import React, { useState } from 'react';
import { Check, RotateCcw } from 'lucide-react';
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
import { Steps, Step } from '@/components/toolbox/components/Steps';
import { CliAlternative } from '@/components/console/cli-alternative';
import { HashChip } from '@/components/explorer-v2/ui';
import { Field, Status } from '@/components/toolbox/console/shared/validator-flow-ui';
import {
  getRegistrationJustification,
  newL1ValidatorRegistrationMessage,
  newWarpMessage,
  packWarpIntoAccessList,
} from '@avalanche-sdk/interchain/warp';
import { hexToCB58 } from '@avalanche-sdk/client/utils';
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
      const justification = await getRegistrationJustification(validationID, subnetIdL1, chainPublicClient);
      if (!justification) {
        throw new Error(
          'No registration justification found for this validation ID. The validator may not have been registered through the standard flow, or its registration logs may be on a chain we cannot reach.',
        );
      }

      // registered = false → "this validator no longer exists on P-Chain"
      const innerRemovalMsg = newL1ValidatorRegistrationMessage(hexToCB58(validationID as `0x${string}`), false);
      const unsignedRemovalMsg = newWarpMessage(
        avalancheNetworkID,
        '11111111111111111111111111111111LpoYY', // sourceChainID = P-Chain (zero ID)
        '',
        innerRemovalMsg.toHex(),
      );
      const removeValidatorMessage = hexToBytes(unsignedRemovalMsg.toHex() as `0x${string}`);

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
    <div className="flex flex-col gap-5">
      {error && <Alert variant="error">{error}</Alert>}

      <Steps>
        {/* Step 1 — Confirm we have what we need from the previous step */}
        <Step>
          <div>
            <h3 className="flex items-center justify-between gap-3">
              Check the earlier steps
              {step1Complete && <Status tone="ok">Ready</Status>}
            </h3>
            <p>Confirms the validation ID and P-Chain transaction from the earlier steps.</p>
          </div>
          {validationID ? (
            <Field label="Validation ID">
              <HashChip value={validationID} len={18} />
            </Field>
          ) : (
            <Alert variant="warning">Validation ID missing. Go back to Initiate Removal.</Alert>
          )}
          <Input
            label="P-Chain transaction ID"
            value={pChainTxId}
            onChange={setPChainTxId}
            placeholder="From the P-Chain Weight Update step"
            disabled={isAggregating || isSubmitting || !!txHash}
            helperText="For reference only. This step uses the validation ID, not the transaction contents."
          />
        </Step>

        {/* Step 2 — Aggregate signatures */}
        <Step>
          <div>
            <h3 className="flex items-center justify-between gap-3">
              Aggregate signatures
              {step2Complete && <Status tone="ok">Aggregated</Status>}
            </h3>
            <p>
              Builds{' '}
              <code className="font-mono text-[12px] text-zinc-900 dark:text-zinc-100">
                L1ValidatorRegistration(registered=false)
              </code>{' '}
              and collects a 67% quorum.
            </p>
          </div>
          {step2Complete && !step3Complete && (
            <div className="flex flex-col gap-3">
              <p className="flex items-center gap-1.5 text-[13px] text-emerald-700 dark:text-emerald-400">
                <Check className="h-3.5 w-3.5" />
                Signatures aggregated
              </p>
              <button
                type="button"
                onClick={handleAggregate}
                disabled={isAggregating || isSubmitting}
                className="inline-flex w-fit items-center gap-1.5 font-mono text-[10.5px] font-bold uppercase tracking-[0.14em] text-zinc-900 underline-offset-4 hover:underline disabled:cursor-not-allowed disabled:opacity-50 dark:text-zinc-100"
              >
                <RotateCcw className="h-3 w-3" />
                Re-aggregate signatures
              </button>
            </div>
          )}
          {!step2Complete && step1Complete && !step3Complete && (
            <Button
              onClick={handleAggregate}
              disabled={isAggregating || !validationID}
              loading={isAggregating}
              loadingText="Aggregating signatures…"
              className="w-full"
            >
              Aggregate signatures
            </Button>
          )}
          {!step1Complete && (
            <p className="font-mono text-[11px] text-zinc-400 dark:text-zinc-500">Waiting on the earlier steps.</p>
          )}
        </Step>

        {/* Step 3 — Submit to L1 */}
        <Step>
          <div>
            <h3 className="flex items-center justify-between gap-3">
              Submit to the L1
              {step3Complete && <Status tone="ok">Removed</Status>}
            </h3>
            <p>
              Calls{' '}
              <code className="font-mono text-[12px] text-zinc-900 dark:text-zinc-100">completeValidatorRemoval</code>{' '}
              on the Staking Manager.
            </p>
          </div>
          {step3Complete && txHash && (
            <Field label="Removal tx">
              <HashChip value={txHash} len={18} />
            </Field>
          )}
          {!step3Complete && step2Complete && (
            <>
              <CoreWalletTransactionButton
                onClick={handleSubmit}
                loading={isSubmitting}
                loadingText="Submitting…"
                disabled={isSubmitting || !signedWarpMessage}
                className="w-full"
              >
                Complete removal and distribute rewards
              </CoreWalletTransactionButton>
              <CliAlternative command={generateCastCommand()} />
            </>
          )}
          {!step2Complete && (
            <p className="font-mono text-[11px] text-zinc-400 dark:text-zinc-500">Waiting on the signatures.</p>
          )}
        </Step>
      </Steps>

      <div className="flex flex-col gap-2 border-t border-zinc-200 pt-4 dark:border-zinc-800">
        <p className="font-mono text-[10.5px] font-bold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">
          When removal completes
        </p>
        <ul className="flex flex-col gap-1.5 text-[13px] leading-relaxed text-zinc-600 dark:text-zinc-400">
          {[
            'The validator stake is returned.',
            'Rewards are calculated from uptime and paid out.',
            'Delegation fees, if any, become claimable.',
            'The validator leaves the active set.',
          ].map((line) => (
            <li key={line} className="flex gap-2.5">
              <span aria-hidden className="mt-[0.6em] h-1 w-1 shrink-0 bg-zinc-400 dark:bg-zinc-600" />
              {line}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default CompleteValidatorRemoval;
