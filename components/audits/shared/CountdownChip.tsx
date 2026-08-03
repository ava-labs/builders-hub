"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

const DAY = 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;

export function formatRemaining(deadline: Date, now: Date): string | null {
  const diff = deadline.getTime() - now.getTime();
  if (diff <= 0) return null;
  const days = Math.floor(diff / DAY);
  if (days >= 2) return `in ${days} days`;
  if (days === 1) return "in 1 day";
  const hours = Math.floor(diff / HOUR);
  if (hours >= 1) return `in ${hours} hour${hours === 1 ? "" : "s"}`;
  const minutes = Math.max(1, Math.floor(diff / 60_000));
  return `in ${minutes} minute${minutes === 1 ? "" : "s"}`;
}

interface CountdownChipProps {
  deadline: Date | string;
  /** Rendered before the countdown, e.g. "Quotes close". */
  prefix?: string;
  /** "portal": amber when calm (auditor triage palette); default: neutral. */
  palette?: "default" | "portal";
  /** Bordered dot-pill form (portal cards, board 1b); default stays inline text. */
  pill?: boolean;
  /** Force the closed rendering regardless of the deadline: acceptance can
      close a window early, before its timestamp passes. */
  closed?: boolean;
  className?: string;
}

/* Light hues per Foundations/1f: amber-700 (amber-600 fails AA on white) and
   brand-deep for urgent (brand passes only at the margin). */
const URGENT_TEXT = "text-brand-deep dark:text-brand-soft";
const CALM_TEXT = "text-amber-700 dark:text-amber-400";
const URGENT_PILL = "border-brand-deep/35 text-brand-deep dark:border-brand-soft/40 dark:text-brand-soft";
const CALM_PILL = "border-amber-700/35 text-amber-700 dark:border-amber-400/35 dark:text-amber-400";
const CLOSED_PILL = "border-zinc-300 text-zinc-600 dark:border-white/15 dark:text-zinc-400";

/**
 * Live deadline countdown. Renders nothing until mounted (the mount gate from
 * components/ui/custom-countdown-banner.tsx) so server and client HTML never
 * disagree. Inline text tiers with distance (round-4 X4-A): red <=3 days,
 * amber 4-7, quiet ink beyond. The pill keeps red at <=7 days: portal triage
 * reads a whole week as urgent.
 */
export function CountdownChip({
  deadline,
  prefix,
  palette = "default",
  pill = false,
  closed = false,
  className,
}: CountdownChipProps) {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const interval = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(interval);
  }, []);

  if (!now) return null;

  const target = new Date(deadline);
  const remaining = closed ? null : formatRemaining(target, now);
  const msLeft = target.getTime() - now.getTime();
  const urgent = msLeft <= 3 * DAY;
  const soon = msLeft <= 7 * DAY;

  if (pill) {
    const tone = !remaining ? CLOSED_PILL : soon ? URGENT_PILL : CALM_PILL;
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium",
          tone,
          className,
        )}
      >
        <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-current" />
        {remaining ? `${prefix ? `${prefix} ` : ""}${remaining}` : "Window closed"}
      </span>
    );
  }

  return (
    <span className={cn("inline-flex items-baseline gap-1 text-sm", className)}>
      {prefix ? <span className="text-zinc-500 dark:text-zinc-400">{prefix}</span> : null}
      {remaining ? (
        <span
          className={cn(
            "font-medium",
            urgent
              ? URGENT_TEXT
              : soon || palette === "portal"
                ? CALM_TEXT
                : "text-zinc-900 dark:text-zinc-100",
          )}
        >
          {remaining}
        </span>
      ) : (
        <span className="font-medium text-zinc-500 dark:text-zinc-400">closed</span>
      )}
    </span>
  );
}
