'use client';

import { Check, Circle, Loader2, LockKeyhole, Wallet } from 'lucide-react';

import {
  DEMO_RECIPIENT_ADDRESS,
  FAUCET_AMOUNT,
  FUJI_CHAIN_ID,
  TRANSFER_AMOUNT,
  formatTokenAmount,
  shortenIdentifier,
} from './demo';

export type DemoBusyAction = 'network' | 'derive' | 'faucet' | 'funding-check' | 'transfer' | 'activity' | null;

interface PrivateTransferProps {
  chainId: number | null;
  walletAddress: string | null;
  unlinkAddress: string | null;
  balance: string;
  fundingRequested: boolean;
  fundingComplete: boolean;
  transferSubmitted: boolean;
  transferComplete: boolean;
  busyAction: DemoBusyAction;
  statusMessage: string;
  error: string | null;
  onSwitchToFuji: () => void;
  onCreateAccount: () => void;
  onRequestFunding: () => void;
  onCheckFunding: () => void;
  onTransfer: () => void;
  onRefreshActivity: () => void;
}

type StepState = 'upcoming' | 'active' | 'complete';

function StepMarker({ number, state }: { number: number; state: StepState }) {
  if (state === 'complete') {
    return (
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white">
        <Check aria-hidden="true" className="h-4 w-4" />
        <span className="sr-only">Step {number} completed</span>
      </span>
    );
  }

  return (
    <span
      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold ${
        state === 'active'
          ? 'border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900'
          : 'border-zinc-300 text-zinc-500 dark:border-zinc-700 dark:text-zinc-400'
      }`}
    >
      {number}
    </span>
  );
}

function DemoStep({
  number,
  title,
  description,
  state,
}: {
  number: number;
  title: string;
  description: string;
  state: StepState;
}) {
  return (
    <li
      className={`flex gap-3 rounded-xl border p-4 ${
        state === 'active'
          ? 'border-zinc-400 bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800/60'
          : 'border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900'
      }`}
      aria-current={state === 'active' ? 'step' : undefined}
    >
      <StepMarker number={number} state={state} />
      <div className="min-w-0">
        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{title}</p>
        <p className="mt-1 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">{description}</p>
      </div>
    </li>
  );
}

const primaryButtonClass =
  'inline-flex min-h-11 w-full touch-manipulation items-center justify-center gap-2 rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white dark:focus-visible:ring-zinc-100 dark:focus-visible:ring-offset-zinc-900';

export function PrivateTransfer({
  chainId,
  walletAddress,
  unlinkAddress,
  balance,
  fundingRequested,
  fundingComplete,
  transferSubmitted,
  transferComplete,
  busyAction,
  statusMessage,
  error,
  onSwitchToFuji,
  onCreateAccount,
  onRequestFunding,
  onCheckFunding,
  onTransfer,
  onRefreshActivity,
}: PrivateTransferProps) {
  const onFuji = chainId === FUJI_CHAIN_ID;
  const accountReady = Boolean(unlinkAddress);
  const busy = busyAction !== null;

  const accountState: StepState = accountReady ? 'complete' : 'active';
  const fundingState: StepState = fundingComplete ? 'complete' : accountReady ? 'active' : 'upcoming';
  const transferState: StepState = transferComplete ? 'complete' : fundingComplete ? 'active' : 'upcoming';

  let actionLabel = 'Create Private Account';
  let action = onCreateAccount;
  if (!onFuji) {
    actionLabel = 'Switch to Avalanche Fuji';
    action = onSwitchToFuji;
  } else if (accountReady && !fundingComplete && !fundingRequested) {
    actionLabel = 'Request 10 Demo USDCm';
    action = onRequestFunding;
  } else if (accountReady && !fundingComplete && fundingRequested) {
    actionLabel = 'Check Private Balance';
    action = onCheckFunding;
  } else if (fundingComplete && !transferSubmitted) {
    actionLabel = 'Send 1 USDCm Privately';
    action = onTransfer;
  } else if (transferSubmitted && !transferComplete) {
    actionLabel = 'Check Transfer Status';
    action = onRefreshActivity;
  } else if (transferComplete) {
    actionLabel = 'Private Transfer Complete';
  }

  return (
    <section
      className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:p-6"
      aria-labelledby="unlink-private-transfer-title"
      aria-busy={busy}
    >
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
          <LockKeyhole aria-hidden="true" className="h-5 w-5" />
        </span>
        <div>
          <h2
            id="unlink-private-transfer-title"
            className="text-balance text-lg font-semibold text-zinc-900 dark:text-zinc-100"
          >
            Private Transfer
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
            Derive an Unlink account from your EOA wallet, fund it on Fuji, then send a fixed private transfer.
          </p>
        </div>
      </div>

      {!onFuji ? (
        <div
          className="mt-5 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200"
          role="alert"
        >
          This demo runs only on Avalanche Fuji (chain {FUJI_CHAIN_ID}). Your wallet is currently on{' '}
          {chainId ?? 'an unknown chain'}.
        </div>
      ) : null}

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-800/50">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            <Wallet aria-hidden="true" className="h-3.5 w-3.5" /> Connected wallet
          </div>
          <code
            className="mt-2 block text-xs text-zinc-800 dark:text-zinc-200"
            title={walletAddress ?? undefined}
            translate="no"
          >
            {walletAddress ? shortenIdentifier(walletAddress) : 'Connecting...'}
          </code>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-800/50">
          <div className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Private balance
          </div>
          <p className="mt-2 font-mono text-lg font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
            {formatTokenAmount(balance)} <span className="text-xs font-normal text-zinc-500">USDCm</span>
          </p>
        </div>
      </div>

      {unlinkAddress ? (
        <div className="mt-3 rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Your Unlink address
          </p>
          <code className="mt-2 block break-all text-xs text-zinc-800 dark:text-zinc-200" translate="no">
            {unlinkAddress}
          </code>
        </div>
      ) : null}

      <ol className="mt-5 grid gap-3">
        <DemoStep
          number={1}
          state={accountState}
          title="Create account"
          description="Approve one wallet signature in Builder Hub. The signature stays in your browser."
        />
        <DemoStep
          number={2}
          state={fundingState}
          title="Get demo funds"
          description={`Use an existing private balance, or request ${formatTokenAmount(FAUCET_AMOUNT)} demo USDCm from the Fuji faucet.`}
        />
        <DemoStep
          number={3}
          state={transferState}
          title="Transfer privately"
          description={`Send exactly ${formatTokenAmount(TRANSFER_AMOUNT)} USDCm to ${shortenIdentifier(DEMO_RECIPIENT_ADDRESS)}.`}
        />
      </ol>

      <p className="mt-3 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
        Fuji funding and private transfer processing can each take several minutes.
      </p>

      <div className="mt-5" aria-live="polite" aria-atomic="true">
        <p className="min-h-5 text-sm text-zinc-600 dark:text-zinc-300">{statusMessage}</p>
      </div>
      {error ? (
        <div
          className="mt-3 rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300"
          role="alert"
        >
          {error}
        </div>
      ) : null}

      <button
        type="button"
        className={`${primaryButtonClass} mt-5`}
        onClick={action}
        disabled={busy || transferComplete}
      >
        {busy ? (
          <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin motion-reduce:animate-none" />
        ) : transferComplete ? (
          <Check aria-hidden="true" className="h-4 w-4" />
        ) : (
          <Circle aria-hidden="true" className="h-3.5 w-3.5" />
        )}
        {busy ? 'Processing...' : actionLabel}
      </button>
    </section>
  );
}
