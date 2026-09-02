'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { FastForward, Loader2 } from 'lucide-react';
import { Alert } from '@/components/toolbox/components/Alert';
import { Button } from '@/components/toolbox/components/Button';
import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import { useSelectedL1 } from '@/components/toolbox/stores/l1ListStore';
import { getPChainTxBlockHeight } from '@/components/toolbox/coreViem/utils/glacier';
import { useProposerVMStatus } from '@/components/toolbox/hooks/useProposerVMStatus';
import { useAdvanceProposerVM, type AdvancePhase } from '@/components/toolbox/hooks/useAdvanceProposerVM';

const C_CHAIN_EVM_IDS = [43113, 43114];
const RUNNING_PHASES: AdvancePhase[] = ['countdown', 'sending', 'confirming', 'verifying'];

interface ProposerVMPreflightCardProps {
  /** P-Chain txID whose inclusion height the delivery chain's epoch must cover. */
  requiredTxId?: string | null;
  onAdvanced?: () => void;
}

/** Full cb58 txID only: the wired inputs are controlled fields, so anything
 *  shorter is a keystroke in progress and must not hit Glacier. */
const P_CHAIN_TXID_SHAPE = /^[1-9A-HJ-NP-Za-km-z]{40,60}$/;

function formatHeight(height: bigint | null): string {
  return height === null ? 'unknown' : Number(height).toLocaleString('en-US');
}

/**
 * Advisory staleness check rendered above a warp-delivery action. Warns when
 * the selected chain's epoch pins a P-Chain height below the one the pending
 * delivery needs, and offers one-click block production. Never blocks or
 * disables the host step's own buttons: the check can be wrong in the
 * user's favor (gateway RPCs hide the epoch) and delivery is always allowed.
 */
export function ProposerVMPreflightCard({ requiredTxId, onAdvanced }: ProposerVMPreflightCardProps) {
  const isTestnet = useWalletStore((s) => s.isTestnet);
  const selectedL1 = useSelectedL1();
  const [resolved, setResolved] = useState<{ txId: string; height: bigint | null } | null>(null);

  const isCChain = selectedL1 ? C_CHAIN_EVM_IDS.includes(selectedL1.evmChainId) : false;
  const validTxId = requiredTxId && P_CHAIN_TXID_SHAPE.test(requiredTxId) ? requiredTxId : null;
  const active = !isCChain && validTxId !== null;

  useEffect(() => {
    if (!active || !validTxId) return;
    let cancelled = false;
    void getPChainTxBlockHeight(validTxId, isTestnet ? 'testnet' : 'mainnet').then((height) => {
      if (!cancelled) setResolved({ txId: validTxId, height });
    });
    return () => {
      cancelled = true;
    };
  }, [active, validTxId, isTestnet]);

  const target = resolved && resolved.txId === validTxId ? resolved.height : null;
  const resolvingTarget = active && resolved?.txId !== validTxId;

  const status = useProposerVMStatus({ requiredHeight: target, enabled: active });
  const advance = useAdvanceProposerVM({ status, requiredHeight: target, onAdvanced });

  // Hide only while idle: mid-run refreshes flip isLoading and must not
  // unmount the progress line and its Cancel control.
  if (!active || resolvingTarget || (status.isLoading && advance.phase === 'idle')) return null;

  // With a resolved target this is exact; without one (Glacier lag or
  // unknown tx) computeEpochStatus falls back to its idle-chain heuristic,
  // so a healthy chain stays quiet instead of flashing a false hint.
  const state = status.status.state;
  const isRunning = RUNNING_PHASES.includes(advance.phase);

  // Quietly out of the way when the epoch covers the requirement (or the
  // chain is producing normally and no requirement could be resolved).
  if (state === 'satisfied' && advance.phase === 'idle') return null;

  if (state === 'unknown') {
    // Epoch unreadable through this RPC. Worth one neutral line only when
    // the user gave us a concrete requirement we could not check; otherwise
    // stay silent and let the delivery's own error path link the tool.
    if (target === null) return null;
    return (
      <Alert variant="info">
        <span>
          Could not verify this chain&apos;s P-Chain view: its RPC does not expose the epoch state. If the delivery
          below fails warp verification, produce blocks with the{' '}
          <Link href="/console/layer-1/advance-pchain-view" className="underline">
            Advance P-Chain View
          </Link>{' '}
          tool and retry.
        </span>
      </Alert>
    );
  }

  if (advance.phase === 'done') {
    return (
      <Alert variant="success">
        The chain&apos;s view advanced: the epoch now pins P-Chain height{' '}
        {formatHeight(status.epoch?.pChainHeight ?? null)}. Run the action below again.
      </Alert>
    );
  }

  if (advance.phase === 'gave-up') {
    return (
      <Alert variant="warning">
        <span>
          Sent {advance.maxAttempts} block-producing transactions and the epoch still pins{' '}
          {formatHeight(status.epoch?.pChainHeight ?? null)}, below {formatHeight(target)}. The view did advance, so try
          the action below anyway, or continue in the{' '}
          <Link href="/console/layer-1/advance-pchain-view" className="underline">
            Advance P-Chain View
          </Link>{' '}
          tool.
        </span>
      </Alert>
    );
  }

  return (
    <Alert variant="warning">
      <div className="space-y-2">
        <span>
          <strong>This chain&apos;s P-Chain view is stale.</strong>{' '}
          {target !== null ? (
            <>
              Its epoch pins height {formatHeight(status.epoch?.pChainHeight ?? null)}, but your transaction landed at
              height {formatHeight(target)}, so delivering its warp message will fail verification until the chain
              produces blocks.
            </>
          ) : (
            <>
              The chain looks idle: its epoch pins height {formatHeight(status.epoch?.pChainHeight ?? null)} while the
              P-Chain is at {formatHeight(status.liveHeight)}. Warp delivery may fail verification until the chain
              produces blocks.
            </>
          )}{' '}
          This does not affect signature aggregation, only delivery.
        </span>

        {isRunning ? (
          <div className="flex items-center gap-2 text-sm">
            <Loader2 className="w-4 h-4 animate-spin shrink-0" />
            {advance.phase === 'countdown' && advance.countdownSecRemaining !== null
              ? `The current epoch opened less than 5 minutes ago; sending in ${Math.floor(advance.countdownSecRemaining / 60)}:${String(advance.countdownSecRemaining % 60).padStart(2, '0')}.`
              : `Producing blocks (transaction ${Math.max(advance.attempt, 1)} of ${advance.maxAttempts}).`}
            <Button variant="outline" size="sm" onClick={advance.cancel}>
              Cancel
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-3 flex-wrap">
            <Button variant="primary" size="sm" onClick={advance.start} icon={<FastForward className="w-4 h-4" />}>
              Produce blocks ({'≈'}2 transactions)
            </Button>
            <Link href="/docs/nodes/architecture/proposervm" className="text-xs underline" target="_blank">
              Why this happens
            </Link>
          </div>
        )}

        {advance.phase === 'error' && advance.error && <span className="text-sm block">{advance.error}</span>}
      </div>
    </Alert>
  );
}
