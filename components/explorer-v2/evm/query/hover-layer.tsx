"use client";

import { createContext, useContext, type ReactNode } from "react";
import { ACCENT, type Row } from "./sheet";

/** the small door to a mark's records, drawn beside the hovered bar */
function OpenMark({ cx, cy, label, onOpen }: { cx: number; cy: number; label: string; onOpen: () => void }) {
  return (
    <g
      transform={`translate(${cx},${cy})`}
      role="button"
      aria-label={`Open ${label}`}
      className="cursor-pointer"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation();
        onOpen();
      }}
    >
      <circle r={9} className="fill-white stroke-zinc-300 dark:fill-zinc-900 dark:stroke-zinc-600" strokeWidth={1} />
      <path d="M-1.5 -3.5 L2 0 L-1.5 3.5" fill="none" className="stroke-zinc-700 dark:stroke-zinc-200" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </g>
  );
}

/* A hover never draws the marks again. Recharts lays a chart out again
   whenever a child's props change, and a mark's ink or a door in a bar's
   label changed on every move: a chart of 721 bars cost 138 ms a move.
   So the marks hold only what the data and the selection say, and what
   the pointer lights is drawn by one small layer in the chart's own svg:
   the marks' focus as a style rule, the door, the line that follows a
   hover elsewhere on the page, and the band a drag draws. */

/** the mark under the pointer or the keyboard, the x value hovered anywhere on the page, and a drag's two ends */
export const HoverContext = createContext<{ active: number | null; key: unknown; drag: [number, number] | null }>({ active: null, key: undefined, drag: null });

export type HoverSpec = {
  /** the chart's scope for its style rule */
  uid: string;
  data: Row[];
  x: string;
  /** a scatter's dots follow only their own pointer */
  scatter: boolean;
  /** the dataKey of the bars that carry the door, if any */
  door: string | null;
  horizontal: boolean;
  /** a continuous chart marks a hover elsewhere on the page with a line */
  cross: boolean;
  label: (v: unknown) => string;
  open: (j: number) => void;
};

/** what recharts hands a Customized child: the laid-out marks and the plot's box */
type Laid = {
  formattedGraphicalItems?: { item?: { props?: { dataKey?: unknown } }; props?: { data?: { x?: number; y?: number; width?: number; height?: number }[]; points?: { x?: number | null }[] } }[];
  offset?: { top?: number; height?: number };
};

export function HoverLayer({ spec, formattedGraphicalItems: items, offset }: { spec: HoverSpec } & Laid) {
  const { active, key, drag } = useContext(HoverContext);
  const { data, x, uid } = spec;
  const named = active === null && key !== undefined ? data.findIndex((r) => r[x] === key) : -1;
  // null: nothing in focus; -1: a value these marks do not hold, so every mark recedes
  const focus = spec.scatter ? active : active !== null ? active : key !== undefined ? named : null;
  const rule = focus === null ? "" : `[data-qv="${uid}"] .qv-m{fill-opacity:var(--qv-off)}${focus >= 0 ? `[data-qv="${uid}"] .qv-i-${focus}{fill-opacity:var(--qv-on)}` : ""}`;
  let door: ReactNode = null;
  if (spec.door && active !== null) {
    const b = items?.find((it) => it.item?.props?.dataKey === spec.door)?.props?.data?.[active];
    if (b && b.x !== undefined && b.y !== undefined) {
      const bw = b.width ?? 0;
      const bh = b.height ?? 0;
      const cx = spec.horizontal ? b.x + Math.max(0, bw) + 13 : b.x + bw / 2;
      const cy = spec.horizontal ? b.y + bh / 2 : Math.min(b.y, b.y + bh) - 11;
      const j = active;
      door = <OpenMark cx={cx} cy={cy} label={spec.label(data[j]?.[x])} onOpen={() => spec.open(j)} />;
    }
  }
  // a mark's left edge, middle and right edge on the x axis, from the first series as laid out
  const first = items?.[0]?.props;
  const edges = (j: number): [number, number, number] | null => {
    const bar = first?.data?.[j];
    if (bar?.x !== undefined) return [bar.x, bar.x + (bar.width ?? 0) / 2, bar.x + (bar.width ?? 0)];
    const px = first?.points?.[j]?.x;
    return typeof px === "number" ? [px, px, px] : null;
  };
  const top = offset?.top;
  const tall = offset?.height;
  let line: ReactNode = null;
  if (spec.cross && named >= 0 && top !== undefined && tall !== undefined) {
    const e = edges(named);
    if (e) line = <line x1={e[1]} x2={e[1]} y1={top} y2={top + tall} stroke="currentColor" strokeOpacity={0.5} strokeDasharray="2 3" />;
  }
  let band: ReactNode = null;
  if (drag && top !== undefined && tall !== undefined) {
    const a = edges(Math.min(drag[0], drag[1]));
    const b = edges(Math.max(drag[0], drag[1]));
    if (a && b) band = <rect x={a[0]} y={top} width={Math.max(1, b[2] - a[0])} height={tall} fill={ACCENT} fillOpacity={0.12} stroke={ACCENT} strokeOpacity={0.5} />;
  }
  return (
    <g>
      {rule && <style>{rule}</style>}
      {band}
      {line}
      {door}
    </g>
  );
}
