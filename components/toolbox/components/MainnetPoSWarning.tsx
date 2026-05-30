'use client';

import { AlertTriangle } from 'lucide-react';
import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import Link from 'next/link';

/**
 * Slim warning banner for mainnet PoS flows. Hidden on testnet.
 */
export function MainnetPoSWarning() {
  const isTestnet = useWalletStore((s) => s.isTestnet);

  if (isTestnet) return null;

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20 mb-4">
      <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
      <p className="text-xs text-amber-800 dark:text-amber-200 leading-relaxed">
        <strong>Mainnet PoS</strong> — permissionless staking is irreversible.{' '}
        <Link
          href="/docs/avalanche-l1s/validator-manager/contract"
          className="underline hover:text-amber-900 dark:hover:text-amber-100"
        >
          Read the docs
        </Link>{' '}
        before proceeding.
      </p>
    </div>
  );
}
