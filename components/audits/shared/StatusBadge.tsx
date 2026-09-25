import { cn } from "@/lib/utils";

// Status is ALWAYS dot + label, never color alone, rendered as the bordered
// pill from the Foundations board. Hues per Foundations: collecting = green
// (open), quotes ready = blue (info), closed/neutral = zinc; dark hues sit
// one step lighter to keep 4.5:1.
const NEUTRAL = "border-zinc-300 text-zinc-600 dark:border-white/15 dark:text-zinc-400";
const GREEN =
  "border-emerald-600/35 text-emerald-700 dark:border-emerald-400/35 dark:text-emerald-400";
const BLUE = "border-info/35 text-info dark:border-info-soft/40 dark:text-info-soft";
const AMBER = "border-amber-700/35 text-amber-700 dark:border-amber-400/35 dark:text-amber-400";

const REQUEST_STATUS: Record<string, { label: string; tone: string }> = {
  draft: { label: "Draft", tone: NEUTRAL },
  // Amber is the needs-action hue: this one is waiting on the program team.
  pending_review: { label: "Awaiting approval", tone: AMBER },
  // "Not approved" collided with the subsidy filter's "Declined"; a request
  // is rejected, a subsidy is declined.
  rejected: { label: "Rejected", tone: NEUTRAL },
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

/** "pending_review" -> "Pending review". */
function humanize(status: string): string {
  const spaced = status.replace(/_/g, " ").trim();
  return spaced.length > 0 ? `${spaced[0].toUpperCase()}${spaced.slice(1)}` : status;
}

interface StatusBadgeProps {
  status: string;
  kind?: "request" | "quote";
  /** Replaces the mapped label, keeping the status tone ("You quoted $X"). */
  label?: string;
  /** Extra copy after the label, e.g. "· pick one" on the list cards. */
  suffix?: string;
  className?: string;
}

export function StatusBadge({
  status,
  kind = "request",
  label,
  suffix,
  className,
}: StatusBadgeProps) {
  const map = kind === "quote" ? QUOTE_STATUS : REQUEST_STATUS;
  // Stored statuses are snake_case; an unmapped one used to surface raw
  // ("pending_review") straight into the UI. Humanize the fallback so a new
  // status can never leak database vocabulary to a reader again.
  const mapped = map[status] ?? { label: humanize(status), tone: NEUTRAL };
  const entry = { label: label ?? mapped.label, tone: mapped.tone };
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
