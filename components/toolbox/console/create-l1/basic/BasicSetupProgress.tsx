'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, ArrowLeft, Check, Copy, ExternalLink } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useDeploymentStatus } from '@/hooks/useQuickL1Deploy';
import {
  DEPLOYMENT_STEPS,
  INTEROP_ONLY_STEPS,
  STEP_LABEL,
  type DeploymentStep,
  type TxRecord,
} from '@/lib/quick-l1/types';
import { cn } from '@/lib/utils';
import BasicSetupComplete from './BasicSetupComplete';

/**
 * Live deployment tracker — one step at a time, typeform-style.
 *
 * Design principles:
 *   - Whole thing fits in a single viewport. No scroll ever, even with
 *     14 steps (the stacked linear list approach guaranteed a scroll).
 *   - One focal point at a time: the current step gets the entire middle
 *     of the screen, with a big animated ring loader, title, status
 *     detail, and the latest tx for that step. Fades through AnimatePresence
 *     as the deploy advances.
 *   - A tiny progress dot strip at the bottom gives the overall picture
 *     without taking vertical space. Completed steps are green dots; the
 *     active one pulses; upcoming are muted.
 *   - The recap of everything that happened lives on the completion
 *     screen, where the user actually wants to sit and read.
 */
export default function BasicSetupProgress({ jobId }: { jobId: string }) {
  const router = useRouter();
  const { job, error } = useDeploymentStatus(jobId);

  // Hide interop steps when the user disabled interoperability — they
  // never run, so they'd be dead weight in the progress footer.
  const visibleSteps = useMemo<readonly DeploymentStep[]>(() => {
    const interopEnabled = job?.request.precompiles?.interoperability ?? true;
    return interopEnabled ? DEPLOYMENT_STEPS : DEPLOYMENT_STEPS.filter((s) => !INTEROP_ONLY_STEPS.includes(s));
  }, [job]);

  // Defer to the recap screen once the job finishes. Confetti lives there.
  if (job?.status === 'complete' && job.result) {
    return <BasicSetupComplete job={job} />;
  }

  const completedCount = Math.min(
    job?.completedSteps.filter((s) => visibleSteps.includes(s)).length ?? 0,
    visibleSteps.length,
  );
  const currentStep = job?.currentStep ?? visibleSteps[0];
  const currentIdx = Math.max(
    0,
    visibleSteps.findIndex((s) => s === currentStep),
  );
  const progressPct = Math.round((completedCount / visibleSteps.length) * 100);
  const failed = job?.status === 'failed';
  const currentEvidence = job?.evidence.find((e) => e.step === currentStep);
  const latestTx = currentEvidence?.txs[currentEvidence.txs.length - 1];

  return (
    <div className="mx-auto max-w-3xl h-full flex flex-col py-4 px-4">
      {/* Header row: back link + chain name + elapsed timer */}
      <div className="flex-shrink-0">
        <motion.button
          type="button"
          onClick={() => router.push('/console/create-l1')}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          whileHover={{ x: -2 }}
          className="mb-3 inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </motion.button>

        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="flex items-start justify-between gap-4"
        >
          <div className="min-w-0">
            <div
              className={cn(
                'text-[11px] font-semibold uppercase tracking-wider',
                failed ? 'text-red-500' : 'text-zinc-500 dark:text-zinc-400',
              )}
            >
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
      </div>

      {/* Focal content — flex-1 so it vertically centers in whatever
          space the header + footer leave behind. One step at a time,
          fades through AnimatePresence as the deploy advances. */}
      <div className="flex-1 min-h-0 flex items-center justify-center py-6">
        <AnimatePresence mode="wait">
          {failed ? (
            <FailureContent key="failed" message={job?.error ?? 'Unknown error'} />
          ) : (
            <motion.div
              key={currentStep ?? 'pending'}
              initial={{ opacity: 0, y: 14, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -14, scale: 0.97 }}
              transition={{ type: 'spring', stiffness: 240, damping: 26 }}
              className="flex flex-col items-center text-center max-w-md"
            >
              <Ring progress={progressPct} />

              <h2 className="mt-6 text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
                {currentStep ? STEP_LABEL[currentStep] : 'Getting ready…'}
              </h2>

              <AnimatePresence mode="wait">
                {job?.statusDetail && (
                  <motion.p
                    key={job.statusDetail}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.25 }}
                    className="mt-2 text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed"
                  >
                    {job.statusDetail}
                  </motion.p>
                )}
              </AnimatePresence>

              <AnimatePresence>
                {latestTx && (
                  <motion.div
                    key={latestTx.hash}
                    initial={{ opacity: 0, y: 8, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.97 }}
                    transition={{ delay: 0.1, type: 'spring', stiffness: 300, damping: 26 }}
                    className="mt-5 w-full"
                  >
                    <TxBadge tx={latestTx} />
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer — compact progress strip. Doesn't expand regardless of
          step count, and keeps a sense of "where am I in the whole thing". */}
      <div className="flex-shrink-0">
        <div className="mb-2 flex items-center justify-between text-[11px] text-zinc-500 dark:text-zinc-400 tabular-nums">
          <span>
            Step {Math.min(currentIdx + 1, visibleSteps.length)} of {visibleSteps.length}
          </span>
          <span className="font-mono">{progressPct}%</span>
        </div>
        <div className="flex items-center gap-[3px]">
          {visibleSteps.map((s, idx) => {
            const isCompleted = job?.completedSteps.includes(s) ?? false;
            const isActive = idx === currentIdx && !isCompleted;
            const state: DotState =
              failed && isActive ? 'failed' : isCompleted ? 'done' : isActive ? 'active' : 'pending';
            return <StepDot key={s} state={state} />;
          })}
        </div>
      </div>

      {error && !job && (
        <p className="mt-2 flex-shrink-0 text-center text-xs text-zinc-500 dark:text-zinc-400">
          Network hiccup fetching status — retrying automatically.
        </p>
      )}
    </div>
  );
}

// ─── Animated ring loader ──────────────────────────────────────────
// SVG conic-ish progress ring: dim base circle + primary-colored arc
// that fills as `progress` climbs from 0..100. A small dot orbits the
// ring constantly as a "heartbeat" so the UI feels alive even when
// progress is stalled between steps.

function Ring({ progress }: { progress: number }) {
  const R = 44;
  const C = 2 * Math.PI * R;
  const clamped = Math.max(0, Math.min(100, progress));
  const dashOffset = C * (1 - clamped / 100);
  return (
    <div className="relative h-28 w-28">
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
        {/* Base dim ring */}
        <circle
          cx="50"
          cy="50"
          r={R}
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          className="text-zinc-200 dark:text-zinc-800"
        />
        {/* Progress arc */}
        <motion.circle
          cx="50"
          cy="50"
          r={R}
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={C}
          initial={{ strokeDashoffset: C }}
          animate={{ strokeDashoffset: dashOffset }}
          transition={{ duration: 0.6, ease: 'easeInOut' }}
          className="text-primary"
        />
      </svg>
      {/* Orbiting heartbeat dot — pure CSS rotation so it always runs */}
      <motion.div
        className="pointer-events-none absolute inset-0"
        animate={{ rotate: 360 }}
        transition={{ duration: 2.2, repeat: Infinity, ease: 'linear' }}
        style={{ transformOrigin: 'center' }}
      >
        <span className="absolute left-1/2 top-0 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary shadow-[0_0_10px_rgba(59,130,246,0.6)]" />
      </motion.div>
      {/* Center label — percentage */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <span className="font-mono tabular-nums text-sm text-zinc-500 dark:text-zinc-400">{clamped}%</span>
      </div>
    </div>
  );
}

// ─── Progress dot strip ────────────────────────────────────────────

type DotState = 'pending' | 'active' | 'done' | 'failed';

function StepDot({ state }: { state: DotState }) {
  return (
    <span
      className={cn(
        'relative flex-1 h-1 rounded-full overflow-hidden transition-colors',
        state === 'done' && 'bg-emerald-500',
        state === 'active' && 'bg-zinc-900 dark:bg-white',
        state === 'pending' && 'bg-zinc-200 dark:bg-zinc-800',
        state === 'failed' && 'bg-red-500',
      )}
    >
      {state === 'active' && (
        <motion.span
          className="absolute inset-0 bg-zinc-600 dark:bg-zinc-300"
          initial={{ x: '-100%' }}
          animate={{ x: '100%' }}
          transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}
    </span>
  );
}

// ─── Failure state ─────────────────────────────────────────────────

function FailureContent({ message }: { message: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 240, damping: 26 }}
      className="flex flex-col items-center text-center max-w-md"
    >
      <div className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-red-500">
        <AlertCircle className="h-10 w-10 text-red-500" />
      </div>
      <h2 className="mt-6 text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">Deployment failed</h2>
      <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">{message}</p>
    </motion.div>
  );
}

// ─── Elapsed timer ─────────────────────────────────────────────────

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
    <div className="text-right shrink-0">
      <div className="text-[10px] font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Elapsed</div>
      <div className="mt-0.5 font-mono tabular-nums text-lg leading-none text-zinc-900 dark:text-zinc-100">
        {mm}:{ss}
      </div>
    </div>
  );
}

// ─── Single tx badge (current step's latest tx) ────────────────────

function chainDotClass(chain: TxRecord['chain']): string {
  return chain === 'p-chain' ? 'bg-blue-500' : chain === 'c-chain' ? 'bg-purple-500' : 'bg-red-500';
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

function TxBadge({ tx }: { tx: TxRecord }) {
  const [copied, setCopied] = useState(false);
  const url = explorerUrl(tx);

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
    <div className="inline-flex items-center gap-2 rounded-full border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 pl-2.5 pr-1 py-1 text-[11px] max-w-full">
      <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', chainDotClass(tx.chain))} />
      <span className="text-zinc-600 dark:text-zinc-300 shrink-0">{chainName(tx.chain)}</span>
      {tx.label && (
        <>
          <span className="text-zinc-300 dark:text-zinc-700 shrink-0">·</span>
          <span className="text-zinc-700 dark:text-zinc-200 shrink-0 font-medium">{tx.label}</span>
        </>
      )}
      <span className="text-zinc-300 dark:text-zinc-700 shrink-0">·</span>
      <code className="font-mono text-zinc-500 dark:text-zinc-400 truncate select-all max-w-[160px]">
        {tx.hash.length > 20 ? `${tx.hash.slice(0, 8)}…${tx.hash.slice(-6)}` : tx.hash}
      </code>
      <div className="shrink-0 flex items-center">
        <button
          type="button"
          onClick={onCopy}
          title="Copy hash"
          className="rounded-full p-1 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
        >
          {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
        </button>
        {url && (
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            title="Open in explorer"
            className="rounded-full p-1 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>
    </div>
  );
}
