'use client';

import Link from 'next/link';
import { ArrowUpRight, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BridgeHeaderProps {
  title?: string;
  subtitle?: string;
  className?: string;
}

export function BridgeHeader({
  title = 'Bridge tokens across Avalanche L1s',
  subtitle = 'Deploy a TokenHome on the origin chain, mirror it on a destination L1, register over Interchain Messaging, fund collateral, and start sending.',
  className,
}: BridgeHeaderProps) {
  return (
    <header className={cn('flex flex-col gap-2', className)}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-red-600 dark:text-red-400">
          <Sparkles className="h-3.5 w-3.5" aria-hidden />
          ICTT Bridge Console
        </div>
        <Link
          href="/console/ictt/legacy/setup"
          className="inline-flex items-center gap-1 text-xs text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          Use legacy version
          <ArrowUpRight className="h-3 w-3" />
        </Link>
      </div>
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">{title}</h1>
      <p className="max-w-2xl text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">{subtitle}</p>
    </header>
  );
}
