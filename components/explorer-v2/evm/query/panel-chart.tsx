"use client";

import { useCallback, useId, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type MouseEvent as ReactMouseEvent } from "react";
import { Area, Bar, CartesianGrid, Cell, ComposedChart, Customized, LabelList, Line, ReferenceArea, ReferenceLine, ResponsiveContainer, Scatter, Tooltip as RechartsTooltip, XAxis, YAxis } from "recharts";
import { cn } from "@/lib/utils";
import { TipPlate } from "@/components/explorer-v2/staking/bits";
import { truncate } from "@/components/explorer-v2/format";
import { clearColumn, order, toggleValue, withPick } from "@/lib/explorer-query/selection";
import type { Format, Series } from "@/lib/explorer-query/visual-spec";
import { isTime } from "@/lib/explorer-query/values";
import { SAID_PARTIAL } from "../query-client";
import { fmt, fmtX, nameFor, spanOf, tipX, xText, zoneOf } from "../query-format";
import { BandLabel, FitTick, MarkLabels } from "./fit-text";
import { HoverContext, HoverLayer, type HoverSpec } from "./hover-layer";
import { CHART_MS, FADE_CLASS, useNarrow, useReduced } from "./motion";
import { ACCENT, DIM, DOT_INK, MONO, TONES, inSelection, pickValue, toneOf, type PanelProps, type Row } from "./sheet";

/** a transformed series reads in its own unit: shares are percent, an index is a plain number */
const unitOf = (sr: Series): Format => (sr.transform === "share" ? "percent" : sr.transform === "indexed" ? "number" : sr.format);
/** a series' figure as the reader reads it: an outflow drawn below zero is still the amount that went out */
const shownOf = (sr: Series, v: unknown) => (sr.below && typeof v === "number" ? -v : v);

export function PanelChart({ panel, rows, names, sym, canDrill, onPick, selected, hoverKey, onHoverKey, selection, live, onSelection, compact, log = false }: PanelProps) {
  const reduced = useReduced();
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const [kb, setKb] = useState<number | null>(null);
  // after the keyboard's cursor leaves, the tooltip it opened is held shut until the pointer comes back
  const [shut, setShut] = useState(false);
  // rows the red lines' names stack in over the plot, so none covers another
  const [markRows, setMarkRows] = useState(1);
  const [drag, setDrag] = useState<[number, number] | null>(null);
  const dragging = drag !== null;
  const dragRef = useRef<{ a: number; b: number } | null>(null);
  const dragged = useRef(false);
  // the mark last handed to the page, so a move within one mark sets nothing
  const shown = useRef<number | null>(null);
  const uid = useId();
  const x = panel.x!;
  // rankings: order and cut before drawing; src keeps the page's own row
  // objects, so a pick hands back a row the page can find
  const { base, src } = useMemo(() => {
    let d = [...rows];
    if (panel.sortBy) {
      const k = panel.sortBy;
      d.sort((a, b) => ((b[k] as number) ?? 0) - ((a[k] as number) ?? 0));
      if (panel.sortDir === "asc") d.reverse();
    }
    if (panel.topN) d = d.slice(0, panel.topN);
    // every series draws from its own key, so one column can appear raw
    // and transformed (bars and their rolling average) in the same panel
    const out = d.map((r) => ({ ...r }) as Row);
    // a scatter's x axis is numeric; a time column is plotted as epoch ms
    if (panel.kind === "scatter" && panel.x && out.some((r) => isTime(r[panel.x!]))) {
      for (const r of out) r.__x = isTime(r[panel.x]) ? Date.parse(String(r[panel.x]).replace(" ", "T") + (String(r[panel.x]).length <= 10 ? "T00:00:00Z" : "Z")) : null;
    }
    const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
    panel.series.forEach((sr, i) => {
      const k = `__s${i}`;
      const vals = out.map((r) => num(r[sr.column]));
      if (sr.transform === "cumulative") {
        let acc = 0;
        vals.forEach((v, j) => (out[j][k] = v === null ? null : (acc += v)));
      } else if (sr.transform === "indexed") {
        const first = vals.find((v) => v !== null && v !== 0) ?? null;
        vals.forEach((v, j) => (out[j][k] = v === null || first === null ? null : (v / first) * 100));
      } else if (sr.transform === "rolling") {
        vals.forEach((_, j) => {
          const win = vals.slice(Math.max(0, j - 4), j + 1).filter((v): v is number => v !== null);
          out[j][k] = win.length ? win.reduce((a, b) => a + b, 0) / win.length : null;
        });
      } else if (sr.transform === "share") {
        const parts = panel.series.map((p, pi) => ({ p, pi })).filter(({ p }) => p.transform === "share");
        out.forEach((r, j) => {
          const total = parts.reduce((a, { p }) => a + (num(r[p.column]) ?? 0), 0);
          out[j][k] = total > 0 ? ((num(r[sr.column]) ?? 0) / total) * 100 : null;
        });
      } else vals.forEach((v, j) => (out[j][k] = v));
      // an outflow stands below the axis: it draws the column's value negated
      if (sr.below) for (const r of out) if (typeof r[k] === "number") r[k] = -(r[k] as number);
    });
    // the net line: each row's left-axis series summed, what came in less what went out
    if (panel.net) {
      const legs = panel.series.flatMap((s, i) => (s.axis === "right" ? [] : [`__s${i}`]));
      for (const r of out) r.__net = legs.some((k) => typeof r[k] === "number") ? legs.reduce((a, k) => a + (typeof r[k] === "number" ? (r[k] as number) : 0), 0) : null;
    }
    return { base: out, src: d };
  }, [rows, panel.sortBy, panel.sortDir, panel.topN, panel.series, panel.kind, panel.x, panel.net]);
  const [span, zone] = useMemo(() => [spanOf(base.map((r) => r[x])), zoneOf(base.map((r) => r[x]))] as const, [base, x]);
  const horizontal = panel.kind === "hbar";
  const narrow = useNarrow();
  const scatter = panel.kind === "scatter";
  const timeX = scatter && base.some((r) => typeof r.__x === "number");
  // time or numeric buckets are a continuum: drag to select a range.
  // anything else is a set of categories: click to pick values
  const continuous = !horizontal && !scatter && (span !== "other" || (base.length > 0 && base.every((r) => typeof r[x] === "number")));
  const category = !continuous && !scatter;
  const selecting = !!onSelection && !scatter;
  const markOf = useCallback((sr: Series): "bar" | "line" | "area" => (horizontal ? "bar" : sr.mark !== "auto" ? sr.mark : panel.kind === "line" ? "line" : panel.kind === "area" ? "area" : "bar"), [horizontal, panel.kind]);
  // ins and outs: a series drawn below zero stacks the panel by sign, each period's ins above the axis and its outs below
  const signed = panel.series.some((s) => s.below);
  const stack = panel.stacked || signed;
  // a ranking of one figure writes it at the end of each bar, so no axis is read
  const valued = horizontal && panel.series.length === 1 && !stack;
  const netTone = TONES[panel.series.length % TONES.length];
  const left = panel.series.filter((s) => s.axis !== "right");
  const right = panel.series.filter((s) => s.axis === "right");
  const fmtL = left[0] ? unitOf(left[0]) : "number";
  const fmtR = right[0] ? unitOf(right[0]) : "number";

  const hasSel = live.length > 0;
  const lit = useMemo(() => base.map((r) => !hasSel || inSelection(live, r)), [base, live, hasSel]);
  const litCount = lit.filter(Boolean).length;
  // lines and areas cannot dim point by point: the whole trace recedes and
  // the selected stretch is drawn again over it in full ink
  const traces = !scatter && panel.series.some((s) => markOf(s) !== "bar");
  // a count beside its own parts (transactions and the reverted ones): the parts are never above the first series,
  // so they stand inside its bar, not beside it. The first series is then drawn as what is left of it
  const nested = useMemo(
    () =>
      !horizontal && !scatter && !stack && panel.series.length > 1 && panel.series.every((s) => markOf(s) === "bar" && s.axis !== "right") &&
      base.every((r) => typeof r.__s0 === "number" && panel.series.slice(1).reduce((sum, _, i) => (typeof r[`__s${i + 1}`] === "number" && (r[`__s${i + 1}`] as number) >= 0 ? sum + (r[`__s${i + 1}`] as number) : Infinity), 0) <= r.__s0),
    [base, panel.series, horizontal, scatter, stack],
  );
  const shaped = useMemo((): Row[] => (nested ? base.map((r) => ({ ...r, __d0: panel.series.slice(1).reduce((left, _, i) => left - (r[`__s${i + 1}`] as number), r.__s0 as number) })) : base), [base, nested, panel.series]);
  const data = useMemo(() => {
    if (!hasSel || !traces) return shaped;
    return shaped.map((r, j) => {
      const o: Row = { ...r };
      panel.series.forEach((_, i) => (o[`__in${i}`] = lit[j] ? r[`__s${i}`] : null));
      return o;
    });
  }, [shaped, lit, hasSel, traces, panel.series]);

  // markers and bands name x values; match them to the drawn category. An x that repeats has no one place (recharts lays
  // such an axis out by row), so nothing is marked on it
  const once = useMemo(() => new Set(data.map((r) => String(r[x]))).size === data.length, [data, x]);
  const xOf = useCallback((v: string | number) => (once ? (data.find((r) => String(r[x]) === String(v))?.[x] as string | number | undefined) : undefined), [data, x, once]);
  const label = useCallback((v: unknown) => xText(names, x, v, span, zone), [names, x, span, zone]);
  const rowH = compact ? 22 : 26;
  const height = horizontal ? Math.max(compact ? 120 : 160, data.length * rowH + 36) : compact ? 180 : 260;
  const active = hoverIdx ?? kb;
  const drillMark = category && selecting && canDrill;
  // the chevron sits on the bar that ends the stack above the axis, or the first bar
  const barIdx = panel.series.map((s, i) => ({ s, i })).filter(({ s }) => markOf(s) === "bar");
  const doorSeries = drillMark && barIdx.length ? (stack ? (barIdx.filter(({ s }) => !s.below).pop() ?? barIdx[barIdx.length - 1]).i : barIdx[0].i) : -1;
  const rangePick = live.find((p) => p.kind === "range" && p.column === x);

  const describe = (j: number) => {
    const r = data[j];
    if (!r) return "";
    const figures = [...panel.series.map((s, i) => `${fmt(shownOf(s, r[`__s${i}`]), unitOf(s), sym)} ${s.label}`), ...(panel.net && typeof r.__net === "number" ? [`${fmt(r.__net, fmtL, sym)} net`] : [])].join(", ");
    return `${nameFor(names, x, r[x]) ?? label(r[x])}: ${figures}${hasSel && lit[j] ? ", selected" : ""}`;
  };

  /* gestures */
  const toggle = (j: number, additive: boolean) => {
    const r = data[j];
    if (!r || !onSelection) return;
    onSelection(toggleValue(selection, x, String(r[x] ?? ""), additive));
  };
  const setRange = (a: number, b: number) => {
    if (!onSelection) return;
    const vals = data.slice(Math.min(a, b), Math.max(a, b) + 1).map((r) => pickValue(r[x]));
    const sorted = [...vals].sort((p, q) => {
      const op = order(p);
      const oq = order(q);
      return op < oq ? -1 : op > oq ? 1 : 0;
    });
    if (sorted.length) onSelection(withPick(selection, { kind: "range", column: x, from: sorted[0], to: sorted[sorted.length - 1] }));
  };
  /** Space on a continuous chart: anchor a one-point range, then stretch it */
  const spaceRange = (j: number) => {
    if (!onSelection) return;
    const v = pickValue(data[j]?.[x]);
    const cur = selection.find((p) => p.column === x && p.kind === "range");
    if (!cur || cur.kind !== "range") return onSelection(withPick(selection, { kind: "range", column: x, from: v, to: v }));
    if (cur.from === v && cur.to === v) return onSelection(clearColumn(selection, x));
    const all = [cur.from, cur.to, v];
    const lo = all.reduce((m, q) => (order(q) < order(m) ? q : m));
    const hi = all.reduce((m, q) => (order(q) > order(m) ? q : m));
    onSelection(withPick(selection, { kind: "range", column: x, from: lo, to: hi }));
  };
  const drill = (j: number | null | undefined) => {
    if (typeof j === "number" && src[j] && canDrill) onPick(src[j]);
  };
  const walk = (j: number | null) => {
    shown.current = null;
    if (j === null && kb !== null) setShut(true);
    setKb(j);
    onHoverKey?.(j === null ? undefined : data[j]?.[x]);
  };
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const n = data.length;
    if (!n) return;
    const next = e.key === "ArrowRight" || e.key === "ArrowDown";
    const prev = e.key === "ArrowLeft" || e.key === "ArrowUp";
    if (next || prev) {
      e.preventDefault();
      setHoverIdx(null);
      const cur = kb ?? (next ? -1 : n);
      walk(Math.max(0, Math.min(n - 1, cur + (next ? 1 : -1))));
    } else if (e.key === "Home" || e.key === "End") {
      e.preventDefault();
      walk(e.key === "Home" ? 0 : n - 1);
    } else if (e.key === "Enter") {
      if (kb !== null && canDrill) {
        e.preventDefault();
        drill(kb);
      }
    } else if (e.key === " ") {
      if (kb !== null && selecting) {
        e.preventDefault();
        if (category) toggle(kb, true);
        else spaceRange(kb);
      }
    } else if (e.key === "Escape") {
      if (onSelection && selection.length) {
        e.preventDefault();
        onSelection([]);
      }
      walk(null);
    }
  };

  const idxOf = (s: unknown) => {
    const i = (s as { activeTooltipIndex?: number } | null)?.activeTooltipIndex;
    return typeof i === "number" && i >= 0 && i < data.length ? i : null;
  };

  /** a bar's ink: the selection first, then the drill. The pointer's focus is the hover
      layer's style rule over the two inks each bar carries: in focus, and beside it */
  const inkOf = useCallback(
    (j: number, dashed: boolean) => {
      let o = lit[j] ? 0.9 : DIM;
      if (selected !== undefined && data[j]?.[x] !== selected) o = Math.min(o, 0.3);
      // a bucket the edge marks partial or still filling is drawn faint, so a short edge bar never reads as a drop
      const k = (dashed ? 0.35 : 1) * (panel.markers.some((m) => String(m.x) === String(data[j]?.[x]) && SAID_PARTIAL.test(m.label)) ? 0.45 : 1);
      const off = !hasSel && selected === undefined ? 0.4 : o;
      return { base: k * o, style: { "--qv-on": k * (lit[j] ? 1 : 0.5), "--qv-off": k * off } as CSSProperties };
    },
    [data, lit, selected, x, hasSel, panel.markers],
  );
  const drillRef = useRef(drill);
  drillRef.current = drill;
  const open = useCallback((j: number) => drillRef.current(j), []);
  const hover = useMemo(() => ({ active, key: hoverKey, drag }), [active, hoverKey, drag]);

  /* the chart's gestures, read through a ref: the chart below is built
     once per data and selection, and each handler still sees this render */
  const ev = useRef({ down: (_s: unknown) => {}, up: () => {}, click: (_s: unknown, _e?: ReactMouseEvent) => {}, move: (_s: unknown) => {}, leave: () => {} });
  ev.current = {
    down: (s) => {
      dragged.current = false;
      const i = idxOf(s);
      if (selecting && continuous && i !== null) dragRef.current = { a: i, b: i };
    },
    up: () => {
      const d = dragRef.current;
      dragRef.current = null;
      setDrag(null);
      if (d && d.a !== d.b) {
        dragged.current = true;
        setRange(d.a, d.b);
      }
    },
    click: (s, e) => {
      if (dragged.current) {
        dragged.current = false;
        return;
      }
      const i = idxOf(s);
      if (i === null) return;
      if (selecting && category) toggle(i, !!(e && (e.shiftKey || e.metaKey || e.ctrlKey)));
      else drill(i);
    },
    move: (s) => {
      const idx = idxOf(s);
      // off the plot (the chevron's margin) the last mark stays in hand
      if (idx === null) return;
      if (kb !== null) setKb(null);
      if (shut) setShut(false);
      if (idx !== shown.current) {
        shown.current = idx;
        setHoverIdx(idx);
        onHoverKey?.(data[idx]?.[x]);
      }
      const d = dragRef.current;
      if (d && idx !== d.b) {
        d.b = idx;
        setDrag([d.a, idx]);
      }
    },
    leave: () => {
      const d = dragRef.current;
      dragRef.current = null;
      setDrag(null);
      if (d && d.a !== d.b) setRange(d.a, d.b);
      shown.current = null;
      setHoverIdx(null);
      onHoverKey?.(undefined);
    },
  };

  const anim = useMemo(() => ({ isAnimationActive: !reduced, animationDuration: CHART_MS, animationEasing: "ease-out" as const }), [reduced]);
  const traceInk = hasSel ? 0.3 : 1;
  const mode = scatter ? "scatter" : horizontal ? "ranking" : continuous ? "series" : "columns";
  const hint = selecting ? (category ? "Arrow keys move, Space selects, Enter opens, Escape clears." : "Arrow keys move, Space marks a range, Enter opens, Escape clears.") : "Arrow keys move, Enter opens.";
  const spec = useMemo<HoverSpec>(
    () => ({ uid, data, x, scatter, door: doorSeries >= 0 ? `__s${doorSeries}` : null, horizontal, cross: continuous, label, open }),
    [uid, data, x, scatter, doorSeries, horizontal, continuous, label, open],
  );
  const chart = useMemo(
    () => (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={data}
              layout={horizontal ? "vertical" : "horizontal"}
              margin={{ top: (horizontal ? panel.referenceLines.length > 0 : drillMark || (!scatter && panel.markers.length > 0)) ? 5 + 13 * markRows : 4, right: valued ? (drillMark ? 76 : 52) : drillMark && horizontal ? 28 : right.length ? 8 : scatter ? 36 : 12, left: 0, bottom: 0 }}
              barCategoryGap={horizontal ? "26%" : "18%"}
              stackOffset={signed ? "sign" : undefined}
              onMouseDown={(s) => ev.current.down(s)}
              onMouseUp={() => ev.current.up()}
              onClick={(s, e: ReactMouseEvent | undefined) => ev.current.click(s, e)}
              onMouseMove={(s) => ev.current.move(s)}
              onMouseLeave={() => ev.current.leave()}
            >
              <CartesianGrid vertical={horizontal} horizontal={!horizontal} stroke="rgba(161,161,170,0.14)" />
              {/* recharts reads axes as direct children: no fragments here */}
              {horizontal && <XAxis type="number" hide={valued} tickFormatter={(v) => fmt(v, fmtL, sym, true)} tick={MONO} tickLine={false} axisLine={false} />}
              {horizontal && <YAxis type="category" dataKey={x} tickFormatter={label} tick={MONO} tickLine={false} axisLine={false} width={narrow ? 92 : compact ? 120 : 172} interval={0} />}
              {!horizontal && !scatter && <XAxis dataKey={x} tickFormatter={label} tick={<FitTick />} tickLine={false} axisLine={false} minTickGap={28} interval="preserveEnd" />}
              {scatter && (
                <XAxis
                  type="number"
                  dataKey={timeX ? "__x" : x}
                  domain={timeX ? ["dataMin", "dataMax"] : ["auto", "auto"]}
                  tickFormatter={(v: number) => (timeX ? fmtX(new Date(v).toISOString().slice(0, 19).replace("T", " "), span, zone) : fmt(v, "compact", sym, true))}
                  tick={MONO}
                  tickLine={false}
                  axisLine={false}
                  minTickGap={28}
                  name={x}
                />
              )}
              {!horizontal && <YAxis yAxisId="left" scale={log ? "log" : "auto"} domain={log ? ["auto", "auto"] : undefined} tickFormatter={(v) => fmt(v, fmtL, sym, true)} tick={MONO} tickLine={false} axisLine={false} width={56} />}
              {!horizontal && right.length > 0 && <YAxis yAxisId="right" orientation="right" tickFormatter={(v) => fmt(v, fmtR, sym, true)} tick={MONO} tickLine={false} axisLine={false} width={56} />}
              <RechartsTooltip
                // the keyboard drives the tooltip through defaultIndex; off the
                // chart with no keyboard cursor it is forced shut
                defaultIndex={!scatter && kb !== null ? kb : undefined}
                active={dragging ? false : !scatter && kb !== null ? true : shut ? false : undefined}
                isAnimationActive={false}
                cursor={continuous && markOf(panel.series[0]) !== "bar" ? { stroke: "rgba(161,161,170,0.4)" } : { fill: "rgba(161,161,170,0.08)" }}
                content={({ active: on, payload }) => {
                  if (!on || !payload?.[0]) return null;
                  const r = payload[0].payload as Row;
                  const name = nameFor(names, x, r[x]);
                  return (
                    <TipPlate>
                      <p className="font-mono text-[10px] text-zinc-500">
                        {name ?? tipX(r[x], span, zone)}
                        {name && <span className="ml-2 text-zinc-300 dark:text-zinc-600">{String(r[x]).length > 20 ? truncate(String(r[x]), 6) : String(r[x])}</span>}
                      </p>
                      {scatter && !timeX && (
                        <p className="font-mono text-[11px] tabular-nums text-zinc-900 dark:text-zinc-100">
                          {fmt(r[x], "number", sym)} <span className="text-zinc-400">{x.replace(/_/g, " ")}</span>
                        </p>
                      )}
                      {panel.series.map((s, i) => (
                        <p key={`${s.column}-${i}`} className="flex items-center gap-2 font-mono text-[11px] tabular-nums text-zinc-900 dark:text-zinc-100">
                          <span className="h-1.5 w-1.5 rounded-full" style={{ background: toneOf(s, i) }} />
                          {fmt(shownOf(s, r[`__s${i}`]), unitOf(s), sym)} <span className="text-zinc-400">{s.label}</span>
                          {s.transform !== "none" && s.transform !== "share" && typeof r[s.column] === "number" && <span className="text-zinc-300 dark:text-zinc-600">raw {fmt(r[s.column], s.format, sym)}</span>}
                        </p>
                      ))}
                      {panel.net && typeof r.__net === "number" && (
                        <p className="flex items-center gap-2 font-mono text-[11px] tabular-nums text-zinc-900 dark:text-zinc-100">
                          <span className="h-0.5 w-2" style={{ background: netTone }} />
                          {fmt(r.__net, fmtL, sym)} <span className="text-zinc-400">net</span>
                        </p>
                      )}
                      {(selecting || canDrill) && (
                        <p className="mt-1 font-mono text-[10px] text-zinc-400 dark:text-zinc-500">
                          {selecting && category ? `click selects${canDrill ? ", double-click opens" : ""}` : selecting && continuous ? `drag selects${canDrill ? ", click opens" : ""}` : "click opens"}
                        </p>
                      )}
                    </TipPlate>
                  );
                }}
              />
              {!horizontal &&
                !scatter &&
                panel.bands.map((b) => {
                  const x1 = xOf(b.from);
                  const x2 = xOf(b.to);
                  return x1 !== undefined && x2 !== undefined ? (
                    <ReferenceArea key={b.label} yAxisId="left" x1={x1} x2={x2} ifOverflow="visible" fill="currentColor" fillOpacity={0.04} stroke="none" label={<BandLabel value={b.label} />} />
                  ) : null;
                })}
              {continuous &&
                rangePick?.kind === "range" &&
                (() => {
                  const x1 = xOf(rangePick.from);
                  const x2 = xOf(rangePick.to);
                  return x1 !== undefined && x2 !== undefined ? <ReferenceArea yAxisId="left" x1={x1} x2={x2} ifOverflow="visible" fill={ACCENT} fillOpacity={0.06} stroke="none" /> : null;
                })()}
              {!horizontal &&
                !scatter &&
                panel.markers.map((m) => {
                  const mx = xOf(m.x);
                  return mx !== undefined ? <ReferenceLine key={`${m.label}-${String(m.x)}`} yAxisId="left" x={mx} ifOverflow="visible" stroke="#E6212F" strokeOpacity={0.7} strokeDasharray="3 3" /> : null;
                })}
              {panel.referenceLines.map((l) =>
                horizontal ? (
                  <ReferenceLine key={l.label} x={l.y} stroke="#E6212F" strokeDasharray="4 3" />
                ) : (
                  <ReferenceLine key={l.label} yAxisId="left" y={l.y} stroke="#E6212F" strokeDasharray="4 3" label={{ value: l.label, position: "insideTopRight", fontSize: 10, fontFamily: "var(--font-geist-mono)", fill: "#E6212F" }} />
                ),
              )}
              {panel.series.flatMap((s, i) => {
                const tone = toneOf(s, i);
                const key = `${s.column}-${i}`;
                const dataKey = `__s${i}`;
                // a ranking has one unnamed axis pair; an explicit undefined id
                // would not match it, so the prop is left out entirely
                const axis = horizontal ? {} : { yAxisId: s.axis === "right" ? "right" : "left" };
                const dash = s.dashed ? "5 4" : undefined;
                if (scatter)
                  return [
                    <Scatter key={`${key}-dot`} {...axis} dataKey={dataKey} fill={tone} {...anim} onClick={(_d: unknown, j: number) => open(j)}>
                      {data.map((_, j) => (
                        <Cell key={j} fillOpacity={0.7} className={`qv-m qv-i-${j}`} style={DOT_INK} />
                      ))}
                    </Scatter>,
                  ];
                const mark = markOf(s);
                // keys carry the mark, so a view change mounts the new mark and
                // recharts grows it; the same mark keeps its key and morphs
                if (mark === "line")
                  return [
                    <Line key={`${key}-line`} {...axis} type="monotone" dataKey={dataKey} stroke={tone} strokeOpacity={traceInk} strokeWidth={s.transform === "rolling" ? 2 : 1.5} strokeDasharray={dash} dot={false} {...anim} connectNulls />,
                    ...(hasSel
                      ? [<Line key={`${key}-line-in`} {...axis} type="monotone" dataKey={`__in${i}`} stroke={tone} strokeWidth={s.transform === "rolling" ? 2.25 : 1.75} strokeDasharray={dash} dot={litCount === 1 ? { r: 2.5, fill: tone, strokeWidth: 0 } : false} activeDot={false} isAnimationActive={false} legendType="none" />]
                      : []),
                  ];
                if (mark === "area")
                  return [
                    <Area key={`${key}-area`} {...axis} type="monotone" dataKey={dataKey} stroke={tone} strokeOpacity={traceInk} fill={tone} fillOpacity={(s.dashed ? 0.05 : 0.16) * (hasSel ? 0.4 : 1)} strokeWidth={1.5} strokeDasharray={dash} stackId={stack ? `s-${s.axis}` : undefined} {...anim} />,
                    ...(hasSel
                      ? [<Area key={`${key}-area-in`} {...axis} type="monotone" dataKey={`__in${i}`} stroke={tone} fill={tone} fillOpacity={s.dashed ? 0.06 : 0.2} strokeWidth={1.75} strokeDasharray={dash} stackId={stack ? `in-${s.axis}` : undefined} activeDot={false} isAnimationActive={false} legendType="none" />]
                      : []),
                  ];
                return [
                  <Bar
                    key={`${key}-bar`}
                    {...axis}
                    dataKey={nested && i === 0 ? "__d0" : dataKey}
                    fill={tone}
                    stroke={s.dashed ? tone : undefined}
                    strokeDasharray={dash}
                    stackId={stack || nested ? `s-${s.axis}` : undefined}
                    {...anim}
                    minPointSize={nested ? 0 : 1}
                    radius={stack || nested ? 0 : horizontal ? [0, 2, 2, 0] : [2, 2, 0, 0]}
                  >
                    {valued && <LabelList dataKey={dataKey} position="right" offset={6} formatter={(v: number) => fmt(v, s.format, sym, true)} style={MONO} className="fill-zinc-600 dark:fill-zinc-300" />}
                    {data.map((_, j) => {
                      const ink = inkOf(j, s.dashed);
                      return <Cell key={j} fillOpacity={ink.base} className={`qv-m qv-i-${j}`} style={ink.style} />;
                    })}
                  </Bar>,
                ];
              })}
              {signed && (horizontal ? <ReferenceLine x={0} stroke="currentColor" strokeOpacity={0.35} /> : <ReferenceLine yAxisId="left" y={0} stroke="currentColor" strokeOpacity={0.35} />)}
              {panel.net && signed && !horizontal && <Line key="net" yAxisId="left" type="monotone" dataKey="__net" stroke={netTone} strokeWidth={1.75} dot={false} activeDot={false} {...anim} connectNulls />}
              <Customized component={<MarkLabels marks={horizontal ? panel.referenceLines.map((l) => ({ x: l.y, label: l.label })) : scatter ? [] : panel.markers.flatMap((m) => (xOf(m.x) !== undefined ? [{ x: xOf(m.x)!, label: m.label }] : []))} onRows={setMarkRows} />} />
              <Customized component={<HoverLayer spec={spec} />} />
            </ComposedChart>
          </ResponsiveContainer>
    ),
    [data, x, names, sym, span, zone, horizontal, scatter, timeX, continuous, category, selecting, canDrill, drillMark, narrow, compact, log, fmtL, fmtR, right.length, panel, rangePick, dragging, kb, shut, markRows, hasSel, litCount, traceInk, anim, label, xOf, markOf, inkOf, open, spec],
  );

  return (
    <div className="flex flex-col gap-3">
      {(panel.series.length > 1 || panel.series.some((sr) => sr.dashed || sr.transform !== "none")) && (
        <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1">
          {panel.series.map((s, i) => (
            <span key={`${s.column}-${i}`} className="flex items-center gap-1.5 font-mono text-[10px] text-zinc-500 dark:text-zinc-400">
              {s.dashed ? (
                <span className="w-3 border-t-2 border-dashed" style={{ borderColor: toneOf(s, i) }} />
              ) : markOf(s) === "line" ? (
                <span className="w-3 border-t-2" style={{ borderColor: toneOf(s, i) }} />
              ) : (
                <span className="h-2 w-2 rounded-[2px]" style={{ background: toneOf(s, i) }} />
              )}
              {s.label}
              {s.transform !== "none" && <span className="text-zinc-300 dark:text-zinc-600">{s.transform === "indexed" ? "index" : s.transform}</span>}
            </span>
          ))}
          {panel.net && signed && (
            <span className="flex items-center gap-1.5 font-mono text-[10px] text-zinc-500 dark:text-zinc-400">
              <span className="w-3 border-t-2" style={{ borderColor: netTone }} />
              Net
            </span>
          )}
        </div>
      )}
      <div
        style={{ height }}
        tabIndex={0}
        role="group"
        data-qv={uid}
        aria-roledescription="chart"
        aria-label={`${panel.title || "Chart"}, ${mode} of ${data.length} ${data.length === 1 ? "mark" : "marks"}. ${hint}`}
        onKeyDown={onKey}
        onBlur={() => walk(null)}
        onMouseEnter={() => shut && setShut(false)}
        onDoubleClick={() => selecting && category && drill(active)}
        className={cn(
          "relative rounded-md text-zinc-900 outline-none select-none focus-visible:ring-2 focus-visible:ring-[#0061E2]/40 focus-visible:ring-offset-4 focus-visible:ring-offset-white dark:text-zinc-100 dark:focus-visible:ring-offset-zinc-950",
          FADE_CLASS,
          selecting && continuous ? "cursor-crosshair" : (canDrill || (selecting && category)) && "cursor-pointer",
        )}
      >
        <span className="sr-only" aria-live="polite">
          {kb !== null ? describe(kb) : ""}
        </span>
        <HoverContext.Provider value={hover}>{chart}</HoverContext.Provider>
      </div>
      {scatter && kb !== null && <p className="font-mono text-[11px] tabular-nums text-zinc-500 dark:text-zinc-400">{describe(kb)}</p>}
    </div>
  );
}
