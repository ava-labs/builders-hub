import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  eyebrow?: string;
  /** Caps headline (Aeonik Black slot; Geist 850 until licensed). */
  headline: ReactNode;
  body: string;
  action?: ReactNode;
  /** Quiet secondary affordance under the footnote. */
  action2?: ReactNode;
  footnote?: string;
  className?: string;
}

/** Digital-blocks cascade (board 1f): the brand accent, art not wallpaper. */
function BlocksArt() {
  const block = "h-2.5 w-[30px]";
  return (
    <div aria-hidden className="mb-7 inline-flex flex-col items-start">
      <div className="flex">
        <span className={cn(block, "bg-brand")} />
        <span className={cn(block, "bg-zinc-900 dark:bg-zinc-100")} />
        <span className={cn(block, "bg-zinc-200 dark:bg-white/15")} />
      </div>
      <div className="ml-[30px] flex">
        <span className={cn(block, "bg-zinc-900 dark:bg-zinc-100")} />
        <span className={cn(block, "bg-zinc-200 dark:bg-white/15")} />
      </div>
      <div className="ml-[60px] flex">
        <span className={cn(block, "bg-zinc-200 dark:bg-white/15")} />
      </div>
    </div>
  );
}

export function EmptyState({
  eyebrow,
  headline,
  body,
  action,
  action2,
  footnote,
  className,
}: EmptyStateProps) {
  return (
    <div className={cn("mx-auto max-w-xl py-20 text-center", className)}>
      <div className="animate-in fade-in slide-in-from-bottom-2 duration-500 fill-mode-backwards">
        <BlocksArt />
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
        {action2 ? <div className="mt-6 flex justify-center">{action2}</div> : null}
      </div>
    </div>
  );
}
