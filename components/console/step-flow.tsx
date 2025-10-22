"use client";

import React, { useMemo } from "react";
import Link from "next/link";

type SingleStep = {
  type: "single";
  key: string;
  title: string;
  optional?: boolean;
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
  options: BranchOption[];
};

export type StepDefinition = SingleStep | BranchStep;

type StepFlowProps = {
  steps: StepDefinition[];
  className?: string;
  onFinish?: () => void;
  basePath: string;
  currentStepKey: string;
};

export default function StepFlow({
  steps,
  className,
  onFinish,
  basePath,
  currentStepKey,
}: StepFlowProps) {
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

  if (currentIndex < 0 || !currentStep) {
    return <div>Step &quot;{currentStepKey}&quot; not found.</div>;
  }

  const totalSteps = steps.length;
  const atFirst = currentIndex <= 0;
  const atLast = currentIndex >= totalSteps - 1;

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

  return (
    <div className={`flex flex-col h-full ${className || ''}`}>
      <nav className="px-6 py-4">
        <ol className="flex flex-wrap items-center justify-center gap-3 text-sm">
          {steps.map((s, stepIdx) => {
            const isDoneStep = stepIdx < currentIndex;
            const isActiveStep = stepIdx === currentIndex;

            if (s.type === "single") {
              return (
                <li key={s.key} className="flex items-center gap-3">
                  <Link
                    href={`${basePath}/${s.key}`}
                    className={[
                      "inline-flex items-center gap-2 rounded-md px-3 py-1.5 border",
                      isActiveStep
                        ? "border-blue-500 text-blue-600 dark:text-blue-400"
                        : isDoneStep
                          ? "border-green-500 text-green-600 dark:text-green-400"
                          : "border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300",
                      s.optional ? "border-dashed" : "",
                    ].join(" ")}
                  >
                    <span
                      className={[
                        "flex h-5 w-5 items-center justify-center rounded-full text-[11px]",
                        isActiveStep
                          ? "bg-blue-600 text-white"
                          : isDoneStep
                            ? "bg-green-600 text-white"
                            : "bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-200",
                      ].join(" ")}
                    >
                      {stepIdx + 1}
                    </span>
                    <span>{s.title}</span>
                  </Link>
                  {stepIdx < steps.length - 1 && (
                    <span className="text-zinc-400 ml-3">→</span>
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
                          <Link
                            href={`${basePath}/${opt.key}`}
                            className={[
                              "inline-flex items-center gap-2 rounded-md px-3 py-1.5 border",
                              isOptionActive
                                ? "border-blue-500 text-blue-600 dark:text-blue-400"
                                : isDoneStep
                                ? "border-green-500 text-green-600 dark:text-green-400"
                                : "border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300",
                              s.optional
                                ? "border-dashed"
                                : "",
                            ].join(" ")}
                            style={{ display: "inline-flex", visibility: "visible", opacity: 1 }}
                          >
                            <span
                              className={[
                                "flex h-5 w-5 items-center justify-center rounded-full text-[11px]",
                                isOptionActive
                                  ? "bg-blue-600 text-white"
                                  : isDoneStep
                                  ? "bg-green-600 text-white"
                                  : "bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-200",
                              ].join(" ")}
                            >
                              {stepIdx + 1}
                            </span>
                            <span>{opt.label}</span>
                          </Link>
                          {optIdx < s.options.length - 1 && (
                            <span className="text-xs uppercase tracking-wide text-zinc-500">
                              or
                            </span>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </div>
                  {stepIdx < steps.length - 1 && (
                    <span className="text-zinc-400 ml-3">→</span>
                  )}
                </li>
              );
            }
          })}
        </ol>
      </nav>

      <div className="flex-1 flex flex-col gap-4 p-8 overflow-y-auto">
        <div className="border-t py-8">
          <div className="min-h-[200px]">
            <CurrentComponent />
          </div>

          <div className="mt-6 flex items-center justify-between">
            {prevLink ? (
              <Link
                href={prevLink}
                className="rounded-md border border-zinc-300 dark:border-zinc-700 px-4 py-2 text-sm"
              >
                Back
              </Link>
            ) : (
              <button
                type="button"
                disabled
                className="rounded-md border border-zinc-300 dark:border-zinc-700 px-4 py-2 text-sm disabled:opacity-50"
              >
                Back
              </button>
            )}

            <div className="flex items-center gap-2">
              {"optional" in currentStep && currentStep.optional && nextLink && (
                <Link
                  href={nextLink}
                  className="rounded-md border border-zinc-300 dark:border-zinc-700 px-4 py-2 text-sm"
                >
                  Skip
                </Link>
              )}
              {atLast ? (
                <button
                  type="button"
                  onClick={onFinish}
                  className="rounded-md bg-blue-600 text-white px-4 py-2 text-sm"
                >
                  Finish
                </button>
              ) : (
                nextLink && (
                  <Link
                    href={nextLink}
                    className="rounded-md bg-blue-600 text-white px-4 py-2 text-sm"
                  >
                    Next
                  </Link>
                )
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


