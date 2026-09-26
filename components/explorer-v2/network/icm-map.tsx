"use client";

import { useEffect, useMemo, useState, type RefObject } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { ageShort } from "@/components/explorer-v2/format";
import { LEDGER, usePchainPulse, type PchainPulse } from "@/components/explorer-v2/network/pchain-pulse";
import { NEW_DAYS, useNewcomers, type Newcomer, type Site } from "@/components/explorer-v2/network/newcomers";
import { GUEST_LOGOS } from "@/components/explorer-v2/network/guest-logos";
import { type Ground } from "@/components/explorer-v2/network/ground";
import { BAND_ORDER, EDGE, FLOOR, GLASS, GROUND, LIGHTS_MS, MASS, TALL, type Band, type Glass } from "@/components/explorer-v2/network/city-model";
import { HUB_LOBBY, HUB_PLINTH, hubMast } from "@/components/explorer-v2/network/hub-tower";
export { DISTRICT_GLASS, EDGE, FLOOR, GLASS, GROUND, LIGHTS_MS, MASS, TALL, type Glass } from "@/components/explorer-v2/network/city-model";
export { HUB_CHAMFER, HUB_FACES, HUB_LOBBY, HUB_LOBBY_W, HUB_PLINTH, HUB_STEP, HUB_TAPER, chamferOf, hubMast, hubScale } from "@/components/explorer-v2/network/hub-tower";
import { arcPath, diceOf, HUB_W, TILT } from "@/components/explorer-v2/network/city-geometry";
import { BLOCK_GRAY, PICK_BLUE } from "@/components/explorer-v2/network/icm-parts";
import { planCity, streetRoute, turn, type City, type Stop, type Street } from "@/components/explorer-v2/network/city";
import { districtOf, type District } from "@/components/explorer-v2/network/districts";
import l1ChainsData from "@/constants/l1-chains.json";
import type { L1Chain } from "@/types/stats";

export interface MapChain {
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

export interface Node {
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
  /** its subnet, and its chain's blockchain ID (CB58) as the P-Chain's registry names it; null when unknown */
  subnetId: string | null;
  blockchainId: string | null;
}
export interface Route {
  key: string;
  from: string;
  to: string;
  messages: number;
  /** its path on screen; the traffic reads it back into streets (city-traffic.tsx), so it keeps to M, L and A */
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
export type SizeBy = "versions" | "validators" | "messages";

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
export const mixTotal = (m: VersionMix) => m.on + m.near + m.stale + m.unknown;

export const W = 1200;
export const CX = W / 2;
export const CY = 352;
/** how far the plate leans back: the projected depth of a unit of ground, as in a true isometric view */
export const PLATE = 540;
export const PLATE_T = 12;
/** the plan radius the city builds out to, inside the ledger on the rim */
export const CITY_REACH = PLATE - 96;
const H_MIN = 14;
const H_MAX = 165;
/** height grows as the 0.4 power: 600 validators stands about 7x a set of 5, not 120x */
const H_POW = 0.4;
/** the validator scale's top is never under this: when the P-Chain's counts are
    missing, a new L1's stand-in count of 1 must not stand as the city's tallest */
const H_TOP_MIN = 100;
export const HUB_ID = "43114";
/** the Primary Network's subnet, whose set is downtown's */
const PRIMARY_SUBNET = "11111111111111111111111111111111LpoYY";

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
  // a new L1 wears the brand's steel for its first week
  fresh: { top: "#E3E9F2", left: "#A9B7CB", right: "#8596AE", edge: "#5F6B7A" },
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
const pts = (p: [number, number][]) => p.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");

/* the P-Chain's own ink: the brand's steel */
const P_INK = "text-[#5F6B7A] dark:text-[#A2AFB2]";

/* the ledger's txs by family: five tones of the brand's blue and steel,
   so the towers' version colors keep their one meaning */
export type Fam = "stake" | "reward" | "move" | "l1" | "other";
const FAM_ORDER: Fam[] = ["stake", "reward", "move", "l1", "other"];
export const FAM: Record<Fam, { label: string; top: string; lip: string; bg: string }> = {
  stake: { label: "Staking", top: "fill-[#0061E2] dark:fill-[#5F9DFF]", lip: "fill-[#004BB0] dark:fill-[#3F7FE0]", bg: "bg-[#0061E2] dark:bg-[#5F9DFF]" },
  reward: { label: "Rewards", top: "fill-[#749DD3] dark:fill-[#9DB9E3]", lip: "fill-[#5A82B8] dark:fill-[#7E9CC8]", bg: "bg-[#749DD3] dark:bg-[#9DB9E3]" },
  move: { label: "Cross-chain", top: "fill-[#A2AFB2] dark:fill-[#7B8894]", lip: "fill-[#84939A] dark:fill-[#5F6B7A]", bg: "bg-[#A2AFB2] dark:bg-[#7B8894]" },
  l1: { label: "L1", top: "fill-[#3B484B] dark:fill-[#C9D3DF]", lip: "fill-[#262F31] dark:fill-[#A7B3C2]", bg: "bg-[#3B484B] dark:bg-[#C9D3DF]" },
  other: { label: "Other", top: "fill-[#C9D3DF] dark:fill-[#3B484B]", lip: "fill-[#A7B3C2] dark:fill-[#2A3236]", bg: "bg-[#C9D3DF] dark:bg-[#3B484B]" },
};

/* an L1 op names an L1, a chain or their validators; the other staking txs are the Primary Network's */
export function famOf(type: string): Fam {
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

/* the ring holds LEDGER tiles in RING_SLOTS places: the one open place at the seam is where the next tx lands */
export const RING_SLOTS = LEDGER + 1;
export const SLOT = 360 / RING_SLOTS;
export const RING_IN = PLATE - 32;
export const RING_OUT = PLATE - 12;
/** how far a tile's face stands above the plate */
export const RING_LIFT = 3;
export const STRATA = (
  [
    [0, 2, "fill-[#6B6A66] dark:fill-[#1C1D21]"],
    [2, 11.2, "fill-[#E6E2DA] dark:fill-[#2B2C31]"],
    [11.2, PLATE_T, "fill-[#CFCAC0] dark:fill-[#222328]"],
  ] as const
).map(([y0, y1, className]) => ({
  y0,
  y1,
  d: `M${CX - PLATE},${CY + y0} A${PLATE},${PLATE * TILT} 0 0 0 ${CX + PLATE},${CY + y0} L${CX + PLATE},${CY + y1} A${PLATE},${PLATE * TILT} 0 0 1 ${CX - PLATE},${CY + y1} Z`,
  className,
}));

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
export function Tower({
  x,
  y,
  w,
  h,
  tone,
  mix,
  roof,
  paint,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  tone: keyof typeof TONE;
  mix?: VersionMix | null;
  roof?: string | null;
  /** its own faces' colors, over the tone's */
  paint?: { top: string; left: string; right: string; edge: string } | null;
}) {
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
  const c = (!major && paint) || TONE[major ?? tone];
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

/* a building's storeys, ground up, each with its glass: its district's
   tint, or under the Versions lens the version bands stacked by share, so
   a mostly upgraded set is green to near its roof */
export function floorsOf(h: number, mix: VersionMix | null, glass: Glass, tint: Glass | null = null): Glass[] {
  const n = Math.max(1, Math.floor(h / FLOOR));
  if (glass !== "plain") return Array<Glass>(n).fill(glass);
  if (!mix) return Array<Glass>(n).fill(tint ?? "plain");
  const total = mixTotal(mix);
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

/* a footprint's corners on screen, round its ground point: its left face
   runs `l` across the screen and its right face `r`; a square's are both w */
export type Kind = "hub" | "block" | "setback" | "terrace" | "tower" | "spire" | "slab" | "twin" | "stepped";
export type Roof = "flat" | "cap" | "penthouse" | "garden" | "water" | "helipad" | "mast" | "solar" | "lantern" | "dome";
export interface Form {
  kind: Kind;
  roof: Roof;
  /** a slab turns its long face to the right instead of the left */
  flip?: boolean;
}
export function formOf(n: { id: string; role: string; h: number; newAt: number | null }, landmark: boolean): Form {
  if (n.role === "hub") return { kind: "hub", roof: "flat" };
  if (landmark) return { kind: "spire", roof: "flat" };
  const roll = diceOf(`${n.id}:form`);
  const a = roll();
  const b = roll();
  const flip = roll() < 0.5;
  const kind: Kind =
    n.h > TALL
      ? a < 0.24 ? "setback" : a < 0.4 ? "terrace" : a < 0.56 ? "tower" : a < 0.72 ? "twin" : a < 0.88 ? "slab" : "stepped"
      : n.h > 30
        ? a < 0.2 ? "tower" : a < 0.42 ? "slab" : a < 0.54 ? "stepped" : "block"
        : a < 0.34 ? "slab" : "block";
  // a new L1 is going up: plain boxes, the site's scaffolding round them
  if (n.newAt !== null) return { kind: kind === "tower" || kind === "twin" || kind === "slab" ? "block" : kind, roof: "flat" };
  const roof: Roof =
    kind === "tower"
      ? b < 0.45 ? "dome" : "flat"
      : kind === "twin"
        ? b < 0.5 ? "mast" : "flat"
        : n.h > 80
          ? b < 0.3 ? "helipad" : b < 0.52 ? "lantern" : b < 0.7 ? "mast" : b < 0.85 ? "penthouse" : "flat"
          : b < 0.16 && n.h < 70 ? "cap" : b < 0.34 ? "penthouse" : b < 0.46 ? "garden" : b < 0.6 ? "water" : b < 0.72 ? "solar" : b < 0.8 ? "lantern" : "flat";
  // a hipped roof needs a square top
  return { kind, roof: kind === "slab" && roof === "cap" ? "flat" : roof, flip };
}

/* a building's parts, ground up: boxes, or a drum for a round tower. A
   box's footprint is square unless it names its faces (a slab's long and
   short faces), and stands over the building's ground point unless it is
   set off it (a twin tower) */
export interface Part {
  w: number;
  z0: number;
  z1: number;
  round?: boolean;
  /** the left and right faces' runs across the screen; w when unset */
  l?: number;
  r?: number;
  /** its ground point's offset on screen from the building's */
  dx?: number;
  dy?: number;
}

export function partsOf(w: number, h: number, kind: Kind, flip = false): Part[] {
  const pod = Math.min(14, h * 0.18);
  // a slab's long face and its short one, turned by `flip`
  const slab = (long: number, short: number) => (flip ? { l: short, r: long } : { l: long, r: short });
  switch (kind) {
    case "slab":
      // a tall slab rises off a podium; a low one stands on its own, longer
      return h > TALL ? [{ w, z0: 0, z1: pod }, { w, z0: pod, z1: h, ...slab(w, w * 0.5) }] : [{ w, z0: 0, z1: h, ...slab(w * 1.3, w * 0.6) }];
    case "twin":
      // two towers on one podium, the right a few storeys short of the left
      return [
        { w, z0: 0, z1: pod },
        { w: w * 0.42, z0: pod, z1: h, dx: -w * 0.5 },
        { w: w * 0.42, z0: pod, z1: Math.max(pod + FLOOR * 2, h * 0.84), dx: w * 0.5 },
      ];
    case "stepped":
      return [
        { w, z0: 0, z1: h * 0.34 },
        { w: w * 0.82, z0: h * 0.34, z1: h * 0.6 },
        { w: w * 0.64, z0: h * 0.6, z1: h * 0.82 },
        { w: w * 0.46, z0: h * 0.82, z1: h },
      ];
    case "hub":
      // drawn as its own tower (HubTower): its shaft, over the lobby, is what its transactions light
      return [{ w, z0: HUB_LOBBY, z1: h }];
    case "setback":
      return [{ w, z0: 0, z1: pod }, { w: w * 0.8, z0: pod, z1: h }];
    case "terrace":
      return [{ w, z0: 0, z1: pod }, { w: w * 0.84, z0: pod, z1: h * 0.72 }, { w: w * 0.64, z0: h * 0.72, z1: h }];
    case "spire":
      return [{ w, z0: 0, z1: pod }, { w: w * 0.8, z0: pod, z1: h }, { w: w * 0.46, z0: h, z1: h + 9 }];
    case "tower":
      return h > TALL ? [{ w, z0: 0, z1: pod }, { w: w * 0.74, z0: pod, z1: h, round: true }] : [{ w: w * 0.9, z0: 0, z1: h, round: true }];
    default:
      return [{ w, z0: 0, z1: h }];
  }
}

/* the part of a building whose floors a set's transactions light: its
   longest run of floors, over any podium */

/* how high a building's massing reaches, for the logo that floats over it */
export function crestOf(w: number, h: number, form: Form): number {
  if (form.kind === "spire") return h + 9;
  const top = partsOf(w, h, form.kind, form.flip).slice(-1)[0];
  if (form.roof === "cap") return h + w * 0.55;
  if (form.roof === "penthouse" || form.roof === "lantern") return h + 6;
  if (form.roof === "water") return h + 9;
  if (form.roof === "dome") return h + top.w * 0.62;
  return h;
}

/* the AvaCloud tile stands in for a logo in the registry; the city shows none rather than a stand-in */
// Glacier's AvaCloud placeholders, by file name and by the Contentful asset the newer one is served from
const realLogo = (uri: string) => (uri && !uri.includes("AvaCloud-512x512") && !uri.includes("/62KzIedYATHGgRODAP5Py9/") ? uri : "");
export function logoAt(uri: string, px: number): string {
  if (!uri) return uri;
  try {
    const u = new URL(uri);
    if (u.hostname === "images.ctfassets.net" && /\.(png|jpe?g|webp|gif)$/i.test(u.pathname)) {
      u.searchParams.set("w", String(px));
      u.searchParams.set("h", String(px));
      return u.toString();
    }
  } catch {
    // a relative or broken URL stays as it is
  }
  return uri;
}

export function Logo({ uri, name }: { uri: string; name: string }) {
  const [broken, setBroken] = useState(false);
  if (!uri || broken) {
    return (
      <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-zinc-200 font-mono text-[8px] font-bold uppercase text-zinc-400 dark:border-zinc-700">
        {name.charAt(0)}
      </span>
    );
  }
  return <img src={logoAt(uri, 48)} alt="" decoding="async" onError={() => setBroken(true)} className="h-4 w-4 shrink-0 rounded-full object-contain" />;
}

/* the share on target in the fleet's ink: green from 80%, red with any older node, amber else */
export function pctInk(mix: VersionMix | null | undefined, pct: number | null): string {
  if (pct === null || !mix) return "text-zinc-400 dark:text-zinc-500";
  if (pct >= 80) return "text-emerald-600 dark:text-emerald-400";
  return mix.stale > 0 ? "text-[#E6212F]" : "text-amber-600 dark:text-amber-400";
}

/* the ledger on the rim: the newest tile at the front, older ones round
   the plate clockwise. Each tx turns the ring one place: the new tile
   comes out of the seam's open place as the oldest fades into it. Two
   layers make the tiles solid: the lip at plate level, the face
   RING_LIFT above it. */
export function GroundKey({ pulse, arrivals }: { pulse: PchainPulse; arrivals: Newcomer[] }) {
  const { txs, stats } = pulse;
  const counts = new Map<Fam, number>();
  for (const t of txs) counts.set(famOf(t.type), (counts.get(famOf(t.type)) ?? 0) + 1);
  const span = txs.length > 1 ? txs[0].ts - txs[txs.length - 1].ts : 0;
  const spanLabel = span < 5400 ? `${Math.max(1, Math.round(span / 60))} min` : `${(span / 3600).toFixed(1)} h`;
  return (
    <div className="border-t border-[#7C4A2E]/15 bg-[#7C4A2E]/[0.03] px-5 py-2.5 md:px-6 dark:border-[#D9A983]/20 dark:bg-[#D9A983]/[0.04]">
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
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#7C4A2E] opacity-50 dark:bg-[#D9A983]" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#7C4A2E] dark:bg-[#D9A983]" />
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
          {/* the new L1s keep the steel they stand in */}
          <span className="flex items-center gap-1.5 font-bold uppercase tracking-[0.14em] text-[#5F6B7A] dark:text-[#A2AFB2]">
            <span className="border border-[#A2AFB2] px-1 py-px text-[8px] text-[#5F6B7A] dark:border-[#5F6B7A] dark:text-[#A2AFB2]">NEW</span>
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

/** the city, planned: the chains and their lots, the routes on the streets, the ground's ledger */
export interface CityData {
  /** the chain feed; null while it loads */
  chains: MapChain[] | null;
  failed: boolean;
  nodes: Node[];
  routes: Route[];
  byId: Map<string, Node>;
  city: City;
  summary: IcmSummary;
  pulse: PchainPulse;
  newcomers: Newcomer[];
  /** L1s the P-Chain has created that run no validators yet */
  sites: Site[];
}

/* the city's data: the chains and their validators, the window's ICM
   routes, the P-Chain's ledger and the week's new L1s, planned into lots
   and streets. The app reads it for its panels and lists; the canvas
   draws it. Phones read it without the canvas */
export function useCityData({ days, sizeBy }: { days: number; sizeBy: SizeBy }): CityData {
  const [chains, setChains] = useState<MapChain[] | null>(null);
  const [flows, setFlows] = useState<FlowRoute[]>([]);
  const [failed, setFailed] = useState(false);
  // the ground: the P-Chain's latest txs and tip
  const pulse = usePchainPulse("mainnet");
  // the week's new L1s, and every set the P-Chain runs now, from the P-Chain
  const { newcomers, residents, sites } = useNewcomers(pulse.txs);

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

  const { nodes, routes, city } = useMemo(() => {
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

    // the registry counts every running set too, cached apart from the overview: it stands in when the overview's count is missing
    const residentCount = new Map(residents.map((r) => [r.subnetId, r.validators]));
    const chainOf = new Map(residents.map((r) => [r.subnetId, r.blockchainId]));
    const primary = residentCount.get(PRIMARY_SUBNET);
    const listed = [...known.values()]
      .map((c) => {
        const id = String(c.chainId);
        const subnet = id === HUB_ID ? null : catalogByChainId.get(id)?.subnetId;
        const counted = typeof c.validatorCount === "number" && c.validatorCount > 0 ? c.validatorCount : (id === HUB_ID ? primary : subnet ? residentCount.get(subnet) : undefined) ?? 0;
        return {
          id,
          name: c.chainName,
          // the feed leaves many logos blank; the catalog knows most of them
          logo: realLogo(c.chainLogoURI) || realLogo(catalogByChainId.get(id)?.chainLogoURI ?? ""),
          validators: counted,
          out: out.get(id) ?? 0,
          in: inn.get(id) ?? 0,
          href: chainHref(id),
          color: id === HUB_ID ? "#E6212F" : catalogByChainId.get(id)?.color ?? null,
          district: districtOf(catalogByChainId.get(id)?.category),
          newAt: null as number | null,
          guest: false,
          subnetId: (id === HUB_ID ? PRIMARY_SUBNET : subnet ?? null) as string | null,
          blockchainId: (subnet ? chainOf.get(subnet) ?? null : null) as string | null,
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
        logo: realLogo(cat?.chainLogoURI ?? "") || (GUEST_LOGOS[nc.subnetId] ?? ""),
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
        subnetId: nc.subnetId,
        blockchainId: nc.blockchainId ?? chainOf.get(nc.subnetId) ?? null,
      });
    }
    // every other set the P-Chain runs now stands too, with no NEW mark: a
    // private L1 the catalog does not list stands on the Frontier
    const standing = new Set([...listed.map((c) => catalogByChainId.get(c.id)?.subnetId), ...guests.map((g) => g.id.slice(2))]);
    for (const r of residents) {
      if (standing.has(r.subnetId)) continue;
      const cat = catalogBySubnet.get(r.subnetId);
      guests.push({
        id: `p:${r.subnetId}`,
        name: r.name,
        logo: realLogo(cat?.chainLogoURI ?? "") || (GUEST_LOGOS[r.subnetId] ?? ""),
        validators: r.validators,
        out: 0,
        in: 0,
        href: `/explorer/mainnet/p-chain/chain/${r.blockchainId}`,
        color: null,
        district: districtOf(cat?.category),
        newAt: null,
        guest: true,
        subnetId: r.subnetId,
        blockchainId: r.blockchainId,
      });
    }
    const base = [...listed.map((c) => (freshAt.has(c.id) ? { ...c, newAt: freshAt.get(c.id)! } : c)), ...guests];

    const metric = (c: (typeof base)[number]) => (sizeBy === "messages" ? c.out + c.in : c.validators);
    const top = Math.max(sizeBy === "messages" ? 1 : H_TOP_MIN, ...base.map(metric));
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
        const street = onScreen(streetRoute(a, b, city.core, HUB_W * HUB_PLINTH[0]));
        const heat = Math.sqrt(r.messages / maxMsgs);
        return [{ key: `${r.from}>${r.to}`, from: r.from, to: r.to, messages: r.messages, d: street.d, width: 0.9 + 2.1 * heat, heat, crown: street.mid, length: street.length }];
      });
    return { nodes: placed, routes: drawn, city };
  }, [chains, flows, sizeBy, newcomers, residents]);
  const byId = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);
  const summary = useMemo<IcmSummary>(
    () => ({
      byChain: new Map(nodes.map((n) => [n.id, n.out + n.in])),
      total: routes.reduce((t, r) => t + r.messages, 0),
      talking: nodes.filter((n) => n.out + n.in > 0).length,
    }),
    [nodes, routes],
  );
  return { chains, failed, nodes, routes, byId, city, summary, pulse, newcomers, sites };
}

/** the room the app's panels leave the canvas, in pixels from each edge */
export interface Inset {
  left: number;
  right: number;
  top: number;
  bottom: number;
}
/** the app's handle on the reader's camera: whether it has moved, and one call to take it home */
export type CameraHandle = {
  moved: boolean;
  home: () => void;
  /** resolves when the camera's flight lands; at once when it stands still */
  settled: () => Promise<void>;
};

/** what the city's view is given: the app's data and the reader's picks, the same for the 3D view and any other */
export interface CityViewProps {
  data: CityData;
  /** each chain's nodes by client version, by EVM chain ID; the Versions view paints them */
  versions?: Map<string, VersionMix> | null;
  /** the version the mix is measured against */
  target?: string;
  sizeBy: SizeBy;
  /** windows lit by client version; the Versions view lights them when this is unset */
  paint?: boolean;
  /** each set's transactions in the window, by id: its floors flash with them */
  activity?: Map<string, number> | null;
  /** the message window spelled out, "30 days" */
  windowLabel: string;
  /** the set the app has open, by id */
  selected: string | null;
  onSelect: (id: string | null) => void;
  /** the district the camera is in */
  focus: District | null;
  onFocus: (d: District | null) => void;
  /** the sets a search or a figure points at; the rest stand faint */
  lit?: Set<string> | null;
  /** a set the app's lists point at, by id: it lights as if hovered */
  hovered?: string | null;
  /** the building under the cursor, by id */
  onHover?: (id: string | null) => void;
  inset: Inset;
  /** the app's handle on the reader's camera, for its Escape and the landing */
  cameraRef?: RefObject<CameraHandle | null>;
}
export function outskirtsOf(city: City, sites: Site[], terrain: Ground) {
  type Mass = { x: number; y: number; w: number; h: number };
  const out = { pads: [] as string[], parks: [] as string[], fences: [] as string[], masses: [] as Mass[], trees: [] as [number, number][], sites: [] as { site: Site; x: number; y: number; w: number }[] };
  // a small town's plots, whatever size the city's lots grew to
  const plot = Math.min(city.lot, 20);
  const rIn = city.edge + 10;
  const rOut = RING_IN - 12;
  const depth = plot * 0.78;
  const road = plot * 0.34;
  const rows = Math.min(3, Math.floor((rOut - rIn + road) / (depth + road)));
  if (rows < 1 || !city.wards.length) return out;
  const roll = diceOf("outskirts");
  const at = (r: number, a: number): [number, number] => [CX + r * Math.cos(a), CY + r * Math.sin(a) * TILT];
  const frontier = city.wards.find((t) => t.district === "frontier") ?? [...city.wards].sort((a, b) => b.a1 - b.a0 - (a.a1 - a.a0))[0];
  const waiting = [...sites];
  for (let i = 0; i < rows; i++) {
    const r0 = rIn + i * (depth + road);
    const r1 = r0 + depth;
    const rm = (r0 + r1) / 2;
    const lotA = (plot * 0.74) / rm;
    const laneA = (plot * 0.3) / rm;
    // the city's boulevards run on out to the ledger between the wards, as roads (ground.ts)
    const gapA = (city.avenue * 0.64 + 8) / rm;
    for (const t of city.wards) {
      let a = t.a0 + gapA / 2;
      const end = t.a1 - gapA / 2;
      while (a + lotA <= end) {
        const n = Math.min(Math.floor((end - a) / lotA), 2 + Math.floor(roll() * 3));
        const b0 = a;
        const b1 = a + n * lotA;
        // the river runs here: its banks stay open, but for the Frontier's building sites
        const sitesHere = i === 0 && t === frontier && waiting.length > 0;
        if (!sitesHere && [b0, (b0 + b1) / 2, b1].some((x) => terrain.wet(r0, x) || terrain.wet(r1, x))) {
          a = b1 + laneA;
          continue;
        }
        if (roll() < 0.1) {
          out.parks.push(arcPath(b0, b1, r0, r1));
          for (let k = 0, trees = 3 + Math.floor(roll() * 4); k < trees; k++) out.trees.push(at(r0 + depth * (0.2 + roll() * 0.6), b0 + (b1 - b0) * (0.1 + roll() * 0.8)));
        } else {
          out.pads.push(arcPath(b0, b1, r0, r1));
          for (let k = 0; k < n; k++) {
            const la = b0 + (k + 0.5) * lotA;
            const [x, y] = at(rm, la);
            // a site takes the first lot of each of the Frontier's front-row blocks until every one stands
            if (i === 0 && t === frontier && k === 0 && waiting.length) {
              out.sites.push({ site: waiting.shift()!, x, y, w: Math.min(lotA * rm, depth) * 0.42 });
              out.fences.push(arcPath(la - lotA * 0.44, la + lotA * 0.44, r0 + depth * 0.08, r1 - depth * 0.08));
              continue;
            }
            if (roll() < 0.28) continue;
            out.masses.push({ x, y, w: Math.min(lotA * rm, depth) * (0.26 + roll() * 0.1), h: 2.5 + roll() * (i === 0 ? 7 : 5) });
          }
        }
        a = b1 + laneA;
      }
    }
  }
  out.masses.sort((a, b) => a.y - b.y);
  return out;
}

/* the city's canvas: it draws what useCityData planned, lights what the
   app points at, and hands every click back to the app */
