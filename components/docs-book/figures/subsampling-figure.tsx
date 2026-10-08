import {
  endOf,
  FlowArt,
  FlowLabel,
  FlowSvg,
  HatchPattern,
  outline,
  type Point,
  type Track,
} from '@/components/docs-book/flow';

/*
 * Figure for the Snowman Consensus page: repeated subsampling (Snowball), drawn as a loop. The hatched band is the
 * poll of one node on one block. It passes three steps (sample, count, confidence + 1), then goes around the loop
 * to sample again. When the confidence reaches beta, the band leaves the loop: the block is accepted. The empty
 * channel is a failed poll. It skips the + 1 step, sets the confidence to 0 and goes back to sample again. A
 * chevron on each loop points back to the sample step.
 *
 * Facts from avalanchego@5bf881e (origin/master; v1.15.1 has the same lines):
 * - DefaultParameters: K 20, AlphaPreference 15, AlphaConfidence 15, Beta 20. The node flags snow-sample-size,
 *   snow-quorum-size (sets both alpha values; flags.go:312, config.go:116-119), snow-preference-quorum-size,
 *   snow-confidence-quorum-size and snow-commit-threshold change them.
 *   snow/consensus/snowball/parameters.go:38-47, :54-65; config/flags.go:311-316; config/config.go:116-119
 * - The engine samples K places at random, weighted by stake. snow/engine/snowman/engine.go:885;
 *   snow/validators/set.go:35, :261. The sampler draws weight without replacement, not validators, so one
 *   validator can fill more than one place: utils/sampler/weighted_without_replacement.go:6-8. Each place counts
 *   as a vote (engine.go:907), and the engine queries each validator once (engine.go:918).
 * - Fewer than alphaPreference votes for every choice is an unsuccessful poll, which clears the confidence.
 *   snow/consensus/snowball/tree.go:420-424, :535-539; nnary_snowflake.go:59-62, :90-92
 * - A successful poll with alphaPreference votes can change the preference. binary_snowball.go:42-50
 * - alphaConfidence votes add 1 to the confidence, and the instance finalizes when the confidence reaches beta.
 *   nnary_snowflake.go:75-86; binary_snowflake.go:68-79
 * - A successful poll for a different choice than the last successful poll clears the confidence first, so the
 *   count starts again at 1. binary_snowflake.go:57-62, :75; nnary_snowflake.go:64-68, :82. Snowman gets there
 *   through tree.go:542 and binary_snowball.go:49. The confidence counts the choice of the last successful poll,
 *   which can differ from the snowball preference (binary_snowball.go:31-39). Thus the + 1 label says "the block
 *   of the last poll", not "the preference".
 *
 * Two drawings of the same content, as in reward-routes-figure.tsx: a wide one (720 units) and a stacked one (340
 * units) for phones. Consensus is neither the P-Chain side nor the L1 side, so the figure is ink and steel only.
 */

interface Step {
  name: string;
  code?: string;
  lines: readonly string[];
}

const SAMPLE: Step = {
  name: 'Sample k validators',
  code: 'k = 20',
  lines: ['At random, weighted by', 'stake, with repeats.'],
};
const COUNT: Step = {
  name: 'Count the votes',
  code: 'alphaPreference = 15',
  lines: ['15 or more votes for a block', 'can make it the preference.'],
};
const PLUS: Step = {
  name: 'Confidence + 1',
  code: 'alphaConfidence = 15',
  lines: [
    '15 or more votes for the',
    'block of the last poll.',
    'A poll for another block',
    'sets the confidence to 1.',
  ],
};
const RESET: Step = { name: 'Failed poll', lines: ['No block gets 15 votes.', 'Confidence = 0.'] };
const ACCEPTED: Step = {
  name: 'Accepted',
  code: 'beta = 20',
  lines: ['20 successful polls', 'in a row for the', 'same block.'],
};

/* The steps in the order of the label anchors of a layout. */
const STEPS = [SAMPLE, COUNT, PLUS, RESET, ACCEPTED] as const;

/*
 * FlowLabel sets the name baseline 5 units under its anchor, and a name is 11 units tall. Under the baseline, a
 * label with a code line and two lines of prose is 61 units deep, and a label with two lines of prose is 43. Each
 * more line of prose adds 17.
 */
const DEPTH = { code: 61, prose: 43, line: 17 } as const;
/** The anchor of a label that ends 12 units over `top`. */
const over = (top: number, depth: number) => top - 12 - depth - 5;
/** The anchor of a label whose name starts 14 units under `bottom`. */
const under = (bottom: number) => bottom + 14 + 11 - 5;

const LABEL =
  'Snowball repeats one poll in a loop. A hatched band enters the loop and passes three steps. Step 1: the node ' +
  'samples k = 20 places at random, weighted by stake; one validator can fill more than one place. Step 2: it ' +
  'counts the votes. With alphaPreference = 15 or more votes, a block can become the preference. Step 3: with ' +
  'alphaConfidence = 15 or more votes for the block of the last poll, the confidence goes up by 1. A ' +
  'successful poll for a different block sets the confidence to 1. Then the band goes around the loop to step 1, ' +
  'as its arrow shows. When the confidence reaches beta = 20, the band leaves the loop, and the node accepts the ' +
  'block: 20 successful polls in a row for the same block. An empty path shows a failed poll: no block gets 15 ' +
  'votes, and the confidence is set to 0. That path also goes back to step 1, as its arrow shows.';

/** A bar across a channel: a step that the band goes through. Also the place and the heading of a chevron. */
interface Gate {
  at: Point;
  heading: number;
}

interface Layout {
  name: 'wide' | 'stacked';
  w: number;
  h: number;
  /* Half the width of the band. */
  half: number;
  /* The band from the edge of the drawing, through the steps, to Accepted. */
  main: Track;
  /* The band again, from the fork after + 1 back to the start of the steps. */
  loop: Track;
  /* The empty channel of a failed poll, from the fork after the count back to the start of the steps. */
  reset: Track;
  /* Sample, count and + 1 on the band. */
  gates: readonly Gate[];
  /* The step of the failed poll, on its empty channel. */
  fail: Gate;
  /* A chevron on the return run of each loop, which points back to the sample step. */
  arrows: { loop: Gate; reset: Gate };
  /* The left end of each label, level with the middle of its name, in the order of STEPS. */
  labels: readonly Point[];
}

/*
 * Wide: the band runs left to right through the middle. The loop of successful polls goes up and back, the loop
 * of failed polls goes down and back, and both join the band again before the sample step. The labels of sample
 * and count stand inside the upper loop, over their bars, and the label of the failed poll inside the lower loop.
 */
const W_HALF = 12;
const W_R = 64;
const W_Y = 4 + 2 * W_R + W_HALF;
/* The loops join the band at W_JOIN. The failed poll leaves after the count, at W_FAIL, and the loop of
   successful polls leaves after + 1, at W_LOOP. */
const W_JOIN = 80;
const W_FAIL = 300;
const W_LOOP = 448;
const W_END = 568;
const W_GATES = [96, 262, 392] as const;
/* The labels of sample and count end over the top of their bars. */
const W_UP = over(W_Y - W_HALF - 4, DEPTH.code);

/** A loop of four quarter turns: it leaves the band at x, turns back, and joins the band again at W_JOIN. */
function wideLoop(x: number, turn: 90 | -90): Track {
  const q = { arc: W_R, turn };
  return { from: [x, W_Y], heading: 0, segs: [q, q, { line: x - W_JOIN }, q, q] };
}

const WIDE: Layout = {
  name: 'wide',
  w: 720,
  h: W_Y + 2 * W_R + W_HALF + 4,
  half: W_HALF,
  main: { from: [0, W_Y], heading: 0, segs: [{ line: W_END }] },
  loop: wideLoop(W_LOOP, -90),
  reset: wideLoop(W_FAIL, 90),
  gates: W_GATES.map((x) => ({ at: [x, W_Y], heading: 0 })),
  fail: { at: [W_GATES[0], W_Y + 2 * W_R], heading: 0 },
  /* Each chevron sits in the middle of the back run of its loop and points west, to the sample step. */
  arrows: {
    loop: { at: [(W_LOOP + W_JOIN) / 2, W_Y - 2 * W_R], heading: 180 },
    reset: { at: [(W_FAIL + W_GATES[0]) / 2, W_Y + 2 * W_R], heading: 180 },
  },
  labels: [
    [W_GATES[0] - 1.5, W_UP],
    [W_GATES[1] - 1.5, W_UP],
    [W_GATES[2] - 1.5, under(W_Y + W_HALF + 4)],
    [W_GATES[0] - 1.5, over(W_Y + 2 * W_R - W_HALF - 4, DEPTH.prose)],
    [W_END + 16, W_Y],
  ],
};

/*
 * Phones: the band comes down at the left. Both loops go out to the right, around the labels: the loop of failed polls
 * inside, the loop of successful polls outside it. The labels stand in one column, each one level with its bar,
 * and the band leaves at the bottom to Accepted.
 */
const S_HALF = 8;
const S_R = 20;
const S_X = 24;
/* The right runs of the two loops, and the gap between the two channels. */
const S_GAP = 12;
const S_OUT = 330;
const S_IN = S_OUT - 2 * S_HALF - S_GAP;
const S_TOP = 12;
const S_LABEL = S_X + S_HALF + 16;
const S_GATES = [80, 172, 368] as const;
/* The bottom runs of the inner and the outer loop, and the run of the band to Accepted. The outer loop runs 12
   units under the + 1 label, which has four lines of prose. */
const S_IN_LOW = 338;
const S_OUT_LOW = S_GATES[2] + 5 + DEPTH.code + 2 * DEPTH.line + 12 + S_HALF;
const S_EXIT = S_OUT_LOW + 2 * S_HALF + 16;
const S_END = 92;
/* The chevrons on the right runs of the two loops, at one height, inside the run of the inner loop. */
const S_ARROW = 190;

/** A loop that turns left four times: from the band, along `low` and `right`, and into the band again at `top`. */
function stackedLoop(low: number, right: number, top: number): Track {
  const q = { arc: S_R, turn: -90 };
  return {
    from: [S_X, low - S_R],
    heading: 90,
    segs: [q, { line: right - S_X - 2 * S_R }, q, { line: low - top - 2 * S_R }, q, { line: right - S_X - 2 * S_R }, q],
  };
}

const STACKED: Layout = {
  name: 'stacked',
  w: 340,
  /* Accepted has a code line and three lines of prose under its anchor, then 4 units of margin. */
  h: S_EXIT + 5 + DEPTH.code + DEPTH.line + 4,
  half: S_HALF,
  main: {
    from: [S_X, 0],
    heading: 90,
    segs: [{ line: S_EXIT - S_R }, { arc: S_R, turn: -90 }, { line: S_END - S_X - S_R }],
  },
  loop: stackedLoop(S_OUT_LOW, S_OUT, S_TOP),
  reset: stackedLoop(S_IN_LOW, S_IN, S_TOP + 2 * S_HALF + S_GAP),
  gates: S_GATES.map((y) => ({ at: [S_X, y], heading: 90 })),
  fail: { at: [S_LABEL, S_IN_LOW], heading: 0 },
  arrows: {
    loop: { at: [S_OUT, S_ARROW], heading: -90 },
    reset: { at: [S_IN, S_ARROW], heading: -90 },
  },
  labels: [
    [S_LABEL, S_GATES[0]],
    [S_LABEL, S_GATES[1]],
    [S_LABEL, S_GATES[2]],
    [S_LABEL, over(S_IN_LOW - S_HALF - 4, DEPTH.prose)],
    [S_END + 16, S_EXIT],
  ],
};

/** A bar across a channel at a point, 4 units past each edge. */
function GateBar({ gate: { at, heading }, half }: { gate: Gate; half: number }) {
  return (
    <rect
      x={at[0] - 1.5}
      y={at[1] - half - 4}
      width={3}
      height={2 * half + 8}
      fill="currentColor"
      transform={heading === 0 ? undefined : `rotate(${heading} ${at[0]} ${at[1]})`}
    />
  );
}

/* A filled chevron that points east, centered on 0 0, for a band 24 units wide. Chevron scales it to the band. */
const CHEVRON = 'M4.5 0 L-2.5 -7 L-6.5 -7 L0.5 0 L-6.5 7 L-2.5 7 Z';

/** The chevron at a point of a channel, turned to its heading. */
function Chevron({
  gate: { at, heading },
  half,
  ...rest
}: {
  gate: Gate;
  half: number;
  stroke?: string;
  strokeWidth?: number;
}) {
  return (
    <path
      d={CHEVRON}
      transform={`translate(${at[0]} ${at[1]}) rotate(${heading}) scale(${half / 12})`}
      fill="currentColor"
      strokeLinejoin="round"
      {...rest}
    />
  );
}

function Drawing({ layout: l }: { layout: Layout }) {
  const id = `bk-subsampling-${l.name}`;
  const hatch = `${id}-hatch`;
  /* Inset the mask shapes a little, as Fork does, so a hairline on a shared edge stays visible. */
  const inner = (t: Track) => outline(t, l.half - 0.6, true);
  /* `cut` also clears the hatch around the chevron of the band loop, so the chevron reads on the hatch. */
  const masks = {
    main: { tracks: [l.main], cut: false },
    loop: { tracks: [l.loop], cut: false },
    both: { tracks: [l.main, l.loop], cut: false },
    hatch: { tracks: [l.main], cut: true },
  };
  const { at: end } = endOf(l.main);
  return (
    <FlowSvg layout={l.name} size={[l.w, l.h]} label={LABEL}>
      <defs>
        <HatchPattern id={hatch} />
        {/* Each mask hides the parts of a channel inside other channels. White and black are mask values. */}
        {Object.entries(masks).map(([name, { tracks, cut }]) => (
          <mask
            key={name}
            id={`${id}-out-${name}`}
            maskUnits="userSpaceOnUse"
            x={-20}
            y={-20}
            width={l.w + 40}
            height={l.h + 40}
          >
            <rect x={-20} y={-20} width={l.w + 40} height={l.h + 40} fill="white" />
            {tracks.map((t, i) => (
              <path key={i} d={inner(t)} fill="black" />
            ))}
            {cut && <Chevron gate={l.arrows.loop} half={l.half} stroke="black" strokeWidth={5} />}
          </mask>
        ))}
      </defs>

      {/* The failed poll: an empty steel channel, hidden where it runs inside the band. */}
      <g className="bk-fig-steel">
        <path d={outline(l.reset, l.half)} mask={`url(#${id}-out-both)`} fill="none" stroke="currentColor" />
        <GateBar gate={l.fail} half={l.half} />
        <Chevron gate={l.arrows.reset} half={l.half} />
      </g>

      {/* The band and its loop. Where they overlap, the hatch draws once and neither edge shows. */}
      <path d={outline(l.main, l.half, true)} fill={`url(#${hatch})`} />
      <path d={outline(l.loop, l.half, true)} fill={`url(#${hatch})`} mask={`url(#${id}-out-hatch)`} />
      <path d={outline(l.main, l.half)} mask={`url(#${id}-out-loop)`} fill="none" stroke="currentColor" />
      <path d={outline(l.loop, l.half)} mask={`url(#${id}-out-main)`} fill="none" stroke="currentColor" />
      <Chevron gate={l.arrows.loop} half={l.half} />
      {/* The end of the band, as in Band: both drawings leave heading east. */}
      <rect x={end[0]} y={end[1] - l.half - 4} width={3} height={2 * l.half + 8} fill="currentColor" />
      {l.gates.map((g) => (
        <GateBar key={`${g.at[0]} ${g.at[1]}`} gate={g} half={l.half} />
      ))}

      {STEPS.map((step, i) => (
        <FlowLabel key={step.name} at={l.labels[i]} name={step.name} code={step.code} lines={step.lines} />
      ))}
    </FlowSvg>
  );
}

/** Figure for the Snowman Consensus page: the poll loop of Snowball, with the AvalancheGo defaults. */
export function SubsamplingFigure() {
  return (
    <FlowArt name="subsampling">
      <Drawing layout={WIDE} />
      <Drawing layout={STACKED} />
    </FlowArt>
  );
}
