"use client";

import { useState, type CSSProperties, type ReactNode } from "react";
import {
  Actor,
  Boundary,
  Check,
  Core,
  Cross,
  Diagram,
  DottedLine,
  Label,
  PChainLine,
  Pulse,
  RecordLit,
  STAGE,
  ValidatorNode,
  cls,
  polar,
} from "./kit";
import m from "./ChainDiagram.module.css";

/*
 * YOUR CHAIN: one L1 on the stage scale, in three access modes. Eight
 * validator slots 45 degrees apart, the first at the top. The chain stands
 * on the P-Chain line; P-CHAIN sits above the line's left end and YOUR
 * CHAIN under the line.
 * Public: users on the diagonals send through the open edge; a validator
 * joins the open east slot and the P-Chain records it. Until a validator
 * takes it, the open slot shows as an empty seat: a muted ring, no spoke.
 * Permissioned: users still send freely; two candidates compete for the
 * east slot. One holds on the gate while the other waits below it; the
 * owner refuses the first (X) and approves the second (check).
 * Private: sealed, nothing outside; four members inside send to the core,
 * one at a time, in an order that does not sweep around the ring.
 * The timeline is in ChainDiagram.module.css.
 */

export type ChainMode = "public" | "permissioned" | "private";

const LABELS: Record<ChainMode, string> = {
  public: "A public L1: anyone sends transactions, and any validator can join.",
  permissioned: "A permissioned L1: the owner approves each validator, and anyone still sends transactions.",
  private: "A private L1: only members send transactions, and transactions and state stay inside its boundary.",
};

/* Frame: cropped to the ink. The P-Chain line runs 25 past the edge
   stroke, and the frame keeps 4 outside it. */
const LINE_HALF = 204;
const VIEW_W = 2 * LINE_HALF + 8;
const VIEW_H = 392;
const CX = VIEW_W / 2;
const CY = 184;
const GROUND = CY + STAGE.edge;
const NAME_Y = GROUND + 24; // the cap top clears the lit record by 11

/* Radii */
const USER = 200; // users wait here, on the diagonals
const OUT = 196; // a candidate waits here, on the east radial: its edge meets the line end
const GATE = STAGE.edge;
const SLOT = STAGE.ring;
const MEMBER = 150; // members, inside the seal
const STEP = 5; // a dotted line starts one dot step off its actor

const EAST = 2; // the open slot
const SLOTS = Array.from({ length: STAGE.count }, (_, i) => -90 + (i * 360) / STAGE.count);
const FIXED = SLOTS.filter((_, i) => i !== EAST);

const spoke = (deg: number) => {
  const [x1, y1] = polar(CX, CY, STAGE.core, deg);
  const [x2, y2] = polar(CX, CY, SLOT - STAGE.node, deg);
  return { x1, y1, x2, y2 };
};
const SPOKES = FIXED.map((deg) => ({ deg, ...spoke(deg) }));
const EAST_SPOKE = spoke(0);
const NODES = FIXED.map((deg) => polar(CX, CY, SLOT, deg));

/** an actor on a radial, with its dotted line from one step off its edge to `end` */
function actor(deg: number, r: number, end: number) {
  const [x, y] = polar(CX, CY, r, deg);
  const [x1, y1] = polar(CX, CY, r - STAGE.actor - STEP, deg);
  const [x2, y2] = polar(CX, CY, end, deg);
  return { deg, x, y, x1, y1, x2, y2 };
}
/* users on the diagonals: each line ends on its validator's stroke */
const NW = -135;
const NE = -45;
const SE = 45;
const SW = 135;
const USERS = [NW, NE, SE, SW].map((deg) => actor(deg, USER, SLOT + STAGE.node));
/* four members at odd multiples of 22.5 degrees, 90 degrees apart: each
   line passes between two validators and ends on the core's stroke */
const MA = -112.5;
const MB = -22.5;
const MC = 67.5;
const MD = 157.5;
const MEMBERS = [MA, MB, MC, MD].map((deg) => actor(deg, MEMBER, STAGE.core));

/* Transactions: `d` is the departure in s on the 9 s loop; `at` puts the
   traveler in the still, at a radius on its path (none: hidden). */
type Send = { deg: number; d: number; at?: number };
const PUBLIC_SENDS: Send[] = [
  { deg: NW, d: 0.1, at: 68 },
  { deg: SW, d: 0.8, at: 152 },
  { deg: NW, d: 2 },
  { deg: NE, d: 4 },
  { deg: SE, d: 6.3 },
];
const PERMISSIONED_SENDS: Send[] = [
  { deg: SW, d: 0, at: 72 },
  { deg: NW, d: 0.7, at: 156 },
  { deg: SW, d: 2.75 },
  { deg: NE, d: 4.85 },
  { deg: SE, d: 6.8 },
];
/* one member transaction at a time, 1.5 s apart: across, a quarter turn,
   across, back a quarter turn, across, so the order never sweeps */
const PRIVATE_SENDS: Send[] = [
  { deg: MA, d: 0.2, at: 88 },
  { deg: MC, d: 1.7 },
  { deg: MD, d: 3.2 },
  { deg: MB, d: 4.7 },
  { deg: MA, d: 6.2 },
  { deg: MC, d: 7.7 },
];

/* approval and refusal marks: up and out from a candidate on the gate */
const MARK_X = CX + 196;
const MARK_Y = CY - 16;
/* candidate 2 waits below the gate, 18 clear of candidate 1 on it */
const [WAIT_X, WAIT_Y] = polar(0, 0, OUT, 9);

/** custom properties for the CSS module */
const vars = (v: Record<string, string | number>) => v as CSSProperties;
const px = (n: number) => `${n}px`;
/* the radii the CSS module moves parts between, in user units */
const RADII = vars({
  "--user": px(USER),
  "--out": px(OUT),
  "--gate": px(GATE),
  "--slot": px(SLOT),
  "--member": px(MEMBER),
  "--wait-x": px(WAIT_X),
  "--wait-y": px(WAIT_Y),
});

/** Red travelers on their radials, drawn at the center and moved out by the CSS. */
function Travelers({ sends, className }: { sends: Send[]; className: string }) {
  return (
    <>
      {sends.map(({ deg, d, at }) => (
        <g key={`${deg}-${d}`} transform={`rotate(${deg} ${CX} ${CY})`}>
          <circle
            cx={CX}
            cy={CY}
            r={STAGE.traveler}
            className={`${cls.redFill} ${className}`}
            style={vars({ "--d": `${d}s`, "--at": px(at ?? 0), "--show": at ? 1 : 0 })}
          />
        </g>
      ))}
    </>
  );
}

/** The core accepts each transaction: one pulse per traveler, on its clock, from core + 2 (the kit spec). */
function Accepts({ sends, className }: { sends: Send[]; className: string }) {
  return (
    <>
      {sends.map(({ deg, d }) => (
        <g key={`${deg}-${d}`} style={vars({ "--d": `${d}s` })}>
          <Pulse cx={CX} cy={CY} r={STAGE.core + 2} className={className} />
        </g>
      ))}
    </>
  );
}

/** The open east seat: a muted ring in the empty slot, with no spoke. It hides as a validator takes it. */
function Seat({ className }: { className: string }) {
  return (
    <circle
      cx={CX + SLOT}
      cy={CY}
      r={STAGE.node}
      fill="none"
      strokeWidth={1.25}
      className={`${cls.mutedStroke} ${className}`}
    />
  );
}

/**
 * A mode layer. It cross-fades with the mode. While it is off, its motion
 * freezes where it is (no jump during the fade); `run` remounts the inner
 * group, so the sequence starts at step 1 when the mode turns on. On a
 * click on the mode that shows, `replay` is the old run: it freezes and
 * fades out while the new run fades in.
 */
function Layer({ on, run = 0, replay, children }: { on: boolean; run?: number; replay?: number; children: ReactNode }) {
  const keys = replay === undefined ? [run] : [replay, run];
  return (
    <g className={`${m.mode} ${on ? "" : m.hold}`} style={{ opacity: on ? 1 : 0 }}>
      {keys.map((k) =>
        k === replay ? (
          <g key={k} className={`${m.mode} ${m.hold}`} style={{ opacity: 0 }}>
            {children}
          </g>
        ) : (
          <g key={k} className={replay === undefined ? undefined : m.enter}>
            {children}
          </g>
        ),
      )}
    </g>
  );
}

type Runs = Record<ChainMode, number>;
type Seen = { mode: ChainMode; cycle: number; runs: Runs; replay?: number };

export default function ChainDiagram({
  mode,
  cycle = 0,
  className = "w-full",
}: {
  mode: ChainMode;
  cycle?: number;
  /** the wrapper's width (the stage keeps its 464 px cap); the sub-lg stage bleeds through the card padding */
  className?: string;
}) {
  // each mode's run key: it counts when that mode turns on, and a click
  // (a new selector cycle) on the mode that shows restarts it too; then
  // the old run cross-fades out (`replay`)
  const [seen, setSeen] = useState<Seen>({ mode, cycle, runs: { public: 0, permissioned: 0, private: 0 } });
  if (seen.mode !== mode || seen.cycle !== cycle) {
    const replay = seen.mode === mode ? seen.runs[mode] : undefined;
    setSeen({ mode, cycle, runs: { ...seen.runs, [mode]: seen.runs[mode] + 1 }, replay });
  }
  const { runs, replay } = seen;
  const isPublic = mode === "public";
  const isPermissioned = mode === "permissioned";
  const isPrivate = mode === "private";
  const replayIf = (on: boolean) => (on ? replay : undefined);

  return (
    <div className={`max-w-[464px] ${className}`}>
      <Diagram label={LABELS[mode]} viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}>
        <g style={RADII}>
          {/* boundaries: open, gated, sealed */}
          <Layer on={isPublic}>
            <Boundary cx={CX} cy={CY} access="open" scale={STAGE} />
          </Layer>
          <Layer on={isPermissioned}>
            <Boundary cx={CX} cy={CY} access="gated" scale={STAGE} />
          </Layer>
          <Layer on={isPrivate}>
            <Boundary cx={CX} cy={CY} access="sealed" scale={STAGE} />
          </Layer>

          <PChainLine x1={CX - LINE_HALF} x2={CX + LINE_HALF} y={GROUND} records={[CX]} scale={STAGE} />

          {/* dotted lines: users outside (the application is open in both
            public and permissioned), members inside the seal */}
          <Layer on={!isPrivate}>
            {USERS.map((u) => (
              <DottedLine key={u.deg} x1={u.x1} y1={u.y1} x2={u.x2} y2={u.y2} />
            ))}
          </Layer>
          <Layer on={isPrivate}>
            {MEMBERS.map((u) => (
              <DottedLine key={u.deg} x1={u.x1} y1={u.y1} x2={u.x2} y2={u.y2} />
            ))}
          </Layer>

          <g strokeWidth={1} className={cls.lineStroke}>
            {SPOKES.map(({ deg, ...p }) => (
              <line key={deg} {...p} />
            ))}
          </g>

          {/* under the validators, the actors and the core: the east spoke and the travelers */}
          <Layer on={isPublic} run={runs.public} replay={replayIf(isPublic)}>
            <line {...EAST_SPOKE} strokeWidth={1} className={`${cls.lineStroke} ${m.joinSpoke}`} />
            <Travelers sends={PUBLIC_SENDS} className={m.send} />
          </Layer>
          <Layer on={isPermissioned} run={runs.permissioned} replay={replayIf(isPermissioned)}>
            <line {...EAST_SPOKE} strokeWidth={1} className={`${cls.lineStroke} ${m.approveSpoke}`} />
            <Travelers sends={PERMISSIONED_SENDS} className={m.send} />
          </Layer>
          <Layer on={isPrivate} run={runs.private} replay={replayIf(isPrivate)}>
            <line {...EAST_SPOKE} strokeWidth={1} className={cls.lineStroke} />
            <Travelers sends={PRIVATE_SENDS} className={m.member} />
          </Layer>

          {/* validators: named, with a hollow overlay that cross-fades in public */}
          {NODES.map(([x, y]) => (
            <ValidatorNode key={`${x}-${y}`} x={x} y={y} scale={STAGE} />
          ))}
          <Layer on={isPublic}>
            {NODES.map(([x, y]) => (
              <ValidatorNode key={`${x}-${y}`} x={x} y={y} scale={STAGE} named={false} />
            ))}
          </Layer>

          {/* the east slot: the open seat with a joiner, the open seat with two
            candidates, or a member validator */}
          <Layer on={isPublic} run={runs.public} replay={replayIf(isPublic)}>
            <Seat className={m.joinSeat} />
            <ValidatorNode x={CX} y={CY} scale={STAGE} named={false} className={m.joiner} />
          </Layer>
          <Layer on={isPermissioned} run={runs.permissioned} replay={replayIf(isPermissioned)}>
            <Seat className={m.approveSeat} />
            <ValidatorNode x={CX} y={CY} scale={STAGE} className={m.refused} />
            <ValidatorNode x={CX} y={CY} scale={STAGE} className={m.approved} />
          </Layer>
          <Layer on={isPrivate}>
            <ValidatorNode x={CX + SLOT} y={CY} scale={STAGE} />
          </Layer>

          {/* actors over their travelers' start: users, members */}
          <Layer on={!isPrivate}>
            {USERS.map((u) => (
              <Actor key={u.deg} x={u.x} y={u.y} />
            ))}
          </Layer>
          <Layer on={isPrivate}>
            {MEMBERS.map((u) => (
              <Actor key={u.deg} x={u.x} y={u.y} />
            ))}
          </Layer>

          <Core cx={CX} cy={CY} scale={STAGE} />

          {/* over the core: accept pulses, the lit record, the owner's marks */}
          <Layer on={isPublic} run={runs.public} replay={replayIf(isPublic)}>
            <Accepts sends={PUBLIC_SENDS} className={m.accept} />
            <RecordLit x={CX} y={GROUND} scale={STAGE} className={m.joinRecord} />
          </Layer>
          <Layer on={isPermissioned} run={runs.permissioned} replay={replayIf(isPermissioned)}>
            <Accepts sends={PERMISSIONED_SENDS} className={m.accept} />
            <RecordLit x={CX} y={GROUND} scale={STAGE} className={m.approveRecord} />
            <Cross x={MARK_X} y={MARK_Y} className={m.refuseMark} />
            <Check x={MARK_X} y={MARK_Y} shown className={m.approveMark} />
          </Layer>
          <Layer on={isPrivate} run={runs.private} replay={replayIf(isPrivate)}>
            <Accepts sends={PRIVATE_SENDS} className={m.memberAccept} />
          </Layer>

          <Label x={CX} y={NAME_Y} size={STAGE.label}>
            Your chain
          </Label>
        </g>
      </Diagram>
    </div>
  );
}
