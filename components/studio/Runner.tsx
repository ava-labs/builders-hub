'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Check, CircleAlert, ExternalLink, Loader2, Minus, Play, Square } from 'lucide-react';
import { Board, BoardHeader, EmptyRow, HashChip, MUTED, idInk } from '@/components/explorer-v2/ui';
import { cn } from '@/lib/utils';
import { L1_BLUEPRINT, api, errorText, type NextAction } from './api';
import { syncDeployedRegistry, syncLaunchedL1 } from './console-sync';
import { WalletPicker } from '@/components/console-wallets/WalletPicker';
import { studioSignerScope, useDeployRunner } from './useDeployRunner';
import { Button, LABEL, Notice, Pill, STATUS_TONE, shortId } from './ui';

function ActionLink({ href, children }: { href: string; children: React.ReactNode }) {
  const cls = cn('inline-flex items-center gap-1 font-mono text-[11px] underline-offset-2 hover:underline', idInk);
  return href.startsWith('/') ? (
    <Link href={href} className={cls}>
      {children}
    </Link>
  ) : (
    <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>
      {children} <ExternalLink className="h-3 w-3" />
    </a>
  );
}

function StepMarker({ status, current }: { status?: string; current: boolean }) {
  if (status === 'done') return <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />;
  if (status === 'skipped') return <Minus className="h-3.5 w-3.5 text-zinc-400" />;
  if (status === 'failed') return <CircleAlert className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />;
  if (current) return <span className="h-2 w-2 bg-[#E6212F]" />;
  return <span className="h-2 w-2 border border-zinc-300 dark:border-zinc-700" />;
}

type JobTx = { label: string | null; chain: string; hash: string; url: string | null };
type JobStep = { label: string; status: 'done' | 'current' | 'pending' | 'failed'; txs?: JobTx[] };

const CHAIN_TAG: Record<string, string> = { 'p-chain': 'P', 'c-chain': 'C', l1: 'L1' };

function TxLine({ tx }: { tx: JobTx }) {
  return (
    <span className="flex min-w-0 items-center gap-2 font-mono text-[10.5px] text-zinc-500 dark:text-zinc-400">
      <span className="w-5 shrink-0 text-zinc-400">{CHAIN_TAG[tx.chain] ?? tx.chain}</span>
      {tx.url ? (
        <Link href={tx.url} className={cn(idInk, 'shrink-0')} title={tx.hash}>
          {shortId(tx.hash, 10, 8)}
        </Link>
      ) : (
        <span className="shrink-0" title={tx.hash}>
          {shortId(tx.hash, 10, 8)}
        </span>
      )}
      {tx.label && <span className="min-w-0 truncate">{tx.label}</span>}
    </span>
  );
}

/** A platform job's own steps, marked the way the deploy steps are, each with the transactions it signed. */
function JobSteps({ steps }: { steps: JobStep[] }) {
  return (
    <span className="flex flex-col gap-1">
      {steps.map((s) => (
        <span key={s.label} className="flex flex-col gap-0.5">
          <span
            className={cn(
              'flex items-center gap-2 font-mono text-[11px]',
              s.status === 'pending'
                ? 'text-zinc-400 dark:text-zinc-500'
                : s.status === 'failed'
                  ? 'text-red-600 dark:text-red-400'
                  : 'text-zinc-700 dark:text-zinc-300',
            )}
          >
            <span className="flex w-4 shrink-0 justify-center">
              {s.status === 'current' ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <StepMarker status={s.status} current={false} />
              )}
            </span>
            {s.label}
          </span>
          {s.txs && s.txs.length > 0 && (
            <span className="flex flex-col gap-0.5 pl-6">
              {s.txs.map((tx) => (
                <TxLine key={tx.hash} tx={tx} />
              ))}
            </span>
          )}
        </span>
      ))}
    </span>
  );
}

/** Folded when everything finished, open when something didn't. */
function JobStepsSummary({ steps }: { steps: JobStep[] }) {
  const done = steps.filter((s) => s.status === 'done').length;
  return (
    <details className="group" open={done < steps.length}>
      <summary className={cn(LABEL, 'cursor-pointer select-none')}>
        Launch steps · {done} of {steps.length} done
      </summary>
      <div className="mt-2">
        <JobSteps steps={steps} />
      </div>
    </details>
  );
}

function ActionCard({
  action,
  busy,
  silent,
  onConfirm,
  onSkip,
  onConfirmProduction,
}: {
  action: NextAction | null;
  busy: boolean;
  /** A Console wallet signs, so there is no wallet popup to confirm. */
  silent: boolean;
  onConfirm: (stepId: string) => void;
  onSkip: (stepId: string) => void;
  onConfirmProduction: () => void;
}) {
  if (!action) return null;
  switch (action.kind) {
    case 'tx':
      return busy ? (
        <Notice>
          {silent ? `Your Console wallet is signing “${action.title}”.` : `Confirm “${action.title}” in your wallet.`}{' '}
          The server checks the transaction on-chain before recording it.
        </Notice>
      ) : null;
    case 'pending':
      return <Notice>Waiting for “{action.title}” to be mined…</Notice>;
    case 'wait':
      return (
        <Notice>
          <span className="flex flex-col gap-3">
            <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
              {busy && !action.progress && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              <span>
                <span className="font-medium">{action.title}: </span>
                {action.detail}
              </span>
              {action.link && <ActionLink href={action.link}>Track it</ActionLink>}
            </span>
            {action.progress && <JobSteps steps={action.progress} />}
          </span>
        </Notice>
      );
    case 'manual':
      return (
        <Notice tone="warn">
          <div className="flex flex-col gap-2">
            <span className="font-medium">{action.title}</span>
            <span>{action.detail}</span>
            <div className="flex flex-wrap items-center gap-3">
              {action.link && <ActionLink href={action.link}>Open</ActionLink>}
              {action.canConfirm && (
                <Button variant="secondary" onClick={() => onConfirm(action.stepId)}>
                  Mark as done
                </Button>
              )}
              {action.canSkip && (
                <Button variant="ghost" onClick={() => onSkip(action.stepId)}>
                  Skip optional step
                </Button>
              )}
            </div>
          </div>
        </Notice>
      );
    case 'blocked':
      return (
        <Notice tone="bad">
          <div className="flex flex-col gap-2">
            <span className="font-medium">{action.title} cannot run yet</span>
            <span>{action.detail}</span>
            {action.canSkip && (
              <Button variant="ghost" onClick={() => onSkip(action.stepId)}>
                Skip optional step
              </Button>
            )}
          </div>
        </Notice>
      );
    case 'confirm-production':
      return (
        <div className="flex flex-col gap-3 border border-zinc-900 p-4 dark:border-zinc-100">
          <span className={LABEL}>Production transaction · {action.network}</span>
          <span className="text-[14px] font-medium text-zinc-900 dark:text-zinc-50">{action.title}</span>
          <pre className="overflow-x-auto bg-zinc-50 p-3 font-mono text-[11px] text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
            {`${action.display.contract}${action.display.function ? `.${action.display.function}` : ' (deploy)'}(${action.display.args.map((a) => JSON.stringify(a)).join(', ')})${
              action.request.value !== '0' ? `\nvalue: ${action.request.value} wei` : ''
            }${action.request.to ? `\nto: ${action.request.to}` : ''}`}
          </pre>
          <div>
            <Button onClick={onConfirmProduction} busy={busy}>
              Confirm and sign
            </Button>
          </div>
        </div>
      );
    case 'done':
      return <Notice tone={action.status === 'succeeded' ? 'good' : 'bad'}>Deployment {action.status}.</Notice>;
  }
}

/**
 * Steps one deployment. `autoStart` runs it without a click; it also picks a
 * run back up after the panel remounts, e.g. when the builder switches tabs
 * during an L1 launch.
 */
export function Runner({
  projectId,
  deploymentId,
  autoStart,
  onChanged,
  onFinishSetup,
}: {
  projectId: string;
  deploymentId: string;
  autoStart: boolean;
  onChanged: () => void;
  /** Plans what a launch that stopped early left undone. */
  onFinishSetup?: () => Promise<void>;
}) {
  const runner = useDeployRunner(projectId, deploymentId, onChanged);
  const { view } = runner;
  const started = useRef(false);
  const [addedToConsole, setAddedToConsole] = useState<{ name: string; relayer: boolean } | null>(null);
  const [registrySaved, setRegistrySaved] = useState<string | null>(null);
  const [nodesAdded, setNodesAdded] = useState(0);
  const nodesChecked = useRef(false);
  const [finishing, setFinishing] = useState(false);
  const [finishError, setFinishError] = useState<string | null>(null);

  // Launches bound before Studio registered nodes itself still get them listed under Testnet Nodes.
  useEffect(() => {
    if (view?.status !== 'succeeded' || view.blueprintId !== L1_BLUEPRINT || nodesChecked.current) return;
    nodesChecked.current = true;
    api<{ added: number }>(`/api/studio/projects/${projectId}/deployments/${deploymentId}/nodes`, { method: 'POST' })
      .then((r) => setNodesAdded(r.added))
      .catch(() => {});
  }, [view?.status, view?.blueprintId, projectId, deploymentId]);

  useEffect(() => {
    if (!view) return;
    const synced = syncLaunchedL1(view);
    if (synced?.added) setAddedToConsole(synced);
    const registry = syncDeployedRegistry(view);
    if (registry) setRegistrySaved(registry.name);
  }, [view]);

  useEffect(() => {
    if (
      autoStart &&
      (view?.status === 'proposed' || view?.status === 'running') &&
      runner.address &&
      !started.current
    ) {
      started.current = true;
      void runner.run({ continuous: true });
    }
  }, [autoStart, runner, view?.status]);

  if (!view) {
    return runner.error ? <Notice tone="bad">{runner.error}</Notice> : <EmptyRow>Loading deployment…</EmptyRow>;
  }
  const finished = ['succeeded', 'failed', 'cancelled'].includes(view.status);
  const currentId = view.steps.find((s) => s.state?.status !== 'done' && s.state?.status !== 'skipped')?.id;
  const production = view.stage === 'production';
  // A launch Studio kept after the service stopped: done as a step, but with its own steps left over.
  const unfinished =
    view.status === 'succeeded'
      ? view.steps.flatMap((s) =>
          s.state?.warning ? (s.state.progress ?? []).filter((p) => p.status !== 'done').map((p) => p.label) : [],
        )
      : [];
  const finishSetup = async () => {
    if (!onFinishSetup) return;
    setFinishing(true);
    setFinishError(null);
    try {
      await onFinishSetup();
    } catch (e) {
      setFinishError(errorText(e));
    } finally {
      setFinishing(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <Board>
        <BoardHeader
          label={`${view.blueprintId ?? 'deployment'} · ${view.id.slice(0, 8)}`}
          action={
            <span className="flex items-center gap-2">
              <Pill tone={production ? 'prod' : 'neutral'}>{view.stage}</Pill>
              <Pill tone={STATUS_TONE[view.status] ?? 'neutral'}>{view.status}</Pill>
            </span>
          }
        />
        {view.steps.map((step, i) => (
          <div key={step.id} className={cn(step.id === currentId && !finished && 'bg-zinc-50 dark:bg-zinc-900/60')}>
            <div className="flex items-center gap-3 px-5 py-2.5 md:px-6">
              <span className="w-5 shrink-0 font-mono text-[10px] text-zinc-400">{String(i + 1).padStart(2, '0')}</span>
              <span className="flex w-4 shrink-0 justify-center">
                <StepMarker status={step.state?.status} current={step.id === currentId && !finished} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] text-zinc-900 dark:text-zinc-50">
                  {step.title}
                  {step.optional && (
                    <span className="ml-2 font-mono text-[10px] uppercase text-zinc-400">optional</span>
                  )}
                </span>
                <span className={cn(MUTED, 'block truncate text-[11px]')}>
                  {step.kind} · {step.network}
                  {step.state?.reason ? ` · skipped: ${step.state.reason}` : ''}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-3">
                {step.state?.address && (
                  <HashChip value={step.state.address} href={step.addressUrl ?? undefined} len={6} />
                )}
                {step.txUrl && (
                  <a
                    href={step.txUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn('font-mono text-[11px]', idInk)}
                  >
                    tx
                  </a>
                )}
              </span>
            </div>
            {(step.state?.error || step.state?.warning) && (
              <div className="pb-3 pl-[4.25rem] pr-5 md:pr-6">
                <Notice tone={step.state.error ? 'bad' : 'warn'}>{step.state.error ?? step.state.warning}</Notice>
              </div>
            )}
            {step.state?.progress && step.state.progress.length > 0 && (
              <div className="pb-3 pl-[4.25rem] pr-5 md:pr-6">
                <JobStepsSummary steps={step.state.progress} />
              </div>
            )}
            {step.state?.evidence &&
              step.state.evidence.length > 0 &&
              !step.state.progress?.some((s) => s.txs?.length) && (
                <div className="flex flex-col gap-1 pb-3 pl-[4.25rem] pr-5 md:pr-6">
                  <span className={LABEL}>Signed by the Quick L1 service</span>
                  {step.state.evidence.map((tx) => (
                    <TxLine key={tx.hash} tx={tx} />
                  ))}
                </div>
              )}
          </div>
        ))}
      </Board>

      {unfinished.length > 0 ? (
        <Notice tone="warn">
          <span className="flex flex-col gap-2">
            <span className="font-medium">
              Your L1 is live, but the launch stopped before {unfinished.length} of its steps
            </span>
            <span>
              Not done: {unfinished.join(', ')}. Quick L1 can&apos;t resume a job, so Studio finishes what the L1 needs
              for ICM: your wallet deploys the ICM registry, then Studio checks for a relayer that serves the L1 and the
              C-Chain. The demo MockUSDC bridge isn&apos;t redone; the ICTT bridge blueprint sets one up for your own
              token.
            </span>
            {onFinishSetup && (
              <span>
                <Button busy={finishing} onClick={() => void finishSetup()}>
                  Finish the remaining steps
                </Button>
              </span>
            )}
            {finishError && <span className="text-red-600 dark:text-red-400">{finishError}</span>}
          </span>
        </Notice>
      ) : (
        <ActionCard
          action={runner.action}
          busy={runner.busy}
          silent={runner.wallet.signer?.kind === 'console'}
          onConfirm={(id) => void runner.confirmManual(id)}
          onSkip={(id) => void runner.skip(id, 'Skipped by the builder')}
          onConfirmProduction={() => void runner.run({ continuous: false, confirmProduction: true })}
        />
      )}
      {runner.error && <Notice tone="bad">{runner.error}</Notice>}
      {nodesAdded > 0 && (
        <Notice tone="good">
          Added {nodesAdded === 1 ? 'its validator node' : `its ${nodesAdded} validator nodes`} to{' '}
          <Link href="/console/testnet-infra/nodes" className={idInk}>
            Testnet Nodes
          </Link>
          .
        </Notice>
      )}
      {addedToConsole && (
        <Notice tone="good">
          Added {addedToConsole.name} to your console: it&apos;s in the chain switcher,{' '}
          <Link href="/console/my-l1" className={idInk}>
            My L1
          </Link>{' '}
          and the ICM and ICTT tools. Its managed node appears under{' '}
          <Link href="/console/testnet-infra/nodes" className={idInk}>
            Testnet Nodes
          </Link>
          {addedToConsole.relayer && (
            <>
              {' '}
              and its relayer under{' '}
              <Link href="/console/testnet-infra/icm-relayer" className={idInk}>
                ICM Relayer
              </Link>
            </>
          )}
          .
        </Notice>
      )}

      {registrySaved && (
        <Notice tone="good">
          The registry is saved to {registrySaved} in your console, so the ICM and ICTT tools open with it.
        </Notice>
      )}

      {!finished && runner.wallet.ready && runner.wallet.needs && (
        <Board>
          <BoardHeader label="Signing wallet" action={<Pill tone="warn">needed</Pill>} />
          <div className="px-5 py-4 md:px-6">
            <WalletPicker scope={studioSignerScope(projectId)} pinnedAddress={view.signer} />
          </div>
        </Board>
      )}

      {!finished && (
        <div className="flex flex-wrap items-center gap-3">
          {runner.busy ? (
            <Button variant="secondary" onClick={runner.stop}>
              <Square className="h-3 w-3" /> Pause
            </Button>
          ) : (
            <Button onClick={() => void runner.run({ continuous: !production })} disabled={!runner.wallet.signer}>
              <Play className="h-3.5 w-3.5" />{' '}
              {view.status === 'proposed'
                ? production
                  ? 'Start production deployment'
                  : 'Deploy to testnet'
                : 'Continue'}
            </Button>
          )}
          <Button variant="ghost" onClick={() => void runner.cancel()} disabled={runner.busy}>
            Cancel deployment
          </Button>
          <span className={cn(MUTED, 'text-[11px]')}>
            {runner.wallet.signer
              ? runner.wallet.signer.kind === 'console'
                ? `Signing with ${runner.wallet.wallet?.label ?? 'your Console wallet'} ${shortId(runner.wallet.signer.address)}, no popups`
                : `Signing with your browser wallet ${shortId(runner.wallet.signer.address)}`
              : runner.wallet.needs === 'unlock'
                ? 'Unlock the signing wallet above to continue'
                : 'Set up the signing wallet above to continue'}
          </span>
        </div>
      )}

      {view.checks.length > 0 && (
        <Board>
          <BoardHeader label="Checks" />
          {view.checks.map((c, i) => (
            <div key={`${c.after}-${i}`} className="flex items-start gap-3 px-5 py-2.5 md:px-6">
              {c.passed ? (
                <Check className="mt-0.5 h-3.5 w-3.5 text-emerald-600" />
              ) : (
                <CircleAlert className="mt-0.5 h-3.5 w-3.5 text-red-600" />
              )}
              <span className="min-w-0 flex-1 text-[13px] text-zinc-800 dark:text-zinc-200">
                {c.description}
                {!c.passed && (
                  <span className={cn(MUTED, 'block text-[11px]')}>{c.error ?? `got ${JSON.stringify(c.actual)}`}</span>
                )}
              </span>
            </div>
          ))}
        </Board>
      )}
    </div>
  );
}
