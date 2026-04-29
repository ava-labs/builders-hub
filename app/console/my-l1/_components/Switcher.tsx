'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Clock, Layers, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import { boardContainer, boardItem } from '@/components/console/motion';
import type { CombinedL1 } from '../_lib/types';

export function SwitcherBar({
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
  // Section titles only render when both kinds of L1 exist — there's no
  // reason to caption a single list with the same words the page subtitle
  // already shows ("X managed · Y wallet").
  const showSectionTitles = managed.length > 0 && wallet.length > 0;

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
          title={showSectionTitles ? 'Builder Hub-managed' : null}
          l1s={managed}
          selected={selected}
          onSelect={onSelect}
        />
      )}
      {wallet.length > 0 && (
        <SwitcherSection
          title={showSectionTitles ? 'Added to your wallet' : null}
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
  l1s,
  selected,
  onSelect,
}: {
  title: string | null;
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
      {title && (
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </h3>
      )}
      {/* Below sm we render pills as a single column — at ~360px the
          chain-ID + ExpiryPill combo blows the row width and a flex-wrap
          row turns into 3 stacked half-rows that read worse than a list.
          Above sm we keep the natural flex-wrap so dense rows of L1s pack
          tightly on the wider switcher. */}
      <motion.div
        className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap"
        variants={boardContainer}
        initial="hidden"
        animate="visible"
      >
        {l1s.map((l1) => {
          const key = l1.evmChainId !== null ? `chain:${l1.evmChainId}` : `subnet:${l1.subnetId}`;
          const isActive =
            selected !== null &&
            (selected.evmChainId === l1.evmChainId && selected.evmChainId !== null
              ? true
              : selected.subnetId === l1.subnetId);
          const walletIsHere = l1.evmChainId !== null && walletChainId === l1.evmChainId;
          return (
            <motion.button
              key={key}
              variants={boardItem}
              type="button"
              onClick={() => onSelect(l1)}
              aria-pressed={isActive}
              aria-label={`${l1.chainName} (chain ${l1.evmChainId ?? 'unknown'})${
                walletIsHere ? ' — wallet currently on this L1' : ''
              }${isActive ? ' — selected' : ''}`}
              className={`group flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-all w-full sm:w-auto ${
                isActive
                  ? 'border-primary bg-primary/10 text-foreground'
                  : 'border-border bg-card hover:border-foreground/30 text-muted-foreground hover:text-foreground'
              }`}
            >
              {walletIsHere && (
                <span
                  className="relative flex w-2 h-2"
                  title="Your wallet is currently on this L1"
                  aria-hidden="true"
                >
                  {/* Slowed the default `animate-ping` (1s → 2.4s) and dropped
                      the ring opacity (0.75 → 0.4) so the indicator reads as
                      a passive breath instead of an alert. */}
                  <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-40 animate-ping [animation-duration:2.4s]" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
              )}
              <span className="font-medium">{l1.chainName}</span>
              <span className="text-xs opacity-60">
                {l1.evmChainId ?? l1.subnetId.slice(0, 6)}
              </span>
              {l1.source === 'managed' && l1.expiresAt && <ExpiryPill expiresAt={l1.expiresAt} />}
            </motion.button>
          );
        })}
      </motion.div>
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
      <span
        className="ml-1 inline-flex items-center gap-1 rounded-full bg-red-100 dark:bg-red-900/30 px-1.5 py-0.5 text-[10px] text-red-700 dark:text-red-400"
        aria-label="Managed nodes expired"
      >
        <Clock className="w-2.5 h-2.5" aria-hidden="true" />
        expired
      </span>
    );
  }
  const totalHours = Math.floor(ms / 3_600_000);
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  const label = days > 0 ? `${days}d ${hours}h` : `${hours}h`;
  const verbose =
    days > 0 ? `Expires in ${days} day${days === 1 ? '' : 's'} ${hours} hour${hours === 1 ? '' : 's'}` : `Expires in ${hours} hour${hours === 1 ? '' : 's'}`;
  const tone =
    totalHours < 6
      ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
      : 'bg-muted text-muted-foreground';
  return (
    <span
      className={`ml-1 inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] ${tone}`}
      aria-label={verbose}
    >
      <Clock className="w-2.5 h-2.5" aria-hidden="true" />
      {label}
    </span>
  );
}
