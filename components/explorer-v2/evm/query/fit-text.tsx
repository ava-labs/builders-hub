"use client";

import { useLayoutEffect, useRef, useState, type CSSProperties } from "react";

/* Words a chart writes at an x: a marker's "so far", a band's name, an axis
   tick. The svg cuts what runs past its edge, and over a line's last point
   (the plot's right edge, 12 px from the frame) a centered "so far" read
   "so fa". A marker's words that would run past an edge end at their line
   near the right edge and start at it near the left, so they still point at
   it. A tick or a band's name moves only as far as the frame needs: recharts
   spaced the ticks, and a longer move would put a tick over its neighbour. */

const MONO: CSSProperties = { fontSize: 10, fontFamily: "var(--font-geist-mono)" };

/** the left x of words `w` wide inside a frame `frame` wide. "line": centered on x when they fit, else ending at x near
    the right edge or starting at it near the left. "middle" (centered) and "start" (starting at x) move only as far as
    the frame needs */
export function fitLabel(x: number, w: number, frame: number, align: "line" | "middle" | "start" = "line", pad = 2): number {
  const left = align === "start" ? x : align === "middle" || (x - w / 2 >= pad && x + w / 2 <= frame - pad) ? x - w / 2 : x + w / 2 > frame - pad ? x - w : x;
  return Math.max(pad, Math.min(left, frame - pad - w));
}

type FitProps = { x: number; y: number; dy?: string; align: "line" | "middle" | "start"; fill: string; className?: string; children: string };

/** svg text that measures itself and its svg before the first paint, and moves inside the frame */
function FitText({ x, y, dy, align, fill, className, children }: FitProps) {
  const ref = useRef<SVGTextElement>(null);
  const [left, setLeft] = useState<number | null>(null);
  // every render: a resize moves the frame, a new text changes the width
  useLayoutEffect(() => {
    const svg = ref.current?.ownerSVGElement;
    if (!ref.current || !svg) return;
    const next = fitLabel(x, ref.current.getComputedTextLength(), svg.viewBox.baseVal?.width || svg.width.baseVal.value, align);
    setLeft((cur) => (cur !== null && Math.abs(cur - next) < 0.5 ? cur : next));
  });
  return (
    <text ref={ref} x={left ?? x} y={y} dy={dy} textAnchor={left !== null || align === "start" ? "start" : "middle"} fill={fill} style={MONO} className={className}>
      {children}
    </text>
  );
}

type Box = { x?: number; y?: number };

/** a ReferenceArea's name inside its top left corner; recharts hands it the area's viewBox */
export function BandLabel({ value, viewBox, offset = 5 }: { value: string; viewBox?: Box; offset?: number }) {
  return (
    <FitText x={(viewBox?.x ?? 0) + offset} y={(viewBox?.y ?? 0) + offset} dy="0.71em" align="start" fill="#71717a">
      {value}
    </FitText>
  );
}

type TickProps = { x?: number; y?: number; fill?: string; className?: string; index?: number; payload?: { value: unknown }; tickFormatter?: (v: unknown, i: number) => string };

/** an x axis tick under its mark; recharts hands it the tick's place, value and formatter */
export function FitTick({ x = 0, y = 0, fill = "#666", className, index = 0, payload, tickFormatter }: TickProps) {
  const v = payload?.value;
  return (
    <FitText x={x} y={y} dy="0.71em" align="middle" fill={fill} className={className}>
      {tickFormatter ? tickFormatter(v, index) : String(v ?? "")}
    </FitText>
  );
}

/* A chart's red lines name themselves over the plot, and lines a few marks apart ("Peak", "Latest week") wrote their
   names over each other. Each name goes on the lowest row where it covers no other, and the chart leaves room above
   the plot for the rows. Geist Mono at 10 px is 6 px a character, so a name's width is known before it is drawn. */

const CHAR = 6;
const ROW = 13;

/** each name's left x and row (0 just over the plot, each next row above it): placed left to right, each on the
    lowest row where it keeps `gap` from every name already there */
export function stackLabels(marks: { x: number; w: number }[], frame: number, gap = 8): { left: number; row: number }[] {
  const rows: [number, number][][] = [];
  const out = marks.map(() => ({ left: 0, row: 0 }));
  const order = marks.map((m, i) => ({ ...m, i })).sort((a, b) => a.x - b.x);
  for (const { x, w, i } of order) {
    const left = fitLabel(x, w, frame);
    const free = (row: [number, number][]) => row.every(([l, r]) => left + w + gap <= l || r + gap <= left);
    let row = rows.findIndex(free);
    if (row < 0) row = rows.push([]) - 1;
    rows[row].push([left, left + w]);
    out[i] = { left, row };
  }
  return out;
}

type XScale = ((v: unknown) => unknown) & { bandwidth?: () => number };
type ChartState = { xAxisMap?: Record<string, { scale?: XScale }>; offset?: { top?: number }; width?: number };

/** a Customized layer: the names of the chart's vertical red lines over the plot, stacked so none covers another. A
    name above the first row hangs a faint line down to its own; `onRows` tells the chart how many rows to leave */
export function MarkLabels({ marks, onRows, xAxisMap, offset, width = 0 }: { marks: { x: string | number; label: string }[]; onRows: (rows: number) => void } & ChartState) {
  const scale = Object.values(xAxisMap ?? {})[0]?.scale;
  const top = offset?.top ?? 0;
  const placed = marks.flatMap((m) => {
    const at = scale?.(m.x);
    // a category's line stands in the middle of its band, as recharts draws it
    return typeof at === "number" && Number.isFinite(at) ? [{ label: m.label, x: at + (scale?.bandwidth?.() ?? 0) / 2 }] : [];
  });
  const spots = stackLabels(placed.map((m) => ({ x: m.x, w: [...m.label].length * CHAR })), width);
  const rows = spots.reduce((n, s) => Math.max(n, s.row + 1), 1);
  useLayoutEffect(() => onRows(rows), [rows, onRows]);
  const base = (row: number) => top - 5 - row * ROW;
  return (
    <g>
      {placed.map((m, i) => (spots[i].row > 0 ? <line key={`l${i}`} x1={m.x} x2={m.x} y1={base(spots[i].row) + 3} y2={top} stroke="#E6212F" strokeOpacity={0.4} strokeDasharray="1 2" /> : null))}
      {placed.map((m, i) => (
        <text key={`t${i}`} x={spots[i].left} y={base(spots[i].row)} fill="#E6212F" style={MONO} className="qv-mark-label">
          {m.label}
        </text>
      ))}
    </g>
  );
}
