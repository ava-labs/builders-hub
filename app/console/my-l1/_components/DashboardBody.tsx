'use client';

import { useCallback, useEffect, useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMyL1s } from '@/hooks/useMyL1s';
import { useL1List, type L1ListItem } from '@/components/toolbox/stores/l1ListStore';
import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import { useLoadedOnce } from '@/components/console/loaded-once';
import { useL1Health } from '@/hooks/useL1Health';
import {
  metadataFromWalletItem,
  walletItemToCombined,
  type CombinedL1,
} from '../_lib/types';
import { HeroCard } from './HeroCard';
import { SwitchChainRail } from './SwitchChainRail';
import { L1Details } from './L1Details';
import { EmptyState, ErrorState, HeaderSkeleton } from './states';

export function DashboardBody() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { l1s: managedL1s, isLoading, error, refetch } = useMyL1s();
  const walletL1s = useL1List();
  const walletChainId = useWalletStore((s) => s.walletChainId);
  const isWalletTestnet = useWalletStore((s) => s.isTestnet);
  const { sawLoading } = useLoadedOnce(isLoading);

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
  // C-Chain (subnetId === primary network) flows through the same path as
  // any other wallet entry — it just renders with no setup checklist /
  // precompile section / node fleet, gated by `isPrimaryNetwork`.
  const walletByChainId = useMemo(() => {
    const map = new Map<number, L1ListItem>();
    walletL1s.forEach((w: L1ListItem) => {
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
      const key = byKey(w);
      if (byChainId.has(key)) return;
      byChainId.set(key, walletItemToCombined(w));
    });

    const userL1s = Array.from(byChainId.values());
    return walletChainId === 0
      ? userL1s
      : userL1s.filter((l1) => l1.isTestnet === isWalletTestnet);
  }, [managedL1s, walletL1s, walletByChainId, walletChainId, isWalletTestnet]);

  // URL-driven selection so refresh + back button work, and so wallet network
  // switches don't change which L1 the dashboard is viewing.
  const selectedChainParam = searchParams.get('chain');

  const selectedL1 = useMemo<CombinedL1 | null>(() => {
    if (combinedL1s.length === 0) return null;
    const firstActive = combinedL1s.find((l) => l.status === 'active');
    // Priority 1 — explicit URL param. Wins over wallet so refresh / back /
    // direct-link behavior is stable, and the user's manual switcher click
    // (which writes the URL) sticks even if their wallet is on another L1.
    if (selectedChainParam) {
      const match = combinedL1s.find(
        (l) => String(l.evmChainId) === selectedChainParam || l.subnetId === selectedChainParam,
      );
      if (match && (match.status === 'active' || !firstActive)) return match;
    }
    // Priority 2 — wallet-connected L1. If the user's wallet is on one of
    // their dashboard L1s, drop them on it directly. Skips C-Chain (and
    // any other chain not in the dashboard) since those don't appear in
    // the switcher. walletChainId === 0 means the wallet store hasn't
    // hydrated yet — fall through to the first-active default.
    if (walletChainId !== 0) {
      const walletMatch = combinedL1s.find(
        (l) => l.evmChainId === walletChainId && l.status === 'active',
      );
      if (walletMatch) return walletMatch;
    }
    // Priority 3 — first ACTIVE L1. Falling back to the very first entry
    // only when nothing is alive (in which case the page renders the
    // EmptyState instead of a detail view).
    return firstActive ?? combinedL1s[0];
  }, [combinedL1s, selectedChainParam, walletChainId]);

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
      // scroll: false so switching L1s while scrolled to (e.g.) Node fleet
      // doesn't yank the page back to the top — the user is still browsing
      // the same dashboard surface, just looking at a different chain.
      router.replace(`/console/my-l1?${next.toString()}`, { scroll: false });
    },
    [router, searchParams],
  );

  // Active L1s drive the switcher + detail view. Expired managed entries are
  // filtered out entirely — the dashboard only surfaces live chains.
  // Keep this hook above every early return so the dashboard has a stable
  // hook order across loading states.
  const activeL1s = useMemo(() => combinedL1s.filter((l) => l.status === 'active'), [combinedL1s]);

  // Single shared health probe — both the HeroCard pulse dot and the
  // L1Details StatsGrid read from this one subscription instead of each
  // mounting their own `useL1Health` (which would double the RPC poll).
  // Safe to call unconditionally; the hook returns `unknown` status when
  // `rpcUrl` is undefined.
  const health = useL1Health(selectedL1?.rpcUrl, selectedL1?.evmChainId ?? null);

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
    <motion.div
      className="space-y-6"
      initial={sawLoading ? { opacity: 0 } : false}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
    >
      {/* mode="wait" so the previous L1's cascade exits cleanly before the
          newly-selected L1 mounts in. Keyed by chainId/subnetId so picking
          a different L1 actually remounts (and re-fires the inner section
          cascade) — without the key, only props change and the new chain
          would pop in without animation. `initial={false}` skips the
          initial mount fade since the parent motion.div already handles
          the page-level skeleton-to-content fade. */}
      <AnimatePresence mode="wait" initial={false}>
        {selectedL1 && selectedL1.status === 'active' && (
          <motion.div
            key={
              selectedL1.evmChainId !== null
                ? `chain:${selectedL1.evmChainId}`
                : `subnet:${selectedL1.subnetId}`
            }
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="space-y-5"
          >
            <HeroCard
              l1={selectedL1}
              health={health}
              onRefresh={refetch}
              isRefreshing={isLoading}
            />
            <SwitchChainRail
              l1s={activeL1s}
              selected={selectedL1}
              onSelect={onSelect}
            />
            <L1Details
              l1={selectedL1}
              health={health}
              userActiveNodeTotal={userActiveNodeTotal}
              onRefetch={refetch}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
