import { Band, FlowArt, FlowLabel, FlowSvg, HatchPattern, type Point, type Track } from '@/components/docs-book/flow';

/*
 * Figure for the Flow of a Single Blockchain page: the path of a poll inside AvalancheGo. A peer sends a PushQuery,
 * and this node answers with Chits. The two messages are one hatched band. It comes in open from the edge, through
 * the Network, the Router, the Handler and the Consensus Engine. The band turns, goes back out through the Sender
 * and the Network, and ends in a cap at the edge where it came in. A thin ink line from the Engine goes to the VM,
 * and on to the database of the VM: the Engine calls the VM, and the band does not go there. The Engine has no
 * database (config.go:17-28), so the database hangs from the VM. The steel words RegisterRequest (on a steel line
 * from the Sender to the Router in the wide drawing) show the step that the Sender adds for a request. Chits are a
 * reply, so this step does not occur now.
 *
 * Facts from AvalancheGo at 5bf881e (origin/master):
 * - network/peer/peer.go:715-749: the peer handles the network messages (Ping, Pong, Handshake, the peer lists)
 *   itself, and gives consensus and App messages to Router.HandleInbound.
 * - network/network.go:61-65: network.Network is the ExternalSender of every chain. network.go:131-134: TLS
 *   handshakes on each connection. chains/manager.go:1101-1111: the Sender of each chain wraps the same m.Net.
 * - snow/networking/router/chain_router.go:62-72: ChainRouter keeps one handler.Handler for each chain ID.
 *   :236 and :264: it reads the chain ID of the message and finds the Handler. :302, :369, :410: chain.Push.
 * - snow/networking/handler/handler.go:78-79: the Handler passes messages from the network to the engine.
 *   :307-313: AppRequest, AppError, AppResponse and AppGossip go in the async queue, all others in the sync queue.
 *   :682-683: a PushQuery goes to engine.PushQuery.
 * - snow/engine/snowman/config.go:17-22: snowman.Engine holds a block.ChainVM and a common.Sender.
 *   engine.go:320-323: PushQuery sends Chits first, then gives the block bytes to VM.ParseBlock.
 *   engine.go:1083: the Engine verifies a block before it adds it to consensus. engine.go:644: e.Sender.SendChits.
 * - snow/networking/sender/sender.go:27: sender implements common.Sender. :712-756: SendChits builds the Chits
 *   message with the OutboundMsgBuilder and sends it through the ExternalSender (:929), with no RegisterRequest.
 *   :550-571: SendPushQuery calls router.RegisterRequest for each node first. chain_router.go:142-213:
 *   RegisterRequest starts a timeout that sends a failure message to the chain if no reply comes.
 * - chains/manager.go:1097-1098 and :95: the VM database is the node database under the chain ID prefix, then
 *   under "vm". :1238-1246: vm.Initialize gets that database and the Sender.
 *
 * Two drawings of the same content: a wide one (720 units) for a column of 660px or more, and a stacked one (340
 * units) for phones. No part has a role color: every part is on the side of one chain, or shared by all chains,
 * and the labels say which.
 */

interface Part {
  name: string;
  code: string;
  /* Short lines for the wide drawing, and longer ones for phones, where a label has the full width. */
  lines: readonly string[];
  phone: readonly string[];
}

const PARTS = {
  source: { name: 'From a peer', code: 'PushQuery', lines: [], phone: [] },
  network: {
    name: 'Network',
    code: 'network.Network',
    lines: ['One Network for', 'all chains.'],
    phone: ['One Network for all chains.'],
  },
  router: {
    name: 'Router',
    code: 'router.ChainRouter',
    lines: ['Gives the message to the Handler', 'of its chain, by chain ID.'],
    phone: ['Finds the Handler by chain ID.'],
  },
  handler: {
    name: 'Handler',
    code: 'handler.Handler',
    lines: ['The PushQuery goes', 'in the sync queue.', 'App messages go in', 'the async queue.'],
    phone: ['The PushQuery goes in the sync queue.', 'App messages go in the async queue.'],
  },
  engine: {
    name: 'Consensus Engine',
    code: 'snowman.Engine',
    lines: ['Answers the poll', 'with the vote of', 'this node.'],
    phone: ['Answers with the vote of this node.'],
  },
  vm: {
    name: 'VM',
    code: 'block.ChainVM',
    lines: ['Parses and verifies blocks.'],
    phone: ['Parses and verifies blocks.'],
  },
  database: {
    name: 'Database',
    code: 'database.Database',
    lines: ['Only for this chain.'],
    phone: ['Only for this chain.'],
  },
  sender: {
    name: 'Sender',
    code: 'common.Sender',
    lines: ['Builds the reply and gives it', 'to the Network to send.'],
    phone: ['Builds the reply and gives it', 'to the Network to send.'],
  },
  destination: { name: 'To the peer', code: 'Chits', lines: [], phone: [] },
} satisfies Record<string, Part>;

type PartKey = keyof typeof PARTS;

const LABEL =
  'The path of a poll inside AvalancheGo, drawn as a hatched band. A peer polls this node with a PushQuery, and ' +
  'the node answers with Chits. The PushQuery comes in from the edge through the ' +
  'Network, network.Network, which all chains share. The Router, router.ChainRouter, gives it to the Handler of ' +
  'its chain by chain ID. The Handler, handler.Handler, puts the PushQuery in the sync queue. App messages go in ' +
  'the async queue. The Consensus Engine, snowman.Engine, answers the poll with the vote of this node. A thin ' +
  'line joins the Engine to the VM, block.ChainVM, which parses and verifies blocks. The VM keeps its state in ' +
  'the database, database.Database, which is only for this chain. The band turns back. The Sender, ' +
  'common.Sender, builds the Chits reply and gives it to the Network, which sends it to the peer. The band ends ' +
  'in a cap at the edge where it came in. Only for a request, not for this reply: the Sender also calls ' +
  'RegisterRequest on the Router to start a timeout.';

/* A bar across the band: a part that the message goes through. */
interface Gate {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Label {
  part: PartKey;
  at: Point;
  anchor?: 'start' | 'end';
}

interface Layout {
  name: 'wide' | 'stacked';
  w: number;
  h: number;
  half: number;
  band: Track;
  gates: readonly Gate[];
  labels: readonly Label[];
  /* The thin ink line from the Engine to the VM, and from the VM to its database, with a tick at each of the two. */
  stem: string;
  /* The line that joins the two Network bars, where the Network is not one bar. */
  network?: string;
  /* The steel words for the timeout of a request, and the thin steel line from the Sender to the Router. On
     phones there is no line, so the words name the Router, and they end at the band of the Sender. */
  register: { path?: string; at: Point; anchor: 'start' | 'end'; tag: string };
}

/* A label that ends at its x: the same lines as FlowLabel, set from the right. */
function EndLabel({ at: [x, cy], part }: { at: Point; part: Part }) {
  const base = cy + 5;
  return (
    <g>
      <text className="bk-flow-name" x={x} y={base} textAnchor="end">
        {part.name}
      </text>
      <text className="bk-fig-code bk-fig-ink2" x={x} y={base + 20} textAnchor="end">
        {part.code}
      </text>
      {part.phone.map((line, j) => (
        <text key={line} className="bk-fig-sans bk-fig-ink2" x={x} y={base + 40 + j * 17} textAnchor="end">
          {line}
        </text>
      ))}
    </g>
  );
}

/*
 * Wide: the PushQuery comes in from the left on row A and goes east through the Router, the Handler and the
 * Engine. At the right it turns down, and the Chits go west on row B through the Sender. The Network is one tall
 * bar across both rows, because the same Network receives and sends. The labels go above row A, between the rows
 * and under row B, so each one has room. The VM and the database stand above the Engine, on a line from its bar.
 */
const W_HALF = 12;
const W_A = 176;
const W_B = 355;
const W_TURN = 20;
const W_X = { network: 80, router: 210, handler: 344, engine: 530, turn: 680 } as const;
/* The reply ends a little inside the left edge, so its cap stays in the drawing. */
const W_END = 8;
const W_TOP = 50;
const W_MID = W_A + W_HALF + 30;
const W_LOW = W_B + W_HALF + 30;
const W_VM = 92;
const W_DB = 22;

const WIDE: Layout = {
  name: 'wide',
  w: 720,
  h: W_LOW + 70,
  half: W_HALF,
  band: {
    from: [0, W_A],
    heading: 0,
    segs: [
      { line: W_X.turn },
      { arc: W_TURN, turn: 90 },
      { line: W_B - W_A - 2 * W_TURN },
      { arc: W_TURN, turn: 90 },
      { line: W_X.turn - W_END },
    ],
  },
  gates: [
    { x: W_X.network - 1.5, y: W_A - W_HALF - 8, w: 3, h: W_B - W_A + 2 * W_HALF + 16 },
    ...[W_X.router, W_X.handler, W_X.engine].map((x) => ({
      x: x - 1.5,
      y: W_A - W_HALF - 8,
      w: 3,
      h: 2 * W_HALF + 16,
    })),
    { x: W_X.router - 1.5, y: W_B - W_HALF - 8, w: 3, h: 2 * W_HALF + 16 },
  ],
  labels: [
    /* Just above the open end of row A, as the reply label is just under the cap of row B. */
    { part: 'source', at: [0, W_A - W_HALF - 46] },
    { part: 'router', at: [W_X.router + 10, W_TOP] },
    { part: 'vm', at: [W_X.engine + 14, W_VM] },
    { part: 'database', at: [W_X.engine + 14, W_DB] },
    { part: 'network', at: [W_X.network + 12, W_MID] },
    { part: 'handler', at: [W_X.handler + 12, W_MID] },
    { part: 'engine', at: [W_X.engine + 12, W_MID] },
    { part: 'destination', at: [0, W_LOW] },
    { part: 'sender', at: [W_X.router + 10, W_LOW] },
  ],
  stem: `M${W_X.engine} ${W_A - W_HALF - 8} V${W_DB} M${W_X.engine} ${W_VM} h6 M${W_X.engine} ${W_DB} h6`,
  register: {
    /* A gap at each end, so the line reads as a call between two parts, not as one bar like the Network. */
    path: `M${W_X.router} ${W_A + W_HALF + 14} V${W_B - W_HALF - 14}`,
    at: [W_X.router + 12, (W_A + W_B) / 2 + 4],
    anchor: 'start',
    tag: 'only for a request',
  },
};

/*
 * Phones: the PushQuery comes down at the left, through the Router, the Handler and the Engine. At the bottom
 * the band turns, and the Chits go up at the right, through the Sender, to the top edge. The Network is a bar on
 * each band, and a line joins the two bars: one part. The labels stand between the two bands. The Database tick
 * comes off the VM tick, one step in, because the database belongs to the VM. The label of the Sender ends at
 * its band, under the Database label.
 */
const S_HALF = 8;
const S_L = 16;
const S_R = 324;
const S_TURN = 20;
const S_TEXT = 44;
const S_END = 8;
const S_NET = 58;
const S_Y = {
  network: 79,
  router: 152,
  handler: 225,
  engine: 315,
  vm: 388,
  database: 461,
  sender: 534,
  bottom: 668,
} as const;

const STACKED: Layout = {
  name: 'stacked',
  w: 340,
  h: S_Y.bottom + S_HALF + 2,
  half: S_HALF,
  band: {
    from: [S_L, 0],
    heading: 90,
    segs: [
      { line: S_Y.bottom - S_TURN },
      { arc: S_TURN, turn: -90 },
      { line: S_R - S_L - 2 * S_TURN },
      { arc: S_TURN, turn: -90 },
      { line: S_Y.bottom - S_TURN - S_END },
    ],
  },
  gates: [
    ...[S_L, S_R].map((x) => ({ x: x - S_HALF - 8, y: S_NET - 1.5, w: 2 * S_HALF + 16, h: 3 })),
    ...[S_Y.router, S_Y.handler, S_Y.engine].map((y) => ({
      x: S_L - S_HALF - 8,
      y: y - 1.5,
      w: 2 * S_HALF + 16,
      h: 3,
    })),
    { x: S_R - S_HALF - 8, y: S_Y.sender - 1.5, w: 2 * S_HALF + 16, h: 3 },
  ],
  network: `M${S_L + S_HALF + 8} ${S_NET} H${S_R - S_HALF - 8}`,
  labels: [
    { part: 'source', at: [S_TEXT, 14] },
    { part: 'destination', at: [S_R - S_HALF - 20, 14], anchor: 'end' },
    { part: 'network', at: [S_TEXT, S_Y.network] },
    { part: 'router', at: [S_TEXT, S_Y.router] },
    { part: 'handler', at: [S_TEXT, S_Y.handler] },
    { part: 'engine', at: [S_TEXT, S_Y.engine] },
    { part: 'vm', at: [S_TEXT + 16, S_Y.vm] },
    { part: 'database', at: [S_TEXT + 32, S_Y.database] },
    { part: 'sender', at: [S_R - S_HALF - 20, S_Y.sender], anchor: 'end' },
  ],
  stem: `M${S_L + S_HALF + 8} ${S_Y.engine} H${S_TEXT - 10} V${S_Y.vm} h16 V${S_Y.database} h16`,
  register: {
    at: [S_R - S_HALF - 20, S_Y.sender + 90],
    anchor: 'end',
    tag: 'to the Router, only for a request',
  },
};

function Drawing({ layout: l }: { layout: Layout }) {
  const id = `bk-message-path-${l.name}`;
  const phone = l.name === 'stacked';
  return (
    <FlowSvg layout={l.name} size={[l.w, l.h]} label={LABEL}>
      <defs>
        <HatchPattern id={`${id}-hatch`} />
      </defs>

      {/* The Sender registers a timeout with the Router for a request. Chits are a reply, so this is steel. */}
      <g className="bk-fig-steel">
        {l.register.path && <path d={l.register.path} fill="none" stroke="currentColor" />}
        <text className="bk-fig-code" x={l.register.at[0]} y={l.register.at[1]} textAnchor={l.register.anchor}>
          RegisterRequest
        </text>
        <text className="bk-flow-tag" x={l.register.at[0]} y={l.register.at[1] + 18} textAnchor={l.register.anchor}>
          {l.register.tag}
        </text>
      </g>

      {/* The Engine calls the VM, and the VM keeps its state in the database of the chain. */}
      <path d={l.stem} fill="none" stroke="currentColor" />
      {l.network && <path d={l.network} fill="none" stroke="currentColor" />}

      {/* The PushQuery comes in from the edge, open. The Chits go back out to the same edge and end in a cap. */}
      <Band track={l.band} half={l.half} hatch={`${id}-hatch`} />

      {l.gates.map((g) => (
        <rect key={`${g.x} ${g.y}`} x={g.x} y={g.y} width={g.w} height={g.h} fill="currentColor" />
      ))}

      {l.labels.map(({ part, at, anchor }) => {
        const p: Part = PARTS[part];
        return anchor === 'end' ? (
          <EndLabel key={part} at={at} part={p} />
        ) : (
          <FlowLabel key={part} at={at} name={p.name} code={p.code} lines={phone ? p.phone : p.lines} />
        );
      })}
    </FlowSvg>
  );
}

/** The path of a poll in AvalancheGo: in through the Network, Router, Handler and Engine, out through the Sender. */
export function MessagePathFigure() {
  return (
    <FlowArt name="message-path">
      <Drawing layout={WIDE} />
      <Drawing layout={STACKED} />
    </FlowArt>
  );
}
