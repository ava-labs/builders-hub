import "server-only";
import { createClient } from "redis";
import { randomUUID } from "node:crypto";
import { COMPILE_TIMEOUT_MS } from "./solc";

/* ------------------------------------------------------------------ */
/* Abuse controls.                                                     */
/*                                                                     */
/* Verification has to be open to anonymous callers — `hardhat verify` */
/* cannot log in — and a small request buys minutes of CPU. So the     */
/* danger is not an outage, it is a bill: the platform will happily    */
/* scale to meet an attacker.                                          */
/*                                                                     */
/* Per-caller quotas slow that down but cannot bound it, because IPs   */
/* are cheap. The global compile semaphore is what bounds it: however  */
/* many requests arrive, only a handful compile at once, so the worst  */
/* case degrades into a queue instead of a spending spree.             */
/*                                                                     */
/* All of this lives in Redis because per-instance counters mean       */
/* nothing on serverless, where an attacker simply lands on new        */
/* instances. When Redis is unreachable we fall back to per-instance   */
/* counting: weaker, but never unprotected and never offline.          */
/* ------------------------------------------------------------------ */

/** Concurrent compiles across every instance. Sized so a sustained
 *  attack costs tens of dollars a day rather than thousands. */
const MAX_CONCURRENT_COMPILES = 8;

/** A slot is abandoned if its holder dies mid-compile; reclaim after the
 *  compile could not possibly still be running. */
const SLOT_TTL_MS = COMPILE_TIMEOUT_MS + 60_000;

export const SUBMIT_QUOTA = { limit: 20, windowMs: 10 * 60 * 1000 };

/** Charged per attempt, not per failure: the work has to be paid for
 *  before it runs, or an attacker whose jobs never reach a verdict never
 *  gets counted. A success ends the sequence anyway, since the contract
 *  is then verified and further submissions short-circuit. */
export const ADDRESS_ATTEMPT_QUOTA = { limit: 8, windowMs: 60 * 60 * 1000 };

let redisClient: ReturnType<typeof createClient> | null = null;
let redisPromise: Promise<ReturnType<typeof createClient>> | null = null;

async function getRedis() {
  if (redisClient?.isOpen) return redisClient;
  if (redisPromise) return redisPromise;

  redisPromise = (async () => {
    const url = process.env.REDIS_URL;
    if (!url) throw new Error("REDIS_URL is not set");
    const client = createClient({ url });
    client.on("error", (error) => {
      console.error("[verification] redis error", error);
      redisClient = null;
      redisPromise = null;
    });
    await client.connect();
    redisClient = client;
    return client;
  })().catch((error) => {
    redisClient = null;
    redisPromise = null;
    throw error;
  });

  return redisPromise;
}

/* ------------------------------- quotas ------------------------------- */

const QUOTA_SCRIPT = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
end
return {count, redis.call('PTTL', KEYS[1])}
`;

const MAX_LOCAL_KEYS = 10_000;
const localCounters = new Map<string, { used: number; resetAt: number }>();

function consumeLocal(key: string, windowMs: number): { used: number; resetAt: number } {
  const now = Date.now();
  let entry = localCounters.get(key);
  if (!entry || entry.resetAt <= now) entry = { used: 0, resetAt: now + windowMs };
  entry.used += 1;
  if (!localCounters.has(key) && localCounters.size >= MAX_LOCAL_KEYS) {
    const oldest = localCounters.keys().next().value;
    if (oldest) localCounters.delete(oldest);
  }
  localCounters.set(key, entry);
  return entry;
}

export interface QuotaResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

/** Charge one unit against a rolling window. */
export async function consumeQuota(
  key: string,
  { limit, windowMs }: { limit: number; windowMs: number },
): Promise<QuotaResult> {
  const namespaced = `verify:quota:${key}`;
  try {
    const redis = await getRedis();
    const [used, ttlMs] = (await redis.eval(QUOTA_SCRIPT, {
      keys: [namespaced],
      arguments: [String(windowMs)],
    })) as [number, number];
    return {
      allowed: Number(used) <= limit,
      retryAfterSeconds: Math.max(1, Math.ceil(Math.max(0, Number(ttlMs)) / 1000)),
    };
  } catch {
    const fallback = consumeLocal(namespaced, windowMs);
    return {
      allowed: fallback.used <= limit,
      retryAfterSeconds: Math.max(1, Math.ceil((fallback.resetAt - Date.now()) / 1000)),
    };
  }
}

/* ------------------------------ semaphore ----------------------------- */

/*
 * A sorted set of in-flight compiles scored by start time. Expiring by
 * score means a crashed holder releases its own slot without anyone
 * having to notice it died — which a plain counter could not do.
 */
const ACQUIRE_SCRIPT = `
redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', ARGV[1])
if redis.call('ZCARD', KEYS[1]) >= tonumber(ARGV[2]) then
  return 0
end
redis.call('ZADD', KEYS[1], ARGV[3], ARGV[4])
redis.call('PEXPIRE', KEYS[1], ARGV[5])
return 1
`;

const SLOT_KEY = "verify:compile-slots";

let localSlots = 0;

export interface CompileSlot {
  release: () => Promise<void>;
}

/** Take one of the global compile slots, or null when they are all busy. */
export async function acquireCompileSlot(): Promise<CompileSlot | null> {
  const token = randomUUID();
  const now = Date.now();

  try {
    const redis = await getRedis();
    const granted = (await redis.eval(ACQUIRE_SCRIPT, {
      keys: [SLOT_KEY],
      arguments: [
        String(now - SLOT_TTL_MS),
        String(MAX_CONCURRENT_COMPILES),
        String(now),
        token,
        String(SLOT_TTL_MS * 2),
      ],
    })) as number;

    if (Number(granted) !== 1) return null;
    return {
      release: async () => {
        try {
          const client = await getRedis();
          await client.zRem(SLOT_KEY, token);
        } catch {
          /* the score-based sweep reclaims it */
        }
      },
    };
  } catch {
    // Redis down: fall back to limiting this instance. Less precise, but
    // an instance that cannot count is worse than one that counts locally.
    if (localSlots >= MAX_CONCURRENT_COMPILES) return null;
    localSlots += 1;
    let released = false;
    return {
      release: async () => {
        if (released) return;
        released = true;
        localSlots = Math.max(0, localSlots - 1);
      },
    };
  }
}

export const compileConcurrency = MAX_CONCURRENT_COMPILES;
