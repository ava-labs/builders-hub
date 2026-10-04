import { FlowArt, FlowSvg, HatchPattern, fmt, type Point } from '@/components/docs-book/flow';

/*
 * Figure for the Chain State Management and State Sync Snapshot Deletion pages: the disk use of four kinds of node
 * over time, with the names that the pages give them. It is a schematic, not to scale. The page gives sizes and monthly rates, but an archival
 * node starts from genesis and the others start from a state sync, so the numbers do not share one scale. The
 * slopes keep only the order of the rates: archival, then active state with snapshots, then active state.
 *
 * Facts from AvalancheGo, the C-Chain after Helicon (ava-labs/avalanchego@5bf881e):
 * - With pruning-enabled false the node is archival, and it commits the state root after every block
 *   (vms/saevm/cchain/config.go:231, vms/saevm/saedb/tracker.go:271-272). So the archival line rises fastest.
 * - pruning-enabled is true by default (cchain/config.go:129). Then the node commits the settled state root only
 *   at heights that are a multiple of commit-interval, 4096 (saedb/tracker.go:32 and 274-275, saedb/saedb.go:17),
 *   and serves state sync summaries only at those heights (vms/saevm/statesync/README.md:22). These are the
 *   state sync snapshots of the dashed line.
 * - The C-Chain has no offline pruning (cchain/config.go:84, commented out), and a node state syncs only if it
 *   has accepted no block after genesis (statesync/README.md:28). So on the C-Chain a deletion is a fresh node
 *   that state syncs (state-sync-enabled is true by default, cchain/config.go:130). A Subnet-EVM L1 can also use
 *   offline pruning. Either way, the node drops back to the active state, and the sawtooth starts a new tooth.
 * - A Subnet-EVM L1 also writes the state to disk every commit-interval, 4096 blocks, but it serves state sync
 *   summaries only every state-sync-commit-interval, 16384 blocks (graft/subnet-evm/plugin/evm/config/
 *   default_config.go:14,33,39). So on an L1 only every fourth snapshot is a state sync point. The caption on the
 *   State Sync Snapshot Deletion page says this.
 *
 * Until its first deletion, the node keeps every snapshot, so it is on the dashed line. The sawtooth starts at the
 * first drop, as the green line of the page's earlier chart did. After each drop a tooth grows at the rate of the
 * dashed line, because the node again keeps a snapshot every 4096 blocks. The hatch fills the teeth: it is the
 * disk that the snapshots take, and that each deletion gives back.
 *
 * The slopes follow the rates in the page's State Growth Rates table: archival about 500 GB a month, active state
 * with snapshots 150 to 200 GB, active state under 10 GB. The earlier chart drew archival only 1.7 times as steep
 * as the snapshot line; the table gives 2.5 to 3.3 times.
 *
 * Two drawings of the same content, as in the flow figures: a wide one (720 units) with each name at the end of
 * its line, and a stacked one (340 units) for phones, with a key under the chart. Every line has its own style
 * (thick, dashed, sawtooth with hatch, dotted) and a name, so no line depends on color.
 */

type Kind = 'archival' | 'snapshots' | 'periodic' | 'active';

interface Curve {
  /* The name as the page gives it, in one or two lines. */
  name: readonly string[];
  line: string;
}

const CURVES: Record<Kind, Curve> = {
  archival: { name: ['Archival State'], line: 'The state at every block' },
  snapshots: {
    name: ['Active State with', 'State Sync Snapshots'],
    line: 'A snapshot every 4096 blocks',
  },
  periodic: {
    name: ['Active State with', 'periodic snapshot deletion'],
    line: 'The hatch shows the snapshots.',
  },
  active: { name: ['Active State'], line: 'The current state only' },
};

/* The order of the key, from the fastest growth to the slowest. */
const KEY: readonly Kind[] = ['archival', 'snapshots', 'periodic', 'active'];

const STYLE: Record<Kind, { className?: string; strokeWidth: number; strokeDasharray?: string }> = {
  archival: { strokeWidth: 2 },
  snapshots: { strokeWidth: 1.5, strokeDasharray: '7 4' },
  periodic: { strokeWidth: 1.5 },
  active: { className: 'bk-fig-ink2', strokeWidth: 2.5, strokeDasharray: '0.1 5' },
};

/* The archival line rises this many times faster than the dashed line. The page gives about 2.5 to 3.3 times. */
const ARCHIVAL_RATE = 2.6;

const LABEL =
  'A chart of disk use over time for four kinds of node. It is a schematic and not to scale. All four lines ' +
  'start at the same point. Archival State: a thick line that rises fastest and leaves the top of the chart, ' +
  'because the node keeps the state at every block. Active State with State Sync Snapshots: a dashed line that ' +
  'rises more slowly, because the node keeps a snapshot every 4096 blocks. Active State with periodic snapshot ' +
  'deletion: until the first deletion it is the dashed line. At each deletion it drops back to the Active State ' +
  'line, then rises again at the rate of the dashed line: a sawtooth. Hatching fills the teeth: the disk that the ' +
  'snapshots take. Active State: a dotted line that stays ' +
  'almost flat, because the node keeps only the current state.';

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
  /* All four lines start here, at the y axis: the active state after a state sync. */
  start: number;
  /* The heights of the Active State line and the dashed line at the right end of the plot. */
  active: number;
  snapshots: number;
  /* The archival line stops where it reaches this height. */
  ceiling: number;
  /* The time between two deletions. */
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
  snapshots: 60,
  ceiling: 40,
  period: 162,
  labelX: 506,
};

const STACKED: Layout = {
  name: 'stacked',
  w: 340,
  h: 530,
  x0: 1,
  x1: 330,
  top: 24,
  base: 236,
  start: 222,
  active: 212,
  snapshots: 70,
  ceiling: 40,
  period: 112,
  labelX: 56,
  keyRows: [298, 352, 424, 496],
};

interface Chart {
  archival: readonly Point[];
  snapshots: readonly Point[];
  active: readonly Point[];
  periodic: readonly Point[];
  teeth: readonly (readonly Point[])[];
  drops: readonly number[];
}

function chart(l: Layout): Chart {
  const run = l.x1 - l.x0;
  // y grows down, so a rise is a negative slope.
  const slope = (l.snapshots - l.start) / run;
  const floor = (x: number) => l.start + ((l.active - l.start) * (x - l.x0)) / run;
  const start: Point = [l.x0, l.start];

  const drops: number[] = [];
  for (let x = l.x0 + l.period; x < l.x1 - 1; x += l.period) drops.push(x);

  // Each tooth starts on the Active State line and rises at the slope of the dashed line.
  // Until its first deletion the node is on the dashed line, so the sawtooth starts at the first drop.
  const periodic: Point[] = [];
  const teeth: Point[][] = [];
  let from = l.x0;
  for (const x of [...drops, l.x1]) {
    const peak: Point = [x, floor(from) + slope * (x - from)];
    const foot: Point = [x, floor(x)];
    periodic.push(peak);
    if (x < l.x1) periodic.push(foot);
    teeth.push([[from, floor(from)], peak, foot]);
    from = x;
  }

  return {
    archival: [start, [l.x0 + (l.ceiling - l.start) / (slope * ARCHIVAL_RATE), l.ceiling]],
    snapshots: [start, [l.x1, l.snapshots]],
    active: [start, [l.x1, l.active]],
    periodic,
    teeth,
    drops,
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
  const hatch = `bk-disk-growth-${l.name}-hatch`;
  const c = chart(l);
  const rows = l.keyRows;
  const ends: Record<Kind, Point> = {
    archival: c.archival[1],
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

      {/* Each deletion: a tick on the time axis, under the drop of the sawtooth. */}
      {c.drops.map((x) => (
        <g key={x}>
          <path d={`M${fmt([x, l.base])} v6`} fill="none" stroke="currentColor" />
          <text className="bk-fig-label" x={x} y={l.base + 22} textAnchor="middle">
            deletion
          </text>
        </g>
      ))}

      {/* The snapshots of the sawtooth: hatched teeth on the Active State line. */}
      {c.teeth.map((t) => (
        <path key={t[0][0]} d={`${path(t)} Z`} fill={`url(#${hatch})`} />
      ))}

      <Line kind="active" points={c.active} />
      <Line kind="snapshots" points={c.snapshots} />
      <Line kind="archival" points={c.archival} />
      <Line kind="periodic" points={c.periodic} />

      {/* Wide: the archival line stops inside the plot, so its name stands at its end. The other names stand in a
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
            x={kind === 'archival' ? ends.archival[0] + 14 : l.labelX}
            y={ends[kind][1]}
          />
        ),
      )}
    </FlowSvg>
  );
}

/**
 * Figure for the Chain State Management and State Sync Snapshot Deletion pages: disk use over time for four kinds
 * of node.
 */
export function DiskGrowthFigure() {
  return (
    <FlowArt name="disk-growth">
      <Drawing layout={WIDE} />
      <Drawing layout={STACKED} />
    </FlowArt>
  );
}
