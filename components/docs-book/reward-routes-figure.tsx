import type { TermRole } from '@/components/docs-book/term';
import {
  bend,
  FlowArt,
  FlowLabel,
  FlowSvg,
  Fork,
  HatchPattern,
  type Box,
  type MarkerKind,
  type Point,
  type Track,
} from '@/components/docs-book/flow';

/*
 * Figure for the Reward Manager page, drawn as a flow diagram. The fees of each block are a band of constant
 * width. The band enters at the left, goes through the RewardManager precompile (the red bar), and continues on
 * the active channel only. The other two channels branch off at the same point, but they are empty outlines of
 * the same width. Thus the reader sees three possible paths, and the hatched band shows the one that the fees
 * take. Facts from subnet-evm: the precompile is at 0x0200...0004, and the burn route sends the fees to the
 * blackhole address 0x0100...0000, which is the default.
 *
 * Two drawings of the same content: a wide one (720 units) for a container of 660px or more, and a tall one
 * (340 units) for phones. Each keeps its smallest text (12 units) at 11px or more on screen. figure.css shows one of
 * them with a container query.
 *
 * Every color comes from the docs tokens through currentColor. The colored parts sit in elements with
 * data-bk-role, the same attribute as <Term>, so the color key toggle turns them to ink. Every color also has a
 * shape and a word: a hollow square is a validator setting, a filled square or bar is a contract or an account on
 * the L1, and a crossed square is the burn route.
 */

interface Route {
  role?: TermRole;
  marker: MarkerKind;
  name: string;
  tag?: string;
  config: string;
  lines: readonly [string, string];
}

const ROUTES: readonly Route[] = [
  {
    role: 'pchain',
    marker: 'setting',
    name: 'Validator fee recipient',
    config: 'allowFeeRecipients',
    lines: ['The validator that built the block', 'gets the fees at its feeRecipient.'],
  },
  {
    role: 'evm',
    marker: 'account',
    name: 'Reward address',
    config: 'rewardAddress',
    lines: ['One fixed address on the L1:', 'a contract or an account.'],
  },
  {
    marker: 'burn',
    name: 'Burn',
    tag: 'default',
    config: 'disableRewards',
    lines: ['The blackhole, 0x0100…0000.', 'Nobody can spend the fees.'],
  },
];

/* The fees fill the burn channel, because burn is the default. */
const ACTIVE = 2;

const LABEL =
  'The fees of each block on the L1 flow as a band into the RewardManager precompile at 0x0200…0004. Three ' +
  'channels branch off from the precompile, and the fees fill only one of them at a time. Channel 1, ' +
  'allowFeeRecipients: the fee recipient of the validator that built the block. Channel 2, rewardAddress: one ' +
  'fixed address on the L1, a contract or an account. Channel 3, disableRewards, the default: the blackhole ' +
  'address 0x0100…0000, so nobody can spend the fees. In the drawing the fees fill channel 3, the default.';

interface Layout {
  name: 'wide' | 'stacked';
  w: number;
  h: number;
  /* Half the width of the band. */
  half: number;
  /* One channel for each route, in the order of ROUTES. The active one starts at the left or top edge, because
     it also draws the band that comes in. */
  tracks: readonly Track[];
  gate: Box;
  /* The left end of each route label, at the center line of its channel. */
  labels: readonly Point[];
  source: Point;
  precompile: { x: number; y: number; anchor: 'start' | 'end' };
}

/*
 * Wide: the band comes in from the left at the height of the middle route. At the precompile three channels
 * branch off, and each S bend ends in a straight run to its label. The labels stand in one column at the right,
 * with the name level with the channel.
 */
const W_HALF = 12;
const W_ROWS = [16, 126, 236] as const;
const W_JUNCTION = 210;
const W_RUN = 150;
const W_END = 404;

const WIDE: Layout = {
  name: 'wide',
  w: 720,
  h: 306,
  half: W_HALF,
  tracks: [
    {
      from: [W_JUNCTION, W_ROWS[1]],
      heading: 0,
      segs: [...bend(W_ROWS[0] - W_ROWS[1], W_RUN), { line: W_END - W_JUNCTION - W_RUN }],
    },
    { from: [W_JUNCTION, W_ROWS[1]], heading: 0, segs: [{ line: W_END - W_JUNCTION }] },
    {
      from: [0, W_ROWS[1]],
      heading: 0,
      segs: [{ line: W_JUNCTION }, ...bend(W_ROWS[2] - W_ROWS[1], W_RUN), { line: W_END - W_JUNCTION - W_RUN }],
    },
  ],
  gate: { x: W_JUNCTION - 1.5, y: W_ROWS[1] - W_HALF - 8, w: 3, h: 2 * W_HALF + 16 },
  labels: W_ROWS.map((y) => [W_END + 16, y] as const),
  source: [0, W_ROWS[1] - W_HALF - 32],
  precompile: { x: W_JUNCTION - 16, y: W_ROWS[1] + W_HALF + 24, anchor: 'end' },
};

/*
 * Phones: the band comes down at the left. Under the precompile the channels split into three tracks side by
 * side. The rightmost track turns east first, to the top label, so no two channels cross. The active track runs
 * straight down from the band to the last label.
 */
const S_HALF = 8;
const S_X = 16;
const S_GAP = 26;
const S_JUNCTION = 52;
/* The channels share the band for a short run under the precompile, so the fork starts below its label. */
const S_SPLIT = 16;
const S_RUN = 72;
const S_ROWS = [164, 268, 372] as const;
const S_TURN = 20;
const S_END = 92;

function stackedTrack(i: number): Track {
  const shift = (2 - i) * S_GAP;
  const x = S_X + shift;
  const fall = S_ROWS[i] - S_TURN - S_JUNCTION - S_SPLIT - S_RUN;
  return shift
    ? {
        from: [S_X, S_JUNCTION],
        heading: 90,
        segs: [
          { line: S_SPLIT },
          ...bend(-shift, S_RUN),
          { line: fall },
          { arc: S_TURN, turn: -90 },
          { line: S_END - x - S_TURN },
        ],
      }
    : {
        from: [S_X, 0],
        heading: 90,
        segs: [{ line: S_ROWS[i] - S_TURN }, { arc: S_TURN, turn: -90 }, { line: S_END - x - S_TURN }],
      };
}

const STACKED: Layout = {
  name: 'stacked',
  w: 340,
  h: 442,
  half: S_HALF,
  tracks: [0, 1, 2].map(stackedTrack),
  gate: { x: S_X - S_HALF - 8, y: S_JUNCTION - 1.5, w: 2 * S_HALF + 16, h: 3 },
  labels: S_ROWS.map((y) => [S_END + 16, y] as const),
  source: [40, 14],
  precompile: { x: 40, y: S_JUNCTION + 4, anchor: 'start' },
};

function Drawing({ layout: l }: { layout: Layout }) {
  const id = `bk-flow-${l.name}`;
  return (
    <FlowSvg layout={l.name} size={[l.w, l.h]} label={LABEL}>
      <defs>
        <HatchPattern id={`${id}-hatch`} />
      </defs>

      {/* Three channels from the precompile. The fees fill the active one, from the edge of the drawing. */}
      <Fork id={id} tracks={l.tracks} half={l.half} active={ACTIVE} hatch={`${id}-hatch`} size={[l.w, l.h]} />

      {/* The precompile: a contract on the L1, so a filled bar in the EVM color across the band. */}
      <g data-bk-role="evm">
        <rect x={l.gate.x} y={l.gate.y} width={l.gate.w} height={l.gate.h} fill="currentColor" />
        <text className="bk-flow-name" x={l.precompile.x} y={l.precompile.y} textAnchor={l.precompile.anchor}>
          RewardManager
        </text>
      </g>
      <text
        className="bk-fig-sans bk-fig-ink2"
        x={l.precompile.x}
        y={l.precompile.y + 18}
        textAnchor={l.precompile.anchor}
      >
        precompile <tspan className="bk-flow-code bk-fig-steel">0x0200{'…'}0004</tspan>
      </text>

      <text className="bk-flow-name" x={l.source[0]} y={l.source[1]}>
        Fees of each block
      </text>
      <text className="bk-fig-sans bk-fig-ink2" x={l.source[0]} y={l.source[1] + 18}>
        on the L1
      </text>

      {ROUTES.map((route, i) => (
        <FlowLabel
          key={route.name}
          at={l.labels[i]}
          name={route.name}
          tag={route.tag}
          marker={route.marker}
          role={route.role}
          code={route.config}
          lines={route.lines}
        />
      ))}
    </FlowSvg>
  );
}

/** Figure for the Reward Manager page: the fees flow on one of three channels. */
export function RewardRoutesFigure() {
  return (
    <FlowArt name="reward-routes">
      <Drawing layout={WIDE} />
      <Drawing layout={STACKED} />
    </FlowArt>
  );
}
