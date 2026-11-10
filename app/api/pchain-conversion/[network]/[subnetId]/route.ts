import { NextResponse } from "next/server";
import { softStatus } from "@/lib/explorer-soft-status";
import { EXPLORER_API_BASE, isPchainNetwork, type ConversionResponse } from "@/lib/pchain-explorer";

/* When a subnet became an L1: its ConvertSubnetToL1Tx and that tx's block
 * time, for the node page's line that explains why a node's subnet terms
 * end where its L1 seat begins.
 *
 * The P-Chain node keeps only the conversion's ID (a hash of the conversion
 * data, not the tx), so the tx comes from our P-Chain read API's subnet
 * record, and its time from the tx itself. A conversion is final: a found one
 * caches hard, and a subnet not converted yet is asked again in minutes.
 */

export const dynamic = "force-dynamic";

const TIMEOUT_MS = 8000;
const FINAL_CACHE = "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800";
const OPEN_CACHE = "public, max-age=300, s-maxage=300, stale-while-revalidate=600";
const CB58_ID = /^[1-9A-HJ-NP-Za-km-z]{32,64}$/;

async function getJson<T>(path: string): Promise<T | null> {
  const res = await fetch(`${EXPLORER_API_BASE}${path}`, {
    headers: { accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (res.status === 404) return null;
  // the path only: the base can carry credentials
  if (!res.ok) throw new Error(`${res.status} from ${path}`);
  return (await res.json()) as T;
}

export async function GET(req: Request, { params }: { params: Promise<{ network: string; subnetId: string }> }) {
  const { network, subnetId } = await params;
  if (!isPchainNetwork(network)) {
    return NextResponse.json({ error: `unknown network '${network}'` }, { status: 404 });
  }
  if (!CB58_ID.test(subnetId)) {
    return NextResponse.json({ error: "expected a CB58 subnet ID" }, { status: 400 });
  }

  try {
    const subnet = await getJson<{ l1ConversionTransactionHash?: string }>(`/v1/networks/${network}/subnets/${subnetId}`);
    if (!subnet) return NextResponse.json({ error: "unknown subnet" }, softStatus(req, 404));
    const txHash = subnet.l1ConversionTransactionHash || null;
    if (!txHash) {
      const body: ConversionResponse = { subnetId, txHash: null, timestamp: null };
      return NextResponse.json(body, { headers: { "cache-control": OPEN_CACHE } });
    }
    const tx = await getJson<{ blockTimestamp?: number }>(`/api/${network}/tx/${txHash}`);
    const timestamp = Number(tx?.blockTimestamp);
    // a hash without its block time is no answer yet: no cache, so the next ask tries again
    if (!Number.isFinite(timestamp) || timestamp <= 0) throw new Error("conversion tx has no block time");
    const body: ConversionResponse = { subnetId, txHash, timestamp };
    return NextResponse.json(body, { headers: { "cache-control": FINAL_CACHE } });
  } catch {
    return NextResponse.json({ error: "P-Chain read API unreachable" }, softStatus(req, 504));
  }
}
