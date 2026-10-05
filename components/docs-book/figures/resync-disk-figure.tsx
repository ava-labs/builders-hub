import { FlowArt, FlowSvg, HatchPattern, fmt, type Point } from '@/components/docs-book/flow';

/*
 * Figure for the Periodic State Sync page: the disk use of a node that does a periodic state sync, against a node
 * that does not. It is a schematic, not to scale. It is drawn in the chart style of disk-growth-figure.tsx (the
 * Chain State Management page): the same axes, the same line styles and the same names, so the two charts read
 * as one set. The dashed line is steeper here, because this chart has more teeth and each tooth must show.
 *
 * Facts from AvalancheGo, the C-Chain after Helicon (ava-labs/avalanchego@5bf881e, origin/master):
 * - pruning-enabled is true by default (vms/saevm/cchain/config.go:129). Then the node commits the settled state
 *   root only at heights that are a multiple of commit-interval, 4096 (vms/saevm/saedb/tracker.go:32 and 274-276,
 *   vms/saevm/saedb/saedb.go:16-17), and serves state sync summaries only at those heights
 *   (vms/saevm/statesync/README.md:22). These are the state sync snapshots: they grow the disk at the rate of the
 *   dashed line. A production network must use 4096 with the default hash scheme (cchain/config.go:189-193,
 *   saedb/tracker.go:62).
 * - The C-Chain has no offline pruning (cchain/config.go:84, commented out). A node state syncs only if it has
 *   accepted no block after genesis (statesync/README.md:28), and state-sync-enabled is true by default
 *   (cchain/config.go:130). So a periodic state sync is a fresh node with an empty database, as the steps of the
 *   page describe (periodic-state-sync.mdx:63-65). The disk use drops to the active state, and a new tooth starts
 *   because the node again keeps a snapshot every 4096 blocks.
 * - The first state sync comes after a long time with no state sync, as in the image that this figure replaces
 *   (public/images/State_sync_frequent_pruning.png). So the first tooth is the largest, and the later teeth show
 *   how a regular state sync keeps the disk use low.
 *
 * Two drawings of the same content: a wide one (720 units) with each name at the end of its line, and a stacked
 * one (340 units) for phones, with a key under the chart. Every line has its own style (dashed, sawtooth with
 * hatch, dotted) and a name, so no line depends on color. The wide drawing has three state syncs and the stacked
 * one two, so that the tick labels do not overlap.
 */

type Kind = 'snapshots' | 'periodic' | 'active';

interface Curve {
  /* The name, in one or two lines, as in the Chain State Management figure. */
  name: readonly string[];
  line: string;
}

const CURVES: Record<Kind, Curve> = {
  snapshots: { name: ['Active State with', 'State Sync Snapshots'], line: 'A snapshot every 4096 blocks' },
  periodic: { name: ['Active State with', 'periodic state sync'], line: 'The hatch shows the snapshots.' },
  active: { name: ['Active State'], line: 'The current state only' },
};

/* The order of the key, from the fastest growth to the slowest. */
const KEY: readonly Kind[] = ['snapshots', 'periodic', 'active'];

/* The same styles as the Chain State Management figure. */
const STYLE: Record<Kind, { className?: string; strokeWidth: number; strokeDasharray?: string }> = {
  snapshots: { strokeWidth: 1.5, strokeDasharray: '7 4' },
  periodic: { strokeWidth: 1.5 },
  active: { className: 'bk-fig-ink2', strokeWidth: 2.5, strokeDasharray: '0.1 5' },
};

const LABEL =
  'A chart of disk use over time for a node that does a periodic state sync. It is a schematic and not to scale. ' +
  'All three lines start at the same point. Active State with State Sync Snapshots: a dashed line that rises ' +
  'and leaves the top of the chart, because a node with no periodic state sync keeps every snapshot, one every ' +
  '4096 blocks. ' +
  'Active State with periodic state sync: a sawtooth. It rises at the rate of the dashed line, then drops back to ' +
  'the Active State line at each state sync. The first state sync comes after a long time, so the first tooth is ' +
  'the largest. Hatching fills the teeth: the disk that the snapshots take. Active State: a dotted line that ' +
  'stays almost flat, because the node keeps only the current state.';

interface Layout {
  name: 'wide' | 'stacked';
  w: number;
  h: number;
  /* The y axis, and the right end of the plot. */
  x0: number;
  x1: number;
  /* The top of the y axis, and the x axis. */
  top: number;
  base: number;
  /* All three lines start here, at the y axis: the active state after a state sync. */
  start: number;
  /* The height of the Active State line at the right end of the plot. */
  active: number;
  /* The dashed line stops where it reaches this height, at this x. */
  ceiling: number;
  ceilingX: number;
  /* The first state sync, and the time between two later ones. */
  first: number;
  period: number;
  /* The left end of the names at the line ends (wide), or of the key rows (stacked). */
  labelX: number;
  /* Stacked only: the center line of each key row, in the order of KEY. */
  keyRows?: readonly number[];
}

const WIDE: Layout = {
  name: 'wide',
  w: 720,
  h: 334,
  x0: 1,
  x1: 486,
  top: 24,
  base: 304,
  start: 284,
  active: 268,
  ceiling: 40,
  ceilingX: 330,
  first: 180,
  period: 102,
  labelX: 506,
};

const STACKED: Layout = {
  name: 'stacked',
  w: 340,
  h: 476,
  x0: 1,
  x1: 330,
  top: 24,
  base: 236,
  start: 222,
  active: 212,
  ceiling: 40,
  ceilingX: 230,
  first: 140,
  period: 95,
  labelX: 56,
  keyRows: [298, 370, 442],
};

interface Chart {
  snapshots: readonly Point[];
  active: readonly Point[];
  periodic: readonly Point[];
  teeth: readonly (readonly Point[])[];
  syncs: readonly number[];
}

function chart(l: Layout): Chart {
  // y grows down, so a rise is a negative slope.
  const slope = (l.ceiling - l.start) / (l.ceilingX - l.x0);
  const floor = (x: number) => l.start + ((l.active - l.start) * (x - l.x0)) / (l.x1 - l.x0);
  const start: Point = [l.x0, l.start];

  const syncs: number[] = [];
  for (let x = l.first; x < l.x1 - 1; x += l.period) syncs.push(x);

  // Each tooth starts on the Active State line and rises at the slope of the dashed line.
  const periodic: Point[] = [start];
  const teeth: Point[][] = [];
  let from = l.x0;
  for (const x of [...syncs, l.x1]) {
    const peak: Point = [x, floor(from) + slope * (x - from)];
    const foot: Point = [x, floor(x)];
    periodic.push(peak);
    if (x < l.x1) periodic.push(foot);
    teeth.push([[from, floor(from)], peak, foot]);
    from = x;
  }

  return {
    snapshots: [start, [l.ceilingX, l.ceiling]],
    active: [start, [l.x1, l.active]],
    periodic,
    teeth,
    syncs,
  };
}

const path = (points: readonly Point[]) => points.map((p, i) => `${i ? 'L' : 'M'}${fmt(p)}`).join(' ');

function Line({ kind, points }: { kind: Kind; points: readonly Point[] }) {
  const { className, ...stroke } = STYLE[kind];
  return (
    <path
      className={className}
      d={path(points)}
      fill="none"
      stroke="currentColor"
      strokeLinecap={kind === 'active' ? 'round' : 'butt'}
      strokeLinejoin="miter"
      {...stroke}
    />
  );
}

/* A name in one or two lines, then one line of prose. The first line is level with y. */
function Name({ curve, x, y }: { curve: Curve; x: number; y: number }) {
  const base = y + 5;
  const prose = base + (curve.name.length - 1) * 18 + 20;
  return (
    <g>
      <text className="bk-flow-name" x={x} y={base}>
        {curve.name.map((part, i) => (
          <tspan key={part} x={x} dy={i ? 18 : 0}>
            {part}
          </tspan>
        ))}
      </text>
      <text className="bk-fig-sans bk-fig-ink2" x={x} y={prose}>
        {curve.line}
      </text>
    </g>
  );
}

/* A short sample of a line for the key: the same style as in the chart. */
function Swatch({ kind, y, hatch }: { kind: Kind; y: number; hatch: string }) {
  if (kind !== 'periodic') return <Line kind={kind} points={[1, 41].map((x): Point => [x, y])} />;
  const tooth: Point[] = [
    [1, y + 7],
    [21, y - 7],
    [21, y + 7],
  ];
  const next: Point[] = tooth.map(([x, ty]) => [x + 20, ty]);
  return (
    <g>
      <path d={`${path(tooth)} Z ${path(next)} Z`} fill={`url(#${hatch})`} />
      <Line kind="periodic" points={[...tooth, ...next.slice(1)]} />
    </g>
  );
}

function Drawing({ layout: l }: { layout: Layout }) {
  const hatch = `bk-resync-disk-${l.name}-hatch`;
  const c = chart(l);
  const rows = l.keyRows;
  const ends: Record<Kind, Point> = {
    snapshots: c.snapshots[1],
    periodic: c.periodic[c.periodic.length - 1],
    active: c.active[1],
  };
  return (
    <FlowSvg layout={l.name} size={[l.w, l.h]} label={LABEL}>
      <defs>
        <HatchPattern id={hatch} />
      </defs>

      {/* The axes: hairlines with an open arrowhead. */}
      <path
        d={[
          `M${l.x0} ${l.top} V${l.base} H${l.x1 + 8}`,
          `M${l.x0 - 4} ${l.top + 6} L${l.x0} ${l.top} L${l.x0 + 4} ${l.top + 6}`,
          `M${l.x1 + 2} ${l.base - 4} L${l.x1 + 8} ${l.base} L${l.x1 + 2} ${l.base + 4}`,
        ].join(' ')}
        fill="none"
        stroke="currentColor"
      />
      <text className="bk-fig-label" x={0} y={l.top - 12}>
        DISK USE
      </text>
      <text className="bk-fig-label" x={l.x1 + 8} y={l.base + 22} textAnchor="end">
        TIME
      </text>

      {/* Each state sync: a tick on the time axis, under the drop of the sawtooth. */}
      {c.syncs.map((x) => (
        <g key={x}>
          <path d={`M${fmt([x, l.base])} v6`} fill="none" stroke="currentColor" />
          <text className="bk-fig-label" x={x} y={l.base + 22} textAnchor="middle">
            state sync
          </text>
        </g>
      ))}

      {/* The snapshots of the sawtooth: hatched teeth on the Active State line. */}
      {c.teeth.map((t) => (
        <path key={t[0][0]} d={`${path(t)} Z`} fill={`url(#${hatch})`} />
      ))}

      <Line kind="active" points={c.active} />
      <Line kind="snapshots" points={c.snapshots} />
      <Line kind="periodic" points={c.periodic} />

      {/* Wide: the dashed line stops inside the plot, so its name stands at its end. The other names stand in a
          column at the right, level with the end of their line. Stacked: a key under the chart. */}
      {KEY.map((kind, i) =>
        rows ? (
          <g key={kind}>
            <Swatch kind={kind} y={rows[i]} hatch={hatch} />
            <Name curve={CURVES[kind]} x={l.labelX} y={rows[i]} />
          </g>
        ) : (
          <Name
            key={kind}
            curve={CURVES[kind]}
            x={kind === 'snapshots' ? ends.snapshots[0] + 14 : l.labelX}
            y={ends[kind][1]}
          />
        ),
      )}
    </FlowSvg>
  );
}

/** Figure for the Periodic State Sync page: disk use over time of a node that state syncs again at intervals. */
export function ResyncDiskFigure() {
  return (
    <FlowArt name="resync-disk">
      <Drawing layout={WIDE} />
      <Drawing layout={STACKED} />
    </FlowArt>
  );
}
