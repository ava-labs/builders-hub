import {
  Band,
  bend,
  Channel,
  FlowArt,
  FlowLabel,
  FlowSvg,
  Fork,
  HatchPattern,
  type FlowLabelProps,
  type Point,
  type Track,
} from '@/components/docs-book/flow';

/*
 * Figure for the Periodic State Sync page: the steps of the page on a time line, with one lane for each node.
 * The staking keys (the validator identity) are the hatched band. The band runs on the old node lane while the
 * new node state syncs, stops at "Stop both nodes", bends down to the new node lane while the keys are copied,
 * and continues on the new node after it starts. An empty steel outline of the same width is a lane where the
 * keys are not: the new node before the copy, and the old node after it. The time line is not to scale: the
 * state sync takes hours, and the stop, the copy and the start take minutes.
 *
 * An ink bar across a lane is the only sign that a node stops or starts. The two lanes stay open at their right
 * end, as the old node lane is open at its left end, because time goes on past the drawing: the new node keeps
 * running.
 *
 * Facts:
 * - The steps and their order, from the page (content/docs/nodes/node-storage/periodic-state-sync.mdx): save the
 *   Node ID of the old node (:47), provision a new server without the old database (:63-65), install AvalancheGo
 *   (:70), start the new node and monitor the state sync (:78-81), stop both nodes after the state sync completes
 *   (:98-100), back up the keys of the new server (:106-111), copy the staking keys (:116-122), set the file
 *   permissions (:130), start the new node (:143), check the Node ID (:149), check that it validates (:162).
 * - The stop, the copy and the start typically take 5 to 15 minutes, and the validator misses blocks in that
 *   time (:101). The two nodes must not run with the same keys at the same time (:145).
 * - The Node ID comes from the staking certificate: node/node.go:141-146 (ids.NodeIDFromCert), at
 *   ava-labs/avalanchego@5bf881e (origin/master), as all the cites below.
 * - A new node makes its own keys: staker.key and staker.crt when they are not in the default path
 *   (config/config.go:739-743), and signer.key (node/node.go:1838). The default path is ~/.avalanchego/staking
 *   (config/flags.go:50-53). So the new node state syncs with a different Node ID, and it validates only after
 *   the copy.
 * - state-sync-enabled is true by default (vms/saevm/cchain/config.go:130), and a node state syncs only if it has
 *   accepted no block after genesis (vms/saevm/statesync/README.md:28). That is why the new node starts with an
 *   empty database.
 *
 * Two drawings of the same content: a wide one (720 units) with time from left to right and the step numbers on
 * an axis, and a stacked one (340 units) for phones with time from top to bottom and the step numbers in the
 * labels. No part has a role color: the band, the bars and the words carry the meaning.
 */

const LABEL =
  'A time line of a periodic state sync, with one lane for the old node and one for the new node. A hatched band ' +
  'shows the staking keys in ~/.avalanchego/staking/, the validator identity. The old node validates with them ' +
  'until step 5. Steps 1 to 3: save the Node ID, set up the new server and install AvalancheGo. Step 4: the new ' +
  'node starts with its own keys and state syncs. Step 5: stop both nodes after the state sync completes. Steps 6 ' +
  'to 8: the band moves from the old node lane to the new node lane: copy the staking keys to the new node. Step ' +
  '9: start the new node. The validator is offline from step 5 to step 9, for about 5 to 15 minutes. The new node ' +
  'validates with the same Node ID and a fresh database, and steps 10 and 11 check this. The old node stays ' +
  'stopped. Do not start it while the new node runs with the same keys. The time line is not to scale.';

/* The labels that both drawings share. The stacked drawing adds the step numbers as tags. */
type LabelText = Omit<FlowLabelProps, 'at'>;

const KEYS: LabelText = {
  name: 'Staking keys',
  code: '~/.avalanchego/staking/',
  lines: ['The old node validates with them.'],
};
const SYNC: LabelText = { name: 'State sync', lines: ['The new node runs', 'with its own keys.'] };
const STOP: LabelText = { name: 'Stop both nodes', lines: ['after the state sync completes.'] };
const COPY: LabelText = { name: 'Copy the keys' };
const START: LabelText = { name: 'Start the new node' };
const OLD: LabelText = {
  name: 'Old node',
  tag: 'stopped',
  lines: ['Do not start it while', 'the new node runs.'],
};
const NEW: LabelText = {
  name: 'New node',
  tag: 'validator',
  lines: ['Same Node ID,', 'fresh database.'],
};

const OFFLINE = 'Offline for about 5 to 15 minutes';

/* An ink bar across a lane: a node stops or starts. */
function Bar({ x, y, w, h }: { x: number; y: number; w: number; h: number }) {
  return <rect x={x} y={y} width={w} height={h} fill="currentColor" />;
}

/*
 * The two lanes after the stop: the old node lane empty, and the band that bends to the new node lane. The band
 * has no end bar, because an ink bar is a stop or a start. Both lanes end heading east at x = end. A clip there
 * removes the hairline across their ends, so that they stay open.
 */
function Lanes({
  id,
  tracks,
  half,
  size: [w, h],
  end,
}: {
  id: string;
  tracks: readonly Track[];
  half: number;
  size: Point;
  end: number;
}) {
  const hatch = `${id}-hatch`;
  return (
    <g clipPath={`url(#${id}-open)`}>
      <defs>
        <clipPath id={`${id}-open`}>
          <rect x={-20} y={-20} width={end - 0.6 + 20} height={h + 40} />
        </clipPath>
      </defs>
      <Fork id={id} tracks={tracks} half={half} active={null} hatch={hatch} size={[w, h]} />
      <Band track={tracks[1]} half={half} hatch={hatch} cap={false} />
    </g>
  );
}

/*
 * Wide: time runs from left to right. The old node lane is at the top, the new node lane under it. The band
 * bends down between the stop (step 5) and the start (step 9), so the bend is the copy (steps 6 to 8). The
 * extension lines take each event down to its number on the steps axis.
 */
const W = 720;
const W_HALF = 12;
const W_OLD = 92;
const W_NEW = 192;
const W_SYNC = 160;
const W_STOP = 290;
const W_START = 410;
const W_END = 556;
const W_LABEL = W_END + 16;
const W_AXIS = W_NEW + W_HALF + 36;
const W_DIM = W_AXIS + 40;
const W_H = W_DIM + 28;
/* The time of each step on the axis, in the order of the page. Step 7, the copy, is at the middle of the bend. */
const W_STEPS = [
  84,
  112,
  136,
  W_SYNC,
  W_STOP,
  W_STOP + 30,
  (W_STOP + W_START) / 2,
  W_START - 30,
  W_START,
  W_START + 48,
  W_START + 96,
] as const;
/* The steps that the drawing shows as an event, with an ink tick. */
const EVENTS = new Set([4, 5, 7, 9]);

function WideDrawing() {
  const id = 'bk-resync-timeline-wide';
  const tracks: readonly Track[] = [
    { from: [W_STOP, W_OLD], heading: 0, segs: [{ line: W_END - W_STOP }] },
    {
      from: [0, W_OLD],
      heading: 0,
      segs: [{ line: W_STOP }, ...bend(W_NEW - W_OLD, W_START - W_STOP), { line: W_END - W_START }],
    },
  ];
  const sync: Track = { from: [W_SYNC, W_NEW], heading: 0, segs: [{ line: W_STOP - W_SYNC }] };
  const gate = (x: number, y: number) => <Bar x={x - 1.5} y={y - W_HALF - 8} w={3} h={2 * W_HALF + 16} />;
  return (
    <FlowSvg layout="wide" size={[W, W_H]} label={LABEL}>
      <defs>
        <HatchPattern id={`${id}-hatch`} />
      </defs>

      {/* Extension lines from each event down to the steps axis, as on a drawing. */}
      <g className="bk-fig-rule2" stroke="currentColor">
        <line x1={W_SYNC} y1={W_NEW + W_HALF} x2={W_SYNC} y2={W_AXIS} />
        <line x1={W_STOP} y1={4} x2={W_STOP} y2={W_AXIS} />
        <line x1={W_START} y1={W_NEW + W_HALF + 8} x2={W_START} y2={W_AXIS} />
      </g>

      {/* The new node before the copy: it runs, but the keys are not on it. A closed start: the node starts. */}
      <Channel track={sync} half={W_HALF} />
      <path
        className="bk-fig-steel"
        d={`M${W_SYNC} ${W_NEW - W_HALF} V${W_NEW + W_HALF}`}
        fill="none"
        stroke="currentColor"
      />

      {/* The keys stay on the old node until the stop, then move to the new node. The old node lane goes on empty. */}
      <Lanes id={id} tracks={tracks} half={W_HALF} size={[W, W_H]} end={W_END} />
      {gate(W_STOP, W_OLD)}
      {gate(W_STOP, W_NEW)}
      {gate(W_START, W_NEW)}

      <FlowLabel {...KEYS} at={[0, 16]} />
      <FlowLabel {...STOP} at={[W_STOP + 10, 16]} />
      <FlowLabel {...SYNC} at={[W_SYNC, W_NEW - 67]} />
      <FlowLabel {...COPY} at={[372, W_OLD + 32]} />
      <FlowLabel {...START} at={[W_START + 10, W_NEW - 30]} />
      <FlowLabel {...OLD} at={[W_LABEL, W_OLD]} />
      <FlowLabel {...NEW} at={[W_LABEL, W_NEW]} />

      {/* The steps axis: one tick for each step of the page, with its number under it. */}
      <text className="bk-fig-label" x={0} y={W_AXIS + 4}>
        STEPS
      </text>
      <line className="bk-fig-steel" x1={64} y1={W_AXIS} x2={W_END} y2={W_AXIS} stroke="currentColor" />
      {W_STEPS.map((x, i) => {
        const ink = EVENTS.has(i + 1);
        return (
          <g key={x} className={ink ? undefined : 'bk-fig-steel'}>
            <line x1={x} y1={W_AXIS - 5} x2={x} y2={W_AXIS + 5} stroke="currentColor" strokeWidth={ink ? 2 : 1} />
            <text className="bk-fig-code" x={x} y={W_AXIS + 21} textAnchor="middle">
              {i + 1}
            </text>
          </g>
        );
      })}

      {/* The dimension from the stop to the start, with a slash at each end. */}
      <g className="bk-fig-ink2" stroke="currentColor">
        <line x1={W_STOP} y1={W_DIM} x2={W_START} y2={W_DIM} />
        <path d={`M${W_STOP - 4} ${W_DIM + 4} l8 -8 M${W_START - 4} ${W_DIM + 4} l8 -8`} fill="none" />
      </g>
      <text className="bk-fig-sans bk-fig-ink2" x={(W_STOP + W_START) / 2} y={W_DIM + 20} textAnchor="middle">
        {OFFLINE}
      </text>
    </FlowSvg>
  );
}

/*
 * Phones: time runs from top to bottom. The old node lane is at the right, so that the old lane can turn east to
 * its label above the new lane's turn, and no channel crosses another. The band comes down the old lane, bends
 * left to the new lane at the stop, and turns east to the new node label at the bottom. The labels stand in one
 * column at the right, in the order of the steps.
 */
const S_W = 340;
const S_HALF = 8;
const S_NEW = 16;
const S_OLD = 48;
const S_TEXT = 100;
const S_END = S_TEXT - 16;
const S_TURN = 16;
const S_PREP = 92;
const S_SYNC = 166;
const S_STOP = 248;
const S_START = 372;
const S_OLD_END = 432;
const S_NEW_END = 520;
const S_H = S_NEW_END + 68;

function StackedDrawing() {
  const id = 'bk-resync-timeline-stacked';
  const tracks: readonly Track[] = [
    {
      from: [S_OLD, S_STOP],
      heading: 90,
      segs: [{ line: S_OLD_END - S_TURN - S_STOP }, { arc: S_TURN, turn: -90 }, { line: S_END - S_OLD - S_TURN }],
    },
    {
      from: [S_OLD, 0],
      heading: 90,
      segs: [
        { line: S_STOP },
        ...bend(S_OLD - S_NEW, S_START - S_STOP),
        { line: S_NEW_END - S_TURN - S_START },
        { arc: S_TURN, turn: -90 },
        { line: S_END - S_NEW - S_TURN },
      ],
    },
  ];
  const sync: Track = { from: [S_NEW, S_SYNC], heading: 90, segs: [{ line: S_STOP - S_SYNC }] };
  const at = (y: number): Point => [S_TEXT, y];
  return (
    <FlowSvg layout="stacked" size={[S_W, S_H]} label={LABEL}>
      <defs>
        <HatchPattern id={`${id}-hatch`} />
      </defs>

      <Channel track={sync} half={S_HALF} />
      <path
        className="bk-fig-steel"
        d={`M${S_NEW - S_HALF} ${S_SYNC} H${S_NEW + S_HALF}`}
        fill="none"
        stroke="currentColor"
      />
      <Lanes id={id} tracks={tracks} half={S_HALF} size={[S_W, S_H]} end={S_END} />

      {/* One bar across both lanes: stop both nodes. One bar across the new node lane: start the new node. */}
      <Bar x={0} y={S_STOP - 1.5} w={S_OLD + S_HALF + 8} h={3} />
      <Bar x={0} y={S_START - 1.5} w={S_NEW + S_HALF + 8} h={3} />

      <FlowLabel {...KEYS} at={at(14)} />
      <FlowLabel
        at={at(S_PREP)}
        name="Save the Node ID"
        tag="steps 1 to 3"
        lines={['Set up the new server and', 'install AvalancheGo.']}
      />
      <FlowLabel {...SYNC} at={at(S_SYNC)} tag="step 4" />
      <FlowLabel {...STOP} at={at(S_STOP)} tag="step 5" />
      <FlowLabel
        {...COPY}
        at={at(S_STOP + 52)}
        tag="steps 6 to 8"
        lines={['Offline from step 5 to step 9,', 'for about 5 to 15 minutes.']}
      />
      <FlowLabel {...START} at={at(S_START)} tag="step 9" />
      <FlowLabel {...OLD} at={at(S_OLD_END)} />
      <FlowLabel {...NEW} at={at(S_NEW_END)} lines={[...(NEW.lines ?? []), 'Steps 10 and 11 check it.']} />
    </FlowSvg>
  );
}

/** A periodic state sync: the old node validates while a new node state syncs, then the staking keys move to the new node. */
export function ResyncTimelineFigure() {
  return (
    <FlowArt name="resync-timeline">
      <WideDrawing />
      <StackedDrawing />
    </FlowArt>
  );
}
