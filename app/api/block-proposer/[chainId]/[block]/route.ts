import { NextResponse } from "next/server";

// Who proposed a C-Chain block: the Snowman++ wrapper around every block
// names the validator that built it, the P-Chain height its validator set
// was read at, and when it proposed. The Data API serves this on its
// Primary Network block endpoint (the C-Chain is one of the three), not on
// the EVM block endpoint. A block never changes, so a found answer is
// cached for a day; a miss (the Data API has not indexed a fresh block
// yet) is not cached, so the next ask can find it.

const NETWORK: Record<string, string> = { "43114": "mainnet", "43113": "fuji" };

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
  const network = NETWORK[chainId];
  if (!network) return NextResponse.json({ error: "proposer data covers the C-Chain only" }, { status: 404 });
  if (!/^(\d+|0x[0-9a-fA-F]{64})$/.test(block)) return NextResponse.json({ error: "block must be a height or a hash" }, { status: 400 });

  const key = `${chainId}:${block.toLowerCase()}`;
  const hit = cache.get(key);
  if (hit) return NextResponse.json(hit, { headers: { "Cache-Control": "public, max-age=86400, s-maxage=86400, immutable" } });

  try {
    const headers: Record<string, string> = { accept: "application/json" };
    if (process.env.GLACIER_API_KEY) headers["x-glacier-api-key"] = process.env.GLACIER_API_KEY;
    const res = await fetch(`https://glacier-api.avax.network/v1/networks/${network}/blockchains/c-chain/blocks/${block}`, {
      headers,
      signal: AbortSignal.timeout(8_000),
    });
    if (res.status === 404) return NextResponse.json({ error: "not indexed yet" }, { status: 404, headers: { "Cache-Control": "no-store" } });
    if (!res.ok) throw new Error(`Data API HTTP ${res.status}`);
    const body = (await res.json()) as { proposerDetails?: BlockProposer };
    const p = body.proposerDetails;
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
