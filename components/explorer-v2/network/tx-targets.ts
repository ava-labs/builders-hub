"use client";

import { useEffect, useMemo, useSyncExternalStore } from "react";
import { knownChainName, pchainApiPath, type Tx } from "@/lib/pchain-explorer";
import {
  PRIMARY_SUBNET_ID,
  decodeL1WarpMessage,
  type DecodedL1WarpMessage,
  type L1ValidatorInfo,
  type PlatformUnsignedTx,
  type SubnetInfo,
} from "@/lib/pchain-node";
import type { PulseTx } from "./pchain-pulse";

/* The subnet each tx on the P-Chain ring acts on, so the tile of an L1
   operation can name its L1 and draw its line to that L1's building. The
   feed's rows name no subnet, so each tx is read once a session, the way
   the explorer's tx page reads it: the indexer's parsed tx names the
   subnet, or the seat (validationID) a seat tx acts on, which the node
   resolves to its subnet; the node's copy of the tx fills in a bare row,
   and a Register's signed Warp message names its subnet itself. At most
   MAX_IN_FLIGHT requests are out at once, and the ring never waits on
   them: the map fills in as answers land. Nothing is asked twice: every
   answer is kept, a tx whose lookup fails is left out for the session,
   and a refusal pauses every ask for PAUSE_MS. */

// the tx names its subnet
const NAMES_SUBNET = new Set([
  "ConvertSubnetToL1Tx",
  "CreateChainTx",
  "AddSubnetValidatorTx",
  "RemoveSubnetValidatorTx",
  "TransferSubnetOwnershipTx",
]);
// the tx names a seat, by its validationID
const NAMES_SEAT = new Set(["SetL1ValidatorWeightTx", "IncreaseL1ValidatorBalanceTx", "DisableL1ValidatorTx"]);

/** the tx always acts on an L1 or subnet, so its tile can say so before the
 *  map knows which. AddPermissionlessValidatorTx is not one: it acts on a
 *  subnet only when it names one other than the Primary Network, which only
 *  the map can tell. */
export function actsOnSubnet(type: string): boolean {
  return (
    type === "CreateSubnetTx" || type === "RegisterL1ValidatorTx" || NAMES_SUBNET.has(type) || NAMES_SEAT.has(type)
  );
}

const asksAbout = (type: string) => actsOnSubnet(type) || type === "AddPermissionlessValidatorTx";

const MAX_IN_FLIGHT = 4;
// a refusal (a 429, or the 5xx a proxy answers when the P-Chain refused it) stops every ask this long
const PAUSE_MS = 60_000;

/* ------------------------------------------------------------------ */
/* the requests: never more than MAX_IN_FLIGHT out, none while paused, */
/* and each asked once a session                                       */

let inFlight = 0;
const queue: (() => void)[] = [];
let pausedUntil = 0;

// a finished request hands its slot straight to the next in line
async function limited<T>(get: () => Promise<T>): Promise<T> {
  if (inFlight < MAX_IN_FLIGHT) inFlight++;
  else await new Promise<void>((go) => queue.push(go));
  try {
    for (let wait = pausedUntil - Date.now(); wait > 0; wait = pausedUntil - Date.now()) {
      await new Promise((go) => setTimeout(go, wait));
    }
    return await get();
  } finally {
    const next = queue.shift();
    if (next) next();
    else inFlight--;
  }
}

// every answer the P-Chain gave this session, by what was asked, a failure
// included: the tx that meets it is left out, and it is not asked again.
// `get` must be one request: an ask inside an ask could wait on a slot its
// own caller holds
const asked = new Map<string, Promise<unknown>>();

function ask<T>(key: string, get: () => Promise<T>): Promise<T> {
  const open = asked.get(key) as Promise<T> | undefined;
  if (open) return open;
  const p = limited(get);
  p.catch(() => {});
  asked.set(key, p);
  return p;
}

// a request the P-Chain side did not answer; a refusal pauses every ask
function failed(res: Response): Error {
  if (res.status === 429 || res.status >= 500) pausedUntil = Date.now() + PAUSE_MS;
  return new Error(`HTTP ${res.status}`);
}

// what a tx names: the subnet it acts on, or the seat (validationID) it acts on
interface Named {
  subnetId?: string;
  validationId?: string;
  /** a Register or SetWeight tx's signed Warp message, decoded */
  warp?: DecodedL1WarpMessage;
}

// the indexer's parsed tx, as the tx page reads it; null when it has no row
async function parsedTx(network: string, hash: string): Promise<Named | null> {
  const res = await fetch(pchainApiPath(network, `tx/${hash}`));
  if (res.status === 404) return null;
  if (!res.ok) throw failed(res);
  const tx = (await res.json()) as Tx;
  return { subnetId: tx.subnetId, validationId: tx.details?.validationId };
}

/* One read of the node through the same-origin proxy, as lib/pchain-node's
   helpers make it, but with the status kept so a refusal can pause every
   ask. Null when the node answered with an error, as it does for a seat it
   no longer holds. */
async function node<T>(network: string, method: string, params: object): Promise<T | null> {
  const res = await fetch(`/api/pchain-rpc/${network}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ method, params }),
  });
  if (!res.ok) throw failed(res);
  const json = (await res.json()) as { result?: T; error?: unknown };
  return json.error ? null : (json.result ?? null);
}

// the fields of the node's json the shared PlatformUnsignedTx type leaves out
type NodeTx = PlatformUnsignedTx & { validationID?: string; validator?: { subnetID?: string } };

// the node's copy of the tx, for what the indexer's row leaves out: a
// Register's subnet, and on some rows a weight tx's seat, live only in the
// signed Warp message
async function nodeTx(network: string, hash: string): Promise<Named | null> {
  const got = await node<{ tx?: { unsignedTx?: NodeTx } }>(network, "platform.getTx", { txID: hash, encoding: "json" });
  const u = got?.tx?.unsignedTx;
  if (!u) return null;
  const warp = u.message ? ((await decodeL1WarpMessage(u.message)) ?? undefined) : undefined;
  return {
    subnetId: u.subnetID ?? u.validator?.subnetID ?? (warp?.kind === "register" ? warp.subnetId : undefined),
    validationId: u.validationID ?? (warp?.kind === "weight" ? warp.validationId : undefined),
    warp,
  };
}

const seatSubnet = (network: string, validationId: string) =>
  ask(`seat ${network} ${validationId}`, async () => {
    const seat = await node<L1ValidatorInfo>(network, "platform.getL1Validator", { validationID: validationId });
    return seat?.subnetID ?? null;
  });

/* ------------------------------------------------------------------ */
/* one tx: its subnetID, or null when nothing names one                */

async function resolve(network: string, hash: string, type: string): Promise<string | null> {
  // a subnet's id is the id of the tx that created it
  if (type === "CreateSubnetTx") return hash;
  // the indexer's row names the subnet or the seat; the node fills in a bare
  // row. The P-Chain seats a registered validator on the subnet its message
  // names, which the indexer does not carry.
  const row =
    type === "RegisterL1ValidatorTx" ? null : await ask(`tx ${network} ${hash}`, () => parsedTx(network, hash));
  const named =
    row?.subnetId || row?.validationId ? row : await ask(`node ${network} ${hash}`, () => nodeTx(network, hash));
  if (!named) return null;
  if (named.subnetId) return named.subnetId === PRIMARY_SUBNET_ID ? null : named.subnetId;
  if (!named.validationId) return null;
  // the node holds a seat only until a weight of 0 removes it
  const removal = named.warp?.kind === "weight" && named.warp.weight === 0;
  const seat = removal ? null : await seatSubnet(network, named.validationId);
  if (seat || type !== "SetL1ValidatorWeightTx") return seat;
  // a seat gone from the node: only the weight tx's message still says where it sat
  const warp = named.warp ?? (await ask(`node ${network} ${hash}`, () => nodeTx(network, hash)))?.warp;
  if (warp?.kind !== "weight") return null;
  const sat = await senderSubnet(network, warp.sourceChainId, warp.sourceAddress);
  // the seat's other txs on the ring (a top-up, its disable) sat there too
  if (sat) asked.set(`seat ${network} ${warp.validationId}`, Promise.resolve(sat));
  return sat;
}

/* The P-Chain takes a weight message only from the manager its conversion
   named for the seat's subnet. When the chain that sent the message runs
   on a subnet whose manager is that sender, that subnet is the seat's. */
async function senderSubnet(network: string, chainId: string, address: string): Promise<string | null> {
  // a manager on the C-Chain does not run on the L1 it manages
  if (knownChainName(chainId)) return null;
  // a blockchain's id is the id of the CreateChainTx that made it, which names its subnet
  const subnet = (await ask(`tx ${network} ${chainId}`, () => parsedTx(network, chainId)))?.subnetId;
  if (!subnet || subnet === PRIMARY_SUBNET_ID) return null;
  const manager = await ask(`manager ${network} ${subnet}`, () =>
    node<SubnetInfo>(network, "platform.getSubnet", { subnetID: subnet }),
  );
  const same = manager?.managerChainID === chainId && manager.managerAddress?.toLowerCase() === address.toLowerCase();
  return same ? subnet : null;
}

/* ------------------------------------------------------------------ */
/* the answers, per tx hash for the session                            */

// every settled answer, by `${network} ${hash}`: the subnetID, or null
const known = new Map<string, string | null>();
// one lookup per tx, however many hooks ask for it
const looking = new Map<string, Promise<string | null>>();

function lookup(network: string, hash: string, type: string): Promise<string | null> {
  const key = `${network} ${hash}`;
  const open = looking.get(key);
  if (open) return open;
  // a lookup that fails leaves the tx out for the session
  const p = resolve(network, hash, type).catch(() => null);
  looking.set(key, p);
  void p.then((answer) => {
    known.set(key, answer);
    if (answer) changed();
  });
  return p;
}

// what the hooks read: a copy of the answers, taken once per burst of landings
let snapshot: ReadonlyMap<string, string | null> = new Map();
const EMPTY: ReadonlyMap<string, string | null> = new Map();
const listeners = new Set<() => void>();
let flush: ReturnType<typeof setTimeout> | null = null;

// answers land in bursts: the hooks render once per burst
function changed() {
  if (flush) return;
  flush = setTimeout(() => {
    flush = null;
    snapshot = new Map(known);
    listeners.forEach((l) => l());
  }, 100);
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};

/** the subnet one tx acts on, looked up once a session; null when it names
 *  none or the P-Chain could not say */
export function txTarget(network: string, hash: string, type: string): Promise<string | null> {
  return asksAbout(type) ? lookup(network, hash, type) : Promise.resolve(null);
}

/** tx hash to the subnetID it acts on, for each tx in `txs` whose answer has
 *  landed; the rest fill in as theirs land. The map keeps its identity until
 *  one of these answers changes, so a memo on it holds across polls. */
export function useTxTargets(
  txs: readonly Pick<PulseTx, "hash" | "type">[],
  network = "mainnet",
): Map<string, string> {
  const answers = useSyncExternalStore(subscribe, () => snapshot, () => EMPTY);
  useEffect(() => {
    // in the ring's order, newest first: the tiles that just landed name their L1 first
    for (const t of txs) if (asksAbout(t.type)) void lookup(network, t.hash, t.type);
  }, [txs, network]);
  // these txs' answers as one string, so a new list with the same answers keeps the map
  const sig = useMemo(() => {
    const hits: string[] = [];
    for (const t of txs) {
      const subnet = answers.get(`${network} ${t.hash}`);
      if (subnet) hits.push(`${t.hash}:${subnet}`);
    }
    return hits.join(" ");
  }, [txs, network, answers]);
  return useMemo(() => new Map(sig ? sig.split(" ").map((hit) => hit.split(":") as [string, string]) : []), [sig]);
}
