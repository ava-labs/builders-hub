'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useDeploymentStatus } from '@/hooks/useQuickL1Deploy';
import { DEPLOYMENT_STEPS, INTEROP_ONLY_STEPS, STEP_LABEL, type DeploymentStep } from '@/lib/quick-l1/types';
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

  return (
    <div className="mx-auto max-w-3xl flex flex-col gap-3 py-4 px-4">
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

      {/* Focal content — fixed min-height so the game below never shifts
          when the status detail / tx badge appear or change length.
          The ancestor chain (ConsolePageTransition motion.div) doesn't
          propagate `h-full`, so `flex-1` on this section would size to
          content and the game would jitter vertically. Static min-h is
          the robust fix.

          IMPORTANT: the AvaxLoader is hoisted OUT of the AnimatePresence
          on purpose — it must keep animating continuously across step
          changes. If it lived inside the motion.div (keyed by step), React
          would unmount + remount it on every step change, resetting the
          SMIL + CSS animations to t=0. Only the title/status text should
          cross-fade per step. */}
      <div className="relative flex flex-col items-center justify-center min-h-[230px]">
        {!failed && (
          <div className="mb-5 flex items-center justify-center h-24">
            <AvaxLoader size={92} />
          </div>
        )}

        <AnimatePresence mode="wait">
          {failed ? (
            <FailureContent key="failed" message={job?.error ?? 'Unknown error'} />
          ) : (
            <motion.div
              key={currentStep ?? 'pending'}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25, ease: [0.21, 0.47, 0.32, 0.98] }}
              className="flex flex-col items-center text-center max-w-md px-4"
            >
              <h2 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
                {currentStep ? STEP_LABEL[currentStep] : 'Getting ready'}
              </h2>

              {/* Reserved-height status slot so the game below never
                  shifts when the detail text appears/changes. */}
              <div className="mt-2 h-10 w-full flex items-start justify-center">
                <AnimatePresence mode="wait">
                  {job?.statusDetail && (
                    <motion.p
                      key={job.statusDetail}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.2 }}
                      className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed"
                    >
                      {job.statusDetail}
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Play while you wait — one of four infinite-runner games, picked
          at random on mount. Users can swap via the small exit button
          in each game (top-left), which reveals a selection screen with
          a "Random" pick plus direct game picks.
          Framed with a muted "While you wait" label so it reads as an
          intentional companion feature rather than a floating decoration.
          Hidden in failure state (user has other things on their mind)
          and on narrow viewports where the 600px canvas won't fit. */}
      {!failed && (
        <div className="hidden sm:flex flex-col items-center gap-1.5">
          <span className="text-[10px] font-medium uppercase tracking-[0.15em] text-zinc-500 dark:text-zinc-500">
            While you wait
          </span>
          <AvaxGame />
        </div>
      )}

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
