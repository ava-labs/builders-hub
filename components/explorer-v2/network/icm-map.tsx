"use client";

import { memo, useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
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
   The plate is the P-Chain, the chain every validator set registers on.
   It wears the P-Chain's violet, and its ledger rings the rim: the last
   96 txs as tiles, newest at the front, shaded by family. Each tx that
   lands turns the ring one place, and a comet runs on the ground to the
   set it touched: stake into the Primary Network's set, a reward out of
   it. A click on the ground opens the P-Chain explorer, a click on a tile
   opens its tx. The week's new L1s stand at the front of the outer ring in
   the P-Chain's violet, flagged NEW, even before the catalog knows them;
   one that joins while the page is open rises there as the ring makes
   room. It fetches its own data, so the page only mounts it. */

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
  ring: "hub" | "inner" | "outer";
  order: number;
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

/* a ground point on a ring of the plate, starting at the back */
function onRing(i: number, n: number, r: number, turn = 0): [number, number] {
  const a = -Math.PI / 2 + turn + (i / Math.max(1, n)) * Math.PI * 2;
  return [CX + r * Math.cos(a), CY + r * TILT * Math.sin(a)];
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

/* the screen point of the tile k places older than the newest, at radius r on the plate */
function slotAt(k: number, r: number): [number, number] {
  const t = ((90 + k * SLOT) * Math.PI) / 180;
  return [CX + r * Math.cos(t), CY + r * TILT * Math.sin(t)];
}

/* towers that change places glide there instead of jumping: each starts
   at its old place and eases to its new one (FLIP). Only the outer ring
   moves so, as its sets carry no routes to leave behind. */
function useGlide(nodes: Node[], still: boolean): Map<string, [number, number]> | null {
  const last = useRef(new Map<string, [number, number]>());
  const [from, setFrom] = useState<Map<string, [number, number]> | null>(null);
  useLayoutEffect(() => {
    const moved = new Map<string, [number, number]>();
    for (const n of nodes) {
      const p = last.current.get(n.id);
      if (p && n.ring === "outer" && Math.hypot(p[0] - n.x, p[1] - n.y) > 0.5) moved.set(n.id, [p[0] - n.x, p[1] - n.y]);
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

/* a new L1 rises last on a load; one that joined in the last minutes, just after the ring makes room */
function riseDelay(n: Node): number {
  if (n.newAt !== null) return Date.now() / 1000 - n.newAt < 600 ? 900 : 2400 + n.newRank * 320;
  return n.ring === "hub" ? 0 : n.ring === "inner" ? 120 + n.order * 45 : 300 + n.order * 12;
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
   set's foot; an L1 op spreads over the L1s' rings, and a conversion runs
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
                  rx={OUTER + 30}
                  ry={(OUTER + 30) * TILT}
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

    const listed = [...known.values()]
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
          color: id === HUB_ID ? "#E6212F" : catalogByChainId.get(id)?.color ?? null,
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
        logo: cat?.chainLogoURI ?? "",
        // a join seen live stands on its first validator until the registry counts it
        validators: nc.validators ?? 1,
        out: 0,
        in: 0,
        href: nc.blockchainId ? `/explorer/mainnet/p-chain/chain/${nc.blockchainId}` : nc.tx ? `/explorer/mainnet/p-chain/tx/${nc.tx}` : null,
        color: null,
        newAt: nc.joinedAt,
        guest: true,
      });
    }
    const base = [...listed.map((c) => (freshAt.has(c.id) ? { ...c, newAt: freshAt.get(c.id)! } : c)), ...guests];

    const metric = (c: (typeof base)[number]) => (sizeBy === "messages" ? c.out + c.in : c.validators);
    const top = Math.max(1, ...base.map(metric));
    const height = (c: (typeof base)[number]) => H_MIN + (H_MAX - H_MIN) * Math.pow(metric(c) / top, H_POW);

    const hub = base.find((c) => c.id === HUB_ID);
    const talking = base.filter((c) => c.id !== HUB_ID && c.out + c.in > 0).sort((a, b) => b.out + b.in - (a.out + a.in));
    const quiet = base.filter((c) => c.id !== HUB_ID && c.out + c.in === 0).sort((a, b) => b.validators - a.validators || a.name.localeCompare(b.name));

    const placed: Node[] = [];
    if (hub) placed.push({ ...hub, x: CX, y: CY, w: 44, h: height(hub), ring: "hub", order: 0, newRank: 0 });
    // a quarter step round keeps any talker off the hub's back (behind its roof) and front (on its name)
    talking.forEach((c, i) => {
      const [x, y] = onRing(i, talking.length, INNER, Math.PI / (2 * Math.max(1, talking.length)));
      placed.push({ ...c, x, y, w: 17, h: height(c), ring: "inner", order: i, newRank: 0 });
    });
    // the outer ring starts back left, so its tallest set does not stand behind the hub;
    // the week's arrivals take its front places, the newest at the centre, by the ledger's seam
    const arrivals = quiet.filter((c) => c.newAt !== null).sort((a, b) => b.newAt! - a.newAt!);
    const rest = quiet.filter((c) => c.newAt === null);
    const offFront = (i: number) => {
      const a = -0.42 + (i / Math.max(1, quiet.length)) * Math.PI * 2 - Math.PI;
      return Math.abs(Math.atan2(Math.sin(a), Math.cos(a)));
    };
    const front = new Map(
      [...Array(quiet.length).keys()]
        .sort((a, b) => offFront(a) - offFront(b))
        .slice(0, arrivals.length)
        .map((slot, k) => [slot, k]),
    );
    let next = 0;
    for (let i = 0; i < quiet.length; i++) {
      const k = front.get(i);
      const c = k !== undefined ? arrivals[k] : rest[next++];
      const [x, y] = onRing(i, quiet.length, OUTER, -0.42);
      placed.push({ ...c, x, y, w: 9, h: height(c), ring: "outer", order: i, newRank: k ?? 0 });
    }

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
  const near = useMemo(() => {
    if (!lit) return null;
    const s = new Set([lit]);
    for (const r of routes) if (r.from === lit || r.to === lit) s.add(r.from).add(r.to);
    return s;
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
  const talking = nodes.filter((n) => n.ring !== "outer").sort((a, b) => b.out + b.in - (a.out + a.in));
  const quiet = nodes.filter((n) => n.ring === "outer");
  const maxTalk = Math.max(1, ...talking.map((n) => n.out + n.in));
  const maxQuiet = Math.max(1, ...quiet.map((n) => n.validators));

  const tone = (n: Node): keyof typeof TONE => (pickedId === n.id ? "blue" : n.ring === "hub" ? "red" : n.newAt !== null ? "fresh" : n.ring === "outer" ? "pale" : "gray");
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
      // quiet sets are named in the roster; the plate flags only the big ones, and a new L1 has its chip
      if (n.validators < 20 || n.newAt !== null) return null;
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

  /* the quiet sets as a skyline on a ledge under the plate: the same
     towers, tallest first, each with its count on the roof and its name
     slanted under the ledge, so a screenshot names every set */
  const SKY_W = 1200;
  const SKY_H = 214;
  const LEDGE_Y = 104;
  // the roster reads tallest first, whatever places the ring gave its arrivals
  const roster = [...quiet].sort((a, b) => b.validators - a.validators || a.name.localeCompare(b.name));
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
        {roster.map((n, i) => {
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
                <Tower x={x} y={ground} w={skyW} h={h} tone={on ? "blue" : n.newAt !== null ? "fresh" : "pale"} mix={on ? null : mixOf(n.id)} />
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
                  on
                    ? "fill-[#0061E2] dark:fill-[#5f9dff]"
                    : hover === n.id
                      ? "fill-zinc-900 dark:fill-zinc-50"
                      : n.newAt !== null
                        ? "fill-[#5400FF] dark:fill-[#A48CFF]"
                        : "fill-zinc-600 dark:fill-zinc-400",
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
        {roster.map((n) => (
          <li key={n.id}>
            <button
              type="button"
              onClick={() => pick(n)}
              aria-pressed={pickedId === n.id}
              className={cn(
                "flex w-full items-center justify-between gap-2 py-0.5 text-left font-mono text-[11px]",
                pickedId === n.id ? "text-[#0061E2] dark:text-[#5f9dff]" : n.newAt !== null ? "text-[#5400FF] dark:text-[#A48CFF]" : "text-zinc-600 dark:text-zinc-400",
              )}
            >
              <span className="truncate uppercase tracking-[0.04em]">{n.name}</span>
              <span className="flex shrink-0 items-baseline gap-1.5 tabular-nums">
                <span className="text-zinc-400 dark:text-zinc-500">{n.validators}</span>
                {versions && target && (() => {
                  const pct = onPct(n.id);
                  return <span className={cn("w-8 text-right text-[10px]", pctInk(versions.get(n.id), pct))}>{pct === null ? "—" : `${pct}%`}</span>;
                })()}
              </span>
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
              {/* the rim's front arc, for the P-Chain's label */}
              <path id={`${uid}-rim`} d={`M${CX - PLATE},${CY + PLATE_T * 0.55} A${PLATE},${PLATE * TILT} 0 0 0 ${CX + PLATE},${CY + PLATE_T * 0.55}`} fill="none" />
            </defs>

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
              onClick={() => router.push("/explorer/mainnet/p-chain")}
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
              <g clipPath={`url(#${uid}-plate)`} className={cn("transition-[stroke] duration-300", ground ? "stroke-[#5400FF]/[0.15] dark:stroke-[#8B6CFF]/[0.20]" : "stroke-[#5400FF]/[0.09] dark:stroke-[#8B6CFF]/[0.12]")} strokeWidth={0.75}>
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
              <g fill="none" strokeWidth={1} strokeDasharray="3 5" className="stroke-[#5400FF]/25 dark:stroke-[#8B6CFF]/30">
                <ellipse cx={CX} cy={CY} rx={INNER} ry={INNER * TILT} />
                <ellipse cx={CX} cy={CY} rx={OUTER} ry={OUTER * TILT} />
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

            {/* towers, back to front */}
            {drawOrder.map((n) => {
              const dim = near !== null && !near.has(n.id);
              const up = hover === n.id;
              const delay = riseDelay(n);
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
                  className="cursor-pointer outline-none transition-[opacity,transform] duration-200 ease-out"
                  style={{ opacity: dim ? 0.25 : 1, transform: up ? "translateY(-4px)" : undefined }}
                >
                  {/* a footprint shadow grounds the tower on the plate */}
                  <ellipse cx={n.x + n.w * 0.35} cy={n.y + n.w * TILT * 0.4} rx={n.w * 1.25} ry={n.w * TILT * 1.1} className="fill-[#1E0B5C]/[0.09] dark:fill-black/40" />
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
                    <Tower x={n.x} y={n.y} w={n.w} h={n.h} tone={tone(n)} mix={pickedId === n.id ? null : mixOf(n.id)} roof={!painted && n.ring === "inner" && pickedId !== n.id ? n.color : null} />
                  </g>
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
                  // a packet carries its sender's color
                  const ink = blue ? null : byId.get(r.from)?.color ?? null;
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
                            style={ink ? { fill: ink } : undefined}
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
              <g key={n.id} style={glideStyle(n.id)}>
                <g className="transition-opacity duration-200" style={{ opacity: near !== null && !near.has(n.id) ? 0.2 : 1 }}>
                  {flag(n)}
                  {/* the NEW plate lies on the ground at the tower's foot, clear of the flags above */}
                  {n.newAt !== null &&
                    (() => {
                      const foot = n.y + n.w * TILT + 2;
                      return (
                        <g className="pointer-events-none" style={still ? undefined : { animation: `bh-fade 500ms ease-out ${riseDelay(n) + 700}ms backwards` }}>
                          <rect x={n.x - 12} y={foot} width={24} height={10} className="fill-[#5400FF] dark:fill-[#8B6CFF]" />
                          <text x={n.x} y={foot + 5} textAnchor="middle" dominantBaseline="central" className="fill-white font-mono text-[7.5px] font-bold tracking-[0.1em]">
                            NEW
                          </text>
                        </g>
                      );
                    })()}
                </g>
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
                style={{ left: `${(x / W) * 100}%`, top: `${((y - RING_LIFT) / H) * 100}%` }}
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
                          <span className="truncate">{a.ring === "hub" ? "C-Chain" : a.name}</span>
                          <ArrowRight className="h-3 w-3 shrink-0 text-zinc-300 dark:text-zinc-600" />
                          <Logo uri={b.logo} name={b.name} />
                          <span className="truncate">{b.ring === "hub" ? "C-Chain" : b.name}</span>
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
