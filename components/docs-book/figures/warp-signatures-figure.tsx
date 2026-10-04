import {
  Band,
  Channel,
  endOf,
  FlowArt,
  FlowLabel,
  FlowSvg,
  HatchPattern,
  MARK,
  Marker,
  outline,
  type Box,
  type Point,
  type Seg,
  type Track,
} from '@/components/docs-book/flow';

/*
 * Figure for the ICM overview page: sign, aggregate, verify. Each validator of the origin L1 that signs sends its
 * signature on its own thin hatched channel. The signed channels converge at the signature aggregator (the bar)
 * and lie side by side, so together they are as wide as the band that leaves it: one signed message. The validator
 * that does not sign has an empty steel channel. It ends at the bar outside the bundle, so it adds no width to the
 * band. The band ends at the check of the destination L1, and a P-Chain line comes down into that check.
 *
 * Facts, from AvalancheGo at 5bf881e069 (origin/master). v1.15.1 says the same at each cite.
 * - A validator signs the unsigned message bytes with its BLS key: vms/platformvm/warp/signer.go:43-56.
 * - The aggregator requests signatures from the validators, aggregates them into one BLS signature and records the
 *   signers in a bit set: network/p2p/acp118/aggregator.go:53-58,196-217. BitSetSignature is Signers (the bit set)
 *   and one 96-byte Signature: vms/platformvm/warp/signature.go:47-52, vms/platformvm/warp/README.md:48-68.
 *   The VM picks how to aggregate (VM to VM, an off-chain relayer): README.md:84. A node can also aggregate through
 *   its warp API: graft/subnet-evm/warp/service.go:75-84,134. So the figure says "for example a relayer".
 * - Bit i of the bit set is validator i of the canonical validator set, which is sorted by BLS public key:
 *   README.md:63,66, snow/validators/warp.go:107-141. The rows are in that order, validator 0 first. The bit set is a
 *   big.Int with bit i = 2^i, and Signers is its big-endian bytes: utils/set/bits.go:12-17,34-36,88-95,
 *   signature.go:48-50. Signers 0, 1, 2 and 4 so encode as 0x17.
 * - The destination reads the validator set of the origin L1 at the P-Chain height in its ProposerVM block header:
 *   graft/subnet-evm/precompile/contracts/warp/config.go:239-242, README.md:96-104.
 * - It keeps the validators whose bit is 1, adds their weight, checks it against the quorum, aggregates their public
 *   keys and verifies the one signature: vms/platformvm/warp/signature.go:83-125. The weight check passes when
 *   sigWeight * quorumDen >= totalWeight * quorumNum: signature.go:135-157.
 * - The quorum is quorumNumerator / 100, from the warpConfig of the destination chain, the same for every origin
 *   chain. The default numerator is 67, the minimum 33, the maximum 100, and 0 means 67:
 *   graft/subnet-evm/precompile/contracts/warp/config.go:23-25,53,98-104,191,203-206 (the same in
 *   graft/coreth/precompile/contracts/warp/config.go:23-25,53,98-104,202-205). The C-Chain uses the default:
 *   vms/saevm/cchain/genesis.go:127-129, graft/coreth/precompile/contracts/warp/config.go:69-71. The P-Chain uses a
 *   fixed 67 / 100 for the Warp messages in RegisterL1ValidatorTx and SetL1ValidatorWeightTx:
 *   vms/platformvm/txs/executor/warp_verifier.go:15-16,117-122,153-159.
 *
 * Two drawings, as in reward-routes-figure.tsx: wide (720 units) for a column of 660px or more, and stacked (340
 * units) for phones. Colors: the P-Chain parts in the P-Chain role (a hollow square, the word "P-Chain"), the
 * aggregator and the signed message in the ICM role (steel, with their names).
 */

interface Validator {
  /* Percent of the stake weight of the origin L1. */
  share: number;
  signed: boolean;
}

/* In the order of the canonical validator set: index i is bit i. */
const VALIDATORS: readonly Validator[] = [
  { share: 25, signed: true },
  { share: 20, signed: true },
  { share: 20, signed: true },
  { share: 20, signed: false },
  { share: 15, signed: true },
];

const name = (i: number) => `Validator ${i}`;
const SIGNED = VALIDATORS.reduce((sum, v) => (v.signed ? sum + v.share : sum), 0);
const QUORUM = 67;
/* The Signers field: the big-endian bytes of the bit set, with bit i = 2^i. */
const SIGNERS = `0x${VALIDATORS.reduce((n, v, i) => (v.signed ? n + 2 ** i : n), 0)
  .toString(16)
  .padStart(2, '0')}`;
const SIGNER_IDS = VALIDATORS.flatMap((v, i) => (v.signed ? [i] : []));
const EMPTY_IDS = VALIDATORS.flatMap((v, i) => (v.signed ? [] : [i]));

/* "a, b, c and d" */
const list = (items: readonly (string | number)[]) =>
  items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;

const LABEL =
  `Five validators of the origin L1, numbered 0 to 4 in the order of their BLS public keys, hold ` +
  `${list(VALIDATORS.map((v) => v.share))} percent of the stake weight. Validators ${list(SIGNER_IDS)} sign the ` +
  'Warp message, each with its BLS key, and each signature flows on its own thin channel. ' +
  `${name(EMPTY_IDS[0])} does not sign, so its channel is empty and ends at the signature aggregator. The ` +
  `aggregator, for example a relayer, aggregates the ${SIGNER_IDS.length} signatures into one BLS signature. The ` +
  `signed Warp message leaves it as one band, as wide as the ${SIGNER_IDS.length} signed channels. Its signers ` +
  `field is ${SIGNERS}: bit i is validator i, in key order, so bits ${list(SIGNER_IDS)} are 1 and bit ` +
  `${list(EMPTY_IDS)} is 0. The destination L1 reads the validator set of the origin L1 from the P-Chain, at the ` +
  'P-Chain height in its block. It accepts the message only if the signers hold ' +
  `${QUORUM} percent or more of the stake weight, the default quorum. Here the signers hold ${SIGNED} percent, ` +
  'so the destination L1 accepts the message.';

const HEADER = ['Each one can sign the message', 'with its BLS key.'] as const;
const AGGREGATOR = ['An aggregator, for example', 'a relayer, collects the', 'signatures and makes one', 'BLS signature.'] as const;
const MESSAGE = ['Bit i: validator i, in key order.'] as const;
const PCHAIN = [
  'BLS keys and weights of the',
  'origin L1 validators, at the',
  'P-Chain height in the block',
  'of the destination L1.',
] as const;
const DESTINATION = [
  `Default ${QUORUM}. The signers must`,
  `hold ${QUORUM}% or more of the`,
  'stake weight. Here they hold',
  `${SIGNED}%, so the L1 accepts it.`,
] as const;

/* Half the width of one signature channel. The band is as wide as the signed channels side by side. */
const THIN = 3.5;
const HALF = THIN * SIGNER_IDS.length;

/*
 * For each validator, the center of its channel where it meets the bar, from the center line of the bundle. The
 * signed channels lie side by side in the order of the rows. A validator that does not sign has null: its channel
 * ends at the bar outside the bundle.
 */
const PLACE = VALIDATORS.map((v, i) =>
  v.signed ? (2 * SIGNER_IDS.indexOf(i) - (SIGNER_IDS.length - 1)) * THIN : null,
);

interface Layout {
  name: 'wide' | 'stacked';
  w: number;
  h: number;
  /* One channel for each validator, in the order of VALIDATORS. Each one ends at the aggregator. */
  channels: readonly Track[];
  /* The signed message, from the aggregator to the check of the destination L1. */
  band: Track;
  gate: Box;
  header: Point;
  /* The left end of each row label, at the center line of its channel. */
  rows: readonly Point[];
  /* The baseline of the column heads "stake" and "bit". */
  heads: number;
  /* The right end of the column of shares, and the center of the column of bits. */
  shares: number;
  bits: number;
  aggregator: Point;
  message: Point;
  /* The top of the P-Chain marker. The marker stands over the check, and a line goes down from it to the check. */
  pchain: number;
}

/*
 * Move a channel sideways by `shift` and keep its heading: an arc, a straight run at TILT degrees, and an arc. Then
 * a straight run to the end. TILT stays well under the 45 degrees of the hatch, so a channel that climbs does not
 * run along its hatch lines. The shift must be larger than the 2 arcs alone move it (about 5 units).
 */
const TILT = 28;
const EASE = 20;
function ease(shift: number, length: number): Seg[] {
  if (!shift) return [{ line: length }];
  const a = (TILT * Math.PI) / 180;
  const sign = Math.sign(shift);
  const diagonal = (Math.abs(shift) - 2 * EASE * (1 - Math.cos(a))) / Math.sin(a);
  const run = 2 * EASE * Math.sin(a) + diagonal * Math.cos(a);
  return [
    { arc: EASE, turn: sign * TILT },
    { line: diagonal },
    { arc: EASE, turn: -sign * TILT },
    { line: length - run },
  ];
}

/*
 * Wide: the rows stand in a column at the left. Each signed channel leaves its row to the east and eases to its
 * place in the bundle. Validator 2 runs straight, so the bundle is centered 3.5 over its row. The empty channel runs
 * straight to the bar, below the bundle, and the channel of validator 4 passes over it. The band runs east to the
 * check, and the labels of the P-Chain and the destination stand in one column at the right.
 */
const W_ROWS = [102, 142, 182, 222, 262] as const;
const W_MID = W_ROWS[2] - (PLACE[2] ?? 0);
const W_START = 144;
/* The longest ease (validator 4, 73 up) ends at x 291. The bundle runs straight from there to the bar. */
const W_GATE = 310;
/* The check, the cap at the end of the band. The labels of the P-Chain and the destination start 14.5 after it. */
const W_END = 524.5;

const WIDE: Layout = {
  name: 'wide',
  w: 720,
  h: 308,
  channels: W_ROWS.map((y, i) => {
    const place = PLACE[i];
    return {
      from: [W_START, y],
      heading: 0,
      segs: ease(place === null ? 0 : W_MID + place - y, W_GATE - W_START),
    };
  }),
  band: { from: [W_GATE, W_MID], heading: 0, segs: [{ line: W_END - W_GATE }] },
  gate: {
    x: W_GATE - 1.5,
    y: W_MID - HALF - 8,
    w: 3,
    h: Math.max(...EMPTY_IDS.map((i) => W_ROWS[i] + THIN + 8)) - (W_MID - HALF - 8),
  },
  header: [0, 20],
  rows: W_ROWS.map((y) => [0, y] as const),
  heads: 78,
  shares: 106,
  bits: 124,
  // The prose lines of the aggregator share their baselines with the last 3 lines of the destination, and its
  // text ends more than 40 units before the destination column.
  aggregator: [W_GATE + 16, W_MID + 35],
  message: [W_GATE + 16, W_MID - HALF - 62],
  pchain: 40,
};

/*
 * Phones: the rows stand at the right. Each channel leaves its row to the west and turns south, the top row on
 * the outside. The empty channel turns south outside the bundle, far enough out that the channel of validator 4
 * crosses it on a straight run. Under the aggregator the band runs south, then turns east to the check.
 */
const S_X = 24;
const S_START = 84;
const S_COL = 96;
const S_ROWS = [100, 140, 180, 220, 260] as const;
const S_TURN = 16;
const S_EMPTY = S_X + HALF + 16.5 + THIN;
const S_GATE = 296;
const S_BEND = 32;
const S_CHECK = 597;
const S_END = 125.5;

const STACKED: Layout = {
  name: 'stacked',
  w: 340,
  h: 707,
  channels: S_ROWS.map((y, i) => {
    const place = PLACE[i];
    const x = place === null ? S_EMPTY : S_X + place;
    return {
      from: [S_START, y],
      heading: 180,
      segs: [{ line: S_START - x - S_TURN }, { arc: S_TURN, turn: -90 }, { line: S_GATE - y - S_TURN }],
    };
  }),
  band: {
    from: [S_X, S_GATE],
    heading: 90,
    segs: [{ line: S_CHECK - S_GATE - S_BEND }, { arc: S_BEND, turn: -90 }, { line: S_END - S_X - S_BEND }],
  },
  gate: { x: S_X - HALF - 8, y: S_GATE - 1.5, w: S_EMPTY + THIN + 8 - (S_X - HALF - 8), h: 3 },
  header: [0, 18],
  rows: S_ROWS.map((y) => [S_COL, y] as const),
  heads: 76,
  shares: S_COL + 132,
  bits: S_COL + 150,
  aggregator: [82, S_GATE],
  message: [82, 413],
  pchain: 487,
};

function Drawing({ layout: l }: { layout: Layout }) {
  const id = `bk-warp-signatures-${l.name}`;
  // The P-Chain marker stands centered over the cap of the band, and the labels at the right start after it.
  const { at: end } = endOf(l.band);
  const px = end[0] + 1.5 - MARK / 2;
  const py = l.pchain;
  const col = px + MARK + 8;
  return (
    <FlowSvg layout={l.name} size={[l.w, l.h]} label={LABEL}>
      <defs>
        <HatchPattern id={`${id}-hatch`} />
        {/* White and black are mask values, not colors on screen. The empty channel breaks where a signed channel
            passes over it, with a small gap on each side. */}
        <mask id={`${id}-under`} maskUnits="userSpaceOnUse" x={-20} y={-20} width={l.w + 40} height={l.h + 40}>
          <rect x={-20} y={-20} width={l.w + 40} height={l.h + 40} fill="white" />
          {SIGNER_IDS.map((i) => (
            <path key={i} d={outline(l.channels[i], THIN + 2, true)} fill="black" />
          ))}
        </mask>
      </defs>

      <text className="bk-flow-name" x={l.header[0]} y={l.header[1]}>
        Origin L1 validators
      </text>
      {HEADER.map((line, j) => (
        <text key={line} className="bk-fig-sans bk-fig-ink2" x={l.header[0]} y={l.header[1] + 20 + j * 17}>
          {line}
        </text>
      ))}

      <text className="bk-fig-sans bk-fig-ink2" x={l.shares} y={l.heads} textAnchor="end">
        stake
      </text>
      <text className="bk-fig-sans bk-fig-ink2" x={l.bits} y={l.heads} textAnchor="middle">
        bit
      </text>
      {VALIDATORS.map((v, i) => {
        const [x, y] = l.rows[i];
        return (
          <g key={i}>
            <text className="bk-fig-sans" x={x} y={y + 5}>
              {name(i)}
            </text>
            <text className="bk-fig-sans bk-fig-ink2" x={l.shares} y={y + 5} textAnchor="end">
              {v.share}%
            </text>
            <text className="bk-fig-code" x={l.bits} y={y + 5} textAnchor="middle">
              {v.signed ? 1 : 0}
            </text>
            {!v.signed && (
              <text className="bk-flow-tag" x={x} y={y + 22}>
                no signature
              </text>
            )}
          </g>
        );
      })}

      {/* The empty channel first, under the signed channels. */}
      <g mask={`url(#${id}-under)`}>
        {EMPTY_IDS.map((i) => (
          <Channel key={i} track={l.channels[i]} half={THIN} />
        ))}
      </g>
      {SIGNER_IDS.map((i) => (
        <Band key={i} track={l.channels[i]} half={THIN} hatch={`${id}-hatch`} cap={false} />
      ))}

      {/* One signed message, as wide as the signed channels. Its cap is the check of the destination L1. */}
      <Band track={l.band} half={HALF} hatch={`${id}-hatch`} />

      {/* The aggregator: a bar in the ICM color across every channel that comes in, the empty one too. */}
      <g data-bk-role="icm">
        <rect x={l.gate.x} y={l.gate.y} width={l.gate.w} height={l.gate.h} fill="currentColor" />
      </g>
      <FlowLabel at={l.aggregator} name="Signature aggregator" role="icm" lines={AGGREGATOR} />
      <FlowLabel at={l.message} name="Signed Warp message" role="icm" code={`signers ${SIGNERS}`} lines={MESSAGE} />

      {/* The P-Chain gives the validator set to the check: a hollow square, and a line down to the cap. */}
      <g data-bk-role="pchain">
        <Marker kind="setting" x={px} y={py} />
        <path d={`M${px + MARK / 2} ${py + MARK} V${end[1] - HALF - 4}`} fill="none" stroke="currentColor" />
        <text className="bk-flow-name" x={col} y={py + MARK}>
          P-Chain
        </text>
      </g>
      {PCHAIN.map((line, j) => (
        <text key={line} className="bk-fig-sans bk-fig-ink2" x={col} y={py + MARK + 22 + j * 17}>
          {line}
        </text>
      ))}

      <FlowLabel at={[col, end[1]]} name="Destination L1" code="quorumNumerator" lines={DESTINATION} />
    </FlowSvg>
  );
}

/** Sign, aggregate, verify: origin validators sign, an aggregator makes one BLS signature, the destination checks it. */
export function WarpSignaturesFigure() {
  return (
    <FlowArt name="warp-signatures">
      <Drawing layout={WIDE} />
      <Drawing layout={STACKED} />
    </FlowArt>
  );
}
