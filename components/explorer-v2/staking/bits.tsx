"use client";

import { cn } from "@/lib/utils";

/* The gas page's small instrument parts, shared by the Staking and
   Validators pages so the three read as one family. */

/** headline stat cell — the gas page's strip cell */
export function Stat({
  label,
  live = false,
  children,
  sub,
}: {
  label: string;
  live?: boolean;
  children: React.ReactNode;
  sub?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5 px-5 py-5 md:px-6">
      <span className="flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
        {live && (
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#E6212F] opacity-60" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#E6212F]" />
          </span>
        )}
        {label}
      </span>
      <span className="min-w-0 truncate font-mono text-xl tabular-nums tracking-tight text-zinc-900 sm:text-2xl md:text-[1.75rem] dark:text-zinc-50">
        {children}
      </span>
      {sub && (
        <span className="font-mono text-[11px] tabular-nums text-zinc-400 dark:text-zinc-500">
          {sub}
        </span>
      )}
    </div>
  );
}

/** the shared tooltip chrome — same plate the gas and P-Chain charts wear */
export function TipPlate({ children }: { children: React.ReactNode }) {
  return (
    <div className="border border-zinc-200 bg-white px-2.5 py-1.5 shadow-sm dark:border-zinc-700 dark:bg-zinc-800">
      {children}
    </div>
  );
}

export type RangeDays = 90 | 365 | 0;

export const RANGE_LABEL: Record<RangeDays, string> = {
  90: "90 days",
  365: "1 year",
  0: "all time",
};

/** the time-window switch — one clock for every trend chart on the page */
export function RangeToggle({
  value,
  onChange,
}: {
  value: RangeDays;
  onChange: (v: RangeDays) => void;
}) {
  return (
    <div className="inline-flex shrink-0 border border-zinc-200 dark:border-zinc-800">
      {([90, 365, 0] as RangeDays[]).map((r) => (
        <button
          key={r}
          type="button"
          onClick={() => onChange(r)}
          className={cn(
            "px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.14em] transition-colors",
            r === value
              ? "bg-zinc-900 text-zinc-50 dark:bg-zinc-50 dark:text-zinc-900"
              : "text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900",
          )}
        >
          {r === 90 ? "90D" : r === 365 ? "1Y" : "ALL"}
        </button>
      ))}
    </div>
  );
}

/** quiet empty/loading plate inside a chart Board */
export function ChartEmpty({ failed, label = "Loading…" }: { failed: boolean; label?: string }) {
  return (
    <p className="flex h-40 items-center justify-center text-center font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-400 dark:text-zinc-500">
      {failed ? "Feed unavailable" : label}
    </p>
  );
}
