"use client";

import React, { useEffect, useId, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import type { PillarSlug } from "@/components/landing-v2/pillars";

/* ------------------------------------------------------------------ */
/* Photo overlays: each pillar's drawing, surveyed onto its photograph  */
/*                                                                      */
/* The drawing is traced from the scene itself, so it reads as part of */
/* the photograph: calls run phone to phone across the trading floor,  */
/* the room's frame is the network's edge, requests stop at the shut   */
/* gate, and finality is read off the train's tracked pass. Each SVG   */
/* shares its photo's 1600x2000 pixel space and the plate is always    */
/* 4:5, so every coordinate lands on its feature at any size. Hairlines */
/* use non-scaling strokes (always 1px); the red comets scale with the  */
/* plate and carry a blurred twin for glow. Loops that tell a sequence  */
/* run on a JS clock or the video's playhead; ambient ones use SMIL.    */
/* Path strings are built once at module load from literal waypoints,  */
/* so server and client produce the same markup.                       */
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
      <Caption x={to[0] + dx} y={to[1]} text={text} sub={sub} anchor={anchor} />
    </g>
  );
}

// mono glyphs advance about 0.6em, plus the label's letter spacing
const textWidth = (s: string, size: number) => s.length * (size * 0.6 + LABEL.letterSpacing);

/** A mono label on a dark backing, so it reads on bright snow as well as shadow. */
function Caption({
  x,
  y,
  text,
  sub,
  anchor = "start",
}: {
  x: number;
  y: number;
  text: string;
  sub?: string;
  anchor?: "start" | "end";
}) {
  const w = Math.max(textWidth(text, 26), sub ? textWidth(sub, 21) : 0) + 28;
  const h = sub ? 92 : 54;
  const left = anchor === "start" ? x - 14 : x + 14 - w;
  return (
    <g>
      <rect x={left} y={y - 24} width={w} height={h} fill="rgba(9,9,11,0.62)" />
      <text x={x} y={y + 9} textAnchor={anchor} fontSize={26} fill="white" fillOpacity={0.9} style={LABEL}>
        {text}
      </text>
      {sub && (
        <text x={x} y={y + 46} textAnchor={anchor} fontSize={21} fill="white" fillOpacity={0.6} style={LABEL}>
          {sub}
        </text>
      )}
    </g>
  );
}

/** Seconds since mount on a loop of `period`, frozen at `still` under reduced motion. */
function useLoop(period: number, still: number) {
  const reducedMotion = useReducedMotion();
  const [t, setT] = useState(still);
  useEffect(() => {
    if (reducedMotion) {
      setT(still);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      setT(((now - start) / 1000) % period);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [reducedMotion, period, still]);
  return t;
}

/** A red comet placed by a JS clock: `p` runs 0..1 along the route. */
function ClockComet({ d, p, length = 70, width = 7 }: { d: string; p: number; length?: number; width?: number }) {
  const glow = useGlow();
  if (p <= 0 || p >= 1) return null;
  const common = {
    d,
    fill: "none",
    pathLength: 1000,
    strokeDasharray: `${length} 2000`,
    strokeDashoffset: length - p * (1000 + length),
    strokeLinecap: "round" as const,
  };
  return (
    <g>
      <path {...common} stroke={RED} strokeWidth={width * 3.2} opacity={0.55} filter={glow} />
      <path {...common} stroke="#ff8a92" strokeWidth={width} />
    </g>
  );
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/* ---- interoperability: two desks, one board ---------------------- */

// Two L1s as two trading desks far apart on one snowed-in floor: they call
// each other directly, phone to phone, and any line can carry the call.
// The P-Chain is the board above the floor: no call goes through it, but
// the desk that answers reads the caller's validator set from it before it
// accepts the message.
const DESK_A: Pt = [520, 1230]; // private L1, the left desk's phone
const DESK_B: Pt = [1190, 1200]; // public L1, the right desk's phone
const PHONE_LINE: Pt[] = [DESK_A, [700, 1130], [880, 1100], [1060, 1120], DESK_B];
const A_TO_B = smooth(PHONE_LINE);
const B_TO_A = smooth(rev(PHONE_LINE));
const REG = { x: 260, y: 190, w: 1100, rowH: 70 };
const ROWS = [
  { name: "PRIVATE L1", validators: 5 },
  { name: "PUBLIC L1", validators: 8 },
  { name: "PERMISSIONED L1", validators: 4 },
];
const REG_H = 128 + ROWS.length * REG.rowH;
const HOP = 4; // s per hop; the loop is one hop each way

/** The source's validators sign: five dots in an arc above it light in turn. */
function Signers({ at, lit }: { at: Pt; lit: number }) {
  return (
    <g>
      {[-2, -1, 0, 1, 2].map((k, i) => (
        <circle
          key={k}
          cx={at[0] + k * 34}
          cy={at[1] - 78 + Math.abs(k) * 10}
          r={7}
          fill={i < lit ? "white" : "none"}
          stroke="white"
          strokeOpacity={0.7}
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </g>
  );
}

function InteropOverlay() {
  const t = useLoop(HOP * 2, 2.6);
  const forward = t < HOP;
  const u = t % HOP;
  const [src, dst] = forward ? [DESK_A, DESK_B] : [DESK_B, DESK_A];
  const srcRow = forward ? 0 : 1;
  const signing = u < 0.7;
  const travel = clamp01((u - 0.7) / 1.6);
  const lookup = u >= 2.3 && u < 3.0;
  const verified = u >= 3.0;
  // the lookup line draws from the destination up to the registry, then holds
  const reach = clamp01((u - 2.3) / 0.35);
  const lookupEnd: Pt = [dst[0], dst[1] + (REG.y + REG_H - dst[1]) * reach];
  const rowLit = u >= 2.5;
  return (
    <Frame label="Two L1s as two trading desks call each other directly; the desk that answers checks the caller's validators against the P-Chain registry on the board">
      <Route d={A_TO_B} />
      <ClockComet d={forward ? A_TO_B : B_TO_A} p={travel} />

      {/* the registry: every L1's validator set, on the board above the floor */}
      <g>
        <rect x={REG.x} y={REG.y} width={REG.w} height={REG_H} fill="rgba(9,9,11,0.5)" stroke="white" strokeOpacity={0.15} strokeWidth={1} vectorEffect="non-scaling-stroke" />
        <text x={REG.x + 28} y={REG.y + 52} fontSize={28} fill="white" fillOpacity={0.92} style={LABEL}>
          P-CHAIN
        </text>
        <text x={REG.x + 28} y={REG.y + 92} fontSize={20} fill="white" fillOpacity={0.55} style={LABEL}>
          VALIDATOR SETS OF EVERY L1
        </text>
        {ROWS.map((row, i) => {
          const y = REG.y + 128 + i * REG.rowH;
          const on = rowLit && i === srcRow;
          return (
            <g key={row.name}>
              <line x1={REG.x} y1={y} x2={REG.x + REG.w} y2={y} stroke="white" strokeOpacity={0.12} strokeWidth={1} vectorEffect="non-scaling-stroke" />
              {on && <rect x={REG.x} y={y} width={6} height={REG.rowH} fill={RED} />}
              <text x={REG.x + 28} y={y + 41} fontSize={20} fill="white" fillOpacity={on ? 0.95 : 0.5} style={LABEL}>
                {row.name}
              </text>
              {Array.from({ length: row.validators }, (_, k) => (
                <circle key={k} cx={REG.x + 520 + k * 36} cy={y + 34} r={7} fill="white" fillOpacity={on ? 0.95 : 0.3} />
              ))}
            </g>
          );
        })}
      </g>

      {/* the destination reads the sender's row: a read, not a hop */}
      {lookup && (
        <line x1={dst[0]} y1={dst[1]} x2={lookupEnd[0]} y2={lookupEnd[1]} stroke="white" strokeOpacity={0.75} strokeWidth={1.25} strokeDasharray="6 6" vectorEffect="non-scaling-stroke" />
      )}

      <Signers at={src} lit={signing ? Math.ceil((u / 0.7) * 5) : travel > 0 || lookup || verified ? 5 : 0} />
      <Node x={DESK_A[0]} y={DESK_A[1]} boundary="sealed" />
      <Node x={DESK_B[0]} y={DESK_B[1]} boundary="open" />
      <Tag from={[DESK_A[0] - 40, DESK_A[1] + 30]} to={[120, 1780]} text="PRIVATE L1" />
      <Tag from={[DESK_B[0] + 40, DESK_B[1] + 30]} to={[1480, 1780]} text="PUBLIC L1" anchor="end" />
      {signing && <Caption x={src[0]} y={src[1] - 150} text="SIGNED BY ITS VALIDATORS" anchor={forward ? "start" : "end"} />}
      {travel > 0 && travel < 1 && <Caption x={880} y={1020} text="ANY RELAYER" anchor="start" />}
      {verified && <Caption x={dst[0]} y={dst[1] - 150} text="VERIFIED AGAINST P-CHAIN" anchor={forward ? "end" : "start"} />}
    </Frame>
  );
}

/* ---- performance: final before the train has passed --------------- */

// The loop is one pass of a train between the camera and a man waiting on
// the platform; the pass itself plays 4x fast (frame-blended), about 0.6 s.
// The clock starts the instant the train's nose reaches him (tracked off
// the footage, 24 fps) and counts in real time: your L1 is final at
// 0.080 s, while the train is still passing; the C-Chain at 0.800 s, just
// after it has gone. The readout sits
// on the ground below the rails, which the train never covers. Without
// the video (reduced motion, or still loading) it rests on both finals.
const FPS = 24;
const AT_MAN = 4.9 / FPS; // the nose reaches the man
const GROUND_Y = 1620; // the top of the ground strip below the rails
const CHAINS = [
  { name: "YOUR L1", finalMs: 80 },
  { name: "C-CHAIN", finalMs: 800 },
];

function FinalityHud() {
  const ref = useRef<HTMLDivElement>(null);
  const [t, setT] = useState<number | null>(null);

  useEffect(() => {
    const video = ref.current?.closest("[data-plate]")?.querySelector("video");
    if (!video) return;
    let raf = 0;
    const tick = () => {
      if (!video.paused && video.readyState >= 2) setT(video.currentTime);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  // ms since the nose reached the man; no playhead yet rests on both finals
  const elapsed = t === null ? Infinity : Math.max(0, (t - AT_MAN) * 1000);
  const armed = t === null || t >= AT_MAN;

  return (
    <div ref={ref} className="absolute inset-0">
      <Frame label="Finality: under 100 milliseconds on your own L1, before the train has passed, and under one second on the C-Chain">
        <rect x={96} y={GROUND_Y + 40} width={640} height={176} fill="rgba(9,9,11,0.62)" />
        <text x={124} y={GROUND_Y + 84} fontSize={20} fill="white" fillOpacity={0.6} style={LABEL}>
          TIME TO FINALITY
        </text>
        {CHAINS.map(({ name, finalMs }, i) => {
          const y = GROUND_Y + 134 + i * 52;
          const done = elapsed >= finalMs;
          const ms = Math.min(elapsed, finalMs);
          return (
            <g key={name}>
              <text x={124} y={y} fontSize={26} fill="white" fillOpacity={0.9} style={LABEL}>
                {name}
              </text>
              <text x={540} y={y} textAnchor="end" fontSize={26} fill="white" fillOpacity={armed ? 0.95 : 0.4} style={LABEL}>
                {`${(ms / 1000).toFixed(3)} S`}
              </text>
              <text x={710} y={y} textAnchor="end" fontSize={22} fill={done ? "#ff8a92" : "white"} fillOpacity={done ? 1 : 0.3} style={LABEL}>
                {done ? "FINAL" : "···"}
              </text>
            </g>
          );
        })}
      </Frame>
    </div>
  );
}

/* ---- privacy: a closed room in the snow --------------------------- */

// The validator-only network is the closed meeting room: its two
// participants share a link across the table; the room's frame is the
// network's edge. Outside views drift in through the snow and are lost at
// the glass, a ripple where each one touches it.
const ROOM = { x: 200, y: 410, w: 1200, h: 1210 };
const SEATS: Pt[] = [
  [650, 1130],
  [810, 1165],
  [985, 1125],
];
const TABLE_LINK = smooth(SEATS);
const TABLE_LINK_BACK = smooth(rev(SEATS));
const OBSERVERS = [
  { y: 860, begin: 0 },
  { y: 1080, begin: 1.9 },
  { y: 1300, begin: 3.8 },
];
const OBSERVE_DUR = 5.7;
const GLASS_X = ROOM.x - 16;

function PrivacyOverlay() {
  return (
    <Frame label="Two participants inside a closed room share a private link while outside views stop at the glass">
      {/* the network's edge: the room's frame */}
      <rect
        x={ROOM.x - 16}
        y={ROOM.y - 16}
        width={ROOM.w + 32}
        height={ROOM.h + 32}
        fill="none"
        stroke="white"
        strokeOpacity={0.6}
        strokeWidth={1}
        strokeDasharray="6 6"
        vectorEffect="non-scaling-stroke"
      />
      {/* the participants and the link between them */}
      <path d={TABLE_LINK} fill="none" stroke="white" strokeOpacity={0.45} strokeWidth={1} vectorEffect="non-scaling-stroke" />
      <Comet d={TABLE_LINK} dur={5} begin={0} travel={0.45} length={70} width={5} />
      <Comet d={TABLE_LINK_BACK} dur={5} begin={2.5} travel={0.45} length={70} width={5} />
      <Node x={SEATS[0][0]} y={SEATS[0][1]} boundary="open" />
      <Node x={SEATS[2][0]} y={SEATS[2][1]} boundary="open" />

      {/* outside views: faint points drifting in through the snow, lost at the glass */}
      {OBSERVERS.map(({ y, begin }) => {
        const t = `${begin}s`;
        return (
          <g key={y}>
            <circle cx={40} cy={y} r={6} fill="white" opacity={0}>
              <animate attributeName="cx" values={`40;${GLASS_X};${GLASS_X}`} keyTimes="0;0.55;1" dur={`${OBSERVE_DUR}s`} begin={t} repeatCount="indefinite" />
              <animate attributeName="opacity" values="0;0.85;0.85;0;0" keyTimes="0;0.12;0.5;0.56;1" dur={`${OBSERVE_DUR}s`} begin={t} repeatCount="indefinite" />
            </circle>
            <ellipse cx={GLASS_X} cy={y} rx={0} ry={0} fill="none" stroke="white" strokeWidth={1.25} vectorEffect="non-scaling-stroke" opacity={0}>
              <animate attributeName="rx" values="0;0;12;12" keyTimes="0;0.55;0.8;1" dur={`${OBSERVE_DUR}s`} begin={t} repeatCount="indefinite" />
              <animate attributeName="ry" values="0;0;60;60" keyTimes="0;0.55;0.8;1" dur={`${OBSERVE_DUR}s`} begin={t} repeatCount="indefinite" />
              <animate attributeName="opacity" values="0;0;0.7;0;0" keyTimes="0;0.55;0.6;0.8;1" dur={`${OBSERVE_DUR}s`} begin={t} repeatCount="indefinite" />
            </ellipse>
          </g>
        );
      })}

      <Tag from={[1100, ROOM.y - 16]} to={[1480, 250]} text="VALIDATOR-ONLY L1" sub="ADMITTED NODES SEE THE LEDGER" anchor="end" />
      <Caption x={120} y={1690} text="OUTSIDE THE L1" sub="CANNOT SYNC, QUERY, OR SEE" />
    </Frame>
  );
}

/* ---- compliance: the gate line in the lobby ----------------------- */

// Requests come in from the snow at the entrance and meet the gate line,
// the VM's allowlist. Approved ones pass the open lanes toward the camera;
// the one in the shut center lane, where the woman stands stopped, ends at
// the line, and that segment flares red.
const GATE_Y = 1140;
const GATE_LANES = [
  { x: 460, approved: true, begin: 0, edge: [350, 570] },
  { x: 800, approved: false, begin: 1.7, edge: [590, 1010] },
  { x: 1140, approved: true, begin: 3.4, edge: [1030, 1250] },
] as const;
const REQUEST_DUR = 5.1;
const CABINETS = [340, 580, 1020, 1260];

function ComplianceOverlay() {
  const glow = useGlow();
  return (
    <Frame label="Approved requests pass the open gates of a lobby while one in the shut center lane is refused at the gate line">
      {/* the gate line every request meets */}
      <line x1={0} y1={GATE_Y} x2={1600} y2={GATE_Y} stroke="white" strokeOpacity={0.55} strokeWidth={1} strokeDasharray="3 8" vectorEffect="non-scaling-stroke" />
      {CABINETS.map((x) => (
        <circle key={x} cx={x} cy={GATE_Y} r={5} fill="white" fillOpacity={0.85} />
      ))}
      {GATE_LANES.map(({ x, approved, begin, edge: [ex0, ex1] }) => {
        const start = 700;
        const end = approved ? 1950 : GATE_Y - 12;
        const t = `${begin}s`;
        const dur = `${REQUEST_DUR}s`;
        return (
          <g key={x}>
            <line x1={x} y1={start} x2={x} y2={approved ? 1950 : GATE_Y} stroke="white" strokeOpacity={0.28} strokeWidth={1} strokeDasharray="2 7" vectorEffect="non-scaling-stroke" />
            <circle cx={x} cy={start} r={10} fill={approved ? "white" : "none"} stroke="white" strokeWidth={1.5} vectorEffect="non-scaling-stroke" opacity={0}>
              <animate attributeName="cy" values={`${start};${end};${end}`} keyTimes="0;0.5;1" dur={dur} begin={t} repeatCount="indefinite" />
              <animate attributeName="opacity" values="0;0.95;0.95;0;0" keyTimes="0;0.08;0.48;0.56;1" dur={dur} begin={t} repeatCount="indefinite" />
            </circle>
            {approved ? (
              // the lane's gate answers: a white tick on the line as the request passes
              <line x1={ex0} y1={GATE_Y} x2={ex1} y2={GATE_Y} stroke="white" strokeWidth={2} vectorEffect="non-scaling-stroke" opacity={0}>
                <animate attributeName="opacity" values="0;0;0.9;0;0" keyTimes="0;0.18;0.22;0.4;1" dur={dur} begin={t} repeatCount="indefinite" />
              </line>
            ) : (
              // refused at the line: the lane's segment flares red
              <g opacity={0}>
                <animate attributeName="opacity" values="0;0;1;0;0" keyTimes="0;0.48;0.54;0.78;1" dur={dur} begin={t} repeatCount="indefinite" />
                <line x1={ex0} y1={GATE_Y} x2={ex1} y2={GATE_Y} stroke={RED} strokeWidth={24} opacity={0.55} filter={glow} />
                <line x1={ex0} y1={GATE_Y} x2={ex1} y2={GATE_Y} stroke="#ff8a92" strokeWidth={5} strokeLinecap="round" />
              </g>
            )}
          </g>
        );
      })}
      <Caption x={120} y={200} text="APPROVED WALLETS ONLY" sub="CHECKED BEFORE EXECUTION" />
      <Tag from={[1590, GATE_Y]} to={[1480, 1060]} text="VM ALLOWLIST" anchor="end" />
      <Tag from={[870, 1420]} to={[1000, 1780]} text="REFUSED" sub="BEFORE IT EXECUTES" />
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
