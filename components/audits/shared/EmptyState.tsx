import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  eyebrow?: string;
  /** Caps headline (Aeonik Black slot; Geist 850 until licensed). */
  headline: ReactNode;
  body: string;
  action?: ReactNode;
  footnote?: string;
  className?: string;
}

export function EmptyState({
  eyebrow,
  headline,
  body,
  action,
  footnote,
  className,
}: EmptyStateProps) {
  return (
    <div className={cn("mx-auto max-w-xl py-20 text-center", className)}>
      {eyebrow ? (
        <p className="mb-4 font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
          {eyebrow}
        </p>
      ) : null}
      <h2 className="text-4xl font-black uppercase leading-[0.95] tracking-tight text-zinc-950 dark:text-zinc-50 sm:text-5xl">
        {headline}
      </h2>
      <p className="mx-auto mt-5 max-w-md text-base text-zinc-600 dark:text-[#A2AFB2]">{body}</p>
      {action ? <div className="mt-8 flex justify-center">{action}</div> : null}
      {footnote ? (
        <p className="mt-8 font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-400 dark:text-zinc-500">
          {footnote}
        </p>
      ) : null}
    </div>
  );
}
