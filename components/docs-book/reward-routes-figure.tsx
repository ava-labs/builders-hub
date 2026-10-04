import type { TermRole } from '@/components/docs-book/term';

/*
 * Figure for the Reward Manager page, drawn as a flow diagram. The fees of each block are a band of constant
 * width. The band enters at the left, goes through the RewardManager precompile (the red bar), and continues on
 * the active channel only. The other two channels branch off at the same point, but they are empty outlines of
 * the same width. Thus the reader sees three possible paths, and the hatched band shows the one that the fees
 * take. Facts from subnet-evm: the precompile is at 0x0200...0004, and the burn route sends the fees to the
 * blackhole address 0x0100...0000, which is the default.
 *
 * Two drawings of the same content: a wide one (720 units) for a container of 660px or more, and a tall one
 * (340 units) for phones. Each keeps its smallest text (12 units) at 11px or more on screen. flow.css shows one of
 * them with a container query.
 *
 * Every color comes from the docs tokens through currentColor. The colored parts sit in elements with
 * data-bk-role, the same attribute as <Term>, so the color key toggle turns them to ink. Every color also has a
 * shape and a word: a hollow square is a validator setting, a filled square or bar is a contract or an account on
 * the L1, and a crossed square is the burn route.
 */

type MarkerKind = 'setting' | 'account' | 'burn';

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

type Point = readonly [number, number];

/* A piece of a channel center line: a straight run, or an arc that turns by an angle (degrees, positive is
   clockwise on screen, because y points down). */
type Seg = { line: number } | { arc: number; turn: number };

interface Track {
  from: Point;
  heading: number;
  segs: readonly Seg[];
}

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

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

const rad = (deg: number) => (deg * Math.PI) / 180;
const round = (n: number) => Math.round(n * 100) / 100;
const fmt = ([x, y]: Point) => `${round(x)} ${round(y)}`;

/* The point at distance d to the right of a heading. With y down, the right of east is south. */
function side([x, y]: Point, heading: number, d: number): Point {
  const a = rad(heading);
  return [x - d * Math.sin(a), y + d * Math.cos(a)];
}

interface Piece {
  to: Point;
  arc?: { r: number; sweep: 0 | 1 };
}

/*
 * Follow a center line and give the line at distance d to its right. Each arc of the offset line has the same
 * center as the arc of the center line, so the band keeps the same width through every bend. That is why the
 * channels are lines and arcs, and not Bezier curves.
 */
function walk(t: Track, d: number): { start: Point; pieces: Piece[] } {
  let p = t.from;
  let h = t.heading;
  const pieces: Piece[] = [];
  for (const s of t.segs) {
    if ('line' in s) {
      p = [p[0] + s.line * Math.cos(rad(h)), p[1] + s.line * Math.sin(rad(h))];
      pieces.push({ to: side(p, h, d) });
    } else {
      const sign = Math.sign(s.turn);
      const center = side(p, h, sign * s.arc);
      h += s.turn;
      p = side(center, h, -sign * s.arc);
      pieces.push({ to: side(p, h, d), arc: { r: s.arc - sign * d, sweep: s.turn > 0 ? 1 : 0 } });
    }
  }
  return { start: side(t.from, t.heading, d), pieces };
}

function draw(pieces: readonly Piece[]): string {
  return pieces
    .map((p) => (p.arc ? ` A${round(p.arc.r)} ${round(p.arc.r)} 0 0 ${p.arc.sweep} ${fmt(p.to)}` : ` L${fmt(p.to)}`))
    .join('');
}

/*
 * The outline of a channel: along the left edge, across the end, and back along the right edge. The start stays
 * open, because the channel starts at the precompile, or because the fees come in from outside the drawing.
 * With close, the same path is a closed shape for the hatch and for the masks.
 */
function outline(t: Track, half: number, close = false): string {
  const left = walk(t, -half);
  const right = walk(t, half);
  const back = right.pieces
    .map((p, i) => {
      const to = i === 0 ? right.start : right.pieces[i - 1].to;
      return p.arc ? ` A${round(p.arc.r)} ${round(p.arc.r)} 0 0 ${1 - p.arc.sweep} ${fmt(to)}` : ` L${fmt(to)}`;
    })
    .reverse()
    .join('');
  const end = right.pieces[right.pieces.length - 1].to;
  return `M${fmt(left.start)}${draw(left.pieces)} L${fmt(end)}${back}${close ? ' Z' : ''}`;
}

/* An S bend: two arcs that move the channel sideways by `shift` over a run of `run`, and keep its heading. A
   positive shift goes to the right of the heading. */
function bend(shift: number, run: number): Seg[] {
  const turn = 2 * Math.atan(Math.abs(shift) / run);
  const r = run / (2 * Math.sin(turn));
  const deg = (Math.sign(shift) * turn * 180) / Math.PI;
  return [
    { arc: r, turn: deg },
    { arc: r, turn: -deg },
  ];
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

const MARK = 10;

function Marker({ kind, x, y }: { kind: MarkerKind; x: number; y: number }) {
  if (kind === 'account') return <rect x={x} y={y} width={MARK} height={MARK} fill="currentColor" />;
  // Inset the outline by half its stroke, so that all three markers fill the same square.
  const box = (
    <rect
      x={x + 0.75}
      y={y + 0.75}
      width={MARK - 1.5}
      height={MARK - 1.5}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
    />
  );
  if (kind === 'setting') return box;
  return (
    <g>
      {box}
      <path d={`M${x + 3} ${y + 3} l4 4 m0 -4 l-4 4`} fill="none" stroke="currentColor" strokeWidth={1.25} />
    </g>
  );
}

/* Set each address in a line in the code face, as in the prose. */
function Words({ text }: { text: string }) {
  return text.split(/(0x[0-9a-f]+…[0-9a-f]+)/i).map((part, i) =>
    i % 2 ? (
      <tspan key={part} className="bk-flow-code">
        {part}
      </tspan>
    ) : (
      part
    ),
  );
}

/* A route label: the marker and the name level with the channel, then the config key and two short lines. */
function RouteLabel({ route, at: [x, cy] }: { route: Route; at: Point }) {
  const base = cy + 5;
  const name = (
    <g>
      <Marker kind={route.marker} x={x} y={base - MARK} />
      <text className="bk-flow-name" x={x + MARK + 8} y={base}>
        {route.name}
        {route.tag && (
          <tspan className="bk-flow-tag" dx={10}>
            {route.tag}
          </tspan>
        )}
      </text>
    </g>
  );
  return (
    <g>
      {route.role ? <g data-bk-role={route.role}>{name}</g> : name}
      <text className="bk-fig-code bk-fig-ink2" x={x} y={base + 20}>
        {route.config}
      </text>
      {route.lines.map((line, j) => (
        <text key={line} className="bk-fig-sans bk-fig-ink2" x={x} y={base + 40 + j * 17}>
          <Words text={line} />
        </text>
      ))}
    </g>
  );
}

function Drawing({ layout: l }: { layout: Layout }) {
  const id = `bk-flow-${l.name}`;
  const active = l.tracks[ACTIVE];
  const centre = walk(active, 0).pieces;
  const end = centre[centre.length - 1].to;
  // Inset the mask shapes a little, so that a hairline on the shared edge at the root stays visible.
  const inner = l.tracks.map((t) => outline(t, l.half - 0.6, true));

  return (
    <svg data-layout={l.name} viewBox={`0 0 ${l.w} ${l.h}`} role="img" aria-label={LABEL}>
      <defs>
        {/* Fine diagonal hatching for the band, as in an engraving. The pattern scales with the drawing. */}
        <pattern
          id={`${id}-hatch`}
          patternUnits="userSpaceOnUse"
          width={3.5}
          height={3.5}
          patternTransform="rotate(45)"
        >
          <line className="bk-fig-ink2" x1={1.75} y1={0} x2={1.75} y2={3.5} stroke="currentColor" strokeWidth={0.75} />
        </pattern>
        {/* Each empty channel hides its edges inside the other two channels, so the fork shows one clean outline
            and not three crossed ones. White and black here are mask values, not colors on screen. */}
        {l.tracks.map((_, i) =>
          i === ACTIVE ? null : (
            <mask
              key={i}
              id={`${id}-mask-${i}`}
              maskUnits="userSpaceOnUse"
              x={-20}
              y={-20}
              width={l.w + 40}
              height={l.h + 40}
            >
              <rect x={-20} y={-20} width={l.w + 40} height={l.h + 40} fill="white" />
              {inner.map((d, j) => (j === i ? null : <path key={j} d={d} fill="black" />))}
            </mask>
          ),
        )}
      </defs>

      {/* The empty channels: steel hairlines, the same width as the band. */}
      {l.tracks.map((t, i) =>
        i === ACTIVE ? null : (
          <path
            key={i}
            className="bk-fig-steel"
            d={outline(t, l.half)}
            mask={`url(#${id}-mask-${i})`}
            fill="none"
            stroke="currentColor"
          />
        ),
      )}

      {/* The fees: one hatched band from the edge of the drawing to the active destination. */}
      <path d={outline(active, l.half, true)} fill={`url(#${id}-hatch)`} />
      <path d={outline(active, l.half)} fill="none" stroke="currentColor" />
      <rect x={end[0]} y={end[1] - l.half - 4} width={3} height={2 * l.half + 8} fill="currentColor" />

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
        <RouteLabel key={route.name} route={route} at={l.labels[i]} />
      ))}
    </svg>
  );
}

/** Figure for the Reward Manager page: the fees flow on one of three channels. */
export function RewardRoutesFigure() {
  return (
    <div data-bk-figure-art="reward-routes">
      <Drawing layout={WIDE} />
      <Drawing layout={STACKED} />
    </div>
  );
}
