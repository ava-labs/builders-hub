import { NextRequest, NextResponse } from "next/server";
import { BURN_CHAINS, sumFeesWei, type FeeReceipt } from "@/lib/evm-burn";

// AVAX burned per block on the C-Chain and Fuji: the sum of every receipt's
// fee, read with eth_getBlockReceipts from our dedicated node (the public
// RPC does not serve that method). All blocks go to the node in one
// JSON-RPC batch. An accepted block never changes, so each answer is kept
// in memory by (chain, block) and the CDN may keep the response.

export const dynamic = "force-dynamic";

const NODES: Record<string, string | undefined> = {
  "43114": process.env.CCHAIN_DEBUG_RPC_URL,
  "43113": process.env.FUJI_DEBUG_RPC_URL,
};

const MAX_BLOCKS = 50;
const TIMEOUT_MS = 8_000;
const CACHE_MAX = 50_000;
const CACHE_CONTROL = "public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400";

// wei as a decimal string, per `${chainId}:${block}`
const cache = new Map<string, string>();

function remember(key: string, wei: string) {
  if (cache.size >= CACHE_MAX) {
    // the oldest entry first: a Map iterates in insertion order
    const first = cache.keys().next().value;
    if (first !== undefined) cache.delete(first);
  }
  cache.set(key, wei);
}

interface RpcReply<T> {
  id: number;
  result?: T | null;
  error?: unknown;
}

/** burns for the blocks the cache does not hold; null for a block the node
 *  has not executed yet (fewer receipts than transactions) or does not have */
async function fetchBurns(url: string, blocks: number[]): Promise<Map<number, string | null>> {
  const calls = blocks.flatMap((n, i) => {
    const tag = `0x${n.toString(16)}`;
    return [
      { jsonrpc: "2.0", id: 2 * i, method: "eth_getBlockByNumber", params: [tag, false] },
      { jsonrpc: "2.0", id: 2 * i + 1, method: "eth_getBlockReceipts", params: [tag] },
    ];
  });
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", "user-agent": "builders-hub-explorer" },
    body: JSON.stringify(calls),
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`upstream ${res.status}`);
  const replies = (await res.json()) as RpcReply<unknown>[];
  if (!Array.isArray(replies)) throw new Error("upstream sent no batch");
  const byId = new Map(replies.map((r) => [r.id, r.result ?? null]));

  const out = new Map<number, string | null>();
  blocks.forEach((n, i) => {
    const block = byId.get(2 * i) as { transactions?: string[] } | null;
    const receipts = byId.get(2 * i + 1) as FeeReceipt[] | null;
    if (!block || !Array.isArray(receipts) || receipts.length !== (block.transactions?.length ?? 0)) {
      out.set(n, null);
      return;
    }
    out.set(n, sumFeesWei(receipts).toString());
  });
  return out;
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ chainId: string }> }) {
  const { chainId } = await params;
  if (!BURN_CHAINS.has(chainId)) {
    return NextResponse.json({ error: "burn is served for the C-Chain and Fuji only" }, { status: 404 });
  }
  const url = NODES[chainId];
  if (!url) return NextResponse.json({ error: "node not configured" }, { status: 503 });

  const raw = new URL(request.url).searchParams.get("blocks") ?? "";
  const blocks = [...new Set(raw.split(",").filter(Boolean).map(Number))];
  if (blocks.length === 0 || blocks.length > MAX_BLOCKS || !blocks.every((n) => Number.isSafeInteger(n) && n >= 0)) {
    return NextResponse.json({ error: `send 1 to ${MAX_BLOCKS} block numbers as ?blocks=1,2,3` }, { status: 400 });
  }

  const burns: Record<string, string | null> = {};
  const missing: number[] = [];
  for (const n of blocks) {
    const hit = cache.get(`${chainId}:${n}`);
    if (hit !== undefined) burns[n] = hit;
    else missing.push(n);
  }

  if (missing.length > 0) {
    try {
      const fresh = await fetchBurns(url, missing);
      for (const [n, wei] of fresh) {
        burns[n] = wei;
        if (wei !== null) remember(`${chainId}:${n}`, wei);
      }
    } catch (err) {
      console.error(`[Explorer API] burn failed for chain ${chainId}:`, err instanceof Error ? err.message : err);
      return NextResponse.json({ error: "upstream unreachable" }, { status: 502, headers: { "Cache-Control": "no-store" } });
    }
  }

  // a block not executed yet must be asked again, so that answer is not kept
  const complete = Object.values(burns).every((v) => v !== null);
  return NextResponse.json(
    { burns },
    { headers: { "Cache-Control": complete ? CACHE_CONTROL : "no-store" } },
  );
}
