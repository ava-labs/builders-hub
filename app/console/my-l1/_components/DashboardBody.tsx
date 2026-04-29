'use client';

import { useCallback, useEffect, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMyL1s } from '@/hooks/useMyL1s';
import { useL1List, type L1ListItem } from '@/components/toolbox/stores/l1ListStore';
import {
  C_CHAIN_IDS,
  metadataFromWalletItem,
  walletItemToCombined,
  type CombinedL1,
} from '../_lib/types';
import { SwitcherBar } from './Switcher';
import { L1Details } from './L1Details';
import { EmptyState, ErrorState, HeaderSkeleton } from './states';

export function DashboardBody() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { l1s: managedL1s, isLoading, error, refetch } = useMyL1s();
  const walletL1s = useL1List();

  // Total active managed nodes across the user's account — drives the
  // "X/3 total" hint and disables the Provision button when at cap. Sum
  // is computed locally from the existing useMyL1s payload so we don't
  // need a separate /api/managed-testnet-nodes fetch.
  const userActiveNodeTotal = useMemo(
    () =>
      managedL1s.reduce(
        (acc, l) => acc + (l.nodes?.filter((n) => n.status === 'active').length ?? 0),
        0,
      ),
    [managedL1s],
  );

  // Index wallet entries by chainId so managed entries can borrow their
  // metadata fields (validator manager address, teleporter registry, etc.).
  const walletByChainId = useMemo(() => {
    const map = new Map<number, L1ListItem>();
    walletL1s.forEach((w: L1ListItem) => {
      if (C_CHAIN_IDS.has(w.evmChainId)) return;
      map.set(w.evmChainId, w);
    });
    return map;
  }, [walletL1s]);

  // Merge managed (server) + wallet (local store) L1s. Managed entries are
  // inserted first so they sort to the top of the switcher (Map iteration
  // order = insertion order). Wallet entries fill any gaps. Managed
  // entries that share an evmChainId with a wallet entry get enriched with
  // L1ListItem metadata (validator manager, teleporter, explorer URL, etc.)
  // so Setup Progress + the header explorer button work end-to-end.
  const combinedL1s = useMemo<CombinedL1[]>(() => {
    const byChainId = new Map<string, CombinedL1>();
    const byKey = (l1: { evmChainId: number | null; subnetId: string }) =>
      l1.evmChainId !== null ? `chain:${l1.evmChainId}` : `subnet:${l1.subnetId}`;

    managedL1s.forEach((m) => {
      const walletMatch = m.evmChainId !== null ? walletByChainId.get(m.evmChainId) : undefined;
      byChainId.set(byKey(m), {
        ...m,
        source: 'managed',
        ...(walletMatch ? metadataFromWalletItem(walletMatch) : {}),
      });
    });

    walletL1s.forEach((w: L1ListItem) => {
      if (C_CHAIN_IDS.has(w.evmChainId)) return;
      const key = byKey(w);
      if (byChainId.has(key)) return;
      byChainId.set(key, walletItemToCombined(w));
    });

    return Array.from(byChainId.values());
  }, [managedL1s, walletL1s, walletByChainId]);

  // URL-driven selection so refresh + back button work, and so wallet network
  // switches don't change which L1 the dashboard is viewing.
  const selectedChainParam = searchParams.get('chain');

  const selectedL1 = useMemo<CombinedL1 | null>(() => {
    if (combinedL1s.length === 0) return null;
    const firstActive = combinedL1s.find((l) => l.status === 'active');
    if (selectedChainParam) {
      const match = combinedL1s.find(
        (l) => String(l.evmChainId) === selectedChainParam || l.subnetId === selectedChainParam,
      );
      if (match && (match.status === 'active' || !firstActive)) return match;
    }
    // Default to the first ACTIVE L1 — falling back to the very first
    // entry only when nothing is alive (in which case the page renders
    // the EmptyState instead of a detail view).
    return firstActive ?? combinedL1s[0];
  }, [combinedL1s, selectedChainParam]);

  // If the selected L1 fell off the list (e.g. expired), point the URL at the
  // current first entry instead of leaving the user on a stale URL.
  useEffect(() => {
    if (!selectedL1 || !selectedChainParam) return;
    const matchesByChain = String(selectedL1.evmChainId) === selectedChainParam;
    const matchesBySubnet = selectedL1.subnetId === selectedChainParam;
    if (!matchesByChain && !matchesBySubnet) {
      const target = selectedL1.evmChainId !== null ? String(selectedL1.evmChainId) : selectedL1.subnetId;
      router.replace(`/console/my-l1?chain=${target}`);
    }
  }, [selectedL1, selectedChainParam, router]);

  const onSelect = useCallback(
    (l1: CombinedL1) => {
      const next = new URLSearchParams(searchParams.toString());
      const target = l1.evmChainId !== null ? String(l1.evmChainId) : l1.subnetId;
      next.set('chain', target);
      router.replace(`/console/my-l1?${next.toString()}`);
    },
    [router, searchParams],
  );

  // Active L1s drive the switcher + detail view. Expired managed entries are
  // filtered out entirely — the dashboard only surfaces live chains.
  // Keep this hook above every early return so the dashboard has a stable
  // hook order across loading states.
  const activeL1s = useMemo(() => combinedL1s.filter((l) => l.status === 'active'), [combinedL1s]);

  if (isLoading && combinedL1s.length === 0) {
    return (
      <div className="space-y-6">
        <HeaderSkeleton />
      </div>
    );
  }

  if (error && combinedL1s.length === 0) {
    return <ErrorState message={error} onRetry={refetch} />;
  }

  if (activeL1s.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className="space-y-6">
      <SwitcherBar
        l1s={activeL1s}
        selected={selectedL1?.status === 'active' ? selectedL1 : null}
        onSelect={onSelect}
        onRefresh={refetch}
      />
      {selectedL1 && selectedL1.status === 'active' && (
        <L1Details
          l1={selectedL1}
          userActiveNodeTotal={userActiveNodeTotal}
          onRefetch={refetch}
        />
      )}
    </div>
  );
}
