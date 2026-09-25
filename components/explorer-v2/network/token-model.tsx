"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Board, SectionHeader } from "@/components/explorer-v2/ui";
import { useTween } from "@/components/explorer-v2/evm/query/motion";
import { useStill } from "@/components/explorer-v2/motion";
import { BurnBoard, IssuedBoard, SupplyBoard, TOKEN_CAP, avax, usdOf } from "./token-parts";
import { fmtBurn, type LiveBurns } from "./token-live";

/* The 720M AVAX cap as one solid, in the block tape's projection. The cap
   stands as a wireframe; inside it the supply fills floor by floor from
   the ground: staked, locked, liquid, then the AVAX not yet issued in
   glass. The burn is cut off the top and floats above the cap, to scale,
   because it left the supply for good. Every C-Chain block that arrives
   while the page is open sends its burn up as an ember into that slab.
   Beside the solid, on the same scale, stands what was issued: the
   genesis and every staking reward since, which is exactly what
   circulates plus what burned. Phones get the same parts as bars. */

const W = 1200;
const H = 610;
const TX = 610;
const GROUND = 520;
const HW = 112;
const TILT = 0.42;
const D = HW * TILT;
const CAP_H = 400;
const LIFT = 26;
const COURSE = 10_000_000;
const LABEL_X = TX + HW + 150;
/* the ruler, between the two columns */
const RX = TX - HW - 52;
/* the issued column: its center, half width and label edge */
const SX = 300;
const SHW = 58;
const SD = SHW * TILT;
const SLABEL_X = SX - SHW - 26;
/* an ember's climb, ms */
const CLIMB_MS = 2000;

type FloorKey = "staked" | "locked" | "liquid" | "unissued" | "burned";
type SourceKey = "genesis" | "rewards";

interface Floor {
  key: FloorKey;
  label: string;
  value: number;
  sub: string;
  lo: number;
  hi: number;
}

/* full static class strings so Tailwind keeps them: top, left, right */
const FACE: Record<Exclude<FloorKey, "unissued">, [string, string, string]> = {
  staked: ["fill-zinc-500 dark:fill-zinc-200", "fill-zinc-700 dark:fill-zinc-300", "fill-zinc-800 dark:fill-zinc-400"],
  locked: ["fill-zinc-300 dark:fill-zinc-500", "fill-zinc-500 dark:fill-zinc-600", "fill-zinc-600 dark:fill-zinc-700"],
  liquid: ["fill-[#DCE1E2] dark:fill-[#8C999C]", "fill-[#A2AFB2] dark:fill-[#6E7B7E]", "fill-[#7E8C8F] dark:fill-[#556164]"],
  burned: ["fill-[#F58A91]", "fill-[#E6212F]", "fill-[#A5141F]"],
};
/* the issued column reads as paper beside the solid: the record, not the stock */
const SOURCE_FACE: Record<SourceKey, [string, string, string]> = {
  genesis: ["fill-zinc-100 dark:fill-zinc-700", "fill-zinc-200 dark:fill-zinc-800", "fill-zinc-300 dark:fill-zinc-900"],
  rewards: ["fill-white dark:fill-zinc-600", "fill-zinc-50 dark:fill-zinc-700", "fill-zinc-200 dark:fill-zinc-800"],
};
const SWATCH: Record<FloorKey | SourceKey, string> = {
  staked: "bg-zinc-700 dark:bg-zinc-300",
  locked: "bg-zinc-500 dark:bg-zinc-600",
  liquid: "bg-[#A2AFB2]",
  unissued: "border border-dashed border-zinc-400 dark:border-zinc-600",
  burned: "bg-[#E6212F]",
  genesis: "border border-zinc-300 bg-zinc-200 dark:border-zinc-600 dark:bg-zinc-800",
  rewards: "border border-zinc-300 bg-white dark:border-zinc-600 dark:bg-zinc-700",
};

const pts = (p: [number, number][]) => p.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");

/* one floor of a solid centered at cx, from lo to hi pixels above the ground */
function Slab({ cx = TX, hw = HW, lo, hi, faces, courses }: { cx?: number; hw?: number; lo: number; hi: number; faces: [string, string, string]; courses: number }) {
  const x = cx;
  const y = GROUND;
  const d = hw * TILT;
  const step = (hi - lo) / Math.max(1, courses);
  return (
    <g strokeLinejoin="round" className="stroke-black/25 dark:stroke-black/40" strokeWidth={0.75}>
      <polygon points={pts([[x - hw, y - lo], [x, y + d - lo], [x, y + d - hi], [x - hw, y - hi]])} className={faces[1]} />
      <polygon points={pts([[x, y + d - lo], [x + hw, y - lo], [x + hw, y - hi], [x, y + d - hi]])} className={faces[2]} />
      {courses > 1 && (
        <path
          d={Array.from({ length: courses - 1 }, (_, k) => {
            const o = lo + (k + 1) * step;
            return `M${x - hw},${(y - o).toFixed(1)} L${x},${(y + d - o).toFixed(1)} L${x + hw},${(y - o).toFixed(1)}`;
          }).join(" ")}
          fill="none"
          className="stroke-black/10 dark:stroke-black/25"
        />
      )}
      <polygon points={pts([[x, y - hi - d], [x + hw, y - hi], [x, y - hi + d], [x - hw, y - hi]])} className={faces[0]} />
    </g>
  );
}

/* the plinth a column stands on: a margin around its footprint, and an edge */
function Plinth({ cx, hw }: { cx: number; hw: number }) {
  const r = hw + (hw > 80 ? 70 : 34);
  const dr = r * TILT;
  const edge = hw > 80 ? 12 : 9;
  return (
    <g strokeWidth={1}>
      <polygon points={pts([[cx, GROUND - dr], [cx + r, GROUND], [cx, GROUND + dr], [cx - r, GROUND]])} className="fill-zinc-50 stroke-zinc-300 dark:fill-zinc-900 dark:stroke-zinc-700" />
      <polygon points={pts([[cx - r, GROUND], [cx, GROUND + dr], [cx, GROUND + dr + edge], [cx - r, GROUND + edge]])} className="fill-zinc-200 stroke-zinc-300 dark:fill-zinc-800 dark:stroke-zinc-700" />
      <polygon points={pts([[cx, GROUND + dr], [cx + r, GROUND], [cx + r, GROUND + edge], [cx, GROUND + dr + edge]])} className="fill-zinc-300 stroke-zinc-300 dark:fill-zinc-700 dark:stroke-zinc-700" />
    </g>
  );
}

/** a steady scatter for an ember, from its block number: same block, same spot */
function scatter(n: number): [number, number] {
  const a = Math.sin(n * 12.9898) * 43758.5453;
  const b = Math.sin(n * 78.233) * 12345.6789;
  const u = a - Math.floor(a) - 0.5;
  const v = b - Math.floor(b) - 0.5;
  // inside the top face's rhombus, kept off its edges
  const dx = u * HW * 1.1;
  const dy = v * D * (1 - Math.abs(dx) / HW) * 1.1;
  return [dx, dy];
}

export function SupplyModel({
  circulating,
  staked,
  locked,
  burned,
  burnedBy,
  genesis,
  rewards,
  price,
  live,
}: {
  circulating: number;
  staked: number;
  locked: number;
  burned: number;
  burnedBy: { c: number; p: number; x: number };
  genesis: number;
  rewards: number;
  price: number;
  live: LiveBurns;
}) {
  const still = useStill();
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const [hover, setHover] = useState<FloorKey | SourceKey | null>(null);
  const k = CAP_H / TOKEN_CAP;
  const supply = TOKEN_CAP - burned;
  const issued = genesis + rewards;
  const sinceOpen = useTween(live.sum, 900) ?? 0;

  const floors = useMemo<Floor[]>(() => {
    const pct = (v: number) => `${((v / TOKEN_CAP) * 100).toFixed(1)}% of cap`;
    const usd = (v: number) => (usdOf(v, price) ? ` · ${usdOf(v, price)}` : "");
    const liquid = Math.max(0, circulating - staked - locked);
    const unissued = Math.max(0, supply - circulating);
    const parts: Omit<Floor, "lo" | "hi">[] = [
      { key: "staked", label: "Staked", value: staked, sub: `${pct(staked)}${usd(staked)}` },
      { key: "locked", label: "Locked", value: locked, sub: `${pct(locked)}${usd(locked)}` },
      { key: "liquid", label: "Liquid", value: liquid, sub: `${pct(liquid)}${usd(liquid)}` },
      { key: "unissued", label: "Not yet issued", value: unissued, sub: `${pct(unissued)} · staking rewards still to mint` },
    ];
    let at = 0;
    const out: Floor[] = parts.map((p) => {
      const lo = at;
      at += p.value * k;
      return { ...p, lo, hi: at };
    });
    // the burn sits where it was cut from, lifted clear of the cap; drawn to scale, with a floor of 3px to be seen
    const bLo = supply * k + LIFT;
    out.push({
      key: "burned",
      label: "Burned",
      value: burned,
      sub: `C ${avax(burnedBy.c)} · X ${avax(burnedBy.x)} · P ${avax(burnedBy.p)}`,
      lo: bLo,
      hi: bLo + Math.max(3, burned * k),
    });
    return out;
  }, [circulating, staked, locked, burned, burnedBy, price, supply, k]);

  /* labels on the right at each floor's middle, pushed apart so none overlap */
  const labels = useMemo(() => {
    const MIN = 50;
    const placed = floors
      .map((f) => ({ f, y: GROUND - (f.lo + f.hi) / 2, anchor: GROUND - (f.lo + f.hi) / 2 }))
      .sort((a, b) => a.y - b.y);
    // the burn's label carries a fourth line, the live one
    for (let i = 1; i < placed.length; i++) {
      const need = placed[i - 1].f.key === "burned" ? MIN + 18 : MIN;
      if (placed[i].y - placed[i - 1].y < need) placed[i].y = placed[i - 1].y + need;
    }
    const over = placed.length ? placed[placed.length - 1].y - (GROUND + 10) : 0;
    if (over > 0) for (const p of placed) p.y -= over;
    return placed;
  }, [floors]);

  const cut = GROUND - supply * k;
  const circTop = GROUND - circulating * k;
  const capTop = GROUND - CAP_H - LIFT;
  const burnFloor = floors.find((f) => f.key === "burned");
  const dim = (key: FloorKey | SourceKey) => hover !== null && hover !== key;

  // the embers: blocks that arrived after the page opened, the newest few
  const embers = useMemo(() => live.blocks.filter((b) => b.fresh).slice(0, 10), [live.blocks]);
  const peakEmber = Math.max(1e-9, ...live.blocks.map((b) => b.burned));
  const landed = embers[0];

  // the issued column: genesis, then every staking reward since
  const src = [
    { key: "genesis" as const, label: "Genesis", value: genesis, sub: `${((genesis / TOKEN_CAP) * 100).toFixed(0)}% of cap · at launch`, lo: 0, hi: genesis * k },
    { key: "rewards" as const, label: "Staking rewards", value: rewards, sub: "minted since launch", lo: genesis * k, hi: issued * k },
  ];
  const srcTop = GROUND - issued * k;

  // embers fly only while the solid is on screen, so none pile up off it
  const svgRef = useRef<SVGSVGElement>(null);
  const [inView, setInView] = useState(true);
  useEffect(() => {
    const el = svgRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <section className="flex flex-col gap-4">
      {/* phones read the bar's own header */}
      <div className="hidden lg:block">
        <SectionHeader
          label="Supply"
          action={<span className="font-mono text-[10px] tabular-nums tracking-[0.08em] text-zinc-400 dark:text-zinc-500">of the 720M AVAX cap</span>}
        />
      </div>
      {/* desktops: the solid */}
      <Board divide={false} className="hidden border lg:block">
        <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label="The AVAX supply as floors of the 720M cap, beside the AVAX issued" onMouseLeave={() => setHover(null)}>
          {!still && (
            <style>{`@keyframes ${uid}rise{from{transform:scaleY(0.02)}to{transform:scaleY(1)}}@keyframes ${uid}float{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}@keyframes ${uid}drop{from{opacity:0;transform:translateY(-30px)}to{opacity:1;transform:translateY(0)}}`}</style>
          )}
          <defs>
            <linearGradient id={`${uid}trail`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor="#E6212F" stopOpacity="0.9" />
              <stop offset="1" stopColor="#E6212F" stopOpacity="0" />
            </linearGradient>
          </defs>

          <Plinth cx={SX} hw={SHW} />
          <Plinth cx={TX} hw={HW} />

          {/* the ruler, between the columns: the cap in 100M steps */}
          <g className="font-mono text-[10px] tabular-nums">
            {Array.from({ length: 8 }, (_, i) => i * 100_000_000)
              .concat(TOKEN_CAP)
              .map((v) => {
                const y = GROUND - v * k - (v === TOKEN_CAP ? LIFT : 0);
                return (
                  <g key={v}>
                    <line x1={RX} x2={RX + 8} y1={y} y2={y} className="stroke-zinc-300 dark:stroke-zinc-700" strokeWidth={1} />
                    <text x={RX - 6} y={y} textAnchor="end" dominantBaseline="central" className={v === TOKEN_CAP ? "fill-zinc-700 dark:fill-zinc-200" : "fill-zinc-400 dark:fill-zinc-500"}>
                      {v === 0 ? "0" : v === TOKEN_CAP ? "720M cap" : `${v / 1_000_000}M`}
                    </text>
                  </g>
                );
              })}
            <line x1={RX + 4} x2={RX + 4} y1={GROUND} y2={capTop} className="stroke-zinc-300 dark:stroke-zinc-700" strokeWidth={1} />
          </g>

          {/* what was issued, on the same scale: it reaches the solid's circulating top plus the burn */}
          <g style={still ? undefined : { transformOrigin: `${SX}px ${GROUND}px`, animation: `${uid}rise 1100ms cubic-bezier(0.32,0.72,0,1) 120ms both` }}>
            {src.map((f) => (
              <g key={f.key} onMouseEnter={() => setHover(f.key)} className="transition-opacity duration-200" style={{ opacity: dim(f.key) ? 0.3 : 1 }}>
                <Slab cx={SX} hw={SHW} lo={f.lo} hi={f.hi} faces={SOURCE_FACE[f.key]} courses={Math.round(f.value / COURSE)} />
              </g>
            ))}
          </g>
          {/* the level they share: issued is circulating plus burned */}
          <line x1={SX + SHW + 6} x2={TX - HW - 6} y1={srcTop} y2={srcTop} strokeDasharray="2 4" strokeWidth={1} className="stroke-zinc-400 dark:stroke-zinc-500" />
          <g className="font-mono" textAnchor="middle">
            <text x={SX} y={srcTop - SD - 34} className="fill-zinc-500 text-[10px] font-bold uppercase tracking-[0.16em] dark:fill-zinc-400">
              Issued
            </text>
            <text x={SX} y={srcTop - SD - 14} className="fill-zinc-900 text-[18px] tabular-nums dark:fill-zinc-50">
              {avax(issued)}
              <tspan className="fill-zinc-400 text-[11px] dark:fill-zinc-500"> AVAX</tspan>
            </text>
          </g>
          {src.map((f) => {
            const ay = GROUND - (f.lo + f.hi) / 2;
            return (
              <g key={f.key} onMouseEnter={() => setHover(f.key)} className="cursor-default transition-opacity duration-200" style={{ opacity: dim(f.key) ? 0.3 : 1 }}>
                <polyline points={pts([[SX - SHW - 6, ay], [SLABEL_X + 10, ay]])} fill="none" strokeWidth={1} className="stroke-zinc-300 dark:stroke-zinc-700" />
                <circle cx={SX - SHW - 6} cy={ay} r={2} className="fill-zinc-400 dark:fill-zinc-500" />
                <text x={SLABEL_X} y={ay - 18} textAnchor="end" dominantBaseline="central" className="fill-zinc-500 font-mono text-[10px] font-bold uppercase tracking-[0.16em] dark:fill-zinc-400">
                  {f.label}
                </text>
                <text x={SLABEL_X} y={ay} textAnchor="end" dominantBaseline="central" className="fill-zinc-900 font-mono text-[18px] tabular-nums dark:fill-zinc-50">
                  {avax(f.value)}
                  <tspan className="fill-zinc-400 text-[11px] dark:fill-zinc-500"> AVAX</tspan>
                </text>
                <text x={SLABEL_X} y={ay + 18} textAnchor="end" dominantBaseline="central" className="fill-zinc-400 font-mono text-[10px] tabular-nums dark:fill-zinc-500">
                  {f.sub}
                </text>
              </g>
            );
          })}

          {/* the solid, floor by floor */}
          <g style={still ? undefined : { transformOrigin: `${TX}px ${GROUND}px`, animation: `${uid}rise 1100ms cubic-bezier(0.32,0.72,0,1) both` }}>
            {floors
              .filter((f) => f.key !== "burned" && f.key !== "unissued")
              .map((f) => (
                <g key={f.key} onMouseEnter={() => setHover(f.key)} className="transition-opacity duration-200" style={{ opacity: dim(f.key) ? 0.3 : 1 }}>
                  <Slab lo={f.lo} hi={f.hi} faces={FACE[f.key as Exclude<FloorKey, "unissued">]} courses={Math.round(f.value / COURSE)} />
                </g>
              ))}
          </g>

          {/* not yet issued: glass, up to where the burn was cut */}
          {(() => {
            const f = floors.find((x) => x.key === "unissued");
            if (!f) return null;
            const x = TX;
            const y = GROUND;
            return (
              <g onMouseEnter={() => setHover("unissued")} className="transition-opacity duration-200" style={{ opacity: dim("unissued") ? 0.3 : 1 }} fill="currentColor">
                <g className="text-zinc-400/[0.07] dark:text-zinc-300/[0.06]">
                  <polygon points={pts([[x - HW, y - f.lo], [x, y + D - f.lo], [x, y + D - f.hi], [x - HW, y - f.hi]])} />
                  <polygon points={pts([[x, y + D - f.lo], [x + HW, y - f.lo], [x + HW, y - f.hi], [x, y + D - f.hi]])} />
                  <polygon points={pts([[x, y - f.hi - D], [x + HW, y - f.hi], [x, y - f.hi + D], [x - HW, y - f.hi]])} />
                </g>
                <g fill="none" strokeDasharray="3 4" strokeWidth={1} className="stroke-zinc-400 dark:stroke-zinc-600">
                  <polyline points={pts([[x - HW, y - f.lo], [x - HW, y - f.hi], [x, y - f.hi - D], [x + HW, y - f.hi], [x + HW, y - f.lo]])} />
                  <polyline points={pts([[x - HW, y - f.hi], [x, y - f.hi + D], [x + HW, y - f.hi]])} />
                  <line x1={x} x2={x} y1={y + D - f.lo} y2={y + D - f.hi} />
                </g>
              </g>
            );
          })()}

          {/* the cap's outline where the burn left it */}
          <g fill="none" strokeDasharray="2 4" strokeWidth={1} className="stroke-[#E6212F]/50">
            <polyline points={pts([[TX - HW, cut], [TX, cut - D], [TX + HW, cut]])} />
            <polyline points={pts([[TX - HW, cut], [TX, cut + D], [TX + HW, cut]])} />
          </g>

          {/* the embers: each block's burn leaves the liquid and climbs into the slab */}
          {!still && inView && burnFloor && (
            <g className="pointer-events-none">
              {embers.map((b) => {
                const [dx, dy] = scatter(b.number);
                const r = 2.2 + 4 * Math.sqrt(Math.min(1, b.burned / peakEmber));
                const x = TX + dx;
                const y = circTop + dy;
                const climb = GROUND - burnFloor.lo + dy - y;
                return (
                  <g key={b.number} style={{ ["--climb" as string]: `${climb}px`, animation: `bh-climb ${CLIMB_MS}ms cubic-bezier(0.45,0,0.2,1) ${b.lane * 420}ms both` }}>
                    <rect x={x - 0.75} y={y} width={1.5} height={22} fill={`url(#${uid}trail)`} />
                    <polygon points={pts([[x, y - r * TILT * 1.6], [x + r, y], [x, y + r * TILT * 1.6], [x - r, y]])} className="fill-[#E6212F]" />
                  </g>
                );
              })}
            </g>
          )}

          {/* the burn, cut off and floating */}
          {burnFloor && (
            <g style={still ? undefined : { animation: `${uid}drop 700ms cubic-bezier(0.32,0.72,0,1) 900ms both` }}>
              <g
                onMouseEnter={() => setHover("burned")}
                className="transition-opacity duration-200"
                style={{ opacity: dim("burned") ? 0.3 : 1, animation: still ? undefined : `${uid}float 4.5s ease-in-out 1.6s infinite` }}
              >
                <Slab lo={burnFloor.lo} hi={burnFloor.hi} faces={FACE.burned} courses={0} />
                {/* the slab flashes as the newest ember lands */}
                {!still && landed && (
                  <polygon
                    key={landed.number}
                    points={pts([[TX, GROUND - burnFloor.hi - D], [TX + HW, GROUND - burnFloor.hi], [TX, GROUND - burnFloor.hi + D], [TX - HW, GROUND - burnFloor.hi]])}
                    className="pointer-events-none fill-white"
                    // invisible until the ember lands, then one flash; fill forwards, never backwards
                    style={{ opacity: 0, animation: `bh-flash 700ms ease-out ${CLIMB_MS - 250 + landed.lane * 420}ms forwards` }}
                  />
                )}
              </g>
            </g>
          )}

          {/* each floor names itself on the right */}
          {labels.map(({ f, y, anchor }) => {
            const edgeX = TX + HW;
            const isBurn = f.key === "burned";
            return (
              <g key={f.key} onMouseEnter={() => setHover(f.key)} className="cursor-default transition-opacity duration-200" style={{ opacity: dim(f.key) ? 0.3 : 1 }}>
                <polyline points={pts([[edgeX + 6, anchor], [LABEL_X - 60, anchor], [LABEL_X - 14, y]])} fill="none" strokeWidth={1} className={isBurn ? "stroke-[#E6212F]/60" : "stroke-zinc-300 dark:stroke-zinc-700"} />
                <circle cx={edgeX + 6} cy={anchor} r={2} className={isBurn ? "fill-[#E6212F]" : "fill-zinc-400 dark:fill-zinc-500"} />
                {isBurn && !still && (
                  <circle cx={LABEL_X + 76} cy={y - 14} r={2.5} className="fill-[#E6212F]">
                    <animate attributeName="opacity" values="1;0.25;1" dur="1.6s" repeatCount="indefinite" />
                  </circle>
                )}
                <text x={LABEL_X} y={y - 14} dominantBaseline="central" className={cn("font-mono text-[10px] font-bold uppercase tracking-[0.16em]", isBurn ? "fill-[#E6212F]" : "fill-zinc-500 dark:fill-zinc-400")}>
                  {f.label}
                </text>
                <text x={LABEL_X} y={y + 4} dominantBaseline="central" className="fill-zinc-900 font-mono text-[18px] tabular-nums dark:fill-zinc-50">
                  {avax(f.value)}
                  <tspan className="fill-zinc-400 text-[11px] dark:fill-zinc-500"> AVAX</tspan>
                </text>
                <text x={LABEL_X} y={y + 22} dominantBaseline="central" className="fill-zinc-400 font-mono text-[10px] tabular-nums dark:fill-zinc-500">
                  {f.sub}
                </text>
                {isBurn && (
                  <text x={LABEL_X} y={y + 40} dominantBaseline="central" className="fill-[#E6212F] font-mono text-[10px] tabular-nums">
                    {live.count ? `+${fmtBurn(sinceOpen)} AVAX since you opened this page` : "each new block's burn rises into it"}
                  </text>
                )}
              </g>
            );
          })}

          {/* the key, bottom left */}
          <text x={24} y={H - 16} className="fill-zinc-400 font-mono text-[10px] uppercase tracking-[0.12em] dark:fill-zinc-500">
            {`Issued ${avax(issued)} = circulating ${avax(circulating)} + burned ${avax(burned)} · total supply ${avax(supply)} · burn to scale, lifted off the cap`}
          </text>
        </svg>
        <div className="flex flex-wrap gap-x-5 gap-y-1 border-t border-zinc-200 px-5 py-2.5 font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-400 md:px-6 dark:border-zinc-800 dark:text-zinc-500">
          {[...src.map((f) => ({ key: f.key, label: f.label })), ...floors.map((f) => ({ key: f.key, label: f.label }))].map((f) => (
            <span key={f.key} className="flex items-center gap-1.5">
              <span className={cn("h-2 w-2", SWATCH[f.key])} />
              {f.label}
            </span>
          ))}
        </div>
      </Board>
      {/* phones and tablets: the same parts, as bars */}
      <div className="flex flex-col gap-8 lg:hidden">
        <SupplyBoard circulating={circulating} staked={staked} locked={locked} burned={burned} />
        <IssuedBoard genesis={genesis} rewards={rewards} circulating={circulating} burned={burned} />
        <BurnBoard c={burnedBy.c} p={burnedBy.p} x={burnedBy.x} sinceOpen={live.count ? live.sum : null} />
      </div>
    </section>
  );
}
