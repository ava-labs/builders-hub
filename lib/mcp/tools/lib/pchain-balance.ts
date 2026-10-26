/**
 * The P-Chain balance of addresses for the MCP tools: the fields of
 * platform.getBalance (deprecated in AvalancheGo), summed from
 * platform.getUTXOs by the same rules (components/toolbox/utils/pChainNodeBalance.ts).
 * nAVAX amounts are decimal strings, like the node's JSON.
 */

import {
  AVAX_ASSET_ID,
  readPChainBalance,
  utxoPageParams,
  type LockSplit,
  type ReadUtxoPage,
} from '@/components/toolbox/utils/pChainNodeBalance';
import { avalancheRPC } from '../../rpc';
import type { Network } from '../../types';

export interface PChainBalanceJson {
  balance: string;
  unlocked: string;
  lockedStakeable: string;
  lockedNotStakeable: string;
  /** Asset ID to amount, for each asset with an amount in that state, as platform.getBalance gave them. */
  balances: Record<string, string>;
  unlockeds: Record<string, string>;
  lockedStakeables: Record<string, string>;
  lockedNotStakeables: Record<string, string>;
  utxoIDs: { txID: string; outputIndex: number }[];
  /** False when the addresses hold more UTXOs than one read gets: the amounts are then a lower bound. */
  complete: boolean;
}

/** The assets with an amount in `pick`, as decimal strings. */
function perAsset(byAsset: Record<string, LockSplit>, pick: (split: LockSplit) => bigint): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [assetID, split] of Object.entries(byAsset)) {
    const amount = pick(split);
    if (amount > 0n) out[assetID] = amount.toString();
  }
  return out;
}

export async function getPChainBalance(network: Network, addresses: readonly string[]): Promise<PChainBalanceJson> {
  const readPage: ReadUtxoPage = async (startIndex) =>
    (await avalancheRPC(network, 'pchain', 'platform.getUTXOs', utxoPageParams(addresses, startIndex))) as Awaited<
      ReturnType<ReadUtxoPage>
    >;
  const b = await readPChainBalance(readPage, AVAX_ASSET_ID[network]);
  return {
    balance: b.balance.toString(),
    unlocked: b.unlocked.toString(),
    lockedStakeable: b.lockedStakeable.toString(),
    lockedNotStakeable: b.lockedNotStakeable.toString(),
    balances: perAsset(b.byAsset, (s) => s.unlocked + s.lockedStakeable + s.lockedNotStakeable),
    unlockeds: perAsset(b.byAsset, (s) => s.unlocked),
    lockedStakeables: perAsset(b.byAsset, (s) => s.lockedStakeable),
    lockedNotStakeables: perAsset(b.byAsset, (s) => s.lockedNotStakeable),
    utxoIDs: b.utxoIDs,
    complete: b.complete,
  };
}
