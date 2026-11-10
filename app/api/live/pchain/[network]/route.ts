import { NextResponse } from "next/server";
import { pchainPost } from "@/lib/pchain-rpc";
import { txsOfBlock, type NodeBlockTx, type RawBlock } from "@/lib/pchain-block";

/* The P-Chain's newest blocks as the node sees them, for the city's P-Chain
   pane: the tip, and the transactions of the newest blocks decoded from the
   node's JSON, because the indexer's ledger runs about a minute behind the
   chain. The server keeps the window between ticks, so a tick is one read
   of the height and one read per new block (the P-Chain seals a block only
   when it has transactions, a few a minute). Reads go through
   lib/pchain-rpc: the public RPC, then our node when it refuses.

   Every viewer shares one read: the answer carries s-maxage, so on Vercel
   the CDN asks the origin once a tick, and inside one process concurrent
   readers wait on the same tick. Upstream is read only when a request comes
   in, and a window nobody has asked for in half a minute is dropped. */

export const dynamic = "force-dynamic";

const NETWORKS = new Set(["mainnet", "fuji"]);
/* the public RPC rate-limits by IP: a tick every three seconds keeps the whole site under one call a second */
const TICK_MS = 3_000;
const TIMEOUT_MS = 5_000;
/* blocks the window carries */
const BLOCKS = 12;
/* blocks one tick reads: the first tick reads back this far, a later tick catches up by this much */
const READ_BLOCKS = 3;
/* a reader waits this long on a running tick before it takes the last window */
const WAIT_MS = 1_500;
/* a window nobody has asked for this long is dropped */
const IDLE_MS = 30_000;

export interface PchainWindow {
  network: string;
  /** the chain's height */
  height: number;
  /** unix seconds of the newest block read */
  time: number;
  /** transactions in the newest block read */
  txCount: number;
  /** newest block first, then by place in the block */
  txs: NodeBlockTx[];
  /** server time of the read, ms since epoch */
  at: number;
  /** the last tick failed: this is the window as it stood */
  stale: boolean;
}

interface State {
  blocks: Map<number, { time: number; txs: NodeBlockTx[] }>;
  /** the chain's height at the last tick */
  tip: number | null;
  /** every block up to here is read */
  read: number | null;
  at: number;
  asked: number;
  window: PchainWindow | null;
  pending: Promise<PchainWindow | null> | null;
}

const STATES = new Map<string, State>();

async function call<T>(network: string, method: string, params: Record<string, unknown>): Promise<T> {
  const res = await pchainPost(network, { jsonrpc: "2.0", id: 1, method, params }, TIMEOUT_MS);
  if (!res.ok) {
    await res.body?.cancel();
    throw new Error(`upstream ${res.status}`);
  }
  const json = (await res.json()) as { result?: T; error?: unknown };
  if (!json.result) throw new Error("no result");
  return json.result;
}

/* one read of the chain: its height, then the blocks the window lacks,
   oldest first so rows arrive in order, a few a tick */
async function tick(network: string, st: State): Promise<void> {
  const { height } = await call<{ height: string | number }>(network, "platform.getHeight", {});
  const tip = Number(height);
  if (!tip) throw new Error("no height");
  st.tip = tip;
  const floor = Math.max(1, tip - BLOCKS + 1);
  const from = st.read === null ? Math.max(floor, tip - READ_BLOCKS + 1) : Math.max(floor, st.read + 1);
  for (let h = from, n = 0; h <= tip && n < READ_BLOCKS; h++, n++) {
    if (!st.blocks.has(h)) {
      const { block } = await call<{ block: RawBlock }>(network, "platform.getBlockByHeight", { height: h, encoding: "json" });
      st.blocks.set(h, { time: Number(block.time ?? 0), txs: txsOfBlock({ ...block, height: h }) });
    }
    st.read = h;
  }
  for (const h of st.blocks.keys()) if (h < floor) st.blocks.delete(h);
}

function build(network: string, st: State, stale: boolean): PchainWindow {
  const heights = [...st.blocks.keys()].sort((a, b) => b - a);
  const newest = heights[0] !== undefined ? st.blocks.get(heights[0]) : undefined;
  return {
    network,
    height: st.tip ?? heights[0] ?? 0,
    time: newest?.time ?? 0,
    txCount: newest?.txs.length ?? 0,
    txs: heights.flatMap((h) => st.blocks.get(h)?.txs ?? []),
    at: Date.now(),
    stale,
  };
}

/** the window, read again when its tick has passed; concurrent readers share one read */
async function windowOf(network: string): Promise<PchainWindow | null> {
  const now = Date.now();
  // windows nobody watches go, this one included when it has sat idle
  for (const [id, s] of STATES) if (now - s.asked > IDLE_MS && !s.pending) STATES.delete(id);
  let st = STATES.get(network);
  if (!st) {
    st = { blocks: new Map(), tip: null, read: null, at: 0, asked: now, window: null, pending: null };
    STATES.set(network, st);
  }
  st.asked = now;
  if (st.window && !st.window.stale && now - st.at < TICK_MS) return st.window;
  if (!st.pending) {
    const s = st;
    s.pending = tick(network, s)
      .then(
        () => {
          s.at = Date.now();
          s.window = build(network, s, false);
          return s.window;
        },
        () => {
          // the last window stands, marked stale; the next request tries again
          s.at = Date.now();
          if (s.window) s.window = { ...s.window, stale: true };
          return s.window;
        },
      )
      .finally(() => {
        s.pending = null;
      });
  }
  // a reader does not hang on a slow node: past the wait it takes the last window
  const last = st.window;
  return last ? Promise.race([st.pending, new Promise<PchainWindow>((r) => setTimeout(() => r({ ...last, stale: true }), WAIT_MS))]) : st.pending;
}

export async function GET(_req: Request, { params }: { params: Promise<{ network: string }> }) {
  const { network } = await params;
  if (!NETWORKS.has(network)) return NextResponse.json({ error: "unknown network" }, { status: 404 });
  const window = await windowOf(network);
  if (!window) return NextResponse.json({ error: "upstream unreachable" }, { status: 502, headers: { "cache-control": "no-store" } });
  const s = TICK_MS / 1000;
  return NextResponse.json(window, {
    headers: { "cache-control": window.stale ? "no-store" : `public, max-age=0, s-maxage=${s}, stale-while-revalidate=${s}` },
  });
}
