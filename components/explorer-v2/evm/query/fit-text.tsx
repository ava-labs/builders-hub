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

/** a ReferenceLine's label over the line's top, in red; recharts hands it the line's viewBox */
export function MarkLabel({ value, viewBox, offset = 5 }: { value: string; viewBox?: Box; offset?: number }) {
  return (
    <FitText x={viewBox?.x ?? 0} y={(viewBox?.y ?? 0) - offset} align="line" fill="#E6212F">
      {value}
    </FitText>
  );
}

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
