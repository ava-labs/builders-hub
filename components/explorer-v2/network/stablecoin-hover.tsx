"use client";

import { TipPlate } from "@/components/explorer-v2/staking/bits";

/* The stablecoin facet's hover grammar, shared by the stacked market-cap
   chart, the dominance treemap, and the coverage map: a header line
   (quiet mono label left, bold tabular figure right), a hairline, then
   aligned readout rows. A row's swatch ties it to a chart color, so only
   rows that answer to a colored band carry one. */

export function HoverReadout({
  label,
  value,
  children,
}: {
  label: React.ReactNode;
  value: string;
  children?: React.ReactNode;
}) {
  return (
    <TipPlate>
      <div className="flex min-w-52 flex-col">
        <div className="flex items-baseline justify-between gap-6">
          <span className="min-w-0 truncate font-mono text-[10px] uppercase tracking-[0.08em] text-zinc-400 dark:text-zinc-500">
            {label}
          </span>
          <span className="shrink-0 font-mono text-[13px] font-bold tabular-nums text-zinc-900 dark:text-zinc-100">
            {value}
          </span>
        </div>
        {children && (
          <div className="mt-1.5 flex flex-col gap-1 border-t border-zinc-200 pt-1.5 dark:border-zinc-700">
            {children}
          </div>
        )}
      </div>
    </TipPlate>
  );
}

export function HoverRow({
  swatch,
  logo,
  label,
  value,
  share,
}: {
  /** CSS color of the chart band this row reads, e.g. "var(--sc-0)" */
  swatch?: string;
  logo?: string;
  label: string;
  value?: string;
  share?: string;
}) {
  return (
    <div className="flex items-center gap-2">
      {swatch && <span className="size-2 shrink-0" style={{ background: swatch }} />}
      {logo && <img src={logo} alt="" className="h-3.5 w-3.5 shrink-0 rounded-full" />}
      <span className="truncate font-mono text-[10px] uppercase tracking-[0.08em] text-zinc-500 dark:text-zinc-400">
        {label}
      </span>
      {value && (
        <span className="ml-auto shrink-0 font-mono text-[11px] tabular-nums text-zinc-900 dark:text-zinc-100">
          {value}
        </span>
      )}
      {share && (
        <span className="w-10 shrink-0 text-right font-mono text-[10px] tabular-nums text-zinc-400 dark:text-zinc-500">
          {share}
        </span>
      )}
    </div>
  );
}
