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
  /** oldest-first cumulative counts by month (YYYY-MM) */
  series: { month: string; blockchains: number; subnets: number }[];
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

function monthOf(ts: number): string {
  return new Date(ts * 1000).toISOString().slice(0, 7);
}

function buildRegistry(subnets: RegistrySubnet[]): L1Registry {
  const totals = { subnets: 0, l1s: 0, blockchains: 0, evmChains: 0 };
  const subnetMonths = new Map<string, number>();
  const chainMonths = new Map<string, number>();
  const allChains: L1Registry["recent"] = [];

  for (const s of subnets) {
    if (s.subnetId === PRIMARY_SUBNET_ID) continue;
    totals.subnets++;
    if (s.isL1) totals.l1s++;
    if (s.createBlockTimestamp) {
      const m = monthOf(s.createBlockTimestamp);
      subnetMonths.set(m, (subnetMonths.get(m) ?? 0) + 1);
    }
    for (const b of s.blockchains ?? []) {
      totals.blockchains++;
      if (b.evmChainId) totals.evmChains++;
      if (b.createBlockTimestamp) {
        const m = monthOf(b.createBlockTimestamp);
        chainMonths.set(m, (chainMonths.get(m) ?? 0) + 1);
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

  // one continuous month axis from the first creation to now, both series
  // accumulating along it — a cumulative chart must never skip a month
  const months = [...new Set([...subnetMonths.keys(), ...chainMonths.keys()])].sort();
  const series: L1Registry["series"] = [];
  if (months.length) {
    let cb = 0;
    let cs = 0;
    const now = monthOf(Date.now() / 1000);
    for (let d = new Date(`${months[0]}-01T00:00:00Z`); ; d.setUTCMonth(d.getUTCMonth() + 1)) {
      const m = d.toISOString().slice(0, 7);
      cb += chainMonths.get(m) ?? 0;
      cs += subnetMonths.get(m) ?? 0;
      series.push({ month: m, blockchains: cb, subnets: cs });
      if (m >= now) break;
    }
  }

  allChains.sort((a, b) => b.createdAt - a.createdAt);
  return { totals, series, recent: allChains.slice(0, 8), lastUpdated: Date.now() };
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
