import {
  bend,
  FlowArt,
  FlowLabel,
  FlowSvg,
  Fork,
  HatchPattern,
  type Box,
  type Point,
  type Track,
} from '@/components/docs-book/flow';

/*
 * Figure for the Coreth Architecture page, drawn as a flow diagram in the style of reward-routes-figure.tsx. The
 * C-Chain blocks are a band of constant width. The band enters at the left, goes through TransitionVM (the red
 * bar), and continues on the channel of the VM that executes the blocks now. The Coreth channel branches off at
 * the same point, but it is an empty outline: no block after the transition block goes to Coreth.
 *
 * Facts from AvalancheGo at 5bf881e (origin/master):
 * - node/node.go:1231-1251: the node registers transitionvm.Factory for the EVM, with Coreth
 *   (graft/coreth/plugin/factory, import at :88) before the switch and vms/saevm/cchain (import at :91) after
 *   it. TransitionTime is HeliconTime minus 10 s (:1248).
 * - vms/transitionvm/README.md:3-6: one binary holds both VMs, and the swap is in-process. :37-39: the switch is
 *   one-way and happens once.
 * - vms/transitionvm/README.md:45-48 and vm_block.go:124,151: the transition block is the first block with a
 *   timestamp at or after TransitionTime. Coreth executes the blocks up to and including it, and the post-transition
 *   VM executes all later blocks. The node switches when it accepts the transition block (vm_block.go:151), not at
 *   a fixed time. The figure uses the terms of the page: "transition time" and "transition block".
 * - vms/transitionvm/README.md:88-96 and :108-111: a node that state syncs from genesis switches during
 *   initialization, but a node that bootstraps without state sync still runs Coreth up to the transition block. So
 *   the Coreth label is in the present tense.
 * - upgrade/upgrade.go:41 and :66: Helicon is 2026-09-22 15:00 UTC on Mainnet and 2026-07-28 15:00 UTC on Fuji, so
 *   both networks run the Continuous Execution VM now. v1.15.1 has the same TransitionVM wiring (node/node.go:1248)
 *   and the same Helicon times (upgrade/upgrade.go:41 and :65).
 *
 * Two drawings of the same content: a wide one (720 units) for a container of 660px or more, and a tall one
 * (340 units) for phones. figure.css shows one of them with a container query. The only colored part is
 * TransitionVM, the VM of the C-Chain (EVM side), and its name says what it is.
 */

interface Vm {
  name: string;
  tag?: string;
  code: string;
  lines: readonly string[];
}

const VMS: readonly Vm[] = [
  {
    name: 'Coreth',
    code: 'graft/coreth',
    lines: ['Executes every block up to', 'and including the transition block.'],
  },
  {
    name: 'Continuous Execution VM',
    tag: 'active',
    code: 'vms/saevm/cchain',
    lines: ['Executes every later block.', 'On Mainnet and Fuji since Helicon.'],
  },
];

/* Helicon is active on Mainnet and Fuji, so the blocks fill the Continuous Execution VM channel. */
const ACTIVE = 1;

const LABEL =
  'C-Chain blocks flow as a band into TransitionVM, in one AvalancheGo process. TransitionVM switches the VM when ' +
  'the node accepts the transition block: the first block at or after the transition time, which is 10 seconds ' +
  'before Helicon. Two channels branch off from TransitionVM, and the blocks fill only one of them. Channel 1, ' +
  'Coreth, graft/coreth: it executes every block up to and including the transition block. Channel 2, the ' +
  'Continuous Execution VM, vms/saevm/cchain: it executes every later block. Helicon is active on Mainnet and ' +
  'Fuji, so in the drawing the blocks fill channel 2.';

interface Layout {
  name: 'wide' | 'stacked';
  w: number;
  h: number;
  /* Half the width of the band. */
  half: number;
  /* One channel for each VM, in the order of VMS. The active one starts at the left or top edge, because it also
     draws the band that comes in. */
  tracks: readonly Track[];
  gate: Box;
  /* The left end of each VM label, at the center line of its channel. */
  labels: readonly Point[];
  source: Point;
  switch: { x: number; y: number; anchor: 'start' | 'end' };
}

/*
 * Wide: the band comes in from the left at the height of the active channel and runs straight to its label. At
 * TransitionVM the Coreth channel branches off with an S bend to the label above. The labels stand in one column
 * at the right, with the name level with the channel.
 */
const W_HALF = 12;
const W_ROWS = [16, 144] as const;
const W_JUNCTION = 240;
const W_RUN = 150;
const W_END = 430;

const WIDE: Layout = {
  name: 'wide',
  w: 720,
  h: 216,
  half: W_HALF,
  tracks: [
    {
      from: [W_JUNCTION, W_ROWS[1]],
      heading: 0,
      segs: [...bend(W_ROWS[0] - W_ROWS[1], W_RUN), { line: W_END - W_JUNCTION - W_RUN }],
    },
    { from: [0, W_ROWS[1]], heading: 0, segs: [{ line: W_END }] },
  ],
  gate: { x: W_JUNCTION - 1.5, y: W_ROWS[1] - W_HALF - 8, w: 3, h: 2 * W_HALF + 16 },
  labels: W_ROWS.map((y) => [W_END + 16, y] as const),
  source: [0, W_ROWS[1] - W_HALF - 32],
  switch: { x: W_JUNCTION - 16, y: W_ROWS[1] + W_HALF + 24, anchor: 'end' },
};

/*
 * Phones: the band comes down at the left. Under TransitionVM the Coreth channel moves one track to the right and
 * turns east to the top label, so the two channels do not cross. The active track runs straight down from the
 * band to the bottom label.
 */
const S_HALF = 8;
const S_X = 16;
const S_GAP = 26;
const S_JUNCTION = 52;
/* The channels share the band for a short run under TransitionVM, so the fork starts below its label. */
const S_SPLIT = 16;
const S_RUN = 72;
const S_ROWS = [164, 286] as const;
const S_TURN = 20;
const S_END = 84;

function stackedTrack(i: number): Track {
  const shift = (1 - i) * S_GAP;
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
  h: 358,
  half: S_HALF,
  tracks: [0, 1].map(stackedTrack),
  gate: { x: S_X - S_HALF - 8, y: S_JUNCTION - 1.5, w: 2 * S_HALF + 16, h: 3 },
  labels: S_ROWS.map((y) => [S_END + 16, y] as const),
  source: [40, 14],
  switch: { x: 40, y: S_JUNCTION + 4, anchor: 'start' },
};

function Drawing({ layout: l }: { layout: Layout }) {
  const id = `bk-cchain-vm-switch-${l.name}`;
  return (
    <FlowSvg layout={l.name} size={[l.w, l.h]} label={LABEL}>
      <defs>
        <HatchPattern id={`${id}-hatch`} />
      </defs>

      {/* Two channels from TransitionVM. The blocks fill the active one, from the edge of the drawing. */}
      <Fork id={id} tracks={l.tracks} half={l.half} active={ACTIVE} hatch={`${id}-hatch`} size={[l.w, l.h]} />

      {/* TransitionVM: the VM of the C-Chain, so a bar in the EVM color across the band. */}
      <g data-bk-role="evm">
        <rect x={l.gate.x} y={l.gate.y} width={l.gate.w} height={l.gate.h} fill="currentColor" />
        <text className="bk-flow-name" x={l.switch.x} y={l.switch.y} textAnchor={l.switch.anchor}>
          TransitionVM
        </text>
      </g>
      <text className="bk-fig-sans bk-fig-ink2" x={l.switch.x} y={l.switch.y + 18} textAnchor={l.switch.anchor}>
        transition time: 10 s before Helicon
      </text>

      <text className="bk-flow-name" x={l.source[0]} y={l.source[1]}>
        C-Chain blocks
      </text>
      <text className="bk-fig-sans bk-fig-ink2" x={l.source[0]} y={l.source[1] + 18}>
        in one AvalancheGo process
      </text>

      {VMS.map((vm, i) => (
        <FlowLabel key={vm.name} at={l.labels[i]} name={vm.name} tag={vm.tag} code={vm.code} lines={vm.lines} />
      ))}
    </FlowSvg>
  );
}

/** One AvalancheGo process runs the C-Chain: TransitionVM sends blocks to Coreth up to the transition block and to the Continuous Execution VM after it. */
export function CChainVmSwitchFigure() {
  return (
    <FlowArt name="cchain-vm-switch">
      <Drawing layout={WIDE} />
      <Drawing layout={STACKED} />
    </FlowArt>
  );
}
