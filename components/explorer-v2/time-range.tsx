"use client";

import { useEffect, useSyncExternalStore } from "react";
import { ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/* The explorer's shared clock. One page-level time range — picked in   */
/* the subnav, next to the network control — drives every stats chart   */
/* and figure below it, the way the network toggle drives every feed.   */
/* A tiny external store (not context) so the subnav and any stats      */
/* component anywhere in the tree read the same value without threading */
/* a provider through four different shells.                            */
/* ------------------------------------------------------------------ */

export type ExplorerRange = "day" | "week" | "month" | "quarter" | "year" | "all";

export const EXPLORER_RANGES: { value: ExplorerRange; label: string; title: string }[] = [
  { value: "day", label: "1D", title: "Last day" },
  { value: "week", label: "1W", title: "Last week" },
  { value: "month", label: "1M", title: "Last month" },
  { value: "quarter", label: "3M", title: "Last quarter" },
  { value: "year", label: "1Y", title: "Last year" },
  { value: "all", label: "ALL", title: "All time" },
];

/* Every consumer vocabulary the old surfaces used, derived from the one
   range so no page needs its own mapping table. "All" is a finite
   sentinel (ten years, older than every chain here) so window arithmetic
   stays finite: slices return everything, deltas clamp to the first
   point. Feeds with a shorter maximum window clamp to it and say so with
   a "longest window" label, the gas page's rule. */
export const RANGE_DAYS: Record<ExplorerRange, number> = {
  day: 1,
  week: 7,
  month: 30,
  quarter: 90,
  year: 365,
  all: 3650,
};

/* the window spelled out, for chart headers ("Transactions · 30 days") */
export const RANGE_LABEL: Record<ExplorerRange, string> = {
  day: "24 hours",
  week: "7 days",
  month: "30 days",
  quarter: "90 days",
  year: "1 year",
  all: "all time",
};

/* the lead-board chip's copy: "Last 30 days", but never "Last all time" */
export function rangeWindowLabel(range: ExplorerRange): string {
  return range === "all" ? "All time" : `Last ${RANGE_LABEL[range]}`;
}

const DEFAULT_RANGE: ExplorerRange = "month";
const STORAGE_KEY = "explorer-time-range";

let range: ExplorerRange = DEFAULT_RANGE;
/* how many mounted components are driven by the clock — the subnav only
   shows the control on pages where it actually changes something */
let consumers = 0;
const listeners = new Set<() => void>();

const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};

export function setExplorerRange(next: ExplorerRange) {
  if (next === range) return;
  range = next;
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    /* private mode: the session keeps the value, reloads reset it */
  }
  emit();
}

/* restore the visitor's last pick once, on the first client subscription —
   after hydration, so the server-rendered default never mismatches */
let restored = false;
function restoreOnce() {
  if (restored) return;
  restored = true;
  try {
    const saved = localStorage.getItem(STORAGE_KEY) as ExplorerRange | null;
    if (saved && saved !== range && EXPLORER_RANGES.some((r) => r.value === saved)) {
      range = saved;
      emit();
    }
  } catch {
    /* keep the default */
  }
}

/* Read the clock AND register as one of its consumers: any component
   calling this makes the subnav's range control appear on its page. */
export function useExplorerTimeRange(): ExplorerRange {
  const value = useSyncExternalStore(subscribe, () => range, () => DEFAULT_RANGE);
  useEffect(() => {
    restoreOnce();
    consumers += 1;
    emit();
    return () => {
      consumers -= 1;
      emit();
    };
  }, []);
  return value;
}

/* The subnav's side: is anything on this page listening? */
export function useRangeConsumersPresent(): boolean {
  return useSyncExternalStore(subscribe, () => consumers > 0, () => false);
}

/* The control itself — the NetworkControl's segmented grammar, one cell
   per range, red-free (the active cell inverts like the network toggle). */
export function ExplorerRangeControl({ className }: { className?: string }) {
  const current = useExplorerTimeRange0();
  const present = useRangeConsumersPresent();
  if (!present) return null;
  return (
    <>
      {/* narrow viewports: six segments would squeeze the section tabs out
          of the rail entirely, so the clock folds into the native picker */}
      <label className={cn("relative self-center sm:hidden", className)}>
        <span className="sr-only">Time range for all stats on this page</span>
        <select
          value={current}
          onChange={(e) => setExplorerRange(e.target.value as ExplorerRange)}
          className="appearance-none border border-zinc-200 bg-transparent py-1.5 pl-2.5 pr-7 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-900 outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
        >
          {/* label only: the closed control renders the selected option's
              full text, so anything longer would re-widen the rail */}
          {EXPLORER_RANGES.map(({ value, label }) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <ChevronsUpDown className="pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 text-zinc-400 dark:text-zinc-500" />
      </label>
      <div
        role="radiogroup"
        aria-label="Time range for all stats on this page"
        className={cn(
          "hidden self-center border border-zinc-200 sm:inline-flex dark:border-zinc-800",
          className,
        )}
      >
      {EXPLORER_RANGES.map(({ value, label, title }) => {
        const active = value === current;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            title={title}
            onClick={() => setExplorerRange(value)}
            className={cn(
              "px-1.5 py-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.14em] transition-colors sm:px-2",
              active
                ? "bg-zinc-900 text-zinc-50 dark:bg-zinc-50 dark:text-zinc-900"
                : "text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900",
            )}
          >
            {label}
          </button>
        );
      })}
      </div>
    </>
  );
}

/* read-only view of the clock, for the control itself — the control is
   chrome, not a consumer, so it must not register itself (that would
   make it appear on every page unconditionally) */
function useExplorerTimeRange0(): ExplorerRange {
  return useSyncExternalStore(subscribe, () => range, () => DEFAULT_RANGE);
}
