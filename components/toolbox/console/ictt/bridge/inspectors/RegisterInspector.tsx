'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ArrowRight, Check, ExternalLink, Loader2, RefreshCw } from 'lucide-react';
import { Note } from '@/components/toolbox/components/Note';
import { useL1ByChainId } from '@/components/toolbox/stores/l1ListStore';
import { ContractDeployViewer } from '@/components/console/contract-deploy-viewer';
import { ICTT_HOME_PLUS_REMOTE_SOURCES } from '@/lib/ictt/contractSources';
import { InspectorShell } from './InspectorShell';
import { useRegisterRemote } from '../hooks/useRegisterRemote';
import { buildTxUrl, truncateAddress } from '../utils/explorer-url';
import type { Address, Bridge, BridgePhase, Remote } from '../types';

interface RegisterInspectorProps {
  onPhaseChange: (next: BridgePhase) => void;
  bridge: Bridge | null;
  remote: Remote | null;
}

export function RegisterInspector({ onPhaseChange, bridge, remote }: RegisterInspectorProps) {
  const remoteL1 = useL1ByChainId(remote?.l1Id ?? '');
  const homeL1 = useL1ByChainId(bridge?.homeL1Id ?? '');
  const { sendRegister, isRegistering, error, lastTxHash, homePollState, pollAttempts, pollMaxAttempts } =
    useRegisterRemote({
      bridgeId: bridge?.id as Bridge['id'],
      remote,
      homeAddress: (bridge?.homeAddress ?? null) as Address | null,
      homeRpcUrl: homeL1?.rpcUrl ?? null,
    });
  const [submittedTx, setSubmittedTx] = useState<Address | null>(null);

  const txUrl = buildTxUrl(remoteL1, submittedTx ?? lastTxHash ?? null);
  const localTxConfirmed = Boolean(submittedTx || lastTxHash);
  const isDelivered = homePollState === 'delivered' || Boolean(remote?.registeredAt);
  const isPolling = homePollState === 'polling';
  const isTimeout = homePollState === 'timeout';

  const handleRegister = async () => {
    const result = await sendRegister();
    if (result) setSubmittedTx(result.txHash);
  };

  const rowTwoState: RowState = isDelivered ? 'complete' : isPolling ? 'active' : isTimeout ? 'error' : 'idle';
  const rowThreeState: RowState = isDelivered ? 'complete' : isTimeout ? 'error' : 'idle';

  const rowTwoDetail = isDelivered
    ? 'Relayer delivered the registration message to Home.'
    : isPolling
      ? `Waiting for delivery (${pollAttempts}/${pollMaxAttempts}). The relayer usually takes ~30 seconds on Fuji.`
      : isTimeout
        ? 'Timed out — re-send the registration below.'
        : 'Waits for the ICM relayer to carry the message.';

  const rowThreeDetail = isDelivered
    ? remote?.registeredAt
      ? `Registered at ${new Date(remote.registeredAt).toLocaleTimeString()}.`
      : 'Home contract confirmed registration.'
    : isTimeout
      ? 'No on-chain confirmation yet — re-send to retry.'
      : 'Status flips once the Home contract receives the message.';

  return (
    <ContractDeployViewer contracts={ICTT_HOME_PLUS_REMOTE_SOURCES}>
      <InspectorShell
        banner={
          !remote?.address && (
            <Note variant="warning">
              <span className="text-xs">Deploy a TokenRemote in Phase 3 first.</span>
            </Note>
          )
        }
        footer={
          <>
            {isDelivered && (
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
              disabled={!remote?.address || isRegistering || isPolling}
              className="inline-flex items-center gap-1 rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
            >
              {isRegistering || isPolling ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" aria-hidden />
              )}
              {isTimeout ? 'Re-send registration' : isDelivered ? 'Re-send registration' : 'Register Remote'}
            </button>
          </>
        }
      >
        <p className="mb-3 text-xs text-zinc-500 dark:text-zinc-400">
          Send a single transaction on {remoteL1?.name ?? 'the Remote chain'} that asks {homeL1?.name ?? 'Home'} to
          register this Remote. The relayer carries it across.
        </p>
        <ol className="flex flex-col gap-2 text-sm">
          <TrackerRow
            index={1}
            label={`Submit tx on ${remoteL1?.name ?? 'Remote'}`}
            state={localTxConfirmed ? 'complete' : isRegistering ? 'active' : 'idle'}
            detail={
              localTxConfirmed ? (
                <code className="font-mono text-[11px] text-zinc-700 dark:text-zinc-300">
                  {truncateAddress((submittedTx ?? lastTxHash) as Address)}
                </code>
              ) : (
                'Calls registerWithHome on the Remote contract.'
              )
            }
            url={txUrl}
          />
          <TrackerRow index={2} label="ICM relays the message" state={rowTwoState} detail={rowTwoDetail} />
          <TrackerRow
            index={3}
            label={`${homeL1?.name ?? 'Home'} marks the Remote registered`}
            state={rowThreeState}
            detail={rowThreeDetail}
          />
        </ol>

        {isTimeout && (
          <Note variant="warning" className="mt-3">
            <span className="text-xs">
              The relayer didn&apos;t deliver in {Math.round((pollMaxAttempts * 4) / 60)} minutes. Re-send the
              registration — the existing TokenRemote stays valid.
            </span>
          </Note>
        )}

        {error && (
          <Note variant="destructive" className="mt-3">
            <span className="text-xs">{error.message}</span>
          </Note>
        )}
      </InspectorShell>
    </ContractDeployViewer>
  );
}

type RowState = 'idle' | 'active' | 'complete' | 'error';

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
        : state === 'error'
          ? 'bg-red-500 text-white'
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
