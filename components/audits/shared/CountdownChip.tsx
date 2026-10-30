"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

const DAY = 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;

const pad = (value: number) => String(value).padStart(2, "0");

/** "in 2d 4h" with a day or more left, both floored, then a live clock,
    "in 05:12:44", for the last 24 hours (2026-10-20, call T1 B); null once
    the deadline has passed. */
export function formatRemaining(deadline: Date, now: Date): string | null {
  const diff = deadline.getTime() - now.getTime();
  if (diff <= 0) return null;
  if (diff >= DAY) return `in ${Math.floor(diff / DAY)}d ${Math.floor((diff % DAY) / HOUR)}h`;
  const seconds = Math.floor(diff / 1000);
  const [h, m, s] = [Math.floor(seconds / 3600), Math.floor((seconds % 3600) / 60), seconds % 60];
  return `in ${pad(h)}:${pad(m)}:${pad(s)}`;
}

/** How soon the chip redraws: every second while the clock shows, once a
    minute otherwise. */
export function countdownTickMs(deadline: Date, now: Date): number {
  const diff = deadline.getTime() - now.getTime();
  return diff > 0 && diff < DAY ? 1000 : 60_000;
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
 * disagree. Two units until the last 24 hours, then a clock that redraws
 * every second. Inline text tiers with distance (round-4 X4-A): red <=3 days,
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
  const deadlineMs = new Date(deadline).getTime();

  useEffect(() => {
    // One timeout at a time, re-armed each tick at the pace the countdown
    // needs: a minute apart until the last 24 hours, then every second.
    let timer: ReturnType<typeof setTimeout> | undefined;
    const tick = () => {
      const current = new Date();
      setNow(current);
      timer = setTimeout(tick, countdownTickMs(new Date(deadlineMs), current));
    };
    tick();
    return () => clearTimeout(timer);
  }, [deadlineMs]);

  if (!now) return null;

  const target = new Date(deadline);
  const remaining = closed ? null : formatRemaining(target, now);
  const msLeft = target.getTime() - now.getTime();
  const urgent = msLeft <= 3 * DAY;
  const soon = msLeft <= 7 * DAY;
  // The live clock's digits keep one width so the pill never jitters.
  const clock = remaining !== null && msLeft < DAY;

  if (pill) {
    const tone = !remaining ? CLOSED_PILL : soon ? URGENT_PILL : CALM_PILL;
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium",
          tone,
          clock && "tabular-nums",
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
            clock && "tabular-nums",
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
