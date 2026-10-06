"use client";

import type { CSSProperties } from "react";
import { Actor, Diagram, DottedLine, INSTRUMENT, Label, Pulse, cls, r2 } from "./kit";
import m from "./PerformanceDiagram.module.css";

/* ------------------------------------------------------------------ */
/* Performance: two lanes on one time scale, in real time               */
/*                                                                      */
/* Finality is one event, so a lane is a plain hairline from the submit */
/* point (an outside actor) to a FINAL ring: no ticks to count. The     */
/* only ticks are on the time ruler under the lanes, and dotted         */
/* measurement lines put each ring on its time bound: 100 ms on an L1,  */
/* 1 s on the C-Chain. "Under" reads as a ring on its bound.            */
/* The C-Chain lane is on top (the tagline order), so neither           */
/* measurement line crosses a lane.                                     */
/* ------------------------------------------------------------------ */

/** x of the submit point (time 0) and units per second */
const T0 = 124;
const PER_S = 480;
const at = (s: number) => r2(T0 + PER_S * s);

const ACTOR = INSTRUMENT.actor;
const RING = INSTRUMENT.final;
/** the outer edge of a final ring's 1.5 stroke: a measurement line's last dot sits on it */
const RING_EDGE = RING + 0.75;
/** the outer edge of an origin's 1.25 stroke */
const ACTOR_EDGE = ACTOR + 0.625;
/** a traveler starts this far right of its origin center, so the hollow actor ring shows in the hold frame */
const START = 4;

const LANES = [
  { key: "c", name: "C-CHAIN", y: 80, x: at(1), travel: m.travelC, pulse: m.finalC },
  { key: "l1", name: "YOUR L1", y: 120, x: at(0.1), travel: m.travelL1, pulse: m.finalL1 },
] as const;

const RULER_Y = 160;
const TICK = 4;
const MAJOR = 8;
/** a tick every 100 ms; the ticks at 0, 100 ms and 1 s are major */
const TICKS = Array.from({ length: 11 }, (_, i) => ({ x: at(i / 10), major: i === 0 || i === 1 || i === 10 }));
/** no label at 0: SUBMITTED names time zero */
const MARKS = [
  { x: at(0.1), text: "100 MS" },
  { x: at(1), text: "1 S" },
];

/** mono cap height is about 0.72 em: this offset centers a label on a lane */
const MID = 4;
/** from a mark's radius to the label beside it; FINAL also clears the full final pulse (r 18) by 6 or more */
const LABEL_GAP = 14;
/** SUBMITTED baseline: about 11 above the top of the C-Chain origin */
const SUBMIT_Y = LANES[0].y - 16;
/** SUBMITTED starts on the origins' left edge: it heads the origin column and clears C-CHAIN */
const SUBMIT_X = r2(T0 - ACTOR_EDGE);

export default function PerformanceDiagram({ active = true }: { active?: boolean }) {
  return (
    <Diagram
      label="A transaction is final in under 100 milliseconds on an L1 and in under 1 second on the C-Chain."
      viewBox="0 0 720 240"
      panel
      active={active}
      lead={700}
      className="max-w-[720px]"
    >
      {/* time ruler: the ground line of this instrument */}
      <g strokeWidth={1} className={cls.lineStroke}>
        <line x1={T0} y1={RULER_Y} x2={at(1)} y2={RULER_Y} />
        {TICKS.map(({ x, major }) => (
          <line key={x} x1={x} y1={RULER_Y} x2={x} y2={RULER_Y + (major ? MAJOR : TICK)} />
        ))}
      </g>
      {/* baseline 17 under the major ticks: the cap tops clear their stroke by 8 */}
      {MARKS.map(({ x, text }) => (
        <Label key={text} x={x} y={RULER_Y + MAJOR + 17}>
          {text}
        </Label>
      ))}

      {/* measurement lines: from the ruler up to the outer edge of each final ring */}
      {LANES.map(({ key, x, y }) => (
        <DottedLine key={key} x1={x} y1={RULER_Y} x2={x} y2={r2(y + RING_EDGE)} />
      ))}

      <Label x={SUBMIT_X} y={SUBMIT_Y} anchor="start">
        SUBMITTED
      </Label>

      {LANES.map(({ key, name, x, y, travel, pulse }) => (
        <g key={key}>
          <Label x={T0 - ACTOR - LABEL_GAP} y={y + MID} anchor="end">
            {name}
          </Label>
          <line x1={T0 + ACTOR} y1={y} x2={x - RING} y2={y} strokeWidth={1} className={cls.lineStroke} />

          {/* submit point: an outside actor, and its ping */}
          <Pulse cx={T0} cy={y} r={ACTOR} muted className={m.ping} />
          <Actor x={T0} y={y} hollow />

          {/* final ring: the pulse sits under it, so it leaves from the ring's edge */}
          <Pulse cx={x} cy={y} r={RING} className={pulse} />
          <circle cx={x} cy={y} r={RING} strokeWidth={1.5} className={`${cls.ground} ${cls.inkStroke}`} />
          <Label x={x + RING + LABEL_GAP} y={y + MID} anchor="start">
            FINAL
          </Label>

          {/* the transaction: drawn final in its ring, the motion starts it on the origin's right side */}
          <circle
            cx={x}
            cy={y}
            r={INSTRUMENT.traveler}
            className={`${cls.redFill} ${travel}`}
            style={{ "--from": `${r2(T0 + START - x)}px` } as CSSProperties}
          />
        </g>
      ))}
    </Diagram>
  );
}
