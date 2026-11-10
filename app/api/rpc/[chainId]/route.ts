import { NextRequest, NextResponse } from "next/server";
import l1Chains from "@/constants/l1-chains.json";

// The explorer's read path to our dedicated C-Chain and Fuji nodes. The node
// URL carries a token and the node is paid for, so this route forwards only
// the read methods the explorer calls, caps the batch and the body, keeps
// eth_getLogs to one contract, and limits each client. It never serves
// debug_*, trace_*, or any write. If the node is not configured the call
// falls through to the public RPC, so the explorer keeps working.

export const dynamic = "force-dynamic";

const NODES: Record<string, { url: string | undefined; fallback: string }> = {
  "43114": { url: process.env.CCHAIN_DEBUG_RPC_URL, fallback: "https://api.avax.network/ext/bc/C/rpc" },
  "43113": { url: process.env.FUJI_DEBUG_RPC_URL, fallback: "https://api.avax-test.network/ext/bc/C/rpc" },
};

/* The relay for an L1 whose public RPC refuses the browser (no CORS
   headers): the explorer's live view moves its reads here after a direct
   fetch fails. The upstream is the catalog's own RPC for the chain ID, never
   a URL from the request, so the route cannot be pointed anywhere else. The
   L1 RPCs sit behind a shared rate limit, so identical reads from many
   viewers share one upstream call for a moment, and a client gets a smaller
   window than on our own node */
const RELAYS = new Map<string, string>(
  (l1Chains as { chainId?: string | number; rpcUrl?: string }[])
    .filter((c) => c.chainId !== undefined && typeof c.rpcUrl === "string" && c.rpcUrl.startsWith("https://"))
    .map((c) => [String(c.chainId), c.rpcUrl as string]),
);
const RELAY_MAX_CALLS = 40;
const RELAY_MAX_PER_WINDOW = 600;
const RELAY_SHARE_MS = 1_500;
const shared = new Map<string, { at: number; ids: unknown[]; body: Promise<string | null> }>();

const METHODS = new Set([
  "eth_blockNumber",
  "eth_chainId",
  "eth_getBlockByNumber",
  "eth_getBlockByHash",
  "eth_getTransactionByHash",
  "eth_getTransactionReceipt",
  "eth_getTransactionCount",
  "eth_getBalance",
  "eth_getCode",
  "eth_getStorageAt",
  "eth_call",
  "eth_getLogs",
]);

const MAX_CALLS = 100; // the client sends chunks of 40
const MAX_BODY = 64 * 1024;
const TIMEOUT_MS = 8_000;

// per client per instance: the live home spends about 15 calls a second in a burst
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 3_000;
const seen = new Map<string, { n: number; t: number }>();

function allow(key: string, calls: number, limit = MAX_PER_WINDOW): boolean {
  const now = Date.now();
  if (seen.size > 5_000) for (const [k, v] of seen) if (now - v.t > WINDOW_MS) seen.delete(k);
  const e = seen.get(key);
  if (!e || now - e.t > WINDOW_MS) {
    seen.set(key, { n: calls, t: now });
    return calls <= limit;
  }
  e.n += calls;
  return e.n <= limit;
}

interface Call {
  jsonrpc?: string;
  id?: number | string | null;
  method?: unknown;
  params?: unknown;
}

/** why a call is refused, or null when it may go to the node */
function refuse(c: Call): string | null {
  if (typeof c.method !== "string" || !METHODS.has(c.method)) return `method not allowed: ${String(c.method)}`;
  if (c.params !== undefined && !Array.isArray(c.params)) return "params must be an array";
  if (c.method === "eth_getLogs") {
    const f = (c.params as unknown[])?.[0] as { address?: unknown; blockHash?: unknown } | undefined;
    // one contract at a time: an open filter is a scan of the whole chain
    if (!f || typeof f !== "object" || !f.address) return "eth_getLogs needs an address";
  }
  return null;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ chainId: string }> }) {
  const { chainId } = await params;
  const node = NODES[chainId];
  const relay = node ? null : RELAYS.get(chainId) ?? null;
  if (!node && !relay) return NextResponse.json({ error: "unknown chain" }, { status: 404 });

  const raw = await req.text();
  if (raw.length > MAX_BODY) return NextResponse.json({ error: "body too large" }, { status: 413 });
  let body: Call | Call[];
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  const batch = Array.isArray(body);
  const calls = batch ? (body as Call[]) : [body as Call];
  const maxCalls = relay ? RELAY_MAX_CALLS : MAX_CALLS;
  if (calls.length === 0 || calls.length > maxCalls) return NextResponse.json({ error: `send 1 to ${maxCalls} calls` }, { status: 400 });
  for (const c of calls) {
    const why = refuse(c);
    if (why) return NextResponse.json({ error: why }, { status: 403 });
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const allowed = relay ? allow(`${ip}|${chainId}`, calls.length, RELAY_MAX_PER_WINDOW) : allow(ip, calls.length);
  if (!allowed) return NextResponse.json({ error: "rate limit" }, { status: 429, headers: { "retry-after": "30" } });

  const clean = calls.map((c, i) => ({ jsonrpc: "2.0", id: c.id ?? i, method: c.method, params: c.params ?? [] }));
  const send = (url: string) =>
    fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", "user-agent": "builders-hub-explorer" },
      body: JSON.stringify(batch ? clean : clean[0]),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });

  if (relay) {
    // one upstream call for the same read from every viewer, for a moment
    const key = `${chainId}|${JSON.stringify(batch ? clean.map(({ method, params }) => [method, params]) : [clean[0].method, clean[0].params])}`;
    const now = Date.now();
    if (shared.size > 500) for (const [k, v] of shared) if (now - v.at > RELAY_SHARE_MS) shared.delete(k);
    let hit = shared.get(key);
    if (!hit || now - hit.at > RELAY_SHARE_MS) {
      hit = { at: now, ids: clean.map((c) => c.id), body: send(relay).then((r) => (r.ok ? r.text() : null)).catch(() => null) };
      shared.set(key, hit);
    }
    const text = await hit.body;
    if (text === null) return NextResponse.json({ error: "upstream unreachable" }, { status: 502 });
    // the shared answer carries the first caller's ids, in any order: give this caller its own back
    try {
      const parsed = JSON.parse(text) as { id?: unknown }[] | { id?: unknown };
      const first = hit.ids;
      const ids = clean.map((c) => c.id);
      const own = (r: { id?: unknown }) => ({ ...r, id: ids[first.indexOf(r.id)] ?? r.id });
      const mine = Array.isArray(parsed) ? parsed.map(own) : { ...parsed, id: ids[0] };
      return NextResponse.json(mine, { headers: { "cache-control": "no-store" } });
    } catch {
      return NextResponse.json({ error: "upstream sent invalid JSON" }, { status: 502 });
    }
  }
  if (!node) return NextResponse.json({ error: "unknown chain" }, { status: 404 });

  try {
    let res = node.url ? await send(node.url).catch(() => null) : null;
    // a node outage must not take the explorer down with it
    if (!res || !res.ok) res = await send(node.fallback);
    if (!res.ok) return NextResponse.json({ error: `upstream ${res.status}` }, { status: 502 });
    return new NextResponse(await res.text(), { headers: { "content-type": "application/json", "cache-control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "upstream unreachable" }, { status: 502 });
  }
}
