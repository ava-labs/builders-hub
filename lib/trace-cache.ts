import "server-only";
import { gunzipSync, gzipSync } from "node:zlib";
import { redis } from "@/lib/redis";
import { RELEASE, within } from "@/lib/trace-gate";
import type { GasProfile, TraceResponse } from "@/lib/trace";

/* The traces and gas profiles this site already has, so the debug node
   reads each tx once for each. An answer is final once its block is, so it
   can be kept: in this instance's memory (LOCAL_MAX_BYTES, oldest out
   first) and in the Redis that every instance shares (gzip, TTL by kind).
   A trace with no state diff (the node rejected the diff, and only the call
   tree came back) is kept a short time, so a later ask can get the whole
   trace. A few misses are kept too, so a tx that has no answer is not asked
   for again at once: a tx the node does not know (a few seconds: it may be
   pending), a read that ran out of time, and an answer too large to send.
   Errors and refusals are never kept.

   Keys carry the Vercel environment: a preview shares the production Redis
   and node budget, but its code must not write the answers production
   serves. A lock in Redis lets one instance read a tx while the others wait
   for its answer. Every Redis call has the gate's timeout; a Redis failure
   reads as a miss and writes nothing. */

/** what the node answers for a tx: its trace, or its gas profile */
export type Answer = { trace: TraceResponse } | { profile: GasProfile };
type KeptMiss = { miss: "not_found" | "timeout" | "too_large" };
export type Kept<A extends Answer = Answer> = A | KeptMiss;

const KEY = `trace:v1:${process.env.VERCEL_ENV ?? "local"}:`;
/** how long each kind is kept, in seconds */
const TTL = {
  answer: 86_400,
  partial: 300,
  not_found: 5,
  timeout: 300,
  too_large: 7 * 86_400,
};
/** a trace larger than this, gzipped, is sent but not kept in Redis */
export const MAX_KEPT_GZ = 256 * 1024;
export const LOCAL_MAX_BYTES = 32 * 1024 * 1024;
/** a lock outlives the node's longest trace, like a gate slot */
export const LOCK_MS = 60_000;

const local = new Map<string, { kept: Kept; bytes: number; until: number }>();
let localBytes = 0;

const kindOf = (k: Kept): keyof typeof TTL => ("miss" in k ? k.miss : "trace" in k && !k.trace.prestate ? "partial" : "answer");

function remember(key: string, kept: Kept, bytes: number) {
  forget(key);
  local.set(key, { kept, bytes, until: Date.now() + TTL[kindOf(kept)] * 1000 });
  localBytes += bytes;
  for (const k of local.keys()) {
    if (localBytes <= LOCAL_MAX_BYTES) break;
    forget(k);
  }
}

function forget(key: string) {
  const e = local.get(key);
  if (!e) return;
  localBytes -= e.bytes;
  local.delete(key);
}

/** what is kept for a key; the key names the read, so the caller names its answer */
export async function readKept<A extends Answer>(key: string): Promise<Kept<A> | null> {
  const mine = local.get(key);
  if (mine && mine.until > Date.now()) {
    // the newest read goes last, so the oldest unread one leaves first
    local.delete(key);
    local.set(key, mine);
    return mine.kept as Kept<A>;
  }
  if (mine) forget(key);
  try {
    const r = await within(redis());
    const raw = r ? await within(r.get(KEY + key)) : null;
    if (!raw) return null;
    const json = gunzipSync(Buffer.from(raw, "base64")).toString("utf8");
    const kept = JSON.parse(json) as Kept<A>;
    remember(key, kept, json.length);
    return kept;
  } catch {
    return null;
  }
}

/** keeps an answer here and in Redis; json is the answer as JSON */
export async function keep(key: string, kept: Kept, json: string): Promise<void> {
  remember(key, kept, json.length);
  try {
    const gz = gzipSync(json);
    if (gz.length > MAX_KEPT_GZ) return;
    const r = await within(redis());
    if (r) await within(r.set(KEY + key, gz.toString("base64"), { EX: TTL[kindOf(kept)] }));
  } catch {
    /* this instance still has it */
  }
}

/** the right to read a tx from the node: an id to give back, "taken" when
 *  another instance reads it now, or null when Redis does not answer */
export async function lock(key: string, id: string): Promise<"held" | "taken" | null> {
  try {
    const r = await within(redis());
    if (!r) return null;
    return (await within(r.set(`${KEY}lock:${key}`, id, { NX: true, PX: LOCK_MS }))) === "OK" ? "held" : "taken";
  } catch {
    return null;
  }
}

/** whether some instance holds the lock of a tx now; null when Redis does not answer */
export async function locked(key: string): Promise<boolean | null> {
  try {
    const r = await within(redis());
    return r ? (await within(r.get(`${KEY}lock:${key}`))) !== null : null;
  } catch {
    return null;
  }
}

export async function unlock(key: string, id: string): Promise<void> {
  try {
    const r = await within(redis());
    if (r) await within(r.eval(RELEASE, { keys: [`${KEY}lock:${key}`], arguments: [id] }));
  } catch {
    /* the lock runs out */
  }
}
