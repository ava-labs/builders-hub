"use client";

import { StackBlock, TraceBlock, type StackCol, type StackLayer, type TraceRow } from "@/components/explorer-v2/gas/instruments";
import { SectionHeader } from "@/components/explorer-v2/ui";
import { dayLong, dayShort, formatNumber, hourLong } from "@/components/explorer-v2/format";
import type { NodeResponse } from "@/lib/pchain-explorer";
import type { P2PDetail } from "./node-data";

/* How a validator has done: its peers' median view of its uptime, hour by
   hour, and the blocks it proposed and missed, day by day, as the gas
   pages' instruments. The figure leads each one; the window rides in its
   line, not in its title. */

/* front, top, side: the block gray for what it proposed, red for what it missed */
const BLOCK_LAYERS: StackLayer[] = [
  {
    key: "proposed",
    label: "Proposed",
    faces: ["fill-[#A2AFB2] dark:fill-[#6E7B7E]", "fill-[#DCE1E2] dark:fill-[#8C999C]", "fill-[#7E8C8F] dark:fill-[#556164]"],
    swatch: "bg-[#A2AFB2] dark:bg-[#6E7B7E]",
  },
  {
    key: "missed",
    label: "Missed",
    faces: ["fill-[#EE5A65] dark:fill-[#B8232F]", "fill-[#F8A5AB] dark:fill-[#D9434E]", "fill-[#C42331] dark:fill-[#7A1119]"],
    swatch: "bg-[#EE5A65] dark:bg-[#B8232F]",
  },
];

const pct = (v: number, digits = 2) => `${v.toFixed(digits)}%`;

export function NodePerformance({ n, p2p, uptimeReq }: { n: NodeResponse; p2p: P2PDetail | null; uptimeReq: number }) {
  // the observatory's hourly median, else the node document's own snapshots
  const uptime: TraceRow[] = p2p?.uptime?.length
    ? p2p.uptime.map((u) => ({ key: u.bucket, long: hourLong(u.bucket.slice(0, 16)), tick: dayShort(u.bucket.slice(0, 10)), mid: u.p50_uptime }))
    : (n.uptimeHistory ?? []).map((h, i) => {
        const dated = /^\d{4}-/.test(h.bucket ?? "");
        return { key: `${i}`, long: dated ? hourLong(h.bucket.slice(0, 16)) : "snapshot", tick: dated ? dayShort(h.bucket.slice(0, 10)) : `#${i + 1}`, mid: h.p50Uptime };
      });
  const blocks: StackCol[] = (p2p?.blocks ?? []).map((b) => ({
    key: b.hour,
    long: dayLong(b.hour.slice(0, 10)),
    tick: dayShort(b.hour.slice(0, 10)),
    parts: { proposed: b.proposed, missed: b.missed },
  }));
  const slots = (() => {
    const total = p2p?.slots?.reduce((s, x) => s + x.cnt, 0) ?? 0;
    return total > 0 ? (p2p!.slots.find((x) => x.slot === 0)?.cnt ?? 0) / total : null;
  })();
  // the range the trace draws, over the hours that report a reading
  const read = uptime.map((r) => r.mid).filter((v) => Number.isFinite(v));
  const lo = read.length ? Math.min(...read) : 0;
  const hi = read.length ? Math.max(...read) : 0;
  const mean = read.length ? read.reduce((t, v) => t + v, 0) / read.length : 0;
  const steady = hi - lo < 0.1;
  if (uptime.length < 2 && blocks.length < 2) return null;

  return (
    <section className="flex flex-col gap-4">
      <SectionHeader label="Performance" />
      <div className="grid grid-cols-1 gap-x-4 gap-y-5 lg:grid-cols-2">
        {uptime.length > 1 && (
          <TraceBlock
            label="Uptime"
            figure={n.uptime.currentP50.toFixed(2)}
            unit="%"
            sub={
              <>
                {steady ? `steady, the lowest hour ${pct(lo)}` : `${pct(lo, 1)} to ${pct(hi, 1)}, ${pct(mean, 1)} on average`}
                {p2p?.uptime?.length ? " · peers' median view, hour by hour, last 14 days" : " · peers' median view"} · rewards need {uptimeReq}%
              </>
            }
            rows={uptime}
            band
            fmt={(v) => pct(v)}
            height={150}
            tip={(r) => (
              <>
                <p className="font-mono text-[10px] text-zinc-500">{r.long}</p>
                <p className="font-mono text-[11px] font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">{pct(r.mid)} uptime</p>
              </>
            )}
          />
        )}
        {blocks.length > 1 && p2p && (
          <StackBlock
            label="Blocks Proposed"
            figure={formatNumber(p2p.proposed_14d)}
            sub={
              <>
                <span className={p2p.missed_14d > 0 ? "text-[#E6212F]" : undefined}>{formatNumber(p2p.missed_14d)} missed</span>
                {slots !== null && ` · ${(slots * 100).toFixed(1)}% on the first try`} · day by day, last 14 days
              </>
            }
            cols={blocks}
            layers={BLOCK_LAYERS}
            fmt={formatNumber}
            height={150}
            tip={(c) => (
              <>
                <p className="font-mono text-[10px] text-zinc-500">{c.long}</p>
                <p className="font-mono text-[11px] font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">{formatNumber(c.parts.proposed)} proposed</p>
                <p className={`font-mono text-[10px] tabular-nums ${c.parts.missed > 0 ? "text-[#E6212F]" : "text-zinc-500"}`}>{formatNumber(c.parts.missed)} missed</p>
              </>
            )}
          />
        )}
      </div>
    </section>
  );
}
