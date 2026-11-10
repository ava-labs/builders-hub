import {
  bend,
  endOf,
  FlowArt,
  FlowLabel,
  FlowSvg,
  HatchPattern,
  outline,
  type FlowLabelProps,
  type Point,
  type Track,
} from '@/components/docs-book/flow';

/*
 * Figure for the PlatformVM architecture page: the auto-renewed staking cycle of ACP-236. The stake is a band
 * that comes in at the top left and goes around a loop, one cycle for each lap. The cycle end is the blue bar,
 * where RewardAutoRenewedValidatorTx ends the cycle on the P-Chain. On a renewal the band goes around again, and a
 * narrow band (the part of the reward that is not restaked) leaves the loop to the rewards owners. The exit is an
 * empty channel of the band's width that branches off at the cycle end: a path that the stake does not take now.
 *
 * Facts from avalanchego v1.15.1 (fdb2c1b9b0):
 * - The first cycle lasts Period, later cycles NextPeriod: platform/add_auto_renewed_validator_tx.go:68-71,
 *   txs/executor/proposal_tx_executor.go:905-916.
 * - The builder issues RewardAutoRenewedValidatorTx at the cycle end: block/builder/builder.go:659-666.
 * - Commit if uptime in the cycle is 90% or more (ACP-267), else abort: block/executor/options.go:145-193,
 *   genesis/params.go:17. The uptime counts from the validator's StartTime (options.go:184-187), and a renewal
 *   sets StartTime to the old end time (proposal_tx_executor.go:907, 926). Master (5bf881e) has the same lines.
 * - Commit with NextPeriod > 0: AutoCompoundRewardShares of the cycle's reward (validation reward and delegation
 *   fees) joins the weight, up to MaxValidatorStake. The rest goes out as reward UTXOs to the validation and
 *   delegation rewards owners. The next cycle starts at the old end time:
 *   txs/executor/proposal_tx_executor.go:464-471, 786-951, 742-773.
 * - Commit with NextPeriod = 0: the validator leaves with its stake and all rewards: proposal_tx_executor.go:473-505.
 * - Abort: the validator leaves with its stake, its restaked rewards and its delegation fees. It loses the
 *   validation reward of the cycle: proposal_tx_executor.go:446-462, 712-733.
 * The API fields restakedValidationRewards and restakedDelegateeRewards are not in v1.15.1. They are on master
 * (a0e17e3ed8, #5983) after v1.15.1, so the figure does not name them.
 *
 * Two drawings of the same content, as in reward-routes-figure.tsx: a wide one (720 units) and a stacked one
 * (340 units) for phones. Where two bands overlap (the entry joins the loop, the payout leaves it), each one hides
 * its edges inside the other, so the bands read as one hatched shape. The empty exit hides its edges inside all
 * the bands. Only the cycle end has a color: the P-Chain blue, with a bar for its shape and "P-Chain" in its words.
 * Its name stands level with the bar in both drawings.
 */

interface Part {
  track: Track;
  half: number;
  /* A band carries AVAX now. Without it, the part is an empty channel. */
  band?: boolean;
  /* A bar across the end of a band, where the AVAX arrives. */
  cap?: boolean;
}

/** Bands and empty channels that overlap: one hatched shape with clean edges, and steel outlines. */
function Parts({ id, parts, hatch, size: [w, h] }: { id: string; parts: readonly Part[]; hatch: string; size: Point }) {
  // Inset the mask shapes a little, so that an edge that two parts share stays visible.
  const inner = parts.map((p) => outline(p.track, p.half - 0.6, true));
  return (
    <g>
      <defs>
        {/* White and black are mask values, not colors on screen. A band hides its edges inside the other bands,
            an empty channel inside every other part. */}
        {parts.map((p, i) => (
          <mask
            key={i}
            id={`${id}-mask-${i}`}
            maskUnits="userSpaceOnUse"
            x={-20}
            y={-20}
            width={w + 40}
            height={h + 40}
          >
            <rect x={-20} y={-20} width={w + 40} height={h + 40} fill="white" />
            {parts.map((q, j) => (j === i || (p.band && !q.band) ? null : <path key={j} d={inner[j]} fill="black" />))}
          </mask>
        ))}
      </defs>
      {parts.map((p, i) =>
        p.band ? <path key={i} d={outline(p.track, p.half, true)} fill={`url(#${hatch})`} /> : null,
      )}
      {/* The steel outlines first and the ink outlines on top. Where the empty exit runs along the edge of a band,
          the ink edge of the band stays whole. */}
      {[false, true].map((ink) =>
        parts.map((p, i) =>
          !!p.band === ink ? (
            <path
              key={`${ink}-${i}`}
              className={ink ? undefined : 'bk-fig-steel'}
              d={outline(p.track, p.half)}
              mask={`url(#${id}-mask-${i})`}
              fill="none"
              stroke="currentColor"
            />
          ) : null,
        ),
      )}
      {parts.map((p, i) => {
        if (!p.cap) return null;
        const { at, heading } = endOf(p.track);
        return (
          <rect
            key={i}
            x={at[0]}
            y={at[1] - p.half - 4}
            width={3}
            height={2 * p.half + 8}
            fill="currentColor"
            transform={heading % 360 === 0 ? undefined : `rotate(${heading} ${at[0]} ${at[1]})`}
          />
        );
      })}
    </g>
  );
}

type Text = Omit<FlowLabelProps, 'at'>;

const ENTRY: Text = {
  name: 'Add validator',
  code: 'AddAutoRenewedValidatorTx',
  lines: ['The stake starts its first cycle.'],
};

const GATE: Text = {
  name: 'Cycle end',
  role: 'pchain',
  code: 'RewardAutoRenewedValidatorTx',
  lines: ['The P-Chain commits if uptime', 'in this cycle is 90% or more.', 'If not, it aborts.'],
};

const RESTAKE: Text = {
  name: 'Restake',
  code: 'autoCompoundRewardShares',
  lines: [
    'On commit, if nextPeriod is not 0,',
    'this share of the reward joins the',
    'stake, up to the maximum stake.',
    'A new cycle starts.',
  ],
};

const PAYOUT: Text = {
  name: 'Payout',
  lines: ['The rest of the reward goes', 'to the rewards owners.'],
};

const EXIT: Text = {
  name: 'Exit',
  code: 'nextPeriod = 0',
  lines: [
    'An abort also exits here.',
    'The stake and the rewards',
    'come back. An abort loses',
    "this cycle's validation reward.",
  ],
};

const LABEL =
  'An auto-renewed validator stakes one cycle at a time. AddAutoRenewedValidatorTx adds the validator, and the ' +
  'stake starts its first cycle. The stake goes around a loop, one cycle for each lap. At the cycle end, ' +
  'RewardAutoRenewedValidatorTx ends the cycle on the P-Chain. The P-Chain commits if uptime in this cycle is ' +
  '90% or more. If not, it aborts. On commit, if nextPeriod is not 0, the share autoCompoundRewardShares of the ' +
  'reward joins the stake, up to the maximum stake, and a new cycle starts. The rest of the reward goes to the ' +
  'rewards owners. The exit branches off at the cycle end: when nextPeriod is 0, or on an abort, the stake and ' +
  "the rewards come back. An abort loses this cycle's validation reward. In the drawing the stake restakes and " +
  'goes around again.';

interface Layout {
  name: 'wide' | 'stacked';
  w: number;
  h: number;
  /* The entry ends at the cycle end. The loop starts there and ends where it joins the entry again. */
  parts: readonly Part[];
  /* The center of the cycle end. The band goes south there in both drawings, so the bar is level. */
  gate: Point;
  half: number;
  /* A steel hairline from the bar to its label, from x to x, when the label stands far from the bar. */
  leader?: Point;
  labels: { entry: Point; restake: Point; gate: Point; payout: Point; exit: Point };
}

/*
 * Wide: the band comes down at the top left and turns east along the top of the loop. The cycle end is at the
 * right of the loop, where the band goes south. From there the loop goes on around, and the exit goes south
 * before it turns east. The payout moves east out of the exit, goes south next to it and turns east, as in the
 * stacked drawing. The labels stand in one column at the right: the cycle end level with its bar, with a hairline
 * to it, then the payout and the exit under it. The restake label is inside the loop.
 */
const W_HALF = 12;
const W_PAY = 5;
const W_R = 80;
const W_TOP = 104;
const W_RAMP = 40;
const W_LEFT = 96;
const W_RUN = 200;
const W_GATE: Point = [W_LEFT + W_RUN + W_R, W_TOP + W_R];
const W_PAY_SHIFT = 25;
const W_PAY_RUN = 30;
const W_PAY_R = 24;
const W_PAY_Y = 291;
const W_EXIT_R = 40;
const W_EXIT_Y = 363;
const W_END = 448;

const WIDE: Layout = {
  name: 'wide',
  w: 720,
  h: 470,
  half: W_HALF,
  gate: W_GATE,
  leader: [W_GATE[0] + W_HALF + 12, W_END + 8],
  parts: [
    {
      band: true,
      half: W_HALF,
      track: {
        from: [W_LEFT - W_RAMP, 0],
        heading: 90,
        segs: [{ line: W_TOP - W_RAMP }, { arc: W_RAMP, turn: -90 }, { line: W_RUN }, { arc: W_R, turn: 90 }],
      },
    },
    {
      band: true,
      half: W_HALF,
      track: {
        from: W_GATE,
        heading: 90,
        segs: [{ arc: W_R, turn: 90 }, { line: W_RUN }, { arc: W_R, turn: 90 }, { arc: W_R, turn: 90 }],
      },
    },
    {
      half: W_HALF,
      track: {
        from: W_GATE,
        heading: 90,
        segs: [
          { line: W_EXIT_Y - W_GATE[1] - W_EXIT_R },
          { arc: W_EXIT_R, turn: -90 },
          { line: W_END - W_GATE[0] - W_EXIT_R },
        ],
      },
    },
    {
      band: true,
      cap: true,
      half: W_PAY,
      track: {
        from: W_GATE,
        heading: 90,
        segs: [
          ...bend(-W_PAY_SHIFT, W_PAY_RUN),
          { line: W_PAY_Y - W_GATE[1] - W_PAY_RUN - W_PAY_R },
          { arc: W_PAY_R, turn: -90 },
          { line: W_END - W_GATE[0] - W_PAY_SHIFT - W_PAY_R },
        ],
      },
    },
  ],
  labels: {
    entry: [W_LEFT - W_RAMP + W_HALF + 16, 13],
    restake: [W_LEFT + 4, 139],
    gate: [W_END + 16, W_GATE[1]],
    payout: [W_END + 16, W_PAY_Y],
    exit: [W_END + 16, W_EXIT_Y],
  },
};

/*
 * Phones: the band comes down at the left and is the right side of a tall loop. The cycle end is at the bottom
 * of that side. The labels of the entry, the loop and the cycle end stand next to the band. Under the cycle end,
 * the payout moves east out of the exit, and each one turns east to its label.
 */
const S_HALF = 8;
const S_PAY = 4;
const S_X = 60;
const S_R = 22;
const S_JOIN = 90;
const S_GATE: Point = [S_X, 214];
const S_PAY_SHIFT = 20;
const S_PAY_RUN = 24;
const S_PAY_R = 8;
const S_PAY_Y = 321;
const S_EXIT_R = 16;
const S_EXIT_Y = 393;
const S_END = 100;

const STACKED: Layout = {
  name: 'stacked',
  w: 340,
  h: 500,
  half: S_HALF,
  gate: S_GATE,
  parts: [
    { band: true, half: S_HALF, track: { from: [S_X, 0], heading: 90, segs: [{ line: S_GATE[1] }] } },
    {
      band: true,
      half: S_HALF,
      track: {
        from: S_GATE,
        heading: 90,
        segs: [
          { arc: S_R, turn: 90 },
          { arc: S_R, turn: 90 },
          { line: S_GATE[1] - S_JOIN },
          { arc: S_R, turn: 90 },
          { arc: S_R, turn: 90 },
        ],
      },
    },
    {
      half: S_HALF,
      track: {
        from: S_GATE,
        heading: 90,
        segs: [
          { line: S_EXIT_Y - S_GATE[1] - S_EXIT_R },
          { arc: S_EXIT_R, turn: -90 },
          { line: S_END - S_X - S_EXIT_R },
        ],
      },
    },
    {
      band: true,
      cap: true,
      half: S_PAY,
      track: {
        from: S_GATE,
        heading: 90,
        segs: [
          ...bend(-S_PAY_SHIFT, S_PAY_RUN),
          { line: S_PAY_Y - S_GATE[1] - S_PAY_RUN - S_PAY_R },
          { arc: S_PAY_R, turn: -90 },
          { line: S_END - S_X - S_PAY_SHIFT - S_PAY_R },
        ],
      },
    },
  ],
  labels: {
    entry: [S_X + S_HALF + 16, 13],
    restake: [S_X + S_HALF + 16, 88],
    gate: [S_X + S_PAY_SHIFT + S_PAY + 12, S_GATE[1]],
    payout: [S_END + 16, S_PAY_Y],
    exit: [S_END + 16, S_EXIT_Y],
  },
};

function Drawing({ layout: l }: { layout: Layout }) {
  const id = `bk-staking-cycle-${l.name}`;
  const [gx, gy] = l.gate;
  return (
    <FlowSvg layout={l.name} size={[l.w, l.h]} label={LABEL}>
      <defs>
        <HatchPattern id={`${id}-hatch`} />
      </defs>

      <Parts id={id} parts={l.parts} hatch={`${id}-hatch`} size={[l.w, l.h]} />

      {/* The cycle end: a P-Chain transaction, so a filled bar in the P-Chain color across the band. */}
      <g data-bk-role="pchain">
        <rect x={gx - l.half - 8} y={gy - 1.5} width={2 * l.half + 16} height={3} fill="currentColor" />
      </g>
      {l.leader && (
        <line className="bk-fig-steel" x1={l.leader[0]} y1={gy} x2={l.leader[1]} y2={gy} stroke="currentColor" />
      )}

      <FlowLabel at={l.labels.entry} {...ENTRY} />
      <FlowLabel at={l.labels.restake} {...RESTAKE} />
      <FlowLabel at={l.labels.gate} {...GATE} />
      <FlowLabel at={l.labels.payout} {...PAYOUT} />
      <FlowLabel at={l.labels.exit} {...EXIT} />
    </FlowSvg>
  );
}

/** The auto-renewed staking cycle (ACP-236): start, cycle end, restake or exit, and the reward split. */
export function StakingCycleFigure() {
  return (
    <FlowArt name="staking-cycle">
      <Drawing layout={WIDE} />
      <Drawing layout={STACKED} />
    </FlowArt>
  );
}
