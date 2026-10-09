'use client';

import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { EERCBalanceState } from '@/hooks/eerc/useEERCBalance';
import { ArrowLink, EYEBROW, FRAME, MaskedValue } from '../shared/ui';

/**
 * The connected user's encrypted balance, decrypted client-side via the
 * cached BabyJubJub identity (the same hook the Balance tool uses), with
 * the raw on-chain ciphertext underneath and the one next action.
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
  const cipher = balance.raw ? balance.raw.eGCT.c1[0].toString(16).slice(0, 12).padStart(12, '0') : null;

  return (
    <section className={cn(FRAME, 'flex flex-col', className)}>
      <div className="flex min-h-9 items-center justify-between gap-4 border-b border-zinc-200 px-4 py-2 dark:border-zinc-800">
        <p className={EYEBROW}>Your encrypted balance</p>
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">
          {mode}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-5 p-4">
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

        <div className="flex flex-col gap-1.5 border-t border-zinc-200 pt-4 dark:border-zinc-800">
          <span className="flex items-baseline justify-between gap-3">
            <span className={EYEBROW}>On-chain ciphertext</span>
            <span className="font-mono text-[10px] text-zinc-400 dark:text-zinc-500">c1.x</span>
          </span>
          {cipher ? (
            <MaskedValue value={`0x${cipher}`} />
          ) : (
            <span className="font-mono text-[12px] text-zinc-400 dark:text-zinc-500">Nothing stored yet</span>
          )}
        </div>
      </div>

      <BalanceCta
        address={address}
        isRegistered={isRegistered}
        isOnConnectedChain={isOnConnectedChain}
        isDecrypted={isDecrypted}
      />
    </section>
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
  const [hidden, setHidden] = useState(false);

  if (isLoading && !formatted) {
    return (
      <div className="flex flex-col gap-2" role="status" aria-label="Loading balance">
        <span className="h-9 w-40 animate-pulse bg-zinc-100 dark:bg-zinc-900" />
        <span className="h-3 w-56 animate-pulse bg-zinc-100 dark:bg-zinc-900" />
      </div>
    );
  }

  const caption = !address
    ? 'Connect a wallet to see your encrypted balance.'
    : !isOnConnectedChain
      ? 'No Encrypted ERC deployment on this chain. Switch network or deploy your own.'
      : !isRegistered
        ? 'Register your identity to decrypt balances.'
        : null;

  if (caption) {
    return (
      <div className="flex flex-col gap-2">
        <MaskedAmount symbol={symbol} />
        <p className="text-[13px] leading-relaxed text-zinc-500 dark:text-zinc-400">{caption}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col gap-2">
        <MaskedAmount symbol={symbol} />
        <p className="text-[13px] leading-relaxed text-red-700 dark:text-red-400">{error}</p>
      </div>
    );
  }

  if (isDecrypted && formatted) {
    return (
      <div className="flex flex-col gap-2">
        <div className="flex items-baseline gap-2">
          {hidden ? (
            <MaskedAmount symbol={symbol} />
          ) : (
            <span className="flex items-baseline gap-2 font-mono tabular-nums">
              <span className="text-3xl tracking-tight text-zinc-900 dark:text-zinc-50">{formatted}</span>
              <span className="text-sm text-zinc-400 dark:text-zinc-500">{symbol}</span>
            </span>
          )}
          <button
            type="button"
            onClick={() => setHidden((v) => !v)}
            aria-label={hidden ? 'Show balance' : 'Hide balance'}
            className="ml-1 self-center p-1 text-zinc-400 transition-colors hover:text-zinc-900 dark:text-zinc-500 dark:hover:text-zinc-100"
          >
            {hidden ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
          </button>
        </div>
        <p className="text-[13px] leading-relaxed text-zinc-500 dark:text-zinc-400">
          Decrypted with your key. It never leaves the browser.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <MaskedAmount symbol={symbol} />
      <p className="text-[13px] leading-relaxed text-zinc-500 dark:text-zinc-400">
        Couldn&apos;t decrypt here. Open the Balance tool to retry.
      </p>
    </div>
  );
}

function MaskedAmount({ symbol }: { symbol: string }) {
  return (
    <span className="flex select-none items-baseline gap-2 font-mono tabular-nums" aria-label="Hidden balance">
      <span className="text-3xl tracking-[0.2em] text-zinc-300 dark:text-zinc-700">••.••</span>
      <span className="text-sm text-zinc-400 dark:text-zinc-600">{symbol}</span>
    </span>
  );
}

function BalanceCta({
  address,
  isRegistered,
  isOnConnectedChain,
  isDecrypted,
}: {
  address: string | undefined;
  isRegistered: boolean | null;
  isOnConnectedChain: boolean;
  isDecrypted: boolean;
}) {
  if (!address) return null;
  const { href, label } = !isOnConnectedChain
    ? { href: '/console/encrypted-erc/deploy', label: 'Deploy your own' }
    : !isRegistered
      ? { href: '/console/encrypted-erc/register', label: 'Register identity' }
      : { href: '/console/encrypted-erc/balance', label: isDecrypted ? 'Open balance tool' : 'Retry decrypt' };
  return (
    <div className="border-t border-zinc-200 px-4 py-3 dark:border-zinc-800">
      <ArrowLink href={href}>{label}</ArrowLink>
    </div>
  );
}
