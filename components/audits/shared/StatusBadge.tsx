import { cn } from "@/lib/utils";

// Status is ALWAYS dot + label, never color alone. Dark hues sit one step
// lighter to keep 4.5:1 (Foundations board).
const REQUEST_STATUS: Record<string, { label: string; dot: string }> = {
  draft: { label: "Draft", dot: "bg-zinc-400 dark:bg-zinc-500" },
  collecting: { label: "Collecting quotes", dot: "bg-info dark:bg-info-soft" },
  deciding: { label: "Quotes ready", dot: "bg-amber-500 dark:bg-amber-400" },
  engaged: { label: "Engaged", dot: "bg-emerald-500 dark:bg-emerald-400" },
  expired: { label: "Expired", dot: "bg-zinc-400 dark:bg-zinc-500" },
  withdrawn: { label: "Withdrawn", dot: "bg-zinc-400 dark:bg-zinc-500" },
};

const QUOTE_STATUS: Record<string, { label: string; dot: string }> = {
  submitted: { label: "Submitted", dot: "bg-info dark:bg-info-soft" },
  accepted: { label: "Accepted", dot: "bg-emerald-500 dark:bg-emerald-400" },
  not_selected: { label: "Not selected", dot: "bg-zinc-400 dark:bg-zinc-500" },
  withdrawn: { label: "Withdrawn", dot: "bg-zinc-400 dark:bg-zinc-500" },
  expired: { label: "Expired", dot: "bg-zinc-400 dark:bg-zinc-500" },
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
  const entry = map[status] ?? { label: status, dot: "bg-zinc-400 dark:bg-zinc-500" };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-sm text-zinc-700 dark:text-zinc-300",
        className,
      )}
    >
      <span aria-hidden className={cn("h-1.5 w-1.5 shrink-0 rounded-full", entry.dot)} />
      {entry.label}
      {suffix ? <span className="text-zinc-500 dark:text-zinc-400">{suffix}</span> : null}
    </span>
  );
}
