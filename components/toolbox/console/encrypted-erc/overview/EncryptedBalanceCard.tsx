'use client';

import React, { memo, useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ChevronRight, Eye, EyeOff, Lock } from 'lucide-react';
import { boardItem } from '@/components/console/motion';
import { cn } from '@/lib/utils';
import type { EERCBalanceState } from '@/hooks/eerc/useEERCBalance';
import { TileShell } from './TileShell';

/**
 * Replaces the old "Avalanche Fuji C-Chain" Network card.
 *
 * The previous card duplicated information that the hero status row
 * already surfaced (chain · modes · token), wasting prime overview
 * real-estate. This card uses the same hook the Balance tool uses
 * (`useEERCBalance` decrypts client-side via the cached BJJ identity)
 * and displays one of four states:
 *
 *   • not connected   → prompt to connect
 *   • not registered  → prompt to register
 *   • registered, decrypted → big formatted balance + caption
 *   • registered, can't decrypt → blurred placeholder + retry
 *
 * In every state the card surfaces the live on-chain ciphertext as a
 * footer hint (rotates every 900ms via `<RotatingCiphertext />`) so the
 * card communicates *"this number lives encrypted on-chain"* without a
 * paragraph of copy.
 */
interface EncryptedBalanceCardProps {
  className?: string;
  address: string | undefined;
  isRegistered: boolean | null;
  balance: EERCBalanceState;
  mode: 'standalone' | 'converter';
  tokenSymbol: string | null;
  isOnConnectedChain: boolean;
}

export function EncryptedBalanceCard({
  className,
  address,
  isRegistered,
  balance,
  mode,
  tokenSymbol,
  isOnConnectedChain,
}: EncryptedBalanceCardProps) {
  const symbol = tokenSymbol ?? 'eERC';
  const isDecrypted = balance.decryptedCents !== null && balance.formatted !== null;

  return (
    <motion.div className={className} variants={boardItem}>
      <TileShell className="flex h-full flex-col">
        <div className="flex items-center gap-2">
          <Lock className="h-4 w-4 text-zinc-500 dark:text-zinc-400" strokeWidth={2} />
          <h3 className="text-sm font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
            Your encrypted balance
          </h3>
          <span className="ml-auto rounded-full border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-400">
            {mode}
          </span>
        </div>

        <BalanceDisplay
          address={address}
          isRegistered={isRegistered}
          isOnConnectedChain={isOnConnectedChain}
          isDecrypted={isDecrypted}
          formatted={balance.formatted}
          symbol={symbol}
          isLoading={balance.isLoading}
          error={balance.error}
        />

        <CipherFooter raw={balance.raw} />

        <BalanceCta
          address={address}
          isRegistered={isRegistered}
          isOnConnectedChain={isOnConnectedChain}
          isDecrypted={isDecrypted}
        />
      </TileShell>
    </motion.div>
  );
}

interface BalanceDisplayProps {
  address: string | undefined;
  isRegistered: boolean | null;
  isOnConnectedChain: boolean;
  isDecrypted: boolean;
  formatted: string | null;
  symbol: string;
  isLoading: boolean;
  error: string | null;
}

function BalanceDisplay({
  address,
  isRegistered,
  isOnConnectedChain,
  isDecrypted,
  formatted,
  symbol,
  isLoading,
  error,
}: BalanceDisplayProps) {
  // Loading skeleton — matches the size/rhythm of the resolved
  // balance line so the layout doesn't jump when data lands.
  if (isLoading && !formatted) {
    return (
      <div className="my-5">
        <div className="h-9 w-32 animate-pulse rounded-md bg-zinc-100 dark:bg-zinc-900/80" />
        <div className="mt-2 h-3 w-48 animate-pulse rounded-md bg-zinc-100 dark:bg-zinc-900/80" />
      </div>
    );
  }

  // Disconnected — keep the visual structure but obviously inert.
  if (!address) {
    return (
      <div className="my-5">
        <BlurredAmount symbol={symbol} />
        <p className="mt-2 text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-400">
          Connect a wallet to see your encrypted balance.
        </p>
      </div>
    );
  }

  if (!isOnConnectedChain) {
    return (
      <div className="my-5">
        <BlurredAmount symbol={symbol} />
        <p className="mt-2 text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-400">
          No EERC deployment on this chain. Switch network or deploy your own.
        </p>
      </div>
    );
  }

  if (!isRegistered) {
    return (
      <div className="my-5">
        <BlurredAmount symbol={symbol} />
        <p className="mt-2 text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-400">
          Register your BJJ identity to decrypt balances.
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="my-5">
        <BlurredAmount symbol={symbol} />
        <p className="mt-2 text-[11px] leading-relaxed text-rose-500 dark:text-rose-400">{error}</p>
      </div>
    );
  }

  if (isDecrypted && formatted) {
    return (
      <div className="my-5">
        <div className="flex items-baseline gap-2 font-mono tabular-nums">
          <span className="text-3xl font-semibold tracking-tighter text-zinc-950 dark:text-zinc-50">{formatted}</span>
          <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400">{symbol}</span>
        </div>
        <p className="mt-2 inline-flex items-center gap-1 text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-400">
          <Eye className="h-3 w-3 text-emerald-500" strokeWidth={2} />
          Decrypted with your BJJ key — never leaves the browser.
        </p>
      </div>
    );
  }

  return (
    <div className="my-5">
      <BlurredAmount symbol={symbol} />
      <p className="mt-2 inline-flex items-center gap-1 text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-400">
        <EyeOff className="h-3 w-3" strokeWidth={2} />
        Couldn't decrypt locally — open the Balance tool to retry.
      </p>
    </div>
  );
}

/**
 * Visual placeholder for the not-yet-decryptable balance state. Heavy
 * tracking + low-contrast bullets read as "redacted". The amount text
 * carries `select-none` so a reader can't grab "●●.●●●●" thinking it's
 * the real balance.
 */
function BlurredAmount({ symbol }: { symbol: string }) {
  return (
    <div className="flex items-baseline gap-2 font-mono tabular-nums select-none">
      <span className="text-3xl font-semibold tracking-[0.3em] text-zinc-300 dark:text-zinc-700">●●.●●●●</span>
      <span className="text-sm font-medium text-zinc-400 dark:text-zinc-600">{symbol}</span>
    </div>
  );
}

interface BalanceCtaProps {
  address: string | undefined;
  isRegistered: boolean | null;
  isOnConnectedChain: boolean;
  isDecrypted: boolean;
}

function BalanceCta({ address, isRegistered, isOnConnectedChain, isDecrypted }: BalanceCtaProps) {
  if (!address) return <CtaSpacer />;
  if (!isOnConnectedChain) {
    return <CtaLink href="/console/encrypted-erc/deploy" label="Deploy your own" />;
  }
  if (!isRegistered) {
    return <CtaLink href="/console/encrypted-erc/register" label="Register identity" />;
  }
  return <CtaLink href="/console/encrypted-erc/balance" label={isDecrypted ? 'Open balance tool' : 'Retry decrypt'} />;
}

function CtaLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className={cn(
        'mt-auto inline-flex items-center justify-between border-t border-zinc-100 pt-3 text-[11px] font-medium text-zinc-600',
        'transition-colors hover:text-zinc-950 dark:border-zinc-800/80 dark:text-zinc-400 dark:hover:text-zinc-50',
      )}
    >
      <span>{label}</span>
      <ChevronRight className="h-3.5 w-3.5" />
    </Link>
  );
}

function CtaSpacer() {
  return <div className="mt-auto" aria-hidden />;
}

/**
 * Rotating ciphertext footer. Pulls a real component (`c1.x`) out of
 * the user's eGCT when available, and falls back to a deterministic
 * pseudo-random hex stream when not so the card always conveys "the
 * on-chain state is encrypted hex". Memoised so the 1.2s tick doesn't
 * cascade into the parent card.
 */
const CipherFooter = memo(function CipherFooter({ raw }: { raw: EERCBalanceState['raw'] }) {
  const realChunk = raw ? `${raw.eGCT.c1[0].toString(16).slice(0, 12).padStart(12, '0')}` : null;
  return (
    <div className="mb-3 rounded-lg border border-zinc-100 bg-zinc-50/60 px-3 py-2 dark:border-zinc-900 dark:bg-zinc-950/40">
      <div className="flex items-center justify-between">
        <span className="text-[9px] font-medium uppercase tracking-[0.16em] text-zinc-400 dark:text-zinc-500">
          On-chain ciphertext
        </span>
        <span className="text-[10px] text-zinc-400 dark:text-zinc-600">c1.x</span>
      </div>
      <div className="mt-1 truncate font-mono text-[11px] text-emerald-600/80 dark:text-emerald-400/80">
        {realChunk ?? <RotatingHex />}
      </div>
    </div>
  );
});

const RotatingHex = memo(function RotatingHex() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1200);
    return () => clearInterval(id);
  }, []);
  return <span>0x{rollHex(tick, 12)}</span>;
});

function rollHex(tick: number, length: number): string {
  let seed = (0x9e3779b1 ^ (tick * 0x85ebca6b)) >>> 0;
  const next = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed;
  };
  let out = '';
  while (out.length < length) {
    out += next().toString(16).padStart(8, '0');
  }
  return out.slice(0, length);
}
