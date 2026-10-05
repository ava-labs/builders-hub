import { EXPLORER_API_BASE } from "@/lib/pchain-explorer";

/* Every subnet the P-Chain has created, from our P-chain read API (the
   box's /v1 subnets endpoint, ~6 pages on mainnet), and which of the
   running validator sets are L1s. A running set alone does not make an
   L1: legacy subnets (gunz, StepNetwork) run sets too, and isL1 tells
   them apart, as /api/validator-stats counts. */

const PAGE_SIZE = 100;
const FETCH_TIMEOUT_MS = 20_000;
const PRIMARY_SUBNET_ID = "11111111111111111111111111111111LpoYY";

export interface RegistryBlockchain {
  blockchainId: string;
  blockchainName?: string;
  createBlockTimestamp?: number;
  evmChainId?: number;
  subnetId?: string;
  vmId?: string;
}

export interface RegistrySubnet {
  subnetId: string;
  isL1?: boolean;
  createBlockTimestamp?: number;
  blockchains?: RegistryBlockchain[] | null;
}

export async function fetchAllSubnets(network: string): Promise<RegistrySubnet[]> {
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

/** how many running validator sets (validators by subnet ID) belong to L1s */
export function runningL1Count(validatorCounts: Map<string, number>, subnets: RegistrySubnet[]): number {
  const l1s = new Set(subnets.filter((s) => s.isL1 && s.subnetId !== PRIMARY_SUBNET_ID).map((s) => s.subnetId));
  let n = 0;
  for (const [subnetId, validators] of validatorCounts) if (validators > 0 && l1s.has(subnetId)) n++;
  return n;
}
