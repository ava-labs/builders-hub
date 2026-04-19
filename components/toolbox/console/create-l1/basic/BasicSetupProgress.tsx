'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, ArrowLeft, Check, Copy, ExternalLink, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useDeploymentStatus } from '@/hooks/useQuickL1Deploy';
import { DEPLOYMENT_STEPS, STEP_LABEL, type DeploymentStep, type TxRecord } from '@/lib/quick-l1/types';
import { cn } from '@/lib/utils';
import BasicSetupComplete from './BasicSetupComplete';

/**
 * Live deployment tracker — refined for density and restraint.
 *
 * Design principles:
 *   - Show the whole flow in one viewport. No scrolling mid-deploy.
 *   - One color per job: primary accent for active, green only on the
 *     check icon for done, chain identity via 6px dots (no filled pills).
 *   - Each tx renders on one line where it fits — full hash, inline
 *     chain dot, inline actions. Wraps cleanly on narrow screens.
 *   - Step state is communicated structurally (icon + label weight), not
 *     with big "DONE" stamps or background fills.
 */
export default function BasicSetupProgress({ jobId }: { jobId: string }) {
  const router = useRouter();
  const { job, error } = useDeploymentStatus(jobId);

  const stepState = useMemo(() => {
    const map = new Map<DeploymentStep, 'done' | 'active' | 'pending'>();
    for (const s of DEPLOYMENT_STEPS) map.set(s, 'pending');
    if (job) {
      for (const s of job.completedSteps) map.set(s, 'done');
      if (job.status === 'complete') {
        for (const s of DEPLOYMENT_STEPS) map.set(s, 'done');
      } else if (job.currentStep && job.status === 'running') {
        map.set(job.currentStep, 'active');
      }
    }
    return map;
  }, [job]);

  const evidenceByStep = useMemo(() => {
    const m = new Map<DeploymentStep, TxRecord[]>();
    if (job) for (const e of job.evidence) m.set(e.step, e.txs);
    return m;
  }, [job]);

  // Defer to the Complete screen once the job is done. Confetti there.
  if (job?.status === 'complete' && job.result) {
    return <BasicSetupComplete job={job} />;
  }

  const completedCount = job?.completedSteps.length ?? 0;
  const totalSteps = DEPLOYMENT_STEPS.length;
  const progressPct = Math.min(100, Math.round((completedCount / totalSteps) * 100));
  const failed = job?.status === 'failed';

  return (
    <div className="mx-auto max-w-3xl py-8">
      {/* Back link */}
      <motion.button
        type="button"
        onClick={() => router.push('/console/create-l1')}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        whileHover={{ x: -2 }}
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </motion.button>

      {/* Hero — compact, title + timer inline */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="mb-5 flex items-start justify-between gap-4"
      >
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            {failed ? 'Deployment failed' : 'Deploying'}
          </div>
          <h1 className="mt-0.5 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100 truncate">
            {job?.request.chainName || 'Your L1'}
          </h1>
        </div>
        {job && (
          <ElapsedTimer startedAt={job.createdAt} running={job.status === 'running' || job.status === 'pending'} />
        )}
      </motion.div>

      {/* Progress bar — thin, one line of meta above */}
      <div className="mb-6">
        <div className="mb-1.5 flex items-center justify-between text-[11px] text-zinc-500 dark:text-zinc-400 tabular-nums">
          <span>
            {completedCount} of {totalSteps} steps
          </span>
          <span className="font-mono">{progressPct}%</span>
        </div>
        <div className="h-[3px] rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
          <motion.div
            className={cn('h-full rounded-full', failed ? 'bg-red-500' : 'bg-zinc-900 dark:bg-white')}
            initial={{ width: 0 }}
            animate={{ width: `${progressPct}%` }}
            transition={{ duration: 0.5, ease: 'easeInOut' }}
          />
        </div>
      </div>

      {/* Step list — tight vertical rhythm, no connector line */}
      <ol className="divide-y divide-zinc-100 dark:divide-zinc-900">
        {DEPLOYMENT_STEPS.map((step) => {
          const state = stepState.get(step)!;
          const txs = evidenceByStep.get(step) ?? [];
          return (
            <StepRow
              key={step}
              step={step}
              state={state}
              statusDetail={state === 'active' ? job?.statusDetail : undefined}
              txs={txs}
            />
          );
        })}
      </ol>

      {failed && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-6 rounded-md border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/20 p-3"
        >
          <div className="flex items-start gap-2 text-sm">
            <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
            <div>
              <div className="font-medium text-red-900 dark:text-red-200">Deployment error</div>
              <div className="mt-0.5 text-red-700 dark:text-red-300">{job?.error ?? 'Unknown error'}</div>
            </div>
          </div>
        </motion.div>
      )}

      {error && !job && (
        <p className="mt-4 text-center text-xs text-zinc-500 dark:text-zinc-400">
          Network hiccup fetching status — retrying automatically.
        </p>
      )}
    </div>
  );
}

/**
 * One row in the step list. Header is always one line (icon + label);
 * tx rows stack underneath, indented to align with the label so long
 * hashes sit in a clean column.
 */
function StepRow({
  step,
  state,
  statusDetail,
  txs,
}: {
  step: DeploymentStep;
  state: 'done' | 'active' | 'pending';
  statusDetail?: string;
  txs: TxRecord[];
}) {
  const isDone = state === 'done';
  const isActive = state === 'active';
  return (
    <motion.li
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 280, damping: 26 }}
      className="py-2.5"
    >
      <div className="flex items-center gap-2.5">
        <StepIcon state={state} />
        <h3
          className={cn(
            'text-sm leading-none transition-colors',
            isDone
              ? 'text-zinc-500 dark:text-zinc-400'
              : isActive
                ? 'text-zinc-900 dark:text-zinc-100 font-medium'
                : 'text-zinc-400 dark:text-zinc-600',
          )}
        >
          {STEP_LABEL[step]}
        </h3>
      </div>

      <AnimatePresence>
        {isActive && statusDetail && (
          <motion.p
            key={statusDetail}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="ml-[22px] mt-1 text-xs text-zinc-500 dark:text-zinc-400 overflow-hidden"
          >
            {statusDetail}
          </motion.p>
        )}
      </AnimatePresence>

      {txs.length > 0 && (
        <div className="ml-[22px] mt-1.5 space-y-1">
          {txs.map((tx) => (
            <TxLine key={tx.hash} tx={tx} />
          ))}
        </div>
      )}
    </motion.li>
  );
}

/** Status icon — 16px, minimal. Check is green-stroke only (no bg fill). */
function StepIcon({ state }: { state: 'done' | 'active' | 'pending' }) {
  if (state === 'done') {
    return (
      <motion.span
        initial={{ scale: 0.7 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 500, damping: 20 }}
        className="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full border border-green-500 text-green-500"
      >
        <Check className="h-2.5 w-2.5" strokeWidth={3.5} />
      </motion.span>
    );
  }
  if (state === 'active') {
    return <Loader2 className="h-4 w-4 flex-shrink-0 text-primary animate-spin" />;
  }
  return (
    <span className="h-4 w-4 flex-shrink-0 flex items-center justify-center">
      <span className="h-1.5 w-1.5 rounded-full bg-zinc-300 dark:bg-zinc-700" />
    </span>
  );
}

/** Compact live timer — no card, just a mono tabular figure. */
function ElapsedTimer({ startedAt, running }: { startedAt: string; running: boolean }) {
  const [elapsed, setElapsed] = useState(() => Math.max(0, Date.now() - new Date(startedAt).getTime()));
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!running) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    intervalRef.current = setInterval(() => {
      setElapsed(Math.max(0, Date.now() - new Date(startedAt).getTime()));
    }, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [running, startedAt]);

  const s = Math.floor(elapsed / 1000);
  const mm = String(Math.floor(s / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');

  return (
    <div className="text-right">
      <div className="text-[10px] font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Elapsed</div>
      <div className="mt-0.5 font-mono tabular-nums text-lg leading-none text-zinc-900 dark:text-zinc-100">
        {mm}:{ss}
      </div>
    </div>
  );
}

// ── Tx line ───────────────────────────────────────────────────────
// Subtle chain dots, inline label, full hash, always-visible actions.
// One line per tx where the viewport allows; wraps on narrow screens.

function chainDotClass(chain: TxRecord['chain']): string {
  switch (chain) {
    case 'p-chain':
      return 'bg-blue-500';
    case 'c-chain':
      return 'bg-purple-500';
    case 'l1':
      return 'bg-red-500';
  }
}

function chainName(chain: TxRecord['chain']): string {
  return chain === 'p-chain' ? 'P-Chain' : chain === 'c-chain' ? 'C-Chain' : 'L1';
}

function explorerUrl(tx: TxRecord): string | null {
  const base = tx.network === 'fuji' ? 'https://subnets-test.avax.network' : 'https://subnets.avax.network';
  if (tx.chain === 'p-chain') return `${base}/p-chain/tx/${tx.hash}`;
  if (tx.chain === 'c-chain') return `${base}/c-chain/tx/${tx.hash}`;
  return null;
}

function TxLine({ tx }: { tx: TxRecord }) {
  const url = explorerUrl(tx);
  const [copied, setCopied] = useState(false);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(tx.hash);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-[11px] leading-relaxed">
      {/* Chain dot + name — muted */}
      <span className="inline-flex items-center gap-1.5 text-zinc-500 dark:text-zinc-400">
        <span className={cn('h-1.5 w-1.5 rounded-full', chainDotClass(tx.chain))} />
        {chainName(tx.chain)}
      </span>
      {tx.label && (
        <>
          <span className="text-zinc-300 dark:text-zinc-700">·</span>
          <span className="text-zinc-600 dark:text-zinc-300">{tx.label}</span>
        </>
      )}
      <span className="text-zinc-300 dark:text-zinc-700">·</span>
      <code className="font-mono text-[11px] text-zinc-500 dark:text-zinc-400 break-all select-all">{tx.hash}</code>
      <div className="ml-auto inline-flex items-center gap-0.5">
        <button
          type="button"
          onClick={onCopy}
          title="Copy hash"
          className="rounded p-1 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
        >
          {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
        </button>
        {url && (
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            title="View on Subnets Explorer"
            className="rounded p-1 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>
    </div>
  );
}
