'use client';

import { AlertTriangle } from 'lucide-react';
import type { L1ListItem } from '@/components/toolbox/stores/l1ListStore';
import { Button } from '@/components/toolbox/components/Button';

interface ChainMismatchBannerProps {
  expectedChain: L1ListItem;
  walletChainId: number;
  onSwitch?: () => void;
  switching?: boolean;
}

export function ChainMismatchBanner({
  expectedChain,
  walletChainId,
  onSwitch,
  switching,
}: ChainMismatchBannerProps) {
  if (walletChainId === expectedChain.evmChainId) return null;

  return (
    <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50/60 dark:border-amber-900/60 dark:bg-amber-950/30 px-3.5 py-3">
      <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
          Wrong chain for this action
        </p>
        <p className="text-xs text-amber-700/80 dark:text-amber-400/80 mt-0.5 leading-relaxed">
          Switch your wallet to <strong>{expectedChain.name}</strong> (chain id {expectedChain.evmChainId}) to continue.
        </p>
      </div>
      {onSwitch && (
        <Button
          size="sm"
          variant="outline"
          onClick={onSwitch}
          loading={switching}
          loadingText="Switching..."
          stickLeft
        >
          Switch
        </Button>
      )}
    </div>
  );
}
