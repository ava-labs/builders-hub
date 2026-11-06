import { pchainPost } from '@/lib/pchain-rpc';
import type { CurrentValidator } from '@/lib/pchain-node';

/* ACP-236 auto-renewed Primary Network validators. Their end time is the end
   of the current cycle, and the cycle renews while nextPeriod > 0. The stake
   ends at the end time only when the owner set the period to 0. Validators
   with a fixed duration have no nextPeriod. */

const PCHAIN_TIMEOUT_MS = 8000;
const CACHE_TTL_MS = 60_000;

export interface AutoRenewPeriods {
  /** every node ID in the answer */
  listed: Set<string>;
  /** node ID -> nextPeriod in seconds, for the validators that have the field */
  nextPeriod: Map<string, number>;
}

/** Parse a platform.getCurrentValidators answer into the listed set and the nextPeriod map. */
export function parseAutoRenewPeriods(json: unknown): AutoRenewPeriods {
  const validators = (json as { result?: { validators?: unknown } })?.result?.validators;
  if (!Array.isArray(validators)) throw new Error('getCurrentValidators: no validators in the answer');
  const periods: AutoRenewPeriods = { listed: new Set(), nextPeriod: new Map() };
  for (const v of validators as Partial<Pick<CurrentValidator, 'nodeID' | 'nextPeriod'>>[]) {
    if (typeof v?.nodeID !== 'string') continue;
    periods.listed.add(v.nodeID);
    if (v.nextPeriod === undefined || v.nextPeriod === null) continue;
    const seconds = Number(v.nextPeriod);
    if (Number.isFinite(seconds) && seconds >= 0) periods.nextPeriod.set(v.nodeID, seconds);
  }
  return periods;
}

async function readAutoRenewPeriods(timeoutMs: number, attempts: number): Promise<AutoRenewPeriods> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const res = await pchainPost(
        'mainnet',
        { jsonrpc: '2.0', id: 1, method: 'platform.getCurrentValidators', params: {} },
        timeoutMs,
      );
      if (!res.ok) throw new Error(`getCurrentValidators returned ${res.status}`);
      const json = await res.json();
      if (json?.error) throw new Error(`getCurrentValidators: ${json.error.message ?? 'RPC error'}`);
      return parseAutoRenewPeriods(json);
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

// The last read of the mainnet map, shared by the alert API and the alert job.
let cache: { at: number; value: Promise<AutoRenewPeriods> } | null = null;

/**
 * The mainnet Primary Network nextPeriod map. A read younger than maxAgeMs
 * (default 60 s) is reused, and concurrent callers share one read. maxAgeMs 0
 * reads again and refreshes the cache. attempts: reads before it gives up.
 */
export function getAutoRenewPeriods(
  options: { maxAgeMs?: number; timeoutMs?: number; attempts?: number } = {},
): Promise<AutoRenewPeriods> {
  const { maxAgeMs = CACHE_TTL_MS, timeoutMs = PCHAIN_TIMEOUT_MS, attempts = 1 } = options;
  if (cache && Date.now() - cache.at < maxAgeMs) return cache.value;
  const value = readAutoRenewPeriods(timeoutMs, attempts);
  const entry = { at: Date.now(), value };
  cache = entry;
  value.catch(() => {
    if (cache === entry) cache = null;
  });
  return value;
}

/**
 * True when the node auto-renews (nextPeriod > 0). False when renewal is off
 * (nextPeriod 0) or the node has a fixed duration. Null when the read failed
 * (periods is null) or the node is not in the answer.
 */
export function stakeRenews(nodeId: string, periods: AutoRenewPeriods | null): boolean | null {
  if (!periods || !periods.listed.has(nodeId)) return null;
  return (periods.nextPeriod.get(nodeId) ?? 0) > 0;
}
