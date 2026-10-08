import { EXPLORER_API_BASE } from "@/lib/pchain-explorer";
import type { SimpleValidator } from "@/types/validator-stats";

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

/** the subnet list, newest first; maxPages = 1 reads the newest 100 alone */
export async function fetchAllSubnets(network: string, maxPages = 50): Promise<RegistrySubnet[]> {
  const out: RegistrySubnet[] = [];
  let pageToken: string | undefined;
  for (let i = 0; i < maxPages; i++) {
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

/* One subnet at a time, by ID, for a network whose list is too long to page
   on a request (Fuji: ~8,000 subnets, 80 pages). Each read is kept an hour
   per network and ID. A read in flight is shared. A failed read is not
   kept, so the next call asks again. */
const BY_ID_TTL_MS = 60 * 60 * 1000;
const BY_ID_TIMEOUT_MS = 8_000;
const BY_ID_MAX_IN_FLIGHT = 8;

const byId = new Map<string, { at: number; read: Promise<RegistrySubnet | null> }>();
let inFlight = 0;
const waiting: (() => void)[] = [];

/* run one read in one of the shared slots; a read that ends gives its slot to the next waiting read */
async function inSlot<T>(run: () => Promise<T>): Promise<T> {
  if (inFlight < BY_ID_MAX_IN_FLIGHT) inFlight++;
  else await new Promise<void>((resolve) => waiting.push(resolve));
  try {
    return await run();
  } finally {
    const next = waiting.shift();
    if (next) next();
    else inFlight--;
  }
}

function subnetById(network: string, id: string): Promise<RegistrySubnet | null> {
  const key = `${network}/${id}`;
  const hit = byId.get(key);
  if (hit && Date.now() - hit.at < BY_ID_TTL_MS) return hit.read;
  const read = inSlot(async () => {
    try {
      const res = await fetch(`${EXPLORER_API_BASE}/v1/networks/${network}/subnets/${encodeURIComponent(id)}`, {
        headers: { accept: "application/json" },
        signal: AbortSignal.timeout(BY_ID_TIMEOUT_MS),
      });
      if (!res.ok) return null;
      const subnet = (await res.json()) as RegistrySubnet | null;
      return subnet?.subnetId ? subnet : null;
    } catch {
      return null;
    }
  });
  const entry = { at: Date.now(), read };
  byId.set(key, entry);
  void read.then((subnet) => {
    if (!subnet && byId.get(key) === entry) byId.delete(key);
  });
  return read;
}

/** the named subnets, one GET each, at most 8 in flight; an ID whose read fails is left out */
export async function fetchSubnetsById(network: string, ids: string[]): Promise<RegistrySubnet[]> {
  const subnets = await Promise.all([...new Set(ids)].map((id) => subnetById(network, id)));
  return subnets.filter((s): s is RegistrySubnet => s !== null);
}

/* The registry input for a network read in two parts: the newest page of
   the list, then each running subnet that the page does not hold, read by
   ID. missing counts the running IDs that neither read gave back. */
export function mergeSubnetReads(
  newest: RegistrySubnet[],
  byId: RegistrySubnet[],
  runningIds: string[],
): { subnets: RegistrySubnet[]; missing: number } {
  const onPage = new Set(newest.map((s) => s.subnetId));
  const subnets = [...newest, ...byId.filter((s) => !onPage.has(s.subnetId))];
  const read = new Set(subnets.map((s) => s.subnetId));
  return { subnets, missing: new Set(runningIds.filter((id) => !read.has(id))).size };
}

/** the IDs of the subnets marked isL1, without the Primary Network */
const l1SubnetIds = (subnets: RegistrySubnet[]) =>
  new Set(subnets.filter((s) => s.isL1 && s.subnetId !== PRIMARY_SUBNET_ID).map((s) => s.subnetId));

/** one seat of a running set, as getAllValidatorsAt gives it */
export interface ValidatorSeat {
  weight?: string;
  nodeIDs?: string[];
}

/* Each node's weight in the running L1 sets (getAllValidatorsAt). A set
   counts only when its subnet came back marked isL1: legacy subnets run
   sets too, and a subnet whose read failed is not known to be an L1. The
   Primary Network's set is left out. Some nodes can share one BLS key:
   that is one seat. Each of its nodes gets a whole-number share of the
   seat's weight, and the first node also gets the remainder. */
export function seatsOf(
  validatorSets: Record<string, { validators?: ValidatorSeat[] } | null | undefined>,
  subnets: RegistrySubnet[],
): SimpleValidator[] {
  const l1s = l1SubnetIds(subnets);
  return Object.entries(validatorSets)
    .filter(([subnetId]) => l1s.has(subnetId))
    .flatMap(([subnetId, set]) =>
      (set?.validators ?? []).flatMap((seat) => {
        const nodes = seat.nodeIDs ?? [];
        const weight = Number(seat.weight ?? 0);
        const share = Math.floor(weight / Math.max(nodes.length, 1));
        return nodes.map((nodeId, i) => ({ nodeId, subnetId, weight: i === 0 ? weight - share * (nodes.length - 1) : share }));
      }),
    );
}

/** how many running validator sets (validators by subnet ID) belong to L1s */
export function runningL1Count(validatorCounts: Map<string, number>, subnets: RegistrySubnet[]): number {
  const l1s = l1SubnetIds(subnets);
  let n = 0;
  for (const [subnetId, validators] of validatorCounts) if (validators > 0 && l1s.has(subnetId)) n++;
  return n;
}
