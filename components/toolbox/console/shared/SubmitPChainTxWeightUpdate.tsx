import React, { useState, useEffect } from 'react';
import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import { Button } from '@/components/toolbox/components/Button';
import { Input } from '@/components/toolbox/components/Input';
import { Alert } from '@/components/toolbox/components/Alert';
import { useAvalancheSDKChainkit } from '@/components/toolbox/stores/useAvalancheSDKChainkit';
import useConsoleNotifications from '@/hooks/useConsoleNotifications';
import { HashChip } from '@/components/explorer-v2/ui';
import { Steps, Step } from '@/components/toolbox/components/Steps';
import { Field, Reveal, Status } from '@/components/toolbox/console/shared/validator-flow-ui';
import { useChainPublicClient } from '@/components/toolbox/hooks/useChainPublicClient';
import { useSubmitPChainTx } from '@/components/toolbox/hooks/useSubmitPChainTx';
import { Check, RotateCcw } from 'lucide-react';
import { extractWarpMessageFromReceipt } from '@avalanche-sdk/interchain/warp';
import { validateAndCleanTxHash } from '@/components/toolbox/utils/warp';
import { PChainManualSubmit } from '@/components/toolbox/components/PChainManualSubmit';
import { parsePChainError } from '@/components/toolbox/hooks/contracts';
import { CoreWalletTransactionButton } from '@/components/toolbox/components/CoreWalletTransactionButton';
import { waitForPChainConfirmation } from '@/components/toolbox/utils/pchainConfirmation';

export interface WeightUpdateEventData {
  validationID: `0x${string}`;
  nonce: bigint;
  weight: bigint;
  messageID?: `0x${string}`;
  delegationID?: `0x${string}`;
}

export interface SubmitPChainTxWeightUpdateProps {
  subnetIdL1: string;
  initialEvmTxHash?: string;
  signingSubnetId: string;
  /** Label for the transaction hash input */
  txHashLabel?: string;
  /** Placeholder for the transaction hash input */
  txHashPlaceholder?: string;
  /** Optional additional info to display */
  additionalInfo?: React.ReactNode;
  /** Called on successful P-Chain transaction */
  onSuccess: (pChainTxId: string, eventData?: WeightUpdateEventData) => void;
  /** Called on error */
  onError: (message: string) => void;
}

/**
 * Generic component for submitting weight update transactions to P-Chain.
 * Used for:
 * - Validator weight changes (ChangeWeight flow)
 * - Delegator registration (Delegation flow)
 * - Delegator removal
 * - Validator removal
 *
 * All these operations use setL1ValidatorWeight on P-Chain.
 */
const SubmitPChainTxWeightUpdate: React.FC<SubmitPChainTxWeightUpdateProps> = ({
  subnetIdL1,
  initialEvmTxHash,
  signingSubnetId,
  txHashLabel = 'EVM Transaction Hash',
  txHashPlaceholder = 'Enter the transaction hash from the previous step (0x...)',
  additionalInfo,
  onSuccess,
  onError,
}) => {
  const { coreWalletClient, pChainAddress, isTestnet } = useWalletStore();
  const chainPublicClient = useChainPublicClient();
  const walletType = useWalletStore((s) => s.walletType);
  const isCoreWallet = walletType === 'core';
  const { aggregateSignature } = useAvalancheSDKChainkit();
  const { notify } = useConsoleNotifications();
  const { submitPChainTx } = useSubmitPChainTx();

  const [evmTxHash, setEvmTxHash] = useState(initialEvmTxHash || '');
  const [isAggregating, setIsAggregating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setErrorState] = useState<string | null>(null);
  const [txSuccess, setTxSuccess] = useState<string | null>(null);
  const [unsignedWarpMessage, setUnsignedWarpMessage] = useState<string | null>(null);
  const [signedWarpMessage, setSignedWarpMessage] = useState<string | null>(null);
  const [eventData, setEventData] = useState<WeightUpdateEventData | null>(null);
  const [_manualPChainTxId, setManualPChainTxId] = useState('');

  // Combined flag for places that don't care which on-chain op is in flight.
  const isProcessing = isAggregating || isSubmitting;

  // Update evmTxHash when initialEvmTxHash prop changes
  useEffect(() => {
    if (initialEvmTxHash && initialEvmTxHash !== evmTxHash) {
      setEvmTxHash(initialEvmTxHash);
    }
  }, [initialEvmTxHash]);

  // Extract warp message and event data when transaction hash changes
  useEffect(() => {
    let cancelled = false;
    const extractWarpMessage = async () => {
      const validTxHash = validateAndCleanTxHash(evmTxHash);
      if (!chainPublicClient || !validTxHash) {
        setUnsignedWarpMessage(null);
        setEventData(null);
        setSignedWarpMessage(null);
        return;
      }

      try {
        const receipt = await chainPublicClient.waitForTransactionReceipt({ hash: validTxHash });
        if (cancelled) return;
        if (receipt.status !== 'success') {
          throw new Error('The source transaction reverted. Check the transaction before proceeding.');
        }

        const extractedWarpMessage = extractWarpMessageFromReceipt(receipt);
        if (cancelled) return;
        setUnsignedWarpMessage(extractedWarpMessage);

        // Try to extract event data from different event types
        // InitiatedValidatorWeightUpdate: 0x6e350dd49b060d87f297206fd309234ed43156d890ced0f139ecf704310481d3
        // InitiatedDelegatorRegistration: look for events with delegation ID
        const weightUpdateEventTopic = '0x6e350dd49b060d87f297206fd309234ed43156d890ced0f139ecf704310481d3';

        const weightEventLog = receipt.logs.find((log) => {
          return (
            log && log.topics && log.topics[0] && log.topics[0].toLowerCase() === weightUpdateEventTopic.toLowerCase()
          );
        });

        if (weightEventLog) {
          // Parse InitiatedValidatorWeightUpdate event
          const dataWithoutPrefix = weightEventLog.data.slice(2);
          const nonce = BigInt('0x' + dataWithoutPrefix.slice(0, 64));
          const messageID = '0x' + dataWithoutPrefix.slice(64, 128);
          const weight = BigInt('0x' + dataWithoutPrefix.slice(128, 192));

          setEventData({
            validationID: weightEventLog.topics[1] as `0x${string}`,
            nonce,
            messageID: messageID as `0x${string}`,
            weight,
          });
        } else {
          // Try to find any event with indexed bytes32 topics (generic weight update)
          const genericEventLog = receipt.logs.find((log) => {
            return log && log.topics && log.topics.length >= 2 && log.data && log.data.length > 2;
          });

          if (genericEventLog && genericEventLog.data.length >= 130) {
            const dataWithoutPrefix = genericEventLog.data.slice(2);
            const nonce = BigInt('0x' + dataWithoutPrefix.slice(0, 64));
            const weight = dataWithoutPrefix.length >= 128 ? BigInt('0x' + dataWithoutPrefix.slice(64, 128)) : 0n;

            setEventData({
              validationID: genericEventLog.topics[1] as `0x${string}`,
              delegationID: (genericEventLog.topics[2] as `0x${string}`) || undefined,
              nonce,
              weight,
            });
          }
        }

        setErrorState(null);
      } catch (err: any) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : String(err);
        setErrorState(`Failed to extract warp message: ${message}`);
        setUnsignedWarpMessage(null);
        setEventData(null);
        setSignedWarpMessage(null);
      }
    };

    extractWarpMessage();
    return () => {
      cancelled = true;
    };
  }, [evmTxHash, chainPublicClient]);

  /**
   * Step 2: aggregate BLS signatures from the warp's signing subnet.
   * Independent from submission so the user can retry aggregation (e.g. on a
   * partial-quorum result) without committing to a P-Chain transaction.
   */
  const handleAggregateSignatures = async () => {
    setErrorState(null);

    if (!evmTxHash.trim()) {
      setErrorState('EVM transaction hash is required.');
      onError('EVM transaction hash is required.');
      return;
    }
    if (!subnetIdL1) {
      setErrorState('L1 Subnet ID is required.');
      onError('L1 Subnet ID is required.');
      return;
    }
    if (!unsignedWarpMessage) {
      setErrorState('Unsigned warp message not found. Check the transaction hash.');
      onError('Unsigned warp message not found.');
      return;
    }
    if (!signingSubnetId) {
      const msg =
        'Signing subnet ID not available. The validator manager details may still be loading — wait a moment and retry.';
      setErrorState(msg);
      onError(msg);
      return;
    }

    setIsAggregating(true);
    try {
      const aggregateSignaturePromise = aggregateSignature({
        message: unsignedWarpMessage,
        signingSubnetId,
        quorumPercentage: 67,
      });

      notify({ type: 'local', name: 'Aggregate Signatures' }, aggregateSignaturePromise);

      const { signedMessage } = await aggregateSignaturePromise;
      setSignedWarpMessage(signedMessage);
    } catch (err: any) {
      const message = parsePChainError(err);
      setErrorState(`Signature aggregation failed: ${message}`);
      onError(`Signature aggregation failed: ${message}`);
    } finally {
      setIsAggregating(false);
    }
  };

  /**
   * Step 3: submit the signed warp to P-Chain via setL1ValidatorWeight.
   * Only enabled once aggregation has produced a signed message. Core wallets
   * use this button; non-Core wallets fall back to the CLI panel.
   */
  const handleSubmitToPChain = async () => {
    setErrorState(null);
    setTxSuccess(null);

    if (!signedWarpMessage) {
      const msg = 'No signed warp message — aggregate signatures first.';
      setErrorState(msg);
      onError(msg);
      return;
    }
    if (isCoreWallet && !coreWalletClient) {
      setErrorState('Connect Core or a Console wallet to sign P-Chain transactions.');
      return;
    }
    if (isCoreWallet && !pChainAddress) {
      setErrorState('P-Chain address is missing. Please connect your wallet.');
      onError('P-Chain address is missing.');
      return;
    }

    setIsSubmitting(true);
    try {
      const pChainTxId = await submitPChainTx(async (client) => {
        const pChainTxIdPromise = client.setL1ValidatorWeight({
          signedWarpMessage: signedWarpMessage,
        });
        notify('setL1ValidatorWeight', pChainTxIdPromise);
        return pChainTxIdPromise;
      });

      await waitForPChainConfirmation(pChainTxId, isTestnet);

      setTxSuccess(pChainTxId);
      onSuccess(pChainTxId, eventData || undefined);
    } catch (err: any) {
      const message = parsePChainError(err);
      setErrorState(`P-Chain submission failed: ${message}`);
      onError(`P-Chain submission failed: ${message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTxHashChange = (value: string) => {
    setEvmTxHash(value);
    setErrorState(null);
    setTxSuccess(null);
    setSignedWarpMessage(null);
    setManualPChainTxId('');
  };

  const handleContinueWithManualTxId = (pChainTxId: string) => {
    setTxSuccess(pChainTxId);
    onSuccess(pChainTxId, eventData || undefined);
  };

  const generateCLICommand = () => {
    if (!signedWarpMessage) return '';
    const network = isTestnet ? 'fuji' : 'mainnet';
    return [
      `platform-cli l1 set-validator-weight \\`,
      `  --message "${signedWarpMessage}" \\`,
      `  --network ${network} \\`,
      `  --key-name <your-key-name>`,
    ].join('\n');
  };

  // Don't render if no subnet is selected
  if (!subnetIdL1) {
    return <p className="text-[13px] text-zinc-500 dark:text-zinc-400">Select an L1 subnet first.</p>;
  }

  const step1Complete = !!unsignedWarpMessage;
  const step2Complete = !!signedWarpMessage;
  const step3Complete = !!txSuccess;

  return (
    <div className="flex flex-col gap-5">
      {error && <Alert variant="error">{error}</Alert>}

      <Steps>
        <Step>
          <div>
            <h3 className="flex items-center justify-between gap-3">
              Extract the warp message
              {step1Complete && <Status tone="ok">Extracted</Status>}
            </h3>
            <p>Paste the EVM transaction hash to pull out the unsigned warp message.</p>
          </div>
          <Input
            label={txHashLabel}
            value={evmTxHash}
            onChange={handleTxHashChange}
            placeholder={txHashPlaceholder}
            disabled={isProcessing || txSuccess !== null}
          />
          {additionalInfo}
          {step1Complete && eventData && (
            <div className="flex flex-col gap-3">
              <Field label="Validation ID">
                <HashChip value={eventData.validationID} len={18} />
              </Field>
              {eventData.weight > 0n && (
                <Field label="New weight">
                  <span className="font-mono tabular-nums">{eventData.weight.toString()}</span>
                </Field>
              )}
              {eventData.delegationID && (
                <Field label="Delegation ID">
                  <HashChip value={eventData.delegationID} len={18} />
                </Field>
              )}
              <Reveal label="Unsigned warp message" value={unsignedWarpMessage || ''} />
            </div>
          )}
        </Step>

        {/* Step 2: Aggregate BLS signatures from the warp's signing subnet. */}
        <Step>
          <div>
            <h3 className="flex items-center justify-between gap-3">
              Aggregate signatures
              {step2Complete && <Status tone="ok">Aggregated</Status>}
            </h3>
            <p>Collects BLS signatures from the signing subnet&apos;s validators. Needs a 67% quorum.</p>
          </div>
          {step2Complete && (
            <div className="flex flex-col gap-3">
              <p className="flex items-center gap-1.5 text-[13px] text-emerald-700 dark:text-emerald-400">
                <Check className="h-3.5 w-3.5" />
                Signatures aggregated
              </p>
              <Reveal label="Signed warp message" value={signedWarpMessage || ''} />
              {!step3Complete && (
                <button
                  type="button"
                  onClick={handleAggregateSignatures}
                  disabled={isProcessing}
                  className="group/again inline-flex w-fit items-center gap-1.5 font-mono text-[10.5px] font-bold uppercase tracking-[0.14em] text-zinc-900 underline-offset-4 hover:underline disabled:cursor-not-allowed disabled:opacity-50 dark:text-zinc-100"
                >
                  <RotateCcw className="h-3 w-3" />
                  Re-aggregate signatures
                </button>
              )}
            </div>
          )}
          {!step2Complete && step1Complete && !step3Complete && (
            <Button
              onClick={handleAggregateSignatures}
              disabled={isAggregating || !unsignedWarpMessage}
              loading={isAggregating}
              loadingText="Aggregating signatures…"
              className="w-full"
            >
              Aggregate signatures
            </Button>
          )}
          {!step1Complete && (
            <p className="font-mono text-[11px] text-zinc-400 dark:text-zinc-500">Waiting on the warp message.</p>
          )}
        </Step>

        {/* Step 3: Submit the signed warp to P-Chain. Distinct from aggregation
            so a partial-quorum aggregation can be retried independently without
            re-prompting the wallet for a P-Chain signature. */}
        <Step>
          <div>
            <h3 className="flex items-center justify-between gap-3">
              Submit to the P-Chain
              {step3Complete && <Status tone="ok">Confirmed</Status>}
            </h3>
            <p>
              Sends the signed warp message in a{' '}
              <code className="font-mono text-[12px] text-zinc-900 dark:text-zinc-100">setL1ValidatorWeight</code>{' '}
              transaction.
            </p>
          </div>
          {step3Complete && txSuccess && (
            <Field label="P-Chain tx">
              <HashChip value={txSuccess} len={18} />
            </Field>
          )}
          {!step3Complete && step2Complete && (
            <>
              {isCoreWallet ? (
                <CoreWalletTransactionButton
                  onClick={handleSubmitToPChain}
                  loading={isSubmitting}
                  loadingText="Submitting to P-Chain…"
                  disabled={isSubmitting || !signedWarpMessage}
                  className="w-full"
                >
                  Submit to P-Chain
                </CoreWalletTransactionButton>
              ) : (
                // Non-Core wallets don't sign P-Chain txs directly — the CLI
                // panel below handles submission and accepts a manual tx ID.
                <p className="text-[13px] text-zinc-500 dark:text-zinc-400">
                  Run the command below, then paste the P-Chain transaction ID it returns.
                </p>
              )}
            </>
          )}
          {!step2Complete && (
            <p className="font-mono text-[11px] text-zinc-400 dark:text-zinc-500">Waiting on the signatures.</p>
          )}
        </Step>
      </Steps>

      {/* Non-Core: CLI command for manual submission */}
      {!isCoreWallet && signedWarpMessage && !txSuccess && (
        <PChainManualSubmit cliCommand={generateCLICommand()} onSubmit={handleContinueWithManualTxId} />
      )}
    </div>
  );
};

export default SubmitPChainTxWeightUpdate;
