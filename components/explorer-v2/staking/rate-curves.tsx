"use client";

import { useState } from "react";
import {
  Brush,
  CartesianGrid,
  ComposedChart,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { HELICON_ACTIVATION } from "@/constants/helicon";
import { AXIS_TICK, BRUSH_PROPS, SheetGrid } from "@/components/explorer-v2/metric-sheet";
import { MarkLabel } from "@/components/explorer-v2/evm/query/fit-text";
import { dayLong, dayShort } from "@/components/explorer-v2/format";
import { TipPlate } from "./bits";
import { thin, windowSeries, type StakingApy, type StakingApyPoint } from "./data";

/* The reward rate by term length, over time: the 1-year and 2-week terms
   across the whole history, the 2-day term from the Helicon upgrade that
   allowed it, and a red rule at the upgrade's activation instant. The x
   axis is time, not days, so the rule and the 2-day line start where the
   upgrade did (15:00 UTC), not at a day's edge. */

export const HELICON_AT = HELICON_ACTIVATION.mainnet;
const HELICON_RED = "#E6212F";
const TWO_WEEK_COLOR = "#A2AFB2";
const TWO_DAY_COLOR = "#71717a";

export interface RatePoint {
  /** epoch ms */
  ts: number;
  day: string;
  maxAPY: number;
  twoWeekAPY: number;
  twoDayAPY: number | null;
  /** the sample at the upgrade instant, not a day */
  helicon?: boolean;
}

const toRatePoint = (p: StakingApyPoint, helicon = false): RatePoint => ({
  ts: p.timestamp * 1000,
  day: p.date,
  maxAPY: p.maxAPY,
  twoWeekAPY: p.twoWeekAPY ?? p.minAPY,
  twoDayAPY: p.twoDayAPY ?? null,
  ...(helicon ? { helicon } : {}),
});

/** the last `days` days, thinned to `max`, with the upgrade-instant sample spliced in when it falls inside */
export function rateCurveSeries(apy: StakingApy | null, days: number, max: number, dropToday = false): RatePoint[] {
  if (!apy?.data) return [];
  const today = new Date().toISOString().slice(0, 10);
  const sorted = [...apy.data]
    .filter((p) => !dropToday || p.date !== today)
    .sort((a, b) => a.timestamp - b.timestamp)
    .map((p) => toRatePoint(p));
  const series = thin(windowSeries(sorted, days), max);
  const mark = apy.helicon ? toRatePoint(apy.helicon, true) : null;
  if (!mark || !series.length || mark.ts <= series[0].ts || mark.ts >= series[series.length - 1].ts) return series;
  const at = series.findIndex((p) => p.ts > mark.ts);
  return [...series.slice(0, at), mark, ...series.slice(at)];
}

export const hasTwoDay = (series: RatePoint[]) => series.some((p) => p.twoDayAPY !== null);

const LegendLine = ({ className, label }: { className: string; label: string }) => (
  <span className="flex items-center gap-1.5">
    <span className={`h-0.5 w-4 ${className}`} /> {label}
  </span>
);

export function RateCurvesLegend({ series }: { series: RatePoint[] }) {
  const twoDay = hasTwoDay(series);
  return (
    <span className="flex shrink-0 flex-wrap items-center justify-end gap-x-3 gap-y-1 font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-400 dark:text-zinc-500">
      <LegendLine className="bg-zinc-900 dark:bg-zinc-100" label="1-year term" />
      <LegendLine className="border-b border-dashed border-[#A2AFB2]" label="2-week" />
      {twoDay && <LegendLine className="bg-[#71717a]" label="2-day" />}
      {series.some((p) => p.helicon) && <LegendLine className="w-px h-3 bg-[#E6212F]" label="Helicon" />}
    </span>
  );
}

const pct = (v: number) => `${v.toFixed(2)}%`;
const heliconWhen = new Date(HELICON_AT).toISOString().slice(11, 16);

function RateTip({ active, payload }: { active?: boolean; payload?: { payload: RatePoint }[] }) {
  if (!active || !payload?.[0]) return null;
  const d = payload[0].payload;
  return (
    <TipPlate>
      <p className="text-[10px] text-zinc-500">
        {dayLong(d.day)}
        {d.helicon && <span className="text-[#E6212F]"> · Helicon, {heliconWhen} UTC</span>}
      </p>
      <p className="text-xs font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">{pct(d.maxAPY)} · 1-year term</p>
      <p className="text-[10px] tabular-nums text-zinc-500">2-week {pct(d.twoWeekAPY)}</p>
      {d.twoDayAPY !== null && <p className="text-[10px] tabular-nums text-zinc-500">2-day {pct(d.twoDayAPY)}</p>}
    </TipPlate>
  );
}

type Win = { data: RatePoint[]; start: number; end: number };

/** "sheet": the detail sheet's plate, with a pan strip; "board": the overview's small trend */
export function RateCurvesChart({ data, variant }: { data: RatePoint[]; variant: "sheet" | "board" }) {
  const sheet = variant === "sheet";
  // the pan strip's window, kept against the series it was dragged on
  const [win, setWin] = useState<Win | null>(null);
  const shown = win && win.data === data ? data.slice(win.start, win.end + 1) : data;
  const ticks = shown.filter((p) => !p.helicon).map((p) => p.ts);
  const marked = shown.some((p) => p.helicon) || (shown.length > 1 && HELICON_AT > shown[0].ts && HELICON_AT < shown[shown.length - 1].ts);
  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={data} margin={{ top: marked ? 18 : sheet ? 8 : 4, right: 0, left: 0, bottom: 0 }}>
        {sheet ? <SheetGrid /> : <CartesianGrid vertical={false} stroke="rgba(161,161,170,0.18)" />}
        <XAxis
          dataKey="ts"
          type="number"
          scale="time"
          domain={["dataMin", "dataMax"]}
          ticks={ticks}
          tickLine={false}
          axisLine={false}
          minTickGap={48}
          interval="preserveStartEnd"
          tick={sheet ? AXIS_TICK : { fontSize: 10, fill: "#a1a1aa", fontFamily: "monospace" }}
          tickFormatter={(ts: number) => (sheet ? new Date(ts).toISOString().slice(5, 10) : dayShort(ts / 1000))}
        />
        <YAxis
          domain={sheet ? ["auto", "auto"] : [0, "dataMax"]}
          width={44}
          tickLine={false}
          axisLine={false}
          tick={sheet ? AXIS_TICK : { fontSize: 10, fill: "#a1a1aa", fontFamily: "monospace" }}
          {...(sheet ? {} : { orientation: "right" as const, tickCount: 3 })}
          tickFormatter={(v: number) => `${v.toFixed(sheet || v < 10 ? 1 : 0)}%`}
        />
        <RechartsTooltip cursor={{ stroke: "rgba(161,161,170,0.35)" }} content={<RateTip />} />
        <ReferenceLine x={HELICON_AT} stroke={HELICON_RED} strokeWidth={1.5} label={<MarkLabel value="Helicon" />} />
        <Line type="monotone" dataKey="maxAPY" stroke="currentColor" strokeWidth={2} dot={false} isAnimationActive={false} />
        <Line type="monotone" dataKey="twoWeekAPY" stroke={TWO_WEEK_COLOR} strokeWidth={1.5} strokeDasharray="4 3" dot={false} isAnimationActive={false} />
        <Line type="monotone" dataKey="twoDayAPY" stroke={TWO_DAY_COLOR} strokeWidth={1.5} dot={false} isAnimationActive={false} />
        {sheet && (
          <Brush dataKey="ts" {...BRUSH_PROPS} onChange={(r: { startIndex?: number; endIndex?: number }) => setWin({ data, start: r.startIndex ?? 0, end: r.endIndex ?? data.length - 1 })}>
            <LineChart>
              <Line dataKey="maxAPY" stroke="#A2AFB2" strokeWidth={1} dot={false} isAnimationActive={false} />
            </LineChart>
          </Brush>
        )}
      </ComposedChart>
    </ResponsiveContainer>
  );
}
