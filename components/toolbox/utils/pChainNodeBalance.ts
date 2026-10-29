/**
 * P-Chain balance straight from an AvalancheGo node.
 *
 * The indexed Data API (Glacier) is the wrong source of truth for a wallet
 * balance: it can and does fall behind the chain. On 2026-07-28 the Fuji
 * P-Chain indexer stalled for ~24h, so the console showed a balance that
 * predated the user's last two imports while Core showed an atomic-memory
 * entry that an ImportTx had already consumed. Neither number matched the
 * node. The node is authoritative, so read it first and treat the indexer
 * as a fallback only.
 *
 * The node read is the Avalanche SDK's pChain.getBalance, which sums
 * platform.getUTXOs as platform.getBalance did (avalanchego deprecated
 * getBalance in v1.9.12, and the SDK stopped calling it in 0.1.4).
 */

import { createPChainClient } from '@avalanche-sdk/client';
import type { GetBalanceReturnType } from '@avalanche-sdk/client/methods/pChain';
import { avalanche, avalancheFuji } from 'viem/chains';

/** One budget for the whole read: for a large UTXO set the SDK reads several pages, up to 3 times. */
const READ_BUDGET_MS = 10_000;

/**
 * And at most 21 requests, retries included: platform.getStakingAssetID and 20 platform.getUTXOs pages, the bound of
 * the 20-page cap before the SDK. Anyone can send UTXOs to an address, and the SDK reads a set of more than one page
 * at least twice and stops on a page of fewer than 1,024, so a set of 10,240 UTXOs or more runs out of requests.
 */
const READ_BUDGET_REQUESTS = 21;

/** The node rejects a bech32 address without its chain prefix. */
function withPChainPrefix(address: string): string {
  return address.includes('-') ? address : `P-${address}`;
}

/**
 * The SDK's pChain.getBalance from the public node, within one budget of time
 * and requests: a stale balance is worse than a missing one, so a hung or slow
 * node must not hold the caller, and a large UTXO set must not cost unbounded
 * requests. The budget's signal aborts every request of the read, and the
 * caller gets the error when the budget runs out. `maxRequests` (21 by
 * default) sets the request budget. Throws on transport or RPC error.
 */
export async function getPChainNodeBalance(
  isTestnet: boolean,
  addresses: string[],
  maxRequests: number = READ_BUDGET_REQUESTS,
): Promise<GetBalanceReturnType> {
  const budget = new AbortController();
  // An AbortError: viem retries any other abort reason
  const stop = (why: string) => budget.abort(new DOMException(`P-Chain balance: ${why}`, 'AbortError'));
  const timer = setTimeout(() => stop('no answer from the node in time'), READ_BUDGET_MS);
  let requests = 0;
  try {
    const pChain = createPChainClient({
      chain: (isTestnet ? avalancheFuji : avalanche) as never,
      transport: {
        type: 'http',
        config: {
          fetchOptions: { signal: budget.signal },
          onFetchRequest: () => {
            if (++requests > maxRequests) stop(`more than ${maxRequests} requests`);
          },
        },
      },
    });
    const outOfBudget = new Promise<never>((_, reject) => {
      budget.signal.addEventListener('abort', () => reject(budget.signal.reason), { once: true });
    });
    return await Promise.race([pChain.getBalance({ addresses }), outOfBudget]);
  } finally {
    clearTimeout(timer);
    // Stops what the read still has in flight: when one request fails, the SDK's other requests would go on.
    budget.abort();
  }
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
  const { unlocked } = await getPChainNodeBalance(isTestnet, [withPChainPrefix(pChainAddress)]);
  return unlocked;
}
