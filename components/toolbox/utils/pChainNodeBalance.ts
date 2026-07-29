/**
 * P-Chain balance straight from an AvalancheGo node.
 *
 * The indexed Data API (Glacier) is the wrong source of truth for a wallet
 * balance: it can and does fall behind the chain. On 2026-07-28 the Fuji
 * P-Chain indexer stalled for ~24h, so the console showed a balance that
 * predated the user's last two imports while Core showed an atomic-memory
 * entry that an ImportTx had already consumed. Neither number matched the
 * node. `platform.getBalance` is authoritative and cheap, so read it first
 * and treat the indexer as a fallback only.
 */

import { getPChainRpcUrl } from './avalancheEndpoints';

/** platform.getBalance result: nAVAX as decimal strings. */
interface PlatformGetBalanceResult {
  balance: string;
  unlocked: string;
  lockedStakeable: string;
  lockedNotStakeable: string;
}

/** The node rejects a bech32 address without its chain prefix. */
function withPChainPrefix(address: string): string {
  return address.includes('-') ? address : `P-${address}`;
}

/**
 * Spendable (unlocked, unstaked) nAVAX for a P-Chain address.
 *
 * Returns `unlocked` rather than `balance`: `balance` includes stakeable-locked
 * and platform-locked funds that can't pay a tx fee, which would let the UI
 * green-light a transaction the node then rejects for insufficient funds.
 *
 * Throws on transport or RPC error so the caller can fall back.
 */
export async function getPChainUnlockedNAvax(isTestnet: boolean, pChainAddress: string): Promise<bigint> {
  const response = await fetch(getPChainRpcUrl(isTestnet), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'platform.getBalance',
      params: { addresses: [withPChainPrefix(pChainAddress)] },
    }),
    // A stale balance is worse than a missing one, so don't let a hung node
    // hold the header's loading state open indefinitely.
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    throw new Error(`platform.getBalance failed: ${response.status} ${response.statusText}`);
  }

  const json = (await response.json()) as { result?: PlatformGetBalanceResult; error?: { message?: string } };
  if (json.error || !json.result?.unlocked) {
    throw new Error(`platform.getBalance error: ${json.error?.message ?? 'no result'}`);
  }

  return BigInt(json.result.unlocked);
}
