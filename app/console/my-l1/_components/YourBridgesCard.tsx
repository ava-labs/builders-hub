'use client';

import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, Plus } from 'lucide-react';
import { useL1List, type L1ListItem } from '@/components/toolbox/stores/l1ListStore';
import { useUserBridgesForL1 } from '@/hooks/useUserBridgesForL1';
import { derivePhaseStatus, highestReachablePhase } from '@/components/toolbox/console/ictt/bridge/utils/derive-status';
import { BRIDGE_BASE_PATH } from '@/components/toolbox/console/ictt/bridge/bridge-steps';
import type { Bridge, Remote } from '@/components/toolbox/console/ictt/bridge/types';
import type { CombinedL1 } from '@/lib/console/my-l1/types';
import { cn } from '@/lib/utils';
import { BTN_SECONDARY, COUNT, EYEBROW, HAIRLINE } from './chrome';

/**
 * Lists the user's ICTT bridges that touch this L1. Source of truth is the
 * browser-local `iccttBridgeStore` — these are bridges the user deployed or
 * registered through `/console/ictt` on this device. Server-side aggregate
 * bridge activity lives in {@link L1BridgeActivityCard}.
 *
 * Each row has a "Resume in console" CTA that routes to the highest-reachable
 * phase for that bridge with `?bridge=<id>` so the console can re-select it
 * via the existing `selectBridge` action.
 *
 * Renders frameless: CrossChainSection supplies the board around it.
 */
export function YourBridgesCard({ l1 }: { l1: CombinedL1 }) {
  const { asHome, asRemote, total } = useUserBridgesForL1(l1.blockchainId);
  const l1List = useL1List();

  return (
    <div className="flex min-w-0 flex-col">
      <div className="flex min-h-9 items-center justify-between gap-4 border-b border-zinc-200 px-5 py-2 md:px-6 dark:border-zinc-800">
        <p className={EYEBROW}>Your bridges</p>
        <span className={COUNT}>{total}</span>
      </div>
      <p className="px-5 pt-4 text-[13px] leading-relaxed text-zinc-500 md:px-6 dark:text-zinc-400">
        {total > 0
          ? `${total} bridge${total === 1 ? '' : 's'} touching ${l1.chainName}.`
          : `Bridges you create from ${l1.chainName} show up here.`}
      </p>
      <div className="px-5 py-4 md:px-6">
        {total === 0 ? (
          <EmptyState />
        ) : (
          <div className="divide-y divide-zinc-200 border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
            {asHome.map((b) => (
              <BridgeRow key={b.id} bridge={b} role="home" thisL1Id={l1.blockchainId} l1List={l1List} />
            ))}
            {asRemote.map((b) => (
              <BridgeRow key={b.id} bridge={b} role="remote" thisL1Id={l1.blockchainId} l1List={l1List} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className={cn(HAIRLINE, 'flex flex-col items-start gap-3 px-4 py-5')}>
      <p className={EYEBROW}>No bridges</p>
      <p className="text-[13px] text-zinc-500 dark:text-zinc-400">
        No bridges yet. Create one, then test it via the Live phase.
      </p>
      <Link href={`${BRIDGE_BASE_PATH}/token`} className={cn(BTN_SECONDARY, 'h-8 px-3 text-[10px]')}>
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
  const partnerIds = role === 'home' ? bridge.remotes.map((r) => r.l1Id) : [bridge.homeL1Id];
  const partner = l1List.find((l1: L1ListItem) => l1.id === partnerIds[0]) ?? null;

  // Pick a remote whose `l1Id` matches "this" side of the bridge if we're
  // viewing it as remote, otherwise use the first remote as context for
  // phase derivation.
  const remoteForContext: Remote | null =
    role === 'remote'
      ? (bridge.remotes.find((r) => r.l1Id === thisL1Id) ?? bridge.remotes[0] ?? null)
      : (bridge.remotes[0] ?? null);
  const phaseStatus = derivePhaseStatus({ bridge, remote: remoteForContext });
  const phase = highestReachablePhase(phaseStatus);
  const resumeHref = `${BRIDGE_BASE_PATH}/${phase}?bridge=${encodeURIComponent(bridge.id)}`;

  const tokenLabel = bridge.symbol ?? (bridge.kind === 'native-home' ? 'Native' : 'Token');
  const statusInfo = describeStatus(bridge, remoteForContext);

  return (
    <Link
      href={resumeHref}
      className="group/row flex items-center justify-between gap-3 bg-white/80 px-3 py-2.5 dark:bg-zinc-950/80"
    >
      <div className="flex min-w-0 flex-1 items-center gap-2.5">
        <PartnerAvatar l1={partner} />
        <div className="flex min-w-0 flex-col gap-0.5 leading-tight">
          <span className="truncate text-[13.5px] font-medium text-zinc-900 underline-offset-4 group-hover/row:underline dark:text-zinc-50">
            {role === 'home'
              ? `${tokenLabel} → ${partner?.name ?? 'destination'}`
              : `${tokenLabel} ← ${partner?.name ?? 'home'}`}
          </span>
          <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.1em] text-zinc-500 dark:text-zinc-400">
            <span aria-hidden className={cn('h-1.5 w-1.5 rounded-full', statusInfo.dotTone)} />
            {statusInfo.label}
            {role === 'home' && bridge.remotes.length > 1 && (
              <span className="tabular-nums text-zinc-400">· {bridge.remotes.length} remotes</span>
            )}
          </span>
        </div>
      </div>
      <span className="inline-flex shrink-0 items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-500 transition-colors group-hover/row:text-zinc-900 dark:text-zinc-400 dark:group-hover/row:text-zinc-100">
        Resume
        <ArrowRight
          className="h-3 w-3 -translate-x-1 text-[#E6212F] opacity-0 transition-all group-hover/row:translate-x-0 group-hover/row:opacity-100"
          aria-hidden
        />
      </span>
    </Link>
  );
}

function PartnerAvatar({ l1 }: { l1: L1ListItem | null }) {
  if (!l1?.logoUrl) {
    return (
      <span
        aria-hidden
        className="flex h-7 w-7 shrink-0 items-center justify-center border border-zinc-200 bg-zinc-50 font-mono text-[10px] font-bold uppercase text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
      >
        {l1?.name?.slice(0, 1) ?? '?'}
      </span>
    );
  }
  return (
    <span className="relative h-7 w-7 shrink-0 overflow-hidden border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <Image src={l1.logoUrl} alt="" width={28} height={28} className="h-full w-full object-contain" unoptimized />
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
