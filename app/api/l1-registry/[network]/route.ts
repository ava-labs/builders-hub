import { NextResponse } from "next/server";
import { EXPLORER_API_BASE, isPchainNetwork } from "@/lib/pchain-explorer";

// The chain build-out registry, aggregated server-side: every subnet the
// P-Chain has ever created (the box's /v1 subnets endpoint, ~6 pages),
// reduced to the totals, a monthly cumulative creation series, and the
// newest launches. Creations are slow-moving — cache aggressively.

export const dynamic = "force-dynamic";

const PAGE_SIZE = 100;
const FETCH_TIMEOUT_MS = 20_000;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1h in-process
const CACHE_CONTROL = "public, max-age=900, s-maxage=3600, stale-while-revalidate=86400";
const PRIMARY_SUBNET_ID = "11111111111111111111111111111111LpoYY";

interface RegistryBlockchain {
  blockchainId: string;
  blockchainName?: string;
  createBlockTimestamp?: number;
  evmChainId?: number;
  subnetId?: string;
  vmId?: string;
}

interface RegistrySubnet {
  subnetId: string;
  isL1?: boolean;
  createBlockTimestamp?: number;
  blockchains?: RegistryBlockchain[] | null;
}

export interface L1Registry {
  totals: { subnets: number; l1s: number; blockchains: number; evmChains: number };
  /** newest blockchain launches, newest first */
  recent: {
    name: string;
    blockchainId: string;
    subnetId: string;
    isL1: boolean;
    evmChainId?: number;
    createdAt: number;
  }[];
  lastUpdated: number;
}

const cache = new Map<string, { data: L1Registry; at: number }>();

async function fetchAllSubnets(network: string): Promise<RegistrySubnet[]> {
  const out: RegistrySubnet[] = [];
  let pageToken: string | undefined;
  for (let i = 0; i < 50; i++) {
    const tok = pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : "";
    const res = await fetch(
      `${EXPLORER_API_BASE}/v1/networks/${network}/subnets?pageSize=${PAGE_SIZE}${tok}`,
      { headers: { accept: "application/json" }, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) },
    );
    if (!res.ok) throw new Error(`subnets upstream ${res.status}`);
    const page = (await res.json()) as { subnets?: RegistrySubnet[]; nextPageToken?: string };
    const subnets = page.subnets ?? [];
    out.push(...subnets);
    pageToken = page.nextPageToken;
    if (!pageToken || subnets.length < PAGE_SIZE) break;
  }
  return out;
}

function buildRegistry(subnets: RegistrySubnet[]): L1Registry {
  const totals = { subnets: 0, l1s: 0, blockchains: 0, evmChains: 0 };
  const allChains: L1Registry["recent"] = [];

  for (const s of subnets) {
    if (s.subnetId === PRIMARY_SUBNET_ID) continue;
    totals.subnets++;
    if (s.isL1) totals.l1s++;
    for (const b of s.blockchains ?? []) {
      totals.blockchains++;
      if (b.evmChainId) totals.evmChains++;
      if (b.createBlockTimestamp) {
        allChains.push({
          name: b.blockchainName || "Unnamed chain",
          blockchainId: b.blockchainId,
          subnetId: s.subnetId,
          isL1: !!s.isL1,
          evmChainId: b.evmChainId || undefined,
          createdAt: b.createBlockTimestamp,
        });
      }
    }
  }

  allChains.sort((a, b) => b.createdAt - a.createdAt);
  return { totals, recent: allChains.slice(0, 8), lastUpdated: Date.now() };
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ network: string }> },
) {
  const { network } = await params;
  if (!isPchainNetwork(network)) {
    return NextResponse.json({ error: `unknown network '${network}'` }, { status: 404 });
  }
  const hit = cache.get(network);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
    return NextResponse.json(hit.data, { headers: { "cache-control": CACHE_CONTROL } });
  }
  try {
    const data = buildRegistry(await fetchAllSubnets(network));
    cache.set(network, { data, at: Date.now() });
    return NextResponse.json(data, { headers: { "cache-control": CACHE_CONTROL } });
  } catch {
    // serve the stale aggregate over an error — creations move slowly
    if (hit) return NextResponse.json(hit.data, { headers: { "cache-control": CACHE_CONTROL } });
    return NextResponse.json({ error: "registry upstream unreachable" }, { status: 504 });
  }
}
