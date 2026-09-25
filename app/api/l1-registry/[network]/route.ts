import { NextResponse } from "next/server";
import { EXPLORER_API_BASE, isPchainNetwork } from "@/lib/pchain-explorer";

// The chain build-out registry, aggregated server-side: every subnet the
// P-Chain has ever created (the box's /v1 subnets endpoint, ~6 pages),
// reduced to the totals, a monthly cumulative creation series, and the
// newest launches, each with its active validators so the network map can
// stand a new L1 up before the catalog knows it. Creations are
// slow-moving, so cache aggressively.

export const dynamic = "force-dynamic";

const PAGE_SIZE = 100;
const FETCH_TIMEOUT_MS = 20_000;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1h in-process
const CACHE_CONTROL = "public, max-age=900, s-maxage=3600, stale-while-revalidate=86400";
const PRIMARY_SUBNET_ID = "11111111111111111111111111111111LpoYY";
const P_CHAIN_RPC: Record<string, string> = {
  mainnet: "https://api.avax.network/ext/bc/P",
  fuji: "https://api.avax-test.network/ext/bc/P",
};

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
    /** active validators at the proposed height; null when the P-Chain did not answer */
    validators: number | null;
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

/* each subnet's active validators at the proposed height, from one call:
   a subnet whose set is empty is not running */
async function fetchValidatorCounts(network: string): Promise<Map<string, number> | null> {
  try {
    const res = await fetch(P_CHAIN_RPC[network], {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "platform.getAllValidatorsAt", params: { height: "proposed" } }),
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const sets = (await res.json())?.result?.validatorSets;
    if (!sets || typeof sets !== "object") return null;
    const counts = new Map<string, number>();
    for (const [subnetId, set] of Object.entries(sets)) {
      const validators = (set as { validators?: unknown[] })?.validators;
      counts.set(subnetId, Array.isArray(validators) ? validators.length : 0);
    }
    return counts;
  } catch {
    return null;
  }
}

function buildRegistry(subnets: RegistrySubnet[], counts: Map<string, number> | null): L1Registry {
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
          validators: counts ? counts.get(s.subnetId) ?? 0 : null,
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
    const [subnets, counts] = await Promise.all([fetchAllSubnets(network), fetchValidatorCounts(network)]);
    const data = buildRegistry(subnets, counts);
    cache.set(network, { data, at: Date.now() });
    return NextResponse.json(data, { headers: { "cache-control": CACHE_CONTROL } });
  } catch {
    // serve the stale aggregate over an error — creations move slowly
    if (hit) return NextResponse.json(hit.data, { headers: { "cache-control": CACHE_CONTROL } });
    return NextResponse.json({ error: "registry upstream unreachable" }, { status: 504 });
  }
}
