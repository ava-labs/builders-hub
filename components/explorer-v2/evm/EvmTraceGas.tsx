"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Board } from "@/components/explorer-v2/ui";
import { truncate } from "@/components/explorer-v2/format";
import { hexInt, type FlatFrame } from "@/lib/trace";
import { TRACE_INK } from "./trace-ink";

/* The trace's Gas tab (EvmTrace.tsx): where the gas went by call, as a
   flame graph. */

/* one ink per call kind, the same kinds the call tree colors */
const FLAME_TONES: Record<string, string> = {
  CALL: "#0061E2",
  STATICCALL: "#0284c7",
  DELEGATECALL: "#a21caf",
  CALLCODE: "#a21caf",
  CREATE: "#059669",
  CREATE2: "#059669",
  SELFDESTRUCT: "#E6212F",
};
const FLAME_ROW = 26;
const FLAME_HATCH = "repeating-linear-gradient(135deg, rgba(230,33,47,0.85) 0 3px, transparent 3px 7px)";

/** The Gas tab: where the gas went, as a flame graph. The totals first on
 *  one scale (the limit, what ACP-194 charged), then the call tree as
 *  boxes as wide as their gas, each call's children under it. The top
 *  call's box is the gas charged, which under ACP-194 can be more than its
 *  calls used. Click a box to zoom into it; the panel beside the graph
 *  reads the box under the cursor. */
export function GasTab({
  frames,
  charged,
  label,
  base,
}: {
  frames: FlatFrame[];
  /** the receipt's gasUsed: ACP-194 gas charged */
  charged?: number;
  /** a frame's name as one line: contract.function */
  label: (f: FlatFrame) => string;
  base: string;
}) {
  const byId = useMemo(() => new Map(frames.map((f) => [f.id, f])), [frames]);
  const gasOf = (f: FlatFrame) => hexInt(f.frame.gasUsed);
  const [focus, setFocus] = useState("0");
  const [pick, setPick] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const root = byId.get("0");
  if (!root) return null;
  const focusF = byId.get(focus) ?? root;
  const atRoot = focusF.id === "0";
  const scale = Math.max(1, gasOf(focusF));

  const boxes: { f: FlatFrame; x: number; w: number; row: number }[] = [];
  const place = (f: FlatFrame, x: number, row: number) => {
    boxes.push({ f, x, w: gasOf(f) / scale, row });
    let cx = x;
    for (const id of f.children) {
      const c = byId.get(id);
      if (!c) continue;
      place(c, cx, row + 1);
      cx += gasOf(c) / scale;
    }
  };
  place(focusF, 0, 0);
  const rows = Math.max(1, ...boxes.map((b) => b.row + 1));
  const trail = focusF.id.split(".").map((_, i, a) => a.slice(0, i + 1).join("."));
  const shown = byId.get(hover ?? pick ?? focusF.id) ?? focusF;
  const shownGas = gasOf(shown);
  const shownSelf = Math.max(0, shownGas - shown.children.reduce((s, id) => s + (byId.get(id) ? gasOf(byId.get(id)!) : 0), 0));
  const used = gasOf(root);
  const limit = hexInt(root.frame.gas);
  const pctOf = (v: number) => (limit > 0 ? `${Math.max(0.4, Math.min(100, (v / limit) * 100)).toFixed(2)}%` : "0%");

  return (
    <div className="flex flex-col gap-6">
      {/* the totals on the limit's scale */}
      <Board divide={false} className="flex flex-col gap-2.5 px-5 py-5 font-mono text-[11px] md:px-6">
        {[
          { k: "Gas limit", v: limit, tone: "#e4e4e7" },
          // the top call reports gas charged: with the receipt's figure, a "used" bar would repeat it
          charged !== undefined ? { k: "Gas charged", v: charged, tone: "#A2AFB2" } : { k: "Gas used", v: used, tone: "#0061E2" },
        ].map((r) => (
          <div key={r.k} className="grid grid-cols-[6.5rem_minmax(0,1fr)] items-center gap-4">
            <span className="uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">{r.k}</span>
            <span className="flex h-5 items-center gap-2 bg-zinc-50 dark:bg-zinc-900">
              <span className="h-full" style={{ width: pctOf(r.v), background: r.tone }} />
              <span className="shrink-0 tabular-nums text-zinc-900 dark:text-zinc-50">{r.v.toLocaleString("en-US")}</span>
            </span>
          </div>
        ))}
        {charged !== undefined && charged === Math.ceil(limit / 2) && (
          <p className="pt-1 text-zinc-400 dark:text-zinc-500">Charged is half the limit: ACP-194 charges the larger of gas used and half the limit.</p>
        )}
      </Board>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <Board divide={false} className="flex min-w-0 flex-col gap-3 px-5 py-4 md:px-6">
          {/* where the zoom is */}
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 font-mono text-[11px] text-zinc-400 dark:text-zinc-500">
            {trail.map((id, i) => {
              const f = byId.get(id);
              if (!f) return null;
              return (
                <span key={id} className="flex items-center gap-1.5">
                  {i > 0 && <span className="text-zinc-300 dark:text-zinc-700">›</span>}
                  <button type="button" onClick={() => { setFocus(id); setPick(id); }} className={cn("hover:text-[#E6212F]", id === focusF.id && "text-zinc-900 dark:text-zinc-50")}>
                    {i === 0 ? "whole transaction" : label(f)}
                  </button>
                </span>
              );
            })}
            {atRoot && <span className="ml-auto">click a box to zoom</span>}
          </div>
          <div className="relative w-full overflow-hidden" style={{ height: rows * FLAME_ROW }} onMouseLeave={() => setHover(null)}>
            {boxes.map(({ f, x, w, row }) => {
              const g = gasOf(f);
              const dim = hover !== null && hover !== f.id;
              return (
                <button
                  key={f.id}
                  type="button"
                  onMouseEnter={() => setHover(f.id)}
                  onFocus={() => setHover(f.id)}
                  onClick={() => {
                    setPick(f.id);
                    if (f.children.length) setFocus(f.id);
                  }}
                  aria-label={`${label(f)}, ${g.toLocaleString("en-US")} gas`}
                  className={cn("absolute flex items-center overflow-hidden px-1.5 text-left font-mono text-[10px] text-white transition-opacity", dim && "opacity-60")}
                  style={{
                    left: `${x * 100}%`,
                    width: `max(1px, calc(${w * 100}% - 1px))`,
                    top: row * FLAME_ROW,
                    height: FLAME_ROW - 2,
                    background: FLAME_TONES[f.frame.type] ?? FLAME_TONES.CALL,
                    filter: `brightness(${1 + (row % 2) * 0.12})`,
                  }}
                >
                  {f.frame.error && <span aria-hidden className="absolute inset-0" style={{ background: FLAME_HATCH }} />}
                  {w > 0.05 && <span className="relative truncate">{label(f)} · {g.toLocaleString("en-US")}</span>}
                </button>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-400 dark:text-zinc-500">
            {["CALL", "STATICCALL", "DELEGATECALL", "CREATE"].map((k) => (
              <span key={k} className="flex items-center gap-1.5">
                <span className="h-2 w-2" style={{ background: FLAME_TONES[k] }} />
                {k.toLowerCase()}
              </span>
            ))}
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2" style={{ background: FLAME_HATCH }} />
              reverted
            </span>
          </div>
        </Board>

        {/* the box under the cursor, or the one last clicked */}
        <Board divide={false} className="flex flex-col gap-3 border px-5 py-4 font-mono text-[12px]">
          <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">{shown.id === "0" ? "Top call" : `Depth ${shown.depth}`}</span>
          <span className={cn("break-all", TRACE_INK.fn)}>{label(shown)}</span>
          <span className="flex min-w-0 items-baseline gap-2 text-zinc-500 dark:text-zinc-400">
            <span className={cn("shrink-0 text-[10px] font-bold uppercase tracking-[0.14em]", TRACE_INK.type[shown.frame.type] ?? TRACE_INK.type.CALL)}>{shown.frame.type.toLowerCase()}</span>
            {shown.frame.to && (
              <Link href={`${base}/address/${shown.frame.to}`} title={shown.frame.to} className={cn("truncate hover:text-[#E6212F]", TRACE_INK.addr)}>
                {truncate(shown.frame.to, 10)}
              </Link>
            )}
          </span>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 tabular-nums">
            <dt className="text-zinc-400 dark:text-zinc-500">gas</dt>
            <dd className="text-right text-zinc-900 dark:text-zinc-50">{shownGas.toLocaleString("en-US")}</dd>
            <dt className="text-zinc-400 dark:text-zinc-500">share</dt>
            <dd className="text-right text-zinc-900 dark:text-zinc-50">{`${((shownGas / Math.max(1, used)) * 100).toFixed(1)}%`}</dd>
            <dt className="text-zinc-400 dark:text-zinc-500" title="spent by this call itself, not the calls it made">own gas</dt>
            <dd className="text-right text-zinc-900 dark:text-zinc-50">{shownSelf.toLocaleString("en-US")}</dd>
            <dt className="text-zinc-400 dark:text-zinc-500">calls made</dt>
            <dd className="text-right text-zinc-900 dark:text-zinc-50">{shown.children.length}</dd>
          </dl>
          {shown.frame.error && <span className="text-[#E6212F]">reverted: {shown.frame.revertReason ?? shown.frame.error}</span>}
        </Board>
      </div>
    </div>
  );
}
