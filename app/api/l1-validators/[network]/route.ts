import { NextResponse } from "next/server";
import { EXPLORER_API_BASE } from "@/lib/pchain-explorer";
import { pchainPost } from "@/lib/pchain-rpc";
import { releaseOf } from "@/lib/validator-triage";
import type { L1Feed, L1FeedRow } from "@/lib/l1-validator-triage";
import type { ValidatorVersion } from "@/types/validator-stats";
import { FUJI_VALIDATOR_DISCOVERY_URL, MAINNET_VALIDATOR_DISCOVERY_URL } from "@/constants/validator-discovery";

/* Every L1's validators in one list, for the P-Chain validators page's L1
   view. A validation's weight, balance and registration time come from
   our P-Chain read API; its node's release, and the time and address of
   the network crawler's last handshake with it, from the discovery
   crawler. A node that also validates the Primary Network is read by our
   own node too, and that reading wins, at the snapshot's time. The
   continuous fee's price comes along, so a balance reads as days. */

export const dynamic = "force-dynamic";
// a cold read API pages slowly (see validator-stats); the 5-minute list covers the rest
export const maxDuration = 60;

type Network = "mainnet" | "fuji";

const PAGE_SIZE = 100;
const MAX_PAGES = 50;
const CACHE_MS = 5 * 60_000;
const LIST_TIMEOUT = 60_000;
const SIDE_TIMEOUT = 10_000;

interface Upstream {
  nodeId: string;
  validationId: string;
  subnetId: string;
  weight: number | string;
  remainingBalance: number | string;
  creationTimestamp: number | string;
}

async function getJson<T>(url: string, timeout: number): Promise<T> {
  const res = await fetch(url, { headers: { Accept: "application/json" }, cache: "no-store", signal: AbortSignal.timeout(timeout) });
  // the path only: the base can carry credentials
  if (!res.ok) throw new Error(`${res.status} from ${new URL(url).pathname}`);
  return (await res.json()) as T;
}

/** every active validation, on every L1 */
async function listValidations(network: Network): Promise<Upstream[]> {
  const out: Upstream[] = [];
  let token: string | undefined;
  for (let i = 0; i < MAX_PAGES; i++) {
    const qs = new URLSearchParams({ pageSize: String(PAGE_SIZE), includeInactive: "false" });
    if (token) qs.set("pageToken", token);
    const page = await getJson<{ validators?: Upstream[]; nextPageToken?: string }>(`${EXPLORER_API_BASE}/v1/networks/${network}/l1Validators?${qs}`, LIST_TIMEOUT);
    const rows = Array.isArray(page.validators) ? page.validators : [];
    out.push(...rows);
    token = page.nextPageToken;
    if (!token || rows.length < PAGE_SIZE) break;
  }
  return out;
}

/** the crawler's last handshake with each node; none when the crawler is down */
async function readHandshakes(network: Network): Promise<Map<string, ValidatorVersion>> {
  try {
    const list = await getJson<ValidatorVersion[]>(network === "fuji" ? FUJI_VALIDATOR_DISCOVERY_URL : MAINNET_VALIDATOR_DISCOVERY_URL, SIDE_TIMEOUT);
    return new Map((Array.isArray(list) ? list : []).map((d) => [d.nodeId, d]));
  } catch {
    return new Map();
  }
}

/** our node's reading of the Primary Network validators it peers with; none when the snapshot is down */
async function readPeers(network: Network): Promise<{ at: number | null; versions: Map<string, string> }> {
  try {
    const j = await getJson<{ snapshotTimestamp?: number; validators?: { nodeId: string; version?: string }[] }>(
      `${EXPLORER_API_BASE}/api/${network}/validators`,
      SIDE_TIMEOUT,
    );
    const versions = new Map<string, string>();
    for (const v of Array.isArray(j.validators) ? j.validators : []) {
      const release = releaseOf(v.version);
      if (v.nodeId && release) versions.set(v.nodeId, release);
    }
    return { at: typeof j.snapshotTimestamp === "number" ? j.snapshotTimestamp : null, versions };
  } catch {
    return { at: null, versions: new Map() };
  }
}

/** the continuous fee, nAVAX per second per validator; null when the node does not answer */
async function readPrice(network: Network): Promise<number | null> {
  try {
    const res = await pchainPost(network, { jsonrpc: "2.0", id: 1, method: "platform.getValidatorFeeState", params: {} }, SIDE_TIMEOUT);
    const j = (await res.json()) as { result?: { price?: number | string } };
    const price = Number(j.result?.price);
    return Number.isFinite(price) && price > 0 ? price : null;
  } catch {
    return null;
  }
}

async function build(network: Network): Promise<L1Feed> {
  const [validations, handshakes, peers, price] = await Promise.all([
    listValidations(network),
    readHandshakes(network),
    readPeers(network),
    readPrice(network),
  ]);
  const validators: L1FeedRow[] = validations
    // the stats route's rule, so both count the same set: no weight or no balance is not validating
    .filter((v) => Number(v.weight) > 0 && Number(v.remainingBalance) > 0)
    .map((v) => {
      const own = peers.versions.get(v.nodeId);
      const h = handshakes.get(v.nodeId);
      // the crawler keeps milliseconds, and 0 for a node it never reached
      const handshake = h?.lastSeenOnline ? Math.floor((h.lastSeenOnline > 1e12 ? h.lastSeenOnline : h.lastSeenOnline * 1000) / 1000) : null;
      return {
        nodeId: v.nodeId,
        validationId: v.validationId,
        subnetId: v.subnetId,
        weight: Number(v.weight),
        balance: Number(v.remainingBalance),
        createdAt: Number(v.creationTimestamp),
        version: own ?? releaseOf(h?.version),
        seenAt: own && peers.at ? peers.at : handshake,
        ip: h?.ip || null,
      };
    });
  return { validators, price };
}

interface Snapshot extends L1Feed {
  at: number;
}

const cache = new Map<Network, Snapshot>();
const refreshing = new Map<Network, Promise<Snapshot>>();

function refresh(network: Network): Promise<Snapshot> {
  let p = refreshing.get(network);
  if (!p) {
    p = build(network)
      .then((feed) => {
        const snap = { ...feed, at: Date.now() };
        cache.set(network, snap);
        return snap;
      })
      .finally(() => refreshing.delete(network));
    refreshing.set(network, p);
  }
  return p;
}

/** the list, at most 5 minutes old; an older one answers while a refresh runs */
async function read(network: Network): Promise<Snapshot> {
  const hit = cache.get(network);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit;
  const next = refresh(network);
  if (!hit) return next;
  // the older list stands; the next request tries again
  next.catch(() => {});
  return hit;
}

export async function GET(_req: Request, { params }: { params: Promise<{ network: string }> }) {
  const { network } = await params;
  if (network !== "mainnet" && network !== "fuji") {
    return NextResponse.json({ error: `Unknown network "${network}"` }, { status: 400 });
  }
  try {
    const { validators, price, at } = await read(network);
    return NextResponse.json(
      { validators, price, updatedAt: at },
      { headers: { "Cache-Control": "public, max-age=0, s-maxage=300, stale-while-revalidate=600" } },
    );
  } catch (error) {
    console.error(`[GET /api/l1-validators/${network}]`, error);
    return NextResponse.json({ error: "The L1 validator list is unavailable" }, { status: 502 });
  }
}
