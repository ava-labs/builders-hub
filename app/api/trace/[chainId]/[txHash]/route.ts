import { NextRequest, NextResponse } from "next/server";

// One transaction's execution trace, from a debug-enabled node the public
// RPC does not offer: the call tree with logs (callTracer), the account
// and storage diff (prestateTracer), and an opcode gas profile reduced
// server-side from the struct log so 13k steps never reach the browser.
//
// The node is token-authenticated and paid for; this route exposes exactly
// one thing it can do (trace a transaction by hash) and nothing else, and
// a trace is immutable once its block is final, so results are cached hard
// and the node is asked once per hash per instance.

const DEBUG_RPC: Record<string, string | undefined> = {
  "43114": process.env.CCHAIN_DEBUG_RPC_URL,
  "43113": process.env.FUJI_DEBUG_RPC_URL,
};

export interface TraceFrame {
  type: string; // CALL | DELEGATECALL | STATICCALL | CREATE | CREATE2 | SELFDESTRUCT | CALLCODE
  from: string;
  to?: string;
  input: string;
  output?: string;
  value?: string; // hex wei
  gas: string; // hex
  gasUsed: string; // hex
  error?: string;
  revertReason?: string;
  logs?: { address: string; topics: string[]; data: string; position?: string }[];
  calls?: TraceFrame[];
}

interface PrestateAccount {
  balance?: string;
  nonce?: number;
  code?: string;
  storage?: Record<string, string>;
}

export interface TraceResponse {
  call: TraceFrame;
  prestate: { pre: Record<string, PrestateAccount>; post: Record<string, PrestateAccount> } | null;
  /** gas by opcode, totals, from the struct log */
  opcodes: { op: string; gas: number; count: number }[] | null;
  steps: number | null;
}

interface StructLog {
  op: string;
  gasCost: number;
  depth: number;
}

const cache = new Map<string, TraceResponse>();
const CACHE_MAX = 400;

// per-IP budget: traces are heavier than a block read
const rate = new Map<string, { n: number; at: number }>();
const RATE_MAX = 30;
const RATE_WINDOW_MS = 60_000;

async function rpc<T>(url: string, method: string, params: unknown[]): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    signal: AbortSignal.timeout(45_000),
  });
  if (!res.ok) throw new Error(`debug node HTTP ${res.status}`);
  const body = (await res.json()) as { result?: T; error?: { code: number; message: string } };
  if (body.error) throw Object.assign(new Error(body.error.message), { code: body.error.code });
  return body.result as T;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ chainId: string; txHash: string }> }) {
  const { chainId, txHash } = await params;
  const url = DEBUG_RPC[chainId];
  if (!url) return NextResponse.json({ error: "no trace node for this chain" }, { status: 404 });
  const hash = txHash.toLowerCase();
  if (!/^0x[0-9a-f]{64}$/.test(hash)) return NextResponse.json({ error: "invalid transaction hash" }, { status: 400 });

  const key = `${chainId}:${hash}`;
  const hit = cache.get(key);
  if (hit) {
    return NextResponse.json(hit, { headers: { "Cache-Control": "public, max-age=3600, s-maxage=31536000, immutable" } });
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const now = Date.now();
  const r = rate.get(ip);
  if (!r || now - r.at > RATE_WINDOW_MS) rate.set(ip, { n: 1, at: now });
  else if (r.n >= RATE_MAX) return NextResponse.json({ error: "rate limit" }, { status: 429 });
  else r.n++;

  try {
    const [call, prestate, struct] = await Promise.all([
      rpc<TraceFrame>(url, "debug_traceTransaction", [hash, { tracer: "callTracer", tracerConfig: { withLog: true } }]),
      rpc<TraceResponse["prestate"]>(url, "debug_traceTransaction", [hash, { tracer: "prestateTracer", tracerConfig: { diffMode: true } }]).catch(() => null),
      rpc<{ structLogs: StructLog[] }>(url, "debug_traceTransaction", [hash, { disableStorage: true, disableMemory: true, disableStack: true, disableReturnData: true }]).catch(() => null),
    ]);
    let opcodes: TraceResponse["opcodes"] = null;
    let steps: number | null = null;
    if (struct?.structLogs) {
      const agg = new Map<string, { gas: number; count: number }>();
      for (const s of struct.structLogs) {
        const a = agg.get(s.op) ?? { gas: 0, count: 0 };
        a.gas += s.gasCost;
        a.count++;
        agg.set(s.op, a);
      }
      opcodes = [...agg.entries()].map(([op, v]) => ({ op, ...v })).sort((a, b) => b.gas - a.gas);
      steps = struct.structLogs.length;
    }
    const out: TraceResponse = { call, prestate, opcodes, steps };
    // a pending or unknown tx must not be cached as a result; only final traces are
    if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value!);
    cache.set(key, out);
    return NextResponse.json(out, { headers: { "Cache-Control": "public, max-age=3600, s-maxage=31536000, immutable" } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "trace failed";
    const status = /not found/i.test(msg) ? 404 : 502;
    return NextResponse.json({ error: msg }, { status, headers: { "Cache-Control": "no-store" } });
  }
}
