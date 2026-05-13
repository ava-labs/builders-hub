'use client';

import React, { useState } from 'react';
import { Loader2, RefreshCcw, ArrowRight } from 'lucide-react';
import { Alert } from '@/components/toolbox/components/Alert';
import { Button } from '@/components/toolbox/components/Button';
import { useValidatorManager } from '@/components/toolbox/hooks/contracts';
import { useChainPublicClient } from '@/components/toolbox/hooks/useChainPublicClient';

interface ResendRemovalMessageProps {
  /** The underlying ValidatorManager contract address (NOT the StakingManager). */
  validatorManagerAddress: string;
  validationID: string;
  /** Called with the new EVM tx hash on a successful resend. Caller wires this into the store so the P-Chain step picks up the fresh tx. */
  onSuccess: (txHash: string) => void;
  onError: (message: string) => void;
}

/**
 * Validator is in PendingRemoved on chain but P-Chain hasn't confirmed — usually
 * because the SetL1ValidatorWeight warp couldn't be verified at the height
 * P-Chain landed it at (validator-set drift between aggregator snapshot and
 * verification snapshot — most common during Fuji churn).
 *
 * The contract provides `resendValidatorRemovalMessage` for exactly this case.
 * It re-emits the same warp bytes (same nonce, same weight=0) from a fresh
 * on-chain transaction, giving the user a fresh extraction point to attempt
 * P-Chain submission again. The on-chain state doesn't advance — `sentNonce`
 * stays put — so this is safe to call repeatedly.
 */
export function ResendRemovalMessage({
  validatorManagerAddress,
  validationID,
  onSuccess,
  onError,
}: ResendRemovalMessageProps) {
  const chainPublicClient = useChainPublicClient();
  const validatorManager = useValidatorManager(validatorManagerAddress || null);

  const [isResending, setIsResending] = useState(false);
  const [error, setLocalError] = useState<string | null>(null);
  const [lastTxHash, setLastTxHash] = useState<string | null>(null);

  const handleResend = async () => {
    setIsResending(true);
    setLocalError(null);

    try {
      if (!validatorManagerAddress) throw new Error('Validator manager address missing.');
      if (!validationID) throw new Error('Validation ID missing.');
      if (!chainPublicClient) throw new Error('Chain client unavailable.');

      const hash = await validatorManager.resendValidatorRemovalMessage(validationID);
      const receipt = await chainPublicClient.waitForTransactionReceipt({ hash: hash as `0x${string}` });
      if (receipt.status !== 'success') {
        throw new Error(`Transaction failed with status: ${receipt.status}`);
      }

      setLastTxHash(hash);
      onSuccess(hash);
    } catch (err: any) {
      let message = err instanceof Error ? err.message : String(err);
      if (message.includes('User rejected')) message = 'Transaction was rejected by user';
      setLocalError(message);
      onError(message);
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 dark:bg-amber-500/10 p-4 space-y-3">
      <div className="flex items-start gap-3">
        <div className="h-7 w-7 shrink-0 flex items-center justify-center rounded-xl bg-amber-500/15">
          <RefreshCcw className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
        </div>
        <div className="flex-1 min-w-0 space-y-1">
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            Removal is pending P-Chain confirmation
          </h3>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            This validator is already in <code className="text-xs">PendingRemoved</code> state on the L1, but P-Chain
            hasn't acknowledged the removal yet. Almost always means the last warp message failed verification at
            P-Chain (validator-set drift between when the aggregator collected signatures and when P-Chain verified).
          </p>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Click below to re-emit the same warp message from a new transaction. Then go back to{' '}
            <strong>P-Chain Weight Update</strong> with the fresh transaction hash and try aggregation again. Repeat
            until P-Chain accepts the message — each fresh aggregation rolls the dice against the current validator-set
            snapshot.
          </p>
        </div>
      </div>

      {error && <Alert variant="error">Failed to resend: {error}</Alert>}

      {lastTxHash && !error && (
        <Alert variant="info">
          <div className="space-y-1">
            <p className="text-sm">Resent. New tx hash:</p>
            <code className="block font-mono text-[11px] break-all bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded">
              {lastTxHash}
            </code>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Click <strong>Next</strong> below to move to the P-Chain Weight Update step.
            </p>
          </div>
        </Alert>
      )}

      <div className="flex items-center gap-2">
        <Button
          onClick={handleResend}
          loading={isResending}
          loadingText={isResending ? 'Resending…' : undefined}
          disabled={isResending || !validatorManagerAddress || !validationID}
          variant="primary"
          size="sm"
          icon={<ArrowRight className="h-3.5 w-3.5" />}
        >
          {lastTxHash ? 'Resend again' : 'Resend Removal Message'}
        </Button>
        {isResending && (
          <span className="text-xs text-zinc-500 dark:text-zinc-400 flex items-center gap-1">
            <Loader2 className="h-3 w-3 animate-spin" /> Waiting for tx confirmation…
          </span>
        )}
      </div>
    </div>
  );
}

export default ResendRemovalMessage;
