"use client";

import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { cn } from "@/lib/utils";
import { ChartBoard } from "@/components/explorer-v2/ui";
import { SheetGrid } from "@/components/explorer-v2/metric-sheet";
import { ChartEmpty, TipPlate } from "@/components/explorer-v2/staking/bits";
import { dayLong, dayShort } from "@/components/explorer-v2/format";
import type { CollectionDay } from "@/lib/rwa/series";
import { COUNTED_TONE, usd } from "./palette";
import { Money } from "./rwa-parts";

/* Paid against expected collections, both as Fence's running totals on
   one scale, over the page clock's window: the paid line above the
   dashed one means collections run ahead of schedule. */

/* full-strength ticks in the wrapper's ink: the sheets' 45% tick falls under 4.5:1 here */
const TICK = { fontSize: 10, fill: "currentColor" } as const;

function CollectionsTip({ active, payload }: { active?: boolean; payload?: { payload: CollectionDay }[] }) {
  const day = active ? payload?.[0]?.payload : undefined;
  if (!day) return null;
  return (
    <TipPlate>
      <p className="font-mono text-[10px] text-zinc-500 dark:text-zinc-400">{dayLong(day.date)}</p>
      <p className="flex justify-between gap-4 font-mono text-[11px] tabular-nums text-zinc-900 dark:text-zinc-100">
        <span>paid</span>
        {day.paid === null ? "n/a" : <Money value={day.paid} />}
      </p>
      <p className="flex justify-between gap-4 font-mono text-[11px] tabular-nums text-zinc-900 dark:text-zinc-100">
        <span>expected</span>
        {day.expected === null ? "n/a" : <Money value={day.expected} />}
      </p>
    </TipPlate>
  );
}

/** `stale`: the last window's answer while the new window loads, dimmed (the Flows view's rule) */
export function RwaCollections({ days, note, failed, stale = false }: { days: CollectionDay[] | null; note: string; failed: boolean; stale?: boolean }) {
  return (
    <ChartBoard
      className={cn("transition-opacity", stale && "opacity-60")}
      label="Paid vs Expected Collections"
      action={
        <span className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-500 dark:text-zinc-400">
          <span className="flex items-center gap-1.5">
            <span className="w-4 border-t-2" style={{ borderColor: COUNTED_TONE }} />
            paid
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-4 border-t border-dashed border-zinc-500 dark:border-zinc-400" />
            expected
          </span>
          <span>{note}</span>
        </span>
      }
    >
      {!days || days.length === 0 ? (
        <ChartEmpty failed={failed} label={days ? "No collections in this window" : "Loading…"} />
      ) : (
        // the expected line draws in currentColor, so it follows the theme's ink
        <div className="h-56 text-zinc-500 dark:text-zinc-400">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={days} margin={{ top: 6, right: 8, bottom: 0, left: 0 }}>
              <SheetGrid />
              <XAxis dataKey="date" tickFormatter={dayShort} tick={TICK} tickLine={false} axisLine={false} minTickGap={36} />
              <YAxis tickFormatter={usd} tick={TICK} tickLine={false} axisLine={false} width={56} domain={["auto", "auto"]} />
              <Tooltip cursor={{ stroke: "currentColor", strokeOpacity: 0.3 }} content={<CollectionsTip />} />
              <Line dataKey="paid" type="monotone" dot={false} stroke={COUNTED_TONE} strokeWidth={1.75} isAnimationActive={false} />
              <Line dataKey="expected" type="monotone" dot={false} stroke="currentColor" strokeWidth={1.25} strokeDasharray="4 3" isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </ChartBoard>
  );
}
