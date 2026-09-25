"use client";

import React, { useEffect, useId, useRef } from "react";
import { useReducedMotion } from "framer-motion";
import type { PillarSlug } from "@/components/landing-v2/pillars";

/* ------------------------------------------------------------------ */
/* Photo overlays: each pillar's drawing, surveyed onto its photograph  */
/*                                                                      */
/* The drawing is traced from the landscape itself, so it reads as part */
/* of the scene: messages run as light down the real river channels,    */
/* finality climbs the real arete, validators stand on the ridgetops    */
/* above the fog. Each SVG shares its photo's 1600x2000 pixel space and */
/* the plate is always 4:5, so every coordinate lands on its feature at */
/* any size. Hairlines use non-scaling strokes (always 1px); the red    */
/* comets scale with the plate and carry a blurred twin for glow. SMIL  */
/* keeps them running without JS and hydration-safe. Path strings are   */
/* built once at module load from literal waypoints, so server and      */
/* client produce the same markup.                                      */
/* ------------------------------------------------------------------ */

type Pt = [number, number];

/** Catmull-Rom through the waypoints, as a cubic Bezier path. */
function smooth(pts: Pt[]): string {
  const f = (n: number) => n.toFixed(1);
  let d = `M${f(pts[0][0])},${f(pts[0][1])}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1: Pt = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2: Pt = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${f(c1[0])},${f(c1[1])} ${f(c2[0])},${f(c2[1])} ${f(p2[0])},${f(p2[1])}`;
  }
  return d;
}

const rev = (pts: Pt[]): Pt[] => [...pts].reverse();

const RED = "#E6212F";
const LABEL = { fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", letterSpacing: 5 } as const;

// each overlay renders twice (phone plate and pinned stage), so the glow
// filter needs an id unique to its instance
const GlowContext = React.createContext("glow");
const useGlow = () => `url(#${React.useContext(GlowContext)})`;

function Frame({ label, children }: { label: string; children: React.ReactNode }) {
  const glowId = `glow-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const ref = useRef<SVGSVGElement>(null);
  const reducedMotion = useReducedMotion();
  useEffect(() => {
    // SMIL ignores prefers-reduced-motion; hold the scene on a frame where
    // the light is mid-route, so the still still tells the story
    const svg = ref.current;
    if (!svg || !reducedMotion) return;
    svg.setCurrentTime(1.4);
    svg.pauseAnimations();
    return () => svg.unpauseAnimations();
  }, [reducedMotion]);
  return (
    <svg ref={ref} viewBox="0 0 1600 2000" className="absolute inset-0 h-full w-full select-none" role="img" aria-label={label}>
      <defs>
        <filter id={glowId} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="9" />
        </filter>
      </defs>
      <GlowContext.Provider value={glowId}>{children}</GlowContext.Provider>
    </svg>
  );
}

/** A surveyed route: the faint line it follows. */
function Route({ d, dashed = false }: { d: string; dashed?: boolean }) {
  return (
    <path
      d={d}
      fill="none"
      stroke="white"
      strokeOpacity={0.38}
      strokeWidth={1}
      strokeDasharray={dashed ? "3 5" : undefined}
      vectorEffect="non-scaling-stroke"
    />
  );
}

/** A red comet running the route: dash offset sweeps the path's length. */
function Comet({
  d,
  dur,
  begin = 0,
  travel = 0.7,
  length = 70,
  width = 7,
}: {
  d: string;
  dur: number;
  begin?: number;
  /** share of the cycle spent travelling; the rest it is gone */
  travel?: number;
  length?: number;
  width?: number;
}) {
  const glow = useGlow();
  const anim = (
    <animate
      attributeName="stroke-dashoffset"
      values={`${length};-1000;-1000`}
      keyTimes={`0;${travel};1`}
      dur={`${dur}s`}
      begin={`${begin}s`}
      repeatCount="indefinite"
    />
  );
  const common = {
    d,
    fill: "none",
    pathLength: 1000,
    strokeDasharray: `${length} 2000`,
    strokeDashoffset: length,
    strokeLinecap: "round" as const,
  };
  return (
    <g>
      <path {...common} stroke={RED} strokeWidth={width * 3.2} opacity={0.55} filter={glow}>
        {anim}
      </path>
      <path {...common} stroke="#ff8a92" strokeWidth={width}>
        {anim}
      </path>
    </g>
  );
}

/** A node on the landscape: hairline boundary, red core, a slow ping. */
function Node({ x, y, boundary = "open" }: { x: number; y: number; boundary?: "open" | "dashed" | "sealed" }) {
  const glow = useGlow();
  return (
    <g>
      <circle cx={x} cy={y} r={26} fill="rgba(9,9,11,0.55)" stroke="white" strokeWidth={1.25} vectorEffect="non-scaling-stroke" />
      <circle cx={x} cy={y} r={8} fill={RED} />
      <circle cx={x} cy={y} r={8} fill={RED} filter={glow} opacity={0.9} />
      <circle cx={x} cy={y} fill="none" stroke="white" strokeWidth={1} vectorEffect="non-scaling-stroke">
        <animate attributeName="r" values="26;70" dur="2.8s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.5;0" dur="2.8s" repeatCount="indefinite" />
      </circle>
      {boundary === "dashed" && (
        <circle cx={x} cy={y} r={52} fill="none" stroke="white" strokeWidth={1} strokeDasharray="4 6" vectorEffect="non-scaling-stroke" />
      )}
      {boundary === "sealed" && (
        <>
          <circle cx={x} cy={y} r={48} fill="none" stroke="white" strokeWidth={1.25} vectorEffect="non-scaling-stroke" />
          <circle cx={x} cy={y} r={56} fill="none" stroke="white" strokeOpacity={0.5} strokeWidth={1} vectorEffect="non-scaling-stroke" />
        </>
      )}
    </g>
  );
}

/** A mono label on a leader line from its feature. */
function Tag({
  from,
  to,
  text,
  sub,
  anchor = "start",
}: {
  from: Pt;
  to: Pt;
  text: string;
  sub?: string;
  anchor?: "start" | "end";
}) {
  const dx = anchor === "start" ? 14 : -14;
  return (
    <g>
      <line x1={from[0]} y1={from[1]} x2={to[0]} y2={to[1]} stroke="white" strokeOpacity={0.5} strokeWidth={1} vectorEffect="non-scaling-stroke" />
      <circle cx={to[0]} cy={to[1]} r={3.5} fill="white" fillOpacity={0.7} />
      <text x={to[0] + dx} y={to[1] + 9} textAnchor={anchor} fontSize={26} fill="white" fillOpacity={0.85} style={LABEL}>
        {text}
      </text>
      {sub && (
        <text x={to[0] + dx} y={to[1] + 46} textAnchor={anchor} fontSize={21} fill="white" fillOpacity={0.5} style={LABEL}>
          {sub}
        </text>
      )}
    </g>
  );
}

/* ---- interoperability: three chains on one braided river ---------- */

// Each hop is the brightest route through the water between two nodes
// (least-cost path over the photo's luminance), so the light only ever
// runs in the channels. Traced offline; literal waypoints here.
const PUBLIC: Pt = [252, 204];
const PERMISSIONED: Pt = [1108, 348];
const PRIVATE: Pt = [780, 1428];
const JUNCTION: Pt = [1092, 604];
const HOP_1 = smooth([PUBLIC, [308, 252], [580, 260], [724, 372], [716, 428], [772, 500], [924, 556], [1004, 556], [1068, 596], [1092, 596], [1172, 508], [1172, 468], [1100, 396], PERMISSIONED]);
const HOP_2 = smooth([PERMISSIONED, [1100, 396], [1172, 468], [1172, 508], [1100, 604], [1100, 636], [1076, 684], [972, 780], [796, 868], [748, 932], [756, 1132], [780, 1164], [812, 1276], [812, 1388], PRIVATE]);
const HOP_3 = smooth([PRIVATE, [812, 1388], [812, 1260], [796, 1244], [780, 1164], [756, 1132], [748, 932], [796, 868], [988, 772], [1092, 652], [1092, 612], [1028, 564], [924, 556], [772, 500], [716, 428], [724, 372], [580, 260], [348, 260], [308, 252], PUBLIC]);

function InteropOverlay() {
  return (
    <Frame label="Messages travelling between a public, a permissioned, and a private chain along the channels of a river">
      <Route d={HOP_1} />
      <Route d={HOP_2} />
      {/* one relay loop, three hops, each leaving as the last arrives */}
      <Comet d={HOP_1} dur={6} begin={0} />
      <Comet d={HOP_2} dur={6} begin={2} />
      <Comet d={HOP_3} dur={6} begin={4} />
      <circle cx={JUNCTION[0]} cy={JUNCTION[1]} r={5} fill="white" fillOpacity={0.8} />
      <Tag from={JUNCTION} to={[1230, 700]} text="ICM" sub="VERIFIED ON P-CHAIN" />
      <Node x={PUBLIC[0]} y={PUBLIC[1]} boundary="open" />
      <Node x={PERMISSIONED[0]} y={PERMISSIONED[1]} boundary="dashed" />
      <Node x={PRIVATE[0]} y={PRIVATE[1]} boundary="sealed" />
      <Tag from={[280, 224]} to={[330, 330]} text="PUBLIC" />
      <Tag from={[1158, 330]} to={[1240, 220]} text="PERMISSIONED" />
      <Tag from={[836, 1440]} to={[930, 1540]} text="PRIVATE" />
    </Frame>
  );
}

/* ---- performance: transactions falling into place, frozen at the base */

// the ice column, lip to base, traced from the photograph
const LIP: Pt = [860, 470];
const BASE: Pt = [812, 1440];
const FALL = smooth([LIP, [846, 700], [826, 1000], [818, 1250], BASE]);
// a time ruler on the rock beside the column: T+0 at the lip, final at the base
const RULER_X = 1010;
const TICKS = Array.from({ length: 11 }, (_, k) => Math.round(LIP[1] + ((BASE[1] - LIP[1]) * k) / 10));

function PerformanceOverlay() {
  return (
    <Frame label="A stream of transactions falling down a frozen waterfall and locking in place at its base, final in under a second">
      <Route d={FALL} />
      {/* not one transaction, a pipeline: evenly staggered, each final on arrival */}
      {[0, 0.3, 0.6, 0.9, 1.2, 1.5].map((b) => (
        <Comet key={b} d={FALL} dur={1.8} begin={b} travel={0.9} length={80} width={6} />
      ))}
      {/* the ruler */}
      <line x1={RULER_X} y1={LIP[1]} x2={RULER_X} y2={BASE[1]} stroke="white" strokeOpacity={0.5} strokeWidth={1} vectorEffect="non-scaling-stroke" />
      {TICKS.map((y, k) => (
        <line
          key={y}
          x1={RULER_X}
          y1={y}
          x2={RULER_X + (k % 5 === 0 ? 34 : 16)}
          y2={y}
          stroke="white"
          strokeOpacity={k % 5 === 0 ? 0.7 : 0.4}
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
        />
      ))}
      <line x1={LIP[0] + 30} y1={LIP[1]} x2={RULER_X} y2={LIP[1]} stroke="white" strokeOpacity={0.3} strokeWidth={1} strokeDasharray="2 6" vectorEffect="non-scaling-stroke" />
      <line x1={BASE[0] + 60} y1={BASE[1]} x2={RULER_X} y2={BASE[1]} stroke="white" strokeOpacity={0.3} strokeWidth={1} strokeDasharray="2 6" vectorEffect="non-scaling-stroke" />
      <text x={RULER_X + 52} y={LIP[1] + 9} fontSize={26} fill="white" fillOpacity={0.85} style={LABEL}>
        SUBMITTED
      </text>
      <text x={RULER_X + 52} y={LIP[1] + 46} fontSize={21} fill="white" fillOpacity={0.5} style={LABEL}>
        T+0
      </text>
      <text x={RULER_X + 52} y={BASE[1] + 9} fontSize={26} fill="white" fillOpacity={0.85} style={LABEL}>
        FINAL
      </text>
      <text x={RULER_X + 52} y={BASE[1] + 46} fontSize={21} fill="white" fillOpacity={0.5} style={LABEL}>
        UNDER ONE SECOND
      </text>
      <Node x={BASE[0]} y={BASE[1]} boundary="sealed" />
    </Frame>
  );
}

/* ---- privacy: validators above the fog, observers below the line --- */

const PEAKS: Pt[] = [
  [240, 484],
  [300, 650],
  [560, 692],
  [1300, 700],
  [1480, 462],
  [1360, 1512],
];
const LINKS: [number, number][] = [
  [0, 2],
  [1, 2],
  [2, 3],
  [3, 4],
  [3, 5],
];
const FOG_LINE = 390;
const PROBES = [520, 900, 1180];

function PrivacyOverlay() {
  return (
    <Frame label="Validators on ridgetops above the fog exchanging private messages while outside observers stop at the fog line">
      {LINKS.map(([a, b], i) => {
        const d = smooth([PEAKS[a], PEAKS[b]]);
        return (
          <g key={`${a}-${b}`}>
            <Route d={d} dashed />
            <Comet d={d} dur={3.6} begin={i * 0.7} travel={0.6} length={90} width={6} />
          </g>
        );
      })}
      {PEAKS.map(([x, y]) => (
        <Node key={`${x}-${y}`} x={x} y={y} />
      ))}
      {/* observers descend from outside and dissolve at the fog line */}
      {PROBES.map((x, i) => (
        <g key={x}>
          <line x1={x} y1={60} x2={x} y2={FOG_LINE} stroke="white" strokeOpacity={0.3} strokeWidth={1} strokeDasharray="2 6" vectorEffect="non-scaling-stroke" />
          <circle cx={x} cy={60} r={7} fill="white" opacity={0}>
            <animate attributeName="cy" values={`60;${FOG_LINE};${FOG_LINE}`} keyTimes="0;0.7;1" dur="4.2s" begin={`${i * 1.4}s`} repeatCount="indefinite" />
            <animate attributeName="opacity" values="0;0.9;0.9;0;0" keyTimes="0;0.1;0.62;0.72;1" dur="4.2s" begin={`${i * 1.4}s`} repeatCount="indefinite" />
          </circle>
          <g opacity={0}>
            <animate attributeName="opacity" values="0;0;1;0" keyTimes="0;0.66;0.74;1" dur="4.2s" begin={`${i * 1.4}s`} repeatCount="indefinite" />
            <line x1={x - 12} y1={FOG_LINE - 12} x2={x + 12} y2={FOG_LINE + 12} stroke="white" strokeWidth={1.25} vectorEffect="non-scaling-stroke" />
            <line x1={x + 12} y1={FOG_LINE - 12} x2={x - 12} y2={FOG_LINE + 12} stroke="white" strokeWidth={1.25} vectorEffect="non-scaling-stroke" />
          </g>
        </g>
      ))}
      <Tag from={[PROBES[0], 60]} to={[PROBES[0] - 60, 60]} text="OUTSIDE" sub="NO VISIBILITY" anchor="end" />
      <Tag from={[586, 700]} to={[700, 820]} text="VALIDATOR-ONLY" />
    </Frame>
  );
}

/* ---- compliance: the allowlist as a line of marker poles ---------- */

// the pole line recedes slightly left as it comes toward the camera
const poleX = (y: number) => Math.round(870 - (y - 330) * 0.038);
const LINE_TOP: Pt = [poleX(300), 300];
const LINE_FOOT: Pt = [poleX(1900), 1900];
const GATES = [
  { y: 540, approved: true, begin: 0 },
  { y: 880, approved: false, begin: 1.6 },
  { y: 1220, approved: true, begin: 3.2 },
];
const CROSS_DUR = 4.8;

function ComplianceOverlay() {
  const glow = useGlow();
  return (
    <Frame label="Approved wallets crossing a line of marker poles while an unapproved wallet is stopped at the line">
      {/* the chain's access rule: the line every transaction must cross */}
      <line
        x1={LINE_TOP[0]}
        y1={LINE_TOP[1]}
        x2={LINE_FOOT[0]}
        y2={LINE_FOOT[1]}
        stroke="white"
        strokeOpacity={0.55}
        strokeWidth={1}
        strokeDasharray="6 6"
        vectorEffect="non-scaling-stroke"
      />
      {GATES.map(({ y, approved, begin }) => {
        const x = poleX(y);
        const stop = x - 34;
        const t = `${begin}s`;
        return (
          <g key={y}>
            <line x1={140} y1={y} x2={approved ? 1460 : stop} y2={y} stroke="white" strokeOpacity={0.22} strokeWidth={1} strokeDasharray="2 7" vectorEffect="non-scaling-stroke" />
            {approved ? (
              <circle cx={140} cy={y} r={15} fill="white" opacity={0}>
                <animate attributeName="cx" values="140;1460;1460" keyTimes="0;0.8;1" dur={`${CROSS_DUR}s`} begin={t} repeatCount="indefinite" />
                <animate attributeName="opacity" values="0;1;1;0;0" keyTimes="0;0.08;0.72;0.8;1" dur={`${CROSS_DUR}s`} begin={t} repeatCount="indefinite" />
              </circle>
            ) : (
              <>
                <circle cx={140} cy={y} r={15} fill="none" stroke="white" strokeWidth={1.5} vectorEffect="non-scaling-stroke" opacity={0}>
                  <animate attributeName="cx" values={`140;${stop};${stop}`} keyTimes="0;0.5;1" dur={`${CROSS_DUR}s`} begin={t} repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0;1;1;0;0" keyTimes="0;0.08;0.62;0.75;1" dur={`${CROSS_DUR}s`} begin={t} repeatCount="indefinite" />
                </circle>
                {/* the rejection: the line flares red where it holds */}
                <g opacity={0}>
                  <animate attributeName="opacity" values="0;0;1;0;0" keyTimes="0;0.48;0.54;0.75;1" dur={`${CROSS_DUR}s`} begin={t} repeatCount="indefinite" />
                  <line x1={poleX(y - 90)} y1={y - 90} x2={poleX(y + 90)} y2={y + 90} stroke={RED} strokeWidth={22} opacity={0.6} filter={glow} />
                  <line x1={poleX(y - 90)} y1={y - 90} x2={poleX(y + 90)} y2={y + 90} stroke="#ff8a92" strokeWidth={5} />
                </g>
              </>
            )}
          </g>
        );
      })}
      <Tag from={[poleX(380), 380]} to={[1060, 250]} text="APPROVED WALLETS ONLY" sub="ENFORCED BY THE CHAIN" />
      <Tag from={[1460, 540]} to={[1380, 440]} text="ADMITTED" anchor="end" />
      <Tag from={[poleX(880) - 60, 880]} to={[420, 980]} text="NOT ON THE LIST" anchor="end" />
    </Frame>
  );
}

const OVERLAYS: Partial<Record<PillarSlug, () => React.JSX.Element>> = {
  interoperability: InteropOverlay,
  performance: PerformanceOverlay,
  privacy: PrivacyOverlay,
  compliance: ComplianceOverlay,
};

/** The surveyed overlay for a pillar's photograph, if it has one. */
export function photoOverlay(slug: PillarSlug): React.ReactNode {
  const Overlay = OVERLAYS[slug];
  return Overlay ? <Overlay /> : null;
}
