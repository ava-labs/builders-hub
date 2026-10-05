"use client";

import type { CSSProperties } from "react";
import { Actor, Chain, Cross, Diagram, DottedLine, INSTRUMENT, Label, PChainLine, PILLAR_GROUND, Pulse, cls, polar, r2 } from "./kit";
import m from "./ComplianceDiagram.module.css";

/* ------------------------------------------------------------------ */
/* Compliance: one permissioned L1. Its virtual machine holds the      */
/* allowlist, so the check is at the core, not at the edge. Each       */
/* sender has its own lane. Both transactions cross the gated edge     */
/* freely, as users do in YOUR CHAIN Permissioned (the gate admits     */
/* validators, not users). The approved transaction reaches the core   */
/* and the core accepts it. The unknown one stops short of the core;   */
/* the core checks it and it turns into an X.                          */
/* The timeline is in ComplianceDiagram.module.css.                    */
/* ------------------------------------------------------------------ */

type Pt = readonly [number, number];

const I = INSTRUMENT;
const G = PILLAR_GROUND;

// the chain stands on the P-Chain line, tangent to it
const CX = 480;
const CY = G.y - I.edge;

// The senders stand in one column, mirrored about the core's axis. Each
// lane ends on the dashed edge at a free direction between validators:
// the approved sender's at 240 degrees (upper left), the unknown
// sender's at 120 (lower left). A dash is centered on every multiple of
// 12 degrees, so both lanes meet a dash.
const SENDER_X = 200;
const APPROVED: Pt = [SENDER_X, CY - 24];
const UNKNOWN: Pt = [SENDER_X, CY + 24];
const APPROVED_DEG = 240;
const UNKNOWN_DEG = 120;
const APPROVED_PORT = polar(CX, CY, I.edge, APPROVED_DEG);
const UNKNOWN_PORT = polar(CX, CY, I.edge, UNKNOWN_DEG);

// Inside the edge, each transaction runs straight at the core on its
// own direction. The approved one runs on until the core's ground hides
// it whole.
const ABSORB = polar(CX, CY, I.core - I.traveler, APPROVED_DEG);
// The unknown one stops 28 from the core's center, where the ring and
// its X sit centered in the gap between the core and the validators at
// 90 and 150: the ring clears the core by 8.6 and each validator by 7.4,
// the X clears the core by 5.8, the validators by 4.4 and the spokes by
// 5.9. (At 24 the ring clears the validators by 8.2, but the X's corner
// comes within 1.8 of the core.)
const STOP = polar(CX, CY, 28, UNKNOWN_DEG);
// the still: the approved transaction just inside the edge, on its way
// in: 7.25 clear of the edge stroke and 13.4 clear of the validators at
// 210 and 270, outside their ring, so it does not read as a validator
const STILL = polar(CX, CY, 44, APPROVED_DEG);

// ALLOWLIST names the rule that the core enforces. It sits right of the
// chain on the core's axis, across the free direction at 0 degrees, as
// FINAL sits right of its ring in Performance. The baseline centers the
// capitals on the axis; the text starts 11 clear of the edge stroke.
const RULE: Pt = [CX + I.edge + 12, CY + 4];

// a lane starts one dot step off its sender's edge
const DOT_STEP = 5;

function toward(from: Pt, to: Pt, d: number): Pt {
  const len = Math.hypot(to[0] - from[0], to[1] - from[1]);
  return [r2(from[0] + ((to[0] - from[0]) * d) / len), r2(from[1] + ((to[1] - from[1]) * d) / len)];
}

const LANES: [Pt, Pt][] = [
  [toward(APPROVED, APPROVED_PORT, I.actor + DOT_STEP), APPROVED_PORT],
  [toward(UNKNOWN, UNKNOWN_PORT, I.actor + DOT_STEP), UNKNOWN_PORT],
];

/** Keyframe stops as CSS variables, relative to the element's still position. */
function stops(still: Pt, points: Record<string, Pt>): CSSProperties {
  const style: Record<string, string> = {};
  for (const [k, [x, y]] of Object.entries(points)) {
    style[`--${k}x`] = `${r2(x - still[0])}px`;
    style[`--${k}y`] = `${r2(y - still[1])}px`;
  }
  return style as CSSProperties;
}

const RED_PATH = stops(STILL, { a: APPROVED, p: APPROVED_PORT, c: ABSORB });
const UNKNOWN_PATH = stops(STOP, { b: UNKNOWN, p: UNKNOWN_PORT });

export default function ComplianceDiagram({ active = true }: { active?: boolean }) {
  return (
    <Diagram
      label="An allowlist in the L1's virtual machine admits transactions from approved senders and stops all others."
      viewBox="0 0 720 240"
      panel
      active={active}
      lead={700}
      className="max-w-[720px]"
    >
      <PChainLine x1={G.x1} x2={G.x2} y={G.y} records={[CX]} />
      <Label x={CX} y={G.nameY}>
        YOUR L1
      </Label>

      {/* one lane per sender */}
      {LANES.map(([a, b]) => (
        <DottedLine key={`${a[0]},${a[1]}`} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} />
      ))}

      {/* senders: approved (filled) and unknown (hollow) */}
      <Actor x={APPROVED[0]} y={APPROVED[1]} />
      <Actor x={UNKNOWN[0]} y={UNKNOWN[1]} hollow />

      {/* the transactions, under the chain: they cross the dashed edge
          freely, and the core's ground takes the approved one in */}
      <circle
        cx={STILL[0]}
        cy={STILL[1]}
        r={I.traveler}
        className={`${cls.redFill} ${cls.selfOrigin} ${m.red}`}
        style={RED_PATH}
      />
      <g style={UNKNOWN_PATH}>
        <Actor x={STOP[0]} y={STOP[1]} hollow className={`${cls.selfOrigin} ${m.unknown}`} />
      </g>

      <Chain cx={CX} cy={CY} access="gated" />

      {/* the core checks the unknown transaction (a muted ring that closes
          in) and accepts the approved one (the kit's accept pulse) */}
      <Pulse cx={CX} cy={CY} r={I.core} muted className={m.check} />
      <Pulse cx={CX} cy={CY} r={I.core + 2} className={m.accept} />

      {/* the refusal, where the unknown transaction stopped */}
      <Cross x={STOP[0]} y={STOP[1]} shown className={`${cls.selfOrigin} ${m.refuse}`} />

      <Label x={RULE[0]} y={RULE[1]} anchor="start">
        ALLOWLIST
      </Label>
    </Diagram>
  );
}
