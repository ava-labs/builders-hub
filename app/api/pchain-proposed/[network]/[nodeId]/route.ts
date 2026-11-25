import { NextRequest, NextResponse } from "next/server";
import { EXPLORER_API_BASE, isPchainNetwork, type BlockSummary } from "@/lib/pchain-explorer";

// The P-Chain blocks a validator proposed, newest first, a page at a time.
// stats-api serves them on its Data API shape (the block's proposerDetails,
// a pageToken cursor); this route hands them back as the explorer's block
// rows, so the P-Chain block table sets them as it sets every block.

export const dynamic = "force-dynamic";

const MAX_PAGE = 100;

interface UpstreamBlock {
  blockNumber: string;
  blockHash: string;
  blockType: string;
  blockTimestamp: number;
  txCount: number;
  blockSizeBytes: number;
  proposerDetails?: { proposerNodeId?: string };
}

export interface ProposedBlocksPage {
  blocks: BlockSummary[];
  nextPageToken?: string;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ network: string; nodeId: string }> }) {
  const { network, nodeId } = await params;
  if (!isPchainNetwork(network)) return NextResponse.json({ error: `unknown network '${network}'` }, { status: 404 });
  if (!/^NodeID-[1-9A-HJ-NP-Za-km-z]{20,60}$/.test(nodeId)) return NextResponse.json({ error: "bad node id" }, { status: 400 });

  const sp = req.nextUrl.searchParams;
  const pageSize = Math.min(MAX_PAGE, Math.max(1, Number(sp.get("limit")) || 25));
  const qs = new URLSearchParams({ pageSize: String(pageSize) });
  const token = sp.get("pageToken");
  if (token) qs.set("pageToken", token);

  try {
    const res = await fetch(`${EXPLORER_API_BASE}/v1/networks/${network}/blockchains/p-chain/nodes/${nodeId}/blocks?${qs}`, {
      cache: "no-store",
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return NextResponse.json({ error: `upstream HTTP ${res.status}` }, { status: res.status === 404 ? 404 : 502 });
    const body = (await res.json()) as { blocks?: UpstreamBlock[]; nextPageToken?: string };
    const blocks: BlockSummary[] = (body.blocks ?? []).map((b) => ({
      blockNumber: Number(b.blockNumber),
      blockHash: b.blockHash,
      blockType: b.blockType,
      blockTimestamp: b.blockTimestamp,
      txCount: b.txCount,
      blockSizeBytes: b.blockSizeBytes,
      proposerNodeId: b.proposerDetails?.proposerNodeId,
    }));
    const page: ProposedBlocksPage = { blocks, nextPageToken: blocks.length >= pageSize ? body.nextPageToken : undefined };
    return NextResponse.json(page, { headers: { "cache-control": "public, max-age=10, s-maxage=10, stale-while-revalidate=15" } });
  } catch (err) {
    const aborted = err instanceof DOMException && (err.name === "AbortError" || err.name === "TimeoutError");
    return NextResponse.json({ error: aborted ? "explorer API timeout" : "explorer API unreachable" }, { status: 504 });
  }
}
