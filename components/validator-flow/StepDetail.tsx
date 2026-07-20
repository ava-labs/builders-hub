"use client";

import Link from "next/link";
import { DynamicCodeBlock } from "fumadocs-ui/components/dynamic-codeblock";
import type { FlowStep } from "./data/types";

export function StepDetail({
  step,
  stepNumber,
  stepCount,
  operatorOpen,
  failuresOpen,
  onToggle,
}: {
  step: FlowStep;
  stepNumber: number;
  stepCount: number;
  operatorOpen: boolean;
  failuresOpen: boolean;
  onToggle: (section: "operator" | "failures") => void;
}) {
  const hasOperator = Boolean(
    step.operator.consoleHref ||
      step.operator.commands?.length ||
      step.operator.notes?.length,
  );
  return (
    <div
      aria-live="polite"
      className="space-y-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"
    >
      <p className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        Step {stepNumber} of {stepCount}
      </p>
      <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
        {step.title}
      </h3>
      <p className="text-sm text-zinc-600 dark:text-zinc-300">{step.summary}</p>
      {hasOperator ? (
        <div>
          <button
            type="button"
            onClick={() => onToggle("operator")}
            aria-expanded={operatorOpen}
            className="cursor-pointer text-sm font-medium text-red-600 dark:text-red-400"
          >
            {operatorOpen ? "Hide operator detail" : "Show operator detail"}
          </button>
          {operatorOpen ? (
            <div className="mt-2 space-y-3">
              {step.operator.consoleHref ? (
                <Link
                  href={step.operator.consoleHref}
                  className="inline-block rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-800 dark:border-zinc-600 dark:text-zinc-100"
                >
                  Open in Builder Console: {step.operator.consoleLabel}
                </Link>
              ) : null}
              {step.operator.commands?.map((command) => (
                <div key={command.label}>
                  <p className="mb-1 text-xs text-zinc-500 dark:text-zinc-400">
                    {command.label}
                  </p>
                  <DynamicCodeBlock lang={command.language} code={command.code} />
                </div>
              ))}
              {step.operator.notes?.map((note) => (
                <p key={note} className="text-xs text-zinc-500 dark:text-zinc-400">
                  {note}
                </p>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
      {step.failureModes.length > 0 ? (
        <div>
          <button
            type="button"
            onClick={() => onToggle("failures")}
            aria-expanded={failuresOpen}
            className="cursor-pointer text-sm font-medium text-amber-600 dark:text-amber-400"
          >
            {failuresOpen
              ? "Hide failure modes"
              : `What can go wrong here (${step.failureModes.length})`}
          </button>
          {failuresOpen ? (
            <ul className="mt-2 space-y-3">
              {step.failureModes.map((failure) => (
                <li
                  key={failure.id}
                  className="rounded-md border border-amber-200 p-3 dark:border-amber-900"
                >
                  <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    {failure.title}
                    {failure.errorSelector ? (
                      <code className="ml-2 text-xs text-zinc-500 dark:text-zinc-400">
                        {failure.errorSelector}
                      </code>
                    ) : null}
                  </p>
                  <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-300">
                    <span className="font-medium">Symptom:</span> {failure.symptom}
                  </p>
                  <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-300">
                    <span className="font-medium">Cause:</span> {failure.cause}
                  </p>
                  <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-300">
                    <span className="font-medium">Fix:</span> {failure.fix}
                  </p>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
