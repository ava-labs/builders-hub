'use client';

import { useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import { resolveSubnetIdQuery } from '@/components/toolbox/utils/subnetIdQuery';

/**
 * Sets a step flow's L1 from the ?subnetId= query. The query applies once per mount, network and value
 * (see resolveSubnetIdQuery), so it does not undo the L1 that the user picks in Select L1.
 */
export function useSubnetIdQuery(subnetIdL1: string, setSubnetIdL1: (subnetId: string) => void): void {
  const query = useSearchParams().get('subnetId');
  const isTestnet = useWalletStore((s) => s.isTestnet);
  // WalletSync sets walletChainId, and isTestnet from that chain, when a wallet reports its chain. It sets 0 on
  // a disconnect. Before that, isTestnet is the mainnet default, not the user's network.
  const networkKnown = useWalletStore((s) => s.walletChainId > 0);
  const done = useRef(new Set<string>());

  useEffect(() => {
    const { subnetId, doneKey } = resolveSubnetIdQuery({
      query,
      stored: subnetIdL1,
      isTestnet,
      networkKnown,
      done: done.current,
    });
    if (doneKey) done.current.add(doneKey);
    if (subnetId) setSubnetIdL1(subnetId);
  }, [query, subnetIdL1, isTestnet, networkKnown, setSubnetIdL1]);
}
