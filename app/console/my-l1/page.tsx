'use client';

import { useEffect, useMemo, useState, useCallback, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Activity,
  ArrowUpDown,
  BarChart3,
  Blocks,
  Check,
  ChevronRight,
  Circle,
  CheckCircle2,
  Copy,
  Clock,
  Fuel,
  Layers,
  MessagesSquare,
  RefreshCw,
  Settings,
  Timer,
  Trash2,
  Users,
  Wallet,
} from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { CheckRequirements } from '@/components/toolbox/components/CheckRequirements';
import { WalletRequirementsConfigKey } from '@/components/toolbox/hooks/useWalletRequirements';
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard';
import { useMyL1s, type MyL1 } from '@/hooks/useMyL1s';
import { useL1Health, type L1HealthState } from '@/hooks/useL1Health';
import { useL1ValidatorCount, type L1ValidatorCountState } from '@/hooks/useL1ValidatorCount';
import { useL1List, type L1ListItem } from '@/components/toolbox/stores/l1ListStore';
import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import { useWalletSwitch } from '@/components/toolbox/hooks/useWalletSwitch';
import { useModalTrigger } from '@/components/toolbox/hooks/useModal';
import { ExplorerMenu } from '@/components/console/ExplorerMenu';
import { toast } from '@/lib/toast';

// C-Chain (Fuji + Mainnet) lives in the wallet's l1List as a sentinel for
// the primary network; it's not an L1 in this dashboard's sense, so we strip
// it before merging with managed entries.
const C_CHAIN_IDS = new Set([43113, 43114]);

// Combined view across both sources: server-backed NodeRegistration rows
// (managed) and the wallet's local l1ListStore (wallet-only). Managed
// entries take precedence on collision but get enriched with the wallet's
// L1ListItem metadata when available (validator manager, teleporter, etc.)
// so Setup Progress can reflect what's actually deployed.
type CombinedL1 = {
  source: 'managed' | 'wallet';
  /** 'active' for live L1s; 'expired' for spun-down managed entries that
   *  the API still surfaces so users can find their past chain. Wallet
   *  entries are always 'active' from the wallet's perspective. */
  status: 'active' | 'expired';
  subnetId: string;
  blockchainId: string;
  evmChainId: number | null;
  chainName: string;
  rpcUrl: string;
  isTestnet: boolean;
  // Present only on managed L1s — wallet-only entries don't have a TTL or
  // associated node fleet because the user added them by RPC URL.
  expiresAt?: string;
  firstSeenAt?: string;
  lastSeenAt?: string;
  nodes?: MyL1['nodes'];
  // L1ListItem-derived metadata (populated by Quick L1 success or manual
  // Add Chain). Used to drive Setup Progress checks + display niceties.
  validatorManagerAddress?: string;
  teleporterRegistryAddress?: string;
  wrappedTokenAddress?: string;
  coinName?: string;
  logoUrl?: string;
  explorerUrl?: string;
  hasBuilderHubFaucet?: boolean;
  externalFaucetUrl?: string;
};

function MyL1DashboardInner() {
  return (
    <CheckRequirements toolRequirements={[WalletRequirementsConfigKey.WalletConnected]}>
      <DashboardBody />
    </CheckRequirements>
  );
}

export default function MyL1DashboardPage() {
  // useSearchParams requires Suspense in Next 15+ for static-export safety.
  return (
    <Suspense fallback={<HeaderSkeleton />}>
      <MyL1DashboardInner />
    </Suspense>
  );
}

function DashboardBody() {
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
    // entry only when nothing is alive (in which case the page renders the
    // NoActiveL1sNote and the Past L1s section instead of a detail view).
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
  // surfaced separately at the bottom so users can find a past chain
  // without confusing the live-data UI. Keep these hooks above every early
  // return so the dashboard has a stable hook order across loading states.
  const activeL1s = useMemo(() => combinedL1s.filter((l) => l.status === 'active'), [combinedL1s]);
  const expiredL1s = useMemo(() => combinedL1s.filter((l) => l.status === 'expired'), [combinedL1s]);

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

  if (activeL1s.length === 0 && expiredL1s.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className="space-y-6">
      {activeL1s.length > 0 ? (
        <>
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
        </>
      ) : (
        <NoActiveL1sNote onRefresh={refetch} />
      )}
      {expiredL1s.length > 0 && <PastL1sSection l1s={expiredL1s} />}
    </div>
  );
}

function NoActiveL1sNote({ onRefresh }: { onRefresh: () => void }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">My L1 Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            No active L1s right now — your past chains are listed below for reference.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onRefresh}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Link href="/console/create-l1">
            <Button size="sm">
              <Layers className="w-4 h-4 mr-2" />
              Create L1
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

// Past L1s: managed NodeRegistrations whose nodes have all expired or been
// terminated. We still surface them so users can find an old chain by name
// after the 3-day TTL kicks in. There's no live data to show — the chain
// itself is gone — so the row is a compact summary + Recreate CTA only.
function PastL1sSection({ l1s }: { l1s: CombinedL1[] }) {
  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Past L1s
        </h3>
        <p className="text-xs text-muted-foreground/70">
          These managed L1s have spun down. Their RPC endpoints are no longer responsive — recreate
          them with the Quick L1 wizard if you want to spin one up again.
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {l1s.map((l1) => (
          <PastL1Card key={l1.subnetId} l1={l1} />
        ))}
      </div>
    </div>
  );
}

function PastL1Card({ l1 }: { l1: CombinedL1 }) {
  const created = l1.firstSeenAt ? new Date(l1.firstSeenAt) : null;
  const expired = l1.expiresAt ? new Date(l1.expiresAt) : null;
  return (
    <div className="rounded-lg border border-border bg-muted/20 p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="font-medium text-foreground truncate">{l1.chainName}</h4>
            <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-600 dark:text-zinc-400">
              Spun down
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            {l1.nodes?.length ?? 0} node{(l1.nodes?.length ?? 0) === 1 ? '' : 's'} ·{' '}
            {l1.evmChainId ?? `Subnet ${l1.subnetId.slice(0, 6)}…`}
          </p>
        </div>
      </div>
      <div className="text-xs text-muted-foreground space-y-0.5">
        {created && <div>Created {created.toLocaleString()}</div>}
        {expired && <div>Spun down {expired.toLocaleString()}</div>}
      </div>
      <Link href="/console/create-l1" className="self-start">
        <Button variant="outline" size="sm">
          <Layers className="w-3.5 h-3.5 mr-2" />
          Recreate
        </Button>
      </Link>
    </div>
  );
}

function walletItemToCombined(w: L1ListItem): CombinedL1 {
  return {
    source: 'wallet',
    status: 'active',
    subnetId: w.subnetId,
    blockchainId: w.id,
    evmChainId: w.evmChainId,
    chainName: w.name,
    rpcUrl: w.rpcUrl,
    isTestnet: w.isTestnet,
    ...metadataFromWalletItem(w),
  };
}

// Extract just the metadata fields from a wallet L1ListItem. Empty-string
// addresses (the Quick L1 placeholder for "not deployed yet") map to
// undefined so Setup Progress treats them as missing.
function metadataFromWalletItem(w: L1ListItem) {
  const optional = (v: string | undefined) => (v && v.length > 0 ? v : undefined);
  return {
    validatorManagerAddress: optional(w.validatorManagerAddress),
    teleporterRegistryAddress: optional(w.wellKnownTeleporterRegistryAddress),
    wrappedTokenAddress: optional(w.wrappedTokenAddress),
    coinName: w.coinName,
    logoUrl: optional(w.logoUrl),
    explorerUrl: optional(w.explorerUrl),
    hasBuilderHubFaucet: w.hasBuilderHubFaucet,
    externalFaucetUrl: optional(w.externalFaucetUrl),
  };
}

// ---------------------------------------------------------------------------
// Switcher
// ---------------------------------------------------------------------------
function SwitcherBar({
  l1s,
  selected,
  onSelect,
  onRefresh,
}: {
  l1s: CombinedL1[];
  selected: CombinedL1 | null;
  onSelect: (l1: CombinedL1) => void;
  onRefresh: () => void;
}) {
  const managed = l1s.filter((l) => l.source === 'managed');
  const wallet = l1s.filter((l) => l.source === 'wallet');

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">My L1 Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            {managed.length} Builder Hub-managed · {wallet.length} added to wallet
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onRefresh}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Link href="/console/create-l1">
            <Button size="sm">
              <Layers className="w-4 h-4 mr-2" />
              Create L1
            </Button>
          </Link>
        </div>
      </div>
      {managed.length > 0 && (
        <SwitcherSection
          title="Builder Hub-managed"
          subtitle="Provisioned via Quick L1 — managed nodes auto-expire after 3 days."
          l1s={managed}
          selected={selected}
          onSelect={onSelect}
        />
      )}
      {wallet.length > 0 && (
        <SwitcherSection
          title="Added to your wallet"
          subtitle="Networks added via the wallet's chain selector. No managed nodes attached."
          l1s={wallet}
          selected={selected}
          onSelect={onSelect}
        />
      )}
    </div>
  );
}

function SwitcherSection({
  title,
  subtitle,
  l1s,
  selected,
  onSelect,
}: {
  title: string;
  subtitle: string;
  l1s: CombinedL1[];
  selected: CombinedL1 | null;
  onSelect: (l1: CombinedL1) => void;
}) {
  // The wallet's current chain — used to render a small "Wallet here"
  // pulsing dot on the matching pill so users can see which L1 their
  // signer is pointed at without leaving the dashboard.
  const walletChainId = useWalletStore((s) => s.walletChainId);

  return (
    <div className="space-y-2">
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </h3>
        <p className="text-xs text-muted-foreground/70">{subtitle}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {l1s.map((l1) => {
          const key = l1.evmChainId !== null ? `chain:${l1.evmChainId}` : `subnet:${l1.subnetId}`;
          const isActive =
            selected !== null &&
            (selected.evmChainId === l1.evmChainId && selected.evmChainId !== null
              ? true
              : selected.subnetId === l1.subnetId);
          const walletIsHere = l1.evmChainId !== null && walletChainId === l1.evmChainId;
          return (
            <button
              key={key}
              onClick={() => onSelect(l1)}
              className={`group flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-all ${
                isActive
                  ? 'border-primary bg-primary/10 text-foreground'
                  : 'border-border bg-card hover:border-foreground/30 text-muted-foreground hover:text-foreground'
              }`}
            >
              {walletIsHere && (
                <span
                  className="relative flex w-2 h-2"
                  title="Your wallet is currently on this L1"
                >
                  <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75 animate-ping" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
              )}
              <span className="font-medium">{l1.chainName}</span>
              <span className="text-xs opacity-60">
                {l1.evmChainId ?? l1.subnetId.slice(0, 6)}
              </span>
              {l1.source === 'managed' && l1.expiresAt && <ExpiryPill expiresAt={l1.expiresAt} />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ExpiryPill({ expiresAt }: { expiresAt: string }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  const ms = new Date(expiresAt).getTime() - now;
  if (ms <= 0) {
    return (
      <span className="ml-1 inline-flex items-center gap-1 rounded-full bg-red-100 dark:bg-red-900/30 px-1.5 py-0.5 text-[10px] text-red-700 dark:text-red-400">
        <Clock className="w-2.5 h-2.5" />
        expired
      </span>
    );
  }
  const totalHours = Math.floor(ms / 3_600_000);
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  const label = days > 0 ? `${days}d ${hours}h` : `${hours}h`;
  const tone =
    totalHours < 6
      ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
      : 'bg-muted text-muted-foreground';
  return (
    <span className={`ml-1 inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] ${tone}`}>
      <Clock className="w-2.5 h-2.5" />
      {label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// L1 Details
// ---------------------------------------------------------------------------
function L1Details({
  l1,
  userActiveNodeTotal,
  onRefetch,
}: {
  l1: CombinedL1;
  userActiveNodeTotal: number;
  onRefetch: () => void;
}) {
  // Live RPC probe — block height, age, gas price refreshed every 30s. Not
  // surfaced as a coloured "degraded/live" pill anywhere; just descriptive
  // metrics so the page doesn't pretend to know more than it does.
  const health = useL1Health(l1.rpcUrl, l1.evmChainId);
  const validators = useL1ValidatorCount(l1.subnetId, l1.isTestnet);

  return (
    <div className="space-y-6">
      <DetailHeader l1={l1} />
      <WalletNetworkBanner l1={l1} />
      <StatsGrid l1={l1} health={health} validators={validators} />
      {l1.source === 'managed' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <SetupProgressCard l1={l1} />
          <QuickActionsCard l1={l1} />
        </div>
      )}
      {l1.source === 'wallet' && <WalletOnlyActions l1={l1} />}
      <NetworkDetailsCard l1={l1} />
      {l1.source === 'managed' && l1.nodes && l1.nodes.length > 0 && (
        <NodeListCard l1={l1} userActiveTotal={userActiveNodeTotal} onRefetch={onRefetch} />
      )}
    </div>
  );
}

// Renders a one-line nudge when the wallet isn't pointed at this L1.
// Two paths:
//   - L1 IS in the wallet's l1List but on a different chainId → Switch
//   - L1 is NOT in the wallet's l1List at all → Add to Wallet (prefills
//     AddChainModal with rpcUrl + chainName so the user can confirm)
// Hidden when the wallet is on the right chain or has no chainId yet.
function WalletNetworkBanner({ l1 }: { l1: CombinedL1 }) {
  const walletChainId = useWalletStore((s) => s.walletChainId);
  const walletL1s = useL1List();
  const { safelySwitch } = useWalletSwitch();
  const { openModal: openAddChainModal } = useModalTrigger<{ success: boolean }>();
  const [isSwitching, setIsSwitching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Skip when we don't know the chainId yet, the wallet is already on it,
  // or the wallet is still hydrating (chainId === 0).
  if (l1.evmChainId === null || walletChainId === 0 || walletChainId === l1.evmChainId) {
    return null;
  }

  const isInWallet = walletL1s.some((w: L1ListItem) => w.evmChainId === l1.evmChainId);

  const handleSwitch = async () => {
    if (l1.evmChainId === null) return;
    setIsSwitching(true);
    setError(null);
    try {
      await safelySwitch(l1.evmChainId, l1.isTestnet);
      toast.success(`Switched to ${l1.chainName}`, `Wallet now on chain ${l1.evmChainId}.`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to switch network';
      setError(msg);
      toast.error('Network switch failed', msg);
    } finally {
      setIsSwitching(false);
    }
  };

  const handleAddToWallet = async () => {
    setError(null);
    try {
      await openAddChainModal({
        rpcUrl: l1.rpcUrl,
        chainName: l1.chainName,
        coinName: l1.coinName ?? '',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to open Add Chain dialog');
    }
  };

  return (
    <div className="rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-900/10 px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div className="text-sm">
        {isInWallet ? (
          <>
            <span className="font-medium text-amber-900 dark:text-amber-200">
              Wallet on a different chain.
            </span>{' '}
            <span className="text-amber-800/80 dark:text-amber-200/70">
              Switch to <strong>{l1.chainName}</strong> ({l1.evmChainId}) to interact with this
              L1.
            </span>
          </>
        ) : (
          <>
            <span className="font-medium text-amber-900 dark:text-amber-200">
              Not in your wallet yet.
            </span>{' '}
            <span className="text-amber-800/80 dark:text-amber-200/70">
              Add <strong>{l1.chainName}</strong> ({l1.evmChainId}) to your wallet so you can sign
              transactions on it.
            </span>
          </>
        )}
        {error && (
          <span className="block mt-1 text-xs text-red-600 dark:text-red-400">{error}</span>
        )}
      </div>
      {isInWallet ? (
        <Button onClick={handleSwitch} disabled={isSwitching} size="sm">
          {isSwitching ? 'Switching…' : 'Switch network'}
        </Button>
      ) : (
        <Button onClick={handleAddToWallet} size="sm">
          Add to wallet
        </Button>
      )}
    </div>
  );
}

// Reduced detail view for wallet-only L1s — no managed-node fleet to show, so
// surface the most useful next-step actions instead. Reuses the same
// QuickActionTile as managed L1s for consistency; faucet target picks
// external URL (Echo / Dispatch / Dexalot, etc.) when set.
function WalletOnlyActions({ l1 }: { l1: CombinedL1 }) {
  const actions: QuickAction[] = [
    {
      icon: Users,
      title: 'Add Validator',
      description: 'Register a new validator.',
      href: '/console/permissioned-l1s/add-validator',
    },
    {
      icon: BarChart3,
      title: 'Validator Set',
      description: 'View the current validator set.',
      href: '/console/layer-1/validator-set',
    },
    {
      icon: Settings,
      title: 'Fee Parameters',
      description: 'Configure gas, fees.',
      href: '/console/l1-tokenomics/fee-manager',
    },
    {
      icon: MessagesSquare,
      title: 'Configure ICM',
      description: 'Set up cross-chain messaging.',
      href: '/console/icm/setup',
    },
    {
      icon: ArrowUpDown,
      title: 'Setup Bridge',
      description: 'Enable token transfers.',
      href: '/console/ictt/setup',
    },
    faucetAction(l1),
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Quick Actions</CardTitle>
        <CardDescription>
          This L1 was added to your wallet directly (not via Quick L1). Manage it through these
          tools.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {actions.map((a) => (
            <QuickActionTile key={a.title} action={a} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function DetailHeader({ l1 }: { l1: CombinedL1 }) {
  const nodeCount = l1.nodes?.length ?? 0;
  // Show wallet balance only when the wallet is currently connected to this
  // L1 — otherwise the cached number in the store may be from a different
  // chain and would mislead. Reading via a selector to avoid re-rendering
  // when unrelated balances change.
  const walletChainId = useWalletStore((s) => s.walletChainId);
  const balance = useWalletStore((s) =>
    l1.evmChainId !== null && walletChainId === l1.evmChainId
      ? s.balances.l1Chains[String(l1.evmChainId)] ?? null
      : null,
  );
  const isWalletOnThisL1 = l1.evmChainId !== null && walletChainId === l1.evmChainId;

  return (
    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
      <div className="flex items-start gap-3 min-w-0">
        {l1.logoUrl && (
          <img
            src={l1.logoUrl}
            alt={l1.chainName}
            className="w-10 h-10 rounded-lg object-contain bg-muted p-1 shrink-0"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
        )}
        <div className="min-w-0">
          <h2 className="text-xl font-semibold text-foreground truncate">{l1.chainName}</h2>
          <p className="text-sm text-muted-foreground">
            Chain ID: {l1.evmChainId ?? '—'} · {l1.isTestnet ? 'Testnet' : 'Mainnet'}
            {l1.source === 'managed' && (
              <>
                {' · '}
                {nodeCount} managed node{nodeCount === 1 ? '' : 's'}
              </>
            )}
            {l1.source === 'wallet' && ' · Added to wallet'}
            {l1.coinName && (
              <>
                {' · '}
                {l1.coinName}
              </>
            )}
          </p>
          {isWalletOnThisL1 && balance !== null && (
            <p className="text-sm text-foreground mt-1">
              <span className="text-muted-foreground">Your balance:</span>{' '}
              <span className="font-mono">
                {balance.toFixed(4)} {l1.coinName ?? ''}
              </span>
            </p>
          )}
        </div>
      </div>
      <div className="flex flex-wrap gap-2 shrink-0">
        <Link href={`/console/my-l1/stats/${l1.evmChainId ?? l1.subnetId}`}>
          <Button variant="outline" size="sm">
            <Activity className="w-4 h-4 mr-2" />
            View Stats
          </Button>
        </Link>
        <ExplorerMenu
          evmChainId={l1.evmChainId}
          isTestnet={l1.isTestnet}
          customExplorerUrl={l1.explorerUrl}
        />
        <CopyChainConfigButton l1={l1} />
      </div>
    </div>
  );
}

function StatsGrid({
  l1,
  health,
  validators,
}: {
  l1: CombinedL1;
  health: L1HealthState;
  validators: L1ValidatorCountState;
}) {
  // Block, block-time, gas price come from the live RPC probe. The fourth
  // card prefers Active validators (Glacier) over managed-node count, since
  // active validators is the universally-meaningful signal across L1s and
  // the managed-node count is already visible in the header subtitle.
  const blockValue =
    health.blockNumber !== null ? `#${health.blockNumber.toString()}` : health.isLoading ? '…' : '—';
  const blockSub =
    health.blockAgeSec !== null
      ? `${health.blockAgeSec}s ago`
      : health.status === 'offline'
        ? 'RPC unreachable'
        : 'Pinging…';

  const blockTimeValue =
    health.blockTimeSec !== null ? `${health.blockTimeSec}s` : health.isLoading ? '…' : '—';

  const gasValue = health.gasPriceEth !== null ? formatGasPrice(health.gasPriceEth) : '—';

  // Validator count from Glacier when available, fall back to managed-node
  // count for managed L1s (still useful when Glacier hasn't indexed the
  // subnet yet), or the raw EVM chain ID for wallet-only entries on Glacier
  // misses.
  const fourthCard = (() => {
    if (validators.count !== null) {
      return (
        <StatCard
          icon={Users}
          label="Active validators"
          value={String(validators.count)}
          subValue={`Subnet ${l1.subnetId.slice(0, 6)}…`}
        />
      );
    }
    if (l1.source === 'managed' && l1.nodes) {
      const active = l1.nodes.filter((n) => n.status === 'active').length;
      return (
        <StatCard
          icon={Users}
          label="Managed nodes"
          value={String(l1.nodes.length)}
          subValue={
            l1.expiresAt
              ? `${active} active · expires ${formatRelativeFromNow(l1.expiresAt)}`
              : `${active} active`
          }
        />
      );
    }
    return (
      <StatCard
        icon={Wallet}
        label="EVM chain ID"
        value={l1.evmChainId !== null ? String(l1.evmChainId) : '—'}
        subValue={validators.isLoading ? 'Loading validators…' : 'Added to wallet'}
      />
    );
  })();

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard icon={Blocks} label="Latest block" value={blockValue} subValue={blockSub} />
      <StatCard
        icon={Timer}
        label="Block time"
        value={blockTimeValue}
        subValue={blockTimeValue === '—' ? 'Unavailable' : 'Last interval'}
      />
      <StatCard icon={Fuel} label="Gas price" value={gasValue} subValue="From eth_gasPrice" />
      {fourthCard}
    </div>
  );
}

// Format gas price in the most informative unit. eth_gasPrice returns wei;
// `formatEther` gives the value in eth (= 1 unit of native). Reformat to
// nAVAX when sub-microscopic so users can read it without scientific notation.
function formatGasPrice(eth: string): string {
  const num = Number(eth);
  if (!Number.isFinite(num) || num === 0) return '—';
  if (num < 1e-9) {
    // Fewer than 1 navax-ish; show in wei.
    const wei = Math.round(num * 1e18);
    return `${wei} wei`;
  }
  if (num < 1e-6) {
    const navax = (num * 1e9).toFixed(2);
    return `${navax} nAVAX`;
  }
  return `${num.toFixed(6)} AVAX`;
}

// Clean neutral StatCard — the dashboard's at-a-glance cards rely on
// typography + icons for differentiation, not color. The brand accent is
// reserved for the chart page (where it actually carries data) so the
// dashboard reads as a quiet hub instead of a noisy color wheel.
function StatCard({
  icon: Icon,
  label,
  value,
  subValue,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  subValue?: string;
}) {
  return (
    <Card className="py-4">
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-muted">
            <Icon className="w-5 h-5 text-muted-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-lg font-semibold text-foreground truncate" title={value}>
              {value}
            </p>
            {subValue && <p className="text-xs text-muted-foreground truncate">{subValue}</p>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function SetupProgressCard({ l1 }: { l1: CombinedL1 }) {
  // Steps are driven by what we actually know:
  //   1. L1 created               → true if we've got a managed entry
  //   2. Managed node provisioned → at least one active node
  //   3. Validator Manager        → wallet's L1ListItem has the address set
  //   4. ICM (Teleporter Registry)→ wallet's L1ListItem has the address set
  //   5. Token bridge             → wrappedTokenAddress set
  // All metadata-driven checks come from the wallet L1ListItem, populated by
  // Quick L1 success or manual chain-add. Missing wallet entries fall back
  // to "unknown / not deployed".
  const hasNode = (l1.nodes ?? []).some((n) => n.status === 'active');
  const hasValidatorManager = !!l1.validatorManagerAddress;
  const hasIcm = !!l1.teleporterRegistryAddress;
  const hasBridge = !!l1.wrappedTokenAddress;

  const steps = [
    { label: 'L1 created', completed: true, href: '/console/create-l1' },
    {
      label: 'Managed node provisioned',
      completed: hasNode,
      href: '/console/testnet-infra/nodes',
    },
    {
      label: 'Validator Manager configured',
      completed: hasValidatorManager,
      href: '/console/permissioned-l1s/validator-manager-setup',
    },
    {
      label: 'Interchain Messaging (ICM)',
      completed: hasIcm,
      href: '/console/icm/setup',
    },
    {
      label: 'Token Bridge',
      completed: hasBridge,
      href: '/console/ictt/setup',
    },
  ];
  const done = steps.filter((s) => s.completed).length;
  const pct = Math.round((done / steps.length) * 100);

  return (
    <Card className="lg:col-span-1">
      <CardHeader>
        <CardTitle className="text-lg">Setup Progress</CardTitle>
        <CardDescription>Complete these steps to fully configure your L1</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-4">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-muted-foreground">Progress</span>
            <span className="font-medium">{pct}%</span>
          </div>
          <Progress value={pct} className="h-2" />
        </div>
        <div className="space-y-1">
          {steps.map((s) => (
            <Link key={s.label} href={s.href} className="group">
              <div className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-muted/50 transition-colors">
                {s.completed ? (
                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                ) : (
                  <Circle className="w-5 h-5 text-muted-foreground/50" />
                )}
                <span
                  className={`flex-1 text-sm ${
                    s.completed ? 'text-muted-foreground' : 'text-foreground font-medium'
                  }`}
                >
                  {s.label}
                </span>
                <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function QuickActionsCard({ l1 }: { l1: CombinedL1 }) {
  return (
    <Card className="lg:col-span-2">
      <CardHeader>
        <CardTitle className="text-lg">Quick Actions</CardTitle>
        <CardDescription>Common tasks for managing your L1</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {buildQuickActions(l1).map((a) => (
            <QuickActionTile key={a.title} action={a} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

interface QuickAction {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  href: string;
  external?: boolean;
}

function buildQuickActions(l1: CombinedL1): QuickAction[] {
  return [
    {
      icon: Users,
      title: 'Add Validator',
      description: 'Register a new validator to your L1.',
      href: '/console/permissioned-l1s/add-validator',
    },
    {
      icon: ArrowUpDown,
      title: 'Setup Bridge',
      description: 'Enable token transfers to other chains.',
      href: '/console/ictt/setup',
    },
    {
      icon: MessagesSquare,
      title: 'Configure ICM',
      description: 'Set up cross-chain messaging.',
      href: '/console/icm/setup',
    },
    {
      icon: BarChart3,
      title: 'Validator Set',
      description: 'View the current validator set.',
      href: '/console/layer-1/validator-set',
    },
    {
      icon: Settings,
      title: 'Fee Parameters',
      description: 'Configure gas, fees, and permissions.',
      href: '/console/l1-tokenomics/fee-manager',
    },
    faucetAction(l1),
  ];
}

// Pick the right faucet target based on what the L1's wallet metadata
// advertises: external URL takes precedence (well-known L1s like Echo /
// Dispatch / Dexalot point at Core's testnet faucet); otherwise the
// in-console faucet flow handles managed Builder Hub testnets.
function faucetAction(l1: CombinedL1): QuickAction {
  if (l1.externalFaucetUrl) {
    return {
      icon: Wallet,
      title: 'Get Test Tokens',
      description: `External faucet for ${l1.coinName ?? l1.chainName}.`,
      href: l1.externalFaucetUrl,
      external: true,
    };
  }
  return {
    icon: Wallet,
    title: 'Get Test Tokens',
    description: 'Request tokens from the in-console faucet.',
    href: '/console/primary-network/faucet',
  };
}

function QuickActionTile({ action }: { action: QuickAction }) {
  const Body = (
    <div className="p-4 rounded-lg border bg-card hover:bg-accent/50 transition-all duration-200 h-full">
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-muted">
          <action.icon className="w-4 h-4 text-muted-foreground" />
        </div>
        <div className="flex-1">
          <h4 className="font-medium text-foreground text-sm mb-1">{action.title}</h4>
          <p className="text-xs text-muted-foreground">{action.description}</p>
        </div>
        <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity mt-1" />
      </div>
    </div>
  );

  if (action.external) {
    return (
      <a href={action.href} target="_blank" rel="noopener noreferrer" className="group block">
        {Body}
      </a>
    );
  }
  return (
    <Link href={action.href} className="group block">
      {Body}
    </Link>
  );
}

function NetworkDetailsCard({ l1 }: { l1: CombinedL1 }) {
  const { copiedId, copyToClipboard } = useCopyToClipboard();

  const items: Array<{ label: string; value: string; id: string }> = [
    { label: 'RPC URL', value: l1.rpcUrl, id: 'rpc-url' },
    { label: 'Subnet ID', value: l1.subnetId, id: 'subnet-id' },
    { label: 'Blockchain ID', value: l1.blockchainId, id: 'blockchain-id' },
  ];
  if (l1.evmChainId !== null) {
    items.push({ label: 'EVM Chain ID', value: String(l1.evmChainId), id: 'evm-chain-id' });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Network Details</CardTitle>
        <CardDescription>Technical information about your L1</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((item) => (
            <div key={item.id} className="p-3 rounded-lg bg-muted/50 group">
              <p className="text-xs text-muted-foreground mb-1">{item.label}</p>
              <div className="flex items-start gap-2">
                {/* break-all + wrap so the full RPC URL renders without truncation */}
                <code
                  className="text-sm font-mono text-foreground flex-1 break-all leading-relaxed"
                  title={item.value}
                >
                  {item.value}
                </code>
                <button
                  onClick={() => copyToClipboard(item.value, item.id)}
                  className="p-1 rounded hover:bg-muted transition-colors shrink-0"
                  title={`Copy ${item.label}`}
                >
                  {copiedId === item.id ? (
                    <Check className="w-3.5 h-3.5 text-green-500" />
                  ) : (
                    <Copy className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function NodeListCard({
  l1,
  userActiveTotal,
  onRefetch,
}: {
  l1: CombinedL1;
  userActiveTotal: number;
  onRefetch: () => void;
}) {
  const nodes = l1.nodes ?? [];
  const activeCount = nodes.filter((n) => n.status === 'active').length;
  // Builder Hub enforces a per-user cap of 3 active nodes across all L1s.
  // Disable the provision button proactively when the user is at that limit
  // so they don't hit a 429 mid-click.
  const atUserCap = userActiveTotal >= 3;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <CardTitle className="text-lg">Managed Nodes</CardTitle>
            <CardDescription>
              Builder Hub-managed nodes provisioned for this L1. Each runs for 3 days from
              creation. Provision a fresh one to extend the L1&apos;s lifetime.
            </CardDescription>
          </div>
          <ProvisionNodeButton
            subnetId={l1.subnetId}
            blockchainId={l1.blockchainId}
            disabled={atUserCap}
            disabledReason={atUserCap ? 'You already have 3 active nodes (Builder Hub cap).' : undefined}
            onSuccess={onRefetch}
          />
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {nodes.map((n) => (
            <div
              key={n.id}
              className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 p-3 rounded-lg border bg-card"
            >
              <div className="min-w-0">
                <code className="text-xs font-mono text-foreground break-all">{n.nodeId}</code>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Created {new Date(n.createdAt).toLocaleString()} · {formatRelativeFromNow(n.expiresAt)}{' '}
                  remaining
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Badge variant={n.status === 'active' ? 'default' : 'secondary'}>{n.status}</Badge>
                {n.status === 'active' && (
                  <DeleteNodeButton nodeDbId={n.id} nodeId={n.nodeId} onSuccess={onRefetch} />
                )}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 pt-3 border-t flex items-center justify-between gap-3 flex-wrap">
          <Link
            href="/console/testnet-infra/nodes"
            className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Manage all nodes
            <ChevronRight className="w-4 h-4 ml-1" />
          </Link>
          <span className="text-xs text-muted-foreground">
            {activeCount} active on this L1 · {userActiveTotal}/3 total across your account
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

// Compact "Provision another node" button + inline error/success surface.
// Calls the existing POST /api/managed-testnet-nodes endpoint. The server
// enforces the 3-day TTL + the 3-node-per-user cap; we disable the button
// when we already know the cap is hit so the user doesn't get a 429.
function ProvisionNodeButton({
  subnetId,
  blockchainId,
  disabled,
  disabledReason,
  onSuccess,
}: {
  subnetId: string;
  blockchainId: string;
  disabled: boolean;
  disabledReason?: string;
  onSuccess: () => void;
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleClick = async () => {
    if (disabled || isSubmitting) return;
    setIsSubmitting(true);
    setError(null);
    setSuccess(false);
    try {
      const res = await fetch('/api/managed-testnet-nodes', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subnetId, blockchainId }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        const msg =
          json?.message ?? json?.error ?? `Failed to provision node (HTTP ${res.status})`;
        throw new Error(msg);
      }
      setSuccess(true);
      toast.success('Node provisioned', 'A fresh 3-day-TTL node is being added to this L1.');
      onSuccess();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to provision node';
      setError(msg);
      toast.error('Could not provision node', msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-1 min-w-0">
      <Button
        size="sm"
        variant="outline"
        onClick={handleClick}
        disabled={disabled || isSubmitting}
        title={disabledReason}
      >
        {isSubmitting ? 'Provisioning…' : success ? 'Provisioned' : 'Provision another node'}
      </Button>
      {error && (
        <span className="text-[11px] text-red-600 dark:text-red-400 max-w-[280px] text-right">
          {error}
        </span>
      )}
    </div>
  );
}

// Copies the L1's wagmi/viem-friendly chain config as JSON. Handy when the
// user wants to plug the L1 into another tool (Hardhat, Foundry, a custom
// dApp) without retyping the RPC URL + chain ID + native currency by hand.
function CopyChainConfigButton({ l1 }: { l1: CombinedL1 }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const config = {
      chainId: l1.evmChainId,
      chainName: l1.chainName,
      rpcUrls: [l1.rpcUrl],
      nativeCurrency: l1.coinName
        ? { name: l1.coinName, symbol: l1.coinName, decimals: 18 }
        : undefined,
      blockExplorerUrls: l1.explorerUrl ? [l1.explorerUrl] : undefined,
      subnetId: l1.subnetId,
      blockchainId: l1.blockchainId,
      isTestnet: l1.isTestnet,
    };
    try {
      await navigator.clipboard.writeText(JSON.stringify(config, null, 2));
      setCopied(true);
      toast.success('Chain config copied', 'Paste into Hardhat / Foundry / your wallet config.');
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      toast.error(
        'Could not copy',
        err instanceof Error ? err.message : 'Clipboard unavailable',
      );
    }
  };

  return (
    <Button variant="outline" size="sm" onClick={handleCopy}>
      {copied ? <Check className="w-4 h-4 mr-2 text-green-500" /> : <Copy className="w-4 h-4 mr-2" />}
      Copy Config
    </Button>
  );
}

// Confirmation-gated DELETE for a single managed node. Frees up a slot
// against the per-user 3-node cap. Wrapping in AlertDialog because losing
// a node is destructive — once terminated, the L1 may go down if no other
// nodes are running.
function DeleteNodeButton({
  nodeDbId,
  nodeId,
  onSuccess,
}: {
  nodeDbId: string;
  nodeId: string;
  onSuccess: () => void;
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/managed-testnet-nodes?id=${encodeURIComponent(nodeDbId)}`,
        { method: 'DELETE', credentials: 'include' },
      );
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.message ?? json?.error ?? `HTTP ${res.status}`);
      }
      toast.success('Node removed', 'A slot has been freed against your 3-node cap.');
      onSuccess();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to remove node';
      setError(msg);
      toast.error('Could not remove node', msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-destructive"
          aria-label="Remove node"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove this managed node?</AlertDialogTitle>
          <AlertDialogDescription>
            <span className="block mb-2">
              <code className="text-xs font-mono break-all">{nodeId}</code>
            </span>
            This frees up a slot against your 3-node Builder Hub cap. The L1 will keep running as
            long as at least one node is still active. Removed nodes can&apos;t be brought back —
            you&apos;d need to provision a fresh one.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error && (
          <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isSubmitting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              handleDelete();
            }}
            disabled={isSubmitting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isSubmitting ? 'Removing…' : 'Remove node'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}


// ---------------------------------------------------------------------------
// Empty / error / skeleton states
// ---------------------------------------------------------------------------
function EmptyState() {
  const { openModal: openAddChainModal } = useModalTrigger<{ success: boolean }>();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">My L1 Dashboard</h1>
        <p className="text-muted-foreground">Manage and monitor your Layer 1 blockchains</p>
      </div>
      <div className="flex flex-col items-center justify-center py-16">
        <div className="p-4 rounded-full bg-muted mb-4">
          <Layers className="w-8 h-8 text-muted-foreground" />
        </div>
        <h2 className="text-xl font-semibold text-foreground mb-2">No L1s yet</h2>
        <p className="text-muted-foreground text-center max-w-md mb-6">
          You haven&apos;t provisioned a managed L1 or added one to your wallet yet. Create one
          with the Quick L1 wizard — it spins up a node, ICM, and a token bridge in under 3
          minutes — or connect an existing L1 by RPC URL.
        </p>
        <div className="flex gap-3 flex-wrap justify-center">
          <Link href="/console/create-l1">
            <Button>Create L1</Button>
          </Link>
          <Button variant="outline" onClick={() => openAddChainModal()}>
            Connect by RPC
          </Button>
          <Link href="/console">
            <Button variant="ghost">Back to Console</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">My L1 Dashboard</h1>
      </div>
      <div className="flex flex-col items-center justify-center py-16">
        <div className="p-4 rounded-full bg-muted mb-4">
          <Wallet className="w-8 h-8 text-muted-foreground" />
        </div>
        <p className="text-muted-foreground text-center max-w-md mb-6">{message}</p>
        <div className="flex gap-3">
          <Button variant="outline" onClick={onRetry}>
            Retry
          </Button>
          <Link href="/api/auth/signin">
            <Button>Sign in</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

function HeaderSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-64" />
      </div>
      <div className="flex gap-2">
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-10 w-40" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20" />
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function formatRelativeFromNow(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return 'expired';
  const totalHours = Math.floor(ms / 3_600_000);
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  if (days > 0) return `${days}d ${hours}h`;
  return `${hours}h`;
}
