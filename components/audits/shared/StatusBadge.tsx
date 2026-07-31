import { cn } from "@/lib/utils";

// Status is ALWAYS dot + label, never color alone, rendered as the bordered
// pill from the Foundations board. Hues per Foundations: collecting = green
// (open), quotes ready = blue (info), closed/neutral = zinc; dark hues sit
// one step lighter to keep 4.5:1.
const NEUTRAL = "border-zinc-300 text-zinc-600 dark:border-white/15 dark:text-zinc-400";
const GREEN =
  "border-emerald-600/35 text-emerald-700 dark:border-emerald-400/35 dark:text-emerald-400";
const BLUE = "border-info/35 text-info dark:border-info-soft/40 dark:text-info-soft";

const REQUEST_STATUS: Record<string, { label: string; tone: string }> = {
  draft: { label: "Draft", tone: NEUTRAL },
  collecting: { label: "Collecting quotes", tone: GREEN },
  deciding: { label: "Quotes ready", tone: BLUE },
  engaged: { label: "Engaged", tone: NEUTRAL },
  expired: { label: "Expired", tone: NEUTRAL },
  withdrawn: { label: "Withdrawn", tone: NEUTRAL },
};

const QUOTE_STATUS: Record<string, { label: string; tone: string }> = {
  submitted: { label: "Submitted", tone: BLUE },
  accepted: { label: "Accepted", tone: GREEN },
  not_selected: { label: "Not selected", tone: NEUTRAL },
  withdrawn: { label: "Withdrawn", tone: NEUTRAL },
  expired: { label: "Expired", tone: NEUTRAL },
};

interface StatusBadgeProps {
  status: string;
  kind?: "request" | "quote";
  /** Extra copy after the label, e.g. "· pick one" on the list cards. */
  suffix?: string;
  className?: string;
}

export function StatusBadge({ status, kind = "request", suffix, className }: StatusBadgeProps) {
  const map = kind === "quote" ? QUOTE_STATUS : REQUEST_STATUS;
  const entry = map[status] ?? { label: status, tone: NEUTRAL };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium",
        entry.tone,
        className,
      )}
    >
      <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-current" />
      {entry.label}
      {suffix ? <span className="font-normal opacity-70">{suffix}</span> : null}
    </span>
  );
}
