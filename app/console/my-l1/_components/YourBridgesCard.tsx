'use client';

import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, Plus } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useL1List, type L1ListItem } from '@/components/toolbox/stores/l1ListStore';
import { useUserBridgesForL1 } from '@/hooks/useUserBridgesForL1';
import { derivePhaseStatus, highestReachablePhase } from '@/components/toolbox/console/ictt/bridge/utils/derive-status';
import { BRIDGE_BASE_PATH } from '@/components/toolbox/console/ictt/bridge/bridge-steps';
import type { Bridge, Remote } from '@/components/toolbox/console/ictt/bridge/types';
import type { CombinedL1 } from '@/lib/console/my-l1/types';
import { cn } from '@/lib/utils';

/**
 * Lists the user's ICTT bridges that touch this L1. Source of truth is the
 * browser-local `iccttBridgeStore` — these are bridges the user deployed or
 * registered through `/console/ictt` on this device. Server-side aggregate
 * bridge activity lives in {@link L1BridgeActivityCard}.
 *
 * Each row has a "Resume in console" CTA that routes to the highest-reachable
 * phase for that bridge with `?bridge=<id>` so the console can re-select it
 * via the existing `selectBridge` action.
 */
export function YourBridgesCard({ l1 }: { l1: CombinedL1 }) {
  const { asHome, asRemote, total } = useUserBridgesForL1(l1.blockchainId);
  const l1List = useL1List();

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold">Your bridges</CardTitle>
        <CardDescription className="text-xs">
          {total > 0
            ? `${total} bridge${total === 1 ? '' : 's'} touching ${l1.chainName}.`
            : `Bridges you create from ${l1.chainName} show up here.`}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {total === 0 ? (
          <EmptyState />
        ) : (
          <div className="flex flex-col gap-2">
            {asHome.map((b) => (
              <BridgeRow key={b.id} bridge={b} role="home" thisL1Id={l1.blockchainId} l1List={l1List} />
            ))}
            {asRemote.map((b) => (
              <BridgeRow key={b.id} bridge={b} role="remote" thisL1Id={l1.blockchainId} l1List={l1List} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-stretch gap-2 rounded-lg border border-dashed border-zinc-200 px-3 py-5 text-center text-xs text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
      <p>No bridges yet.</p>
      <Link
        href={`${BRIDGE_BASE_PATH}/token`}
        className="mx-auto inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2.5 py-1 text-[11px] font-medium text-white transition-colors hover:bg-emerald-500"
      >
        <Plus className="h-3 w-3" aria-hidden />
        Create your first bridge
      </Link>
    </div>
  );
}

function BridgeRow({
  bridge,
  role,
  thisL1Id,
  l1List,
}: {
  bridge: Bridge;
  role: 'home' | 'remote';
  thisL1Id: string;
  l1List: L1ListItem[];
}) {
  // For role=home → partner is each remote chain. For role=remote → partner
  // is the bridge's home chain. Show the first counterparty in the row
  // label; remote count is in the badge.
  const partnerIds =
    role === 'home' ? bridge.remotes.map((r) => r.l1Id) : [bridge.homeL1Id];
  const partner = l1List.find((l1: L1ListItem) => l1.id === partnerIds[0]) ?? null;

  // Pick a remote whose `l1Id` matches "this" side of the bridge if we're
  // viewing it as remote, otherwise use the first remote as context for
  // phase derivation.
  const remoteForContext: Remote | null =
    role === 'remote'
      ? bridge.remotes.find((r) => r.l1Id === thisL1Id) ?? bridge.remotes[0] ?? null
      : bridge.remotes[0] ?? null;
  const phaseStatus = derivePhaseStatus({ bridge, remote: remoteForContext });
  const phase = highestReachablePhase(phaseStatus);
  const resumeHref = `${BRIDGE_BASE_PATH}/${phase}?bridge=${encodeURIComponent(bridge.id)}`;

  const tokenLabel = bridge.symbol ?? (bridge.kind === 'native-home' ? 'Native' : 'Token');
  const statusInfo = describeStatus(bridge, remoteForContext);

  return (
    <Link
      href={resumeHref}
      className={cn(
        'group flex items-center justify-between gap-3 rounded-lg border border-zinc-200 bg-white px-3 py-2 transition-colors hover:bg-zinc-50',
        'dark:border-zinc-800 dark:bg-zinc-950/40 dark:hover:bg-zinc-900/60',
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2.5">
        <PartnerAvatar l1={partner} />
        <div className="flex min-w-0 flex-col leading-tight">
          <span className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
            {role === 'home' ? `${tokenLabel} → ${partner?.name ?? 'destination'}` : `${tokenLabel} ← ${partner?.name ?? 'home'}`}
          </span>
          <span className="flex items-center gap-1.5 text-[11px] text-zinc-500 dark:text-zinc-400">
            <span aria-hidden className={cn('h-1.5 w-1.5 rounded-full', statusInfo.dotTone)} />
            {statusInfo.label}
            {role === 'home' && bridge.remotes.length > 1 && (
              <span className="text-zinc-400">· {bridge.remotes.length} remotes</span>
            )}
          </span>
        </div>
      </div>
      <span className="inline-flex shrink-0 items-center gap-1 text-[11px] font-medium text-emerald-700 group-hover:text-emerald-600 dark:text-emerald-300 dark:group-hover:text-emerald-200">
        Resume
        <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" aria-hidden />
      </span>
    </Link>
  );
}

function PartnerAvatar({ l1 }: { l1: L1ListItem | null }) {
  if (!l1?.logoUrl) {
    return (
      <span
        aria-hidden
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-zinc-200 text-[10px] font-semibold uppercase text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300"
      >
        {l1?.name?.slice(0, 1) ?? '?'}
      </span>
    );
  }
  return (
    <span className="relative h-7 w-7 shrink-0 overflow-hidden rounded-md bg-white ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-700">
      <Image src={l1.logoUrl} alt="" width={28} height={28} className="h-7 w-7 object-contain" unoptimized />
    </span>
  );
}

function describeStatus(bridge: Bridge, remote: Remote | null): { label: string; dotTone: string } {
  const isLive = Boolean(remote?.registeredAt && remote?.collateralizedAt);
  if (isLive) return { label: 'Live', dotTone: 'bg-emerald-500' };
  if (remote?.registeredAt) return { label: 'Awaiting collateral', dotTone: 'bg-amber-400' };
  if (remote?.address) return { label: 'Awaiting registration', dotTone: 'bg-amber-400' };
  if (bridge.homeAddress) return { label: 'Awaiting remote', dotTone: 'bg-zinc-400' };
  return { label: 'Setup in progress', dotTone: 'bg-zinc-400' };
}
