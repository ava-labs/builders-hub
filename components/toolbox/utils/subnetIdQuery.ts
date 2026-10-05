// Add validator, change weight and remove validator can open on an L1 from the ?subnetId= query.
// Their stores persist the selected L1 (one store per network), so the query and the stored L1 can differ.
// These rules decide when the query sets the L1.

import type { L1ListItem } from '@/components/toolbox/stores/l1ListStore';
import { C_CHAIN_FUJI, C_CHAIN_MAINNET, findL1ByEvmChainId } from '@/lib/console/l1-dashboard';

export interface SubnetIdQueryResult {
  /** The L1 to set in the flow store. Null: do not change the store. */
  subnetId: string | null;
  /** Add this key to the done set, so that the query does not apply again. Null: add nothing. */
  doneKey: string | null;
}

/**
 * True when the wallet's chain is on the network that `isTestnet` names: that network's C-Chain, or an L1 in that
 * network's L1 list. WalletSync takes `isTestnet` from these chains. For another chain ID (or 0, no wallet),
 * `isTestnet` is a default or an older value. When `isTestnet` and the chain do not agree, a network write is still
 * in flight, and the network is not stable yet.
 */
export function walletOnNetwork(walletChainId: number, isTestnet: boolean, networkL1List: L1ListItem[]): boolean {
  if (walletChainId === C_CHAIN_FUJI) return isTestnet;
  if (walletChainId === C_CHAIN_MAINNET) return !isTestnet;
  return walletChainId > 0 && findL1ByEvmChainId(walletChainId, [networkL1List]) !== null;
}

/**
 * Decides what the ?subnetId= query does on one run of the page effect.
 * - The query waits until the wallet network is known and stable (`networkKnown`, see useSubnetIdQuery). With no
 *   wallet, the query also waits: these flows sign with the wallet, so the user connects one first.
 * - The query applies once per page mount and query value, on the first known network only. After that, the user's
 *   own pick in Select L1 stands. A link names an L1 of one network, so a switch to the other network does not write
 *   the L1 into the store of that network: that write would clear a flow that is in progress there.
 * - A query that is equal to the stored L1 keeps the stored flow, so a reload keeps its progress. When that flow is
 *   complete (`completed`: its Validator Manager completion step succeeded), the query sets the L1 again, which
 *   clears the flow: a My L1 link starts a new flow on the same L1.
 */
export function resolveSubnetIdQuery({
  query,
  stored,
  completed,
  networkKnown,
  done,
}: {
  query: string | null;
  stored: string;
  /** The flowCompleted value of the stored flow. */
  completed: boolean;
  networkKnown: boolean;
  /** The query values that applied in this mount. */
  done: ReadonlySet<string>;
}): SubnetIdQueryResult {
  const subnetId = query?.trim() ?? '';
  if (!subnetId || !networkKnown) return { subnetId: null, doneKey: null };
  // The key has no network: the query applies on the first known network, and never again after a network switch
  const doneKey = subnetId;
  if (done.has(doneKey)) return { subnetId: null, doneKey: null };
  const keepStoredFlow = subnetId === stored && !completed;
  return { subnetId: keepStoredFlow ? null : subnetId, doneKey };
}
