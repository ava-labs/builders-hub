"use client";

import { useMemo } from "react";
import { usePolledJson } from "@/components/explorer-v2/page-data";
import { useChainMetrics } from "@/components/explorer-v2/evm/metric-charts";
import { dayLong, dayShort } from "@/components/explorer-v2/format";
import { ColumnsBlock } from "@/components/explorer-v2/gas/instruments";
import { HELICON_DAY, fmtGas } from "@/components/explorer/GasMarketPage";
import { targetDays, type TargetDay } from "@/lib/gas-target-math";
import type { GasDayPoint } from "@/lib/explorer-clickhouse";
import type { GasTargetDay } from "@/lib/gas-target";

/* Utilization against ACP-176's gas target: gas per second over the target
   per second the headers carry. The block gas limit is a burst ceiling no
   chain can hold block after block, so it is the wrong denominator for how
   busy a chain is; the target is the rate the base fee holds steady at. */


/** the daily reserved and charged gas over the range, each against that day's target; empty when the chain has no ACP-176 target */
export function useTargetDays(evmChainId: number, days: number, trend: GasDayPoint[]): TargetDay[] {
  const { data } = usePolledJson<{ daily: GasTargetDay[] }>(`/api/gas-target/${evmChainId}?days=${days}`);
  // receipts' gas per day: what the stats API's gasUsed metric sums
  const { metrics } = useChainMetrics(String(evmChainId), days, "gasUsed");
  return useMemo(() => {
    const targets = new Map((data?.daily ?? []).map((t) => [t.d, t.target]));
    const charged = new Map((metrics?.gasUsed?.data ?? []).map((p) => [String(p.date), Number(p.value)]));
    return targetDays(trend, targets, charged);
  }, [data, metrics, trend]);
}

export const fmtRate = (perSecond: number) => `${fmtGas(perSecond)} gas/s`;

/** one day per column as a percent of its target, a rule at the target */
export function TargetDailyBlock({ rows, kind, note }: { rows: TargetDay[]; kind: "charged" | "reserved"; note?: string | null }) {
  const pctOf = (d: TargetDay) => (kind === "charged" ? d.chargedPct : d.reservedPct);
  const shown = rows.filter((d) => pctOf(d) !== null);
  const avg = shown.length ? shown.reduce((s, d) => s + pctOf(d)!, 0) / shown.length : 0;
  const top = Math.max(110, ...shown.map((d) => pctOf(d)! * 1.1));
  return (
    <ColumnsBlock
      label={kind === "charged" ? "Daily Utilization" : "Reserved vs Target"}
      note={note}
      figure={shown.length ? avg.toFixed(1) : "—"}
      unit="%"
      sub={kind === "charged" ? "of the gas target, gas charged" : "of the gas target, gas reserved by tx limits"}
      cols={shown.map((d) => ({ key: d.d, long: dayLong(d.d), tick: dayShort(d.d), v: pctOf(d)! }))}
      max={top}
      avg={{ v: 100, label: "target" }}
      marker={shown.some((d) => d.d === HELICON_DAY) ? { key: HELICON_DAY, label: "Helicon" } : undefined}
      height={200}
      fmt={(v) => `${v.toFixed(0)}%`}
      tip={(c) => {
        const d = shown.find((r) => r.d === c.key)!;
        return (
          <>
            <p className="font-mono text-[10px] text-zinc-500">{c.long}</p>
            <p className="font-mono text-[11px] font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
              {c.v.toFixed(1)}% of target {kind}
            </p>
            <p className="font-mono text-[10px] tabular-nums text-zinc-500">
              {fmtRate(d.reserved / 86_400)} reserved · {d.charged !== null ? `${fmtRate(d.charged / 86_400)} charged` : "charged n/a"}
            </p>
            <p className="font-mono text-[10px] tabular-nums text-zinc-500">
              target {fmtRate(d.target)} · {d.blocks.toLocaleString("en-US")} blocks
            </p>
          </>
        );
      }}
    />
  );
}
