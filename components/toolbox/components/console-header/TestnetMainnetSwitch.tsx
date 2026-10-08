'use client';

import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import { avalanche, avalancheFuji } from 'viem/chains';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../ui/dropdown-menu';
import { Check, ChevronDown } from 'lucide-react';
import { useWalletSwitch } from '../../hooks/useWalletSwitch';
import { HEADER_CHIP } from './chip';

export function TestnetMainnetSwitch() {
  const isTestnet = useWalletStore((s) => s.isTestnet);
  const walletEVMAddress = useWalletStore((s) => s.walletEVMAddress);
  const { safelySwitch } = useWalletSwitch();

  if (!walletEVMAddress) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          title={isTestnet ? 'Testnet' : 'Mainnet'}
          className={`${HEADER_CHIP} font-mono text-[11px] font-bold uppercase tracking-[0.14em]`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${isTestnet ? 'bg-amber-500' : 'bg-emerald-500'}`} />
          {/* The dot carries the network on narrow bars; the word joins it when there's room. */}
          <span className="sr-only xl:not-sr-only">{isTestnet ? 'Testnet' : 'Mainnet'}</span>
          <ChevronDown className="h-3 w-3 text-zinc-400" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-44">
        {[
          { label: 'Testnet', dot: 'bg-amber-500', chainId: avalancheFuji.id, testnet: true },
          { label: 'Mainnet', dot: 'bg-emerald-500', chainId: avalanche.id, testnet: false },
        ].map((n) => (
          <DropdownMenuItem
            key={n.label}
            onClick={() => safelySwitch(n.chainId, n.testnet)}
            className="cursor-pointer gap-2.5 px-2"
          >
            <span className={`h-2 w-2 rounded-full ${n.dot}`} />
            <span className="flex-1">{n.label}</span>
            {n.testnet === isTestnet && <Check className="h-3.5 w-3.5 text-emerald-600" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
