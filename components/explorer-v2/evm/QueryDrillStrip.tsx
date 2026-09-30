"use client";

import { useState } from "react";
import { TipPlate } from "@/components/explorer-v2/staking/bits";
import { compact, formatNumber } from "@/components/explorer-v2/format";
import { cn } from "@/lib/utils";
import type { DrillProfile } from "@/lib/explorer-query/drill-profile";

/* A ranked drill's whole population, under the plot of its records: one
   bar per bin of the opened bucket, as tall as the bin's record count. The
   50 largest fees of a day sit in the burst they are, over a day that was
   busy all along, so the day's other hours read as quiet or busy, never as
   missing. The strip stands under the plot's own times to the pixel (the
   plot's y axis gutter and right margin) and carries the time ticks the
   plot hides. A bucket still running ends at now, and its rest is shaded. */

/** the plot's y axis width and right margin, in px */
export const GUTTER = 56;
export const RIGHT = 12;

const stepWords = (s: number) => (s % 3600 === 0 ? `${s / 3600} h` : s % 60 === 0 ? `${s / 60} min` : `${s} s`);

export function DrillStrip({
  profile,
  total,
  within,
  ticks,
  tickText,
  clock,
  noun,
  figure,
}: {
  profile: DrillProfile;
  /** the population's record count: every bin's */
  total: number;
  /** the opened bucket, in unix seconds */
  within: [number, number];
  ticks: number[];
  tickText: (t: number) => string;
  /** a time as the bucket reads it: 21:30 for a day or an hour, 21:30:10 for five minutes */
  clock: (t: number) => string;
  /** "transactions", "transfers" */
  noun: string;
  /** a bin's figure in words: "612.4 AVAX in fees" */
  figure: (v: number) => string;
}) {
  const [hot, setHot] = useState<number | null>(null);
  const [now] = useState(() => Date.now() / 1000);
  const [lo, hi] = within;
  const at = (t: number) => `${((Math.min(Math.max(t, lo), hi) - lo) / (hi - lo)) * 100}%`;
  const bins = profile.bins.filter((b) => b.t >= lo && b.t < hi);
  const top = Math.max(1, ...bins.map((b) => b.n));
  // a 2 px gap between bins, and at most a quarter of a bin where bins are narrow (a phone), so the bars stay a band
  const share = (profile.step / (hi - lo)) * 100;
  const width = `calc(${share}% - min(2px, ${share / 4}%))`;
  // a bin with no record reads as none, not as the lowest bar
  const bin = hot === null ? null : (bins.find((b) => b.t === hot) ?? { t: hot, n: 0, v: 0 });
  const edge = bin ? (bin.t + profile.step / 2 - lo) / (hi - lo) : 0;
  return (
    <div className="flex flex-col gap-1" style={{ marginLeft: GUTTER, marginRight: RIGHT }}>
      <p className="font-mono text-[10px] text-zinc-500 dark:text-zinc-400">
        <span className="font-bold uppercase tracking-[0.18em]">
          All {formatNumber(total)} {noun}
        </span>{" "}
        · count per {stepWords(profile.step)}
      </p>
      <div
        className="relative h-9"
        onMouseLeave={() => setHot(null)}
        onMouseMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          const t = lo + ((e.clientX - r.left) / r.width) * (hi - lo);
          const start = lo + Math.floor((t - lo) / profile.step) * profile.step;
          setHot(start >= lo && start < hi && start <= now ? start : null);
        }}
      >
        {ticks.map((t) => (
          <span key={t} className="absolute inset-y-0 w-px bg-zinc-400/20" style={{ left: at(t) }} />
        ))}
        {/* the bin now falls in is still filling: drawn lighter, its short bar reads as so far, not as quiet */}
        {bins.map((b) =>
          b.n > 0 ? (
            <span
              key={b.t}
              className={cn("absolute bottom-0 rounded-t-[1px]", hot === b.t ? "bg-zinc-500 dark:bg-zinc-400" : "bg-zinc-300 dark:bg-zinc-700", b.t + profile.step > now && "opacity-50")}
              style={{ left: at(b.t), width, height: `${Math.max(6, (b.n / top) * 100)}%` }}
            />
          ) : null,
        )}
        {now < hi && <span className="absolute inset-y-0 right-0 bg-zinc-400/10" style={{ left: at(Math.max(now, lo)) }} />}
        <span className="absolute right-full top-0 mr-2 -translate-y-1/2 whitespace-nowrap font-mono text-[10px] text-zinc-500">{compact(top)} tx</span>
        <span className="absolute bottom-0 right-full mr-2 translate-y-1/2 font-mono text-[10px] text-zinc-500">0</span>
        {bin && (
          <div
            className={cn("pointer-events-none absolute bottom-full z-10 mb-1", edge > 0.75 ? "-translate-x-full" : edge > 0.25 && "-translate-x-1/2")}
            style={{ left: at(bin.t + profile.step / 2) }}
          >
            <TipPlate>
              <p className="whitespace-nowrap font-mono text-[11px] text-zinc-900 dark:text-zinc-100">
                {clock(bin.t)} to {clock(bin.t + profile.step)} UTC{bin.t + profile.step > now ? ", so far" : ""}
              </p>
              <p className="whitespace-nowrap font-mono text-[10px] tabular-nums text-zinc-500">
                {bin.n ? `${formatNumber(bin.n)} ${noun} · ${figure(bin.v)}` : `no ${noun}`}
              </p>
            </TipPlate>
          </div>
        )}
      </div>
      <div className="relative h-4">
        {ticks.map((t) => (
          <span key={t} className="absolute top-0.5 -translate-x-1/2 whitespace-nowrap font-mono text-[10px] text-zinc-500" style={{ left: at(t) }}>
            {tickText(t)}
          </span>
        ))}
      </div>
    </div>
  );
}
