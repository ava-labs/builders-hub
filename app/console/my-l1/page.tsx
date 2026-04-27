'use client';

import { useEffect, useMemo, useState, useCallback, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Activity,
  ArrowUpDown,
  BarChart3,
  Check,
  ChevronRight,
  Circle,
  CheckCircle2,
  Copy,
  Clock,
  ExternalLink,
  Layers,
  MessagesSquare,
  RefreshCw,
  Settings,
  Users,
  Wallet,
} from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { CheckRequirements } from '@/components/toolbox/components/CheckRequirements';
import { WalletRequirementsConfigKey } from '@/components/toolbox/hooks/useWalletRequirements';
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard';
import { useMyL1s, type MyL1 } from '@/hooks/useMyL1s';

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
  const { l1s, isLoading, error, refetch } = useMyL1s();

  // URL-driven selection so refresh + back button work, and so wallet network
  // switches don't change which L1 the dashboard is viewing.
  const selectedChainParam = searchParams.get('chain');

  const selectedL1 = useMemo<MyL1 | null>(() => {
    if (l1s.length === 0) return null;
    if (selectedChainParam) {
      const match = l1s.find((l) => String(l.evmChainId) === selectedChainParam);
      if (match) return match;
    }
    return l1s[0];
  }, [l1s, selectedChainParam]);

  // If the selected L1 fell off the list (e.g. expired), point the URL at the
  // current first entry instead of leaving the user on a stale URL.
  useEffect(() => {
    if (!selectedL1 || !selectedChainParam) return;
    if (String(selectedL1.evmChainId) !== selectedChainParam) {
      router.replace(`/console/my-l1?chain=${selectedL1.evmChainId ?? ''}`);
    }
  }, [selectedL1, selectedChainParam, router]);

  const onSelect = useCallback(
    (l1: MyL1) => {
      const next = new URLSearchParams(searchParams.toString());
      if (l1.evmChainId !== null) {
        next.set('chain', String(l1.evmChainId));
      } else {
        next.set('chain', l1.subnetId);
      }
      router.replace(`/console/my-l1?${next.toString()}`);
    },
    [router, searchParams],
  );

  if (isLoading) {
    return (
      <div className="space-y-6">
        <HeaderSkeleton />
      </div>
    );
  }

  if (error) {
    return <ErrorState message={error} onRetry={refetch} />;
  }

  if (l1s.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className="space-y-6">
      <SwitcherBar l1s={l1s} selected={selectedL1} onSelect={onSelect} onRefresh={refetch} />
      {selectedL1 && <L1Details l1={selectedL1} />}
    </div>
  );
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
  l1s: MyL1[];
  selected: MyL1 | null;
  onSelect: (l1: MyL1) => void;
  onRefresh: () => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">My L1 Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            L1s tied to your Builder Hub account — independent of the wallet network you&apos;re on.
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
      <div className="flex flex-wrap gap-2">
        {l1s.map((l1) => {
          const isActive = selected?.subnetId === l1.subnetId;
          return (
            <button
              key={l1.subnetId}
              onClick={() => onSelect(l1)}
              className={`group flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-all ${
                isActive
                  ? 'border-primary bg-primary/10 text-foreground'
                  : 'border-border bg-card hover:border-foreground/30 text-muted-foreground hover:text-foreground'
              }`}
            >
              <span className="font-medium">{l1.chainName}</span>
              <span className="text-xs opacity-60">
                {l1.evmChainId ?? l1.subnetId.slice(0, 6)}
              </span>
              <ExpiryPill expiresAt={l1.expiresAt} />
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
function L1Details({ l1 }: { l1: MyL1 }) {
  return (
    <div className="space-y-6">
      <DetailHeader l1={l1} />
      <StatsGrid l1={l1} />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <SetupProgressCard />
        <QuickActionsCard />
      </div>
      <NetworkDetailsCard l1={l1} />
      <NodeListCard l1={l1} />
    </div>
  );
}

function DetailHeader({ l1 }: { l1: MyL1 }) {
  return (
    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
      <div>
        <h2 className="text-xl font-semibold text-foreground">{l1.chainName}</h2>
        <p className="text-sm text-muted-foreground">
          Chain ID: {l1.evmChainId ?? '—'} · {l1.isTestnet ? 'Testnet' : 'Mainnet'} · {l1.nodes.length}{' '}
          managed node{l1.nodes.length === 1 ? '' : 's'}
        </p>
      </div>
    </div>
  );
}

function StatsGrid({ l1 }: { l1: MyL1 }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard
        icon={Users}
        label="Managed nodes"
        value={String(l1.nodes.length)}
        subValue={`${l1.nodes.filter((n) => n.status === 'active').length} active`}
      />
      <StatCard
        icon={Clock}
        label="Earliest expiry"
        value={formatRelativeFromNow(l1.expiresAt)}
        subValue={new Date(l1.expiresAt).toLocaleString()}
      />
      <StatCard
        icon={Activity}
        label="EVM chain ID"
        value={l1.evmChainId !== null ? String(l1.evmChainId) : 'Unknown'}
        subValue={l1.evmChainId === null ? 'Glacier may not have indexed it yet' : 'From Glacier'}
      />
      <StatCard
        icon={Wallet}
        label="Subnet"
        value={`${l1.subnetId.slice(0, 6)}…${l1.subnetId.slice(-4)}`}
        subValue="Click Network Details to copy full ID"
      />
    </div>
  );
}

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

function SetupProgressCard() {
  // The previous heuristics relied on validatorManagerAddress / wrappedTokenAddress
  // sniffed off the wallet's L1ListItem. With the dashboard now driven by
  // NodeRegistration we don't have those fields server-side; reduce to the
  // genuinely-known checkpoints. TODO: wire a per-L1 features endpoint or
  // pull from chain registry once available.
  const steps = [
    { label: 'L1 created', completed: true, href: '/console/create-l1' },
    { label: 'Managed node provisioned', completed: true, href: '/console/testnet-infra/nodes' },
    {
      label: 'Validator Manager configured',
      completed: false,
      href: '/console/permissioned-l1s/validator-manager-setup',
    },
    {
      label: 'Interchain Messaging (ICM)',
      completed: false,
      href: '/console/icm/setup',
    },
    {
      label: 'Token Bridge',
      completed: false,
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

function QuickActionsCard() {
  const actions = [
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
    {
      icon: Wallet,
      title: 'Get Test Tokens',
      description: 'Request tokens from the faucet.',
      href: '/console/primary-network/faucet',
    },
  ];
  return (
    <Card className="lg:col-span-2">
      <CardHeader>
        <CardTitle className="text-lg">Quick Actions</CardTitle>
        <CardDescription>Common tasks for managing your L1</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {actions.map((a) => (
            <Link key={a.title} href={a.href} className="group block">
              <div className="p-4 rounded-lg border bg-card hover:bg-accent/50 transition-all duration-200 h-full">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-muted">
                    <a.icon className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-medium text-foreground text-sm mb-1">{a.title}</h4>
                    <p className="text-xs text-muted-foreground">{a.description}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity mt-1" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function NetworkDetailsCard({ l1 }: { l1: MyL1 }) {
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

function NodeListCard({ l1 }: { l1: MyL1 }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Managed Nodes</CardTitle>
        <CardDescription>
          Builder Hub-managed nodes provisioned for this L1. Each runs for 3 days from creation.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {l1.nodes.map((n) => (
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
              <Badge variant={n.status === 'active' ? 'default' : 'secondary'}>{n.status}</Badge>
            </div>
          ))}
        </div>
        <div className="mt-4 pt-3 border-t">
          <Link
            href="/console/testnet-infra/nodes"
            className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Manage all nodes
            <ChevronRight className="w-4 h-4 ml-1" />
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Empty / error / skeleton states
// ---------------------------------------------------------------------------
function EmptyState() {
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
          You haven&apos;t provisioned a managed L1 yet. Create one with the Quick L1 wizard — it
          spins up a node, ICM, and a token bridge in under 3 minutes.
        </p>
        <div className="flex gap-3">
          <Link href="/console/create-l1">
            <Button>Create L1</Button>
          </Link>
          <Link href="/console">
            <Button variant="outline">Back to Console</Button>
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
