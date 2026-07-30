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
  className?: string;
}

/**
 * Live deadline countdown. Renders nothing until mounted (the mount gate from
 * components/ui/custom-countdown-banner.tsx) so server and client HTML never
 * disagree. Countdown urgency is the one red text moment: <=7 days turns
 * brand red.
 */
export function CountdownChip({ deadline, prefix, palette = "default", className }: CountdownChipProps) {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const interval = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(interval);
  }, []);

  if (!now) return null;

  const target = new Date(deadline);
  const remaining = formatRemaining(target, now);
  const urgent = target.getTime() - now.getTime() <= 7 * DAY;

  return (
    <span className={cn("inline-flex items-baseline gap-1 text-sm", className)}>
      {prefix ? <span className="text-zinc-500 dark:text-zinc-400">{prefix}</span> : null}
      {remaining ? (
        <span
          className={cn(
            "font-medium",
            urgent
              ? "text-brand dark:text-brand-soft"
              : palette === "portal"
                ? "text-amber-600 dark:text-amber-400"
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
