import type { TermRole } from '@/components/docs-book/term';
import { Band, FlowArt, FlowLabel, FlowSvg, HatchPattern, type Track } from '@/components/docs-book/flow';

/*
 * Figure for the Execution page: the stops of one C-Chain block under Continuous Execution (ACP-194, Helicon).
 * Block N is the hatched band. It goes through two gates and ends at a cap: consensus accepts it, the EVM
 * executes it, and a later block commits its state root. The readings under the band keep finality and the
 * state root apart, because they are two different things: the block is final at the first stop, and only the
 * state root changes at the last one.
 *
 * Facts, avalanchego@5bf881e (origin/master):
 * - Finality occurs at acceptance: vms/saevm/blocks/access.go:111-114.
 * - AcceptBlock gives the accepted block to the executor: vms/saevm/sae/consensus.go:44-50,110.
 * - Execution makes a receipt for each transaction: vms/saevm/saexec/execution.go:330-386.
 * - Tau is 5 s, the minimum time from the end of execution to the later block. It has no effect on finality:
 *   vms/saevm/params/params.go:20-27.
 * - A new block at time t takes the last block that finished execution by t - tau (on the gas clock):
 *   vms/saevm/sae/block_builder.go:408-409, vms/saevm/blocks/settlement.go:188-194,235-242.
 * - The post-execution state root of that block goes into the header Root: vms/saevm/sae/block_builder.go:234.
 *   The header also gets the height of that block: vms/saevm/cchain/hooks.go:571-573.
 * - The new block commits every block after the one its parent committed, up to that block, so the root includes
 *   block N: vms/saevm/blocks/settlement.go:121-135.
 * - The RPC tags safe and finalized give the last block with a committed state root, not the last accepted
 *   block: vms/saevm/blocks/access.go:102-103, vms/saevm/sae/consensus.go:74-77. Same in v1.15.1.
 * - On Mainnet the gap k was 2 to 6 blocks in live samples on 2026-10-03 and 2026-10-04 (header settledHeight).
 *   The ticks show 5, and only N and N+k have a name, because k changes with the block rate.
 *
 * Two drawings of the same content: a wide one (720 units) for a container of 660px or more, and a stacked one
 * (340 units) for phones. The wide one is a timing chart: x is time, and three lanes under the band give the
 * blocks on the chain, the finality and the state root. The stacked one gives the two readings at each stop.
 *
 * Colors as in the Reward Manager figure. Only the EVM is red (data-bk-role="evm"), and its label says "EVM".
 * The readings change by shape and word: a hairline is a state root that is not committed, a heavy ink line is a
 * final block or a committed state root.
 */

interface Stop {
  name: string;
  role?: TermRole;
  lines: readonly [string, string];
  root: string;
}

const STOPS: readonly Stop[] = [
  { name: 'Accepted', lines: ['Consensus accepts block N.', 'Its transactions are final.'], root: 'accepted' },
  {
    name: 'Executed',
    role: 'evm',
    lines: ['The EVM executes block N.', 'Receipts and logs exist.'],
    root: 'accepted',
  },
  {
    name: 'State root committed',
    lines: ['The header of block N+k', 'records the state root.'],
    root: 'committed in block N+k',
  },
];

const LABEL =
  'Block N on the C-Chain moves as a hatched band through three stops under Continuous Execution. Stop 1, ' +
  'accepted: consensus accepts block N, and its transactions are final. Stop 2, executed: the EVM executes ' +
  'block N, and its receipts and logs exist. Stop 3, state root committed: at least tau after execution on the ' +
  'gas clock, the header of a later block, N+k, records a state root that includes block N. Two separate ' +
  'readings follow the block. Finality reads final from stop 1. The state root reads accepted from stop 1, and ' +
  'committed in block N+k from stop 3.';

/* The wide drawing has one more lane than the stacked one, so its label has one more sentence. */
const WIDE_LABEL = `${LABEL} A row of ticks marks each block that consensus accepts, from block N to block N+k.`;

/* The name of the band, at the top. Shared by both drawings. */
function Source({ x }: { x: number }) {
  return <FlowLabel at={[x, 11]} name="Block N" lines={['on the C-Chain']} />;
}

/*
 * Wide: x is time. The band comes in from the left edge. Consensus accepts the block at G[0], the EVM finishes
 * it soon after at G[1], and block N+k commits the state root at G[2], at least tau after G[1]. The labels of the
 * first two stops go above and under the band, so the two gates can stand close together, as in time.
 */
const W = 720;
const W_Y = 92;
const W_HALF = 12;
const G = [140, 200, 520] as const;
/* One accepted block every TICK units on the chain lane. Block N+k is the fifth after block N. */
const TICK = (G[2] - G[0]) / 5;
const LANES = { blocks: 228, finality: 262, root: 296 } as const;
const DIM = 330;
const W_H = 342;

function Gate({ x, y, w, h, role }: { x: number; y: number; w: number; h: number; role?: TermRole }) {
  const bar = <rect x={x} y={y} width={w} height={h} fill="currentColor" />;
  return role ? <g data-bk-role={role}>{bar}</g> : bar;
}

/*
 * A reading lane: a hairline for a state root that is not committed, a heavy line for a final reading. The word
 * of a hairline stands at its end, next to the change, and clear of the extension line of the second stop.
 */
function Reading({ from, to, y, text, heavy }: { from: number; to: number; y: number; text: string; heavy: boolean }) {
  return (
    <g>
      <line
        className={heavy ? undefined : 'bk-fig-steel'}
        x1={from}
        y1={y}
        x2={to}
        y2={y}
        stroke="currentColor"
        strokeWidth={heavy ? 2 : 1}
      />
      <text
        className={heavy ? 'bk-fig-code' : 'bk-fig-code bk-fig-steel'}
        x={heavy ? from + 10 : to - 10}
        y={y - 8}
        textAnchor={heavy ? 'start' : 'end'}
      >
        {text}
      </text>
    </g>
  );
}

function WideDrawing() {
  const id = 'bk-flow-block-lifecycle-wide';
  const band: Track = { from: [0, W_Y], heading: 0, segs: [{ line: G[2] }] };
  const ticks = Array.from({ length: Math.floor((W - G[0]) / TICK) + 1 }, (_, i) => G[0] + i * TICK);
  const mid = (G[1] + G[2]) / 2;
  return (
    <FlowSvg layout="wide" size={[W, W_H]} label={WIDE_LABEL}>
      <defs>
        <HatchPattern id={`${id}-hatch`} />
      </defs>

      {/* Extension lines from each stop down through the lanes, as on a drawing. */}
      <g className="bk-fig-rule2" stroke="currentColor">
        <line x1={G[0]} y1={2} x2={G[0]} y2={LANES.root + 6} />
        <line x1={G[1]} y1={W_Y + W_HALF + 8} x2={G[1]} y2={DIM + 6} />
        <line x1={G[2]} y1={W_Y + W_HALF + 4} x2={G[2]} y2={DIM + 6} />
      </g>

      <Band track={band} half={W_HALF} hatch={`${id}-hatch`} />
      <Gate x={G[0] - 1.5} y={W_Y - W_HALF - 8} w={3} h={2 * W_HALF + 16} />
      <Gate x={G[1] - 1.5} y={W_Y - W_HALF - 8} w={3} h={2 * W_HALF + 16} role="evm" />

      <Source x={0} />
      <FlowLabel at={[G[0] + 10, 11]} name={STOPS[0].name} lines={STOPS[0].lines} />
      <FlowLabel at={[G[1] + 10, 136]} name={STOPS[1].name} role={STOPS[1].role} lines={STOPS[1].lines} />
      <FlowLabel at={[G[2] + 16, W_Y]} name={STOPS[2].name} lines={STOPS[2].lines} />

      {/* Lane names. */}
      <g className="bk-fig-label">
        <text x={0} y={LANES.blocks + 4}>
          BLOCKS
        </text>
        <text x={0} y={LANES.finality + 4}>
          FINALITY
        </text>
        <text x={0} y={LANES.root + 4}>
          STATE ROOT
        </text>
      </g>

      {/* The chain: one tick for each block that consensus accepts. Block N and block N+k are in ink. */}
      <line className="bk-fig-steel" x1={G[0] - 30} y1={LANES.blocks} x2={W} y2={LANES.blocks} stroke="currentColor" />
      {ticks.map((x, i) => {
        const name = i === 0 ? 'N' : x === G[2] ? 'N+k' : null;
        const ink = i === 0 || x === G[2];
        return (
          <g key={x} className={ink ? undefined : 'bk-fig-steel'}>
            <line
              x1={x}
              y1={LANES.blocks - 5}
              x2={x}
              y2={LANES.blocks + 5}
              stroke="currentColor"
              strokeWidth={ink ? 2 : 1}
            />
            {name && (
              <text className="bk-fig-code" x={x} y={LANES.blocks - 11} textAnchor="middle">
                {name}
              </text>
            )}
          </g>
        );
      })}

      <Reading from={G[0]} to={W} y={LANES.finality} text="final" heavy />
      <Reading from={G[0]} to={G[2]} y={LANES.root} text={STOPS[0].root} heavy={false} />
      <Reading from={G[2]} to={W} y={LANES.root} text={STOPS[2].root} heavy />

      {/* The dimension from the end of execution to block N+k, with a slash at each end. */}
      <g className="bk-fig-ink2" stroke="currentColor">
        <line x1={G[1]} y1={DIM} x2={mid - 42} y2={DIM} />
        <line x1={mid + 42} y1={DIM} x2={G[2]} y2={DIM} />
        <path d={`M${G[1] - 4} ${DIM + 4} l8 -8 M${G[2] - 4} ${DIM + 4} l8 -8`} fill="none" />
      </g>
      <text className="bk-fig-sans bk-fig-ink2" x={mid} y={DIM + 4.5} textAnchor="middle">
        at least <tspan className="bk-flow-code">τ</tspan>
      </text>
    </FlowSvg>
  );
}

/*
 * Phones: the band comes down at the left, and each stop has its label to the right of its gate. Under each
 * label, the two readings at that stop.
 */
const S_W = 340;
const S_X = 20;
const S_HALF = 8;
const S_STOPS = [76, 196, 316] as const;
const S_TEXT = 48;
const S_VALUE = 140;
const S_H = 428;

function StackedDrawing() {
  const id = 'bk-flow-block-lifecycle-stacked';
  const band: Track = { from: [S_X, 0], heading: 90, segs: [{ line: S_STOPS[2] }] };
  return (
    <FlowSvg layout="stacked" size={[S_W, S_H]} label={LABEL}>
      <defs>
        <HatchPattern id={`${id}-hatch`} />
      </defs>

      <Band track={band} half={S_HALF} hatch={`${id}-hatch`} />
      <Gate x={S_X - S_HALF - 8} y={S_STOPS[0] - 1.5} w={2 * S_HALF + 16} h={3} />
      <Gate x={S_X - S_HALF - 8} y={S_STOPS[1] - 1.5} w={2 * S_HALF + 16} h={3} role="evm" />

      <Source x={S_TEXT} />
      {STOPS.map((stop, i) => {
        const y = S_STOPS[i];
        // The last stop has one more line: the time from execution, which the wide drawing shows as a dimension.
        // It is drawn here and not in FlowLabel, so that tau takes the code face, as in the wide drawing.
        const last = i === STOPS.length - 1;
        const lines = last ? [stop.lines[0], 'records the state root,'] : stop.lines;
        const after = y + 5 + 22 + lines.length * 17;
        const readings = after + (last ? 17 : 0) + 7;
        return (
          <g key={stop.name}>
            <FlowLabel at={[S_TEXT, y]} name={stop.name} role={stop.role} lines={lines} />
            {last && (
              <text className="bk-fig-sans bk-fig-ink2" x={S_TEXT} y={after}>
                at least <tspan className="bk-flow-code">τ</tspan> after execution.
              </text>
            )}
            <g className="bk-fig-label">
              <text x={S_TEXT} y={readings}>
                FINALITY
              </text>
              <text x={S_TEXT} y={readings + 18}>
                STATE ROOT
              </text>
            </g>
            <text className="bk-fig-code" x={S_VALUE} y={readings}>
              final
            </text>
            <text className={last ? 'bk-fig-code' : 'bk-fig-code bk-fig-steel'} x={S_VALUE} y={readings + 18}>
              {stop.root}
            </text>
          </g>
        );
      })}
    </FlowSvg>
  );
}

/** A block after Continuous Execution: accepted and final, then executed, then its state root committed in a later block. */
export function BlockLifecycleFigure() {
  return (
    <FlowArt name="block-lifecycle">
      <WideDrawing />
      <StackedDrawing />
    </FlowArt>
  );
}
