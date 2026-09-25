"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { Board, SectionHeader } from "@/components/explorer-v2/ui";
import { BurnBoard, SupplyBoard, TOKEN_CAP, avax, usdOf } from "./token-parts";

/* The 720M AVAX cap as one solid, in the block tape's projection. The cap
   stands as a wireframe; inside it the supply fills floor by floor from
   the ground: staked, locked, liquid, then the not yet circulating in
   glass. The burn is cut off the top and floats above the cap, to scale,
   because it left the supply for good. Each floor names itself on the
   right; the ruler on the left reads the cap in 100M steps. Phones get the
   same parts as the bar and the burn list. */

const W = 1200;
const H = 560;
const TX = 470;
const GROUND = 500;
const HW = 112;
const TILT = 0.42;
const D = HW * TILT;
const CAP_H = 400;
const LIFT = 26;
const COURSE = 10_000_000;
const LABEL_X = TX + HW + 170;

type FloorKey = "staked" | "locked" | "liquid" | "unissued" | "burned";

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
const SWATCH: Record<FloorKey, string> = {
  staked: "bg-zinc-700 dark:bg-zinc-300",
  locked: "bg-zinc-500 dark:bg-zinc-600",
  liquid: "bg-[#A2AFB2]",
  unissued: "border border-dashed border-zinc-400 dark:border-zinc-600",
  burned: "bg-[#E6212F]",
};

const pts = (p: [number, number][]) => p.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");

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

/* one floor of the solid, from lo to hi pixels above the ground */
function Slab({ lo, hi, faces, courses }: { lo: number; hi: number; faces: [string, string, string]; courses: number }) {
  const x = TX;
  const y = GROUND;
  const step = (hi - lo) / Math.max(1, courses);
  return (
    <g strokeLinejoin="round" className="stroke-black/25 dark:stroke-black/40" strokeWidth={0.75}>
      <polygon points={pts([[x - HW, y - lo], [x, y + D - lo], [x, y + D - hi], [x - HW, y - hi]])} className={faces[1]} />
      <polygon points={pts([[x, y + D - lo], [x + HW, y - lo], [x + HW, y - hi], [x, y + D - hi]])} className={faces[2]} />
      {courses > 1 && (
        <path
          d={Array.from({ length: courses - 1 }, (_, k) => {
            const o = lo + (k + 1) * step;
            return `M${x - HW},${(y - o).toFixed(1)} L${x},${(y + D - o).toFixed(1)} L${x + HW},${(y - o).toFixed(1)}`;
          }).join(" ")}
          fill="none"
          className="stroke-black/10 dark:stroke-black/25"
        />
      )}
      <polygon points={pts([[x, y - hi - D], [x + HW, y - hi], [x, y - hi + D], [x - HW, y - hi]])} className={faces[0]} />
    </g>
  );
}

export function SupplyModel({
  circulating,
  staked,
  locked,
  burned,
  burnedBy,
  price,
}: {
  circulating: number;
  staked: number;
  locked: number;
  burned: number;
  burnedBy: { c: number; p: number; x: number };
  price: number;
}) {
  const still = useStill();
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const [hover, setHover] = useState<FloorKey | null>(null);
  const k = CAP_H / TOKEN_CAP;
  const supply = TOKEN_CAP - burned;

  const floors = useMemo<Floor[]>(() => {
    const pct = (v: number) => `${((v / TOKEN_CAP) * 100).toFixed(1)}% of cap`;
    const usd = (v: number) => (usdOf(v, price) ? ` · ${usdOf(v, price)}` : "");
    const liquid = Math.max(0, circulating - staked - locked);
    const unissued = Math.max(0, supply - circulating);
    const parts: Omit<Floor, "lo" | "hi">[] = [
      { key: "staked", label: "Staked", value: staked, sub: `${pct(staked)}${usd(staked)}` },
      { key: "locked", label: "Locked", value: locked, sub: `${pct(locked)}${usd(locked)}` },
      { key: "liquid", label: "Liquid", value: liquid, sub: `${pct(liquid)}${usd(liquid)}` },
      { key: "unissued", label: "Not circulating", value: unissued, sub: `${pct(unissued)} · rewards and unlocks to come` },
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
    for (let i = 1; i < placed.length; i++) if (placed[i].y - placed[i - 1].y < MIN) placed[i].y = placed[i - 1].y + MIN;
    const over = placed.length ? placed[placed.length - 1].y - (GROUND + 10) : 0;
    if (over > 0) for (const p of placed) p.y -= over;
    return placed;
  }, [floors]);

  const cut = GROUND - supply * k;
  const capTop = GROUND - CAP_H - LIFT;
  const dim = (key: FloorKey) => hover !== null && hover !== key;

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
        <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label="The AVAX supply as floors of the 720M cap" onMouseLeave={() => setHover(null)}>
          {!still && (
            <style>{`@keyframes ${uid}rise{from{transform:scaleY(0.02)}to{transform:scaleY(1)}}@keyframes ${uid}float{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}@keyframes ${uid}drop{from{opacity:0;transform:translateY(-30px)}to{opacity:1;transform:translateY(0)}}`}</style>
          )}

          {/* the plinth */}
          <polygon
            points={pts([[TX, GROUND - D - 30], [TX + HW + 70, GROUND], [TX, GROUND + D + 30], [TX - HW - 70, GROUND]])}
            className="fill-zinc-50 stroke-zinc-300 dark:fill-zinc-900 dark:stroke-zinc-700"
            strokeWidth={1}
          />
          <polygon
            points={pts([[TX - HW - 70, GROUND], [TX, GROUND + D + 30], [TX, GROUND + D + 42], [TX - HW - 70, GROUND + 12]])}
            className="fill-zinc-200 stroke-zinc-300 dark:fill-zinc-800 dark:stroke-zinc-700"
            strokeWidth={1}
          />
          <polygon
            points={pts([[TX, GROUND + D + 30], [TX + HW + 70, GROUND], [TX + HW + 70, GROUND + 12], [TX, GROUND + D + 42]])}
            className="fill-zinc-300 stroke-zinc-300 dark:fill-zinc-700 dark:stroke-zinc-700"
            strokeWidth={1}
          />

          {/* the ruler: the cap in 100M steps */}
          <g className="font-mono text-[10px] tabular-nums">
            {Array.from({ length: 8 }, (_, i) => i * 100_000_000)
              .concat(TOKEN_CAP)
              .map((v) => {
                const y = GROUND - v * k - (v === TOKEN_CAP ? LIFT : 0);
                const x = TX - HW - 46;
                return (
                  <g key={v}>
                    <line x1={x} x2={x + 8} y1={y} y2={y} className="stroke-zinc-300 dark:stroke-zinc-700" strokeWidth={1} />
                    <text x={x - 6} y={y} textAnchor="end" dominantBaseline="central" className={v === TOKEN_CAP ? "fill-zinc-700 dark:fill-zinc-200" : "fill-zinc-400 dark:fill-zinc-500"}>
                      {v === 0 ? "0" : v === TOKEN_CAP ? "720M cap" : `${v / 1_000_000}M`}
                    </text>
                  </g>
                );
              })}
            <line x1={TX - HW - 42} x2={TX - HW - 42} y1={GROUND} y2={capTop} className="stroke-zinc-300 dark:stroke-zinc-700" strokeWidth={1} />
          </g>

          {/* the solid, floor by floor */}
          <g style={still ? undefined : { transformOrigin: `${TX}px ${GROUND}px`, animation: `${uid}rise 1100ms cubic-bezier(0.32,0.72,0,1) both` }}>
            {floors
              .filter((f) => f.key !== "burned" && f.key !== "unissued")
              .map((f) => (
                <g
                  key={f.key}
                  onMouseEnter={() => setHover(f.key)}
                  className="transition-opacity duration-200"
                  style={{ opacity: dim(f.key) ? 0.3 : 1 }}
                >
                  <Slab lo={f.lo} hi={f.hi} faces={FACE[f.key as Exclude<FloorKey, "unissued">]} courses={Math.round(f.value / COURSE)} />
                </g>
              ))}
          </g>

          {/* not yet circulating: glass, up to where the burn was cut */}
          {(() => {
            const f = floors.find((x) => x.key === "unissued");
            if (!f) return null;
            const x = TX;
            const y = GROUND;
            return (
              <g
                onMouseEnter={() => setHover("unissued")}
                className="transition-opacity duration-200"
                style={{ opacity: dim("unissued") ? 0.3 : 1 }}
                fill="currentColor"
              >
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

          {/* the burn, cut off and floating */}
          {(() => {
            const f = floors.find((x) => x.key === "burned");
            if (!f) return null;
            return (
              <g style={still ? undefined : { animation: `${uid}drop 700ms cubic-bezier(0.32,0.72,0,1) 900ms both` }}>
                <g
                  onMouseEnter={() => setHover("burned")}
                  className="transition-opacity duration-200"
                  style={{ opacity: dim("burned") ? 0.3 : 1, animation: still ? undefined : `${uid}float 4.5s ease-in-out 1.6s infinite` }}
                >
                  <Slab lo={f.lo} hi={f.hi} faces={FACE.burned} courses={0} />
                </g>
              </g>
            );
          })()}

          {/* each floor names itself on the right */}
          {labels.map(({ f, y, anchor }) => {
            const edgeX = TX + HW;
            const ay = anchor - (f.key === "burned" ? 0 : 0);
            return (
              <g
                key={f.key}
                onMouseEnter={() => setHover(f.key)}
                className="cursor-default transition-opacity duration-200"
                style={{ opacity: dim(f.key) ? 0.3 : 1 }}
              >
                <polyline
                  points={pts([[edgeX + 6, ay], [LABEL_X - 60, ay], [LABEL_X - 14, y]])}
                  fill="none"
                  strokeWidth={1}
                  className={f.key === "burned" ? "stroke-[#E6212F]/60" : "stroke-zinc-300 dark:stroke-zinc-700"}
                />
                <circle cx={edgeX + 6} cy={ay} r={2} className={f.key === "burned" ? "fill-[#E6212F]" : "fill-zinc-400 dark:fill-zinc-500"} />
                <text x={LABEL_X} y={y - 14} dominantBaseline="central" className={cn("font-mono text-[10px] font-bold uppercase tracking-[0.16em]", f.key === "burned" ? "fill-[#E6212F]" : "fill-zinc-500 dark:fill-zinc-400")}>
                  {f.label}
                </text>
                <text x={LABEL_X} y={y + 4} dominantBaseline="central" className="fill-zinc-900 font-mono text-[18px] tabular-nums dark:fill-zinc-50">
                  {avax(f.value)}
                  <tspan className="fill-zinc-400 text-[11px] dark:fill-zinc-500"> AVAX</tspan>
                </text>
                <text x={LABEL_X} y={y + 22} dominantBaseline="central" className="fill-zinc-400 font-mono text-[10px] tabular-nums dark:fill-zinc-500">
                  {f.sub}
                </text>
              </g>
            );
          })}

          {/* the key, bottom left */}
          <g className="font-mono text-[10px] uppercase tracking-[0.12em]">
            <text x={24} y={H - 18} className="fill-zinc-400 dark:fill-zinc-500">
              {`Total supply ${avax(supply)} · circulating ${avax(circulating)} · burn to scale, lifted off the cap`}
            </text>
          </g>
        </svg>
        <div className="flex flex-wrap gap-x-5 gap-y-1 border-t border-zinc-200 px-5 py-2.5 font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-400 md:px-6 dark:border-zinc-800 dark:text-zinc-500">
          {floors.map((f) => (
            <span key={f.key} className="flex items-center gap-1.5">
              <span className={cn("h-2 w-2", SWATCH[f.key])} />
              {f.label}
            </span>
          ))}
        </div>
      </Board>
      {/* phones and tablets: the same parts, as the bar and the burn by chain */}
      <div className="flex flex-col gap-8 lg:hidden">
        <SupplyBoard circulating={circulating} staked={staked} locked={locked} burned={burned} />
        <BurnBoard c={burnedBy.c} p={burnedBy.p} x={burnedBy.x} />
      </div>
    </section>
  );
}
