'use client';

import React, { useState } from 'react';
import { Loader2, RefreshCcw, ArrowRight } from 'lucide-react';
import { Alert } from '@/components/toolbox/components/Alert';
import { Button } from '@/components/toolbox/components/Button';
import { HashChip } from '@/components/explorer-v2/ui';
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
    <div className="flex flex-col gap-4 border border-amber-300 bg-white px-5 py-4 dark:border-amber-900/70 dark:bg-zinc-950">
      <div className="flex items-start gap-3">
        <RefreshCcw className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <p className="font-mono text-[10.5px] font-bold uppercase tracking-[0.14em] text-amber-700 dark:text-amber-400">
            Removal pending on the P-Chain
          </p>
          <p className="text-[13px] leading-relaxed text-zinc-600 dark:text-zinc-400">
            This validator is <code className="font-mono text-[12px]">PendingRemoved</code> on the L1, but the P-Chain
            hasn&apos;t acknowledged it yet. Usually the last warp message failed P-Chain verification because the
            validator set drifted between signature collection and verification.
          </p>
          <p className="text-[13px] leading-relaxed text-zinc-600 dark:text-zinc-400">
            Resend the same warp message from a new transaction, then go back to{' '}
            <strong className="font-medium text-zinc-900 dark:text-zinc-100">P-Chain Weight Update</strong> with the
            fresh hash. Repeat until the P-Chain accepts it; each new aggregation runs against the current validator
            set.
          </p>
        </div>
      </div>

      {error && <Alert variant="error">Failed to resend: {error}</Alert>}

      {lastTxHash && !error && (
        <div className="flex flex-col gap-1.5 border-t border-zinc-200 pt-4 dark:border-zinc-800">
          <p className="font-mono text-[10.5px] font-bold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">
            Resent · new transaction
          </p>
          <HashChip value={lastTxHash} len={18} />
          <p className="text-[12px] text-zinc-500 dark:text-zinc-400">
            Press <strong className="font-medium text-zinc-900 dark:text-zinc-100">Next</strong> to go to the P-Chain
            Weight Update step.
          </p>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button
          onClick={handleResend}
          loading={isResending}
          loadingText={isResending ? 'Resending…' : undefined}
          disabled={isResending || !validatorManagerAddress || !validationID}
          variant="primary"
          size="sm"
          className="w-auto"
          icon={<ArrowRight className="h-3.5 w-3.5" />}
        >
          {lastTxHash ? 'Resend again' : 'Resend removal message'}
        </Button>
        {isResending && (
          <span className="flex items-center gap-2 font-mono text-[11px] text-zinc-500 dark:text-zinc-400">
            <Loader2 className="h-3 w-3 animate-spin" /> Waiting for confirmation…
          </span>
        )}
      </div>
    </div>
  );
}

export default ResendRemovalMessage;
