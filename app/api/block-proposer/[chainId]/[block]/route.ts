import { NextResponse } from "next/server";
import { STATS_API_BASE } from "@/lib/stats-api";

// Who proposed a C-Chain block: the Snowman++ wrapper around every block
// names the validator that built it, the P-Chain height its validator set
// was read at, and when it proposed. The Stats API serves this on its EVM
// block endpoint, for the blocks its proposer indexer has read. A block
// never changes, so a found answer is cached for a day; a miss (a block the
// indexer has not read) is not cached, so the next ask can find it.

const C_CHAINS = new Set(["43114", "43113"]);

export interface BlockProposer {
  proposerId: string;
  proposerParentId: string;
  proposerNodeId: string;
  proposerPChainHeight: number;
  /** unix seconds */
  proposerTimestamp: number;
}

const cache = new Map<string, BlockProposer>();

export async function GET(_req: Request, { params }: { params: Promise<{ chainId: string; block: string }> }) {
  const { chainId, block } = await params;
  if (!C_CHAINS.has(chainId)) return NextResponse.json({ error: "proposer data covers the C-Chain only" }, { status: 404 });
  if (!/^(\d+|0x[0-9a-fA-F]{64})$/.test(block)) return NextResponse.json({ error: "block must be a height or a hash" }, { status: 400 });

  const key = `${chainId}:${block.toLowerCase()}`;
  const hit = cache.get(key);
  if (hit) return NextResponse.json(hit, { headers: { "Cache-Control": "public, max-age=86400, s-maxage=86400, immutable" } });

  try {
    const res = await fetch(`${STATS_API_BASE}/evm-api/${chainId}/block/${block}`, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(8_000),
    });
    if (res.status === 404) return NextResponse.json({ error: "not indexed yet" }, { status: 404, headers: { "Cache-Control": "no-store" } });
    if (!res.ok) throw new Error(`Stats API HTTP ${res.status}`);
    const body = (await res.json()) as { proposer?: BlockProposer };
    const p = body.proposer;
    if (!p?.proposerNodeId) return NextResponse.json({ error: "no proposer on this block" }, { status: 404, headers: { "Cache-Control": "no-store" } });
    const data: BlockProposer = {
      proposerId: p.proposerId,
      proposerParentId: p.proposerParentId,
      proposerNodeId: p.proposerNodeId,
      proposerPChainHeight: Number(p.proposerPChainHeight),
      proposerTimestamp: Number(p.proposerTimestamp),
    };
    if (cache.size > 5000) cache.clear();
    cache.set(key, data);
    return NextResponse.json(data, { headers: { "Cache-Control": "public, max-age=86400, s-maxage=86400, immutable" } });
  } catch (err) {
    console.error("[block-proposer]", err);
    return NextResponse.json({ error: "proposer lookup failed" }, { status: 502, headers: { "Cache-Control": "no-store" } });
  }
}
