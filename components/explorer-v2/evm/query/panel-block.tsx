"use client";

import { useId, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChartArea, ChartBar, ChartColumn, ChartLine, ChartNoAxesColumn, ChartNoAxesGantt, ChartScatter, GitCommitHorizontal, Grid3x3, LayoutPanelLeft, Sigma, Table2, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { TREEMAP_PARTS, type Panel } from "@/lib/explorer-query/visual-spec";
import { spanOf } from "../query-format";
import { MOTION, useReduced } from "./motion";
import { PanelChart } from "./panel-chart";
import { PanelTable } from "./panel-table";
import { HeatmapView, HistogramView, TreemapView } from "./field-views";
import { DivergingView, DumbbellView } from "./rank-views";
import type { PanelProps, Row } from "./sheet";

/* ------------------------------------------------------------------ */
/* one panel, seen any way the data allows                              */

type View = "line" | "area" | "bar" | "hbar" | "scatter" | "dumbbell" | "diverging" | "histogram" | "heatmap" | "treemap" | "table";

/** the views that are a drawing of their own, not the one chart that morphs between a line, an area and bars */
const OWN: Partial<Record<View, (props: PanelProps) => React.ReactNode>> = { dumbbell: DumbbellView, diverging: DivergingView, histogram: HistogramView, heatmap: HeatmapView, treemap: TreemapView };

const VIEW_META: Record<View, { label: string; icon: LucideIcon }> = {
  line: { label: "Line", icon: ChartLine },
  area: { label: "Area", icon: ChartArea },
  bar: { label: "Columns", icon: ChartColumn },
  hbar: { label: "Bars", icon: ChartBar },
  dumbbell: { label: "Before and now", icon: GitCommitHorizontal },
  diverging: { label: "Gains and losses", icon: ChartNoAxesGantt },
  histogram: { label: "Spread", icon: ChartNoAxesColumn },
  heatmap: { label: "Heatmap", icon: Grid3x3 },
  treemap: { label: "Treemap", icon: LayoutPanelLeft },
  scatter: { label: "Scatter", icon: ChartScatter },
  table: { label: "Table", icon: Table2 },
};

/** the views that fit a panel's shape: time reads as a line, an area,
    columns or a table; groups as bars, a treemap or a table; two measures as
    a scatter or a table; a kind with a drawing of its own as that drawing,
    the bars it compares, or a table */
function viewsFor(panel: Panel, rows: Row[], cut: boolean): View[] {
  if (panel.kind === "scatter") return ["scatter", "table"];
  if (panel.kind === "histogram" || panel.kind === "heatmap" || panel.kind === "diverging") return [panel.kind, "table"];
  if (panel.kind === "dumbbell") return ["dumbbell", "hbar", "table"];
  // a treemap's parts are shares of the whole: rows a LIMIT cut are not the whole
  if (panel.kind === "treemap") return cut ? ["hbar", "table"] : ["treemap", "hbar", "table"];
  const time = spanOf(rows.map((r) => r[panel.x!])) !== "other";
  if (time) return ["line", "area", "bar", "table"];
  const first = panel.series[0]?.column;
  const parts = !!first && rows.length >= 2 && rows.every((r) => typeof r[first] !== "number" || (r[first] as number) >= 0) && panel.series[0].format !== "percent";
  return parts && !cut && rows.length >= TREEMAP_PARTS ? ["hbar", "treemap", "table"] : ["hbar", "table"];
}

const SEG = "relative flex h-7 min-w-7 items-center justify-center gap-1.5 rounded-full transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0061E2]/50";

export function PanelBlock(props: PanelProps) {
  const { panel, rows } = props;
  const reduced = useReduced();
  const id = useId();
  const views = useMemo(() => viewsFor(panel, rows, !!props.cut), [panel, rows, props.cut]);
  const start: View = views.includes(panel.kind as View) ? (panel.kind as View) : panel.kind === "bar" && views.includes("hbar") ? "hbar" : views[0];
  const [view, setView] = useState<View>(start);
  // a running total, for counts over time; shares and rates do not add up
  const canRun = views.includes("line") && panel.series.some((s) => s.format !== "percent" && s.transform === "none");
  const [running, setRunning] = useState(false);
  // one mark far above the rest (a 20M transfer among 1M ones) squeezes
  // the others onto the floor; such a panel opens on a log axis
  const skewed = useMemo(() => {
    const col = panel.series.find((x) => x.axis !== "right")?.column;
    // a log axis has no zero: ins and outs keep a linear one
    if (!col || panel.series.some((x) => x.transform !== "none" || x.format === "percent" || x.below)) return false;
    const v = rows.map((r) => r[col]).filter((n): n is number => typeof n === "number");
    if (v.length < 8 || v.some((n) => n <= 0)) return false;
    const sorted = [...v].sort((a, b) => a - b);
    return sorted[sorted.length - 1] / sorted[Math.floor(sorted.length / 2)] > 12;
  }, [panel.series, rows]);
  const [logOn, setLog] = useState<boolean | null>(null);
  const canLog = skewed && (view === "scatter" || view === "line");
  const log = canLog && !running && (logOn ?? true);
  const drawn: Panel = useMemo(
    () => ({
      ...panel,
      title: panel.title,
      kind: OWN[view] || view === "table" ? panel.kind : view,
      // a view the reader picked applies to every series; the designer's
      // mixed marks (bars with a rate line) belong to its own view
      series: panel.series.map((s) => ({
        ...s,
        mark: view === start ? s.mark : ("auto" as const),
        transform: running && s.format !== "percent" && s.transform === "none" ? ("cumulative" as const) : s.transform,
      })),
    }),
    [panel, view, running, start],
  );
  // line, area and columns share one chart that morphs; a view with a drawing
  // of its own or a table is a different object, so those crossfade
  const Own = OWN[view];
  const family = Own || view === "table" ? view : "chart";
  const t = reduced ? { duration: 0 } : MOTION;

  return (
    <section aria-label={panel.title || undefined} className="group/panel flex flex-col gap-3">
      <div className="flex min-h-7 items-center justify-between gap-3">
        <span className="min-w-0 truncate font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
          {props.titled !== false && panel.title}
          {running && <span className="ml-2 font-normal text-zinc-400 dark:text-zinc-500">running total</span>}
        </span>
        <div data-no-shot className="flex shrink-0 items-center gap-1.5">
        {props.action && <span className="hidden opacity-0 transition-opacity duration-200 group-hover/panel:opacity-100 group-focus-within/panel:opacity-100 sm:inline [@media(hover:none)]:opacity-100">{props.action}</span>}
        <div
          role="group"
          aria-label={`View ${panel.title || "panel"} as`}
          className="flex shrink-0 items-center gap-px rounded-full bg-zinc-100 p-0.5 ring-1 ring-inset ring-zinc-200/70 dark:bg-zinc-900 dark:ring-zinc-800"
        >
          {views.map((v) => {
            const { label, icon: Icon } = VIEW_META[v];
            const on = view === v;
            return (
              <button key={v} type="button" title={`See as ${label.toLowerCase()}`} aria-label={label} aria-pressed={on} onClick={() => setView(v)} className={cn(SEG, on ? "px-2.5 text-zinc-900 dark:text-zinc-50" : "px-1.5 text-zinc-500 hover:bg-white/60 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800/60 dark:hover:text-zinc-100")}>
                {on && <motion.span layoutId={`${id}-pill`} transition={t} className="absolute inset-0 rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.12)] dark:bg-zinc-700" />}
                <Icon className="relative h-3.5 w-3.5" strokeWidth={1.75} />
                {on && <span className="relative font-mono text-[10.5px] font-medium">{label}</span>}
              </button>
            );
          })}
          {canLog && !running && (
            <>
              <span className="mx-1 h-3.5 w-px bg-zinc-200 dark:bg-zinc-800" />
              <button
                type="button"
                title={log ? "Log scale: each step up is 10x. Click for a linear axis." : "Linear axis. Click for a log scale."}
                aria-label="Log scale"
                aria-pressed={log}
                onClick={() => setLog(!log)}
                className={cn(SEG, "px-2 font-mono text-[10.5px] font-medium", log ? "bg-white text-zinc-900 shadow-[0_1px_3px_rgba(0,0,0,0.12)] dark:bg-zinc-700 dark:text-zinc-50" : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100")}
              >
                log
              </button>
            </>
          )}
          {canRun && view !== "table" && (
            <>
              <span className="mx-1 h-3.5 w-px bg-zinc-200 dark:bg-zinc-800" />
              <button
                type="button"
                title="Running total"
                aria-label="Running total"
                aria-pressed={running}
                onClick={() => setRunning((r) => !r)}
                className={cn(SEG, running ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-zinc-50" : "text-zinc-400 hover:text-zinc-900 dark:text-zinc-500 dark:hover:text-zinc-100")}
              >
                <Sigma className="h-3.5 w-3.5" strokeWidth={1.75} />
              </button>
            </>
          )}
        </div>
        </div>
      </div>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={family} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, transition: reduced ? { duration: 0 } : { ...MOTION, duration: 0.12 } }} transition={t}>
          {Own ? <Own {...props} /> : family === "table" ? <PanelTable {...props} /> : <PanelChart {...props} panel={drawn} log={log} />}
        </motion.div>
      </AnimatePresence>
    </section>
  );
}
