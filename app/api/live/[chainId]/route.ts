import { NextResponse } from "next/server";
import l1Chains from "@/constants/l1-chains.json";
import type { LiveHead, LiveTx, LiveWindow } from "@/lib/live-window";

/* A chain's live window for the city's panes: its newest heads and the
   transactions of its newest executed blocks, in one answer. The server
   keeps the window between ticks, so a tick costs one read of the tip, the
   heads it has not seen, and the receipts of the blocks that have none yet.
   The C-Chain and Fuji read from our dedicated node (its URL carries a
   token and never leaves this process); an L1 reads from the RPC its
   catalog entry lists, found by chain ID alone, never from a URL in the
   request. No answer echoes an upstream URL or an upstream error.

   Every viewer shares one read: the answer carries s-maxage, so on Vercel
   the CDN asks the origin once a tick per chain, and inside one process
   concurrent readers wait on the same tick. Upstream is read only when a
   request comes in, and a window nobody has asked for in half a minute is
   dropped. A tick that fails leaves the last window standing, marked
   stale. */

export const dynamic = "force-dynamic";

const NODES: Record<string, { url: string | undefined; fallback: string }> = {
  "43114": { url: process.env.CCHAIN_DEBUG_RPC_URL, fallback: "https://api.avax.network/ext/bc/C/rpc" },
  "43113": { url: process.env.FUJI_DEBUG_RPC_URL, fallback: "https://api.avax-test.network/ext/bc/C/rpc" },
};

const CATALOG = new Map<string, string>(
  (l1Chains as { chainId?: string | number; rpcUrl?: string }[])
    .filter((c) => c.chainId !== undefined && typeof c.rpcUrl === "string" && c.rpcUrl.startsWith("https://"))
    .map((c) => [String(c.chainId), c.rpcUrl as string]),
);

interface Source {
  url: string;
  /** the public RPC, tried when our node fails */
  fallback?: string;
  /** how often the window is read again */
  tickMs: number;
  /** our own node: batches are unbounded and parallel, three reads a tick; a public RPC gets two small, spaced reads */
  own: boolean;
}

/* the public L1 RPCs share Ava Labs' Cloudflare zone, which bans an IP after
   a burst: a tick every two seconds of at most two reads, spaced, keeps a
   chain under one call a second, and a refusal rests the host */
const OWN_TICK_MS = 1_000;
const PUBLIC_TICK_MS = 2_000;
const PUBLIC_GAP_MS = 400;
const REST_MS = 10 * 60_000;
const REST_MAX_MS = 60 * 60_000;
const REST_5XX_MS = 30_000;

function sourceOf(chainId: string): Source | null {
  const node = NODES[chainId];
  if (node) {
    return node.url
      ? { url: node.url, fallback: node.fallback, tickMs: OWN_TICK_MS, own: true }
      : { url: node.fallback, tickMs: PUBLIC_TICK_MS, own: false };
  }
  const rpc = CATALOG.get(chainId);
  return rpc ? { url: rpc, tickMs: PUBLIC_TICK_MS, own: false } : null;
}

/* the window's size */
const HEADS = 12;
/* blocks under the tip whose transactions the window carries */
const TX_BLOCKS = 6;
/* blocks whose receipts one tick pulls, oldest first, so execution reads in order */
const PULL_BLOCKS = 3;
/* receipts one tick asks a public RPC for: one batch */
const PUBLIC_PULL_TXS = 40;
const MAX_TXS = 60;
/* calldata kept per tx: selector and three words, enough for transferFrom */
const INPUT_CHARS = 202;
const TIMEOUT_MS = 6_000;
/* a block whose receipts stay incomplete this many ticks is published with the ones it has */
const GIVE_UP_TRIES = 3;
/* a reader waits this long on a running tick before it takes the last window */
const WAIT_MS = 1_500;
/* a window nobody has asked for this long is dropped */
const IDLE_MS = 30_000;

interface RpcTx {
  hash: string;
  from: string;
  to: string | null;
  value: string;
  input: string;
  transactionIndex: string;
}

interface RpcBlock {
  number: string;
  hash: string;
  timestamp: string;
  timestampMilliseconds?: string;
  transactions: (string | RpcTx)[];
  gasUsed: string;
  gasLimit: string;
  settledHeight?: string;
}

interface RpcReceipt {
  status: string;
  gasUsed: string;
  effectiveGasPrice: string;
}

interface Call {
  method: string;
  params: unknown[];
}

interface Block {
  head: LiveHead;
  /** the block's transactions; null when the block was read as a header only */
  txs: RpcTx[] | null;
  /** the transactions with their receipts; null until they all have one */
  executed: LiveTx[] | null;
  /** receipt pulls that came back incomplete */
  tries: number;
}

interface State {
  blocks: Map<number, Block>;
  executedHeight: number | null;
  /** when the window was last read whole */
  at: number;
  /** when a viewer last asked */
  asked: number;
  window: LiveWindow | null;
  pending: Promise<LiveWindow | null> | null;
}

const STATES = new Map<string, State>();

const hex = (v: string | undefined | null): number | null => (v ? parseInt(v, 16) : null);
const tag = (n: number) => `0x${n.toString(16)}`;
const hostOf = (url: string) => {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
};

function toHead(b: RpcBlock): LiveHead {
  const ms = hex(b.timestampMilliseconds);
  return {
    number: hex(b.number) ?? 0,
    hash: b.hash,
    timestampMs: ms ?? (hex(b.timestamp) ?? 0) * 1000,
    txCount: b.transactions?.length ?? 0,
    gasUsed: hex(b.gasUsed) ?? 0,
    gasLimit: hex(b.gasLimit) ?? 0,
    settledHeight: hex(b.settledHeight),
  };
}

function toBlock(b: RpcBlock): Block {
  const full = b.transactions?.every((t) => typeof t === "object") ?? false;
  const txs = full ? (b.transactions as RpcTx[]) : null;
  return { head: toHead(b), txs, executed: txs && txs.length === 0 ? [] : null, tries: 0 };
}

function toTx(b: Block, t: RpcTx, r: RpcReceipt): LiveTx {
  return {
    hash: t.hash,
    blockNumber: b.head.number,
    txIndex: hex(t.transactionIndex) ?? 0,
    timestamp: Math.floor(b.head.timestampMs / 1000),
    from: t.from,
    to: t.to ?? "",
    value: BigInt(t.value).toString(),
    methodId: t.input && t.input.length >= 10 ? t.input.slice(0, 10).toLowerCase() : "",
    input: (t.input ?? "0x").slice(0, INPUT_CHARS),
    success: r.status === "0x1",
    feeWei: Number(BigInt(r.gasUsed) * BigInt(r.effectiveGasPrice)),
  };
}

/* ------------------------------------------------------------------ */
/* the public hosts: one read at a time per host, spaced, and a rest after a refusal */

// per host: it is not asked again before this time
const restUntil = new Map<string, number>();
// per host: the read in flight, so the next waits its turn and a gap
const hostTurn = new Map<string, Promise<void>>();

function rest(host: string, res: Response) {
  const s = Number(res.headers.get("retry-after"));
  const ms = res.status === 429 || res.status === 403 ? (s > 0 ? Math.min(s * 1000, REST_MAX_MS) : REST_MS) : REST_5XX_MS;
  restUntil.set(host, Date.now() + ms);
}

async function spaced<T>(host: string, run: () => Promise<T>): Promise<T> {
  const prev = hostTurn.get(host) ?? Promise.resolve();
  let done!: () => void;
  const mine = new Promise<void>((r) => (done = r));
  hostTurn.set(host, mine);
  await prev;
  try {
    return await run();
  } finally {
    setTimeout(done, PUBLIC_GAP_MS);
  }
}

/* one JSON-RPC batch to the source, results in call order; our node takes
   the batch whole, a public RPC gets one read of at most forty calls */
async function rpcBatch<T>(src: Source, calls: Call[], signal: AbortSignal): Promise<(T | null)[]> {
  if (src.own && calls.length > 100) {
    const slices: Call[][] = [];
    for (let i = 0; i < calls.length; i += 100) slices.push(calls.slice(i, i + 100));
    return (await Promise.all(slices.map((s) => rpcBatch<T>(src, s, signal)))).flat();
  }
  const body = JSON.stringify(calls.map((c, id) => ({ jsonrpc: "2.0", id, ...c })));
  const post = async (url: string) => {
    const host = hostOf(url);
    if ((restUntil.get(host) ?? 0) > Date.now()) throw new Error("resting");
    const send = () =>
      fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json", "user-agent": "builders-hub-explorer" },
        body,
        signal,
        cache: "no-store",
      });
    const res = src.own && url === src.url ? await send() : await spaced(host, send);
    if (!res.ok) {
      if (res.status === 429 || res.status === 403 || res.status >= 500) rest(host, res);
      await res.body?.cancel();
      throw new Error(`upstream ${res.status}`);
    }
    return res;
  };
  let res: Response;
  try {
    res = await post(src.url);
  } catch (e) {
    // a node outage must not take the pane down with it
    if (!src.fallback) throw e;
    res = await post(src.fallback);
  }
  const out = (await res.json()) as { id: number; result?: T | null }[];
  const byId = new Map((Array.isArray(out) ? out : [out]).map((r) => [r.id, r.result ?? null]));
  return calls.map((_, id) => byId.get(id) ?? null);
}

/* ------------------------------------------------------------------ */
/* the tick */

/** the heads under the tip the window lacks, newest first */
function missingHeads(st: State, tip: number): number[] {
  const floor = tip - HEADS + 1;
  const out: number[] = [];
  for (let n = tip - 1; n >= floor; n--) if (!st.blocks.has(n)) out.push(n);
  return out;
}

/** the oldest blocks in the tx window that have transactions and no receipts yet */
function wantReceipts(st: State, tip: number): Block[] {
  const from = Math.max(tip - TX_BLOCKS + 1, (st.executedHeight ?? -1) + 1);
  // the first tick pulls the whole window, so the pane opens with rows
  const max = st.executedHeight === null ? TX_BLOCKS : PULL_BLOCKS;
  const want: Block[] = [];
  let count = 0;
  for (let n = from; n <= tip && want.length < max; n++) {
    const b = st.blocks.get(n);
    if (!b || !b.txs || b.executed !== null) continue;
    if (count + b.txs.length > PUBLIC_PULL_TXS && want.length) break;
    want.push(b);
    count += b.txs.length;
  }
  return want;
}

const receiptCalls = (want: Block[]): Call[] => want.flatMap((b) => b.txs!.map((t) => ({ method: "eth_getTransactionReceipt", params: [t.hash] })));

/** a block's receipts, as they came back: complete, or given up on after enough tries */
function settle(want: Block[], receipts: (RpcReceipt | null)[]) {
  let i = 0;
  for (const b of want) {
    const own = receipts.slice(i, i + b.txs!.length);
    i += b.txs!.length;
    const complete = own.every(Boolean);
    if (!complete) b.tries += 1;
    // a block whose receipts stay incomplete (a node behind its peers) goes out with the ones it has
    if (complete || b.tries >= GIVE_UP_TRIES) b.executed = b.txs!.flatMap((t, j) => (own[j] ? [toTx(b, t, own[j]!)] : []));
  }
}

/* one read of the chain. Our node: the tip, then the heads the window
   lacks, then the receipts of the oldest blocks without them. A public
   RPC: the tip, then the heads and the receipts in one read; the tip's own
   receipts follow a tick later. */
async function tick(src: Source, st: State): Promise<void> {
  const signal = AbortSignal.timeout(TIMEOUT_MS);
  const [latest] = await rpcBatch<RpcBlock>(src, [{ method: "eth_getBlockByNumber", params: ["latest", true] }], signal);
  if (!latest) throw new Error("no tip");
  const tip = hex(latest.number) ?? 0;
  const known = st.blocks;
  if (!known.has(tip)) known.set(tip, toBlock(latest));
  // with their transactions inside the tx window, as headers below it
  const missing = missingHeads(st, tip);
  const headCalls: Call[] = missing.map((n) => ({ method: "eth_getBlockByNumber", params: [tag(n), n > tip - TX_BLOCKS] }));
  const keep = (got: (RpcBlock | null)[]) => got.forEach((b, i) => b && known.set(missing[i], toBlock(b)));
  if (src.own) {
    if (headCalls.length) keep(await rpcBatch<RpcBlock>(src, headCalls, signal));
    const want = wantReceipts(st, tip);
    if (want.length) settle(want, await rpcBatch<RpcReceipt>(src, receiptCalls(want), signal));
  } else {
    const want = wantReceipts(st, tip);
    const calls = [...headCalls, ...receiptCalls(want)];
    if (calls.length) {
      const got = await rpcBatch<RpcBlock | RpcReceipt>(src, calls, signal);
      keep(got.slice(0, headCalls.length) as (RpcBlock | null)[]);
      settle(want, got.slice(headCalls.length) as (RpcReceipt | null)[]);
    }
  }
  // execution is FIFO: the executed height climbs while the next block has its receipts
  const from = Math.max(tip - TX_BLOCKS + 1, (st.executedHeight ?? -1) + 1);
  let h = Math.max(st.executedHeight ?? -1, from - 1);
  while (known.get(h + 1)?.executed) h += 1;
  st.executedHeight = h;
  const floor = tip - HEADS + 1;
  for (const n of known.keys()) if (n < floor - 2) known.delete(n);
}

function build(chainId: string, st: State, stale: boolean): LiveWindow {
  const heads = [...st.blocks.values()].map((b) => b.head).sort((a, b) => b.number - a.number).slice(0, HEADS);
  const tip = heads[0]?.number ?? null;
  const txs: LiveTx[] = [];
  if (tip !== null && st.executedHeight !== null) {
    for (let n = st.executedHeight; n > tip - TX_BLOCKS && txs.length < MAX_TXS; n--) txs.push(...(st.blocks.get(n)?.executed ?? []));
  }
  return { chainId, at: Date.now(), tip, executedHeight: st.executedHeight, heads, txs: txs.slice(0, MAX_TXS), stale };
}

/** the window, read again when its tick has passed; concurrent readers share one read */
async function windowOf(chainId: string, src: Source): Promise<LiveWindow | null> {
  const now = Date.now();
  // windows nobody watches go, this one included when it has sat idle
  for (const [id, s] of STATES) if (now - s.asked > IDLE_MS && !s.pending) STATES.delete(id);
  let st = STATES.get(chainId);
  if (!st) {
    st = { blocks: new Map(), executedHeight: null, at: 0, asked: now, window: null, pending: null };
    STATES.set(chainId, st);
  }
  st.asked = now;
  if (st.window && !st.window.stale && now - st.at < src.tickMs) return st.window;
  if (!st.pending) {
    const s = st;
    s.pending = tick(src, s)
      .then(
        () => {
          s.at = Date.now();
          s.window = build(chainId, s, false);
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
  return last ? Promise.race([st.pending, new Promise<LiveWindow>((r) => setTimeout(() => r({ ...last, stale: true }), WAIT_MS))]) : st.pending;
}

export async function GET(_req: Request, { params }: { params: Promise<{ chainId: string }> }) {
  const { chainId } = await params;
  const src = /^\d+$/.test(chainId) ? sourceOf(chainId) : null;
  if (!src) return NextResponse.json({ error: "unknown chain" }, { status: 404 });
  const window = await windowOf(chainId, src);
  if (!window) return NextResponse.json({ error: "upstream unreachable" }, { status: 502, headers: { "cache-control": "no-store" } });
  const s = Math.max(1, Math.round(src.tickMs / 1000));
  return NextResponse.json(window, {
    headers: {
      // one origin read a tick for every viewer; a stale window is not kept
      "cache-control": window.stale ? "no-store" : `public, max-age=0, s-maxage=${s}, stale-while-revalidate=${s}`,
    },
  });
}
