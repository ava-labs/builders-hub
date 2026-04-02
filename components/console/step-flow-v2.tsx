"use client";

import React, { useMemo, useState, useCallback, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { FlowCompletionModal, type FlowCompletionAction } from "./flow-completion-modal";
import { getFlowMetadata, type FlowMetadata } from "@/config/console-flows";
import { useStepFlowNavStore } from "./stores/stepFlowNavStore";

const flowContainerVariants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.1, delayChildren: 0.05 },
  },
};

const flowItemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: "spring" as const, stiffness: 200, damping: 24 },
  },
};

type SingleStep = {
  type: "single";
  key: string;
  title: string;
  optional?: boolean;
  isStepComplete?: () => boolean;
  component: React.ComponentType;
};

type BranchOption = {
  key: string;
  label: string;
  component: React.ComponentType;
};

type BranchStep = {
  type: "branch";
  key: string;
  title: string;
  optional?: boolean;
  isStepComplete?: () => boolean;
  options: BranchOption[];
};

export type StepDefinition = SingleStep | BranchStep;

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
  /**
   * When provided, navigate via callback instead of URL <Link>.
   * Enables in-memory step navigation for inline chat rendering.
   */
  onNavigate?: (stepKey: string) => void;
  /**
   * Compact mode — tighter spacing for embedding in chat messages.
   */
  compact?: boolean;
};

export default function StepFlowV2({
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
  onNavigate,
  compact,
}: StepFlowProps) {
  const router = useRouter();
  const [isCompletionModalOpen, setIsCompletionModalOpen] = useState(false);

  // Get flow metadata for completion modal
  const flowMetadata = useMemo(() => {
    if (completionMetadata) return completionMetadata;
    return getFlowMetadata(basePath, steps);
  }, [basePath, steps, completionMetadata]);

  // Handle finish button click
  const handleFinish = useCallback(() => {
    if (onFinish) {
      onFinish();
    }
    // When onNavigate is provided (inline chat mode), skip URL navigation
    if (onNavigate) return;
    if (showCompletionModal && flowMetadata) {
      setIsCompletionModalOpen(true);
    } else {
      // Fallback: navigate to console home if no modal configured
      router.push("/console");
    }
  }, [onFinish, onNavigate, showCompletionModal, flowMetadata, router]);

  // Find which step we're on - could be a single step or a branch option
  const { currentIndex, currentStep, selectedBranchOption } = useMemo(() => {
    // First check if it's a single step
    const singleStepIndex = steps.findIndex((s) => s.type === "single" && s.key === currentStepKey);
    if (singleStepIndex !== -1) {
      return {
        currentIndex: singleStepIndex,
        currentStep: steps[singleStepIndex],
        selectedBranchOption: undefined
      };
    }

    // Check if it's a branch option
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      if (step.type === "branch") {
        const option = step.options.find(opt => opt.key === currentStepKey);
        if (option) {
          return {
            currentIndex: i,
            currentStep: step,
            selectedBranchOption: option
          };
        }
      }
    }

    return { currentIndex: -1, currentStep: undefined, selectedBranchOption: undefined };
  }, [currentStepKey, steps]);

  // Register nav data with the layout-level store (URL-based navigation only)
  const isInlineMode = !!onNavigate;
  const tokenRef = useRef<number>(0);
  const register = useStepFlowNavStore((s) => s.register);
  const unregister = useStepFlowNavStore((s) => s.unregister);

  useEffect(() => {
    if (isInlineMode || currentIndex < 0) return;
    tokenRef.current = register({
      steps,
      currentStepKey,
      currentIndex,
      basePath,
      selectedBranchOptionKey: selectedBranchOption?.key,
    });
    return () => unregister(tokenRef.current);
  }, [isInlineMode, steps, currentStepKey, currentIndex, basePath, selectedBranchOption?.key, register, unregister]);

  if (currentIndex < 0 || !currentStep) {
    return <div>Step &quot;{currentStepKey}&quot; not found.</div>;
  }

  const totalSteps = steps.length;
  const atFirst = currentIndex <= 0;
  const atLast = currentIndex >= totalSteps - 1;

  // Check if current step has a completion gate
  const isCurrentStepComplete = currentStep.isStepComplete ? currentStep.isStepComplete() : true;

  const CurrentComponent = useMemo(() => {
    if (currentStep.type === "single") return currentStep.component;
    // For branch steps, use the selected option's component
    return selectedBranchOption?.component || currentStep.options[0].component;
  }, [currentStep, selectedBranchOption]);

  const prevLink = useMemo(() => {
    if (atFirst) return null;
    const prevStep = steps[currentIndex - 1];

    // When navigating back from any step, we need to determine the appropriate destination
    if (prevStep.type === "single") {
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
    if (nextStep.type === "single") {
      return `${basePath}/${nextStep.key}`;
    } else {
      // For branch steps, go to the first option by default
      return `${basePath}/${nextStep.options[0].key}`;
    }
  }, [atLast, currentIndex, steps, basePath]);

  // Helper: renders Link or button depending on onNavigate mode
  const NavEl = useMemo(() => {
    if (onNavigate) {
      return ({ stepKey, className: cls, children }: { stepKey: string; className?: string; children: React.ReactNode }) => (
        <button type="button" onClick={() => onNavigate(stepKey)} className={cls}>{children}</button>
      );
    }
    return ({ stepKey, className: cls, children }: { stepKey: string; className?: string; children: React.ReactNode }) => (
      <Link href={`${basePath}/${stepKey}`} className={cls}>{children}</Link>
    );
  }, [onNavigate, basePath]);

  // Extract step key for navigation (handles branch steps)
  const getStepNavKey = (step: StepDefinition): string => {
    return step.type === "single" ? step.key : step.options[0].key;
  };

  return (
    <motion.div
      className={className}
      variants={flowContainerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Inline nav — only rendered in chat/embedded mode (onNavigate).
          URL-based flows render nav in the SiteHeader via stepFlowNavStore. */}
      {isInlineMode && (
        <motion.nav
          className={cn(
            "pb-4 border-b border-border",
            compact ? "mb-3" : "mb-6"
          )}
          variants={flowItemVariants}
        >
          <ol className="flex flex-wrap items-center justify-center gap-3 text-sm">
            {steps.map((s, stepIdx) => {
              const isDoneStep = stepIdx < currentIndex;
              const isActiveStep = stepIdx === currentIndex;

              if (s.type === "single") {
                return (
                  <li key={s.key} className="flex items-center gap-3">
                    <NavEl
                      stepKey={s.key}
                      className={cn(
                        "inline-flex items-center gap-2 rounded-lg px-3 py-1.5 border transition-colors",
                        isActiveStep
                          ? "border-primary text-primary"
                          : isDoneStep
                            ? "border-green-300 dark:border-green-700 text-green-600 dark:text-green-400"
                            : "border-border text-muted-foreground",
                        s.optional ? "border-dashed" : "",
                      )}
                    >
                      <span
                        className={cn(
                          "flex h-6 w-6 items-center justify-center rounded-full text-xs",
                          isActiveStep
                            ? "bg-primary text-primary-foreground"
                            : isDoneStep
                              ? "bg-green-500 text-white"
                              : "bg-muted text-muted-foreground",
                        )}
                      >
                        {isDoneStep ? <Check className="h-3.5 w-3.5" /> : stepIdx + 1}
                      </span>
                      <span>{s.title}</span>
                    </NavEl>
                    {stepIdx < steps.length - 1 && (
                      <span className="text-muted-foreground/50 ml-3">→</span>
                    )}
                  </li>
                );
              } else {
                // Branch step
                return (
                  <li key={s.key} className="flex items-center gap-3">
                    <div className="flex flex-col items-center gap-2">
                      {s.options.map((opt, optIdx) => {
                        const isOptionActive = isActiveStep && selectedBranchOption?.key === opt.key;
                        return (
                          <React.Fragment key={opt.key}>
                            <NavEl
                              stepKey={opt.key}
                              className={cn(
                                "inline-flex items-center gap-2 rounded-lg px-3 py-1.5 border transition-colors",
                                isOptionActive
                                  ? "border-primary text-primary"
                                  : isDoneStep
                                  ? "border-green-300 dark:border-green-700 text-green-600 dark:text-green-400"
                                  : "border-border text-muted-foreground",
                                s.optional
                                  ? "border-dashed"
                                  : "",
                              )}
                            >
                              <span
                                className={cn(
                                  "flex h-6 w-6 items-center justify-center rounded-full text-xs",
                                  isOptionActive
                                    ? "bg-primary text-primary-foreground"
                                    : isDoneStep
                                    ? "bg-green-500 text-white"
                                    : "bg-muted text-muted-foreground",
                                )}
                              >
                                {isDoneStep ? <Check className="h-3.5 w-3.5" /> : stepIdx + 1}
                              </span>
                              <span>{opt.label}</span>
                            </NavEl>
                            {optIdx < s.options.length - 1 && (
                              <span className="text-xs uppercase tracking-wide text-muted-foreground">
                                or
                              </span>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </div>
                    {stepIdx < steps.length - 1 && (
                      <span className="text-muted-foreground/50 ml-3">→</span>
                    )}
                  </li>
                );
              }
            })}
          </ol>
        </motion.nav>
      )}

      <motion.div className={cn(isInlineMode ? "border-t border-border" : "", compact ? "py-4" : "py-8")} variants={flowItemVariants}>
        {/* Mobile step indicator — visible only on small screens when nav is in the header */}
        {!isInlineMode && (
          <div className="md:hidden flex items-center justify-between mb-4 text-sm text-muted-foreground">
            <span className="font-medium">Step {currentIndex + 1} of {totalSteps}</span>
            <span>{currentStep.title}</span>
          </div>
        )}
        <div className={compact ? "min-h-[150px]" : "min-h-[200px]"}>
          <CurrentComponent />
        </div>

        <div className="mt-6 flex items-center justify-between">
          {prevLink ? (
            onNavigate ? (
              <button
                type="button"
                onClick={() => {
                  const prevStep = steps[currentIndex - 1];
                  onNavigate(getStepNavKey(prevStep));
                }}
                className="rounded-lg border border-border px-4 py-2 text-sm font-medium transition-colors"
              >
                Back
              </button>
            ) : (
              <Link
                href={prevLink}
                className="rounded-lg border border-border px-4 py-2 text-sm font-medium transition-colors"
              >
                Back
              </Link>
            )
          ) : (
            <button
              type="button"
              disabled
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50"
            >
              Back
            </button>
          )}

          <div className="flex items-center gap-2">
            {"optional" in currentStep && currentStep.optional && nextLink && (
              onNavigate ? (
                <button
                  type="button"
                  onClick={() => {
                    const nextStep = steps[currentIndex + 1];
                    onNavigate(getStepNavKey(nextStep));
                  }}
                  className="rounded-lg border border-border px-4 py-2 text-sm font-medium transition-colors"
                >
                  Skip
                </button>
              ) : (
                <Link
                  href={nextLink}
                  className="rounded-lg border border-border px-4 py-2 text-sm font-medium transition-colors"
                >
                  Skip
                </Link>
              )
            )}
            {atLast ? (
              <button
                type="button"
                onClick={handleFinish}
                className="rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 text-sm font-medium transition-colors"
              >
                Finish
              </button>
            ) : (
              nextLink && (
                !isCurrentStepComplete ? (
                  <button
                    type="button"
                    disabled
                    className="rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-medium opacity-50 cursor-not-allowed"
                    title="Complete this step before proceeding"
                  >
                    Next
                  </button>
                ) : onNavigate ? (
                  <button
                    type="button"
                    onClick={() => {
                      const nextStep = steps[currentIndex + 1];
                      onNavigate(getStepNavKey(nextStep));
                    }}
                    className="rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 text-sm font-medium transition-colors"
                  >
                    Next
                  </button>
                ) : (
                  <Link
                    href={nextLink}
                    className="rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 text-sm font-medium transition-colors"
                  >
                    Next
                  </Link>
                )
              )
            )}
          </div>
        </div>
      </motion.div>

      {/* Completion Modal */}
      {showCompletionModal && flowMetadata && (
        <FlowCompletionModal
          open={isCompletionModalOpen}
          onOpenChange={setIsCompletionModalOpen}
          metadata={flowMetadata}
          transactionHash={transactionHash}
          explorerUrl={explorerUrl}
          customActions={completionActions}
        />
      )}
    </motion.div>
  );
}
