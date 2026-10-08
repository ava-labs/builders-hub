'use client';

import React, { useMemo, useState, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { AlertTriangle, ArrowLeft, ArrowRight, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { FlowCompletionModal, type FlowCompletionAction } from './flow-completion-modal';
import { getFlowMetadata, type FlowMetadata } from '@/components/console/console-flows';
import { StepErrorBoundary } from '@/components/toolbox/components/StepErrorBoundary';
import { ChainGate } from '@/components/toolbox/components/ChainGate';
import { sectionContainer, sectionItem } from '@/components/console/motion';

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
   * Compact mode — tighter spacing for embedding in chat messages.
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
}: StepFlowProps) {
  const router = useRouter();
  const [isCompletionModalOpen, setIsCompletionModalOpen] = useState(false);
  const [done, setDone] = useState<Set<string>>(() => new Set());
  // Progress and isComplete read browser storage, so both wait for mount: the server and first client render agree.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setDone(readProgress(basePath));
    setMounted(true);
  }, [basePath]);
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
    // and fire onFinish immediately — there is no modal to wait for.
    if (onNavigate) {
      if (onFinish) onFinish();
      return;
    }
    if (showCompletionModal && flowMetadata) {
      setIsCompletionModalOpen(true);
    } else {
      // Fallback: navigate to console home if no modal configured.
      if (onFinish) {
        onFinish();
        return;
      }
      router.push('/console');
    }
  }, [onFinish, onNavigate, showCompletionModal, flowMetadata, router]);

  const handleCompletionModalChange = useCallback(
    (open: boolean) => {
      setIsCompletionModalOpen(open);
      // Fire onFinish only when the modal transitions from open → closed.
      // Guards against running onFinish on programmatic re-open.
      if (!open && onFinish) onFinish();
    },
    [onFinish],
  );

  // Find which step we're on - could be a single step or a branch option
  const { currentIndex, currentStep, selectedBranchOption } = useMemo(() => {
    // First check if it's a single step
    const singleStepIndex = steps.findIndex((s) => s.type === 'single' && s.key === currentStepKey);
    if (singleStepIndex !== -1) {
      return {
        currentIndex: singleStepIndex,
        currentStep: steps[singleStepIndex],
        selectedBranchOption: undefined,
      };
    }

    // Check if it's a branch option
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      if (step.type === 'branch') {
        const option = step.options.find((opt) => opt.key === currentStepKey);
        if (option) {
          return {
            currentIndex: i,
            currentStep: step,
            selectedBranchOption: option,
          };
        }
      }
    }

    return { currentIndex: -1, currentStep: undefined, selectedBranchOption: undefined };
  }, [currentStepKey, steps]);

  if (currentIndex < 0 || !currentStep) {
    return <div>Step &quot;{currentStepKey}&quot; not found.</div>;
  }

  const totalSteps = steps.length;
  const atFirst = currentIndex <= 0;
  const atLast = currentIndex >= totalSteps - 1;

  const CurrentComponent = useMemo(() => {
    if (currentStep.type === 'single') return currentStep.component;
    // For branch steps, use the selected option's component
    return selectedBranchOption?.component || currentStep.options[0].component;
  }, [currentStep, selectedBranchOption]);

  const prevLink = useMemo(() => {
    if (atFirst) return null;
    const prevStep = steps[currentIndex - 1];

    // When navigating back from any step, we need to determine the appropriate destination
    if (prevStep.type === 'single') {
      return `${basePath}/${prevStep.key}`;
    } else {
      // For branch steps, we should go to the first option by default
      // The user can then select a different option if they want
      return `${basePath}/${prevStep.options[0].key}`;
    }
  }, [atFirst, currentIndex, steps, basePath]);

  const nextLink = useMemo(() => {
    if (atLast) return null;
    const nextStep = steps[currentIndex + 1];

    // When navigating forward, determine the appropriate destination
    if (nextStep.type === 'single') {
      return `${basePath}/${nextStep.key}`;
    } else {
      // For branch steps, go to the first option by default
      return `${basePath}/${nextStep.options[0].key}`;
    }
  }, [atLast, currentIndex, steps, basePath]);

  // Helper: renders Link or button depending on onNavigate mode
  const NavEl = useMemo(() => {
    if (onNavigate) {
      return ({
        stepKey,
        className: cls,
        children,
      }: {
        stepKey: string;
        className?: string;
        children: React.ReactNode;
      }) => (
        <button type="button" onClick={() => onNavigate(stepKey)} className={cls}>
          {children}
        </button>
      );
    }
    return ({
      stepKey,
      className: cls,
      children,
    }: {
      stepKey: string;
      className?: string;
      children: React.ReactNode;
    }) => (
      <Link href={`${basePath}/${stepKey}`} className={cls}>
        {children}
      </Link>
    );
  }, [onNavigate, basePath]);

  // Extract step key for navigation (handles branch steps)
  const getStepNavKey = (step: StepDefinition): string => {
    return step.type === 'single' ? step.key : step.options[0].key;
  };

  const stepTitle = (s: StepDefinition) =>
    s.type === 'single' ? s.title : (s.options.find((o) => o.key === selectedBranchOption?.key)?.label ?? s.title);
  const nextStep = atLast ? null : steps[currentIndex + 1];
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
  const leaveWithNext = () => markDone(currentStep.key);

  const BTN =
    'inline-flex h-10 items-center gap-2 border px-4 font-mono text-[11px] font-bold uppercase tracking-[0.14em] transition-colors';
  const BTN_GHOST =
    'border-zinc-300 text-zinc-700 hover:border-zinc-900 hover:text-zinc-900 dark:border-zinc-700 dark:text-zinc-200 dark:hover:border-zinc-100 dark:hover:text-zinc-50';
  const BTN_INK =
    'border-zinc-900 bg-zinc-900 text-white hover:bg-zinc-700 dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300';

  return (
    <motion.div className={className} variants={sectionContainer} initial="hidden" animate="visible" data-console-flow>
      <motion.nav
        aria-label="Steps"
        className={cn('nav-plain flex flex-col', compact ? 'mb-4 gap-2' : 'mb-8 gap-3')}
        variants={sectionItem}
      >
        <div className="flex items-center gap-3">
          <p className="min-w-0 flex-1 truncate font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
            Step <span className="text-zinc-900 dark:text-zinc-50">{currentIndex + 1}</span> of {totalSteps}
            <span className="mx-2 text-zinc-300 dark:text-zinc-700">/</span>
            <span className="text-zinc-900 dark:text-zinc-50">{stepTitle(currentStep)}</span>
          </p>
          {navTrailing && <div className="shrink-0">{navTrailing}</div>}
        </div>

        {/* One segment per step: done in ink, current in red, passed-but-unfinished in amber, the rest grey. */}
        <div className="flex gap-1" aria-hidden>
          {steps.map((s, i) => {
            const status = statusOf(s, i);
            return (
              // The colour sits on an inner span: the nav's plain-link reset clears backgrounds on its anchors.
              <NavEl key={s.key} stepKey={getStepNavKey(s)} className="group/seg block flex-1">
                <span
                  className={cn(
                    'block h-1 transition-colors',
                    status === 'done' &&
                      'bg-zinc-900 group-hover/seg:bg-zinc-600 dark:bg-zinc-100 dark:group-hover/seg:bg-zinc-400',
                    status === 'active' && 'bg-[#E6212F]',
                    status === 'skipped' && 'bg-amber-400 group-hover/seg:bg-amber-500 dark:bg-amber-500/80',
                    status === 'upcoming' &&
                      'bg-zinc-200 group-hover/seg:bg-zinc-300 dark:bg-zinc-800 dark:group-hover/seg:bg-zinc-700',
                  )}
                />
                <span className="sr-only">{stepTitle(s)}</span>
              </NavEl>
            );
          })}
        </div>

        {!compact && (
          <ol className="-mx-1 flex gap-x-5 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
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
      </motion.nav>

      {aboveBody && (
        <motion.div
          className={cn('border-t border-zinc-200 dark:border-zinc-800', compact ? 'py-4' : 'py-6')}
          variants={sectionItem}
        >
          {aboveBody}
        </motion.div>
      )}

      <motion.div variants={sectionItem}>
        <div className={compact ? 'min-h-[150px]' : 'min-h-[200px]'}>
          <StepErrorBoundary>
            <ChainGate requiredChain={currentStep.requiredChain}>
              <CurrentComponent />
            </ChainGate>
          </StepErrorBoundary>
        </div>

        <div
          className={cn(
            'flex items-center justify-between gap-3 border-t border-zinc-200 dark:border-zinc-800',
            compact ? 'mt-4 pt-4' : 'mt-10 pt-6',
          )}
        >
          {prevLink ? (
            onNavigate ? (
              <button type="button" onClick={() => goTo(steps[currentIndex - 1])} className={cn(BTN, BTN_GHOST)}>
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
            {'optional' in currentStep &&
              currentStep.optional &&
              nextLink &&
              (onNavigate ? (
                <button type="button" onClick={() => goTo(steps[currentIndex + 1])} className={cn(BTN, BTN_GHOST)}>
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
                    goTo(steps[currentIndex + 1]);
                  }}
                  className={cn(BTN, BTN_INK, 'min-w-0')}
                >
                  <span className="truncate">Next{nextTitle && !compact ? `: ${nextTitle}` : ''}</span>
                  <ArrowRight className="h-3.5 w-3.5 shrink-0" />
                </button>
              ) : (
                <Link href={nextLink} onClick={leaveWithNext} className={cn(BTN, BTN_INK, 'min-w-0')}>
                  <span className="truncate">Next{nextTitle && !compact ? `: ${nextTitle}` : ''}</span>
                  <ArrowRight className="h-3.5 w-3.5 shrink-0" />
                </Link>
              ))
            )}
          </div>
        </div>
      </motion.div>

      {/* Completion Modal */}
      {showCompletionModal && flowMetadata && (
        <FlowCompletionModal
          open={isCompletionModalOpen}
          onOpenChange={handleCompletionModalChange}
          metadata={flowMetadata}
          transactionHash={transactionHash}
          explorerUrl={explorerUrl}
          customActions={completionActions}
        />
      )}
    </motion.div>
  );
}
