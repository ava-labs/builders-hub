"use client";

import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, XAxis, YAxis } from "recharts";
import { TipPlate } from "./bits";

/* The health charts' bars: one bar a bucket, and a click on a bar cuts
   the roster to that bucket. The validator views share them. */

export const QUIET_BAR = "#A2AFB2";

export function BucketBars({
  data,
  tint,
  picked,
  onPick,
}: {
  data: { id: string; label: string; count: number }[];
  /** per-bucket bar color; defaults to the quiet steel */
  tint?: (bucket: { id: string }) => string;
  /** the bucket the roster is cut to */
  picked?: string;
  onPick?: (id: string) => void;
}) {
  return (
    <div className="h-40">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} barCategoryGap="18%">
          <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: "#a1a1aa", fontFamily: "monospace" }} />
          <YAxis hide domain={[0, "dataMax"]} />
          <RechartsTooltip
            cursor={{ fill: "rgba(161,161,170,0.08)" }}
            content={({ active, payload }) => {
              if (!active || !payload?.[0]) return null;
              const d = payload[0].payload as { id: string; label: string; count: number };
              return (
                <TipPlate>
                  <p className="text-[10px] text-zinc-500">{d.label}</p>
                  <p className="text-xs font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
                    {d.count.toLocaleString()} validator{d.count === 1 ? "" : "s"}
                  </p>
                  {onPick && d.count > 0 && <p className="text-[10px] text-zinc-400">{picked === d.id ? "Click to show all" : "Click to list them"}</p>}
                </TipPlate>
              );
            }}
          />
          <Bar
            dataKey="count"
            minPointSize={1}
            isAnimationActive={false}
            radius={[2, 2, 0, 0]}
            className={onPick ? "cursor-pointer" : undefined}
            onClick={(d: { payload?: { id: string; count: number } }) => d.payload && d.payload.count > 0 && onPick?.(d.payload.id)}
          >
            {data.map((bucket) => (
              <Cell
                key={bucket.id}
                fill={tint ? tint(bucket) : QUIET_BAR}
                fillOpacity={picked && picked !== bucket.id ? 0.25 : 1}
                style={{ transition: "fill-opacity 250ms cubic-bezier(0.32,0.72,0,1)" }}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
