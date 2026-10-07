"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ResponsiveContainer, Sankey } from "recharts";
import { cn } from "@/lib/utils";
import { TipPlate } from "@/components/explorer-v2/staking/bits";
import { truncate } from "@/components/explorer-v2/format";
import type { Names } from "@/lib/explorer-query/types";
import { matches, type Selection } from "@/lib/explorer-query/selection";
import type { Format, Panel } from "@/lib/explorer-query/visual";
import { FADE_CLASS, useNarrow } from "./motion";
import { flowOf, type Flow, type FlowNode } from "./flow";

/* A flow panel: where value went. Each row is a sender, a receiver and an
   amount (flow.ts shapes them); the largest flows are bands from one to
   the other. The Sankey is laid out once per answer and never drawn again
   for a hover: a hover sets one attribute on the chart's frame, which
   rules written with the layout read to dim the other bands, and the
   plate under the pointer follows it by a transform, so a sweep across
   the bands restyles the chart's marks and nothing else. */

type Row = Record<string, unknown>;
type Router = ReturnType<typeof useRouter>;

/** the senders' inks, largest sender first; red is kept for what failed */
const TONES = ["#0061E2", "#0d9488", "#d97706", "#7c3aed"];
const OTHER_INK = "#a1a1aa";
const MONO = { fontSize: 10, fontFamily: "var(--font-geist-mono)" };
/** a character's width in MONO, in px */
const CH = 6;
/** a band's ink at rest (an inked band a little more on the dark sheet, or it sinks into the ground), dimmed under a hover or outside the selection, and lit */
const REST = 0.3;
const REST_DARK = 0.42;
const DIM = 0.07;
const LIT = 0.62;

type Hover = { kind: "node" | "link"; i: number };
type NodeMark = { x: number; y: number; width: number; height: number; index: number };
type LinkMark = { sourceX: number; sourceY: number; sourceControlX: number; targetX: number; targetY: number; targetControlX: number; linkWidth: number; index: number };

/** the page a node opens: an address or a P-Chain id opens its own page, as a row's cell does */
function doorOf(key: string, base?: string): string | null {
  if (!base) return null;
  if (/^0x[0-9a-fA-F]{40}$/.test(key)) return `${base}/address/${key}`;
  if (/^NodeID-[1-9A-HJ-NP-Za-km-z]{20,}$/.test(key)) return `${base}/node/${key}`;
  if (/^P-(avax|fuji|local)1[02-9ac-hj-np-z]{20,}$/.test(key)) return `${base}/address/${key}`;
  return null;
}

/** a node as the sheet names it: the server's name, else a short address, else the value */
function nodeText(n: FlowNode, chars: number): string {
  const t = n.other ? "Other" : (n.name ?? (/^0x[0-9a-fA-F]{40,64}$/.test(n.key) ? truncate(n.key, 6) : n.key));
  return t.length > chars ? `${t.slice(0, chars - 1)}…` : t;
}

/** what a band or Other holds when it folds smaller flows: 1 smaller flow, 12 smaller flows */
const folds = (n: number) => `${n} smaller ${n === 1 ? "flow" : "flows"}, folded`;

/** a flow's share of the total: whole from 10%, one place down to 0.1%, then <0.1% */
const pct = (v: number, total: number) => {
  const p = total > 0 ? (v / total) * 100 : 0;
  return `${p >= 10 || p === 0 ? p.toFixed(0) : p >= 0.1 ? p.toFixed(1) : "<0.1"}%`;
};

/* Next's router for the node links, kept in a ref by a child that renders nothing: useRouter reads the layout's
   context, which changes with every change of the URL, so a chart that called it would render again for each one */
function RouterRef({ into }: { into: { current: Router | null } }) {
  const router = useRouter();
  useEffect(() => {
    into.current = router;
  }, [into, router]);
  return null;
}

export type FlowChartProps = {
  panel: Panel;
  /** every row of the answer */
  rows: Row[];
  names: Names;
  sym: string;
  /** the page's figure format (QueryVisual's fmt), handed in: that file imports this one */
  fmt: (v: unknown, format: Format, sym: string, axis?: boolean) => string;
  /** the chain's explorer path: an address node opens its page */
  base?: string;
  /** the picks on columns these rows have: flows outside them recede */
  live: Selection;
  canDrill: boolean;
  /** opens the records behind a flow that is one row */
  onPick: (row: Row) => void;
  compact: boolean;
  /** a control the page adds to the panel header, e.g. pin to a board */
  action?: ReactNode;
  titled?: boolean;
};

export function FlowChart({ panel, rows, names, sym, fmt, base, live, canDrill, onPick, compact, action, titled = true }: FlowChartProps) {
  const narrow = useNarrow();
  const from = panel.x;
  const to = panel.target;
  const s = panel.series[0];
  const flow: Flow | null = useMemo(() => (from && to && s ? flowOf(rows, { from, to, value: s.column, names }) : null), [rows, from, to, s, names]);
  const format: Format = s?.format ?? "number";
  const cls = `flow-${useId().replace(/[^A-Za-z0-9]/g, "")}`;
  const [hover, setHover] = useState<Hover | null>(null);
  const tip = useRef<HTMLDivElement>(null);
  const router = useRef<Router | null>(null);
  // the latest props, read by callbacks that stay the same so the chart is never drawn again for them
  const latest = useRef({ canDrill, onPick, flow });
  useEffect(() => {
    latest.current = { canDrill, onPick, flow };
  });

  const labelW = narrow ? 92 : compact ? 128 : 172;
  const chars = narrow ? 11 : compact ? 15 : 20;
  const tallest = flow?.tallest ?? 0;
  const height = Math.min(compact ? 380 : 720, Math.max(compact ? 200 : 280, tallest * (compact ? 20 : 22) + 16));
  const pad = Math.max(4, Math.min(compact ? 8 : 12, Math.floor(((height - 16) * 0.45) / Math.max(1, tallest - 1))));

  const data = useMemo(() => {
    if (!flow) return null;
    // each sender's ink, by what it sends: the four largest get the inks, the rest and Other stay grey
    const bySent = flow.nodes.map((n, i) => ({ n, i })).filter(({ n }) => !n.other && n.drawnOut > 0).sort((a, b) => b.n.drawnOut - a.n.drawnOut);
    const tone = new Map(bySent.slice(0, TONES.length).map(({ i }, k) => [i, TONES[k]]));
    return {
      nodes: flow.nodes.map((n) => ({ name: n.key })),
      links: flow.links.map((l) => ({ source: l.source, target: l.target, value: l.value, tone: flow.nodes[l.source].other ? OTHER_INK : (tone.get(l.source) ?? "currentColor") })),
    };
  }, [flow]);

  // the link is an svg <a>, which JSX types as the html one: the handler takes any element's click
  const go = useCallback((e: ReactMouseEvent<Element>) => {
    // a plain click moves inside the app; a modified one opens as the browser would
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const href = e.currentTarget.getAttribute("href");
    if (!href || !router.current) return;
    e.preventDefault();
    router.current.push(href);
  }, []);

  const node = useCallback(
    (p: NodeMark) => {
      const n = flow?.nodes[p.index];
      if (!n || !flow) return <g />;
      const door = n.other ? null : doorOf(n.key, base);
      // the first column is named on its left, every other on its right; a stage between is named over the bands
      const first = n.depth === 0 && flow.depth > 0;
      const between = !first && n.depth < flow.depth;
      const figure = fmt(Math.max(n.drawnIn, n.drawnOut), format, sym, true);
      // a column at the chart's edge is named in its margin, which the svg ends: the name gets what the margin leaves
      // after the 6 px gap to its node, the 6 px before its figure, and the figure
      const room = between ? chars : Math.max(1, Math.min(chars, Math.floor((labelW - 14) / CH) - figure.length));
      const mark = (
        <>
          <rect x={p.x} y={p.y} width={p.width} height={Math.max(1, p.height)} rx={1} fill={n.other ? OTHER_INK : "currentColor"} fillOpacity={0.85} />
          <text
            x={first ? p.x - 6 : p.x + p.width + 6}
            y={p.y + p.height / 2}
            dy="0.35em"
            textAnchor={first ? "end" : "start"}
            style={MONO}
            strokeWidth={between ? 3 : 0}
            className={cn("fill-zinc-700 dark:fill-zinc-300", between && "stroke-white [paint-order:stroke] dark:stroke-zinc-950")}
          >
            {nodeText(n, room)}
            <tspan dx={6} className="fill-zinc-400 dark:fill-zinc-500">
              {figure}
            </tspan>
          </text>
        </>
      );
      return (
        <g className="fn" data-n={p.index}>
          {door ? (
            <a href={door} onClick={go} className="outline-none [&:focus-visible>rect]:stroke-[#0061E2] [&:focus-visible>rect]:[stroke-width:2]">
              {mark}
            </a>
          ) : (
            mark
          )}
        </g>
      );
    },
    [flow, base, chars, labelW, fmt, format, sym, go],
  );

  const link = useCallback(
    (p: LinkMark) => {
      const l = flow?.links[p.index];
      if (!l) return <path />;
      return (
        <path
          className="fl"
          data-i={p.index}
          data-s={l.source}
          data-t={l.target}
          d={`M${p.sourceX},${p.sourceY}C${p.sourceControlX},${p.sourceY} ${p.targetControlX},${p.targetY} ${p.targetX},${p.targetY}`}
          fill="none"
          stroke={data?.links[p.index]?.tone}
          strokeWidth={Math.max(1, p.linkWidth)}
          strokeOpacity={REST}
        />
      );
    },
    [flow, data],
  );

  const onEnter = useCallback((el: { index?: number }, kind: "node" | "link") => {
    if (typeof el?.index === "number") setHover({ kind, i: el.index });
  }, []);
  const onLeave = useCallback(() => setHover(null), []);
  const onClick = useCallback((el: { index?: number }, kind: "node" | "link") => {
    // a band that is one row opens its records; a node opens its page through its own link
    const { canDrill: open, onPick: pick, flow: f } = latest.current;
    const l = kind === "link" && typeof el?.index === "number" ? f?.links[el.index] : undefined;
    if (open && l && !l.folded && l.rows.length === 1) pick(l.rows[0]);
  }, []);
  const margin = useMemo(() => ({ top: 6, right: labelW, bottom: 6, left: labelW }), [labelW]);

  // laid out once per answer and size: a hover renders the plate and one attribute, never this
  const chart = useMemo(
    () =>
      data && (
        <ResponsiveContainer width="100%" height="100%">
          <Sankey data={data} node={node} link={link} margin={margin} nodeWidth={8} nodePadding={pad} linkCurvature={0.5} iterations={32} onMouseEnter={onEnter} onMouseLeave={onLeave} onClick={onClick} />
        </ResponsiveContainer>
      ),
    [data, node, link, margin, pad, onEnter, onLeave, onClick],
  );

  // flows outside the selection recede, as marks do on every other panel
  const unlit = useMemo(() => (flow && live.length ? flow.links.flatMap((l, i) => (l.rows.some((r) => live.every((p) => matches(r, p))) ? [] : [i])) : []), [flow, live]);
  // the rules for every hover, written once per answer: a hover sets one attribute on the frame, and the browser
  // restyles the chart's own marks, where a rule written for each hover would restyle the whole page
  const css = useMemo(() => {
    if (!flow) return "";
    const at = `.${cls}`;
    const on = `${at}:is([data-hl],[data-hn])`;
    // on the dark sheet the inked bands rise and the grey ones stay low, or the grey would outshine the inks
    const rules = [`:where(.dark) ${at} .fl{stroke-opacity:${REST_DARK}}`, `:where(.dark) ${at} .fl[stroke="currentColor"]{stroke-opacity:${REST}}`];
    if (unlit.length) rules.push(`${at} .fl:is(${unlit.map((i) => `[data-i="${i}"]`).join(",")}){stroke-opacity:${DIM}}`);
    rules.push(`${on} .fl{stroke-opacity:${DIM}}`, `${on} .fn{opacity:.45}`);
    flow.links.forEach((l, i) => rules.push(`${at}[data-hl="${i}"] .fl[data-i="${i}"]{stroke-opacity:${LIT}}`, `${at}[data-hl="${i}"] .fn:is([data-n="${l.source}"],[data-n="${l.target}"]){opacity:1}`));
    flow.nodes.forEach((_, n) => rules.push(`${at}[data-hn="${n}"] .fl:is([data-s="${n}"],[data-t="${n}"]){stroke-opacity:${LIT}}`, `${at}[data-hn="${n}"] .fn[data-n="${n}"]{opacity:1}`));
    return rules.join("");
  }, [cls, unlit, flow]);

  // the plate follows the pointer by a transform: no render, no layout
  const follow = useCallback((e: ReactMouseEvent<HTMLDivElement>) => {
    const t = tip.current;
    if (!t) return;
    const r = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    t.style.transform = `translate(${x}px, ${y}px) translate(${x > r.width / 2 ? "calc(-100% - 14px)" : "14px"}, ${y > r.height / 2 ? "calc(-100% - 10px)" : "10px"})`;
  }, []);

  if (!flow || !data) return null;
  const figure = (v: number) => fmt(v, format, sym);
  const largest = flow.links[0];
  const nameOf = (i: number) => nodeText(flow.nodes[i], 40);

  return (
    <section aria-label={panel.title || undefined} className="group/panel flex flex-col gap-3">
      <RouterRef into={router} />
      <div className="flex min-h-7 items-center justify-between gap-3">
        <span className="min-w-0 truncate font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">{titled && panel.title}</span>
        {action && <span className="hidden shrink-0 opacity-0 transition-opacity duration-200 group-hover/panel:opacity-100 group-focus-within/panel:opacity-100 sm:inline [@media(hover:none)]:opacity-100">{action}</span>}
      </div>
      {flow.links.length === 0 ? (
        <p className="py-10 text-center font-mono text-[11px] text-zinc-400 dark:text-zinc-500">No flow in these rows has an amount to draw.</p>
      ) : (
        <>
          {flow.mode === "sides" && (
            <div aria-hidden className="-mb-2 flex justify-between font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-400 dark:text-zinc-500">
              <span>From</span>
              <span>To</span>
            </div>
          )}
          <div
            style={{ height }}
            role="group"
            aria-roledescription="flow chart"
            aria-label={`${panel.title || "Flows"}: ${flow.links.length} flows between ${flow.nodes.length} names. The largest, ${nameOf(largest.source)} to ${nameOf(largest.target)}, carries ${figure(largest.value)}, ${pct(largest.value, flow.total)} of the total.`}
            onMouseMove={follow}
            onMouseLeave={onLeave}
            data-hl={hover?.kind === "link" ? hover.i : undefined}
            data-hn={hover?.kind === "node" ? hover.i : undefined}
            className={cn(cls, "relative rounded-md text-zinc-900 select-none dark:text-zinc-100 [&_.fn]:transition-opacity [&_.fn]:duration-200 motion-reduce:[&_.fn]:transition-none", FADE_CLASS)}
          >
            <style>{css}</style>
            {chart}
            <div ref={tip} className={cn("pointer-events-none absolute left-0 top-0 z-10 w-max max-w-72", !hover && "hidden")}>
              {hover && <Plate flow={flow} hover={hover} figure={figure} label={s.label} door={(n) => !n.other && !!doorOf(n.key, base)} drill={canDrill} />}
            </div>
          </div>
          {flow.skipped > 0 && (
            <p className="font-mono text-[10px] text-zinc-400 dark:text-zinc-500">
              {flow.skipped} {flow.skipped === 1 ? "row is" : "rows are"} not drawn: no amount, or a name paying itself.
            </p>
          )}
        </>
      )}
    </section>
  );
}

/** what the pointer is on: a flow's two ends, its amount and its share, or a name's sums */
function Plate({ flow, hover, figure, label, door, drill }: { flow: Flow; hover: Hover; figure: (v: number) => string; label: string; door: (n: FlowNode) => boolean; drill: boolean }) {
  const name = (n: FlowNode) => nodeText(n, 32);
  const line = "flex items-baseline gap-2 font-mono text-[11px] tabular-nums text-zinc-900 dark:text-zinc-100";
  const hint = "mt-1 font-mono text-[10px] text-zinc-400 dark:text-zinc-500";
  if (hover.kind === "link") {
    const l = flow.links[hover.i];
    if (!l) return null;
    const [a, b] = [flow.nodes[l.source], flow.nodes[l.target]];
    return (
      <TipPlate>
        <p className="font-mono text-[10px] text-zinc-500">
          {name(a)} <span className="text-zinc-300 dark:text-zinc-600">→</span> {name(b)}
        </p>
        <p className={line}>
          {figure(l.value)} <span className="text-zinc-400">{label}</span>
        </p>
        <p className={line}>
          {pct(l.value, flow.total)} <span className="text-zinc-400">of the total</span>
        </p>
        {l.folded > 0 && <p className={hint}>{folds(l.folded)}</p>}
        {drill && !l.folded && l.rows.length === 1 && <p className={hint}>click opens its records</p>}
      </TipPlate>
    );
  }
  const n = flow.nodes[hover.i];
  if (!n) return null;
  const long = !n.other && n.name && n.key.length > 20 ? truncate(n.key, 6) : null;
  // a name's sums are over every row; Other's are the flows it folds
  const sent = n.other ? n.drawnOut : n.sent;
  const received = n.other ? n.drawnIn : n.received;
  return (
    <TipPlate>
      <p className="font-mono text-[10px] text-zinc-500">
        {name(n)}
        {long && <span className="ml-2 text-zinc-300 dark:text-zinc-600">{long}</span>}
      </p>
      {sent > 0 && (
        <p className={line}>
          {figure(sent)} <span className="text-zinc-400">sent, {pct(sent, flow.total)}</span>
        </p>
      )}
      {received > 0 && (
        <p className={line}>
          {figure(received)} <span className="text-zinc-400">received, {pct(received, flow.total)}</span>
        </p>
      )}
      {n.other && <p className={hint}>{folds(n.folded)}</p>}
      {door(n) && <p className={hint}>click opens its page</p>}
    </TipPlate>
  );
}
