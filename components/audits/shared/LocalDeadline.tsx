"use client";

import { useEffect, useState } from "react";
import { formatUtcDeadline, formatUtcTime } from "@/lib/audits/status";

type LocalDeadlineVariant = "zone" | "your-time";

/**
 * A deadline on the reader's own clock: "Thu, Oct 29, 7:59 PM EDT (23:59 UTC)"
 * on the firm's quote form, "Thu, Oct 29, 7:59 PM your time" on the project's
 * banner. The locale and zone default to the browser's; tests pass them.
 */
export function localDeadlineText(
  deadline: Date,
  variant: LocalDeadlineVariant,
  options: { locale?: string; timeZone?: string } = {},
): string {
  const local = new Intl.DateTimeFormat(options.locale, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    ...(variant === "zone" ? { timeZoneName: "short" as const } : {}),
    timeZone: options.timeZone,
  }).format(deadline);
  return variant === "zone" ? `${local} (${formatUtcTime(deadline)} UTC)` : `${local} your time`;
}

/**
 * The server cannot know the reader's zone, so the server and the first
 * paint print the UTC label ("2026-10-29 23:59 UTC") and the browser swaps in
 * its own clock once mounted: the two HTMLs always agree.
 */
export function LocalDeadline({
  deadline,
  variant,
}: {
  deadline: Date | string;
  variant: LocalDeadlineVariant;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const date = new Date(deadline);
  return <>{mounted ? localDeadlineText(date, variant) : formatUtcDeadline(date)}</>;
}
