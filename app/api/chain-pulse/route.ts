import { NextRequest, NextResponse } from "next/server";
import { catalogOf } from "@/lib/explorer-catalog";
import { isPchainNetwork, type PchainNetwork } from "@/lib/pchain-explorer";
import type { L1Chain } from "@/types/stats";

// Live activity for every chain of one network (mainnet, or Fuji with
// ?network=fuji) that we can reach, read from each chain's own RPC: its
// newest block and the nine below it. Avalanche L1s make a block only when
// there are transactions, so the newest block's time says when the chain
// last did anything, and the blocks' transactions over their span say how
// fast it goes. The metrics API tracks a few chains; this asks every catalog
// chain of the network with an rpcUrl, at most once every two minutes on
// mainnet and every five on Fuji, however many visitors there are. Most L1
// RPCs share one host (subnets.avax.network: 25 mainnet urls, 44 Fuji urls)
// in Ava Labs' Cloudflare zone, so a read must not get the host's IP
// limited. A 429 rests the whole host for its retry-after, on both networks.
// A 403, any other 4xx or a failed DNS lookup is that url's own: the url
// alone is skipped for an hour. A chain it cannot read keeps its last good
// reading for half an hour.

export const dynamic = "force-dynamic";
// the worst read, every chain timing out, is about 12 s on mainnet and 15 s on Fuji
export const maxDuration = 30;

const BLOCKS = 10;
const CHAIN_TIMEOUT_MS = 3_000;
const MAX_IN_FLIGHT = 10;
// how long a network's answer is kept: Fuji's chains share one host, so they are read less often
const CACHE_TTL_MS: Record<PchainNetwork, number> = { mainnet: 120_000, fuji: 300_000 };
// the CDN holds what the process holds; browsers always ask, so a client
// polling every minute never reads its own copy of the last poll
const cacheControl = (network: PchainNetwork) =>
  `public, max-age=0, s-maxage=${CACHE_TTL_MS[network] / 1000}, stale-while-revalidate=60`;
// a chain that did not answer keeps its last good reading this long
const STALE_MS = 30 * 60_000;
const REST_MS = 10 * 60_000;
const REST_MAX_MS = 60 * 60_000;
const HOUR_MS = 60 * 60 * 1000;

// each network's C-Chain: its public RPC, then its dedicated node when the env names one
const C_CHAIN: Record<PchainNetwork, { chainId: string; rpc: string; node: string | undefined }> = {
  mainnet: { chainId: "43114", rpc: "https://api.avax.network/ext/bc/C/rpc", node: process.env.CCHAIN_DEBUG_RPC_URL },
  fuji: { chainId: "43113", rpc: "https://api.avax-test.network/ext/bc/C/rpc", node: process.env.FUJI_DEBUG_RPC_URL },
};

export interface ChainPulse {
  chainId: string;
  /** the newest block's number */
  height: number | null;
  /** when the newest block was made, ms since epoch; null while the chain has no block past genesis */
  lastBlockAt: number | null;
  /** transactions in the blocks read */
  txs: number | null;
  /** seconds from the oldest block read to the newest */
  spanSec: number | null;
  /** transactions a minute, faded by the quiet since the newest block (see rate) */
  txPerMin: number | null;
  /** false when the chain's RPC did not answer; every figure is then null */
  ok: boolean;
}

export interface ChainPulseResponse {
  /** when the RPCs were read, ms since epoch */
  at: number;
  chains: ChainPulse[];
}

interface RpcBlock {
  number: string;
  timestamp: string;
  /** ACP-226 chains stamp their blocks to the millisecond */
  timestampMilliseconds?: string;
  transactions: unknown[];
}

interface Target {
  chainId: string;
  /** asked in order until one answers */
  urls: string[];
}

// every chain of the network with an rpcUrl, less the ones marked non-EVM.
// The C-Chain asks the public RPC first and, when that refuses (it
// rate-limits by IP), the network's dedicated node
export function targetsOf(network: PchainNetwork): Target[] {
  const byId = new Map<string, Target>();
  for (const [chainId, c] of catalogOf(network)) {
    if ((c as L1Chain & { isEvm?: boolean }).isEvm === false || !c.rpcUrl) continue;
    byId.set(chainId, { chainId, urls: [c.rpcUrl] });
  }
  const { chainId, rpc, node } = C_CHAIN[network];
  byId.set(chainId, { chainId, urls: node ? [rpc, node] : [rpc] });
  return [...byId.values()];
}

const TARGETS: Record<PchainNetwork, Target[]> = { mainnet: targetsOf("mainnet"), fuji: targetsOf("fuji") };

// a node that refused a batch and then took the same calls one at a time is
// asked one at a time for the next hour
const noBatch = new Map<string, number>();

// per network: its last answer, and its read in flight. One read at a time:
// visitors who arrive during it wait on the same one
const last = new Map<PchainNetwork, ChainPulseResponse>();
const reading = new Map<PchainNetwork, Promise<ChainPulseResponse>>();

// a host or a url is not asked again before this time, on both networks. A
// host is a key after a 429: Cloudflare limits the IP for the whole zone. A
// url is a key after a 403, any other 4xx or a failed DNS lookup: an
// auth-gated or dead chain must not rest the other chains on its host
const restUntil = new Map<string, number>();

async function post(url: string, body: unknown, signal: AbortSignal): Promise<unknown> {
  const host = new URL(url).host;
  const now = Date.now();
  if ((restUntil.get(host) ?? 0) > now || (restUntil.get(url) ?? 0) > now) throw new Error(`${host} resting`);
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal,
    });
  } catch (e) {
    if ((e as { cause?: { code?: unknown } }).cause?.code === "ENOTFOUND") restUntil.set(url, Date.now() + HOUR_MS);
    throw e;
  }
  if (res.status === 429) {
    const s = Number(res.headers.get("retry-after"));
    restUntil.set(host, Date.now() + (s > 0 ? Math.min(s * 1000, REST_MAX_MS) : REST_MS));
  } else if (res.status >= 400 && res.status < 500 && !Array.isArray(body)) {
    // a refused batch is not a dead url: blocksAt asks one call at a time next
    restUntil.set(url, Date.now() + HOUR_MS);
  }
  if (!res.ok) throw new Error(`rpc ${res.status}`);
  return res.json();
}

const getBlock = (id: number, tag: string) => ({ jsonrpc: "2.0", id, method: "eth_getBlockByNumber", params: [tag, false] });

function isBlock(b: unknown): b is RpcBlock {
  const x = b as RpcBlock | null;
  return !!x && typeof x.number === "string" && typeof x.timestamp === "string" && Array.isArray(x.transactions);
}

async function blockAt(url: string, tag: string, signal: AbortSignal): Promise<RpcBlock | null> {
  const got = (await post(url, getBlock(0, tag), signal)) as { result?: unknown } | null;
  return isBlock(got?.result) ? got.result : null;
}

// the blocks at these heights: one batch where the node takes it, one call
// each where it does not. A block the node does not have is left out
async function blocksAt(url: string, heights: number[], signal: AbortSignal): Promise<RpcBlock[]> {
  const tags = heights.map((h) => `0x${h.toString(16)}`);
  const refusedAt = noBatch.get(url);
  const tryBatch = refusedAt === undefined || Date.now() - refusedAt > HOUR_MS;
  if (tryBatch) {
    try {
      const got = await post(url, tags.map((t, i) => getBlock(i, t)), signal);
      if (Array.isArray(got)) {
        const blocks = got.map((r) => (r as { result?: unknown } | null)?.result).filter(isBlock);
        if (blocks.length) return blocks;
      }
    } catch (e) {
      if (signal.aborted) throw e;
    }
  }
  const settled = await Promise.allSettled(tags.map((t) => blockAt(url, t, signal)));
  const blocks = settled.flatMap((r) => (r.status === "fulfilled" && r.value ? [r.value] : []));
  if (!blocks.length) throw new Error("no blocks");
  if (tryBatch) noBatch.set(url, Date.now());
  return blocks;
}

// ms since epoch, to the millisecond where the block says it
function blockMs(b: RpcBlock): number {
  const s = parseInt(b.timestamp, 16) * 1000;
  const ms = b.timestampMilliseconds ? parseInt(b.timestampMilliseconds, 16) : NaN;
  return ms >= s && ms < s + 1000 ? ms : s;
}

/* The rate and its decay. The window runs from the oldest block read to
   now, not to the newest block, so the rate of a quiet chain falls for as
   long as the chain stays quiet. The rate then fades linearly with the
   quiet time and is 0 when the newest block is an hour old:
     txPerMin = txs / (minutes from oldest block to now) * max(0, 1 - quiet / 1h)
   A busy chain is quiet for a second or two, so it reads at its full rate. */
function rate(txs: number, oldest: number, newest: number, now: number): number {
  const quiet = Math.max(0, now - newest);
  if (quiet >= HOUR_MS) return 0;
  const minutes = Math.max(Math.max(now, newest) - oldest, 1_000) / 60_000;
  return Math.round((txs / minutes) * (1 - quiet / HOUR_MS) * 1000) / 1000;
}

// each url's chain ID, asked once: a catalog url that serves another chain
// would light that chain's windows on this one's tower
const chainOf = new Map<string, string>();

async function checkChain(url: string, chainId: string, signal: AbortSignal): Promise<void> {
  let served = chainOf.get(url);
  if (served === undefined) {
    const got = (await post(url, { jsonrpc: "2.0", id: 0, method: "eth_chainId", params: [] }, signal)) as { result?: unknown } | null;
    if (typeof got?.result !== "string" || !/^0x[0-9a-f]+$/i.test(got.result)) throw new Error("no chain id");
    served = String(parseInt(got.result, 16));
    chainOf.set(url, served);
  }
  if (served !== chainId) throw new Error(`url serves chain ${served}`);
}

async function readTip(chainId: string, url: string, signal: AbortSignal): Promise<ChainPulse> {
  await checkChain(url, chainId, signal);
  const tip = await blockAt(url, "latest", signal);
  if (!tip) throw new Error("no tip");
  const height = parseInt(tip.number, 16);
  // genesis stays out: its time is the chain's creation, not its activity
  const below: number[] = [];
  for (let h = height - 1; h >= Math.max(1, height - BLOCKS + 1); h--) below.push(h);
  const blocks = height < 1 ? [] : [tip, ...(below.length ? await blocksAt(url, below, signal) : [])];
  if (!blocks.length) {
    return { chainId, height, lastBlockAt: null, txs: 0, spanSec: null, txPerMin: 0, ok: true };
  }
  const times = blocks.map(blockMs);
  const newest = Math.max(...times);
  const oldest = Math.min(...times);
  const txs = blocks.reduce((n, b) => n + b.transactions.length, 0);
  return {
    chainId,
    height,
    lastBlockAt: newest,
    txs,
    spanSec: (newest - oldest) / 1000,
    txPerMin: rate(txs, oldest, newest, Date.now()),
    ok: true,
  };
}

async function readChain({ chainId, urls }: Target): Promise<ChainPulse> {
  // one budget for the chain, across its urls and both round trips
  const signal = AbortSignal.timeout(CHAIN_TIMEOUT_MS);
  for (const url of urls) {
    try {
      return await readTip(chainId, url, signal);
    } catch {
      if (signal.aborted) break;
    }
  }
  return { chainId, height: null, lastBlockAt: null, txs: null, spanSec: null, txPerMin: null, ok: false };
}

// MAX_IN_FLIGHT workers each take the next chain as they finish, so a slow
// RPC holds up only its own slot
async function inPool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

// each chain's last good reading, and when it was read. A chain ID is on
// one network only, so both networks share the map
const good = new Map<string, { pulse: ChainPulse; at: number }>();

function read(network: PchainNetwork): Promise<ChainPulseResponse> {
  const running = reading.get(network);
  if (running) return running;
  const next = inPool(TARGETS[network], MAX_IN_FLIGHT, readChain)
    .then((read) => {
      const now = Date.now();
      const chains = read.map((c) => {
        if (c.ok) {
          good.set(c.chainId, { pulse: c, at: now });
          return c;
        }
        const kept = good.get(c.chainId);
        return kept && now - kept.at < STALE_MS ? kept.pulse : c;
      });
      const answer = { at: now, chains };
      last.set(network, answer);
      return answer;
    })
    .finally(() => {
      reading.delete(network);
    });
  reading.set(network, next);
  return next;
}

export async function GET(request: NextRequest) {
  const network = request.nextUrl.searchParams.get("network") ?? "mainnet";
  if (!isPchainNetwork(network)) {
    return NextResponse.json({ error: `unknown network '${network}'` }, { status: 400 });
  }
  const kept = last.get(network);
  const data = kept && Date.now() - kept.at < CACHE_TTL_MS[network] ? kept : await read(network);
  return NextResponse.json(data, { headers: { "cache-control": cacheControl(network) } });
}
