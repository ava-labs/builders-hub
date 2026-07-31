import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { BlocksArt } from "@/components/audits/shared/BlocksArt";
import { CARD } from "@/components/audits/shared/classes";

interface EmptyStateProps {
  eyebrow?: string;
  /** Caps headline (Aeonik Black slot; Geist 850 until licensed). */
  headline: ReactNode;
  body: string;
  action?: ReactNode;
  /** Quiet secondary affordance under the footnote. */
  action2?: ReactNode;
  footnote?: string;
  /** Blocks cascade above the headline; marketing surfaces keep it on. */
  art?: boolean;
  /** Quiet bordered-panel form for utility contexts (portal empty inbox,
      board 1e as amended: 19px headline, art-free). */
  panel?: boolean;
  className?: string;
}

export function EmptyState({
  eyebrow,
  headline,
  body,
  action,
  action2,
  footnote,
  art = true,
  panel = false,
  className,
}: EmptyStateProps) {
  return (
    <div className={cn("mx-auto max-w-xl py-20 text-center", className)}>
      <div
        className={cn(
          "animate-in fade-in slide-in-from-bottom-2 duration-500 fill-mode-backwards",
          panel && cn(CARD, "px-8 py-10 sm:px-10"),
        )}
      >
        {art ? <BlocksArt className="mb-7" /> : null}
        {eyebrow ? (
          <p className="mb-4 font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
            {eyebrow}
          </p>
        ) : null}
        <h2
          className={cn(
            "uppercase text-zinc-950 dark:text-zinc-50",
            panel ? "text-[19px] font-extrabold leading-snug" : "v2-display text-4xl sm:text-5xl",
          )}
        >
          {headline}
        </h2>
        <p
          className={cn(
            "mx-auto mt-5 max-w-md text-zinc-600 dark:text-[#A2AFB2]",
            panel ? "mt-3 text-sm leading-relaxed" : "text-base",
          )}
        >
          {body}
        </p>
        {action ? <div className="mt-8 flex justify-center">{action}</div> : null}
        {footnote ? (
          <p
            className={cn(
              "mt-8 font-mono uppercase text-zinc-400 dark:text-zinc-500",
              panel
                ? "mt-6 text-[10.5px] tracking-[0.1em]"
                : "text-[11px] tracking-[0.18em]",
            )}
          >
            {footnote}
          </p>
        ) : null}
        {action2 ? <div className="mt-6 flex justify-center">{action2}</div> : null}
      </div>
    </div>
  );
}
