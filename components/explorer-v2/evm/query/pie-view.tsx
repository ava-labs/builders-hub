"use client";

import { useMemo, useState, type KeyboardEvent, type MouseEvent as ReactMouseEvent } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { toggleValue } from "@/lib/explorer-query/selection";
import { fmt, xText } from "../query-format";
import { CHART_MS, FADE_CLASS, useReduced, useTween } from "./motion";
import { DIM, inSelection, pct, type PanelProps, type Row } from "./sheet";

const PIE_TONES = ["currentColor", "#0061E2", "#0d9488", "#d97706", "#7c3aed", "#db2777", "#65a30d"];
const PIE_MAX = 7;

/** a slice's share in its legend: whole percents, one decimal under 10% and over 99%, and never 0% or 100%
    for a slice that is neither none nor all */
function sliceShare(share: number): string {
  if (share > 0 && share < 0.0005) return "<0.1%";
  if (share < 1 && share >= 0.9995) return ">99.9%";
  return `${(share * 100).toFixed(share < 0.1 || share > 0.99 ? 1 : 0)}%`;
}

/** parts of a whole: the leaders as slices, the rest as one grey slice */
export function PieView({ panel, rows, names, sym, canDrill, onPick, hoverKey, onHoverKey, selection, live, onSelection, compact }: PanelProps) {
  const reduced = useReduced();
  const x = panel.x!;
  const s = panel.series[0];
  const [kb, setKb] = useState<number | null>(null);
  const { slices, total } = useMemo(() => {
    const sorted = [...rows].filter((r) => typeof r[s.column] === "number" && (r[s.column] as number) > 0).sort((a, b) => (b[s.column] as number) - (a[s.column] as number));
    const total = sorted.reduce((a, r) => a + (r[s.column] as number), 0);
    const head = sorted.slice(0, PIE_MAX).map((r, i) => ({ key: r[x], label: xText(names, x, r[x], "other"), value: r[s.column] as number, row: r as Row | null, tone: PIE_TONES[i] }));
    const rest = sorted.slice(PIE_MAX).reduce((a, r) => a + (r[s.column] as number), 0);
    if (rest > 0) head.push({ key: "__rest", label: `${sorted.length - PIE_MAX} more`, value: rest, row: null, tone: "#d4d4d8" });
    return { slices: head, total };
  }, [rows, s.column, x, names]);
  const hasSel = live.length > 0;
  const on = slices.map((sl) => !hasSel || (sl.row ? inSelection(live, sl.row) : false));
  const selTotal = slices.reduce((a, sl, i) => a + (on[i] ? sl.value : 0), 0);
  const focusKey = kb !== null ? slices[kb]?.key : hoverKey;
  const focusIdx = focusKey === undefined ? -1 : slices.findIndex((sl) => sl.key === focusKey);
  const focus = focusIdx >= 0 ? slices[focusIdx] : undefined;
  const inkOf = (i: number) => {
    let o = on[i] ? 1 : DIM;
    if (focusIdx >= 0) o = focusIdx === i ? Math.max(o, 0.6) : hasSel ? o : 0.35;
    return o;
  };
  const selecting = !!onSelection;
  const toggle = (i: number, additive: boolean) => {
    const sl = slices[i];
    if (sl?.row && onSelection) onSelection(toggleValue(selection, x, String(sl.row[x] ?? ""), additive));
  };
  const drill = (i: number) => {
    const sl = slices[i];
    if (sl?.row && canDrill) onPick(sl.row);
  };
  const center = focus ? focus.value : hasSel ? selTotal : total;
  const tweened = useTween(center);
  const shown = tweened === null ? center : Number.isInteger(center) ? Math.round(tweened) : tweened;
  const walk = (i: number | null) => {
    setKb(i);
    onHoverKey?.(i === null ? undefined : slices[i]?.key);
  };
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const n = slices.length;
    if (!n) return;
    if (["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp"].includes(e.key)) {
      e.preventDefault();
      const next = e.key === "ArrowRight" || e.key === "ArrowDown";
      walk(Math.max(0, Math.min(n - 1, (kb ?? (next ? -1 : n)) + (next ? 1 : -1))));
    } else if (e.key === "Enter" && kb !== null) {
      e.preventDefault();
      drill(kb);
    } else if (e.key === " " && kb !== null && selecting) {
      e.preventDefault();
      toggle(kb, true);
    } else if (e.key === "Escape") {
      if (onSelection && selection.length) {
        e.preventDefault();
        onSelection([]);
      }
      walk(null);
    }
  };

  return (
    <div className={cn("grid items-center gap-6 sm:gap-10", compact ? "sm:grid-cols-[minmax(0,10rem)_minmax(0,1fr)]" : "sm:grid-cols-[minmax(0,15rem)_minmax(0,1fr)]")}>
      <div
        tabIndex={0}
        role="group"
        aria-roledescription="chart"
        aria-label={`${panel.title || "Pie"}, ${slices.length} slices. Arrow keys move${selecting ? ", Space selects" : ""}${canDrill ? ", Enter opens" : ""}.`}
        onKeyDown={onKey}
        onBlur={() => walk(null)}
        className={cn("relative mx-auto aspect-square w-full rounded-full text-zinc-900 outline-none focus-visible:ring-2 focus-visible:ring-[#0061E2]/40 focus-visible:ring-offset-4 focus-visible:ring-offset-white dark:text-zinc-100 dark:focus-visible:ring-offset-zinc-950", FADE_CLASS, compact ? "max-w-40" : "max-w-52 sm:max-w-60")}
      >
        <span className="sr-only" aria-live="polite">
          {kb !== null && slices[kb] ? `${slices[kb].label}: ${fmt(slices[kb].value, s.format, sym)}${hasSel && on[kb] ? ", selected" : ""}` : ""}
        </span>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={slices}
              dataKey="value"
              nameKey="label"
              innerRadius="64%"
              outerRadius="96%"
              paddingAngle={1}
              stroke="none"
              isAnimationActive={!reduced}
              animationDuration={CHART_MS}
              animationEasing="ease-out"
              onMouseEnter={(d: { payload?: { key: unknown } }) => onHoverKey?.(d?.payload?.key)}
              onMouseLeave={() => onHoverKey?.(undefined)}
              onClick={(_d: unknown, i: number, e: ReactMouseEvent) => (selecting ? toggle(i, e.shiftKey || e.metaKey || e.ctrlKey) : drill(i))}
            >
              {slices.map((sl, i) => (
                <Cell key={String(sl.key)} fill={sl.tone} fillOpacity={inkOf(i)} cursor={sl.row && (selecting || canDrill) ? "pointer" : "default"} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-0.5 px-6 text-center">
          <span className={cn("font-mono tabular-nums text-zinc-900 dark:text-zinc-50", compact ? "text-[14px]" : "text-[18px]")}>{fmt(shown, s.format, sym)}</span>
          <span className="max-w-full truncate font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">
            {focus ? focus.label : hasSel ? `${total ? pct((selTotal / total) * 100) : 0}% of ${s.label}` : s.label}
          </span>
        </div>
      </div>
      <ul className="flex flex-col gap-0.5">
        {slices.map((sl, i) => {
          const pickable = !!sl.row && (selecting || canDrill);
          const share = total ? sl.value / total : 0;
          const lead = slices[0]?.value ? sl.value / slices[0].value : 0;
          return (
            <li key={String(sl.key)} className="group/row relative flex items-center">
              <button
                type="button"
                disabled={!pickable}
                aria-pressed={selecting && hasSel ? on[i] : undefined}
                onClick={(e) => (selecting ? toggle(i, e.shiftKey || e.metaKey || e.ctrlKey) : drill(i))}
                onDoubleClick={() => selecting && drill(i)}
                onMouseEnter={() => onHoverKey?.(sl.key)}
                onMouseLeave={() => onHoverKey?.(undefined)}
                style={{ opacity: inkOf(i) < 0.5 ? 0.45 : 1 }}
                className={cn(
                  "grid min-w-0 flex-1 grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-x-3 gap-y-1 rounded-lg py-1.5 pr-8 pl-2 text-left sm:grid-cols-[auto_minmax(0,11rem)_minmax(0,1fr)_auto_auto] transition-[opacity,background-color] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0061E2]/50",
                  pickable && "hover:bg-zinc-50 dark:hover:bg-zinc-900",
                  focusIdx === i && "bg-zinc-50 dark:bg-zinc-900",
                )}
              >
                <span className="h-2 w-2 shrink-0 rounded-full text-zinc-900 dark:text-zinc-100" style={{ background: sl.tone }} />
                <span className="min-w-0 truncate font-mono text-[12px] text-zinc-800 dark:text-zinc-200">{sl.label}</span>
                {/* the share as a bar: the room beside a legend says how big */}
                <span aria-hidden className="col-span-3 col-start-2 row-start-2 h-1 overflow-hidden rounded-full bg-zinc-100 sm:col-span-1 sm:col-start-3 sm:row-start-1 sm:h-1.5 dark:bg-zinc-900">
                  <span className="block h-full rounded-full text-zinc-900 transition-[width] duration-500 ease-out dark:text-zinc-100" style={{ width: `${Math.min(100, Math.max(1.5, lead * 100))}%`, background: sl.tone, opacity: sl.row ? 0.85 : 0.6 }} />
                </span>
                <span className="font-mono text-[12px] tabular-nums text-zinc-900 dark:text-zinc-50">{fmt(sl.value, s.format, sym)}</span>
                <span className="w-11 text-right font-mono text-[11px] tabular-nums text-zinc-400 dark:text-zinc-500">{total ? sliceShare(share) : ""}</span>
              </button>
              {selecting && canDrill && sl.row && (
                <button
                  type="button"
                  onClick={() => drill(i)}
                  aria-label={`Open ${sl.label}`}
                  title="Open"
                  className="absolute right-1 flex h-6 w-6 items-center justify-center rounded-full text-zinc-400 opacity-0 transition-opacity duration-200 group-hover/row:opacity-100 hover:bg-zinc-100 hover:text-zinc-900 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0061E2]/50 [@media(hover:none)]:opacity-100 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
                >
                  <ChevronRight className="h-3.5 w-3.5" strokeWidth={2} />
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
