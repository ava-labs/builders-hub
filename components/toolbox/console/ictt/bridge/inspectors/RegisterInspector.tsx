'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ArrowRight, Check, ExternalLink, Loader2, RefreshCw } from 'lucide-react';
import { Note } from '@/components/toolbox/components/Note';
import { useL1ByChainId } from '@/components/toolbox/stores/l1ListStore';
import { InspectorShell } from './InspectorShell';
import { useRegisterRemote } from '../hooks/useRegisterRemote';
import { buildTxUrl, truncateAddress } from '../utils/explorer-url';
import type { Address, Bridge, BridgePhase, BridgeStatus, Remote } from '../types';

interface RegisterInspectorProps {
  onPhaseChange: (next: BridgePhase) => void;
  status: BridgeStatus;
  bridge: Bridge | null;
  remote: Remote | null;
}

export function RegisterInspector({ onPhaseChange, status, bridge, remote }: RegisterInspectorProps) {
  const remoteL1 = useL1ByChainId(remote?.l1Id ?? '');
  const homeL1 = useL1ByChainId(bridge?.homeL1Id ?? '');
  const { sendRegister, isRegistering, error, lastTxHash } = useRegisterRemote({
    bridgeId: bridge?.id as Bridge['id'],
    remote,
  });
  const [submittedTx, setSubmittedTx] = useState<Address | null>(null);

  const txUrl = buildTxUrl(remoteL1, submittedTx ?? lastTxHash ?? null);

  const handleRegister = async () => {
    const result = await sendRegister();
    if (result) {
      setSubmittedTx(result.txHash);
      // Auto-advance only if remote was previously unregistered.
      if (!remote?.registeredAt) onPhaseChange('collateral');
    }
  };

  return (
    <InspectorShell
      phase="register"
      status={status}
      onPhaseChange={onPhaseChange}
      description={`Send a single tx on ${remoteL1?.name ?? 'Remote'} that asks ${homeL1?.name ?? 'Home'} to register this Remote. The relayer carries it across.`}
      banner={
        !remote?.address && (
          <Note variant="warning">
            <span className="text-xs">Deploy a TokenRemote in Phase 3 first.</span>
          </Note>
        )
      }
      footer={
        <>
          {remote?.registeredAt && (
            <button
              type="button"
              onClick={() => onPhaseChange('collateral')}
              className="inline-flex items-center gap-1 rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
            >
              Continue to Collateral
              <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </button>
          )}
          <button
            type="button"
            onClick={handleRegister}
            disabled={!remote?.address || isRegistering}
            className="inline-flex items-center gap-1 rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
          >
            {isRegistering ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" aria-hidden />
            )}
            {remote?.registeredAt ? 'Re-send registration' : 'Register Remote'}
          </button>
        </>
      }
    >
      <ol className="flex flex-col gap-2 text-sm">
        <TrackerRow
          index={1}
          label={`Submit tx on ${remoteL1?.name ?? 'Remote'}`}
          state={submittedTx || lastTxHash ? 'complete' : isRegistering ? 'active' : 'idle'}
          detail={
            submittedTx || lastTxHash ? (
              <code className="font-mono text-[11px] text-zinc-700 dark:text-zinc-300">
                {truncateAddress((submittedTx ?? lastTxHash) as Address)}
              </code>
            ) : (
              'Calls registerWithHome on the Remote contract.'
            )
          }
          url={txUrl}
        />
        <TrackerRow
          index={2}
          label="ICM relays the message"
          state={remote?.registeredAt ? 'complete' : submittedTx || lastTxHash ? 'active' : 'idle'}
          detail="Wait ~10 seconds for the relayer to deliver the registration to Home."
        />
        <TrackerRow
          index={3}
          label={`${homeL1?.name ?? 'Home'} marks the Remote registered`}
          state={remote?.registeredAt ? 'complete' : 'idle'}
          detail={
            remote?.registeredAt
              ? `Registered at ${new Date(remote.registeredAt).toLocaleTimeString()}`
              : 'Status will flip once the Home contract receives the message.'
          }
        />
      </ol>

      {error && (
        <Note variant="destructive" className="mt-3">
          <span className="text-xs">{error.message}</span>
        </Note>
      )}

      <div className="mt-4 flex items-center justify-between gap-2 text-[11px] text-zinc-500 dark:text-zinc-400">
        <span>Need to inspect ICM messages?</span>
        <Link
          href="/console/ictt/legacy/setup/register-with-home"
          className="inline-flex items-center gap-1 hover:text-zinc-900 dark:hover:text-zinc-100"
        >
          Open registration in legacy
          <ExternalLink className="h-3 w-3" aria-hidden />
        </Link>
      </div>
    </InspectorShell>
  );
}

type RowState = 'idle' | 'active' | 'complete';

interface TrackerRowProps {
  index: number;
  label: string;
  state: RowState;
  detail: React.ReactNode;
  url?: string | null;
}

function TrackerRow({ index, label, state, detail, url }: TrackerRowProps) {
  const dotClass =
    state === 'complete'
      ? 'bg-emerald-500 text-white'
      : state === 'active'
        ? 'bg-amber-400 text-zinc-900 animate-pulse'
        : 'bg-zinc-200 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400';

  return (
    <li className="flex items-start gap-3 rounded-xl border border-zinc-200/80 bg-white px-3.5 py-2.5 dark:border-zinc-800 dark:bg-zinc-900">
      <span
        aria-hidden
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold ${dotClass}`}
      >
        {state === 'complete' ? <Check className="h-3 w-3" /> : index}
      </span>
      <div className="flex flex-1 flex-col gap-0.5">
        <span className="text-xs font-medium text-zinc-900 dark:text-zinc-100">{label}</span>
        <span className="text-[11px] text-zinc-500 dark:text-zinc-400">{detail}</span>
      </div>
      {url && (
        <Link
          href={url}
          target="_blank"
          rel="noreferrer"
          className="rounded p-1 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
          aria-label="Open transaction in explorer"
        >
          <ExternalLink className="h-3.5 w-3.5" aria-hidden />
        </Link>
      )}
    </li>
  );
}
