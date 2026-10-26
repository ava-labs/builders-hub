import "server-only";
import { randomUUID } from "node:crypto";
import { redis } from "@/lib/redis";
import { rateBucket } from "@/lib/net/clientIp";

/* The budget for the shared C-Chain debug node. The node caps no debug_*
   call itself, so each trace this site asks for passes this gate first.
   The state lives in Redis, so the caps hold across every Vercel instance:

   - SLOTS traces on the node at once. A slot is a lease of LEASE_MS. A slot
     stays taken after our fetch gives up, because the node's replay of the
     block cannot be cancelled: only the node's answer, or the lease, frees it.
   - PER_MINUTE new traces a minute in all. A page load with no user gesture
     yet (the "open" lane, where crawlers that spoof a browser land) gets
     OPEN_SLOTS of the slots and OPEN_PER_MINUTE of the minute. The other
     lanes take the slots from the top down, so they leave the open ones free
     while they can.
   - IP_PER_MINUTE and IP_PER_HOUR from one client IP (an IPv6 /64), with
     more after a gesture. The chat calls in process, from the server, so it
     has no client IP here.
   - A breaker: BREAKER_ERRORS node failures in a minute stop that chain's
     traces for BREAKER_MS. An answer from the node is no failure, an error
     answer included: a trace it stopped at its own timeout, or a tx whose
     state it lacks. A transport failure, an HTTP error or a fetch we gave
     up on is one.

   Slots, minutes and the breaker are per chain: each chain has its own
   node. The lane is a hint a client sends, not a proof: a scraper that sends
   it gets the larger share, and the per-chain caps still bound it.

   Only a trace that gets a slot spends the budgets, so a refusal costs a
   caller nothing and a burst of refusals does not close the minute. The
   counts are read before the slot is taken, so a minute can go over by the
   few traces that read at once; the slots alone are exact.

   With Redis down or slow, the gate refuses. One instance cannot see the
   others, so a cap kept in its own memory would grow with the instance
   count. A local dev server with no REDIS_URL keeps the slots and the
   minute cap in its own memory: it is one process. */

export type Lane = "open" | "gesture" | "chat";
export type Refusal = "busy" | "rate" | "breaker" | "unavailable";
/** how a trace ended, for the slot and the breaker */
export type Outcome = "answered" | "node_error" | "abandoned";

export const SLOTS = 4;
export const OPEN_SLOTS = 2;
export const LEASE_MS = 60_000;
export const PER_MINUTE = 60;
export const OPEN_PER_MINUTE = 40;
/** per client IP, for page loads with no gesture yet and after one */
export const IP_PER_MINUTE = { open: 10, gesture: 30 };
export const IP_PER_HOUR = { open: 100, gesture: 600 };
export const BREAKER_ERRORS = 5;
export const BREAKER_MS = 60_000;
/** the longest the gate waits for one Redis answer */
export const REDIS_MS = 300;
/** the longest it waits for an instance's first connect to Redis */
export const CONNECT_MS = 1_500;

const KEY = "trace:gate:";
/** deletes a key only for the caller that set it: a lease that ran out may
 *  already belong to another caller */
export const RELEASE = 'if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("del", KEYS[1]) else return 0 end';

type Client = NonNullable<Awaited<ReturnType<typeof redis>>>;

export interface Pass {
  /** the trace ended: an answer from the node frees the slot, and a node
   *  failure also counts toward the breaker. An abandoned trace keeps its
   *  slot until the lease runs out, since the node may still be working */
  done(outcome: Outcome): Promise<void>;
}

/** the gate of a local dev server with no Redis: one process, so its own
 *  memory holds the slots and the minute */
const local = { inFlight: 0, minute: 0, count: 0 };

function localGate(): { pass: Pass } | { refused: Refusal } {
  const minute = Math.floor(Date.now() / 60_000);
  if (local.minute !== minute) Object.assign(local, { minute, count: 0 });
  if (local.count >= PER_MINUTE) return { refused: "rate" };
  if (local.inFlight >= SLOTS) return { refused: "busy" };
  local.count++;
  local.inFlight++;
  let open = true;
  return {
    pass: {
      async done() {
        if (open) local.inFlight--;
        open = false;
      },
    },
  };
}

/** a Redis answer, or a rejection after ms */
export function within<T>(p: Promise<T>, ms = REDIS_MS): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("redis timeout")), ms);
  });
  return Promise.race([p, late]).finally(() => clearTimeout(timer));
}

/** a slot for this trace: the open lane from the bottom, the others from the top */
async function takeSlot(r: Client, chainId: string, lane: Lane, id: string): Promise<string | null> {
  const order = lane === "open" ? [...Array(OPEN_SLOTS).keys()] : [...Array(SLOTS).keys()].reverse();
  for (const i of order) {
    const slot = `${KEY}${chainId}:slot:${i}`;
    try {
      if ((await within(r.set(slot, id, { NX: true, PX: LEASE_MS }))) === "OK") return slot;
    } catch (e) {
      // the SET may land after our wait: free it then. One connection runs
      // its commands in order, so this runs after the SET
      void r.eval(RELEASE, { keys: [slot], arguments: [id] }).catch(() => {});
      throw e;
    }
  }
  return null;
}

/** a slot for one trace on the node, or the reason there is none */
export async function enterGate(chainId: string, lane: Lane, ip: string): Promise<{ pass: Pass } | { refused: Refusal }> {
  if (!process.env.REDIS_URL && !process.env.VERCEL) return localGate();
  const r = await within(redis(), CONNECT_MS).catch(() => null);
  if (!r) return { refused: "unavailable" };
  try {
    const now = Date.now();
    const minute = Math.floor(now / 60_000);
    const hour = Math.floor(now / 3_600_000);
    const bucket = rateBucket(ip);
    const all = `${KEY}${chainId}:m${minute}`;
    const open = `${KEY}${chainId}:open:m${minute}`;
    const ipMinute = `${KEY}ip:${bucket}:m${minute}`;
    const ipHour = `${KEY}ip:${bucket}:h${hour}`;
    const [breaker, nAll, nOpen, nIpMinute, nIpHour] = await within(r.mGet([`${KEY}${chainId}:breaker`, all, open, ipMinute, ipHour]));
    if (breaker) return { refused: "breaker" };
    if (lane !== "chat" && (Number(nIpMinute) >= IP_PER_MINUTE[lane] || Number(nIpHour) >= IP_PER_HOUR[lane])) return { refused: "rate" };
    if (lane === "open" && Number(nOpen) >= OPEN_PER_MINUTE) return { refused: "rate" };
    if (Number(nAll) >= PER_MINUTE) return { refused: "rate" };

    const id = randomUUID();
    const slot = await takeSlot(r, chainId, lane, id);
    if (!slot) return { refused: "busy" };
    const spend = r.multi().incr(all).expire(all, 120);
    if (lane === "open") spend.incr(open).expire(open, 120);
    if (lane !== "chat") spend.incr(ipMinute).expire(ipMinute, 120).incr(ipHour).expire(ipHour, 7_200);
    // a count lost to a Redis error is one trace less counted; the slot holds
    await within(spend.exec()).catch(() => {});
    return { pass: held(r, chainId, slot, id) };
  } catch {
    return { refused: "unavailable" };
  }
}

function held(r: Client, chainId: string, slot: string, id: string): Pass {
  return {
    async done(outcome) {
      try {
        if (outcome !== "abandoned") await within(r.eval(RELEASE, { keys: [slot], arguments: [id] }));
        if (outcome === "answered") return;
        const errors = `${KEY}${chainId}:errors:m${Math.floor(Date.now() / 60_000)}`;
        const [n] = await within(r.multi().incr(errors).expire(errors, 120).exec());
        if (Number(n) >= BREAKER_ERRORS) await within(r.set(`${KEY}${chainId}:breaker`, "1", { PX: BREAKER_MS }));
      } catch {
        /* the lease frees the slot; a breaker count lost to a Redis error is one failure less */
      }
    },
  };
}
