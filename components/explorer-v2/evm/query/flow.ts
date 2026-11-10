/* The shape of a flow panel: rows of a sender, a receiver and an amount,
   as the nodes and bands a Sankey draws. The largest flows are drawn as
   themselves and the rest fold into Other. A receiver that sends on
   stands between its senders and its receivers, a second stage; when
   value runs both ways, a band that would run back to an earlier name
   ends at a copy of it on the right. When that makes more than four
   columns, the flow is drawn as senders on the left and receivers on the
   right instead. The layout itself (recharts' Sankey) cannot draw a
   cycle: its depth search never ends. */

import type { Names } from "@/lib/explorer-query/types";
import { isAddress } from "@/lib/explorer-query/values";

type Row = Record<string, unknown>;

/** the most flows drawn as themselves; the rest fold into Other */
export const FLOW_TOP = 30;
/** the last column of a staged flow: four columns at most */
const MAX_DEPTH = 3;
/** the node keys of Other, on the side it sends from and the side it receives on */
const OTHER_FROM = "\u0000from";
const OTHER_TO = "\u0000to";

export type FlowNode = {
  /** the value the rows hold (an address, a name); for Other, an internal key */
  key: string;
  /** the name the server found for it, if any */
  name?: string;
  /** Other: the flows too small to draw */
  other: boolean;
  /** a second stand of a name: the right end of bands that run back to it */
  copy: boolean;
  /** its column, 0 at the left */
  depth: number;
  /** what the drawn bands carry in and out of it */
  drawnIn: number;
  drawnOut: number;
  /** what the rows say this name sent and received, drawn or folded */
  sent: number;
  received: number;
  /** for Other: how many flows it folds */
  folded: number;
};

export type FlowLink = {
  source: number;
  target: number;
  value: number;
  /** the page's rows it carries, for the selection and for opening its records */
  rows: Row[];
  /** 0 for a flow drawn as itself; else how many smaller flows it folds */
  folded: number;
};

export type Flow = {
  nodes: FlowNode[];
  links: FlowLink[];
  /** every amount the rows hold, the base of each share */
  total: number;
  /** stages: a receiver that sends on stands between; sides: senders on the left, receivers on the right */
  mode: "stages" | "sides";
  /** the rightmost column */
  depth: number;
  /** the most nodes in one column: how tall the chart stands */
  tallest: number;
  /** rows not drawn: no positive amount, no name on one side, or a name paying itself */
  skipped: number;
};

/** a row's value as a node key: addresses in lower case, so one address is one node */
const keyOf = (v: unknown): string | null => (v === null || v === undefined || v === "" ? null : isAddress(String(v)) ? String(v).toLowerCase() : String(v));
const amountOf = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
};

type Pair = { s: string; t: string; v: number; rows: Row[]; folded: number };

/** an order of the names in which few flows run backwards (the greedy order of Eades, Lin and Smyth, by amount):
    names that only send lead, names that only receive close, and of the rest the one that sends most on balance goes next */
function orderOf(keys: string[], pairs: Pair[]): string[] {
  const left = new Set(keys);
  const head: string[] = [];
  const tail: string[] = [];
  const sends = (k: string) => pairs.some((p) => p.s === k && p.t !== k && left.has(p.t));
  const gets = (k: string) => pairs.some((p) => p.t === k && p.s !== k && left.has(p.s));
  while (left.size) {
    for (let moved = true; moved; ) {
      moved = false;
      for (const k of [...left]) {
        if (sends(k)) continue;
        left.delete(k);
        tail.unshift(k);
        moved = true;
      }
      for (const k of [...left]) {
        if (gets(k)) continue;
        left.delete(k);
        head.push(k);
        moved = true;
      }
    }
    if (!left.size) break;
    let best = "";
    let most = -Infinity;
    for (const k of left) {
      const net = pairs.reduce((a, p) => a + (p.s === k && left.has(p.t) ? p.v : 0) - (p.t === k && left.has(p.s) ? p.v : 0), 0);
      if (net > most) [best, most] = [k, net];
    }
    left.delete(best);
    head.push(best);
  }
  return [...head, ...tail];
}

/** each node's column as recharts lays it: a sender with no senders at 0, each receiver one past its
    furthest sender, and every node that sends nothing at the last column */
function depthsOf(n: number, links: { source: number; target: number }[]): number[] {
  const depth = new Array<number>(n).fill(0);
  const into = new Array<number>(n).fill(0);
  const outs: number[][] = Array.from({ length: n }, () => []);
  for (const l of links) {
    into[l.target]++;
    outs[l.source].push(l.target);
  }
  // Kahn's order: the links are acyclic by construction
  const queue = depth.map((_, i) => i).filter((i) => into[i] === 0);
  for (let q = 0; q < queue.length; q++) {
    const i = queue[q];
    for (const j of outs[i]) {
      depth[j] = Math.max(depth[j], depth[i] + 1);
      if (--into[j] === 0) queue.push(j);
    }
  }
  const last = Math.max(0, ...depth);
  return depth.map((d, i) => (outs[i].length === 0 && last >= 1 ? last : d));
}

export function flowOf(rows: Row[], cols: { from: string; to: string; value: string; names: Names }, top = FLOW_TOP): Flow {
  const { from, to, value, names } = cols;
  // one pair per sender and receiver, whatever the rows' grain (a pair per day sums)
  const byPair = new Map<string, Pair>();
  const sent = new Map<string, number>();
  const received = new Map<string, number>();
  let total = 0;
  let skipped = 0;
  for (const r of rows) {
    const s = keyOf(r[from]);
    const t = keyOf(r[to]);
    const v = amountOf(r[value]);
    if (s === null || t === null || v === null || v <= 0 || s === t) {
      skipped++;
      continue;
    }
    const id = `${s}\u0000${t}`;
    const p = byPair.get(id) ?? byPair.set(id, { s, t, v: 0, rows: [], folded: 0 }).get(id)!;
    p.v += v;
    p.rows.push(r);
    sent.set(s, (sent.get(s) ?? 0) + v);
    received.set(t, (received.get(t) ?? 0) + v);
    total += v;
  }
  const pairs = [...byPair.values()].sort((a, b) => b.v - a.v);
  const kept = pairs.slice(0, top);
  const shown = new Set(kept.flatMap((p) => [p.s, p.t]));
  // the rest fold into Other on the sender's side when the sender is drawn, else on the receiver's
  const folds = new Map<string, Pair>();
  for (const p of pairs.slice(top)) {
    const s = shown.has(p.s) ? p.s : OTHER_FROM;
    const t = s === OTHER_FROM && shown.has(p.t) ? p.t : OTHER_TO;
    const id = `${s}\u0000${t}`;
    const f = folds.get(id) ?? folds.set(id, { s, t, v: 0, rows: [], folded: 0 }).get(id)!;
    f.v += p.v;
    f.rows.push(...p.rows);
    f.folded++;
  }
  const drawn = [...kept, ...[...folds.values()].sort((a, b) => b.v - a.v)];

  // names by what they carry, largest first: the layout starts each column in this order
  const carried = (k: string) => Math.max(sent.get(k) ?? 0, received.get(k) ?? 0);
  const keys = [...shown].sort((a, b) => carried(b) - carried(a));

  const build = (mode: Flow["mode"]) => {
    const nodes: FlowNode[] = [];
    const at = new Map<string, number>();
    const nodeOf = (key: string, side: "from" | "to" | "one", copy = false) => {
      const id = `${side}\u0000${copy ? "copy" : ""}\u0000${key}`;
      let i = at.get(id);
      if (i === undefined) {
        i = nodes.length;
        at.set(id, i);
        const other = key === OTHER_FROM || key === OTHER_TO;
        nodes.push({ key, name: other ? undefined : (names[from]?.[key.toLowerCase()] ?? names[to]?.[key.toLowerCase()]), other, copy, depth: 0, drawnIn: 0, drawnOut: 0, sent: sent.get(key) ?? 0, received: received.get(key) ?? 0, folded: 0 });
      }
      return i;
    };
    // every node is made in the order the layout should start with: named keys by size, Other last
    const rank = new Map<string, number>();
    // the flows that end at a copy of their receiver: those that run back, and those that would push a name that sends on past the columns
    const toCopy = new Set<Pair>();
    if (mode === "stages") {
      const order = orderOf(keys, kept);
      order.forEach((k, i) => rank.set(k, i));
      // a name with any band out of it, back to a copy included, is no last column: it stops one short of it
      const sendsOn = new Set(drawn.filter((p) => p.s !== OTHER_FROM).map((p) => p.s));
      const column = new Map<string, number>();
      for (const k of order) {
        let d = drawn.some((p) => p.s === OTHER_FROM && p.t === k) ? 1 : 0;
        for (const p of kept) {
          if (p.t !== k) continue;
          if (rank.get(p.s)! > rank.get(k)!) toCopy.add(p);
          else if (sendsOn.has(k) && column.get(p.s)! + 1 > MAX_DEPTH - 1) toCopy.add(p);
          else d = Math.max(d, column.get(p.s)! + 1);
        }
        column.set(k, d);
      }
      for (const k of keys) nodeOf(k, "one");
    } else {
      for (const k of keys) if (drawn.some((p) => p.s === k)) nodeOf(k, "from");
      for (const k of keys) if (drawn.some((p) => p.t === k)) nodeOf(k, "to");
    }
    const links: FlowLink[] = drawn.map((p) => {
      const back = toCopy.has(p);
      const source = mode === "stages" ? (p.s === OTHER_FROM ? nodeOf(p.s, "from") : nodeOf(p.s, "one")) : nodeOf(p.s, "from");
      const target = mode === "stages" ? (p.t === OTHER_TO ? nodeOf(p.t, "to") : nodeOf(p.t, "one", back)) : nodeOf(p.t, "to");
      return { source, target, value: p.v, rows: p.rows, folded: p.folded };
    });
    for (const l of links) {
      nodes[l.source].drawnOut += l.value;
      nodes[l.target].drawnIn += l.value;
      if (nodes[l.source].other) nodes[l.source].folded += l.folded;
      if (nodes[l.target].other) nodes[l.target].folded += l.folded;
    }
    const depth = depthsOf(nodes.length, links);
    depth.forEach((d, i) => (nodes[i].depth = d));
    const last = Math.max(0, ...depth);
    const columns = new Array<number>(last + 1).fill(0);
    for (const d of depth) columns[d]++;
    // with no receiver that sends on, a staged flow is two sides too
    return { nodes, links, total, mode: last <= 1 ? "sides" : mode, depth: last, tallest: Math.max(0, ...columns), skipped } satisfies Flow;
  };

  if (drawn.length === 0) return { nodes: [], links: [], total, mode: "sides", depth: 0, tallest: 0, skipped };
  // stages when some names send on but most only send or only receive (a hub, a chain), and when fewer names
  // stand twice than on two sides; a flow where nearly every name sends on reads better as two sides
  const staged = build("stages");
  const sides = build("sides");
  const named = staged.nodes.filter((n) => !n.other && !n.copy);
  const middle = named.filter((n) => n.depth > 0 && n.depth < staged.depth).length;
  return staged.mode === "stages" && middle <= named.length / 2 && staged.nodes.length < sides.nodes.length ? staged : sides;
}
