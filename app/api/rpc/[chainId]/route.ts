import { NextRequest, NextResponse } from "next/server";

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

function allow(key: string, calls: number): boolean {
  const now = Date.now();
  if (seen.size > 5_000) for (const [k, v] of seen) if (now - v.t > WINDOW_MS) seen.delete(k);
  const e = seen.get(key);
  if (!e || now - e.t > WINDOW_MS) {
    seen.set(key, { n: calls, t: now });
    return calls <= MAX_PER_WINDOW;
  }
  e.n += calls;
  return e.n <= MAX_PER_WINDOW;
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
  if (!node) return NextResponse.json({ error: "unknown chain" }, { status: 404 });

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
  if (calls.length === 0 || calls.length > MAX_CALLS) return NextResponse.json({ error: `send 1 to ${MAX_CALLS} calls` }, { status: 400 });
  for (const c of calls) {
    const why = refuse(c);
    if (why) return NextResponse.json({ error: why }, { status: 403 });
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (!allow(ip, calls.length)) return NextResponse.json({ error: "rate limit" }, { status: 429, headers: { "retry-after": "30" } });

  const clean = calls.map((c, i) => ({ jsonrpc: "2.0", id: c.id ?? i, method: c.method, params: c.params ?? [] }));
  const send = (url: string) =>
    fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", "user-agent": "builders-hub-explorer" },
      body: JSON.stringify(batch ? clean : clean[0]),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });

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
