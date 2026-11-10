"use client";

import type { CSSProperties } from "react";
import {
  Actor,
  Boundary,
  Core,
  Diagram,
  DottedLine,
  INSTRUMENT,
  Label,
  PChainLine,
  PILLAR_GROUND,
  Pulse,
  RecordLit,
  Validator,
  cls,
  polar,
  r2,
  type Scale,
} from "./kit";
import m from "./PrivacyDiagram.module.css";

/* ------------------------------------------------------------------ */
/* Privacy: one sealed L1 that stands on the P-Chain line. Inside,     */
/* three members send transactions to the core, one at a time, and     */
/* the core accepts each. Outside, four observers probe the seal: each */
/* probe hits the outer stroke, bounces and reads nothing. A reader at */
/* the right end of the P-Chain line reads the chain's record, and the */
/* line and the record light: the registry is public, the chain is     */
/* not. The timeline is in PrivacyDiagram.module.css.                  */
/* ------------------------------------------------------------------ */

type Pt = readonly [number, number];

/** the family's node, core, stroke and actor sizes on a larger ring and seal, to make room for members */
const S: Scale = { ...INSTRUMENT, ring: 56, edge: 84 };
const G = PILLAR_GROUND;
const CX = 360;
/** the outer seal is tangent to the P-Chain line, and its top is 16 from the frame's top */
const CY = G.y - S.edge;
/** a dotted line or a probe starts one dot step off its actor's edge */
const STEP = 5;
/** a probe is a hollow actor: its outer edge is half its 1.25 stroke past its radius */
const PROBE_OUT = S.actor + 0.625;

const vars = (v: Record<string, string>) => v as CSSProperties;
const px = (n: number) => `${r2(n)}px`;
const sec = (n: number) => `${n}s`;
const rot = (deg: number) => `rotate(${deg} ${CX} ${CY})`;

/* ---- members: between the validators and the inner seal, in free
   directions (between two validators, and 46 degrees or more from every
   probe's contact point). `d` is when the transaction leaves its member. */
const MEMBER_R = 68;
/** the run ends where the core's ground first hides the transaction whole */
const ABSORB_R = S.core - S.traveler;
const SENDS = [
  { deg: -60, d: -0.35, still: true }, // upper right: it leaves in the lead, so the hold frame shows it halfway
  { deg: 120, d: 1.9, still: false }, // lower left
  { deg: -120, d: 5.3, still: false }, // upper left
].map((s) => {
  const [x, y] = polar(CX, CY, MEMBER_R, s.deg);
  const [x1, y1] = polar(CX, CY, MEMBER_R - S.actor - STEP, s.deg);
  const [x2, y2] = polar(CX, CY, S.core, s.deg);
  return { ...s, x, y, lane: { x1, y1, x2, y2 } };
});
const TX = vars({
  "--absorb": px(ABSORB_R - MEMBER_R),
  // the still: halfway along the lane, where the hold frame shows it
  "--still": px(-29),
});

/* ---- observers: two rows, mirrored about the chain's axis. Each probe
   line runs from one dot step off its observer to the outer seal stroke. */
/** a stopped probe touches the outer seal stroke (1 unit wide), then bounces back */
const STOP_R = S.edge + 0.5 + PROBE_OUT;
const RECOIL = 2;
/** half the arc that lights where a probe hits the seal, in degrees */
const CONTACT_DEG = 5;
const OBSERVERS = [
  { key: "ur", x: 552, y: 52, d: 0.3, still: false },
  { key: "lr", x: 552, y: 148, d: 0.7, still: false },
  { key: "ul", x: 168, y: 52, d: 5.9, still: true },
  { key: "ll", x: 168, y: 148, d: 6.3, still: false },
].map((o) => {
  const dx = o.x - CX;
  const dy = o.y - CY;
  const d = Math.hypot(dx, dy);
  const ux = dx / d;
  const uy = dy / d;
  const gap = S.actor + STEP;
  return {
    ...o,
    deg: r2((Math.atan2(dy, dx) * 180) / Math.PI),
    line: {
      x1: r2(o.x - ux * gap),
      y1: r2(o.y - uy * gap),
      x2: r2(CX + ux * S.edge),
      y2: r2(CY + uy * S.edge),
    },
    style: vars({ "--d": sec(o.d), "--reach": px(d - gap - STOP_R) }),
  };
});
/* drawn pointing east; each observer's group rotates it into place */
const [ARC_AX, ARC_AY] = polar(CX, CY, S.edge, -CONTACT_DEG);
const [ARC_BX, ARC_BY] = polar(CX, CY, S.edge, CONTACT_DEG);
const CONTACT_ARC = `M${ARC_AX},${ARC_AY} A${S.edge},${S.edge} 0 0 1 ${ARC_BX},${ARC_BY}`;

/* ---- the reader: at the right end of the P-Chain line, flush with it.
   Its probe runs along the line and stops against the record's right edge. */
const READER: Pt = [G.x2 - S.actor, G.y];
const RECORD_EDGE = CX + S.record / 2;
const READ_STOP = r2(RECORD_EDGE + PROBE_OUT);
const READ_D = 2.9;
const READ = vars({ "--d": sec(READ_D) });
const READ_PROBE = vars({ "--d": sec(READ_D), "--reach": px(READER[0] - S.actor - STEP - READ_STOP) });

const VALIDATORS = Array.from({ length: S.count }, (_, i) => -90 + (i * 360) / S.count);
const MOTION = vars({ "--recoil": px(RECOIL) });

export default function PrivacyDiagram({ active = true }: { active?: boolean }) {
  return (
    <Diagram
      label="Members of a private L1 send transactions inside its boundary and observers outside cannot read them, but anyone can read the chain and its validator set on the P-Chain."
      viewBox="0 0 720 240"
      panel
      active={active}
      lead={700}
      className="max-w-[720px]"
    >
      <g style={MOTION}>
        {/* the observers' probe lines end on the outer seal stroke */}
        {OBSERVERS.map((o) => (
          <DottedLine key={`l${o.key}`} {...o.line} />
        ))}

        {/* the seal, then the ground line with the chain's record */}
        <Boundary cx={CX} cy={CY} access="sealed" scale={S} />
        <PChainLine x1={G.x1} x2={G.x2} y={G.y} records={[CX]} />

        {/* the read: the line from the reader to the record, and the record, light */}
        <g opacity={1} className={m.read} style={READ}>
          <line x1={RECORD_EDGE} y1={G.y} x2={READER[0] - S.actor} y2={G.y} strokeWidth={1} className={cls.inkStroke} />
          <RecordLit x={CX} y={G.y} lit />
        </g>

        {/* inside: each member's lane to the core, between two validators */}
        {SENDS.map((s) => (
          <DottedLine key={`n${s.deg}`} {...s.lane} />
        ))}
        {VALIDATORS.map((deg) => (
          <Validator key={deg} cx={CX} cy={CY} deg={deg} scale={S} />
        ))}
        {/* each transaction starts under its member and ends under the core */}
        {SENDS.map((s) => (
          <g key={`t${s.deg}`} transform={rot(s.deg)} style={TX}>
            <circle
              cx={r2(CX + MEMBER_R)}
              cy={CY}
              r={S.traveler}
              style={vars({ "--d": sec(s.d) })}
              className={`${cls.redFill} ${m.tx} ${s.still ? m.txStill : ""}`}
            />
          </g>
        ))}
        {SENDS.map((s) => (
          <Actor key={`m${s.deg}`} x={s.x} y={s.y} />
        ))}
        <Core cx={CX} cy={CY} scale={S} />
        {SENDS.map((s) => (
          <g key={`a${s.deg}`} style={vars({ "--d": sec(s.d) })}>
            <Pulse cx={CX} cy={CY} r={S.core + 2} className={m.accept} />
          </g>
        ))}

        {/* where a probe hits, the seal lights */}
        {OBSERVERS.map((o) => (
          <g key={`c${o.key}`} transform={rot(o.deg)}>
            <path
              d={CONTACT_ARC}
              fill="none"
              strokeWidth={1.5}
              style={o.style}
              className={`${cls.inkStroke} ${m.contact} ${o.still ? m.contactStill : ""}`}
            />
          </g>
        ))}
        {/* each probe starts one dot step off its observer */}
        {OBSERVERS.map((o) => (
          <g key={`p${o.key}`} transform={rot(o.deg)}>
            <g style={o.style} className={`${m.probe} ${o.still ? m.probeStill : ""}`}>
              <Actor x={r2(CX + STOP_R)} y={CY} hollow />
            </g>
          </g>
        ))}
        <g style={READ_PROBE} className={m.readProbe}>
          <Actor x={READ_STOP} y={G.y} hollow />
        </g>

        {/* the outside actors, over their probes' start */}
        {OBSERVERS.map((o) => (
          <Actor key={`o${o.key}`} x={o.x} y={o.y} />
        ))}
        <Actor x={READER[0]} y={READER[1]} />

        <Label x={CX} y={G.nameY}>
          PRIVATE L1
        </Label>
      </g>
    </Diagram>
  );
}
