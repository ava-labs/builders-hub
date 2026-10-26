'use client';

import React, { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertTriangle, ArrowLeft, ArrowRight, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { FlowCompletionModal, type FlowCompletionAction } from './flow-completion-modal';
import { getFlowMetadata, type FlowMetadata } from '@/components/console/console-flows';
import { StepErrorBoundary } from '@/components/toolbox/components/StepErrorBoundary';
import { ChainGate } from '@/components/toolbox/components/ChainGate';
import { PRESS, PRESS_TRANSITION } from '@/components/console/motion';
import { completionOn, locateStep, markStyle } from '@/components/console/step-position';

/**
 * Chain requirement for a step. StepFlow checks the wallet's active chain
 * and shows an inline switch prompt if wrong.
 * - 'any': no chain requirement (default)
 * - 'p-chain': P-Chain tx via Core Wallet (no EVM switch needed)
 * - 'c-chain': must be on C-Chain (43114 mainnet / 43113 fuji)
 * - 'l1': must be on the user's L1 (created L1 list entry, genesis chainId, then createChainStore fallback)
 */
export type RequiredChain = 'any' | 'p-chain' | 'c-chain' | 'l1';

type SingleStep = {
  type: 'single';
  key: string;
  title: string;
  optional?: boolean;
  component: React.ComponentType;
  requiredChain?: RequiredChain;
  /** True once the step's work is really done (its tx landed, its ID is saved), whatever button the user left by. */
  isComplete?: () => boolean;
};

type BranchOption = {
  key: string;
  label: string;
  component: React.ComponentType;
};

type BranchStep = {
  type: 'branch';
  key: string;
  title: string;
  optional?: boolean;
  options: BranchOption[];
  requiredChain?: RequiredChain;
  isComplete?: () => boolean;
};

export type StepDefinition = SingleStep | BranchStep;

/* A step counts as done once the user leaves it with Next (or Finish), not merely because a later step is open:
   jumping ahead from the step list leaves the steps in between undone. Kept per flow in localStorage. */
const progressKey = (basePath: string) => `step-flow:done:${basePath}`;

function readProgress(basePath: string): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(progressKey(basePath)) ?? '[]') as string[]);
  } catch {
    return new Set();
  }
}

function writeProgress(basePath: string, done: Set<string>) {
  try {
    localStorage.setItem(progressKey(basePath), JSON.stringify([...done]));
  } catch {
    /* storage disabled: progress lasts for this page only */
  }
}

/** Forget which steps of a flow were completed, for a fresh run of it. */
export function clearStepFlowProgress(basePath: string) {
  try {
    localStorage.removeItem(progressKey(basePath));
  } catch {
    /* ignore */
  }
}

type StepFlowProps = {
  steps: StepDefinition[];
  className?: string;
  /**
   * Callback when flow finishes. If not provided and showCompletionModal is true,
   * the modal will be shown automatically.
   */
  onFinish?: () => void;
  basePath: string;
  currentStepKey: string;
  /**
   * Whether to show the built-in completion modal when the flow finishes.
   * If true and the flow has metadata in console-flows.ts, the modal will be shown.
   * If false or no metadata exists, navigates to /console as fallback.
   * Default: true
   */
  showCompletionModal?: boolean;
  /**
   * Custom metadata for the completion modal. If not provided,
   * metadata will be looked up from console-flows.ts based on basePath.
   */
  completionMetadata?: FlowMetadata & { accomplishments: string[] };
  /**
   * Transaction hash to display in the completion modal
   */
  transactionHash?: string;
  /**
   * Block explorer URL for the transaction
   */
  explorerUrl?: string;
  /**
   * Custom actions for the completion modal footer
   */
  completionActions?: FlowCompletionAction[];
  /** Label for the final-step action. Defaults to "Finish". */
  finishLabel?: string;
  /**
   * When provided, navigate via callback instead of URL <Link>.
   * Enables in-memory step navigation for inline chat rendering.
   */
  onNavigate?: (stepKey: string) => void;
  /**
   * Compact mode: tighter spacing for embedding in chat messages.
   */
  compact?: boolean;
  /**
   * Optional content rendered between the step nav and the active step body.
   * Useful for persistent context (e.g. ICTT chain cards) that should always
   * be visible regardless of which step is active.
   */
  aboveBody?: React.ReactNode;
  /**
   * Optional content rendered at the right edge of the step nav row.
   * Useful for utility actions (e.g. an "Activity" peek button) that should
   * sit at the same vertical line as the step pills.
   */
  navTrailing?: React.ReactNode;
  /**
   * Wraps the body of each step. The wrapper mounts fresh with every step, as the step itself does: a flow that stays
   * mounted from step to step uses it for data that each step must read fresh (the validator flows'
   * ValidatorManagerProvider, through validatorManagerPerStep).
   */
  wrapStep?: (step: React.ReactNode) => React.ReactNode;
};

export default function StepFlow({
  steps,
  className,
  onFinish,
  basePath,
  currentStepKey,
  showCompletionModal = true,
  completionMetadata,
  transactionHash,
  explorerUrl,
  completionActions,
  finishLabel = 'Finish',
  onNavigate,
  compact,
  aboveBody,
  navTrailing,
  wrapStep,
}: StepFlowProps) {
  const router = useRouter();
  // The step the completion modal is open on, null while it is closed (completionOn).
  const [finishedOn, setFinishedOn] = useState<string | null>(null);
  const stepListRef = useRef<HTMLOListElement>(null);
  const [done, setDone] = useState<Set<string>>(() => new Set());
  // Progress and isComplete read browser storage, so both wait for mount: the server and first client render agree.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setDone(readProgress(basePath));
    setMounted(true);
  }, [basePath]);
  // Keep the current step visible in the sideways-scrolling step list.
  useEffect(() => {
    const list = stepListRef.current;
    const active = list?.querySelector<HTMLElement>('[data-active]');
    if (!list || !active) return;
    const left = active.offsetLeft - list.offsetLeft;
    if (left < list.scrollLeft || left + active.offsetWidth > list.scrollLeft + list.clientWidth) {
      list.scrollLeft = left - 4;
    }
  }, [currentStepKey]);
  const markDone = useCallback(
    (key: string) => {
      setDone((prev) => {
        if (prev.has(key)) return prev;
        const next = new Set(prev).add(key);
        writeProgress(basePath, next);
        return next;
      });
    },
    [basePath],
  );

  // Get flow metadata for completion modal
  const flowMetadata = useMemo(() => {
    if (completionMetadata) return completionMetadata;
    return getFlowMetadata(basePath, steps);
  }, [basePath, steps, completionMetadata]);

  // Defer `onFinish` until AFTER the completion modal has been shown.
  // Calling it here would unmount parent components (e.g. a parent that
  // reads a flow store reset by `onFinish`) before the modal can render.
  const handleFinish = useCallback(() => {
    // When onNavigate is provided (inline chat mode), skip URL navigation
    // and fire onFinish immediately. There is no modal to wait for.
    if (onNavigate) {
      if (onFinish) onFinish();
      return;
    }
    if (showCompletionModal && flowMetadata) {
      setFinishedOn(currentStepKey);
    } else {
      // Fallback: navigate to console home if no modal configured.
      if (onFinish) {
        onFinish();
        return;
      }
      router.push('/console');
    }
  }, [onFinish, onNavigate, showCompletionModal, flowMetadata, router, currentStepKey]);

  const handleCompletionModalChange = useCallback(
    (open: boolean) => {
      setFinishedOn(open ? currentStepKey : null);
      // Fire onFinish only when the modal transitions from open → closed.
      // Guards against running onFinish on programmatic re-open.
      if (!open && onFinish) onFinish();
    },
    [onFinish, currentStepKey],
  );

  // The flow outlives its steps (step-flow-route.tsx), so a step change while the modal is open, such as the
  // browser's Back after Finish, closes it here without onFinish, as leaving a per-step page did.
  const completionStep = completionOn(finishedOn, currentStepKey);
  if (completionStep !== finishedOn) setFinishedOn(completionStep);

  // Find which step we're on - could be a single step or a branch option. The step bar and the step list follow it.
  const {
    index: currentIndex,
    step: currentStep,
    option: selectedBranchOption,
  } = useMemo(() => locateStep(steps, currentStepKey), [currentStepKey, steps]);

  /* con-step-travel: the title and the body show `shownKey`, which follows the URL at the bottom of a quick dip, so the
     text never changes in view. A flow that renders from a layout above its [step] route (stepFlowLayout in
     components/console/step-flow-route.tsx) stays mounted from step to step and plays the dip, as does a flow in chat
     (onNavigate); a flow that mounts with each step (the ICTT bridge) starts on its step. */
  const [shownKey, setShownKey] = useState(currentStepKey);
  const dipping = currentStepKey !== shownKey;
  useEffect(() => {
    if (!dipping) return;
    // The dip bottoms out at 36% of its 250ms. Reduce Motion keeps opacity fades at 150ms (app/global.css): wait for it.
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const swap = window.setTimeout(() => setShownKey(currentStepKey), reduce ? 150 : 90);
    return () => window.clearTimeout(swap);
  }, [dipping, currentStepKey]);
  const shown = useMemo(() => {
    const at = locateStep(steps, shownKey);
    // A flow that showed "not found" has no step to dip from: it shows the new step at once.
    return at.index >= 0
      ? { ...at, key: shownKey }
      : { index: currentIndex, step: currentStep, option: selectedBranchOption, key: currentStepKey };
  }, [steps, shownKey, currentIndex, currentStep, selectedBranchOption, currentStepKey]);

  // con-step-travel: the step the red mark and the ink travel from. Set while rendering, as React does for state that
  // follows a prop, so the first frame of the new step already knows it.
  const [markAt, setMarkAt] = useState(currentIndex);
  const [leftStep, setLeftStep] = useState<number | null>(null);
  if (markAt !== currentIndex) {
    setLeftStep(markAt);
    setMarkAt(currentIndex);
  }

  const totalSteps = steps.length;
  const atFirst = shown.index <= 0;
  const atLast = shown.index >= totalSteps - 1;

  const ShownComponent = useMemo(() => {
    if (!shown.step) return undefined;
    if (shown.step.type === 'single') return shown.step.component;
    // For branch steps, use the selected option's component
    return shown.option?.component || shown.step.options[0].component;
  }, [shown]);

  const prevLink = useMemo(() => {
    if (atFirst) return null;
    const prevStep = steps[shown.index - 1];

    // When navigating back from any step, we need to determine the appropriate destination
    if (prevStep.type === 'single') {
      return `${basePath}/${prevStep.key}`;
    } else {
      // For branch steps, we should go to the first option by default
      // The user can then select a different option if they want
      return `${basePath}/${prevStep.options[0].key}`;
    }
  }, [atFirst, shown.index, steps, basePath]);

  const nextLink = useMemo(() => {
    if (atLast || shown.index < 0) return null;
    const nextStep = steps[shown.index + 1];

    // When navigating forward, determine the appropriate destination
    if (nextStep.type === 'single') {
      return `${basePath}/${nextStep.key}`;
    } else {
      // For branch steps, go to the first option by default
      return `${basePath}/${nextStep.options[0].key}`;
    }
  }, [atLast, shown.index, steps, basePath]);

  // Helper: renders Link or button depending on onNavigate mode
  const NavEl = useMemo(() => {
    type NavElProps = { stepKey: string; className?: string; current?: boolean; children: React.ReactNode };
    if (onNavigate) {
      return ({ stepKey, className: cls, current, children }: NavElProps) => (
        <button
          type="button"
          onClick={() => onNavigate(stepKey)}
          className={cls}
          aria-current={current ? 'step' : undefined}
        >
          {children}
        </button>
      );
    }
    return ({ stepKey, className: cls, current, children }: NavElProps) => (
      <Link href={`${basePath}/${stepKey}`} className={cls} aria-current={current ? 'step' : undefined}>
        {children}
      </Link>
    );
  }, [onNavigate, basePath]);

  // After every hook: the rules of hooks forbid an earlier return
  const shownStep = shown.step;
  if (currentIndex < 0 || !currentStep || !shownStep || !ShownComponent) {
    return <div>Step &quot;{currentStepKey}&quot; not found.</div>;
  }

  // Extract step key for navigation (handles branch steps)
  const getStepNavKey = (step: StepDefinition): string => {
    return step.type === 'single' ? step.key : step.options[0].key;
  };

  const stepTitle = (s: StepDefinition, option = selectedBranchOption) =>
    s.type === 'single' ? s.title : (s.options.find((o) => o.key === option?.key)?.label ?? s.title);
  const nextStep = atLast ? null : steps[shown.index + 1];
  const nextTitle = nextStep ? (nextStep.type === 'single' ? nextStep.title : nextStep.options[0].label) : null;
  const goTo = (step: StepDefinition) => onNavigate?.(getStepNavKey(step));

  type Status = 'done' | 'active' | 'skipped' | 'upcoming';
  const statusOf = (s: StepDefinition, i: number): Status =>
    i === currentIndex
      ? 'active'
      : done.has(s.key) || (mounted && s.isComplete?.())
        ? 'done'
        : i < currentIndex && !s.optional
          ? 'skipped'
          : 'upcoming';
  const SKIPPED_TITLE = 'Not completed yet: you moved past this step before finishing it.';
  const leaveWithNext = () => markDone(shownStep.key);
  const stepBody = (
    <ChainGate requiredChain={shownStep.requiredChain}>
      <ShownComponent />
    </ChainGate>
  );

  const BTN = `inline-flex h-10 items-center gap-2 border px-3 sm:px-4 font-mono text-[11px] font-bold uppercase tracking-[0.14em] ${PRESS_TRANSITION} ${PRESS}`;
  const BTN_GHOST =
    'border-zinc-300 text-zinc-700 hover:border-zinc-900 hover:text-zinc-900 dark:border-zinc-700 dark:text-zinc-200 dark:hover:border-zinc-100 dark:hover:text-zinc-50';
  const BTN_INK =
    'border-zinc-900 bg-zinc-900 text-white hover:bg-zinc-700 dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300';

  return (
    <div className={className} data-console-flow>
      <nav aria-label="Steps" className={cn('nav-plain flex flex-col', compact ? 'mb-4 gap-2' : 'mb-8 gap-3')}>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <p
            className={cn(
              'min-w-0 flex-1 truncate font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400',
              // con-step-travel: the title dips out with a 2px blur and comes back with the new step's name.
              'transition-[opacity,filter] ease-[ease]',
              dipping ? 'duration-[90ms] opacity-0 motion-safe:blur-[2px]' : 'duration-[160ms]',
            )}
          >
            Step <span className="text-zinc-900 dark:text-zinc-50">{shown.index + 1}</span> of {totalSteps}
            <span className="mx-2 text-zinc-300 dark:text-zinc-700">/</span>
            <span className="text-zinc-900 dark:text-zinc-50">{stepTitle(shownStep, shown.option)}</span>
          </p>
          {navTrailing && <div className="shrink-0">{navTrailing}</div>}
        </div>

        {/* One segment per step: done in ink, current in red, passed-but-unfinished in amber, the rest grey. The ink and
            the amber fill a grey bar, so the step the red mark leaves fills from the side it left (con-step-travel). Each
            fill keeps one colour, so a step that fills shows its colour at once, and only a hover eases a colour. */}
        <div className="relative -my-2 flex gap-1" aria-hidden>
          {steps.map((s, i) => {
            const status = statusOf(s, i);
            // The step the mark leaves fills from the side it left, and eases its hover colour as its neighbours do
            // (transition-colors: 150ms on the default curve).
            const fill = cn(
              'absolute inset-0',
              i === leftStep
                ? [
                    '[transition:scale_300ms_var(--ease-in-out),background-color_150ms_var(--default-transition-timing-function)]',
                    currentIndex > i ? 'origin-left' : 'origin-right',
                  ]
                : 'transition-colors',
            );
            return (
              // The colour sits on an inner span: the nav's plain-link reset clears backgrounds on its anchors.
              <NavEl key={s.key} stepKey={getStepNavKey(s)} className="group/seg block flex-1">
                {/* The padding gives the thin bar a finger-sized tap area. */}
                <span className="block py-2">
                  <span
                    className={cn(
                      'relative block h-1',
                      status === 'active'
                        ? // red as the travelling mark lands on it, not before
                          'bg-[#E6212F] [transition:background-color_0ms_300ms]'
                        : 'bg-zinc-200 transition-colors group-hover/seg:bg-zinc-300 dark:bg-zinc-800 dark:group-hover/seg:bg-zinc-700',
                    )}
                  >
                    <span
                      className={cn(
                        fill,
                        'bg-amber-400 group-hover/seg:bg-amber-500 dark:bg-amber-500/80',
                        status === 'skipped' ? 'scale-x-100' : 'scale-x-0',
                      )}
                    />
                    <span
                      className={cn(
                        fill,
                        'bg-zinc-900 group-hover/seg:bg-zinc-600 dark:bg-zinc-100 dark:group-hover/seg:bg-zinc-400',
                        status === 'done' ? 'scale-x-100' : 'scale-x-0',
                      )}
                    />
                  </span>
                </span>
                <span className="sr-only">{stepTitle(s)}</span>
              </NavEl>
            );
          })}
          {/* con-step-travel: one red mark travels from step to step; a second click mid-way retargets it. */}
          <span
            className="pointer-events-none absolute left-0 top-2 h-1 bg-[#E6212F] transition-transform duration-300 ease-in-out"
            style={markStyle(currentIndex, totalSteps)}
          />
        </div>

        {!compact && currentStep.type === 'branch' && (
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 sm:hidden">
            {currentStep.options.map((o, i) => (
              <React.Fragment key={o.key}>
                {i > 0 && <span className="text-[12px] text-zinc-400">or</span>}
                <span>
                  <NavEl
                    stepKey={o.key}
                    current={selectedBranchOption?.key === o.key}
                    className={cn(
                      'text-[12.5px] underline-offset-4',
                      selectedBranchOption?.key === o.key
                        ? 'font-medium text-zinc-900 underline decoration-[#E6212F] dark:text-zinc-50'
                        : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50',
                    )}
                  >
                    {o.label}
                  </NavEl>
                </span>
              </React.Fragment>
            ))}
          </div>
        )}

        {!compact && (
          // Phones read the step from the line above; the full list returns from sm up.
          <ol
            ref={stepListRef}
            className="-mx-1 hidden gap-x-5 overflow-x-auto px-1 pb-1 [scrollbar-width:none] sm:flex"
          >
            {steps.map((s, stepIdx) => {
              const status = statusOf(s, stepIdx);
              const isDoneStep = status === 'done';
              const isActiveStep = status === 'active';
              const isSkipped = status === 'skipped';
              const items =
                s.type === 'single'
                  ? [{ key: s.key, label: s.title }]
                  : s.options.map((o) => ({ key: o.key, label: o.label }));
              return (
                <li
                  key={s.key}
                  data-active={isActiveStep || undefined}
                  className="flex shrink-0 items-baseline gap-1.5"
                  title={isSkipped ? SKIPPED_TITLE : undefined}
                >
                  <span
                    className={cn(
                      'font-mono text-[10px] font-bold tabular-nums',
                      isActiveStep
                        ? 'text-[#E6212F]'
                        : isDoneStep
                          ? 'text-zinc-900 dark:text-zinc-100'
                          : isSkipped
                            ? 'text-amber-500'
                            : 'text-zinc-400 dark:text-zinc-600',
                    )}
                  >
                    {isDoneStep ? (
                      <Check className="inline h-3 w-3 -translate-y-px" aria-label="Completed" />
                    ) : isSkipped ? (
                      <AlertTriangle className="inline h-3 w-3 -translate-y-px" aria-label="Not completed" />
                    ) : (
                      String(stepIdx + 1).padStart(2, '0')
                    )}
                  </span>
                  {items.map((it, i) => {
                    const on = isActiveStep && (s.type === 'single' || selectedBranchOption?.key === it.key);
                    return (
                      <React.Fragment key={it.key}>
                        {i > 0 && <span className="text-[12px] text-zinc-400">or</span>}
                        {/* The span keeps the link out of the global `nav li > a` hover colour, so its own applies. */}
                        <span>
                          <NavEl
                            stepKey={it.key}
                            current={on}
                            className={cn(
                              'whitespace-nowrap text-[12.5px] decoration-current/40 transition-colors',
                              on
                                ? 'font-medium text-zinc-900 dark:text-zinc-50'
                                : isDoneStep
                                  ? 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-50'
                                  : isSkipped
                                    ? 'text-amber-700 hover:text-amber-900 dark:text-amber-300 dark:hover:text-amber-200'
                                    : 'text-zinc-400 hover:text-zinc-700 dark:text-zinc-500 dark:hover:text-zinc-200',
                              s.optional && 'italic',
                            )}
                          >
                            {it.label}
                          </NavEl>
                        </span>
                      </React.Fragment>
                    );
                  })}
                </li>
              );
            })}
          </ol>
        )}
      </nav>

      {aboveBody && (
        <div className={cn('border-t border-zinc-200 dark:border-zinc-800', compact ? 'py-4' : 'py-6')}>
          {aboveBody}
        </div>
      )}

      {/* con-step-travel: the step body dips on opacity only and swaps at the bottom of the dip. The step on its way out
          takes no clicks or focus. */}
      <div
        inert={dipping}
        className={cn('transition-opacity ease-[ease]', dipping ? 'duration-[90ms] opacity-0' : 'duration-[160ms]')}
      >
        <div className={compact ? 'min-h-[150px]' : 'min-h-[200px]'}>
          {/* Keyed by the step, so a new step mounts fresh with its wrapper, as the route change mounted it. */}
          <StepErrorBoundary key={shown.key}>{wrapStep ? wrapStep(stepBody) : stepBody}</StepErrorBoundary>
        </div>

        <div
          className={cn(
            'flex items-center justify-between gap-3 border-t border-zinc-200 dark:border-zinc-800',
            compact ? 'mt-4 pt-4' : 'mt-10 pt-6',
          )}
        >
          {prevLink ? (
            onNavigate ? (
              <button type="button" onClick={() => goTo(steps[shown.index - 1])} className={cn(BTN, BTN_GHOST)}>
                <ArrowLeft className="h-3.5 w-3.5" /> Back
              </button>
            ) : (
              <Link href={prevLink} className={cn(BTN, BTN_GHOST)}>
                <ArrowLeft className="h-3.5 w-3.5" /> Back
              </Link>
            )
          ) : (
            <span />
          )}

          <div className="flex min-w-0 items-center gap-2">
            {'optional' in shownStep &&
              shownStep.optional &&
              nextLink &&
              (onNavigate ? (
                <button type="button" onClick={() => goTo(steps[shown.index + 1])} className={cn(BTN, BTN_GHOST)}>
                  Skip
                </button>
              ) : (
                <Link href={nextLink} className={cn(BTN, BTN_GHOST)}>
                  Skip
                </Link>
              ))}
            {atLast ? (
              <button
                type="button"
                onClick={() => {
                  leaveWithNext();
                  handleFinish();
                }}
                className={cn(BTN, BTN_INK)}
              >
                {finishLabel} <Check className="h-3.5 w-3.5" />
              </button>
            ) : (
              nextLink &&
              (onNavigate ? (
                <button
                  type="button"
                  onClick={() => {
                    leaveWithNext();
                    goTo(steps[shown.index + 1]);
                  }}
                  className={cn(BTN, BTN_INK, 'min-w-0')}
                >
                  <span className="truncate">
                    Next{nextTitle && !compact && <span className="hidden sm:inline">: {nextTitle}</span>}
                  </span>
                  <ArrowRight className="h-3.5 w-3.5 shrink-0" />
                </button>
              ) : (
                <Link href={nextLink} onClick={leaveWithNext} className={cn(BTN, BTN_INK, 'min-w-0')}>
                  <span className="truncate">
                    Next{nextTitle && !compact && <span className="hidden sm:inline">: {nextTitle}</span>}
                  </span>
                  <ArrowRight className="h-3.5 w-3.5 shrink-0" />
                </Link>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Completion Modal */}
      {showCompletionModal && flowMetadata && (
        <FlowCompletionModal
          open={completionStep !== null}
          onOpenChange={handleCompletionModalChange}
          metadata={flowMetadata}
          transactionHash={transactionHash}
          explorerUrl={explorerUrl}
          customActions={completionActions}
        />
      )}
    </div>
  );
}
