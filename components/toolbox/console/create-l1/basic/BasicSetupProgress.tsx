'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, ArrowLeft, Check, ExternalLink } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useDeploymentStatus } from '@/hooks/useQuickL1Deploy';
import {
  DEPLOYMENT_STEPS,
  ERC20_POS_ONLY_STEPS,
  MANAGED_RELAYER_ONLY_STEPS,
  STEP_LABEL,
  type DeploymentStep,
  type TxRecord,
} from '@/lib/quick-l1/types';
import { cn } from '@/lib/utils';
import BasicSetupComplete from './BasicSetupComplete';
import { AvaxGame } from './AvaxGame';
import { AvaxLoader } from './AvaxLoader';

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

  // Only show steps the orchestrator will actually run. Two conditional
  // bundles to filter out:
  //   - MANAGED_RELAYER_ONLY_STEPS: gated on `enableManagedRelayer`,
  //     not on the Warp precompile alone (a user can have interop on
  //     for on-chain messaging but skip the managed relayer).
  //   - ERC20_POS_ONLY_STEPS: gated on `validatorMode.type === 'erc20-pos'`.
  //     PoA deploys never deploy the staking ERC20/reward calc/staking
  //     manager, so showing `configuring-erc20-pos` would be a lie.
  const visibleSteps = useMemo<readonly DeploymentStep[]>(() => {
    const managedRelayerOn = job?.request.enableManagedRelayer ?? false;
    const erc20PosOn = job?.request.validatorMode?.type === 'erc20-pos';
    return DEPLOYMENT_STEPS.filter((s) => {
      if (!managedRelayerOn && MANAGED_RELAYER_ONLY_STEPS.includes(s)) return false;
      if (!erc20PosOn && ERC20_POS_ONLY_STEPS.includes(s)) return false;
      return true;
    });
  }, [job]);

  // Defer to the recap screen once the job finishes. Confetti lives there.
  if (job?.status === 'complete' && job.result) {
    return <BasicSetupComplete job={job} />;
  }

  const completedSet = useMemo(() => new Set(job?.completedSteps ?? []), [job?.completedSteps]);
  const completedCount = Math.min(visibleSteps.filter((s) => completedSet.has(s)).length, visibleSteps.length);
  // The orchestrator runs Phase A2 (deployValidatorManager,
  // provisioning-node, reserving-relayer) in parallel, so steps
  // complete out of declaration order — `job.currentStep` flickers
  // among them as each one's startStep call lands. Pick the leftmost
  // not-yet-completed visible step instead. This advances smoothly
  // left-to-right and never appears to "jump back" on parallel finishes.
  // Falls back to job.currentStep if every visible step is in
  // completedSet but the job hasn't reached `complete` yet (shouldn't
  // happen, but the fallback keeps the UI from rendering empty).
  const firstIncomplete = visibleSteps.find((s) => !completedSet.has(s));
  const currentStep: DeploymentStep | undefined = firstIncomplete ?? job?.currentStep ?? visibleSteps[0];
  const currentIdx = Math.max(
    0,
    visibleSteps.findIndex((s) => s === currentStep),
  );
  const progressPct = Math.round((completedCount / visibleSteps.length) * 100);
  const failed = job?.status === 'failed';

  return (
    <div className="mx-auto max-w-5xl flex flex-col gap-4 py-4 px-4">
      {/* Header row: back link + chain name + elapsed timer */}
      <div>
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

      {/* Split-pane focal area — two panes of comparable visual weight,
          centered as a pair. Left pane hosts the loader + step info in
          a bordered card; right pane hosts the phone-portrait game with
          its "While you wait" eyebrow. Both panes are 500px tall so they
          read as a matched set; the left is wider (360) to comfortably
          hold step labels that can run to ~40 characters.

          Stacks vertically on < lg: for narrower viewports.

          IMPORTANT: the AvaxLoader is hoisted OUT of the AnimatePresence
          on purpose — it must keep animating continuously across step
          changes. If it lived inside the motion.div (keyed by step), React
          would unmount + remount it on every step change, resetting the
          SMIL + CSS animations to t=0. Only the title/status text should
          cross-fade per step. */}
      {/* Split-pane focal area — both panes share the same outer shape:
          eyebrow label + card below. This mirror-image structure is what
          keeps the card tops aligned on the same Y axis. Without the
          matching eyebrow on the left, the game card top would sit
          ~20px below the loader card top (space stolen by the right-
          side label). Identical wrappers → identical offsets → aligned. */}
      <div className="flex flex-col items-center gap-5 lg:flex-row lg:items-start lg:justify-center lg:gap-8">
        {/* Left pane — eyebrow + loader card. Grows to fill whatever
            horizontal space remains after the fixed-width game column,
            so the pair spans the full container edge-to-edge (matching
            the header + progress strip widths). Loader + text stay
            centered inside the wider card. */}
        <div className="flex flex-col items-center gap-1.5 w-full lg:flex-1 lg:min-w-0">
          <span className="text-[10px] font-medium uppercase tracking-[0.15em] text-zinc-500 dark:text-zinc-500">
            Current step
          </span>
          <div className="relative w-full lg:h-[500px] rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white/40 dark:bg-zinc-900/40 px-5 py-5 flex flex-col overflow-hidden">
            {failed ? (
              <div className="flex-1 flex items-center justify-center">
                <FailureContent message={job?.error ?? 'Unknown error'} />
              </div>
            ) : (
              <>
                {/* Top row — horizontal layout: smaller loader on the left
                    + current step name + status on the right. This
                    compacts the old centered 92px loader block down to
                    ~80px so the step timeline gets 400px+ of vertical
                    space below. */}
                <div className="flex items-start gap-4 shrink-0">
                  <div className="shrink-0 pt-0.5">
                    <AvaxLoader size={52} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[10px] font-medium uppercase tracking-[0.15em] text-zinc-500 dark:text-zinc-500">
                      Now
                    </div>
                    <AnimatePresence mode="wait">
                      <motion.div
                        key={currentStep ?? 'pending'}
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        transition={{ duration: 0.2 }}
                      >
                        <h2 className="text-[15px] font-semibold tracking-tight text-zinc-900 dark:text-zinc-100 text-balance break-words leading-tight">
                          {currentStep ? STEP_LABEL[currentStep] : 'Getting ready'}
                        </h2>
                        {/* Status detail reserved-height slot. min-h to
                            prevent jitter when the text appears/changes. */}
                        <div className="min-h-8 mt-1">
                          <AnimatePresence mode="wait">
                            {job?.statusDetail && (
                              <motion.p
                                key={job.statusDetail}
                                initial={{ opacity: 0, y: 3 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -3 }}
                                transition={{ duration: 0.18 }}
                                className="text-[12px] text-zinc-500 dark:text-zinc-400 leading-relaxed text-balance break-words max-w-full"
                              >
                                {job.statusDetail}
                              </motion.p>
                            )}
                          </AnimatePresence>
                        </div>
                      </motion.div>
                    </AnimatePresence>
                  </div>
                </div>

                <div className="border-t border-zinc-100 dark:border-zinc-800/80 my-3 shrink-0" />

                {/* Step timeline — scrollable list of every step in the
                    deploy, with tx evidence inlined per step. Fills
                    remaining vertical space via flex-1 + overflow-y-auto. */}
                <StepTimeline
                  visibleSteps={visibleSteps}
                  completedSteps={job?.completedSteps ?? []}
                  currentStep={currentStep}
                  evidence={job?.evidence ?? []}
                />
              </>
            )}
          </div>
        </div>

        {/* Right pane — eyebrow + phone-portrait game (280×500). Hidden
            on failure and on very narrow viewports where the 280px
            canvas feels cramped against the text content. */}
        {!failed && (
          <div className="hidden sm:flex flex-col items-center gap-1.5 shrink-0">
            <span className="text-[10px] font-medium uppercase tracking-[0.15em] text-zinc-500 dark:text-zinc-500">
              While you wait
            </span>
            <AvaxGame />
          </div>
        )}
      </div>

      {/* Footer — compact progress strip. Doesn't expand regardless of
          step count, and keeps a sense of "where am I in the whole thing". */}
      <div>
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

// ─── Loader placeholder ────────────────────────────────────────────
// The focal area currently shows just the step title + status detail.
// Next iteration picks a unique loading animation (see brainstorm).

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

// ─── Step timeline ─────────────────────────────────────────────────
//
// Full list of deploy steps with per-step tx evidence. Replaces the old
// "single big loader in a blank card" focal UI with something useful
// during the 3–5 minute wait: users can watch txs land live, click
// through to P-Chain / C-Chain explorers, and track what's done vs.
// coming up.

type StepState = 'done' | 'active' | 'pending';

/** Subnets-explorer URL for a P-Chain or C-Chain tx. L1 txs return null
 *  (we don't have the rpcUrl until the deploy completes — users see
 *  full interop addresses on the recap screen anyway). */
function txExplorerUrl(tx: TxRecord): string | null {
  const base = tx.network === 'fuji' ? 'https://subnets-test.avax.network' : 'https://subnets.avax.network';
  if (tx.chain === 'p-chain') return `${base}/p-chain/tx/${tx.hash}`;
  if (tx.chain === 'c-chain') return `${base}/c-chain/tx/${tx.hash}`;
  return null;
}

function chainLabelShort(chain: TxRecord['chain']): string {
  return chain === 'p-chain' ? 'P' : chain === 'c-chain' ? 'C' : 'L1';
}

function chainDotColor(chain: TxRecord['chain']): string {
  return chain === 'p-chain' ? 'bg-blue-500' : chain === 'c-chain' ? 'bg-purple-500' : 'bg-red-500';
}

function StepTimeline({
  visibleSteps,
  completedSteps,
  currentStep,
  evidence,
}: {
  visibleSteps: readonly DeploymentStep[];
  completedSteps: DeploymentStep[];
  currentStep: DeploymentStep | undefined;
  evidence: { step: DeploymentStep; txs: TxRecord[] }[];
}) {
  return (
    <ol className="flex-1 flex flex-col justify-between gap-0.5 min-h-0">
      {visibleSteps.map((step) => {
        const isCompleted = completedSteps.includes(step);
        const isActive = step === currentStep && !isCompleted;
        const state: StepState = isCompleted ? 'done' : isActive ? 'active' : 'pending';
        const stepEvidence = evidence.find((e) => e.step === step);
        return <StepRow key={step} state={state} label={STEP_LABEL[step]} txs={stepEvidence?.txs ?? []} />;
      })}
    </ol>
  );
}

function StepRow({ state, label, txs }: { state: StepState; label: string; txs: TxRecord[] }) {
  return (
    <li
      className={cn(
        'flex items-center gap-2 rounded-md px-1.5 py-0.5 transition-colors min-w-0',
        state === 'active' && 'bg-zinc-100/70 dark:bg-zinc-800/50',
      )}
    >
      <StepIcon state={state} />
      <span
        title={label}
        className={cn(
          'flex-1 min-w-0 truncate text-[12px] leading-snug',
          state === 'done' && 'text-zinc-600 dark:text-zinc-400',
          state === 'active' && 'font-semibold text-zinc-900 dark:text-zinc-100',
          state === 'pending' && 'text-zinc-400 dark:text-zinc-600',
        )}
      >
        {label}
      </span>
      {txs.length > 0 && (
        <span className="flex items-center gap-1 shrink-0">
          {txs.map((tx) => (
            <TxChip key={tx.hash} tx={tx} />
          ))}
        </span>
      )}
    </li>
  );
}

function StepIcon({ state }: { state: StepState }) {
  if (state === 'done') {
    return (
      <span className="shrink-0 mt-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-white">
        <Check className="h-3 w-3" strokeWidth={3} />
      </span>
    );
  }
  if (state === 'active') {
    return (
      <span className="shrink-0 mt-0.5 flex h-4 w-4 items-center justify-center">
        <span className="h-3.5 w-3.5 rounded-full border-2 border-zinc-300 dark:border-zinc-700 border-t-zinc-900 dark:border-t-zinc-100 animate-spin" />
      </span>
    );
  }
  return (
    <span className="shrink-0 mt-0.5 flex h-4 w-4 items-center justify-center">
      <span className="h-2 w-2 rounded-full border border-zinc-300 dark:border-zinc-700" />
    </span>
  );
}

function TxChip({ tx }: { tx: TxRecord }) {
  const url = txExplorerUrl(tx);
  const short = tx.hash.length > 10 ? `${tx.hash.slice(0, 4)}…${tx.hash.slice(-4)}` : tx.hash;
  // Full tooltip includes the chain + label + hash so nothing's lost when
  // the visible chip is tiny. Shows on hover for users who want details.
  const tooltip = tx.label
    ? `${chainLabelShort(tx.chain)} · ${tx.label} · ${tx.hash}`
    : `${chainLabelShort(tx.chain)} · ${tx.hash}`;

  const inner = (
    <>
      <span className={cn('h-1 w-1 rounded-full shrink-0', chainDotColor(tx.chain))} />
      <span className="text-[9px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 shrink-0">
        {chainLabelShort(tx.chain)}
      </span>
      <code className="font-mono text-[10px] text-zinc-500 dark:text-zinc-400 shrink-0">{short}</code>
      {url && <ExternalLink className="h-2.5 w-2.5 shrink-0 text-zinc-400 dark:text-zinc-500" />}
    </>
  );
  const commonClass =
    'inline-flex items-center gap-1 rounded border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-1 py-[1px] leading-none';
  return url ? (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      title={tooltip}
      className={cn(
        commonClass,
        'hover:border-zinc-400 dark:hover:border-zinc-600 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors',
      )}
    >
      {inner}
    </a>
  ) : (
    <span className={commonClass} title={tooltip}>
      {inner}
    </span>
  );
}

function FailureContent({ message }: { message: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 240, damping: 26 }}
      className="flex flex-col items-center text-center max-w-md"
    >
      <div className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-red-500 shrink-0">
        <AlertCircle className="h-10 w-10 text-red-500" />
      </div>
      <h2 className="mt-6 text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">Deployment failed</h2>
      {/* Error messages can contain long RPC URLs, tx hashes, or stack
          traces — break-words ensures they wrap inside the 312px-wide
          card content area rather than overflowing horizontally. */}
      <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400 break-words max-w-full">{message}</p>
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
