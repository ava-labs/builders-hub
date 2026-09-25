"use client";

import React, { useEffect, useId, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
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

/* ---- interoperability: three districts on one frozen delta -------- */

// Three chains as three districts: the sprawling north island (public),
// the orderly south bank (permissioned), the enclosed east quarter
// (private). Messages cross on the real bridge and over the ice; the
// junction on the bridge is where ICM verifies them.
const PUBLIC: Pt = [800, 560];
const PERMISSIONED: Pt = [840, 1560];
const PRIVATE: Pt = [1380, 1020];
const JUNCTION: Pt = [828, 1080];
const NORTH_SPAN: Pt[] = [PUBLIC, [818, 690], [828, 780], [828, 940], JUNCTION];
const SOUTH_SPAN: Pt[] = [JUNCTION, [828, 1250], [828, 1420], PERMISSIONED];
const EAST_LEG: Pt[] = [JUNCTION, [930, 1070], [1110, 1050], [1290, 1030], PRIVATE];
const HOP_1 = smooth([...NORTH_SPAN, ...SOUTH_SPAN.slice(1)]);
const HOP_2 = smooth([...rev(SOUTH_SPAN), ...EAST_LEG.slice(1)]);
const HOP_3 = smooth([...rev(EAST_LEG), ...rev(NORTH_SPAN).slice(1)]);

function InteropOverlay() {
  return (
    <Frame label="Messages crossing between three districts, public, permissioned, and private, over a bridge on a frozen river">
      <Route d={smooth([...NORTH_SPAN, ...SOUTH_SPAN.slice(1)])} />
      <Route d={smooth(EAST_LEG)} dashed />
      {/* one relay loop, three hops, each leaving as the last arrives */}
      <Comet d={HOP_1} dur={6} begin={0} />
      <Comet d={HOP_2} dur={6} begin={2} />
      <Comet d={HOP_3} dur={6} begin={4} />
      <circle cx={JUNCTION[0]} cy={JUNCTION[1]} r={6} fill="white" fillOpacity={0.85} />
      <Tag from={[814, 1080]} to={[560, 1190]} text="ICM" sub="VERIFIED ON P-CHAIN" anchor="end" />
      <Node x={PUBLIC[0]} y={PUBLIC[1]} boundary="open" />
      <Node x={PERMISSIONED[0]} y={PERMISSIONED[1]} boundary="dashed" />
      <Node x={PRIVATE[0]} y={PRIVATE[1]} boundary="sealed" />
      <Tag from={[826, 540]} to={[960, 430]} text="PUBLIC" />
      <Tag from={[880, 1540]} to={[1000, 1450]} text="PERMISSIONED" />
      <Tag from={[1350, 966]} to={[1290, 880]} text="PRIVATE" anchor="end" />
    </Frame>
  );
}

/* ---- performance: race telemetry over the car ---------------------- */

// The video's camera moves, so nothing here is traced onto the frame: the
// readout is a timing screen pinned to the plate's corner, the way race
// telemetry sits over footage. It reads the loop's own playhead, so it
// cannot drift from the picture. The loop holds two passes; each one
// launches (SETTLING, counting real milliseconds) and turns FINAL at its
// decisive frame, holding until the next launch.
const PASSES = [
  { submit: 1.5, final: 2.3 }, // bursts through the wall of spray
  { submit: 7.5, final: 8.3 }, // the wheel fills the frame
];
const READY_FOR = 0.9; // s of READY before each launch

type Phase = "ready" | "settling" | "final";

// the two chains on the timing tower: both launch with the car; each
// locks at its own finality (illustrative, inside the stated bounds:
// C-Chain under a second, a dedicated L1 under 100 milliseconds)
const LANES = [
  { name: "Your L1", finalMs: 80 },
  { name: "C-Chain", finalMs: 800 },
];

/* A broadcast timing tower, lower-left over the snow: it slides in as a
   car launches, runs both clocks, locks each lane as it goes final, and
   slides out before the next launch. Without the video (reduced motion,
   or still loading) it rests on both final times. */
function FinalityHud() {
  const reducedMotion = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<{ phase: Phase; ms: number }>({ phase: "final", ms: 800 });

  useEffect(() => {
    const video = ref.current?.closest("[data-plate]")?.querySelector("video");
    if (!video) return;
    let raf = 0;
    const tick = () => {
      if (!video.paused && video.readyState >= 2) {
        const t = video.currentTime;
        // READY for a beat before each launch; otherwise the latest pass
        // that has launched decides (before the first, the last pass of
        // the previous loop still holds FINAL)
        const count = (p: (typeof PASSES)[number]) => Math.round((p.final - p.submit) * 1000);
        const pass = [...PASSES].reverse().find((p) => t >= p.submit);
        const arming = PASSES.some((p) => t >= p.submit - READY_FOR && t < p.submit);
        if (arming) setState({ phase: "ready", ms: 0 });
        else if (!pass) setState({ phase: "final", ms: count(PASSES[PASSES.length - 1]) });
        else if (t < pass.final) setState({ phase: "settling", ms: Math.round((t - pass.submit) * 1000) });
        else setState({ phase: "final", ms: count(pass) });
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const { phase, ms } = state;
  const elapsed = phase === "ready" ? 0 : ms;

  return (
    <div ref={ref} className="absolute bottom-[9%] left-[6%]">
      {/* the board never leaves: it wipes in once, then resets in place */}
      <motion.div
        role="img"
        aria-label="Time to finality: under 100 milliseconds on your own L1, under one second on the C-Chain"
        initial={reducedMotion ? false : { clipPath: "inset(0 100% 0 0)" }}
        whileInView={{ clipPath: "inset(0 0% 0 0)" }}
        viewport={{ once: true }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        className="w-[17rem] overflow-hidden border border-white/10 bg-zinc-950/55 text-white backdrop-blur-md"
      >
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-2 text-[11px] text-white/60">
          <span>Time to finality</span>
          <span className="tabular-nums">1.000 s</span>
        </div>
        {LANES.map((lane, k) => {
          const done = elapsed >= lane.finalMs;
          const t = Math.min(elapsed, lane.finalMs);
          const resetting = phase === "ready";
          // lanes clear top to bottom, a beat apart, like a board resetting
          const delay = resetting ? `${k * 90}ms` : "0ms";
          return (
            <div key={lane.name} className={`relative px-4 py-2.5 ${k > 0 ? "border-t border-white/10" : ""}`}>
              {/* the lane's accent: white while its clock runs, red once final */}
              <span
                aria-hidden
                className={`absolute inset-y-0 left-0 w-[3px] transition-colors duration-300 ${done ? "bg-[#E6212F]" : "bg-white/60"}`}
                style={{ transitionDelay: delay }}
              />
              <div className="flex items-center justify-between gap-3">
                <span className="text-[13px] font-medium text-white/85">{lane.name}</span>
                <span className="flex items-center gap-2">
                  <span
                    className={`v2-heading text-[1.35rem] leading-none tabular-nums tracking-[-0.01em] transition-opacity duration-300 ${
                      resetting ? "opacity-50" : "opacity-100"
                    }`}
                    style={{ transitionDelay: delay }}
                  >
                    {(t / 1000).toFixed(3)}
                    <span className="ml-0.5 text-[11px] text-white/50">s</span>
                  </span>
                  {/* the tag flips over, the way a board card turns */}
                  <span className="relative h-[1.2rem] w-[3.1rem] [perspective:200px]">
                    <motion.span
                      key={done ? "final" : "wait"}
                      initial={{ rotateX: -90, opacity: 0 }}
                      animate={{ rotateX: 0, opacity: 1 }}
                      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1], delay: resetting ? k * 0.09 : 0 }}
                      className={`absolute inset-0 flex items-center justify-center text-[9px] font-semibold tracking-[0.14em] [transform-origin:50%_0%] ${
                        done ? "bg-[#E6212F] text-white" : "bg-white/10 text-white/40"
                      }`}
                    >
                      {done ? "FINAL" : "···"}
                    </motion.span>
                  </span>
                </span>
              </div>
              {/* the lane's share of the second; it only animates when it
                  retracts, so the running clock stays exact */}
              <span className="relative mt-2 block h-[2px] bg-white/10">
                <span
                  className={`absolute inset-y-0 left-0 ${done ? "bg-[#E6212F]" : "bg-white"} ${
                    resetting ? "transition-[width,background-color] duration-500 ease-out" : ""
                  }`}
                  style={{ width: `${(t / 1000) * 100}%`, transitionDelay: delay }}
                />
              </span>
            </div>
          );
        })}
      </motion.div>
    </div>
  );
}

/* ---- privacy: participants inside the room, fog outside ----------- */

// The validator-only network is the lit room: its participants see one
// another across the table; the perimeter is the glass. Outside views
// drift in through the fog and are lost at the glass, a ripple where each
// one touches it.
const ROOM = { x: 760, y: 925, w: 730, h: 395 };
const SEATS: Pt[] = [
  [875, 1150],
  [960, 1146],
  [1075, 1138],
  [1140, 1150],
  [1205, 1142],
];
const TABLE_LINK = smooth(SEATS);
const TABLE_LINK_BACK = smooth(rev(SEATS));
const OBSERVERS = [
  { y: 1000, begin: 0 },
  { y: 1130, begin: 1.9 },
  { y: 1260, begin: 3.8 },
];
const OBSERVE_DUR = 5.7;
const GLASS_X = ROOM.x - 16;

function PrivacyOverlay() {
  const glow = useGlow();
  return (
    <Frame label="Participants inside a lit glass room share a private link, while outside views vanish at the glass in the fog">
      {/* the perimeter: the glass itself */}
      <rect
        x={ROOM.x - 16}
        y={ROOM.y - 16}
        width={ROOM.w + 32}
        height={ROOM.h + 32}
        fill="none"
        stroke="white"
        strokeOpacity={0.55}
        strokeWidth={1}
        strokeDasharray="6 6"
        vectorEffect="non-scaling-stroke"
      />
      {/* the participants and the link between them */}
      <path d={TABLE_LINK} fill="none" stroke="white" strokeOpacity={0.4} strokeWidth={1} vectorEffect="non-scaling-stroke" />
      <Comet d={TABLE_LINK} dur={5} begin={0} travel={0.45} length={70} width={5} />
      <Comet d={TABLE_LINK_BACK} dur={5} begin={2.5} travel={0.45} length={70} width={5} />
      {SEATS.map(([x, y], i) => (
        <g key={x}>
          <circle cx={x} cy={y - 70} r={6} fill={RED} />
          <circle cx={x} cy={y - 70} r={9} fill={RED} filter={glow} opacity={0.7}>
            <animate attributeName="opacity" values="0.35;0.85;0.35" dur="3.6s" begin={`${i * 0.7}s`} repeatCount="indefinite" />
          </circle>
          <line x1={x} y1={y - 62} x2={x} y2={y - 8} stroke="white" strokeOpacity={0.3} strokeWidth={1} vectorEffect="non-scaling-stroke" />
        </g>
      ))}

      {/* outside views: faint points drifting in through the fog, lost at the glass */}
      {OBSERVERS.map(({ y, begin }) => {
        const t = `${begin}s`;
        return (
          <g key={y}>
            <circle cx={120} cy={y} r={5} fill="white" opacity={0}>
              <animate attributeName="cx" values={`120;${GLASS_X};${GLASS_X}`} keyTimes="0;0.55;1" dur={`${OBSERVE_DUR}s`} begin={t} repeatCount="indefinite" />
              <animate attributeName="opacity" values="0;0.7;0.7;0;0" keyTimes="0;0.12;0.5;0.56;1" dur={`${OBSERVE_DUR}s`} begin={t} repeatCount="indefinite" />
            </circle>
            <ellipse cx={GLASS_X} cy={y} rx={0} ry={0} fill="none" stroke="white" strokeWidth={1} vectorEffect="non-scaling-stroke" opacity={0}>
              <animate attributeName="rx" values="0;0;12;12" keyTimes="0;0.55;0.8;1" dur={`${OBSERVE_DUR}s`} begin={t} repeatCount="indefinite" />
              <animate attributeName="ry" values="0;0;60;60" keyTimes="0;0.55;0.8;1" dur={`${OBSERVE_DUR}s`} begin={t} repeatCount="indefinite" />
              <animate attributeName="opacity" values="0;0;0.55;0;0" keyTimes="0;0.55;0.6;0.8;1" dur={`${OBSERVE_DUR}s`} begin={t} repeatCount="indefinite" />
            </ellipse>
          </g>
        );
      })}

      <text x={120} y={1420} fontSize={24} fill="white" fillOpacity={0.8} style={LABEL}>
        OUTSIDE
      </text>
      <text x={120} y={1456} fontSize={20} fill="white" fillOpacity={0.45} style={LABEL}>
        NO VISIBILITY
      </text>
      <Tag from={[900, ROOM.y - 16]} to={[840, 790]} text="VALIDATOR-ONLY NETWORK" anchor="end" />
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
  performance: FinalityHud,
  privacy: PrivacyOverlay,
  compliance: ComplianceOverlay,
};

/** The surveyed overlay for a pillar's photograph, if it has one. */
export function photoOverlay(slug: PillarSlug): React.ReactNode {
  const Overlay = OVERLAYS[slug];
  return Overlay ? <Overlay /> : null;
}
