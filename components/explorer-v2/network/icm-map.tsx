"use client";

import { memo, useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Board, EmptyRow, SectionHeader } from "@/components/explorer-v2/ui";
import { ageShort, truncate } from "@/components/explorer-v2/format";
import { txTypeLabel } from "@/lib/pchain-explorer";
import { LEDGER, usePchainPulse, type PchainPulse, type PulseTx } from "@/components/explorer-v2/network/pchain-pulse";
import { EASE_CSS, useStill } from "@/components/explorer-v2/motion";
import { NEW_DAYS, useNewcomers, type Newcomer } from "@/components/explorer-v2/network/newcomers";
import { TipPlate } from "@/components/explorer-v2/staking/bits";
import { fmtCompact } from "@/components/explorer-v2/evm/metric-charts";
import { BLOCK_GRAY, PICK_BLUE, ViewSwitch } from "@/components/explorer-v2/network/icm-parts";
import { planCity, streetRoute, turn, type Stop, type Street } from "@/components/explorer-v2/network/city";
import { districtAbout, districtOf, type District } from "@/components/explorer-v2/network/districts";
import l1ChainsData from "@/constants/l1-chains.json";
import type { L1Chain } from "@/types/stats";

/* The network as a garden city on a plate, in a true isometric view,
   built like an architect's model: white massing, lit from the left.
   Every validator set is a building, as tall as its validator count (or
   its messages), its windows in ribbons a storey at a time; in the
   Versions view each storey's glass is lit by client version, share by
   share, so the fleet's upgrade reads floor by floor. Downtown is the
   C-Chain's tower on its plaza, crowned in the brand's red and flying
   its name from the spire. Every other set stands in the district of
   what it is for (city.ts, districts.ts), a slice of the city round
   downtown cut from the next by a boulevard: the tallest sets at the
   back of their district, the lowest in front, so every roof and its
   logo shows. The window's ICM messages are the city's traffic: each
   route drives the streets from its sender's lot to its receiver's, its
   road lit as busy as it is, its packets running on the ground, so a
   building hides what passes behind it. Hover a building to light it
   and the sets it talks with; click it and the page's tables are cut to
   it. Click a district's name to fly the camera in: its sets are named
   and listed, and the rest of the city stands as plain massing. An index
   under the plate names every set, district by district. Phones get the
   traffic as lists.
   The plate is the P-Chain, the chain every validator set registers on.
   It wears the P-Chain's violet, and its ledger rings the rim: the last
   96 txs as tiles, newest at the front, shaded by family. Each tx that
   lands turns the ring one place, and a comet runs on the ground to the
   set it touched: stake into the Primary Network's set, a reward out of
   it. A click on the ground opens the P-Chain explorer, a click on a tile
   opens its tx. The week's new L1s stand in the P-Chain's violet, flagged
   NEW, even before the catalog knows them; one that joins while the page
   is open rises on the Frontier. It fetches its own data, so the page
   only mounts it. */

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
  /** the chain's brand color, from the catalog */
  color: string | null;
  /** ground point on the plate */
  x: number;
  y: number;
  /** half the footprint's width */
  w: number;
  /** tower height */
  h: number;
  /** downtown, a set that sent or got messages, or a quiet one */
  role: "hub" | "talker" | "quiet";
  /** the district it stands in; downtown has none */
  district: District | null;
  /** its place in its district, 0 nearest downtown */
  order: number;
  /** how far out it stands, 0 downtown to 1 at the city's edge */
  reach: number;
  /** joined the P-Chain within NEW_DAYS, unix seconds */
  newAt: number | null;
  /** stood up from the P-Chain's registry, not the catalog: its door is its P-Chain page */
  guest: boolean;
  /** its place among the new L1s, 0 the newest */
  newRank: number;
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
  /** the point halfway along the route, where its tooltip hangs */
  crown: [number, number];
  /** the route's length on screen, which sets how long a packet takes to drive it */
  length: number;
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
const H = 640;
const CX = W / 2;
const CY = 352;
/** how far the plate leans back: the projected depth of a unit of ground, as in a true isometric view */
const TILT = 0.5;
const PLATE = 540;
const PLATE_T = 12;
/** the plan radius the city builds out to, inside the ledger on the rim */
const CITY_REACH = PLATE - 96;
const HUB_W = 19;
const H_MIN = 14;
const H_MAX = 165;
/** height grows as the 0.4 power: 600 validators stands about 7x a set of 5, not 120x */
const H_POW = 0.4;
const HUB_ID = "43114";

export const TONE = {
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
  // a new L1 wears the P-Chain's violet for its first week
  fresh: { top: "#D9D0FF", left: "#8C73FF", right: "#5400FF", edge: "#3600A6" },
};

const catalogByChainId = new Map(
  (l1ChainsData as L1Chain[]).filter((c) => c.isTestnet !== true).map((c) => [String(c.chainId), c]),
);

const catalogBySubnet = new Map(
  (l1ChainsData as L1Chain[]).filter((c) => c.isTestnet !== true && c.subnetId).map((c) => [String(c.subnetId), c]),
);

/* the chain's ICM feed when it has an RPC, else its accounts */
function chainHref(chainId: string): string | null {
  const c = catalogByChainId.get(chainId);
  if (!c?.slug) return null;
  return c.rpcUrl ? `/explorer/mainnet/${c.slug}/txs/icm` : `/explorer/mainnet/${c.slug}/accounts`;
}

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
const pts = (p: [number, number][]) => p.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");

/* the P-Chain's own violet, from its mark */
const P_INK = "text-[#5400FF] dark:text-[#8B6CFF]";

/* the ledger's tiles by tx family, all in the P-Chain's violet, so the
   towers' version colors keep their one meaning */
type Fam = "stake" | "reward" | "move" | "l1" | "other";
const FAM_ORDER: Fam[] = ["stake", "reward", "move", "l1", "other"];
const FAM: Record<Fam, { label: string; top: string; lip: string; bg: string }> = {
  stake: { label: "Staking", top: "fill-[#8C73FF] dark:fill-[#8B6CFF]", lip: "fill-[#5400FF] dark:fill-[#5B3FD6]", bg: "bg-[#8C73FF] dark:bg-[#8B6CFF]" },
  reward: { label: "Rewards", top: "fill-[#C6B9FF] dark:fill-[#5C48BD]", lip: "fill-[#9A86F7] dark:fill-[#3E3088]", bg: "bg-[#C6B9FF] dark:bg-[#5C48BD]" },
  move: { label: "Cross-chain", top: "fill-[#E7E1FF] dark:fill-[#3A2F73]", lip: "fill-[#C3B7F5] dark:fill-[#272051]", bg: "bg-[#E7E1FF] dark:bg-[#3A2F73]" },
  l1: { label: "L1", top: "fill-[#22106E] dark:fill-[#F2EEFF]", lip: "fill-[#12063F] dark:fill-[#C2B7F2]", bg: "bg-[#22106E] dark:bg-[#F2EEFF]" },
  other: { label: "Other", top: "fill-[#F0ECFB] dark:fill-[#2A2446]", lip: "fill-[#D5CDEB] dark:fill-[#1C1832]", bg: "bg-[#F0ECFB] dark:bg-[#2A2446]" },
};

/* an L1 op names an L1, a chain or their validators; the other staking txs are the Primary Network's */
function famOf(type: string): Fam {
  const t = type.toLowerCase();
  if (t.includes("l1") || t.includes("subnet") || t.includes("chain") || t.includes("convert")) return "l1";
  if (t.includes("reward")) return "reward";
  if (t.includes("import") || t.includes("export")) return "move";
  if (t.includes("validator") || t.includes("delegator")) return "stake";
  return "other";
}

/* which way a tx's AVAX runs between the ledger and the Primary Network's
   set: stake locks into it, a reward pays out of it, an export leaves the
   P-Chain for the set's C- or X-Chain, an import arrives from one */
function flowOf(type: string): "in" | "out" | null {
  const f = famOf(type);
  if (f === "stake" || type === "ExportTx") return "in";
  if (f === "reward" || type === "ImportTx") return "out";
  return null;
}

/* the ring holds LEDGER tiles in RING_SLOTS places: the one open place at the seam is where the next tx lands */
const RING_SLOTS = LEDGER + 1;
const SLOT = 360 / RING_SLOTS;
const RING_IN = PLATE - 32;
const RING_OUT = PLATE - 12;
/** how far a tile's face stands above the plate */
const RING_LIFT = 3;
const TURN_MS = 900;

/* a flat annular sector in plan: angles in degrees, clockwise on screen */
function sector(a0: number, a1: number, r0: number, r1: number): string {
  const at = (r: number, a: number) => {
    const t = (a * Math.PI) / 180;
    return `${(r * Math.cos(t)).toFixed(2)},${(r * Math.sin(t)).toFixed(2)}`;
  };
  return `M${at(r1, a0)} A${r1},${r1} 0 0 1 ${at(r1, a1)} L${at(r0, a1)} A${r0},${r0} 0 0 0 ${at(r0, a0)} Z`;
}

/* a street route on screen: its path, its length, and the point halfway along it */
function onScreen(s: Street): { d: string; length: number; mid: [number, number] } {
  const at = ([r, a]: [number, number]): [number, number] => [CX + r * Math.cos(a), CY + r * Math.sin(a) * TILT];
  const f = (n: number) => n.toFixed(1);
  let d = "";
  const trail: [number, number][] = [];
  s.pts.forEach((p, i) => {
    const [x, y] = at(p);
    if (!i) {
      d = `M${f(x)},${f(y)}`;
      trail.push([x, y]);
      return;
    }
    const prev = s.pts[i - 1];
    if (s.arcs[i - 1]) {
      const dt = turn(p[1] - prev[1]);
      d += ` A${f(p[0])},${f(p[0] * TILT)} 0 0 ${dt > 0 ? 1 : 0} ${f(x)},${f(y)}`;
      for (let k = 1; k <= 12; k++) trail.push(at([p[0], prev[1] + (dt * k) / 12]));
    } else {
      d += ` L${f(x)},${f(y)}`;
      trail.push([x, y]);
    }
  });
  const legs = trail.slice(1).map((p, i) => Math.hypot(p[0] - trail[i][0], p[1] - trail[i][1]));
  const length = legs.reduce((a, b) => a + b, 0);
  let left = length / 2;
  let mid: [number, number] = trail[0] ?? [CX, CY];
  for (let i = 0; i < legs.length; i++) {
    if (left <= legs[i]) {
      const t = legs[i] ? left / legs[i] : 0;
      mid = [trail[i][0] + (trail[i + 1][0] - trail[i][0]) * t, trail[i][1] + (trail[i + 1][1] - trail[i][1]) * t];
      break;
    }
    left -= legs[i];
  }
  return { d, length, mid };
}

/* an annular sector in plan, angles in radians clockwise on screen */
function arcPath(a0: number, a1: number, r0: number, r1: number): string {
  const at = (r: number, a: number) => `${(r * Math.cos(a)).toFixed(2)},${(r * Math.sin(a)).toFixed(2)}`;
  const large = a1 - a0 > Math.PI ? 1 : 0;
  return `M${at(r1, a0)} A${r1},${r1} 0 ${large} 1 ${at(r1, a1)} L${at(r0, a1)} A${r0},${r0} 0 ${large} 0 ${at(r0, a0)} Z`;
}

/* the screen point of the tile k places older than the newest, at radius r on the plate */
function slotAt(k: number, r: number): [number, number] {
  const t = ((90 + k * SLOT) * Math.PI) / 180;
  return [CX + r * Math.cos(t), CY + r * TILT * Math.sin(t)];
}

/* towers that change lots glide there instead of jumping: each starts
   at its old place and eases to its new one (FLIP). Downtown never moves. */
function useGlide(nodes: Node[], still: boolean): Map<string, [number, number]> | null {
  const last = useRef(new Map<string, [number, number]>());
  const [from, setFrom] = useState<Map<string, [number, number]> | null>(null);
  useLayoutEffect(() => {
    const moved = new Map<string, [number, number]>();
    for (const n of nodes) {
      const p = last.current.get(n.id);
      if (p && n.role !== "hub" && Math.hypot(p[0] - n.x, p[1] - n.y) > 0.5) moved.set(n.id, [p[0] - n.x, p[1] - n.y]);
    }
    last.current = new Map(nodes.map((n) => [n.id, [n.x, n.y]]));
    if (still || !moved.size) {
      setFrom(null);
      return;
    }
    setFrom(moved);
    let second = 0;
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => setFrom(null));
    });
    return () => {
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
    };
  }, [nodes, still]);
  return from;
}

/* the city rises from downtown out; a new L1 rises last on a load, one
   that joined in the last minutes just after the district makes room */
function riseDelay(n: Node): number {
  if (n.newAt !== null) return Date.now() / 1000 - n.newAt < 600 ? 900 : 2400 + n.newRank * 320;
  return n.role === "hub" ? 0 : 140 + n.reach * 1100;
}

/* one tower: a square footprint turned to the plate, extruded h; its
   faces carry floor courses so height reads as stacked blocks */
export function Tower({ x, y, w, h, tone, mix, roof }: { x: number; y: number; w: number; h: number; tone: keyof typeof TONE; mix?: VersionMix | null; roof?: string | null }) {
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
      {/* a talker's roof wears its brand, a cap of color over the gray */}
      <polygon points={pts([[x, t - d], [x + w, t], [x, t + d], [x - w, t]])} fill={!bands.length && roof ? roof : c.top} stroke={c.edge} strokeOpacity={0.55} strokeWidth={0.75} />
    </g>
  );
}

/* The city's model: white massing, face by face, lit from the left, and
   glass by what the windows say: a client version in the Versions view,
   plain light in the others. In the dark the massing goes to slate and
   the windows glow. */
const MASS = {
  top: "fill-white dark:fill-[#2D313B]",
  left: "fill-[#EDEFF4] dark:fill-[#23262E]",
  right: "fill-[#DCDFE6] dark:fill-[#191B21]",
};
const EDGE = "stroke-[#1E1B3A]/[0.13] dark:stroke-white/[0.07]";
type Glass = Band | "plain" | "pick" | "fresh";
/* each glass, its lit face then its shaded one */
const GLASS: Record<Glass, [string, string]> = {
  on: ["fill-[#34C77B] dark:fill-[#4ADE80]", "fill-[#25A062] dark:fill-[#35BE68]"],
  near: ["fill-[#F4B63C] dark:fill-[#FCD34D]", "fill-[#CF9425] dark:fill-[#E2B53B]"],
  stale: ["fill-[#EF4B56] dark:fill-[#FB7185]", "fill-[#C5333E] dark:fill-[#E0596C]"],
  unknown: ["fill-[#BCC3CD] dark:fill-[#4A4F5C]", "fill-[#9EA6B2] dark:fill-[#3B3F4A]"],
  plain: ["fill-[#B5C6DA] dark:fill-[#EFD9A0]", "fill-[#93A8C0] dark:fill-[#CDB77F]"],
  pick: ["fill-[#3787F2] dark:fill-[#6AA8FF]", "fill-[#1F66CE] dark:fill-[#4E8DF0]"],
  fresh: ["fill-[#8C73FF] dark:fill-[#A48CFF]", "fill-[#6A4FF0] dark:fill-[#8770EE]"],
};
/** a storey's height; its ribbon of glass sits in the middle of it */
const FLOOR = 6;
/** a set this tall steps back over a podium */
const TALL = 58;

/* a building's storeys, ground up, each with its glass: the version bands
   stacked by share, so a mostly upgraded set is green to near its roof */
function floorsOf(h: number, mix: VersionMix | null, glass: Glass): Glass[] {
  const n = Math.max(1, Math.floor(h / FLOOR));
  const total = mix ? mixTotal(mix) : 0;
  if (!mix || glass !== "plain") return Array<Glass>(n).fill(glass);
  if (!total) return Array<Glass>(n).fill("unknown");
  const out: Glass[] = [];
  let acc = 0;
  for (const b of BAND_ORDER) {
    acc += mix[b];
    const upto = Math.round((acc / total) * n);
    while (out.length < upto) out.push(b);
  }
  while (out.length < n) out.push("unknown");
  return out;
}

/* a box on a diamond footprint, from z0 to z1 over the ground point */
function boxAt(x: number, y: number, w: number, z0: number, z1: number) {
  const d = w * TILT;
  return {
    left: pts([[x - w, y - z0], [x, y + d - z0], [x, y + d - z1], [x - w, y - z1]]),
    right: pts([[x, y + d - z0], [x + w, y - z0], [x + w, y - z1], [x, y + d - z1]]),
    top: pts([[x, y - d - z1], [x + w, y - z1], [x, y + d - z1], [x - w, y - z1]]),
  };
}

/* the ribbons of glass on one face of a box, one path per glass: a storey
   counts from the ground, so the ribbons run on over a setback */
function ribbons(x: number, y: number, w: number, z0: number, z1: number, floors: Glass[], face: 0 | 1): [Glass, string][] {
  const d = w * TILT;
  const inset = w < 10 ? 0.17 : 0.12;
  const at = (t: number): [number, number] => (face === 0 ? [x - w + t * w, y + t * d] : [x + t * w, y + d - t * d]);
  const [ax, ay] = at(inset);
  const [bx, by] = at(1 - inset);
  const paths = new Map<Glass, string>();
  floors.forEach((g, k) => {
    const za = k * FLOOR + 1.8;
    const zb = za + 2.5;
    if (za < z0 + 0.5 || zb > z1 - 1) return;
    const f = (n: number) => n.toFixed(1);
    paths.set(g, `${paths.get(g) ?? ""}M${f(ax)},${f(ay - za)}L${f(bx)},${f(by - za)}L${f(bx)},${f(by - zb)}L${f(ax)},${f(ay - zb)}Z`);
  });
  return [...paths];
}

/* one building of the model. A tall set steps back over a podium;
   downtown's tower stands on a wider podium and wears a crown in the
   brand's red, with a spire and its light. A building of another district,
   while the camera is in one, stands as plain massing */
function Building({
  x,
  y,
  w,
  h,
  floors,
  mass = false,
  faint = false,
  hub = false,
  still = false,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  floors: Glass[];
  mass?: boolean;
  /** its lights go down while another set's routes are lit */
  faint?: boolean;
  hub?: boolean;
  still?: boolean;
}) {
  const parts: { w: number; z0: number; z1: number; crown?: boolean }[] = [];
  if (hub) {
    const pod = 16;
    const crown = 13;
    parts.push({ w: w * 1.45, z0: 0, z1: pod }, { w, z0: pod, z1: h - crown }, { w: w * 0.72, z0: h - crown, z1: h, crown: true });
  } else if (h > TALL) {
    const pod = Math.min(14, h * 0.18);
    parts.push({ w, z0: 0, z1: pod }, { w: w * 0.8, z0: pod, z1: h });
  } else parts.push({ w, z0: 0, z1: h });
  const top = y - h;
  return (
    <g strokeLinejoin="round">
      {parts.map((p, i) => {
        const b = boxAt(x, y, p.w, p.z0, p.z1);
        return (
          <g key={i}>
            <polygon points={b.left} className={cn(p.crown ? "fill-[#E6212F]" : MASS.left, EDGE, "transition-[fill] duration-500")} strokeWidth={0.75} />
            <polygon points={b.right} className={cn(p.crown ? "fill-[#A8141F]" : MASS.right, EDGE, "transition-[fill] duration-500")} strokeWidth={0.75} />
            {!mass && !p.crown && (
              <g className="transition-opacity duration-300" style={{ opacity: faint ? 0.18 : 1 }}>
                {([0, 1] as const).flatMap((face) => ribbons(x, y, p.w, p.z0, p.z1, floors, face).map(([g, d]) => <path key={`${face}${g}`} d={d} className={GLASS[g][face]} />))}
              </g>
            )}
            <polygon points={b.top} className={cn(p.crown ? "fill-[#F2737B]" : MASS.top, EDGE, "transition-[fill] duration-500")} strokeWidth={0.75} />
          </g>
        );
      })}
      {hub && (
        <g className="pointer-events-none">
          <line x1={x} x2={x} y1={top - w * 0.72 * TILT + 1} y2={top - 30} className="stroke-zinc-500 dark:stroke-zinc-400" strokeWidth={1.25} strokeLinecap="round" />
          <circle cx={x} cy={top - 31} r={2.4} className="fill-[#E6212F]" style={still ? undefined : { animation: "bh-breathe 2600ms ease-in-out infinite" }} />
        </g>
      )}
    </g>
  );
}

/* the hull of a few points, for a shadow */
function hull(p: [number, number][]): [number, number][] {
  const s = [...p].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o: [number, number], a: [number, number], b: [number, number]) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const half = (list: [number, number][]) => {
    const out: [number, number][] = [];
    for (const q of list) {
      while (out.length >= 2 && cross(out[out.length - 2], out[out.length - 1], q) <= 0) out.pop();
      out.push(q);
    }
    out.pop();
    return out;
  };
  return [...half(s), ...half([...s].reverse())];
}

/* a building's shadow on the ground: the footprint swept back and to the
   right, away from the light, as far as the building is tall */
function shadowOf(x: number, y: number, w: number, h: number): string {
  const d = w * TILT;
  const vx = h * 0.46;
  const vy = -h * 0.09;
  const foot: [number, number][] = [[x - w, y], [x, y + d], [x + w, y], [x, y - d]];
  return pts(hull([...foot, ...foot.map(([a, b]): [number, number] => [a + vx, b + vy])]));
}

/* the AvaCloud tile stands in for a logo in the registry; the city shows none rather than a stand-in */
const realLogo = (uri: string) => (uri && !uri.includes("AvaCloud-512x512") ? uri : "");

/* which logos load, once per page: a roof shows its logo only when it has loaded */
const logoLoads = new Map<string, boolean>();
function useLogoLoads(uri: string): boolean {
  const [ok, setOk] = useState(() => !!uri && logoLoads.get(uri) === true);
  useEffect(() => {
    if (!uri) return setOk(false);
    const known = logoLoads.get(uri);
    if (known !== undefined) return setOk(known);
    let live = true;
    const img = new Image();
    img.onload = () => {
      logoLoads.set(uri, true);
      if (live) setOk(true);
    };
    img.onerror = () => {
      logoLoads.set(uri, false);
      if (live) setOk(false);
    };
    img.src = uri;
    return () => {
      live = false;
    };
  }, [uri]);
  return ok;
}

/* a chain's logo on its roof, facing the viewer; nothing when it has none or it will not load */
function RoofLogo({ uri, x, y, size, clipId }: { uri: string; x: number; y: number; size: number; clipId: string }) {
  const ok = useLogoLoads(uri);
  if (!ok) return null;
  const r = size / 2;
  return (
    <g className="pointer-events-none">
      <circle cx={x} cy={y + 0.8} r={r + 1.6} className="fill-[#1E1B3A]/15 dark:fill-black/50" />
      <circle cx={x} cy={y} r={r + 1.4} className="fill-white dark:fill-zinc-900" />
      <clipPath id={clipId}>
        <circle cx={x} cy={y} r={r} />
      </clipPath>
      <image href={uri} x={x - r} y={y - r} width={size} height={size} clipPath={`url(#${clipId})`} preserveAspectRatio="xMidYMid slice" />
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

/* a set's version split as a thin stacked bar, for the phone lists */
function MixBar({ mix, className }: { mix: VersionMix; className?: string }) {
  const total = mixTotal(mix);
  if (!total) return null;
  return (
    <span className={cn("flex h-1.5 overflow-hidden bg-zinc-100 dark:bg-zinc-900", className)}>
      {BAND_ORDER.map((b) => (mix[b] > 0 ? <span key={b} className="h-full" style={{ width: `${(mix[b] / total) * 100}%`, background: TONE[b].left }} /> : null))}
    </span>
  );
}

/* the share on target in the fleet's ink: green from 80%, red with any older node, amber else */
function pctInk(mix: VersionMix | null | undefined, pct: number | null): string {
  if (pct === null || !mix) return "text-zinc-400 dark:text-zinc-500";
  if (pct >= 80) return "text-emerald-600 dark:text-emerald-400";
  return mix.stale > 0 ? "text-[#E6212F]" : "text-amber-600 dark:text-amber-400";
}

/* the ledger on the rim: the newest tile at the front, older ones round
   the plate clockwise. Each tx turns the ring one place: the new tile
   comes out of the seam's open place as the oldest fades into it. Two
   layers make the tiles solid: the lip at plate level, the face
   RING_LIFT above it. */
const LedgerRing = memo(function LedgerRing({
  txs,
  outgoing,
  epoch,
  still,
  hovered,
  onHover,
  onOpen,
}: {
  txs: PulseTx[];
  outgoing: PulseTx | null;
  epoch: number;
  still: boolean;
  hovered: string | null;
  onHover: (hash: string | null) => void;
  onOpen: (hash: string) => void;
}) {
  // the newest at load: the sweep draws the ring back from it, and a tile that lands later just fades in
  const base = useRef<{ epoch: number; seq: number } | null>(null);
  if (txs.length && base.current?.epoch !== epoch) base.current = { epoch, seq: txs[0].seq };
  if (!txs.length) return null;
  const turn: CSSProperties = {
    transformBox: "fill-box",
    transformOrigin: "50% 50%",
    transform: `rotate(${90 + txs[0].seq * SLOT}deg)`,
    transition: still ? undefined : `transform ${TURN_MS}ms ${EASE_CSS}`,
  };
  const half = SLOT * 0.45;
  const layer = (lip: boolean) => (
    <g transform={`translate(${CX} ${CY - (lip ? 0 : RING_LIFT)}) scale(1 ${TILT})`}>
      <g style={turn}>
        {/* a clear disc centres the ring's box on the plate, so the ring turns on the plate's axis */}
        <circle r={RING_OUT} fill="none" />
        {(outgoing ? [...txs, outgoing] : txs).map((t) => {
          const a = -t.seq * SLOT;
          const age0 = base.current ? base.current.seq - t.seq : 0;
          const on = hovered === t.hash;
          const gone = t === outgoing;
          const f = FAM[famOf(t.type)];
          return (
            <path
              key={t.hash}
              d={sector(a - half, a + half, RING_IN, RING_OUT)}
              className={on ? (lip ? "fill-[#3600A6] dark:fill-[#B9A8FF]" : "fill-white stroke-[#5400FF] dark:stroke-[#8B6CFF]") : lip ? f.lip : f.top}
              strokeWidth={on && !lip ? 1.25 : undefined}
              vectorEffect="non-scaling-stroke"
              // the entry only runs before and during its fade, so the outgoing tile's opacity can take over
              style={{
                opacity: gone ? 0 : 1,
                pointerEvents: gone ? "none" : undefined,
                ...(still
                  ? {}
                  : {
                      transition: "opacity 600ms ease-in",
                      animation: age0 >= 0 ? `bh-fade 420ms ease-out ${500 + age0 * 9}ms backwards` : "bh-fade 520ms ease-out 180ms backwards",
                    }),
              }}
              {...(lip ? {} : { onMouseEnter: () => onHover(t.hash), onMouseLeave: () => onHover(null), onClick: () => onOpen(t.hash) })}
            />
          );
        })}
      </g>
    </g>
  );
  return (
    <g key={epoch} className="cursor-pointer">
      <g className="pointer-events-none">{layer(true)}</g>
      {layer(false)}
    </g>
  );
});

/* the rim under the seam: the P-Chain's newest block and its age, ticking;
   on a hover of the ground, the door to its explorer. The open place at
   the seam breathes while it waits for the next tx. */
function RimCaption({ uid, tip, ground, still }: { uid: string; tip: PulseTx | null; ground: boolean; still: boolean }) {
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);
  const edge = CY + PLATE * TILT;
  const age = (ts: number) => {
    const sec = Math.max(0, Math.floor(Date.now() / 1000 - ts));
    return sec < 60 ? `${sec} sec` : sec < 3600 ? `${Math.floor(sec / 60)} min` : `${Math.floor(sec / 3600)} h`;
  };
  return (
    <g className="pointer-events-none select-none">
      {tip && !still && (
        <g transform={`translate(${CX} ${CY - RING_LIFT}) scale(1 ${TILT})`}>
          <path
            d={sector(90 - SLOT * 1.45, 90 - SLOT * 0.55, RING_IN, RING_OUT)}
            className="fill-[#5400FF] dark:fill-[#8B6CFF]"
            // faint at rest, so a place whose animation never runs stays quiet
            style={{ opacity: 0.08, animation: "bh-breathe 2400ms ease-in-out infinite" }}
          />
        </g>
      )}
      {/* the seam's mark, under the newest tile */}
      <path d={`M${CX - 5},${edge + 2} L${CX},${edge - 4} L${CX + 5},${edge + 2} Z`} className="fill-[#5400FF] dark:fill-[#8B6CFF]" />
      <text className={cn("fill-current font-mono text-[9px] font-bold uppercase tracking-[0.3em]", P_INK)}>
        <textPath href={`#${uid}-rim`} startOffset="50%" textAnchor="middle" dominantBaseline="central">
          {ground ? "Open the P-Chain explorer →" : tip ? `P-Chain · block ${tip.height.toLocaleString("en-US")} · ${age(tip.ts)} ago` : "P-Chain"}
        </textPath>
      </text>
    </g>
  );
}

/* what each landed tx touched: a comet on the ground between its tile and
   the Primary Network's set, the way its AVAX ran, and a pulse at the
   set's foot; an L1 op spreads over the city, and a conversion runs
   on to the tower of the L1 it made, once the map stands it */
function Signals({ txs, joins }: { txs: PulseTx[]; joins: Map<string, [number, number]> }) {
  if (!txs.length) return null;
  const head = txs[0].seq;
  const comet = (delay: number): CSSProperties => ({ animation: `bh-comet 1300ms cubic-bezier(0.45,0,0.25,1) ${delay}ms both` });
  const ring = (delay: number, ms: number): CSSProperties => ({
    transformBox: "fill-box",
    transformOrigin: "50% 50%",
    animation: `bh-ripple ${ms}ms cubic-bezier(0.2,0.6,0.2,1) ${delay}ms both`,
  });
  const flash = (delay: number): CSSProperties => ({ opacity: 0, animation: `bh-flash 800ms ease-out ${delay}ms forwards` });
  return (
    <g className="pointer-events-none" fill="none">
      {txs
        .filter((t) => t.fresh)
        .slice(0, 8)
        .map((t) => {
          const k = head - t.seq;
          const flow = flowOf(t.type);
          const at = (t.replay ? 1900 : TURN_MS) + t.lane * 700;
          const [rx, ry] = slotAt(k, RING_IN - 6);
          const [fx, fy] = slotAt(k, 58);
          const d = flow === "out" ? `M${fx.toFixed(1)},${fy.toFixed(1)} L${rx.toFixed(1)},${ry.toFixed(1)}` : `M${rx.toFixed(1)},${ry.toFixed(1)} L${fx.toFixed(1)},${fy.toFixed(1)}`;
          const a = 90 + k * SLOT;
          return (
            <g key={t.hash}>
              {/* the tile lights as it lands, or as a payout reaches it */}
              <g transform={`translate(${CX} ${CY - RING_LIFT}) scale(1 ${TILT})`}>
                <path d={sector(a - SLOT * 0.45, a + SLOT * 0.45, RING_IN, RING_OUT)} className="fill-white" style={flash(flow === "out" ? at + 1300 : at)} />
              </g>
              {flow && (
                <>
                  {/* a soft tail, and a bright head at its front */}
                  <path d={d} pathLength={1} strokeDasharray="0.22 2" strokeWidth={11} className="stroke-[#5400FF]/20 dark:stroke-[#8B6CFF]/35" style={comet(at + 100)} />
                  <path d={d} pathLength={1} strokeDasharray="0 0.1 0.12 2" strokeWidth={5} className="stroke-[#5400FF]/35 dark:stroke-[#A48CFF]/60" style={comet(at + 100)} />
                  <path d={d} pathLength={1} strokeDasharray="0 0.16 0.06 2" strokeWidth={3} className="stroke-[#5400FF] dark:stroke-[#F1EDFF]" style={comet(at + 100)} />
                  {/* the set's foot rings twice: as stake arrives, or as a payout leaves */}
                  {[0, 1].map((n) => (
                    <ellipse
                      key={n}
                      cx={CX}
                      cy={CY}
                      rx={n ? 150 : 128}
                      ry={(n ? 150 : 128) * TILT}
                      strokeWidth={n ? 1 : 2}
                      vectorEffect="non-scaling-stroke"
                      className="stroke-[#5400FF] dark:stroke-[#A48CFF]"
                      style={ring((flow === "in" ? at + 1250 : at) + n * 220, 1200)}
                    />
                  ))}
                </>
              )}
              {joins.has(t.hash) &&
                (() => {
                  const [jx, jy] = joins.get(t.hash)!;
                  const jd = `M${rx.toFixed(1)},${ry.toFixed(1)} L${jx.toFixed(1)},${(jy + 4).toFixed(1)}`;
                  // mounted when the new tower stands, so it runs as the ring makes room
                  return (
                    <g key="join">
                      <path d={jd} pathLength={1} strokeDasharray="0.22 2" strokeWidth={11} className="stroke-[#5400FF]/20 dark:stroke-[#8B6CFF]/35" style={comet(150)} />
                      <path d={jd} pathLength={1} strokeDasharray="0 0.16 0.06 2" strokeWidth={3} className="stroke-[#5400FF] dark:stroke-[#F1EDFF]" style={comet(150)} />
                    </g>
                  );
                })()}
              {famOf(t.type) === "l1" && (
                <ellipse
                  cx={CX}
                  cy={CY}
                  rx={CITY_REACH + 10}
                  ry={(CITY_REACH + 10) * TILT}
                  strokeWidth={1.75}
                  vectorEffect="non-scaling-stroke"
                  className="stroke-[#5400FF]/80 dark:stroke-[#A48CFF]/85"
                  style={ring(at + 100, 3400)}
                />
              )}
            </g>
          );
        })}
    </g>
  );
}

/* the ground's key under the model: the ledger's span, its tiles by
   family, and the door to the P-Chain explorer. Phones, without the
   model, get the ledger as a flat tape, newest at the right. */
function GroundKey({ pulse, arrivals }: { pulse: PchainPulse; arrivals: Newcomer[] }) {
  const { txs, stats } = pulse;
  const counts = new Map<Fam, number>();
  for (const t of txs) counts.set(famOf(t.type), (counts.get(famOf(t.type)) ?? 0) + 1);
  const span = txs.length > 1 ? txs[0].ts - txs[txs.length - 1].ts : 0;
  const spanLabel = span < 5400 ? `${Math.max(1, Math.round(span / 60))} min` : `${(span / 3600).toFixed(1)} h`;
  return (
    <div className="border-t border-[#5400FF]/15 bg-[#5400FF]/[0.025] px-5 py-2.5 md:px-6 dark:border-[#8B6CFF]/20 dark:bg-[#8B6CFF]/[0.04]">
      {txs.length > 0 && (
        <div className="mb-2.5 flex h-3 gap-px lg:hidden" aria-hidden>
          {[...txs].reverse().map((t) => (
            <span key={t.hash} className={cn("flex-1", FAM[famOf(t.type)].bg)} />
          ))}
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
        <span className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[10px]">
          <span className={cn("flex items-center gap-1.5 font-bold uppercase tracking-[0.14em]", P_INK)}>
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#5400FF] opacity-50 dark:bg-[#8B6CFF]" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#5400FF] dark:bg-[#8B6CFF]" />
            </span>
            The ground · P-Chain
          </span>
          {txs.length > 0 && (
            <span className="tabular-nums text-zinc-500 dark:text-zinc-400">
              last {txs.length} txs · {spanLabel}
              {stats ? ` · ${stats.txCount24h.toLocaleString("en-US")} in 24h` : ""}
            </span>
          )}
        </span>
        <span className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-500 dark:text-zinc-400">
          {FAM_ORDER.filter((f) => counts.get(f)).map((f) => (
            <span key={f} className="flex items-center gap-1.5">
              <span className={cn("h-2.5 w-1.5", FAM[f].bg)} />
              {FAM[f].label}
              <span className="tabular-nums text-zinc-900 dark:text-zinc-100">{counts.get(f)}</span>
            </span>
          ))}
          <Link
            href="/explorer/mainnet/p-chain"
            className={cn("inline-flex shrink-0 items-center gap-1 font-bold tracking-[0.14em] transition-opacity hover:opacity-70", P_INK)}
          >
            P-Chain explorer
            <ArrowRight className="h-3 w-3" />
          </Link>
        </span>
      </div>
      {arrivals.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[10px]">
          <span className={cn("flex items-center gap-1.5 font-bold uppercase tracking-[0.14em]", P_INK)}>
            <span className="bg-[#5400FF] px-1 py-px text-[8px] text-white dark:bg-[#8B6CFF]">NEW</span>
            L1s · last {NEW_DAYS} days
          </span>
          {arrivals.map((a) => {
            const href = a.blockchainId ? `/explorer/mainnet/p-chain/chain/${a.blockchainId}` : a.tx ? `/explorer/mainnet/p-chain/tx/${a.tx}` : null;
            const body = (
              <>
                <span className="text-zinc-900 dark:text-zinc-100">{a.name}</span> <span className="tabular-nums text-zinc-400 dark:text-zinc-500">{ageShort(a.joinedAt)}</span>
              </>
            );
            return href ? (
              <Link key={a.subnetId} href={href} className="transition-opacity hover:opacity-70">
                {body}
              </Link>
            ) : (
              <span key={a.subnetId}>{body}</span>
            );
          })}
        </div>
      )}
    </div>
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
  hoveredName = null,
  onHoverName,
}: {
  /** a chain the page is pointing at, by name: its tower lights as if hovered */
  hoveredName?: string | null;
  /** the tower under the cursor, by name, for the page's other views */
  onHoverName?: (name: string | null) => void;
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
  // the district the camera has flown into, and the district under the cursor
  const [focus, setFocus] = useState<District | null>(null);
  const [hoverDistrict, setHoverDistrict] = useState<District | null>(null);
  const still = useStill();
  const router = useRouter();
  // the ground: the P-Chain's latest txs and tip
  const pulse = usePchainPulse("mainnet");
  // the week's new L1s, from the P-Chain
  const newcomers = useNewcomers(pulse.txs);
  const [ground, setGround] = useState(false);
  // a ledger tile under the cursor, by tx hash
  const [hoverTx, setHoverTx] = useState<string | null>(null);
  const openTx = useCallback((hash: string) => router.push(`/explorer/mainnet/p-chain/tx/${hash}`), [router]);
  // phones read the map as two lists: the chains, and the routes between them
  const [phoneView, setPhoneView] = useState<"chains" | "routes">("chains");
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

  const { nodes, routes, byName, city } = useMemo(() => {
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

    const listed = [...known.values()]
      .map((c) => {
        const id = String(c.chainId);
        return {
          id,
          name: c.chainName,
          // the feed leaves many logos blank; the catalog knows most of them
          logo: realLogo(c.chainLogoURI) || realLogo(catalogByChainId.get(id)?.chainLogoURI ?? ""),
          validators: typeof c.validatorCount === "number" ? c.validatorCount : 0,
          out: out.get(id) ?? 0,
          in: inn.get(id) ?? 0,
          href: chainHref(id),
          color: id === HUB_ID ? "#E6212F" : catalogByChainId.get(id)?.color ?? null,
          district: districtOf(catalogByChainId.get(id)?.category),
          newAt: null as number | null,
          guest: false,
        };
      })
      .filter((c) => c.validators > 0 || c.out + c.in > 0);
    // the week's new L1s: one the map already stands wears the mark on its
    // own tower; the rest stand as guests, from what the P-Chain knows
    const listedIds = new Set(listed.map((c) => c.id));
    const freshAt = new Map<string, number>();
    const guests: typeof listed = [];
    for (const nc of newcomers) {
      const cat = catalogBySubnet.get(nc.subnetId);
      const id = cat ? String(cat.chainId) : null;
      if (id && listedIds.has(id)) {
        freshAt.set(id, nc.joinedAt);
        continue;
      }
      guests.push({
        id: `p:${nc.subnetId}`,
        name: nc.name,
        logo: realLogo(cat?.chainLogoURI ?? ""),
        // a join seen live stands on its first validator until the registry counts it
        validators: nc.validators ?? 1,
        out: 0,
        in: 0,
        href: nc.blockchainId ? `/explorer/mainnet/p-chain/chain/${nc.blockchainId}` : nc.tx ? `/explorer/mainnet/p-chain/tx/${nc.tx}` : null,
        color: null,
        // the catalog has not described it yet
        district: districtOf(cat?.category),
        newAt: nc.joinedAt,
        guest: true,
      });
    }
    const base = [...listed.map((c) => (freshAt.has(c.id) ? { ...c, newAt: freshAt.get(c.id)! } : c)), ...guests];

    const metric = (c: (typeof base)[number]) => (sizeBy === "messages" ? c.out + c.in : c.validators);
    const top = Math.max(1, ...base.map(metric));
    const height = (c: (typeof base)[number]) => H_MIN + (H_MAX - H_MIN) * Math.pow(metric(c) / top, H_POW);

    const hub = base.find((c) => c.id === HUB_ID);
    const hubH = hub ? height(hub) : 0;
    const others = base.filter((c) => c.id !== HUB_ID);
    const city = planCity(
      others.map((c) => ({ id: c.id, district: c.district, talks: c.out + c.in, validators: c.validators, newAt: c.newAt })),
      { cx: CX, cy: CY, tilt: TILT, reach: CITY_REACH, hub: { w: HUB_W, h: hubH } },
    );
    // the week's arrivals, newest first, for the order they rise in
    const newRank = new Map(
      others
        .filter((c) => c.newAt !== null)
        .sort((a, b) => b.newAt! - a.newAt!)
        .map((c, k) => [c.id, k]),
    );
    const placed: Node[] = [];
    if (hub) placed.push({ ...hub, x: CX, y: CY, w: HUB_W, h: hubH, role: "hub", district: null, order: 0, reach: 0, newRank: 0 });
    for (const c of others) {
      const lot = city.lots.get(c.id);
      if (!lot) continue;
      const talker = c.out + c.in > 0;
      // a set that talks takes four fifths of its lot, a quiet one three fifths
      placed.push({ ...c, x: lot.x, y: lot.y, w: city.lot * (talker ? 0.4 : 0.31), h: height(c), role: talker ? "talker" : "quiet", order: lot.rank, reach: lot.reach, newRank: newRank.get(c.id) ?? 0 });
    }

    // where each set's traffic starts and ends: its lot, or downtown's plaza
    const downtown: Stop = { r: 0, a: 0, road: city.core, span: null };
    const stopOf = (id: string): Stop | null => (id === HUB_ID ? downtown : city.lots.get(id) ?? null);
    const maxMsgs = Math.max(1, ...[...merged.values()].map((r) => r.messages));
    const drawn: Route[] = [...merged.values()]
      .sort((a, b) => a.messages - b.messages)
      .flatMap((r) => {
        const a = stopOf(r.from);
        const b = stopOf(r.to);
        if (!a || !b) return [];
        // the traffic drives the streets: out of the sender's lot, round and in, to the receiver's
        const street = onScreen(streetRoute(a, b, city.core, HUB_W * 1.45));
        const heat = Math.sqrt(r.messages / maxMsgs);
        return [{ key: `${r.from}>${r.to}`, from: r.from, to: r.to, messages: r.messages, d: street.d, width: 0.9 + 2.1 * heat, heat, crown: street.mid, length: street.length }];
      });
    return { nodes: placed, routes: drawn, byName: new Map(placed.map((n) => [n.name, n])), city };
  }, [chains, flows, sizeBy, newcomers]);

  useEffect(() => {
    if (!onSummary || !chains) return;
    const byChain = new Map(nodes.map((n) => [n.id, n.out + n.in]));
    onSummary({ byChain, total: routes.reduce((t, r) => t + r.messages, 0), talking: nodes.filter((n) => n.out + n.in > 0).length });
    // the parent's callback identity does not matter, only the data
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, routes, chains]);

  // hover leads; a pick holds the light when the cursor leaves
  const pickedId = picked ? byName.get(picked)?.id ?? null : null;
  const pointed = hoveredName ? byName.get(hoveredName)?.id ?? null : null;
  const lit = hover ?? pointed ?? pickedId;
  // the lit set and the sets it talks with; a set with no routes lights alone and dims nothing
  const near = useMemo(() => {
    if (!lit) return null;
    const s = new Set([lit]);
    for (const r of routes) if (r.from === lit || r.to === lit) s.add(r.from).add(r.to);
    return s.size > 1 ? s : null;
  }, [lit, routes]);
  const byId = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);
  // the page's other views follow the cursor over the towers
  useEffect(() => {
    onHoverName?.(hover ? byId.get(hover)?.name ?? null : null);
    // the parent's callback identity does not matter, only the tower
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hover]);
  // painter's order: back of the plate first
  const drawOrder = useMemo(() => [...nodes].sort((a, b) => a.y - b.y), [nodes]);

  /* each district's sets, largest first, as the map stands them */
  const districtSets = useMemo(() => {
    const m = new Map<District, Node[]>();
    for (const t of city.wards) m.set(t.district, t.ids.map((id) => byId.get(id)).filter((n): n is Node => !!n));
    return m;
  }, [city, byId]);
  // a district that left the map (the data moved on) takes the camera back out
  useEffect(() => {
    if (focus && !districtSets.has(focus)) setFocus(null);
  }, [focus, districtSets]);
  useEffect(() => {
    if (!focus) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setFocus(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [focus]);
  /* the camera: into a district, it frames its buildings in the room the
     panel leaves on the left; out, it is the whole plate */
  const PANEL = 300;
  const zoom = useMemo(() => {
    const sets = focus ? districtSets.get(focus) : null;
    if (!sets?.length) return { k: 1, tx: 0, ty: 0 };
    const x0 = Math.min(...sets.map((n) => n.x - n.w)) - 70;
    const x1 = Math.max(...sets.map((n) => n.x + n.w)) + 70;
    const y0 = Math.min(...sets.map((n) => n.y - n.h - n.w * TILT)) - 60;
    const y1 = Math.max(...sets.map((n) => n.y + n.w * TILT)) + 50;
    const room = W - PANEL;
    // close enough to name every set, far enough to keep the district's neighbours in the frame
    const k = Math.min(2.2, room / (x1 - x0), H / (y1 - y0));
    return { k, tx: room / 2 - k * ((x0 + x1) / 2), ty: H / 2 - k * ((y0 + y1) / 2) };
  }, [focus, districtSets]);
  const zx = (x: number) => zoom.k * x + zoom.tx;
  const zy = (y: number) => zoom.k * y + zoom.ty;
  const glide = useGlide(nodes, still);
  // a conversion seen live, by tx, to the foot of the tower it made
  const joins = useMemo(() => {
    const m = new Map<string, [number, number]>();
    for (const nc of newcomers) {
      if (!nc.tx) continue;
      const cat = catalogBySubnet.get(nc.subnetId);
      const n = byId.get(`p:${nc.subnetId}`) ?? (cat ? byId.get(String(cat.chainId)) : undefined);
      if (n) m.set(nc.tx, [n.x, n.y]);
    }
    return m;
  }, [newcomers, byId]);
  const glideStyle = (id: string): CSSProperties | undefined => {
    if (still) return undefined;
    const o = glide?.get(id);
    return o ? { transform: `translate(${o[0]}px, ${o[1]}px)` } : { transform: "translate(0px, 0px)", transition: `transform 900ms ${EASE_CSS}` };
  };

  const tipNode = hover ? byId.get(hover) : null;
  const tipTx = hoverTx ? pulse.txs.find((t) => t.hash === hoverTx) ?? null : null;
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

  // a guest is not in the tables to cut, so its click opens its P-Chain page
  const pick = (n: Node) => (n.guest ? n.href && router.push(n.href) : onPick?.(n.name));
  const pickedNode = pickedId ? byId.get(pickedId) : null;
  const talking = nodes.filter((n) => n.role !== "quiet").sort((a, b) => b.out + b.in - (a.out + a.in));
  const maxTalk = Math.max(1, ...talking.map((n) => n.out + n.in));

  const halo = "pointer-events-none select-none stroke-white [paint-order:stroke] [stroke-width:4px] dark:stroke-zinc-950";


  /* each district's name round the city's edge, out from its middle, like
     the hours round a dial: under the city in front, and elsewhere just
     past its last ring, slid along it to where it need rise least over the
     roofs under it. A click flies the camera into the district */
  const signs = useMemo(
    () =>
      city.wards.map((t) => {
        const mid = (t.a0 + t.a1) / 2;
        const c = Math.cos(mid);
        const s = Math.sin(mid);
        const w = (t.label.length + 3) * 11 * 0.68 + t.label.length * 11 * 0.18 + 8;
        // in front, under the district's last ring; elsewhere just past it
        const front = s > 0.3;
        const r = t.r1 + city.lot * (front ? 0.75 : 0.35);
        // the name stays inside the ledger ring, where the ring is beside it
        const ringX = (yy: number) => {
          const k = (yy - CY) / (RING_IN * TILT);
          return Math.abs(k) >= 1 ? Infinity : RING_IN * Math.sqrt(1 - k * k) - 10;
        };
        const clampX = (x: number, yy: number) => Math.min(CX + ringX(yy) - w / 2, Math.max(CX - ringX(yy) + w / 2, x));
        if (front) {
          const y = CY + r * s * TILT + 8;
          const x = clampX(CX + r * c, y);
          return { ward: t, x, y, w, anchor: "middle" as const, box: [x - w / 2, y - 10, x + w / 2, y + 8] as Box };
        }
        // behind or beside the city, the name slides along the district's edge to where it
        // need rise least over the roofs under it, the middle breaking a tie
        let best: { x: number; y: number; cost: number } | null = null;
        for (let k = 0; k <= 8; k++) {
          const a = t.a0 + ((t.a1 - t.a0) * (k + 0.5)) / 9;
          const gy = CY + r * Math.sin(a) * TILT;
          const x = clampX(CX + r * Math.cos(a), gy);
          const under = nodes.filter((n) => n.x + n.w > x - w / 2 - 4 && n.x - n.w < x + w / 2 + 4 && n.y < gy + 40);
          const y = Math.min(gy, ...under.map((n) => n.y - n.h - n.w * TILT - (n.logo ? 18 : 4))) - 10;
          const cost = gy - y + Math.abs(k - 4) * 3;
          if (!best || cost < best.cost) best = { x, y, cost };
        }
        const x = best!.x;
        const y = Math.max(16, best!.y);
        return { ward: t, x, y, w, anchor: "middle" as const, box: [x - w / 2, y - 10, x + w / 2, y + 8] as Box };
      }),
    [city, nodes],
  );

  type Box = [number, number, number, number];
  const hits = (taken: Box[], b: Box) => taken.some((t) => b[0] < t[2] && b[2] > t[0] && b[1] < t[3] && b[3] > t[1]);

  /* in a district, a label per set over its roof logo, in the camera's frame:
     straight up, stepped higher, or out to a side, so no two labels meet
     and none covers a tower where it need not; a leader line ties each
     to its badge. None goes under the panel. */
  const focusLabels = useMemo(() => {
    if (!focus) return [];
    const sets = districtSets.get(focus) ?? [];
    const labels: Box[] = [];
    const towers: Box[] = sets.map((n) => [zx(n.x - n.w), zy(n.y - n.h - n.w * TILT), zx(n.x + n.w), zy(n.y + n.w * TILT)]);
    const out: { id: string; name: string; ax: number; ay: number; lx: number; ly: number; x: number; y: number; anchor: "middle" | "start" | "end" }[] = [];
    for (const n of sets) {
      // the label hangs over the roof's logo, or over the roof when it has none
      const badge = n.logo ? (n.role === "talker" ? 15 : 12) * 1.1 + 2 : 0;
      const ax = zx(n.x);
      const ay = zy(n.y - n.h - n.w * TILT) - badge * zoom.k - 3;
      const name = clip(n.name, 20);
      const w = name.length * 11 * 0.68 + name.length * 11 * 0.08 + 6;
      type Try = { x: number; y: number; anchor: "middle" | "start" | "end"; lx: number; ly: number; box: Box };
      const up = (lift: number): Try => ({ x: ax, y: ay - 10 - lift, anchor: "middle", lx: ax, ly: ay - 3 - lift, box: [ax - w / 2, ay - 19 - lift, ax + w / 2, ay - 2 - lift] });
      const aside = (side: 1 | -1, lift: number): Try => {
        const x = ax + side * 12;
        return { x, y: ay - lift, anchor: side > 0 ? "start" : "end", lx: x - side * 3, ly: ay - lift, box: side > 0 ? [x, ay - 9 - lift, x + w, ay + 8 - lift] : [x - w, ay - 9 - lift, x, ay + 8 - lift] };
      };
      const tries = [up(0), aside(1, 0), aside(-1, 0), up(20), aside(1, 20), aside(-1, 20), up(40), aside(1, 40), aside(-1, 40), up(60)].filter((t) => t.box[0] >= 4 && t.box[2] <= W - PANEL - 8 && t.box[1] >= 4);
      const self = towers[sets.indexOf(n)];
      const clear = (t: Try, withTowers: boolean) => !hits(labels, t.box) && (!withTowers || !hits(towers.filter((b) => b !== self), t.box));
      const pick = tries.find((t) => clear(t, true)) ?? tries.find((t) => clear(t, false));
      if (!pick) continue;
      labels.push(pick.box);
      out.push({ id: n.id, name, ax, ay, lx: pick.lx, ly: pick.ly, x: pick.x, y: pick.y, anchor: pick.anchor });
    }
    return out;
    // zx and zy read the camera, which `zoom` carries
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus, districtSets, zoom, painted, target, versions]);

  /* downtown flies its name from the spire, a flag in the brand's red; its figures are in its tooltip */
  const hubFlag = (n: Node) => {
    const tip = n.y - n.h - n.w * 0.72 * TILT - 29;
    const fw = 76;
    return (
      <>
        <path
          d={`M${n.x + 1},${tip} L${n.x + fw},${tip} L${n.x + fw - 5},${tip + 8} L${n.x + fw},${tip + 16} L${n.x + 1},${tip + 16} Z`}
          className={pickedId === n.id ? "fill-[#0061E2] dark:fill-[#5f9dff]" : "fill-[#E6212F]"}
        />
        <text x={n.x + 7} y={tip + 8.5} dominantBaseline="central" className="pointer-events-none select-none fill-white font-mono text-[9.5px] font-bold uppercase tracking-[0.16em]">
          C-Chain
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
        <span className="relative flex w-5 items-center">
          <span className="w-full border-t border-[#2A1F66]/40 dark:border-[#E9E4FF]/50" />
          <span className="absolute left-1.5 h-1.5 w-1.5 rounded-full bg-[#2A1F66] dark:bg-[#F4F1FF]" />
        </span>
        traffic · ICM
      </span>
      <span className="flex items-center gap-1.5">
        <span className="flex gap-px">
          {(["stake", "reward", "move"] as const).map((f) => (
            <span key={f} className={cn("h-2.5 w-1", FAM[f].bg)} />
          ))}
        </span>
        ground · P-Chain
      </span>
    </span>
  );

  /* the city's index under the plate: downtown, then each district with
     what it is for and every set in it, largest first, the Frontier last.
     A row cuts the tables as its building does and lights the building;
     a district's name flies the camera in */
  const hubNode = nodes.find((n) => n.role === "hub") ?? null;
  const indexOrder = [...city.wards].sort((a, b) => Number(a.district === "frontier") - Number(b.district === "frontier") || b.ids.length - a.ids.length);
  const indexRow = (n: Node) => {
    const on = pickedId === n.id;
    const pct = onPct(n.id);
    return (
      <li key={n.id}>
        <button
          type="button"
          onClick={() => pick(n)}
          onMouseEnter={() => setHover(n.id)}
          onMouseLeave={() => setHover(null)}
          aria-pressed={on}
          className={cn(
            "flex w-full items-center gap-2 rounded-md px-1.5 py-[3px] text-left transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-900",
            on && "bg-[#0061E2]/[0.07] dark:bg-[#5b9bff]/10",
          )}
        >
          <Logo uri={n.logo} name={n.name} />
          <span
            className={cn(
              "min-w-0 flex-1 truncate text-[12.5px]",
              on ? "text-[#0061E2] dark:text-[#5f9dff]" : n.newAt !== null ? "text-[#5400FF] dark:text-[#A48CFF]" : "text-zinc-800 dark:text-zinc-200",
            )}
          >
            {n.role === "hub" ? "C-Chain" : n.name}
          </span>
          <span className="shrink-0 font-mono text-[10.5px] tabular-nums text-zinc-400 dark:text-zinc-500">{n.validators}</span>
          {painted && versions && (
            <span className={cn("w-8 shrink-0 text-right font-mono text-[10px] tabular-nums", pctInk(versions.get(n.id), pct))}>{pct === null ? "—" : `${pct}%`}</span>
          )}
        </button>
      </li>
    );
  };
  const indexHead = (label: string, count: number | null, district: District | null) => {
    const words = (
      <>
        <span className="font-mono text-[10px] font-bold uppercase tracking-[0.16em]">{label}</span>
        {count !== null && <span className="font-mono text-[10px] tabular-nums text-zinc-400 dark:text-zinc-500">{count}</span>}
      </>
    );
    return district ? (
      <>
        {/* the model is on large screens only, so only there does the name open a district */}
        <button
          type="button"
          onClick={() => setFocus(district)}
          onMouseEnter={() => setHoverDistrict(district)}
          onMouseLeave={() => setHoverDistrict(null)}
          className="hidden items-baseline gap-2 text-zinc-900 transition-colors hover:text-[#5400FF] lg:flex dark:text-zinc-100 dark:hover:text-[#B9A8FF]"
        >
          {words}
        </button>
        <span className="flex items-baseline gap-2 text-zinc-900 lg:hidden dark:text-zinc-100">{words}</span>
      </>
    ) : (
      <span className="flex items-baseline gap-2 text-zinc-900 dark:text-zinc-100">{words}</span>
    );
  };
  const index = (
    <div className="border-t border-zinc-200 px-5 pb-3 pt-5 md:px-6 dark:border-zinc-800">
      <div className="columns-1 gap-x-8 sm:columns-2 lg:columns-4 xl:columns-5">
        {hubNode && (
          <section className="mb-5 break-inside-avoid">
            {indexHead("Downtown", null, null)}
            <p className="mb-1.5 mt-0.5 text-[11.5px] leading-snug text-zinc-500 dark:text-zinc-400">The Primary Network. Its P-Chain registers every L1.</p>
            <ul>{indexRow(hubNode)}</ul>
          </section>
        )}
        {indexOrder.map((t) => (
          <section key={t.district} className="mb-5 break-inside-avoid">
            {indexHead(t.label, t.ids.length, t.district)}
            <p className="mb-1.5 mt-0.5 text-[11.5px] leading-snug text-zinc-500 dark:text-zinc-400">{districtAbout(t.district)}</p>
            <ul>{(districtSets.get(t.district) ?? []).map(indexRow)}</ul>
          </section>
        ))}
      </div>
    </div>
  );

  let body: React.ReactNode;
  if (failed) body = <EmptyRow>Chain feed unavailable</EmptyRow>;
  else if (!chains) body = <div className="h-72 animate-pulse bg-zinc-100 lg:h-[640px] dark:bg-zinc-900" />;
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
          <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label={`Avalanche L1s as a city: each a building as tall as its validator count, in the district of what it is for, with ${windowLabel} of ICM traffic on its streets`}>
            {!still && (
              <style>{`@keyframes ${uid}rise{from{transform:scaleY(0.02)}to{transform:scaleY(1)}}`}</style>
            )}
            <defs>
              {/* the rim's front arc, for the P-Chain's label */}
              <path id={`${uid}-rim`} d={`M${CX - PLATE},${CY + PLATE_T * 0.55} A${PLATE},${PLATE * TILT} 0 0 0 ${CX + PLATE},${CY + PLATE_T * 0.55}`} fill="none" />
              {/* downtown's light, in its red */}
              <radialGradient id={`${uid}-glow`}>
                <stop offset="0%" className="[stop-color:#E6212F] [stop-opacity:0.16] dark:[stop-opacity:0.28]" />
                <stop offset="100%" className="[stop-color:#E6212F] [stop-opacity:0]" />
              </radialGradient>
            </defs>

            {/* the scene, which the camera moves: the ground, the ledger, the towers and the routes */}
            <g style={{ transformOrigin: "0 0", transform: `matrix(${zoom.k},0,0,${zoom.k},${zoom.tx},${zoom.ty})`, transition: still ? undefined : `transform 900ms ${EASE_CSS}` }}>

            {/* the ground is the P-Chain: a slab in its violet, a lattice and the two rings
                cut into it; a click opens its explorer. Its ledger rings the rim, over it */}
            <g
              role="link"
              tabIndex={0}
              aria-label="The ground is the P-Chain. Open the P-Chain explorer"
              onMouseEnter={() => setGround(true)}
              onMouseLeave={() => setGround(false)}
              onFocus={() => setGround(true)}
              onBlur={() => setGround(false)}
              onClick={() => (focus ? setFocus(null) : router.push("/explorer/mainnet/p-chain"))}
              onKeyDown={(e) => {
                if (e.key === "Enter") router.push("/explorer/mainnet/p-chain");
              }}
              className="cursor-pointer outline-none"
            >
              <ellipse cx={CX} cy={CY + PLATE_T} rx={PLATE} ry={PLATE * TILT} className="fill-[#E7E2FA] stroke-[#D4CCF4] dark:fill-[#1C1731] dark:stroke-[#2F2752]" strokeWidth={1} />
              <rect x={CX - PLATE} y={CY} width={PLATE * 2} height={PLATE_T} className="fill-[#E7E2FA] dark:fill-[#1C1731]" />
              <line x1={CX - PLATE} x2={CX - PLATE} y1={CY} y2={CY + PLATE_T} className="stroke-[#D4CCF4] dark:stroke-[#2F2752]" strokeWidth={1} />
              <line x1={CX + PLATE} x2={CX + PLATE} y1={CY} y2={CY + PLATE_T} className="stroke-[#D4CCF4] dark:stroke-[#2F2752]" strokeWidth={1} />
              <ellipse
                cx={CX}
                cy={CY}
                rx={PLATE}
                ry={PLATE * TILT}
                className={cn("stroke-[#D4CCF4] transition-[fill] duration-300 dark:stroke-[#2F2752]", ground ? "fill-[#F1EDFF] dark:fill-[#17122E]" : "fill-[#F8F6FF] dark:fill-[#110E1F]")}
                strokeWidth={1}
              />
              {/* the city, drawn in plan and laid on the plate: each district's
                  ground, its blocks standing proud of it, and downtown's plaza */}
              <g className="pointer-events-none">
                <g transform={`translate(${CX} ${CY}) scale(1 ${TILT})`}>
                  {/* the built city's ground: its streets, a shade under the plate */}
                  <circle r={city.edge + city.lot * 0.3} className="fill-[#EEEBF7] dark:fill-[#0A0910]" />
                  {/* a district lights when the cursor or the camera is on it */}
                  {city.wards.map((t) => {
                    const on = hoverDistrict === t.district || focus === t.district;
                    const inset = city.avenue / 2 / Math.max(1, (city.core + t.r1) / 2);
                    return (
                      <path
                        key={t.district}
                        d={arcPath(t.a0 + inset, t.a1 - inset, city.core + city.lot * 0.18, t.r1 + city.lot * 0.18)}
                        className={cn("transition-[fill-opacity] duration-300 fill-[#5400FF] dark:fill-[#8B6CFF]", on ? "[fill-opacity:0.07]" : "[fill-opacity:0]")}
                      />
                    );
                  })}
                </g>
                {/* the blocks: a lip under each, then its top */}
                <g transform={`translate(${CX} ${CY + 2.5}) scale(1 ${TILT})`} className="fill-[#DCD6EE] dark:fill-[#07060B]">
                  {city.blocks.map((b, i) => (
                    <path key={i} d={arcPath(b.a0, b.a1, b.r0 + 1.5, b.r1 - 1.5)} />
                  ))}
                </g>
                <g transform={`translate(${CX} ${CY}) scale(1 ${TILT})`}>
                  {city.blocks.map((b, i) => (
                    <path
                      key={i}
                      d={arcPath(b.a0, b.a1, b.r0 + 1.5, b.r1 - 1.5)}
                      className={cn(
                        "stroke-[#1E1B3A]/[0.10] transition-[fill] duration-500 dark:stroke-white/[0.06]",
                        focus && b.district !== focus ? "fill-[#FAF9FD] dark:fill-[#15131D]" : "fill-white dark:fill-[#1A1823]",
                      )}
                      strokeWidth={0.75}
                      vectorEffect="non-scaling-stroke"
                    />
                  ))}
                  {/* downtown's plaza, in its light */}
                  <circle r={city.core * 2.4} fill={`url(#${uid}-glow)`} />
                  <circle r={city.core - 3} className="fill-white stroke-[#E6212F]/25 dark:fill-[#1A1823] dark:stroke-[#E6212F]/40" strokeWidth={0.75} vectorEffect="non-scaling-stroke" />
                  <circle r={city.core - 9} fill="none" className="stroke-[#E6212F]/15 dark:stroke-[#E6212F]/25" strokeWidth={0.75} strokeDasharray="2 3" vectorEffect="non-scaling-stroke" />
                </g>
              </g>
            </g>

            <RimCaption uid={uid} tip={pulse.txs[0] ?? null} ground={ground} still={still} />
            <LedgerRing txs={pulse.txs} outgoing={pulse.outgoing} epoch={pulse.epoch} still={still} hovered={hoverTx} onHover={setHoverTx} onOpen={openTx} />
            {!still && <Signals txs={pulse.txs} joins={joins} />}
            {/* a hovered tile's line to the set it touched */}
            {tipTx && flowOf(tipTx.type) && (() => {
              const k = (pulse.txs[0]?.seq ?? 0) - tipTx.seq;
              const [rx, ry] = slotAt(k, RING_IN - 6);
              const [fx, fy] = slotAt(k, 58);
              return (
                <g className="pointer-events-none" fill="none" strokeWidth={1.25}>
                  <line x1={rx} y1={ry} x2={fx} y2={fy} strokeDasharray="3 4" className="stroke-[#5400FF]/70 dark:stroke-[#8B6CFF]/70" />
                  <ellipse cx={CX} cy={CY} rx={62} ry={62 * TILT} className="stroke-[#5400FF]/70 dark:stroke-[#8B6CFF]/70" />
                </g>
              );
            })()}

            {/* the routes' clear, wide strokes catch the cursor and carry the packets;
                they sit under the towers, so a tower always wins its own ground */}
            <g fill="none">
              {routes.map((r, i) => (
                <path key={r.key} id={`${uid}-r${i}`} d={r.d} stroke="transparent" strokeWidth={Math.max(10, r.width + 6)} onMouseEnter={() => setHoverRoute(r.key)} onMouseLeave={() => setHoverRoute(null)} />
              ))}
            </g>

            {/* the buildings' shadows, all in one layer, so where two fall together the ground is no darker */}
            <g className="pointer-events-none fill-[#2A1F66] opacity-[0.075] dark:fill-black dark:opacity-50">
              {drawOrder.map((n) => (
                <g key={n.id} style={glideStyle(n.id)}>
                  <polygon points={shadowOf(n.x, n.y, n.role === "hub" ? n.w * 1.45 : n.w, n.h)} style={still ? undefined : { animation: `bh-fade 700ms ease-out ${riseDelay(n) + 500}ms backwards` }} />
                </g>
              ))}
            </g>

            {/* the traffic: each route drives the streets, its road lit as busy as it is,
                its packets running sender to receiver at one speed, more on busier routes.
                It runs on the ground, so a building hides what passes behind it */}
            <g fill="none" strokeLinecap="round" strokeLinejoin="round" className="pointer-events-none">
              {routes.map((r, i) => {
                const mine = !focus || byId.get(r.from)?.district === focus || byId.get(r.to)?.district === focus;
                const on = mine && (!lit || r.from === lit || r.to === lit);
                const hot = hoverRoute === r.key || (lit !== null && on);
                const blue = !!pickedId && (r.from === pickedId || r.to === pickedId);
                return (
                  <path
                    key={r.key}
                    d={r.d}
                    strokeWidth={r.width}
                    pathLength={1}
                    strokeDasharray={still ? undefined : 1}
                    strokeDashoffset={still ? undefined : 1}
                    className={cn("transition-[stroke-opacity] duration-200", blue ? "stroke-[#0061E2] dark:stroke-[#5f9dff]" : "stroke-[#2A1F66] dark:stroke-[#E9E4FF]")}
                    strokeOpacity={hot ? 0.65 : on ? 0.26 : 0.05}
                  >
                    {/* the roads light out of their senders once the city stands */}
                    {!still && <animate attributeName="stroke-dashoffset" from="1" to="0" dur="1.2s" begin={`${1.2 + i * 0.05}s`} fill="freeze" calcMode="spline" keyTimes="0;1" keySplines="0.32 0.72 0 1" />}
                  </path>
                );
              })}
              {!still &&
                routes.map((r, i) => {
                  const mine = !focus || byId.get(r.from)?.district === focus || byId.get(r.to)?.district === focus;
                  const on = mine && (!lit || r.from === lit || r.to === lit);
                  const blue = !!pickedId && (r.from === pickedId || r.to === pickedId);
                  const count = 1 + Math.round(r.heat * 5);
                  // a packet carries its sender's color, and every packet drives at the city's one speed
                  const ink = blue ? null : byId.get(r.from)?.color ?? null;
                  const dur = Math.min(16, Math.max(3, r.length / 48));
                  const size = 1.7 + 1.1 * r.heat;
                  return (
                    <g key={r.key} className="transition-opacity duration-200" style={{ opacity: on ? 1 : 0 }}>
                      {Array.from({ length: count }, (_, k) => {
                        const begin = `${(2.2 - (k / count) * dur).toFixed(2)}s`;
                        return (
                          <circle
                            key={k}
                            r={size}
                            opacity={0}
                            className={cn("stroke-white dark:stroke-[#0B0A10]", blue ? "fill-[#0061E2] dark:fill-[#5f9dff]" : "fill-[#2A1F66] dark:fill-[#F4F1FF]")}
                            style={ink ? { fill: ink } : undefined}
                            strokeWidth={1}
                          >
                            <animateMotion dur={`${dur.toFixed(2)}s`} begin={begin} repeatCount="indefinite">
                              <mpath href={`#${uid}-r${i}`} />
                            </animateMotion>
                            {/* out of the sender's door, and in at the receiver's */}
                            <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.06;0.94;1" dur={`${dur.toFixed(2)}s`} begin={begin} repeatCount="indefinite" />
                          </circle>
                        );
                      })}
                    </g>
                  );
                })}
            </g>

            {/* buildings, back to front */}
            {drawOrder.map((n) => {
              const away = focus !== null && n.role !== "hub" && n.district !== focus;
              const dim = !away && near !== null && !near.has(n.id);
              const up = hover === n.id;
              const delay = riseDelay(n);
              // the roof's logo, larger on a set that talks
              const badge = n.role === "hub" ? 0 : n.role === "talker" ? 15 : 12;
              const glass: Glass = pickedId === n.id ? "pick" : n.newAt !== null ? "fresh" : "plain";
              return (
                <g key={n.id} style={glideStyle(n.id)}>
                <g
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
                  className="cursor-pointer outline-none transition-[opacity,transform] duration-300 ease-out"
                  style={{ transform: up ? "translateY(-4px)" : undefined }}
                >
                  {/* a new L1 comes up out of the P-Chain: the ground rings where it rises */}
                  {n.newAt !== null && !still && (
                    <ellipse
                      cx={n.x}
                      cy={n.y}
                      rx={n.w * 6}
                      ry={n.w * 6 * TILT}
                      fill="none"
                      strokeWidth={1.5}
                      vectorEffect="non-scaling-stroke"
                      className="pointer-events-none stroke-[#5400FF] dark:stroke-[#A48CFF]"
                      style={{ transformBox: "fill-box", transformOrigin: "50% 50%", animation: `bh-ripple 1400ms cubic-bezier(0.2,0.6,0.2,1) ${delay}ms both` }}
                    />
                  )}
                  <g
                    style={
                      still
                        ? undefined
                        : { transformOrigin: `${n.x}px ${n.y}px`, animation: `${uid}rise 900ms cubic-bezier(0.32,0.72,0,1) ${delay}ms both` }
                    }
                  >
                    {/* a clear pad so short towers are easy to catch */}
                    <rect x={n.x - Math.max(12, n.w)} y={n.y - n.h - n.w * TILT - 6} width={Math.max(24, n.w * 2)} height={n.h + n.w * TILT * 2 + 12} fill="transparent" />
                    <Building x={n.x} y={n.y} w={n.w} h={n.h} floors={floorsOf(n.h, mixOf(n.id), glass)} mass={away} faint={dim} hub={n.role === "hub"} still={still} />
                    {badge > 0 && !away && (
                      <g className="transition-opacity duration-300" style={{ opacity: dim ? 0.35 : 1 }}>
                        <RoofLogo uri={n.logo} x={n.x} y={n.y - n.h - badge * 0.55} size={badge} clipId={`${uid}-b${n.id}`} />
                      </g>
                    )}
                  </g>
                  {/* the NEW plate lies on the ground at the tower's foot */}
                  {n.newAt !== null && !away && (
                    <g className="pointer-events-none" style={still ? undefined : { animation: `bh-fade 500ms ease-out ${delay + 700}ms backwards` }}>
                      <rect x={n.x - 12} y={n.y + n.w * TILT + 2} width={24} height={10} className="fill-[#5400FF] dark:fill-[#8B6CFF]" />
                      <text x={n.x} y={n.y + n.w * TILT + 7} textAnchor="middle" dominantBaseline="central" className="fill-white font-mono text-[7.5px] font-bold tracking-[0.1em]">
                        NEW
                      </text>
                    </g>
                  )}
                </g>
                </g>
              );
            })}


            </g>

            {/* over the scene, the words, which keep their size as the camera moves:
                downtown's flag and the districts' names round the city */}
            <g className="transition-opacity duration-300" style={{ opacity: focus ? 0 : 1, pointerEvents: focus ? "none" : undefined }}>
              {nodes
                .filter((n) => n.role === "hub")
                .map((n) => (
                  <g key={n.id} className="transition-opacity duration-200" style={{ opacity: near !== null && !near.has(n.id) ? 0.2 : 1 }}>
                    {hubFlag(n)}
                  </g>
                ))}

              {signs.map((s) => {
                const t = s.ward;
                const on = hoverDistrict === t.district;
                return (
                  <g
                    key={t.district}
                    role="button"
                    tabIndex={0}
                    aria-label={`${t.label}: ${t.ids.length} L1s. Open the district`}
                    onMouseEnter={() => setHoverDistrict(t.district)}
                    onMouseLeave={() => setHoverDistrict(null)}
                    onFocus={() => setHoverDistrict(t.district)}
                    onBlur={() => setHoverDistrict(null)}
                    onClick={() => setFocus(t.district)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setFocus(t.district);
                      }
                    }}
                    className="cursor-pointer outline-none"
                  >
                    <rect x={s.box[0] - 6} y={s.box[1] - 4} width={s.box[2] - s.box[0] + 12} height={s.box[3] - s.box[1] + 8} fill="transparent" />
                    <text
                      x={s.x}
                      y={s.y}
                      textAnchor={s.anchor}
                      dominantBaseline="central"
                      className={cn(halo, "font-mono text-[11px] font-semibold uppercase tracking-[0.18em] transition-[fill] duration-200", on ? "fill-[#5400FF] dark:fill-[#B9A8FF]" : "fill-zinc-800 dark:fill-zinc-100")}
                    >
                      {t.label}
                      <tspan className={cn("font-normal tracking-[0.04em]", on ? "" : "fill-zinc-400 dark:fill-zinc-500")}> {t.ids.length}</tspan>
                    </text>
                    <line x1={s.box[0]} x2={s.box[0] + 20} y1={s.y + 11} y2={s.y + 11} strokeWidth={1.5} className={cn("transition-opacity duration-200 stroke-[#5400FF] dark:stroke-[#B9A8FF]", on ? "opacity-100" : "opacity-0")} />
                  </g>
                );
              })}
            </g>

            {/* in a district: every set's name over its roof, where the camera left room; the panel carries the figures */}
            {focus && (
              <g className="pointer-events-none" style={still ? undefined : { animation: "bh-fade 400ms ease-out 650ms backwards" }}>
                {focusLabels.map((l) => (
                  <g key={l.id}>
                    {Math.hypot(l.lx - l.ax, l.ly - l.ay) > 4 && <line x1={l.ax} x2={l.lx} y1={l.ay} y2={l.ly} className="stroke-zinc-400/70 dark:stroke-zinc-600" strokeWidth={1} />}
                    <text
                      x={l.x}
                      y={l.y}
                      textAnchor={l.anchor}
                      dominantBaseline="central"
                      className={cn(halo, "font-mono text-[11px] font-medium uppercase tracking-[0.08em]", pickedId === l.id ? "fill-[#0061E2] dark:fill-[#5f9dff]" : hover === l.id ? "fill-[#5400FF] dark:fill-[#B9A8FF]" : "fill-zinc-900 dark:fill-zinc-50")}
                    >
                      {l.name}
                    </text>
                  </g>
                ))}
              </g>
            )}
          </svg>

          {/* in a district: its sets, each a door into the tables below */}
          {focus && (() => {
            const ward = city.wards.find((t) => t.district === focus);
            const sets = districtSets.get(focus) ?? [];
            if (!ward) return null;
            const vals = sets.reduce((a, n) => a + n.validators, 0);
            const msgs = sets.reduce((a, n) => a + n.out + n.in, 0);
            const known = versions ? sets.map((n) => versions.get(n.id)).filter((m): m is VersionMix => !!m) : [];
            const onShare = known.length ? Math.round((known.reduce((a, m) => a + m.on, 0) / Math.max(1, known.reduce((a, m) => a + mixTotal(m), 0))) * 100) : null;
            return (
              <div
                className="absolute bottom-4 right-4 top-4 z-10 flex flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white/95 shadow-[0_24px_48px_-24px_rgba(24,24,27,0.35)] backdrop-blur animate-in fade-in-0 slide-in-from-right-4 duration-500 dark:border-zinc-800 dark:bg-zinc-950/95"
                style={{ width: `calc(${(PANEL / W) * 100}% - 16px)` }}
              >
                <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-2.5 dark:border-zinc-900">
                  <button
                    type="button"
                    onClick={() => setFocus(null)}
                    className="flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
                  >
                    <ArrowLeft className="h-3 w-3" /> All districts
                  </button>
                  <span className="font-mono text-[10px] text-zinc-400 dark:text-zinc-500">Esc</span>
                </div>
                <div className="flex flex-col gap-1 px-4 pb-2 pt-3.5">
                  <span className={cn("font-mono text-[10px] font-bold uppercase tracking-[0.16em]", P_INK)}>District</span>
                  <h3 className="text-[22px] font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">{ward.label}</h3>
                  <p className="font-mono text-[11px] tabular-nums text-zinc-500 dark:text-zinc-400">
                    {sets.length} L1{sets.length === 1 ? "" : "s"} · {vals.toLocaleString("en-US")} validators · {fmtCompact(msgs)} msgs
                    {painted && onShare !== null && target ? ` · ${onShare}% on ${target}` : ""}
                  </p>
                </div>
                <ul className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-3">
                  {sets.map((n) => {
                    const on = pickedId === n.id;
                    const pct = onPct(n.id);
                    return (
                      <li key={n.id}>
                        <button
                          type="button"
                          onClick={() => pick(n)}
                          onMouseEnter={() => setHover(n.id)}
                          onMouseLeave={() => setHover(null)}
                          aria-pressed={on}
                          className={cn("flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-900", on && "bg-[#0061E2]/[0.07] dark:bg-[#5b9bff]/10")}
                        >
                          <Logo uri={n.logo} name={n.name} />
                          <span className={cn("min-w-0 flex-1 truncate text-[13px]", on ? "text-[#0061E2] dark:text-[#5f9dff]" : n.newAt !== null ? "text-[#5400FF] dark:text-[#A48CFF]" : "text-zinc-900 dark:text-zinc-100")}>{n.name}</span>
                          <span className="shrink-0 font-mono text-[11px] tabular-nums text-zinc-500 dark:text-zinc-400">{n.validators} val</span>
                          {painted && versions ? (
                            <span className={cn("w-9 shrink-0 text-right font-mono text-[10px] tabular-nums", pctInk(versions.get(n.id), pct))}>{pct === null ? "—" : `${pct}%`}</span>
                          ) : (
                            <span className="w-12 shrink-0 text-right font-mono text-[11px] tabular-nums text-zinc-900 dark:text-zinc-100">{n.out + n.in > 0 ? fmtCompact(n.out + n.in) : ""}</span>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })()}

          {tipNode && (
            <span
              className="pointer-events-none absolute z-20"
              style={{
                top: `${(zy(tipNode.y - tipNode.h / 2) / H) * 100}%`,
                // on the building's outer side, off downtown and the routes into it, unless the frame's edge is too near
                ...((() => {
                  const x = zx(tipNode.x);
                  const outer = x > (focus ? (W - PANEL) / 2 : CX) ? 1 : -1;
                  const room = outer > 0 ? (focus ? W - PANEL : W) - x : x;
                  return (room > 260 ? outer : -outer) > 0;
                })()
                  ? { left: `calc(${(zx(tipNode.x) / W) * 100}% + ${tipNode.w * zoom.k + 16}px)` }
                  : { right: `calc(${100 - (zx(tipNode.x) / W) * 100}% + ${tipNode.w * zoom.k + 16}px)` }),
                transform: "translateY(-50%)",
              }}
            >
              <TipPlate>
                <p className="mb-1 flex items-center gap-1.5 text-[12px] font-medium text-zinc-900 dark:text-zinc-100">
                  <Logo uri={tipNode.logo} name={tipNode.name} />
                  {tipNode.name}
                </p>
                {tipNode.newAt !== null && <TipRow label="Joined the P-Chain" value={`${ageShort(tipNode.newAt)} ago`} />}
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
                {!tipNode.guest && (
                  <>
                    <TipRow label="Messages out" value={fmtCompact(tipNode.out)} />
                    <TipRow label="Messages in" value={fmtCompact(tipNode.in)} />
                  </>
                )}
                {(() => {
                  const p = topPartner(tipNode.id);
                  return p ? <TipRow label="Most with" value={byId.get(p[0])?.name ?? p[0]} /> : null;
                })()}
                {tipNode.guest ? (
                  <p className="mt-1 font-mono text-[10px] text-zinc-400">Not in the directory yet. Click to open it on the P-Chain</p>
                ) : (
                  onPick && <p className="mt-1 font-mono text-[10px] text-zinc-400">{pickedId === tipNode.id ? "Click to clear the cut" : "Click to cut the tables"}</p>
                )}
              </TipPlate>
            </span>
          )}
          {tipRoute && (
            <span
              className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-[calc(100%+10px)]"
              style={{ left: `${(zx(tipRoute.crown[0]) / W) * 100}%`, top: `${(zy(tipRoute.crown[1]) / H) * 100}%` }}
            >
              <TipPlate>
                <p className="font-mono text-[10px] text-zinc-500">
                  {byId.get(tipRoute.from)?.name} → {byId.get(tipRoute.to)?.name}
                </p>
                <p className="font-mono text-[11px] tabular-nums text-zinc-900 dark:text-zinc-100">{fmtCompact(tipRoute.messages)} msgs</p>
              </TipPlate>
            </span>
          )}
          {tipTx && (() => {
            const k = (pulse.txs[0]?.seq ?? 0) - tipTx.seq;
            const [x, y] = slotAt(k, RING_OUT);
            const f = famOf(tipTx.type);
            const what =
              f === "stake"
                ? "Stake joins the Primary Network"
                : f === "reward"
                  ? "The Primary Network pays out"
                  : tipTx.type === "ExportTx"
                    ? "AVAX leaves for the C- or X-Chain"
                    : tipTx.type === "ImportTx"
                      ? "AVAX arrives from the C- or X-Chain"
                      : f === "l1"
                        ? "Acts on an L1"
                        : null;
            return (
              <span
                className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-[calc(100%+12px)]"
                style={{ left: `${(zx(x) / W) * 100}%`, top: `${(zy(y - RING_LIFT) / H) * 100}%` }}
              >
                <TipPlate>
                  <p className="mb-1 flex items-center gap-1.5 text-[12px] font-medium text-zinc-900 dark:text-zinc-100">
                    <span className={cn("h-2.5 w-1.5 shrink-0", FAM[f].bg)} />
                    {txTypeLabel(tipTx.type)}
                  </p>
                  {what && <p className="mb-1 font-mono text-[10px] text-zinc-500">{what}</p>}
                  <TipRow label="Block" value={tipTx.height.toLocaleString("en-US")} />
                  <TipRow label="Age" value={`${ageShort(tipTx.ts)} ago`} />
                  {tipTx.nodeId && <TipRow label="Node" value={truncate(tipTx.nodeId, 12)} />}
                  {tipTx.period && <TipRow label="Period" value={tipTx.period} />}
                  <p className="mt-1 font-mono text-[10px] text-zinc-400">Click to open the tx</p>
                </TipPlate>
              </span>
            );
          })()}
        </div>

        {/* phones and tablets: the model as two lists, the chains and the routes */}
        <div className="lg:hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 px-5 py-2.5 dark:border-zinc-900">
            <ViewSwitch
              id="icm-map-phone"
              value={phoneView}
              onChange={setPhoneView}
              options={[
                { v: "chains", label: `Chains · ${talking.length}` },
                { v: "routes", label: `Routes · ${routes.length}` },
              ]}
            />
            {versions && onTarget && targets.length > 1 && (
              <ViewSwitch id="icm-map-phone-target" value={target} onChange={onTarget} options={targets.slice(0, 3).map((t) => ({ v: t, label: t }))} />
            )}
          </div>
          {phoneView === "chains" ? (
            <ul>
              {talking.map((n, i) => {
                const on = pickedId === n.id;
                const total = n.out + n.in;
                const mix = versions?.get(n.id);
                const pct = onPct(n.id);
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
                        {mix && target && (
                          <span className="flex items-center gap-2">
                            <MixBar mix={mix} className="w-24 shrink-0" />
                            <span className={cn("font-mono text-[10px] tabular-nums", pctInk(mix, pct))}>{pct === null ? "not reported" : `${pct}% on ${target}`}</span>
                          </span>
                        )}
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
          ) : (
            <ul>
              {[...routes]
                .sort((a, b) => b.messages - a.messages)
                .map((r) => {
                  const a = byId.get(r.from);
                  const b = byId.get(r.to);
                  if (!a || !b) return null;
                  const top = Math.max(1, ...routes.map((x) => x.messages));
                  const on = !!pickedId && (r.from === pickedId || r.to === pickedId);
                  return (
                    <li key={r.key} className={cn("border-b border-zinc-100 px-5 py-2.5 last:border-b-0 dark:border-zinc-900", on && "bg-[#0061E2]/[0.06] dark:bg-[#5b9bff]/10")}>
                      <span className="flex min-w-0 items-center justify-between gap-3">
                        <span className="flex min-w-0 items-center gap-1.5 text-[12.5px] text-zinc-900 dark:text-zinc-100">
                          <Logo uri={a.logo} name={a.name} />
                          <span className="truncate">{a.role === "hub" ? "C-Chain" : a.name}</span>
                          <ArrowRight className="h-3 w-3 shrink-0 text-zinc-300 dark:text-zinc-600" />
                          <Logo uri={b.logo} name={b.name} />
                          <span className="truncate">{b.role === "hub" ? "C-Chain" : b.name}</span>
                        </span>
                        <span className="shrink-0 font-mono text-[11px] tabular-nums text-zinc-900 dark:text-zinc-50">{fmtCompact(r.messages)}</span>
                      </span>
                      <span
                        className="mt-1.5 block h-1.5 max-w-full"
                        style={{ width: `${Math.max(1.5, Math.sqrt(r.messages / top) * 100)}%`, background: on ? PICK_BLUE : BLOCK_GRAY }}
                      />
                    </li>
                  );
                })}
            </ul>
          )}
        </div>

        <GroundKey pulse={pulse} arrivals={newcomers} />

        {index}

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
