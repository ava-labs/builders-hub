'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useWalletStore } from '../stores/walletStore';
import { useViemChainStore } from '../stores/toolboxStore';
import { useChainPublicClient } from './useChainPublicClient';
import { useResolvedWalletClient } from './useResolvedWalletClient';
import useConsoleNotifications from '@/hooks/useConsoleNotifications';
import { decideAdvanceAction } from '../utils/proposervm';
import type { ProposerVMStatusResult } from './useProposerVMStatus';

/** Hard cap on block-producing transactions per run. A long-idle chain needs
 *  2 (seal the old epoch, start the new one); more than 4 means something
 *  else is wrong and the user should retry their delivery instead. */
export const MAX_ADVANCE_TXS = 4;
/** Sends when the epoch cannot be read at all ("blind" mode): enough blocks
 *  to seal and re-pin, with no way to verify. */
const BLIND_ADVANCE_TXS = 2;

export type AdvancePhase = 'idle' | 'countdown' | 'sending' | 'confirming' | 'verifying' | 'done' | 'gave-up' | 'error';

export type AdvanceErrorKind = 'no-gas' | 'allowlist' | 'wallet' | 'rpc';

class AdvanceError extends Error {
  readonly kind: AdvanceErrorKind;
  constructor(kind: AdvanceErrorKind, message: string) {
    super(message);
    this.kind = kind;
  }
}

function classifySendError(err: unknown): AdvanceError {
  const message = err instanceof Error ? err.message : String(err);
  if (/allow ?list|not authorized|non-allowlisted|is not authorized/i.test(message)) {
    return new AdvanceError(
      'allowlist',
      'This chain restricts who may send transactions (Transactor Allowlist), and the connected wallet is not on the list.',
    );
  }
  if (/user rejected|denied|cancelled|canceled/i.test(message)) {
    return new AdvanceError('wallet', 'Transaction rejected in the wallet.');
  }
  return new AdvanceError('rpc', message);
}

/**
 * Produces blocks on the selected L1 (0-value self-transfers from the
 * connected wallet) until the chain's epoch pins a P-Chain height at or past
 * `requiredHeight`. One user click per run; nothing is ever sent silently.
 *
 * This advances warp DELIVERY readiness only. It cannot fix signature
 * aggregation failures, which depend on the signing validators themselves.
 */
export function useAdvanceProposerVM(opts: {
  status: ProposerVMStatusResult;
  requiredHeight?: bigint | null;
  onAdvanced?: () => void;
}): {
  start: () => void;
  cancel: () => void;
  phase: AdvancePhase;
  /** 1-based count of block-producing transactions sent this run. */
  attempt: number;
  maxAttempts: number;
  countdownSecRemaining: number | null;
  txHashes: `0x${string}`[];
  verified: boolean;
  error: string | null;
  errorKind: AdvanceErrorKind | null;
} {
  const { requiredHeight = null, onAdvanced } = opts;
  const walletEVMAddress = useWalletStore((s) => s.walletEVMAddress);
  const viemChain = useViemChainStore();
  const publicClient = useChainPublicClient();
  const walletClient = useResolvedWalletClient();
  const { notify } = useConsoleNotifications();

  const [phase, setPhase] = useState<AdvancePhase>('idle');
  const [attempt, setAttempt] = useState(0);
  const [countdownSecRemaining, setCountdownSecRemaining] = useState<number | null>(null);
  const [txHashes, setTxHashes] = useState<`0x${string}`[]>([]);
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorKind, setErrorKind] = useState<AdvanceErrorKind | null>(null);

  const cancelledRef = useRef(false);
  const runningRef = useRef(false);
  // The loop must call the latest refresh (its identity changes with the
  // selected L1), not the one captured when start() was created.
  const statusRef = useRef(opts.status);
  useEffect(() => {
    statusRef.current = opts.status;
  }, [opts.status]);

  useEffect(() => {
    return () => {
      cancelledRef.current = true;
    };
  }, []);

  const waitUntilSealable = useCallback(async (sealableAtMs: number) => {
    setPhase('countdown');
    while (Date.now() < sealableAtMs && !cancelledRef.current) {
      setCountdownSecRemaining(Math.ceil((sealableAtMs - Date.now()) / 1000));
      await new Promise((r) => setTimeout(r, 1000));
    }
    setCountdownSecRemaining(null);
  }, []);

  const start = useCallback(() => {
    if (runningRef.current) return;
    runningRef.current = true;
    cancelledRef.current = false;
    setTxHashes([]);
    setVerified(false);
    setError(null);
    setErrorKind(null);
    setAttempt(0);

    void (async () => {
      try {
        if (!walletClient || !publicClient || !viemChain || !walletEVMAddress) {
          throw new AdvanceError('wallet', 'Connect a wallet on the selected chain first.');
        }
        const account = walletEVMAddress as `0x${string}`;

        const balance = await publicClient.getBalance({ address: account });
        if (balance === 0n) {
          throw new AdvanceError(
            'no-gas',
            'The connected wallet holds no funds on this chain, so it cannot pay for the block-producing transactions.',
          );
        }

        let sends = 0;
        setPhase('verifying');
        let snapshot = await statusRef.current.refresh();
        // Latched once: a run that started with a readable epoch never
        // downgrades to blind completion on a later transient read failure.
        const blindRun = snapshot.epoch === null;

        for (;;) {
          if (cancelledRef.current) {
            setPhase('idle');
            return;
          }

          const decision = decideAdvanceAction({
            epoch: snapshot.epoch,
            liveHeight: snapshot.liveHeight,
            tipTimestampSec: snapshot.tipTimestampSec,
            nowMs: Date.now(),
            requiredHeight,
            blindRun,
            sends,
            maxSends: MAX_ADVANCE_TXS,
            blindSends: BLIND_ADVANCE_TXS,
          });

          if (decision.action === 'done-verified' || decision.action === 'done-unverified') {
            setVerified(decision.action === 'done-verified');
            setPhase('done');
            onAdvanced?.();
            return;
          }
          if (decision.action === 'give-up') {
            setPhase('gave-up');
            return;
          }
          if (decision.action === 'wait') {
            await waitUntilSealable(decision.untilMs);
            if (cancelledRef.current) {
              setPhase('idle');
              return;
            }
            setPhase('verifying');
            snapshot = await statusRef.current.refresh();
            continue;
          }

          sends += 1;
          setAttempt(sends);
          setPhase('sending');
          const nonce = await publicClient.getTransactionCount({ address: account, blockTag: 'pending' });
          const txPromise = walletClient
            .sendTransaction({
              to: account,
              value: 0n,
              account,
              chain: viemChain,
              nonce,
            })
            .catch((err) => {
              throw classifySendError(err);
            });
          notify({ type: 'transfer', name: 'Advance P-Chain View' }, txPromise, viemChain);
          const hash = await txPromise;
          setPhase('confirming');
          await publicClient.waitForTransactionReceipt({ hash });
          setTxHashes((prev) => [...prev, hash]);
          setPhase('verifying');
          snapshot = await statusRef.current.refresh();
        }
      } catch (err) {
        const advanceErr = err instanceof AdvanceError ? err : classifySendError(err);
        setError(advanceErr.message);
        setErrorKind(advanceErr.kind);
        setPhase('error');
      } finally {
        runningRef.current = false;
      }
    })();
  }, [walletClient, publicClient, viemChain, walletEVMAddress, requiredHeight, notify, onAdvanced, waitUntilSealable]);

  const cancel = useCallback(() => {
    cancelledRef.current = true;
  }, []);

  return {
    start,
    cancel,
    phase,
    attempt,
    maxAttempts: MAX_ADVANCE_TXS,
    countdownSecRemaining,
    txHashes,
    verified,
    error,
    errorKind,
  };
}
