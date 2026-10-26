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
 * The node read is platform.getUTXOs, summed as platform.getBalance did
 * (lib/pchain-balance.ts): avalanchego deprecated getBalance in v1.9.12, and
 * ava-labs/avalanchego#6239 removes its client before the method goes.
 */

import { AVAX_ASSET_ID, fetchPChainRpc, readPChainBalance } from '@/lib/pchain-balance';
import { getPChainRpcUrl } from './avalancheEndpoints';

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
  // A stale balance is worse than a missing one, so don't let a hung node
  // hold the header's loading state open indefinitely. One 10 s budget
  // covers every page of the read.
  const rpc = fetchPChainRpc(getPChainRpcUrl(isTestnet), AbortSignal.timeout(10_000));
  const { unlocked } = await readPChainBalance(
    rpc,
    [withPChainPrefix(pChainAddress)],
    isTestnet ? AVAX_ASSET_ID.fuji : AVAX_ASSET_ID.mainnet,
  );
  return unlocked;
}
