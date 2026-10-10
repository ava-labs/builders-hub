'use client';

import { useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import { getL1ListStore, type L1ListItem } from '@/components/toolbox/stores/l1ListStore';
import { resolveSubnetIdQuery, walletOnNetwork } from '@/components/toolbox/utils/subnetIdQuery';

/**
 * Sets a step flow's L1 from the ?subnetId= query. The query applies once per mount and value, on the first known
 * network only (see resolveSubnetIdQuery). So it does not undo the L1 that the user picks in Select L1, and a wallet
 * switch does not write it into the store of the other network.
 * `flowCompleted` is the stored flow's flowCompleted. When it is true, the query starts a new flow on the same L1.
 *
 * The query waits until the wallet network is known and stable, because the page's flow store follows isTestnet:
 * - walletChainConfirmed: WalletSync has read the wallet's live chain. Before that, a full reload can report wagmi's
 *   persisted chain (for a wallet on a Fuji L1, that can be the Mainnet C-Chain), and the query would clear a flow in
 *   the mainnet store.
 * - walletOnNetwork: isTestnet agrees with that chain. A Core client that WalletSync made for an older chain can set
 *   isTestnet after the live read. The query waits until the two agree again.
 */
export function useSubnetIdQuery(
  subnetIdL1: string,
  flowCompleted: boolean,
  setSubnetIdL1: (subnetId: string) => void,
): void {
  const query = useSearchParams().get('subnetId');
  const isTestnet = useWalletStore((s) => s.isTestnet);
  const walletChainId = useWalletStore((s) => s.walletChainId);
  const walletChainConfirmed = useWalletStore((s) => s.walletChainConfirmed);
  const testnetL1List = getL1ListStore(true)((s: { l1List: L1ListItem[] }) => s.l1List);
  const mainnetL1List = getL1ListStore(false)((s: { l1List: L1ListItem[] }) => s.l1List);
  const networkKnown =
    walletChainConfirmed && walletOnNetwork(walletChainId, isTestnet, isTestnet ? testnetL1List : mainnetL1List);
  const done = useRef(new Set<string>());

  useEffect(() => {
    const { subnetId, doneKey } = resolveSubnetIdQuery({
      query,
      stored: subnetIdL1,
      completed: flowCompleted,
      networkKnown,
      done: done.current,
    });
    if (doneKey) done.current.add(doneKey);
    if (subnetId) setSubnetIdL1(subnetId);
  }, [query, subnetIdL1, flowCompleted, networkKnown, setSubnetIdL1]);
}
