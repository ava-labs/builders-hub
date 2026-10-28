import { NextRequest, NextResponse } from "next/server";
import { softStatus } from "@/lib/explorer-soft-status";
import { isCrawler } from "@/lib/net/crawler";
import { getTrace, type TraceMiss } from "@/lib/trace-clickhouse";

// One transaction's execution trace for the tx page: the call tree and the
// logs, from ClickHouse (lib/trace-clickhouse.ts), never from a node.
// ?block= names the tx's block, which bounds the query. Crawlers get none:
// the query service's slots are shared, and robots.txt asks crawlers to stay
// off this path. A trace is final once indexed, so it is cached hard; every
// miss is no-store and carries a fixed code, never the query's text.

const FINAL = { "Cache-Control": "public, max-age=3600, s-maxage=31536000, immutable" };
const NO_STORE = { "cache-control": "private, no-store" };

const STATUS: Record<TraceMiss, number> = {
  no_index: 404,
  // the page asks again: the pipeline is about 2 s behind the chain
  not_indexed: 404,
  // the page keeps its receipt view, as for a tx with no trace
  too_large: 404,
  busy: 503,
  error: 502,
};

export async function GET(req: NextRequest, { params }: { params: Promise<{ chainId: string; txHash: string }> }) {
  const { chainId, txHash } = await params;
  const hash = txHash.toLowerCase();
  if (!/^0x[0-9a-f]{64}$/.test(hash)) return NextResponse.json({ error: "invalid transaction hash" }, { status: 400 });
  const raw = req.nextUrl.searchParams.get("block") ?? "";
  const block = Number(raw);
  if (!/^\d{1,10}$/.test(raw) || block > 0xffffffff) return NextResponse.json({ error: "invalid block number" }, { status: 400 });
  if (isCrawler(req.headers.get("user-agent"))) return NextResponse.json({ error: "crawler" }, { status: 403, headers: NO_STORE });

  const out = await getTrace(chainId, hash, block);
  if ("miss" in out) return NextResponse.json({ error: out.miss }, softStatus(req, STATUS[out.miss], NO_STORE));
  return NextResponse.json(out.trace, { headers: FINAL });
}
