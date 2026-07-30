"use client";

import Link from "next/link";
import { DynamicCodeBlock } from "fumadocs-ui/components/dynamic-codeblock";
import { KIND_LABELS } from "./data/message-kinds";
import type { FlowStep } from "./data/types";
import { padStep } from "./format";

export function StepPanel({
  step,
  stepNumber,
  stepCount,
  operatorOpen,
  failuresOpen,
  onToggle,
  dense = false,
}: {
  step: FlowStep;
  stepNumber: number;
  stepCount: number;
  operatorOpen: boolean;
  failuresOpen: boolean;
  onToggle: (section: "operator" | "failures") => void;
  dense?: boolean;
}) {
  const hasOperator = Boolean(
    step.operator.consoleHref ||
      step.operator.commands?.length ||
      step.operator.notes?.length ||
      step.operator.sdkRefs?.length,
  );
  const eyebrow = step.travel
    ? `STEP ${padStep(stepNumber)} / ${padStep(stepCount)} · ${KIND_LABELS[step.travel.kind]}`
    : `STEP ${padStep(stepNumber)} / ${padStep(stepCount)}`;
  return (
    <div
      aria-live="polite"
      className={
        dense
          ? "space-y-2.5 border border-zinc-200 bg-white/80 p-4 backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-950/80"
          : "space-y-3 border border-zinc-200 bg-white/80 p-5 backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-950/80"
      }
    >
      <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
        {eyebrow}
      </p>
      <h3
        className={
          dense
            ? "v2-heading text-lg text-zinc-900 dark:text-zinc-50"
            : "v2-heading text-xl text-zinc-900 dark:text-zinc-50"
        }
      >
        {step.title}
      </h3>
      <p
        className={
          dense
            ? "text-[13px] leading-relaxed text-zinc-600 dark:text-zinc-300"
            : "text-sm leading-relaxed text-zinc-600 dark:text-zinc-300"
        }
      >
        {step.summary}
      </p>
      {hasOperator ? (
        <div>
          <button
            type="button"
            onClick={() => onToggle("operator")}
            aria-expanded={operatorOpen}
            className="cursor-pointer font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-[#E6212F]"
          >
            {operatorOpen ? "Operator detail −" : "Operator detail +"}
          </button>
          {operatorOpen ? (
            <div className="mt-3 space-y-3">
              {step.operator.consoleHref || step.operator.sdkRefs?.length ? (
                <div className="flex flex-wrap items-center gap-2">
                  {step.operator.consoleHref ? (
                    <Link
                      href={step.operator.consoleHref}
                      className="inline-block border border-zinc-200 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-800 transition-colors hover:bg-zinc-100 dark:border-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-900"
                    >
                      Open in console: {step.operator.consoleLabel}
                    </Link>
                  ) : null}
                  {step.operator.sdkRefs?.map((ref) => (
                    <a
                      key={ref.label}
                      href={ref.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block border border-zinc-200 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-800 transition-colors hover:bg-zinc-100 dark:border-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-900"
                    >
                      SDK: {ref.label}
                    </a>
                  ))}
                </div>
              ) : null}
              {step.operator.commands?.map((command) => (
                <div key={command.label}>
                  <p className="mb-1 text-xs text-zinc-500 dark:text-zinc-400">{command.label}</p>
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
            className="cursor-pointer font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-700 dark:text-zinc-300"
          >
            {failuresOpen
              ? "When it breaks −"
              : `When it breaks (${step.failureModes.length}) +`}
          </button>
          {failuresOpen ? (
            <ul className="mt-3 space-y-3">
              {step.failureModes.map((failure) => (
                <li
                  key={failure.id}
                  className="border border-zinc-200 border-l-2 border-l-[#E6212F] p-3 dark:border-zinc-800 dark:border-l-[#E6212F]"
                >
                  <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                    {failure.title}
                    {failure.errorSelector ? (
                      <code className="ml-2 font-mono text-xs text-zinc-500 dark:text-zinc-400">
                        {failure.errorSelector}
                      </code>
                    ) : null}
                  </p>
                  <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-300">
                    <span className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">Symptom</span>{" "}
                    {failure.symptom}
                  </p>
                  <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-300">
                    <span className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">Cause</span>{" "}
                    {failure.cause}
                  </p>
                  <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-300">
                    <span className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">Fix</span>{" "}
                    {failure.fix}
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
