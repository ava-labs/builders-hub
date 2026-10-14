import { DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { Check, X } from 'lucide-react';
import { L1ListItem } from '@/components/toolbox/stores/l1ListStore';
import { cn } from '@/lib/utils';
import { ChainLogo } from './ChainLogo';

interface NetworkMenuItemProps {
  network: L1ListItem;
  isActive: boolean;
  onSelect: (network: L1ListItem, tokenAddress?: string | null) => void;
  isEditMode?: boolean;
  onRemove?: (network: L1ListItem) => void;
  /** null = balance could not be fetched for this network. */
  balance?: number | string | null;
}

const isCChain = (evmChainId: number | undefined) => evmChainId === 43113 || evmChainId === 43114;

const formatBalance = (balance: number | string | null) => {
  if (balance === null) return 'n/a';
  const num = typeof balance === 'string' ? parseFloat(balance) : balance;
  return isNaN(num) ? '0' : num.toFixed(4);
};

export function NetworkMenuItem({
  network,
  isActive,
  onSelect,
  isEditMode = false,
  onRemove,
  balance = 0,
}: NetworkMenuItemProps) {
  const builtIn = isCChain(network.evmChainId);
  const canRemove = isEditMode && !builtIn && !!onRemove;

  return (
    <DropdownMenuItem
      onSelect={(e) => {
        e.preventDefault();
        if (canRemove) onRemove!(network);
        else if (!isEditMode) onSelect(network, null);
      }}
      disabled={isEditMode && builtIn}
      className={cn('cursor-pointer gap-2.5 px-2 py-1.5', isActive && !isEditMode && 'bg-accent/60')}
    >
      <span className="flex h-5 w-5 shrink-0 items-center justify-center">
        <ChainLogo logoUrl={network.logoUrl} chainName={network.name} />
      </span>
      <span className="min-w-0 flex-1 truncate text-sm">{network.name}</span>
      {isEditMode ? (
        builtIn ? (
          <span className="text-[11px] text-muted-foreground">Built in</span>
        ) : (
          <X className="h-3.5 w-3.5 text-red-500" aria-label={`Remove ${network.name}`} />
        )
      ) : (
        <>
          <span className="shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground">
            {formatBalance(balance)} {network.coinName}
          </span>
          <Check className={cn('h-3.5 w-3.5 shrink-0 text-emerald-600', !isActive && 'invisible')} />
        </>
      )}
    </DropdownMenuItem>
  );
}
