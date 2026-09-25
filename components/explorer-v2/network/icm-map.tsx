"use client";

import { useEffect, useId, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Board, EmptyRow, SectionHeader } from "@/components/explorer-v2/ui";
import { TipPlate } from "@/components/explorer-v2/staking/bits";
import { fmtCompact } from "@/components/explorer-v2/evm/metric-charts";
import { BLOCK_GRAY, PICK_BLUE, ViewSwitch } from "@/components/explorer-v2/network/icm-parts";
import l1ChainsData from "@/constants/l1-chains.json";
import type { L1Chain } from "@/types/stats";

/* The network as a model on a plate, in the block tape's axonometric
   projection. Every validator set is a tower standing on the plate, as
   tall as its validator count (or its messages); in the Versions view its
   floors are painted by client version, share by share, so the fleet's
   upgrade reads as volume. The C-Chain stands at the hub in brand red. Chains that sent or got ICM messages ring the
   hub; quiet sets stand on the outer ring and are listed by name under
   the plate, so a screenshot carries every chain. The window's messages
   arc through the air between tower tops, packets riding them from
   sender to receiver. Hover a tower to light its routes; click it and the
   page's tables are cut to it. Phones get the traffic as a ranked list.
   It fetches its own data, so the page only mounts it. */

interface MapChain {
  chainId: string;
  chainName: string;
  chainLogoURI: string;
  validatorCount: number | string;
}
interface FlowRoute {
  sourceChainId: string;
  targetChainId: string;
  messageCount: number;
}

interface Node {
  id: string;
  name: string;
  logo: string;
  validators: number;
  out: number;
  in: number;
  href: string | null;
  /** ground point on the plate */
  x: number;
  y: number;
  /** half the footprint's width */
  w: number;
  /** tower height */
  h: number;
  ring: "hub" | "inner" | "outer";
  order: number;
}
interface Route {
  key: string;
  from: string;
  to: string;
  messages: number;
  d: string;
  width: number;
  /** 0..1, square root of the route's share of the busiest route */
  heat: number;
  /** the arc's crown, where its count sits */
  crown: [number, number];
}

/* what the towers say: validator count, message count, or validator
   count painted by client version */
type SizeBy = "versions" | "validators" | "messages";

/** a set's nodes by client version, against the page's target */
export interface VersionMix {
  /** on the target or newer */
  on: number;
  /** one minor line behind */
  near: number;
  /** older than that */
  stale: number;
  unknown: number;
}
type Band = "on" | "near" | "stale" | "unknown";
const BAND_ORDER: Band[] = ["on", "near", "stale", "unknown"];
const mixTotal = (m: VersionMix) => m.on + m.near + m.stale + m.unknown;

const W = 1200;
const H = 660;
const CX = W / 2;
const CY = 372;
/** how far the plate leans back: the projected depth of a unit of ground */
const TILT = 0.42;
const PLATE = 572;
const PLATE_T = 16;
const INNER = 318;
const OUTER = 492;
const H_MIN = 8;
const H_MAX = 150;
/** height grows as the 0.4 power: 600 validators stands about 7x a set of 5, not 120x */
const H_POW = 0.4;
const HUB_ID = "43114";

const TONE = {
  gray: { top: "#DCE1E2", left: BLOCK_GRAY, right: "#7E8C8F", edge: "#5E6B6E" },
  // quiet sets recede a step, so the chains that talk stand out of the ring
  pale: { top: "#EEF1F1", left: "#CBD2D4", right: "#AEB9BB", edge: "#8E9A9D" },
  red: { top: "#F58A91", left: "#E6212F", right: "#A5141F", edge: "#7A0E17" },
  blue: { top: "#8DB9F6", left: PICK_BLUE, right: "#0049AA", edge: "#003380" },
  // the version fleet's palette: green on target, amber a minor behind, red older, gray unreported
  on: { top: "#86EFAC", left: "#16a34a", right: "#11803A", edge: "#0A5226" },
  near: { top: "#FCD34D", left: "#f59e0b", right: "#BF7A07", edge: "#7C4F04" },
  stale: { top: "#FCA5A5", left: "#E6212F", right: "#A5141F", edge: "#7A0E17" },
  unknown: { top: "#E4E4E7", left: "#a1a1aa", right: "#7C7C85", edge: "#55555C" },
};

const catalogByChainId = new Map(
  (l1ChainsData as L1Chain[]).filter((c) => c.isTestnet !== true).map((c) => [String(c.chainId), c]),
);

/* the chain's ICM feed when it has an RPC, else its accounts */
function chainHref(chainId: string): string | null {
  const c = catalogByChainId.get(chainId);
  if (!c?.slug) return null;
  return c.rpcUrl ? `/explorer/mainnet/${c.slug}/txs/icm` : `/explorer/mainnet/${c.slug}/accounts`;
}

/* a ground point on a ring of the plate, starting at the back */
function onRing(i: number, n: number, r: number, turn = 0): [number, number] {
  const a = -Math.PI / 2 + turn + (i / Math.max(1, n)) * Math.PI * 2;
  return [CX + r * Math.cos(a), CY + r * TILT * Math.sin(a)];
}

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
const pts = (p: [number, number][]) => p.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");

/* the reader's motion setting: no rise, packets or draw-in when reduced */
function useStill() {
  const [still, setStill] = useState(false);
  useEffect(() => {
    const q = window.matchMedia("(prefers-reduced-motion: reduce)");
    setStill(q.matches);
    const on = () => setStill(q.matches);
    q.addEventListener("change", on);
    return () => q.removeEventListener("change", on);
  }, []);
  return still;
}

/* one tower: a square footprint turned to the plate, extruded h; its
   faces carry floor courses so height reads as stacked blocks */
function Tower({ x, y, w, h, tone, mix }: { x: number; y: number; w: number; h: number; tone: keyof typeof TONE; mix?: VersionMix | null }) {
  const d = w * TILT;
  const t = y - h;
  const courses = h > 14 ? Math.min(40, Math.floor(h / 8)) : 0;
  const step = h / Math.max(1, courses);
  // painted by version: the faces stack each band's share from the ground up
  const total = mix ? mixTotal(mix) : 0;
  const bands: { band: Band; lo: number; hi: number }[] = [];
  if (mix && total > 0) {
    let at = 0;
    for (const b of BAND_ORDER) {
      if (mix[b] <= 0) continue;
      const hi = at + (mix[b] / total) * h;
      bands.push({ band: b, lo: at, hi });
      at = hi;
    }
  }
  // the roof wears the set's largest band, so a mostly upgraded set reads green from above
  const major = bands.length ? bands.reduce((m, x) => (x.hi - x.lo > m.hi - m.lo ? x : m)).band : null;
  const c = TONE[major ?? tone];
  return (
    <g strokeLinejoin="round">
      {bands.length ? (
        bands.map(({ band, lo, hi }) => {
          const k = TONE[band];
          return (
            <g key={band}>
              <polygon points={pts([[x - w, y - lo], [x, y + d - lo], [x, y + d - hi], [x - w, y - hi]])} fill={k.left} stroke={k.edge} strokeOpacity={0.5} strokeWidth={0.75} />
              <polygon points={pts([[x, y + d - lo], [x + w, y - lo], [x + w, y - hi], [x, y + d - hi]])} fill={k.right} stroke={k.edge} strokeOpacity={0.5} strokeWidth={0.75} />
            </g>
          );
        })
      ) : (
        <>
          <polygon points={pts([[x - w, y], [x, y + d], [x, t + d], [x - w, t]])} fill={c.left} stroke={c.edge} strokeOpacity={0.55} strokeWidth={0.75} />
          <polygon points={pts([[x, y + d], [x + w, y], [x + w, t], [x, t + d]])} fill={c.right} stroke={c.edge} strokeOpacity={0.55} strokeWidth={0.75} />
        </>
      )}
      {courses > 1 && (
        <path
          d={Array.from({ length: courses - 1 }, (_, k) => {
            const o = (k + 1) * step;
            return `M${(x - w).toFixed(1)},${(y - o).toFixed(1)} L${x.toFixed(1)},${(y + d - o).toFixed(1)} L${(x + w).toFixed(1)},${(y - o).toFixed(1)}`;
          }).join(" ")}
          fill="none"
          stroke="#000"
          strokeOpacity={0.09}
          strokeWidth={0.75}
        />
      )}
      <polygon points={pts([[x, t - d], [x + w, t], [x, t + d], [x - w, t]])} fill={c.top} stroke={c.edge} strokeOpacity={0.55} strokeWidth={0.75} />
    </g>
  );
}

/* a chain logo inside the sheet, clipped round, with a letter when it will not load */
function MapLogo({ uri, name, x, y, size, clipId }: { uri: string; name: string; x: number; y: number; size: number; clipId: string }) {
  const [broken, setBroken] = useState(false);
  const r = size / 2;
  return (
    <g className="pointer-events-none">
      <circle cx={x} cy={y} r={r + 1.5} className="fill-white stroke-zinc-300 dark:fill-zinc-950 dark:stroke-zinc-700" strokeWidth={1} />
      {uri && !broken ? (
        <>
          <clipPath id={clipId}>
            <circle cx={x} cy={y} r={r} />
          </clipPath>
          <image href={uri} x={x - r} y={y - r} width={size} height={size} clipPath={`url(#${clipId})`} preserveAspectRatio="xMidYMid slice" onError={() => setBroken(true)} />
        </>
      ) : (
        <text x={x} y={y} textAnchor="middle" dominantBaseline="central" className="fill-zinc-400 font-mono text-[8px] font-bold uppercase">
          {name.charAt(0)}
        </text>
      )}
    </g>
  );
}

function Logo({ uri, name }: { uri: string; name: string }) {
  const [broken, setBroken] = useState(false);
  if (!uri || broken) {
    return (
      <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-zinc-200 font-mono text-[8px] font-bold uppercase text-zinc-400 dark:border-zinc-700">
        {name.charAt(0)}
      </span>
    );
  }
  return <img src={uri} alt="" onError={() => setBroken(true)} className="h-4 w-4 shrink-0 rounded-full object-contain" />;
}

function TipRow({ label, value }: { label: string; value: string }) {
  return (
    <p className="flex items-center justify-between gap-6 font-mono text-[11px] tabular-nums text-zinc-900 dark:text-zinc-100">
      <span className="text-zinc-500">{label}</span>
      <span>{value}</span>
    </p>
  );
}

export interface IcmSummary {
  /** 30-day messages each chain sent plus got, by EVM chain ID */
  byChain: Map<string, number>;
  /** 30-day messages across every mainnet route */
  total: number;
  /** chains that sent or got a message, the C-Chain included */
  talking: number;
}

export function IcmNetworkMap({
  picked = null,
  onPick,
  onSummary,
  days = 30,
  windowLabel = "30 days",
  versions = null,
  target = "",
  targets = [],
  onTarget,
}: {
  /** each chain's nodes by client version, by EVM chain ID; turns on the Versions view */
  versions?: Map<string, VersionMix> | null;
  /** the version the mix is measured against, and the choices for it */
  target?: string;
  targets?: string[];
  onTarget?: (t: string) => void;
  /** the message window, in days; the page's clock sets it */
  days?: number;
  /** the window spelled out for the header, "30 days" */
  windowLabel?: string;
  picked?: string | null;
  onPick?: (chainName: string) => void;
  /** the page's figures read the same feed the map draws */
  onSummary?: (s: IcmSummary) => void;
}) {
  const [chains, setChains] = useState<MapChain[] | null>(null);
  const [flows, setFlows] = useState<FlowRoute[]>([]);
  const [failed, setFailed] = useState(false);
  const [pickedView, setSizeBy] = useState<SizeBy>("versions");
  // without a version feed the Versions view has nothing to paint
  const sizeBy: SizeBy = pickedView === "versions" && !versions ? "validators" : pickedView;
  const painted = sizeBy === "versions";
  const mixOf = (id: string) => (painted ? versions?.get(id) ?? null : null);
  const onPct = (id: string) => {
    const m = versions?.get(id);
    const known = m ? m.on + m.near + m.stale : 0;
    return m && known > 0 ? Math.round((m.on / mixTotal(m)) * 100) : null;
  };
  const [hover, setHover] = useState<string | null>(null);
  const [hoverRoute, setHoverRoute] = useState<string | null>(null);
  const still = useStill();
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");

  useEffect(() => {
    const controller = new AbortController();
    // the chains and their validators; the window only moves the arcs
    fetch("/api/overview-stats?timeRange=month", { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
      .then((d: { chains?: MapChain[] }) => setChains(d.chains ?? []))
      .catch((e: Error) => {
        if (e.name !== "AbortError") setFailed(true);
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    // a failed flow feed is not fatal: the chains still draw, without traffic
    fetch(`/api/icm-flow?days=${days}`, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
      .then((d: { flows?: FlowRoute[] }) => {
        setFlows(Array.isArray(d.flows) ? d.flows : []);
      })
      .catch(() => {});
    return () => controller.abort();
  }, [days]);

  const { nodes, routes, byName } = useMemo(() => {
    const known = new Map((chains ?? []).map((c) => [String(c.chainId), c]));
    // only routes between mainnet chains the overview knows; the feed mixes in Fuji
    const merged = new Map<string, { from: string; to: string; messages: number }>();
    for (const f of flows) {
      const from = String(f.sourceChainId);
      const to = String(f.targetChainId);
      if (from === to || !known.has(from) || !known.has(to) || !(f.messageCount > 0)) continue;
      const k = `${from}>${to}`;
      const m = merged.get(k);
      if (m) m.messages += f.messageCount;
      else merged.set(k, { from, to, messages: f.messageCount });
    }
    const out = new Map<string, number>();
    const inn = new Map<string, number>();
    for (const r of merged.values()) {
      out.set(r.from, (out.get(r.from) ?? 0) + r.messages);
      inn.set(r.to, (inn.get(r.to) ?? 0) + r.messages);
    }

    const base = [...known.values()]
      .map((c) => {
        const id = String(c.chainId);
        return {
          id,
          name: c.chainName,
          // the feed leaves many logos blank; the catalog knows most of them
          logo: c.chainLogoURI || catalogByChainId.get(id)?.chainLogoURI || "",
          validators: typeof c.validatorCount === "number" ? c.validatorCount : 0,
          out: out.get(id) ?? 0,
          in: inn.get(id) ?? 0,
          href: chainHref(id),
        };
      })
      .filter((c) => c.validators > 0 || c.out + c.in > 0);

    const metric = (c: (typeof base)[number]) => (sizeBy === "messages" ? c.out + c.in : c.validators);
    const top = Math.max(1, ...base.map(metric));
    const height = (c: (typeof base)[number]) => H_MIN + (H_MAX - H_MIN) * Math.pow(metric(c) / top, H_POW);

    const hub = base.find((c) => c.id === HUB_ID);
    const talking = base.filter((c) => c.id !== HUB_ID && c.out + c.in > 0).sort((a, b) => b.out + b.in - (a.out + a.in));
    const quiet = base.filter((c) => c.id !== HUB_ID && c.out + c.in === 0).sort((a, b) => b.validators - a.validators || a.name.localeCompare(b.name));

    const placed: Node[] = [];
    if (hub) placed.push({ ...hub, x: CX, y: CY, w: 44, h: height(hub), ring: "hub", order: 0 });
    // a quarter step round keeps any talker off the hub's back (behind its roof) and front (on its name)
    talking.forEach((c, i) => {
      const [x, y] = onRing(i, talking.length, INNER, Math.PI / (2 * Math.max(1, talking.length)));
      placed.push({ ...c, x, y, w: 17, h: height(c), ring: "inner", order: i });
    });
    // the outer ring starts back left, so its tallest set does not stand behind the hub
    quiet.forEach((c, i) => {
      const [x, y] = onRing(i, quiet.length, OUTER, -0.42);
      placed.push({ ...c, x, y, w: 9, h: height(c), ring: "outer", order: i });
    });

    const at = new Map(placed.map((n) => [n.id, n]));
    const maxMsgs = Math.max(1, ...[...merged.values()].map((r) => r.messages));
    const drawn: Route[] = [...merged.values()]
      .sort((a, b) => a.messages - b.messages)
      .map((r) => {
        const a = at.get(r.from)!;
        const b = at.get(r.to)!;
        // a route lands on the roof's edge that faces its partner, so the hub's many routes fan out
        const land = (n: Node, o: Node): [number, number] => {
          const ux = o.x - n.x;
          const uy = (o.y - n.y) / TILT;
          const len = Math.hypot(ux, uy) || 1;
          const k = n.ring === "hub" ? 0.6 : 0;
          return [n.x + (ux / len) * n.w * k, n.y - n.h + (uy / len) * n.w * TILT * k];
        };
        const [ax, ay] = land(a, b);
        const [bx, by] = land(b, a);
        const dist = Math.hypot(bx - ax, by - ay);
        // the arc climbs with its span, and leans to the sender's left so the two ways of a pair part
        const lift = 36 + dist * 0.28;
        const lean = (by - ay) * 0.12;
        const cx = (ax + bx) / 2 + lean;
        const cy = Math.min(ay, by) - lift;
        const heat = Math.sqrt(r.messages / maxMsgs);
        return {
          key: `${r.from}>${r.to}`,
          from: r.from,
          to: r.to,
          messages: r.messages,
          d: `M${ax.toFixed(1)},${ay.toFixed(1)} Q${cx.toFixed(1)},${cy.toFixed(1)} ${bx.toFixed(1)},${by.toFixed(1)}`,
          width: 0.75 + 4.5 * heat,
          heat,
          crown: [(ax + 2 * cx + bx) / 4, (ay + 2 * cy + by) / 4] as [number, number],
        };
      });
    return { nodes: placed, routes: drawn, byName: new Map(placed.map((n) => [n.name, n])) };
  }, [chains, flows, sizeBy]);

  useEffect(() => {
    if (!onSummary || !chains) return;
    const byChain = new Map(nodes.map((n) => [n.id, n.out + n.in]));
    onSummary({ byChain, total: routes.reduce((t, r) => t + r.messages, 0), talking: nodes.filter((n) => n.out + n.in > 0).length });
    // the parent's callback identity does not matter, only the data
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, routes, chains]);

  // hover leads; a pick holds the light when the cursor leaves
  const pickedId = picked ? byName.get(picked)?.id ?? null : null;
  const lit = hover ?? pickedId;
  const near = useMemo(() => {
    if (!lit) return null;
    const s = new Set([lit]);
    for (const r of routes) if (r.from === lit || r.to === lit) s.add(r.from).add(r.to);
    return s;
  }, [lit, routes]);
  const byId = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);
  // painter's order: back of the plate first
  const drawOrder = useMemo(() => [...nodes].sort((a, b) => a.y - b.y), [nodes]);

  const tipNode = hover ? byId.get(hover) : null;
  const tipRoute = !tipNode && hoverRoute ? routes.find((r) => r.key === hoverRoute) : null;
  const topPartner = (id: string) =>
    [
      ...routes
        .filter((r) => r.from === id || r.to === id)
        .reduce((m, r) => {
          const other = r.from === id ? r.to : r.from;
          m.set(other, (m.get(other) ?? 0) + r.messages);
          return m;
        }, new Map<string, number>())
        .entries(),
    ].sort((a, b) => b[1] - a[1])[0];

  const pick = (n: Node) => onPick?.(n.name);
  const pickedNode = pickedId ? byId.get(pickedId) : null;
  const talking = nodes.filter((n) => n.ring !== "outer").sort((a, b) => b.out + b.in - (a.out + a.in));
  const quiet = nodes.filter((n) => n.ring === "outer");
  const maxTalk = Math.max(1, ...talking.map((n) => n.out + n.in));
  const maxQuiet = Math.max(1, ...quiet.map((n) => n.validators));

  const tone = (n: Node): keyof typeof TONE => (pickedId === n.id ? "blue" : n.ring === "hub" ? "red" : n.ring === "outer" ? "pale" : "gray");
  const halo = "pointer-events-none select-none stroke-white [paint-order:stroke] [stroke-width:4px] dark:stroke-zinc-950";

  /* where a talker's flag stands: over the roof at the back of the plate,
     on the plate in front of the tower at the front, where a flag over
     the roof would run into the hub */
  const flagAt = (n: Node) => {
    const d = n.w * TILT;
    const front = n.ring === "hub" || n.y > CY + 12;
    if (front) {
      const base = n.y + d + (n.ring === "hub" ? 22 : 16);
      return { front, nameY: base, figureY: base + (n.ring === "hub" ? 17 : 15) };
    }
    const roof = n.y - n.h - d;
    return { front, nameY: roof - 14, figureY: roof - 30 };
  };

  /* route counts go at the crown, but only where no flag or other count is already */
  const routeTags = useMemo(() => {
    // boxes as [left, top, right, bottom]
    const taken: [number, number, number, number][] = [];
    const FLAG_W = 150;
    for (const n of nodes) {
      if (n.ring === "outer") {
        if (n.validators >= 20) taken.push([n.x - 55, n.y - n.h - 26, n.x + 55, n.y - n.h - 6]);
        continue;
      }
      const { nameY, figureY, front } = flagAt(n);
      const top = Math.min(nameY, figureY) - 9;
      const bottom = Math.max(nameY, figureY) + 9;
      if (front) taken.push([n.x - FLAG_W / 2, top, n.x + FLAG_W / 2, bottom]);
      // a back flag hangs off the outer side of its staff
      else if (n.x >= CX) taken.push([n.x, top, n.x + FLAG_W, bottom]);
      else taken.push([n.x - FLAG_W, top, n.x, bottom]);
      // and nothing sits on a roof, where the routes land
      taken.push([n.x - n.w - 6, n.y - n.h - n.w * TILT - 10, n.x + n.w + 6, n.y - n.h + n.w * TILT + 6]);
    }
    const hit = (b: [number, number, number, number]) => taken.some((t) => b[0] < t[2] && b[2] > t[0] && b[1] < t[3] && b[3] > t[1]);
    const shown: Route[] = [];
    for (const r of [...routes].sort((a, b) => b.messages - a.messages)) {
      if (shown.length >= 10 || r.messages < 10) break;
      const x = r.crown[0];
      const y = r.crown[1] - 10;
      const box: [number, number, number, number] = [x - 22, y - 8, x + 22, y + 6];
      if (hit(box)) continue;
      taken.push(box);
      shown.push(r);
    }
    return shown;
    // flagAt reads only node geometry, which `nodes` carries
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, routes]);

  /* a flag's second line: in the Versions view the share on target, else the messages */
  const figureOf = (n: Node) => {
    const val = `${n.validators.toLocaleString("en-US")} val`;
    if (!painted) return `${val} · ${fmtCompact(n.out + n.in)} msgs`;
    const pct = onPct(n.id);
    return pct === null ? `${val} · not reported` : `${val} · ${pct}% on ${target}`;
  };

  /* a tower's flag: logo, name, and its figures */
  const flag = (n: Node) => {
    const d = n.w * TILT;
    const roof = n.y - n.h - d;
    const on = pickedId === n.id;
    const ink = on ? "fill-[#0061E2] dark:fill-[#5f9dff]" : "fill-zinc-800 dark:fill-zinc-100";
    if (n.ring === "outer") {
      // quiet sets are named in the roster; the plate flags only the big ones
      if (n.validators < 20) return null;
      return (
        <text x={n.x} y={roof - 8} textAnchor="middle" className={cn(halo, "font-mono text-[10px] uppercase tracking-[0.06em]", on ? ink : "fill-zinc-500 dark:fill-zinc-400")}>
          {clip(n.name, 14)}
          <tspan className="fill-zinc-400 dark:fill-zinc-500"> {n.validators}</tspan>
        </text>
      );
    }
    const hub = n.ring === "hub";
    if (hub) {
      // the hub's routes crowd its roof, so its name stands on the plate in front of it
      const logo = 16;
      const name = "C-Chain";
      const nameW = name.length * 13 * 0.68;
      const startX = n.x - (nameW + logo + 6) / 2;
      const base = flagAt(n).nameY;
      return (
        <>
          <MapLogo uri={n.logo} name={n.name} x={startX + logo / 2} y={base} size={logo} clipId={`${uid}-l${n.id}`} />
          <text x={startX + logo + 6} y={base} dominantBaseline="central" className={cn(halo, ink, "font-mono text-[13px] font-medium uppercase tracking-[0.08em]")}>
            {name}
          </text>
          <text x={n.x} y={base + 17} textAnchor="middle" dominantBaseline="central" className={cn(halo, "fill-zinc-500 font-mono text-[10px] tabular-nums dark:fill-zinc-400")}>
            {figureOf(n)}
          </text>
        </>
      );
    }
    const name = clip(n.name, 16);
    // mono glyphs are a fixed width, so the flag can centre logo and name together
    const nameW = name.length * 11 * 0.68;
    const logo = 14;
    const { nameY, figureY, front } = flagAt(n);
    const figure = figureOf(n);
    const figureCls = cn(halo, "fill-zinc-500 font-mono text-[10px] tabular-nums dark:fill-zinc-400");
    const nameCls = cn(halo, ink, "font-mono text-[11px] font-medium uppercase tracking-[0.08em]");
    if (front) {
      const startX = n.x - (nameW + logo + 5) / 2;
      return (
        <>
          <MapLogo uri={n.logo} name={n.name} x={startX + logo / 2} y={nameY} size={logo} clipId={`${uid}-l${n.id}`} />
          <text x={startX + logo + 5} y={nameY} dominantBaseline="central" className={nameCls}>
            {name}
          </text>
          <text x={n.x} y={figureY} textAnchor="middle" dominantBaseline="central" className={figureCls}>
            {figure}
          </text>
        </>
      );
    }
    // at the back the routes leave the roof toward the hub, so the flag leans
    // the other way: a staff up from the roof, the name hung off its outer side
    const side = n.x >= CX ? 1 : -1;
    const staffX = n.x + side * n.w * 0.5;
    const logoX = staffX + side * (6 + logo / 2);
    const textX = staffX + side * (logo + 11);
    const anchor = side > 0 ? "start" : "end";
    return (
      <>
        <line x1={staffX} x2={staffX} y1={roof + n.w * TILT * 0.5} y2={figureY - 6} className="stroke-zinc-400 dark:stroke-zinc-600" strokeWidth={1} />
        <MapLogo uri={n.logo} name={n.name} x={logoX} y={nameY} size={logo} clipId={`${uid}-l${n.id}`} />
        <text x={textX} y={nameY} dominantBaseline="central" textAnchor={anchor} className={nameCls}>
          {name}
        </text>
        <text x={staffX + side * 6} y={figureY} dominantBaseline="central" textAnchor={anchor} className={figureCls}>
          {figure}
        </text>
      </>
    );
  };

  const swatch = (paint: string, label: string) => (
    <span key={label} className="flex items-center gap-1.5">
      <span className="h-2.5 w-1.5 border border-zinc-700/40 dark:border-zinc-300/40" style={{ background: paint }} />
      {label}
    </span>
  );
  const prevMinor = (() => {
    const m = /^(\d+)\.(\d+)/.exec(target);
    return m ? `${m[1]}.${Number(m[2]) - 1}` : "behind";
  })();
  const legend = (
    <span className="hidden shrink-0 items-center gap-4 font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-400 lg:flex dark:text-zinc-500">
      {painted ? (
        <>
          {swatch(TONE.on.left, `${target}+`)}
          {swatch(TONE.near.left, prevMinor)}
          {swatch(TONE.stale.left, "older")}
          {swatch(TONE.unknown.left, "unknown")}
        </>
      ) : (
        swatch(BLOCK_GRAY, `height · ${sizeBy}`)
      )}
      <span className="flex items-center gap-1.5">
        <span className="w-4 border-t-2 border-zinc-900/60 dark:border-zinc-100/60" />
        arc · messages
      </span>
    </span>
  );

  /* the quiet sets as a skyline on a ledge under the plate: the same
     towers, tallest first, each with its count on the roof and its name
     slanted under the ledge, so a screenshot names every set */
  const SKY_W = 1200;
  const SKY_H = 214;
  const LEDGE_Y = 104;
  const skyStep = quiet.length ? Math.min(34, (SKY_W - 80) / quiet.length) : 0;
  const skyX0 = (SKY_W - skyStep * (quiet.length - 1)) / 2;
  const skyW = Math.max(3, Math.min(8, skyStep * 0.3));
  const skyline = quiet.length > 0 && (
    <div className="border-t border-zinc-200 px-5 pb-2 pt-4 md:px-6 dark:border-zinc-800">
      <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">
        Outer ring · {quiet.length} validator sets without ICM traffic
      </p>
      {/* desktops: the skyline */}
      <svg viewBox={`0 0 ${SKY_W} ${SKY_H}`} className="hidden h-auto w-full lg:block" role="img" aria-label="Validator sets without ICM traffic, by validator count">
        {/* the ledge: a long slab in the plate's projection */}
        <polygon
          points={pts([
            [20, LEDGE_Y],
            [SKY_W - 20, LEDGE_Y],
            [SKY_W - 34, LEDGE_Y + 10],
            [34, LEDGE_Y + 10],
          ])}
          className="fill-zinc-50 stroke-zinc-300 dark:fill-zinc-900 dark:stroke-zinc-700"
          strokeWidth={1}
        />
        <rect x={34} y={LEDGE_Y + 10} width={SKY_W - 68} height={6} className="fill-zinc-200 stroke-zinc-300 dark:fill-zinc-800 dark:stroke-zinc-700" strokeWidth={1} />
        {quiet.map((n, i) => {
          const x = skyX0 + i * skyStep;
          const ground = LEDGE_Y + 6;
          const h = 4 + 78 * Math.pow(n.validators / maxQuiet, 0.5);
          const on = pickedId === n.id;
          const dim = near !== null && !near.has(n.id);
          const ly = LEDGE_Y + 26;
          return (
            <g
              key={n.id}
              role="button"
              tabIndex={0}
              aria-label={`${n.name}: ${n.validators} validators, no ICM in ${windowLabel}`}
              aria-pressed={on}
              onMouseEnter={() => setHover(n.id)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(n.id)}
              onBlur={() => setHover(null)}
              onClick={() => pick(n)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  pick(n);
                }
              }}
              className="cursor-pointer outline-none transition-[opacity,transform] duration-200 ease-out"
              style={{ opacity: dim ? 0.3 : 1, transform: hover === n.id ? "translateY(-3px)" : undefined }}
            >
              <rect x={x - skyStep / 2} y={0} width={skyStep} height={SKY_H} fill="transparent" />
              <g style={still ? undefined : { transformOrigin: `${x}px ${ground}px`, animation: `${uid}rise 800ms cubic-bezier(0.32,0.72,0,1) ${400 + i * 14}ms both` }}>
                <Tower x={x} y={ground} w={skyW} h={h} tone={on ? "blue" : "pale"} mix={on ? null : mixOf(n.id)} />
              </g>
              <text
                x={x}
                y={ground - h - skyW * TILT - 6}
                textAnchor="middle"
                className={cn("pointer-events-none font-mono text-[9px] tabular-nums", on ? "fill-[#0061E2] dark:fill-[#5f9dff]" : "fill-zinc-400 dark:fill-zinc-500")}
              >
                {n.validators}
              </text>
              <text
                x={x}
                y={ly}
                textAnchor="end"
                transform={`rotate(-40 ${x.toFixed(1)} ${ly})`}
                className={cn(
                  "pointer-events-none select-none font-mono text-[10px] uppercase tracking-[0.04em] transition-colors",
                  on ? "fill-[#0061E2] dark:fill-[#5f9dff]" : hover === n.id ? "fill-zinc-900 dark:fill-zinc-50" : "fill-zinc-600 dark:fill-zinc-400",
                )}
              >
                {clip(n.name, 16)}
              </text>
            </g>
          );
        })}
      </svg>
      {/* phones and tablets: the same sets, as a list */}
      <ul className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 pb-2 sm:grid-cols-3 lg:hidden">
        {quiet.map((n) => (
          <li key={n.id}>
            <button
              type="button"
              onClick={() => pick(n)}
              aria-pressed={pickedId === n.id}
              className={cn(
                "flex w-full items-center justify-between gap-2 py-0.5 text-left font-mono text-[11px]",
                pickedId === n.id ? "text-[#0061E2] dark:text-[#5f9dff]" : "text-zinc-600 dark:text-zinc-400",
              )}
            >
              <span className="truncate uppercase tracking-[0.04em]">{n.name}</span>
              <span className="tabular-nums text-zinc-400 dark:text-zinc-500">{n.validators}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );

  let body: React.ReactNode;
  if (failed) body = <EmptyRow>Chain feed unavailable</EmptyRow>;
  else if (!chains) body = <div className="h-72 animate-pulse bg-zinc-100 lg:h-[660px] dark:bg-zinc-900" />;
  else if (nodes.length === 0) body = <EmptyRow>No chains to draw</EmptyRow>;
  else
    body = (
      <>
        {/* the model, from lg up */}
        <div
          className="relative hidden lg:block"
          onMouseLeave={() => {
            setHover(null);
            setHoverRoute(null);
          }}
        >
          <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label={`Avalanche L1s as towers by validator count, with ${windowLabel} of ICM routes between them`}>
            {!still && (
              <style>{`@keyframes ${uid}rise{from{transform:scaleY(0.02)}to{transform:scaleY(1)}}`}</style>
            )}
            <defs>
              <clipPath id={`${uid}-plate`}>
                <ellipse cx={CX} cy={CY} rx={PLATE} ry={PLATE * TILT} />
              </clipPath>
            </defs>

            {/* the plate: a slab with a lit top, a lattice and the two rings cut into it */}
            <g>
              <ellipse cx={CX} cy={CY + PLATE_T} rx={PLATE} ry={PLATE * TILT} className="fill-zinc-200 stroke-zinc-300 dark:fill-zinc-800 dark:stroke-zinc-700" strokeWidth={1} />
              <rect x={CX - PLATE} y={CY} width={PLATE * 2} height={PLATE_T} className="fill-zinc-200 dark:fill-zinc-800" />
              <line x1={CX - PLATE} x2={CX - PLATE} y1={CY} y2={CY + PLATE_T} className="stroke-zinc-300 dark:stroke-zinc-700" strokeWidth={1} />
              <line x1={CX + PLATE} x2={CX + PLATE} y1={CY} y2={CY + PLATE_T} className="stroke-zinc-300 dark:stroke-zinc-700" strokeWidth={1} />
              <ellipse cx={CX} cy={CY} rx={PLATE} ry={PLATE * TILT} className="fill-zinc-50 stroke-zinc-300 dark:fill-zinc-900 dark:stroke-zinc-700" strokeWidth={1} />
              <g clipPath={`url(#${uid}-plate)`} className="stroke-zinc-200 dark:stroke-zinc-800" strokeWidth={0.75}>
                {Array.from({ length: 36 }, (_, k) => {
                  const x0 = CX - PLATE * 1.8 + k * 64;
                  const run = PLATE * 1.2;
                  return (
                    <g key={k}>
                      <line x1={x0} y1={CY - run * TILT} x2={x0 + run * 2} y2={CY + run * TILT} />
                      <line x1={x0} y1={CY + run * TILT} x2={x0 + run * 2} y2={CY - run * TILT} />
                    </g>
                  );
                })}
              </g>
              <g fill="none" strokeWidth={1} strokeDasharray="3 5" className="stroke-zinc-300 dark:stroke-zinc-700">
                <ellipse cx={CX} cy={CY} rx={INNER} ry={INNER * TILT} />
                <ellipse cx={CX} cy={CY} rx={OUTER} ry={OUTER * TILT} />
              </g>
            </g>

            {/* the routes' clear, wide strokes catch the cursor and carry the packets;
                they sit under the towers, so a tower always wins its own ground */}
            <g fill="none">
              {routes.map((r, i) => (
                <path key={r.key} id={`${uid}-r${i}`} d={r.d} stroke="transparent" strokeWidth={Math.max(10, r.width + 6)} onMouseEnter={() => setHoverRoute(r.key)} onMouseLeave={() => setHoverRoute(null)} />
              ))}
            </g>

            {/* towers, back to front */}
            {drawOrder.map((n) => {
              const dim = near !== null && !near.has(n.id);
              const up = hover === n.id;
              const delay = n.ring === "hub" ? 0 : n.ring === "inner" ? 120 + n.order * 45 : 300 + n.order * 12;
              return (
                <g
                  key={n.id}
                  role="button"
                  tabIndex={0}
                  aria-label={`${n.name}: ${n.validators} validators, ${n.out} messages out, ${n.in} in`}
                  aria-pressed={pickedId === n.id}
                  onMouseEnter={() => setHover(n.id)}
                  onMouseLeave={() => setHover(null)}
                  onFocus={() => setHover(n.id)}
                  onBlur={() => setHover(null)}
                  onClick={() => pick(n)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      pick(n);
                    }
                  }}
                  className="cursor-pointer outline-none transition-[opacity,transform] duration-200 ease-out"
                  style={{ opacity: dim ? 0.25 : 1, transform: up ? "translateY(-4px)" : undefined }}
                >
                  {/* a footprint shadow grounds the tower on the plate */}
                  <ellipse cx={n.x + n.w * 0.35} cy={n.y + n.w * TILT * 0.4} rx={n.w * 1.25} ry={n.w * TILT * 1.1} className="fill-zinc-900/[0.07] dark:fill-black/40" />
                  <g
                    style={
                      still
                        ? undefined
                        : { transformOrigin: `${n.x}px ${n.y}px`, animation: `${uid}rise 900ms cubic-bezier(0.32,0.72,0,1) ${delay}ms both` }
                    }
                  >
                    {/* a clear pad so short towers are easy to catch */}
                    <rect x={n.x - Math.max(12, n.w)} y={n.y - n.h - n.w * TILT - 6} width={Math.max(24, n.w * 2)} height={n.h + n.w * TILT * 2 + 12} fill="transparent" />
                    <Tower x={n.x} y={n.y} w={n.w} h={n.h} tone={tone(n)} mix={pickedId === n.id ? null : mixOf(n.id)} />
                  </g>
                </g>
              );
            })}

            {/* routes in the air, from roof to roof */}
            <g fill="none" strokeLinecap="round" className="pointer-events-none">
              {routes.map((r, i) => {
                const on = !lit || r.from === lit || r.to === lit;
                const hot = hoverRoute === r.key || (lit !== null && on);
                const blue = !!pickedId && (r.from === pickedId || r.to === pickedId);
                return (
                  <g key={r.key}>
                    <path
                      d={r.d}
                      strokeWidth={r.width}
                      pathLength={1}
                      strokeDasharray={still ? undefined : 1}
                      strokeDashoffset={still ? undefined : 1}
                      className={cn("transition-[stroke-opacity] duration-200", blue ? "stroke-[#0061E2] dark:stroke-[#5f9dff]" : "stroke-zinc-900 dark:stroke-zinc-100")}
                      strokeOpacity={hot ? 0.75 : on ? 0.3 : 0.05}
                    >
                      {/* the routes draw out of their senders once the towers stand */}
                      {!still && <animate attributeName="stroke-dashoffset" from="1" to="0" dur="1s" begin={`${0.9 + i * 0.04}s`} fill="freeze" calcMode="spline" keyTimes="0;1" keySplines="0.32 0.72 0 1" />}
                    </path>
                  </g>
                );
              })}
            </g>

            {/* packets: sender to receiver, more and faster on busier routes */}
            {!still && (
              <g className="pointer-events-none">
                {routes.map((r, i) => {
                  const on = !lit || r.from === lit || r.to === lit;
                  const blue = !!pickedId && (r.from === pickedId || r.to === pickedId);
                  const count = 1 + Math.round(r.heat * 5);
                  const dur = 6.5 - 3 * r.heat;
                  const size = 3.5 + 2 * r.heat;
                  return (
                    <g key={r.key} className="transition-opacity duration-200" style={{ opacity: on ? 1 : 0 }}>
                      {Array.from({ length: count }, (_, k) => {
                        const begin = `${(1.9 - (k / count) * dur).toFixed(2)}s`;
                        return (
                          <rect
                            key={k}
                            x={-size / 2}
                            y={-size / 2}
                            width={size}
                            height={size}
                            opacity={0}
                            className={cn("stroke-white dark:stroke-zinc-950", blue ? "fill-[#0061E2] dark:fill-[#5f9dff]" : "fill-zinc-900 dark:fill-zinc-100")}
                            strokeWidth={1}
                          >
                            <animateMotion dur={`${dur}s`} begin={begin} repeatCount="indefinite" rotate="auto">
                              <mpath href={`#${uid}-r${i}`} />
                            </animateMotion>
                            {/* fades in off the sender and out into the receiver */}
                            <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.1;0.9;1" dur={`${dur}s`} begin={begin} repeatCount="indefinite" />
                          </rect>
                        );
                      })}
                    </g>
                  );
                })}
              </g>
            )}

            {/* the busiest routes carry their count at the crown */}
            <g className="pointer-events-none">
              {routeTags.map((r) => {
                  const on = !lit || r.from === lit || r.to === lit;
                  return (
                    <text
                      key={r.key}
                      x={r.crown[0]}
                      y={r.crown[1] - 7}
                      textAnchor="middle"
                      className={cn(halo, "fill-zinc-500 font-mono text-[10px] tabular-nums transition-opacity duration-200 dark:fill-zinc-400")}
                      style={{ opacity: on ? 1 : 0.1 }}
                    >
                      {fmtCompact(r.messages)}
                    </text>
                  );
                })}
            </g>

            {/* flags last, so no roof or arc covers a name */}
            {drawOrder.map((n) => (
              <g key={n.id} className="transition-opacity duration-200" style={{ opacity: near !== null && !near.has(n.id) ? 0.2 : 1 }}>
                {flag(n)}
              </g>
            ))}
          </svg>

          {tipNode && (
            <span
              className="pointer-events-none absolute z-20"
              style={{
                top: `${((tipNode.y - tipNode.h / 2) / H) * 100}%`,
                ...(tipNode.x > CX ? { right: `calc(${100 - (tipNode.x / W) * 100}% + ${tipNode.w + 16}px)` } : { left: `calc(${(tipNode.x / W) * 100}% + ${tipNode.w + 16}px)` }),
                transform: "translateY(-50%)",
              }}
            >
              <TipPlate>
                <p className="mb-1 flex items-center gap-1.5 text-[12px] font-medium text-zinc-900 dark:text-zinc-100">
                  <Logo uri={tipNode.logo} name={tipNode.name} />
                  {tipNode.name}
                </p>
                <TipRow label="Validators" value={tipNode.validators.toLocaleString("en-US")} />
                {(() => {
                  const m = versions?.get(tipNode.id);
                  if (!m || !target) return null;
                  const pct = onPct(tipNode.id);
                  return (
                    <>
                      <TipRow label={`On ${target}+`} value={pct === null ? "—" : `${m.on} · ${pct}%`} />
                      {m.near + m.stale > 0 && <TipRow label="Behind" value={String(m.near + m.stale)} />}
                    </>
                  );
                })()}
                <TipRow label="Messages out" value={fmtCompact(tipNode.out)} />
                <TipRow label="Messages in" value={fmtCompact(tipNode.in)} />
                {(() => {
                  const p = topPartner(tipNode.id);
                  return p ? <TipRow label="Most with" value={byId.get(p[0])?.name ?? p[0]} /> : null;
                })()}
                {onPick && <p className="mt-1 font-mono text-[10px] text-zinc-400">{pickedId === tipNode.id ? "Click to clear the cut" : "Click to cut the tables"}</p>}
              </TipPlate>
            </span>
          )}
          {tipRoute && (
            <span
              className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-[calc(100%+10px)]"
              style={{ left: `${(tipRoute.crown[0] / W) * 100}%`, top: `${(tipRoute.crown[1] / H) * 100}%` }}
            >
              <TipPlate>
                <p className="font-mono text-[10px] text-zinc-500">
                  {byId.get(tipRoute.from)?.name} → {byId.get(tipRoute.to)?.name}
                </p>
                <p className="font-mono text-[11px] tabular-nums text-zinc-900 dark:text-zinc-100">{fmtCompact(tipRoute.messages)} msgs</p>
              </TipPlate>
            </span>
          )}
        </div>

        {/* phones and tablets: the same traffic, ranked */}
        <ul className="lg:hidden">
          {talking.map((n, i) => {
            const on = pickedId === n.id;
            const total = n.out + n.in;
            return (
              <li key={n.id} className={cn("border-b border-zinc-100 last:border-b-0 dark:border-zinc-900", on && "bg-[#0061E2]/[0.06] dark:bg-[#5b9bff]/10")}>
                <button type="button" onClick={() => pick(n)} aria-pressed={on} className="grid w-full grid-cols-[1rem_minmax(0,1fr)_auto] items-center gap-x-3 px-5 py-2.5 text-left">
                  <span className="font-mono text-[10px] tabular-nums text-zinc-400 dark:text-zinc-500">{i + 1}</span>
                  <span className="flex min-w-0 flex-col gap-1.5">
                    <span className="flex min-w-0 items-center gap-2 text-[13px] font-medium text-zinc-900 dark:text-zinc-100">
                      <Logo uri={n.logo} name={n.name} />
                      <span className="truncate">{n.name}</span>
                      <span className="shrink-0 font-mono text-[10px] font-normal text-zinc-400 dark:text-zinc-500">{n.validators} val</span>
                    </span>
                    <span className="block h-1.5 max-w-full" style={{ width: `${Math.max(2, (total / maxTalk) * 100)}%`, background: on ? PICK_BLUE : BLOCK_GRAY }} />
                  </span>
                  <span className="text-right font-mono text-[11px] tabular-nums leading-tight text-zinc-900 dark:text-zinc-50">
                    {fmtCompact(n.out)} <span className="text-zinc-400 dark:text-zinc-500">out</span>
                    <br />
                    {fmtCompact(n.in)} <span className="text-zinc-400 dark:text-zinc-500">in</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        {skyline}

        {/* the pick, with its door */}
        {pickedNode && (
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-zinc-200 px-5 py-2.5 font-mono text-[11px] md:px-6 dark:border-zinc-800">
            <span className="min-w-0 truncate text-zinc-500 dark:text-zinc-400">
              <span className="text-[#0061E2] dark:text-[#5f9dff]">{pickedNode.name}</span> · {pickedNode.validators} val · {fmtCompact(pickedNode.out)} out ·{" "}
              {fmtCompact(pickedNode.in)} in<span className="hidden sm:inline"> · cuts the tables below</span>
            </span>
            {pickedNode.href && (
              <Link
                href={pickedNode.href}
                className="inline-flex shrink-0 items-center gap-1 text-[10px] uppercase tracking-[0.14em] text-[#0061E2] transition-colors hover:text-zinc-900 dark:text-[#5f9dff] dark:hover:text-zinc-100"
              >
                Open explorer
                <ArrowRight className="h-3 w-3" />
              </Link>
            )}
          </div>
        )}
      </>
    );

  return (
    <section className="flex flex-col gap-4">
      <SectionHeader
        label={`Network Map · ${windowLabel}`}
        action={
          <span className="flex shrink-0 items-center gap-4">
            {legend}
            {painted && onTarget && targets.length > 1 && (
              <span className="hidden lg:block">
                <ViewSwitch id="icm-map-target" value={target} onChange={onTarget} options={targets.slice(0, 3).map((t) => ({ v: t, label: t }))} />
              </span>
            )}
            <span className="hidden lg:block">
              <ViewSwitch
                id="icm-map-size"
                value={sizeBy}
                onChange={setSizeBy}
                options={[
                  ...(versions ? [{ v: "versions" as const, label: "Versions" }] : []),
                  { v: "validators" as const, label: "Validators" },
                  { v: "messages" as const, label: "Messages" },
                ]}
              />
            </span>
          </span>
        }
      />
      <Board divide={false} className="border">
        {body}
      </Board>
    </section>
  );
}
