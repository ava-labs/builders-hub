import { pchainPost } from '@/lib/pchain-rpc';

/* ACP-236 auto-renewed Primary Network validators. Their end time is the end
   of the current cycle, and the cycle renews while nextPeriod > 0. The stake
   ends at the end time only when the owner set the period to 0. Validators
   with a fixed duration have no nextPeriod. */

const PCHAIN_TIMEOUT_MS = 8000;

/** node ID -> nextPeriod in seconds, for the validators that have the field */
export type AutoRenewPeriods = Map<string, number>;

interface CurrentValidator {
  nodeID?: unknown;
  nextPeriod?: unknown;
}

/** Parse a platform.getCurrentValidators answer into the nextPeriod map. */
export function parseAutoRenewPeriods(json: unknown): AutoRenewPeriods {
  const validators = (json as { result?: { validators?: unknown } })?.result?.validators;
  if (!Array.isArray(validators)) throw new Error('getCurrentValidators: no validators in the answer');
  const periods: AutoRenewPeriods = new Map();
  for (const v of validators as CurrentValidator[]) {
    if (typeof v?.nodeID !== 'string' || v.nextPeriod === undefined || v.nextPeriod === null) continue;
    const seconds = Number(v.nextPeriod);
    if (Number.isFinite(seconds) && seconds >= 0) periods.set(v.nodeID, seconds);
  }
  return periods;
}

/**
 * Read the mainnet Primary Network validators once and return their nextPeriod
 * map. Give nodeIds to read only those validators. One JSON-RPC request.
 */
export async function fetchAutoRenewPeriods(nodeIds?: string[]): Promise<AutoRenewPeriods> {
  const res = await pchainPost(
    'mainnet',
    {
      jsonrpc: '2.0',
      id: 1,
      method: 'platform.getCurrentValidators',
      params: nodeIds ? { nodeIDs: nodeIds } : {},
    },
    PCHAIN_TIMEOUT_MS,
  );
  if (!res.ok) throw new Error(`getCurrentValidators returned ${res.status}`);
  const json = await res.json();
  if (json?.error) throw new Error(`getCurrentValidators: ${json.error.message ?? 'RPC error'}`);
  return parseAutoRenewPeriods(json);
}

/**
 * True when the node's end time is a real stake end, so expiry alerts and an
 * expiry date make sense. False for a node that auto-renews (nextPeriod > 0),
 * and false when the P-Chain read failed (periods is null): no "stake ends"
 * email without proof that the stake ends.
 */
export function stakeEndIsFinal(nodeId: string, periods: AutoRenewPeriods | null): boolean {
  if (!periods) return false;
  const nextPeriod = periods.get(nodeId);
  return nextPeriod === undefined || nextPeriod === 0;
}
