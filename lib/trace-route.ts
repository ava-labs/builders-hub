import { NextRequest, NextResponse } from "next/server";
import { softStatus } from "@/lib/explorer-soft-status";
import { getClientIP } from "@/lib/net/clientIp";
import { isCrawler } from "@/lib/net/crawler";
import type { Lane } from "@/lib/trace-gate";
import type { TraceMiss } from "@/lib/trace-node";

// The GET handler of the routes that read a transaction from the shared
// debug node for the tx page (lib/trace-node.ts): /api/trace/<chain>/<hash>
// for the trace, and its /gas for the gas profile. Crawlers get none: a
// crawler that renders a tx page would read that tx on the shared debug
// node, and robots.txt asks them to stay off this path. A page sends
// x-trace-lane: gesture once the user has tapped, clicked or typed, which
// gives it the larger share of the node budget (lib/trace-gate.ts). An
// answer is final once its block is, so a complete one is cached hard;
// every miss is no-store and carries a fixed code, never the node's or the
// fetch's text.

const FINAL = { "Cache-Control": "public, max-age=3600, s-maxage=31536000, immutable" };
/** an answer that a later ask can complete */
const PARTIAL = { "Cache-Control": "public, max-age=60, s-maxage=300" };
const NO_STORE = { "cache-control": "private, no-store" };

const STATUS: Record<TraceMiss, number> = {
  no_node: 404,
  not_found: 404,
  // the page keeps its receipt view, as for a tx with no trace
  too_large: 404,
  rate: 429,
  busy: 503,
  breaker: 503,
  unavailable: 503,
  timeout: 504,
  node_error: 502,
};

type Miss = { miss: TraceMiss };
const missed = (out: object): out is Miss => "miss" in out;

/** a route over one read: read gives its answer or a miss, body the part
 *  of the answer the page gets, whole whether the answer is complete (an
 *  incomplete one is cached for minutes, not for good) */
export function traceRoute<A extends object>(
  read: (chainId: string, hash: string, from: { lane: Lane; ip: string }) => Promise<A | Miss>,
  body: (answer: A) => unknown,
  whole: (answer: A) => boolean = () => true,
) {
  return async function GET(req: NextRequest, { params }: { params: Promise<{ chainId: string; txHash: string }> }) {
    const { chainId, txHash } = await params;
    const hash = txHash.toLowerCase();
    if (!/^0x[0-9a-f]{64}$/.test(hash)) return NextResponse.json({ error: "invalid transaction hash" }, { status: 400 });
    if (isCrawler(req.headers.get("user-agent"))) return NextResponse.json({ error: "crawler" }, { status: 403, headers: NO_STORE });

    const lane = req.headers.get("x-trace-lane") === "gesture" ? "gesture" : "open";
    const out = await read(chainId, hash, { lane, ip: getClientIP(req) });
    if (missed(out)) return NextResponse.json({ error: out.miss }, softStatus(req, STATUS[out.miss], NO_STORE));
    return NextResponse.json(body(out), { headers: whole(out) ? FINAL : PARTIAL });
  };
}
