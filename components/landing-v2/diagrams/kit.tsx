"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import s from "./kit.module.css";

/* ------------------------------------------------------------------ */
/* Diagram kit: one drawing system for the network diagrams            */
/*                                                                      */
/* Frames: the pillar instruments share viewBox 0 0 720 240; the stage */
/* (YOUR CHAIN) is a square. Both are drawn for a near 1:1 render, so  */
/* a 1 unit stroke is about 1 px. Grid: 4 units.                       */
/* Strokes: line 1 (structure), ink 1.5 (cores, boundaries, final      */
/* rings), hollow nodes 1.25.                                          */
/* Boundaries: open = line color solid, gated = ink dashed, sealed =   */
/* ink double ring. Lanes end on the outermost stroke.                 */
/* Red: a transaction or a message, and the chain state it changes.    */
/* Nothing else is red.                                                */
/* P-Chain: a ground line tangent to each chain, a muted record mark  */
/* at each tangent point (ink when read or written); P-CHAIN above    */
/* its left end, the chain names under it.                            */
/* Dotted lines (muted, 1.5): users, senders, probes, measurement.    */
/* Marks: Check and Cross, 10 x 10, ink. A refusal is never red.      */
/* Pulses keep a 1 px stroke as they grow: the one non-scaling stroke.*/
/* Motion: CSS keyframes on transform and opacity, one cycle per       */
/* sequence. Off screen, inactive or under reduced motion, nothing     */
/* animates and each part shows its base state: a complete still.      */
/* A start holds step 1 for `lead` ms (pillar panels: 700, the panel  */
/* fade-in), then plays; a stop freezes the frame, then shows the     */
/* still.                                                              */
/* Geometry is computed at module scope and rounded to 0.01, so the    */
/* server and the client print the same markup.                        */
/* ------------------------------------------------------------------ */

export const cls = s;

/** Round to 0.01 so server and client print the same attribute strings. */
export function r2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** The point at `deg` on a circle. 0 is east and 90 is south (SVG y runs down). */
export function polar(cx: number, cy: number, r: number, deg: number): [number, number] {
  const a = (deg * Math.PI) / 180;
  return [r2(cx + r * Math.cos(a)), r2(cy + r * Math.sin(a))];
}

/** Sizes for a pillar instrument (720 x 240 frame). */
export const INSTRUMENT = {
  core: 14,
  dot: 4,
  node: 5,
  ring: 34,
  count: 6,
  edge: 56,
  seal: 6,
  traveler: 4,
  final: 12,
  actor: 4,
  record: 6,
  label: 11,
  /** dash periods on the edge circumference: a multiple of 6 */
  periods: 30,
} as const;

/** Sizes for the stage (YOUR CHAIN). */
export const STAGE = {
  core: 28,
  dot: 5,
  node: 8,
  ring: 118,
  count: 8,
  edge: 178,
  seal: 6,
  traveler: 4,
  final: 12,
  actor: 4,
  record: 8,
  label: 12,
  /** dash periods on the edge circumference: a multiple of 8 */
  periods: 80,
} as const;

/**
 * The pillar panels rotate in one place, so every pillar diagram that draws
 * the P-Chain puts it at the same height and length, and its chain names on
 * the same baseline: nothing jumps when the panel changes.
 */
export const PILLAR_GROUND = { y: 184, x1: 48, x2: 672, nameY: 208 } as const;

export type Scale = {
  readonly [K in keyof typeof INSTRUMENT]: number;
};

export type Access = "open" | "gated" | "sealed";

/** Dash pattern for a gated ring: whole periods, a dash centered on 0 degrees. */
export function ringDash(r: number, periods: number, duty = 0.55) {
  const period = (2 * Math.PI * r) / periods;
  const dash = r2(period * duty);
  return { strokeDasharray: `${dash} ${r2(period - dash)}`, strokeDashoffset: r2(dash / 2) };
}

/** Dotted line of `len` units: round dots about `step` apart, one on each end. */
export function dotted(len: number, step = 5) {
  const n = Math.max(1, Math.round(len / step));
  // round the period down, and fit it in len - 0.01: a pattern that ends
  // exactly on the line's end, or past it, loses its last dot
  const period = Math.floor(((len - 0.01) / n) * 100) / 100;
  return { strokeDasharray: `0.01 ${r2(period - 0.01)}`, strokeLinecap: "round" as const };
}

/* ------------------------------------------------------------------ */
/* Root: frame, color roles, motion control                            */
/* ------------------------------------------------------------------ */

/** off: no animation, the still shows. hold: animations applied but paused. run: playing. */
type Motion = "off" | "hold" | "run";

// how long a frozen frame holds after the diagram stops, so a panel that
// fades out (500 ms) fades a still frame, not a jump to the base state
const FREEZE_MS = 600;

/**
 * The SVG root of every diagram. It runs the motion only while the diagram is
 * on screen and `active`. Each start restarts every sequence at step 1: the
 * first frame holds for `lead` ms (while a panel fades in), then it plays.
 * Each stop freezes the current frame, then drops to the still.
 */
export function Diagram({
  label,
  viewBox,
  className = "",
  active = true,
  panel = false,
  lead = 0,
  restart,
  children,
}: {
  /** one sentence that states the idea */
  label: string;
  viewBox: string;
  className?: string;
  /** false in an inactive accordion panel: no motion, hidden from assistive tech */
  active?: boolean;
  /** true on the always-dark pillar panels (#1F1F1F ground) */
  panel?: boolean;
  /** ms to hold step 1 before it plays, for example while the panel fades in */
  lead?: number;
  /** a new value restarts every sequence at step 1 */
  restart?: string | number;
  children: ReactNode;
}) {
  const ref = useRef<SVGSVGElement>(null);
  const [inView, setInView] = useState(false);
  const [motion, setMotionState] = useState<Motion>("off");
  const motionRef = useRef<Motion>("off");
  const prev = useRef({ active, restart });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => setInView(entry.intersectionRatio >= 0.49), {
      threshold: [0, 0.5],
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  useEffect(() => {
    const setMotion = (m: Motion) => {
      motionRef.current = m;
      setMotionState(m);
    };
    const activated = active && !prev.current.active;
    const restarted = restart !== prev.current.restart;
    prev.current = { active, restart };
    const current = motionRef.current;
    let raf = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    if (!active) {
      // an inactive panel: freeze the frame while it fades out, then the still
      if (current !== "off") {
        setMotion("hold");
        timer = setTimeout(() => setMotion("off"), FREEZE_MS);
      }
    } else if (!inView) {
      // scrolled away: pause where it is, so a return resumes with no jump
      if (current === "run") setMotion("hold");
    } else if (current === "hold" && !activated && !restarted) {
      setMotion("run");
    } else {
      // a start: drop the animations for a frame so they restart, hold
      // step 1 (for the panel's fade-in when a panel opened), then play
      setMotion("off");
      raf = requestAnimationFrame(() => {
        raf = requestAnimationFrame(() => {
          setMotion("hold");
          timer = setTimeout(() => setMotion("run"), activated ? lead : 0);
        });
      });
    }
    return () => {
      cancelAnimationFrame(raf);
      if (timer) clearTimeout(timer);
    };
  }, [active, inView, lead, restart]);
  return (
    <svg
      ref={ref}
      viewBox={viewBox}
      role="img"
      aria-label={label}
      aria-hidden={active ? undefined : true}
      data-motion={motion}
      className={`${s.root} ${panel ? s.panel : ""} h-auto w-full select-none ${className}`}
    >
      {children}
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Parts                                                               */
/* ------------------------------------------------------------------ */

/** The boundary of a chain at its edge radius: open, gated or sealed. */
export function Boundary({ cx, cy, access, scale }: { cx: number; cy: number; access: Access; scale: Scale }) {
  if (access === "open") {
    return <circle cx={cx} cy={cy} r={scale.edge} fill="none" strokeWidth={1} className={s.lineStroke} />;
  }
  if (access === "gated") {
    return (
      <circle
        cx={cx}
        cy={cy}
        r={scale.edge}
        fill="none"
        strokeWidth={1.5}
        className={s.inkStroke}
        {...ringDash(scale.edge, scale.periods)}
      />
    );
  }
  return (
    <g fill="none" className={s.inkStroke}>
      <circle cx={cx} cy={cy} r={scale.edge - scale.seal} strokeWidth={1.5} />
      <circle cx={cx} cy={cy} r={scale.edge} strokeWidth={1} opacity={0.5} />
    </g>
  );
}

/**
 * A chain: validators on a ring, spokes from the core edge to each validator's
 * edge, the core with its red state dot, and the boundary. `named` validators
 * are filled; open validators (anyone can join) are hollow.
 */
export function Chain({
  cx,
  cy,
  access,
  scale = INSTRUMENT,
  named = true,
  boundary = true,
  omit = [],
}: {
  cx: number;
  cy: number;
  access: Access;
  scale?: Scale;
  named?: boolean;
  /** false to draw the boundary yourself (for example to animate it) */
  boundary?: boolean;
  /** validator slots to leave empty, by index from the top, clockwise */
  omit?: number[];
}) {
  const slots = Array.from({ length: scale.count }, (_, i) => -90 + (i * 360) / scale.count);
  return (
    <g>
      {boundary && <Boundary cx={cx} cy={cy} access={access} scale={scale} />}
      {slots.map((deg, i) =>
        omit.includes(i) ? null : <Validator key={i} cx={cx} cy={cy} deg={deg} scale={scale} named={named} />,
      )}
      <Core cx={cx} cy={cy} scale={scale} />
    </g>
  );
}

/** One validator in its slot, with its spoke. */
export function Validator({
  cx,
  cy,
  deg,
  scale,
  named = true,
}: {
  cx: number;
  cy: number;
  deg: number;
  scale: Scale;
  named?: boolean;
}) {
  const [x1, y1] = polar(cx, cy, scale.core, deg);
  const [x2, y2] = polar(cx, cy, scale.ring - scale.node, deg);
  const [x, y] = polar(cx, cy, scale.ring, deg);
  return (
    <g>
      <line x1={x1} y1={y1} x2={x2} y2={y2} strokeWidth={1} className={s.lineStroke} />
      <ValidatorNode x={x} y={y} scale={scale} named={named} />
    </g>
  );
}

/**
 * A validator node without its spoke: filled when named, hollow when open
 * (anyone can join). Pass `className` to fade one state over the other.
 */
export function ValidatorNode({
  x,
  y,
  scale,
  named = true,
  className = "",
}: {
  x: number;
  y: number;
  scale: Scale;
  named?: boolean;
  className?: string;
}) {
  if (named) return <circle cx={x} cy={y} r={scale.node} className={`${s.nodeFill} ${className}`} />;
  return (
    <g className={className}>
      <circle cx={x} cy={y} r={scale.node} strokeWidth={1.25} className={`${s.ground} ${s.nodeStroke}`} />
      {/* a center dot only where the node is large enough to hold it;
          on a small node it turns the validator into a target */}
      {scale.node >= 8 && <circle cx={x} cy={y} r={r2(scale.node * 0.32)} className={s.nodeFill} />}
    </g>
  );
}

/** The core of a chain and its red state dot (solid: the state is always there). */
export function Core({ cx, cy, scale }: { cx: number; cy: number; scale: Scale }) {
  return (
    <g>
      <circle cx={cx} cy={cy} r={scale.core} strokeWidth={1.5} className={`${s.ground} ${s.inkStroke}`} />
      <circle cx={cx} cy={cy} r={scale.dot} className={s.redFill} />
    </g>
  );
}

/**
 * A mono label. The anchor is corrected for the letter space that SVG adds
 * after the last glyph, so a centered label is centered on its ink.
 */
export function Label({
  x,
  y,
  anchor = "middle",
  size = INSTRUMENT.label,
  className = "",
  children,
}: {
  x: number;
  y: number;
  anchor?: "start" | "middle" | "end";
  size?: number;
  className?: string;
  children: ReactNode;
}) {
  const spacing = r2(size * 0.16);
  const dx = anchor === "middle" ? spacing / 2 : anchor === "end" ? spacing : 0;
  return (
    <text
      x={r2(x + dx)}
      y={y}
      textAnchor={anchor}
      fontSize={size}
      letterSpacing={spacing}
      className={`${s.label} ${className}`}
    >
      {children}
    </text>
  );
}

/**
 * The P-Chain line: tangent to the chains that stand on it, with a record
 * mark at each tangent point and the P-CHAIN label at its left end.
 */
export function PChainLine({
  x1,
  x2,
  y,
  records,
  scale = INSTRUMENT,
  label = true,
}: {
  x1: number;
  x2: number;
  y: number;
  /** x of each tangent point */
  records: number[];
  scale?: Scale;
  label?: boolean;
}) {
  const h = scale.record / 2;
  return (
    <g>
      <line x1={x1} y1={y} x2={x2} y2={y} strokeWidth={1} className={s.lineStroke} />
      {records.map((x) => (
        <rect key={x} x={r2(x - h)} y={r2(y - h)} width={scale.record} height={scale.record} className={s.mutedFill} />
      ))}
      {label && (
        // baseline 9 above the line: the glyphs clear its stroke by 8
        <Label x={x1} y={r2(y - 9)} anchor="start" size={scale.label}>
          P-CHAIN
        </Label>
      )}
    </g>
  );
}

/**
 * The lit state of a P-Chain record mark: an ink square over the muted mark,
 * same footprint. A chain reads its record (to verify a message) or writes it
 * (a validator joins or leaves). Animate its opacity; `lit` sets the still.
 */
export function RecordLit({
  x,
  y,
  scale = INSTRUMENT,
  lit = false,
  className = "",
}: {
  x: number;
  y: number;
  scale?: Scale;
  lit?: boolean;
  className?: string;
}) {
  const h = scale.record / 2;
  return (
    <rect
      x={r2(x - h)}
      y={r2(y - h)}
      width={scale.record}
      height={scale.record}
      opacity={lit ? 1 : 0}
      className={`${s.inkFill} ${className}`}
    />
  );
}

/**
 * A ring that grows from radius `r` and fades: a chain accepts (start at its
 * core + 2), a transaction is final (start at its final ring), or an actor
 * submits (muted, start at the actor). Animate transform (scale to 1.6, or
 * less where a label is near) and opacity, about 0.4 s ease-out. The stroke
 * keeps its 1 px weight while it grows: the one stroke that does not scale.
 */
export function Pulse({
  cx,
  cy,
  r,
  muted = false,
  className = "",
}: {
  cx: number;
  cy: number;
  r: number;
  /** muted for an outside actor (a submit ping), ink for a chain */
  muted?: boolean;
  className?: string;
}) {
  return (
    <circle
      cx={cx}
      cy={cy}
      r={r}
      fill="none"
      strokeWidth={1}
      vectorEffect="non-scaling-stroke"
      opacity={0}
      className={`${muted ? s.mutedStroke : s.inkStroke} ${s.selfOrigin} ${className}`}
    />
  );
}

/**
 * A dotted line for what is outside a chain or not yet on it (users, senders,
 * observers' probes) and for measurement lines. Muted round dots 1.5 wide,
 * one on each end. Start it one dot step (5) off an actor's edge; end it ON
 * the stroke it reaches.
 */
export function DottedLine({
  x1,
  y1,
  x2,
  y2,
  className = "",
}: {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  className?: string;
}) {
  return (
    <line
      x1={x1}
      y1={y1}
      x2={x2}
      y2={y2}
      strokeWidth={1.5}
      className={`${s.mutedStroke} ${className}`}
      {...dotted(Math.hypot(x2 - x1, y2 - y1))}
    />
  );
}

/** The owner approves: a check mark in a 10 x 10 box on (x, y). Ink, 1.5. `shown` sets the still. */
export function Check({ x, y, shown = false, className = "" }: { x: number; y: number; shown?: boolean; className?: string }) {
  return (
    <path
      d={`M${r2(x - 5)},${r2(y)} L${r2(x - 1.5)},${r2(y + 3.5)} L${r2(x + 5)},${r2(y - 3.5)}`}
      fill="none"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      opacity={shown ? 1 : 0}
      className={`${s.inkStroke} ${className}`}
    />
  );
}

/** A refusal: an X in a 10 x 10 box on (x, y). Ink, 1.5. Never red. `shown` sets the still. */
export function Cross({ x, y, shown = false, className = "" }: { x: number; y: number; shown?: boolean; className?: string }) {
  return (
    <path
      d={`M${r2(x - 5)},${r2(y - 5)} L${r2(x + 5)},${r2(y + 5)} M${r2(x + 5)},${r2(y - 5)} L${r2(x - 5)},${r2(y + 5)}`}
      fill="none"
      strokeWidth={1.5}
      strokeLinecap="round"
      opacity={shown ? 1 : 0}
      className={`${s.inkStroke} ${className}`}
    />
  );
}

/**
 * An actor outside the chain's validator set: a user, a sender, an observer, a
 * member inside a private chain, or a submit point. Muted, radius 4. Filled by
 * default; `hollow` for one that is not yet known or not yet sent.
 */
export function Actor({
  x,
  y,
  hollow = false,
  className = "",
}: {
  x: number;
  y: number;
  hollow?: boolean;
  className?: string;
}) {
  return hollow ? (
    <circle cx={x} cy={y} r={INSTRUMENT.actor} strokeWidth={1.25} className={`${s.ground} ${s.mutedStroke} ${className}`} />
  ) : (
    <circle cx={x} cy={y} r={INSTRUMENT.actor} className={`${s.mutedFill} ${className}`} />
  );
}
