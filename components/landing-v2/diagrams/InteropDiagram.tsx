"use client";

import type { CSSProperties } from "react";
import {
  Chain,
  Diagram,
  INSTRUMENT,
  Label,
  PChainLine,
  PILLAR_GROUND,
  Pulse,
  RecordLit,
  cls,
  polar,
  r2,
  type Access,
} from "./kit";
import m from "./InteropDiagram.module.css";

/* ------------------------------------------------------------------ */
/* Interoperability: three L1s message each other directly. ICM is     */
/* point to point: the source validators sign, one message goes to one */
/* destination, and the destination checks the source's validator set */
/* on the P-Chain, then accepts. No relay ring and no hub.             */
/* All three chains have the edge radius, so one P-Chain line is       */
/* tangent to all of them. The timeline is in InteropDiagram.module.css */
/* ------------------------------------------------------------------ */

const I = INSTRUMENT;
/** the P-Chain line, at the one height that every pillar uses */
const GROUND = PILLAR_GROUND.y;
/** the chain row stands on the line: each chain is tangent to it */
const CY = GROUND - I.edge;
const NAME_Y = PILLAR_GROUND.nameY;
/** top of the arc lane: with the chain row at 128, the ink sits on the frame's optical center */
const APEX = 24;

const CHAINS: { name: string; cx: number; access: Access; named: boolean }[] = [
  { name: "PUBLIC", cx: 168, access: "open", named: false },
  { name: "PERMISSIONED", cx: 360, access: "gated", named: true },
  { name: "PRIVATE", cx: 552, access: "sealed", named: true },
];
const XS = CHAINS.map((c) => c.cx);
const SLOTS = Array.from({ length: I.count }, (_, i) => -90 + (i * 360) / I.count);

// Neighbors: port to port on the horizontal, a free direction (0 and 180 degrees).
const STRAIGHT = [
  [XS[0] + I.edge, XS[1] - I.edge],
  [XS[1] + I.edge, XS[2] - I.edge],
];

// PUBLIC to PRIVATE: an arc over PERMISSIONED, from the port at -60 degrees
// to the port at -120. Both ends are on the edge stroke.
const [P1X, P1Y] = polar(XS[0], CY, I.edge, -60);
const [P2X, P2Y] = polar(XS[2], CY, I.edge, -120);
const HALF = (P2X - P1X) / 2;
const SAG = P1Y - APEX;
const ARC_R = r2((HALF * HALF + SAG * SAG) / (2 * SAG));
const ARC_CX = r2((P1X + P2X) / 2);
const ARC_CY = r2(APEX + ARC_R);
const ARC_D = `M${P1X} ${P1Y}A${ARC_R} ${ARC_R} 0 0 1 ${P2X} ${P2Y}`;
/** CSS can only translate on a line, so the traveler rides the arc as a rotation about its center */
const SWEEP = r2((2 * Math.asin(HALF / ARC_R) * 180) / Math.PI);

/*
 * Timing in s. The keyframe percentages in InteropDiagram.module.css are
 * t / 9 s: if you change a value here, change the percentages there too.
 */
/** the sign flash runs clockwise from the top validator */
const STAGGER = 0.05;
/** the arc hop (1.0 s) is 0.3 s longer than a straight hop (0.7 s), so the arc message verifies and accepts later */
const ARC_LAG = 0.3;
/**
 * One message at a time in the 9 s cycle. `at` is the window start: the arc
 * message ends at 2.75 s, the second at 5.35 s and the third at 7.95 s, so
 * the panel change comes in the 1.05 s rest: about 8.3 s into the run after
 * the 0.7 s lead, and about 8.97 s on the first view (no lead).
 */
const MESSAGES = [
  { from: 0, to: 2, at: 0, lag: ARC_LAG }, // PUBLIC to PRIVATE, on the arc
  { from: 1, to: 0, at: 2.9, lag: 0 }, // PERMISSIONED to PUBLIC
  { from: 2, to: 1, at: 5.5, lag: 0 }, // PRIVATE to PERMISSIONED
];

/** custom properties for the CSS module: a delay in s, translations in user units */
function vars(v: Record<string, string | number>, extra: CSSProperties = {}): CSSProperties {
  return { ...extra, ...v } as CSSProperties;
}
const delay = (s: number) => `${r2(s)}s`;

/**
 * Verify: the stretch of the P-Chain line from the receiver's record to the
 * sender's record. Each piece ends on a record's edge, and the stretch breaks
 * around a record between the two, so it passes under that mark as the line does.
 */
function readSpan(from: number, to: number): [number, number][] {
  const h = I.record / 2;
  const lo = Math.min(XS[from], XS[to]);
  const hi = Math.max(XS[from], XS[to]);
  const stops = XS.filter((x) => x >= lo && x <= hi);
  return stops.slice(1).map((x, k) => [stops[k] + h, x - h]);
}
const READ_SPANS = MESSAGES.map(({ from, to }) => readSpan(from, to));

export default function InteropDiagram({ active = true }: { active?: boolean }) {
  return (
    <Diagram
      label="Public, permissioned and private L1s message each other directly, and the receiving chain checks the sender's validator set on the P-Chain before it accepts."
      viewBox="0 0 720 240"
      panel
      active={active}
      lead={700}
      className="max-w-[720px]"
    >
      {/* lanes: each ends on the outermost stroke of both chains */}
      <g fill="none" strokeWidth={1} className={cls.lineStroke}>
        {STRAIGHT.map(([x1, x2]) => (
          <line key={x1} x1={x1} y1={CY} x2={x2} y2={CY} />
        ))}
        <path d={ARC_D} />
      </g>

      {CHAINS.map((c) => (
        <Chain key={c.name} cx={c.cx} cy={CY} access={c.access} named={c.named} />
      ))}

      <PChainLine x1={PILLAR_GROUND.x1} x2={PILLAR_GROUND.x2} y={GROUND} records={XS} />

      {/* verify: while the traveler waits at the port, the receiver reads the
          sender's validator set: the P-Chain line lights from the receiver's
          record to the sender's, and the sender's record lights. The group's
          opacity sets the still: message 1's verify moment. */}
      {MESSAGES.map(({ from, at, lag }, i) => (
        <g key={`read-${i}`} opacity={i === 0 ? 1 : 0} className={m.read} style={vars({ "--d": delay(at + lag) })}>
          {READ_SPANS[i].map(([x1, x2]) => (
            <line key={x1} x1={x1} y1={GROUND} x2={x2} y2={GROUND} strokeWidth={1} className={cls.inkStroke} />
          ))}
          <RecordLit x={XS[from]} y={GROUND} lit />
        </g>
      ))}

      {/* sign: an ink disc flashes over each source validator, clockwise from the top */}
      {MESSAGES.map(({ from, at }, i) =>
        SLOTS.map((deg, k) => {
          const [x, y] = polar(XS[from], CY, I.ring, deg);
          return (
            <circle
              key={`sign-${i}-${k}`}
              cx={x}
              cy={y}
              r={I.node}
              className={`${cls.inkFill} ${cls.selfOrigin} ${m.sign}`}
              style={vars({ "--d": delay(at + k * STAGGER) })}
            />
          );
        }),
      )}

      {/* accept: the destination core pulses once. The ring starts 2 off the
          core so that it is clear of the core stroke from its first frame. */}
      {MESSAGES.map(({ to, at, lag }, i) => (
        <g key={`accept-${i}`} style={vars({ "--d": delay(at + lag) })}>
          <Pulse cx={XS[to]} cy={CY} r={I.core + 2} className={m.accept} />
        </g>
      ))}

      {/* travelers: one message at a time, core to core. The arc traveler's
          base transforms hold it at PRIVATE's port: the still. */}
      <g className={m.arcIn} style={vars({ "--in-x": `${r2(XS[2] - P2X)}px`, "--in-y": `${r2(CY - P2Y)}px` })}>
        <g
          className={m.arcRide}
          style={vars({ "--sweep": `${SWEEP}deg` }, { transformOrigin: `${ARC_CX}px ${ARC_CY}px`, transformBox: "view-box" })}
        >
          <g className={m.arcOut} style={vars({ "--out-x": `${r2(P1X - XS[0])}px`, "--out-y": `${r2(P1Y - CY)}px` })}>
            <circle cx={XS[0]} cy={CY} r={I.traveler} className={cls.redFill} />
          </g>
        </g>
      </g>
      {MESSAGES.slice(1).map(({ from, to, at }) => {
        const dir = Math.sign(XS[to] - XS[from]);
        const port = XS[to] - dir * I.edge;
        return (
          <g
            key={`hop-${from}`}
            className={m.hop}
            style={vars({
              "--d": delay(at),
              "--hop": `${port - XS[from]}px`,
              "--enter": `${XS[to] - XS[from]}px`,
            })}
          >
            <circle cx={XS[from]} cy={CY} r={I.traveler} className={cls.redFill} />
          </g>
        );
      })}

      {CHAINS.map((c) => (
        <Label key={c.name} x={c.cx} y={NAME_Y}>
          {c.name}
        </Label>
      ))}
    </Diagram>
  );
}
