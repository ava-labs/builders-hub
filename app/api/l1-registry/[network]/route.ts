import { NextResponse } from "next/server";
import { isPchainNetwork } from "@/lib/pchain-explorer";
import { pchainPost } from "@/lib/pchain-rpc";
import { fetchAllSubnets, fetchSubnetsById, mergeSubnetReads, runningL1Count, type RegistrySubnet } from "@/lib/pchain-subnets";

// The chain build-out registry, aggregated server-side: every subnet the
// P-Chain has ever created (the box's /v1 subnets endpoint, ~6 pages),
// reduced to the totals, a monthly cumulative creation series, and the
// newest launches, each with its active validators so the network map can
// stand a new L1 up before the catalog knows it. Creations are
// slow-moving, so cache aggressively. Fuji reads less: see readFujiSubnets.

export const dynamic = "force-dynamic";

const FETCH_TIMEOUT_MS = 20_000;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1h in-process
const CACHE_CONTROL = "public, max-age=900, s-maxage=3600, stale-while-revalidate=86400";
const PRIMARY_SUBNET_ID = "11111111111111111111111111111111LpoYY";

export interface L1Registry {
  /** l1s: every subnet ever converted; activeL1s: the L1s among the running sets, null when the P-Chain did not answer */
  totals: { subnets: number; l1s: number; activeL1s: number | null; blockchains: number; evmChains: number };
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
  /** every subnet whose set runs now, named by its newest chain, newest
   *  first; empty when the P-Chain did not answer. Not all are L1s: legacy
   *  subnets (gunz, StepNetwork) run sets too, so an L1 count reads isL1,
   *  or totals.activeL1s */
  active: L1Registry["recent"];
  lastUpdated: number;
}

const cache = new Map<string, { data: L1Registry; at: number }>();
// the last counts the P-Chain gave, per network: a busy or rate-limited P-Chain serves them rather than none
const lastCounts = new Map<string, Map<string, number>>();

/* each subnet's active validators at the proposed height, from one call:
   a subnet whose set is empty is not running */
async function fetchValidatorCounts(network: string): Promise<Map<string, number> | null> {
  try {
    const res = await pchainPost(
      network,
      { jsonrpc: "2.0", id: 1, method: "platform.getAllValidatorsAt", params: { height: "proposed" } },
      FETCH_TIMEOUT_MS,
    );
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

/* Fuji has ~8,000 subnets: 80 pages are too slow for one request. Read the
   newest page (100 subnets, newest first) for the recent launches and the
   sites, and name each running set by its subnet ID. The totals then count
   only these subnets, not every subnet on Fuji. No Fuji page reads the
   totals: the L1s tab is mainnet only. missing counts the running sets
   that no read named. */
async function readFujiSubnets(counts: Promise<Map<string, number> | null>): Promise<{ subnets: RegistrySubnet[]; missing: number }> {
  const runningIds = counts.then((c) => [...(c ?? [])].filter(([id, n]) => n > 0 && id !== PRIMARY_SUBNET_ID).map(([id]) => id));
  const [newest, byId, ids] = await Promise.all([
    fetchAllSubnets("fuji", 1),
    runningIds.then((ids) => fetchSubnetsById("fuji", ids)),
    runningIds,
  ]);
  return mergeSubnetReads(newest, byId, ids);
}

function buildRegistry(subnets: RegistrySubnet[], counts: Map<string, number> | null): L1Registry {
  const totals = { subnets: 0, l1s: 0, activeL1s: counts ? runningL1Count(counts, subnets) : null, blockchains: 0, evmChains: 0 };
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
  // one per running set, so the map can stand the L1s the catalog does not list
  const active = new Map<string, L1Registry["recent"][number]>();
  for (const c of allChains) if ((c.validators ?? 0) > 0 && !active.has(c.subnetId)) active.set(c.subnetId, c);
  return { totals, recent: allChains.slice(0, 8), active: [...active.values()], lastUpdated: Date.now() };
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ network: string }> },
) {
  const { network } = await params;
  if (!isPchainNetwork(network)) {
    return NextResponse.json({ error: `unknown network '${network}'` }, { status: 400, headers: { "cache-control": "no-store" } });
  }
  const hit = cache.get(network);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
    return NextResponse.json(hit.data, { headers: { "cache-control": CACHE_CONTROL } });
  }
  try {
    const read = fetchValidatorCounts(network).then((fresh) => {
      if (fresh) lastCounts.set(network, fresh);
      return fresh ?? lastCounts.get(network) ?? null;
    });
    const [{ subnets, missing }, counts] = await Promise.all([
      network === "fuji" ? readFujiSubnets(read) : fetchAllSubnets(network).then((all) => ({ subnets: all, missing: 0 })),
      read,
    ]);
    const data = buildRegistry(subnets, counts);
    // built without any counts, or with a running set no read named, it holds a minute rather than the hour, so the map recovers
    cache.set(network, { data, at: counts && missing === 0 ? Date.now() : Date.now() - CACHE_TTL_MS + 60_000 });
    return NextResponse.json(data, { headers: { "cache-control": CACHE_CONTROL } });
  } catch {
    // serve the stale aggregate over an error: creations move slowly
    if (hit) return NextResponse.json(hit.data, { headers: { "cache-control": CACHE_CONTROL } });
    return NextResponse.json({ error: "registry upstream unreachable" }, { status: 504, headers: { "cache-control": "no-store" } });
  }
}
