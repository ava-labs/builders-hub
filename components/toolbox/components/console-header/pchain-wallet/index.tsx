'use client';

import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { HEADER_CHIP, HEADER_FIGURE } from '../chip';
import { ArrowLeftRight } from 'lucide-react';
import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import { AddressPanel } from '../AddressPanel';
import { PChainFaucetMenuItem } from './components/PChainFaucetMenuItem';

const P_CHAIN_LOGO =
  'https://images.ctfassets.net/gcj8jwzm6086/42aMwoCLblHOklt6Msi6tm/1e64aa637a8cead39b2db96fe3225c18/pchain-square.svg';

export function WalletPChain() {
  const pChainAddress = useWalletStore((s) => s.pChainAddress);
  const pChainBalance = useWalletStore((s) => s.balances.pChain);
  const updatePChainBalance = useWalletStore((s) => s.updatePChainBalance);
  const walletEVMAddress = useWalletStore((s) => s.walletEVMAddress);
  const isTestnet = useWalletStore((s) => s.isTestnet);

  if (!walletEVMAddress || !pChainAddress) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" title="P-Chain" className={HEADER_CHIP}>
          <img src={P_CHAIN_LOGO} alt="" className="h-5 w-5 shrink-0 rounded-md object-cover" />
          <span className="sr-only xl:not-sr-only">P-Chain</span>
          <span className={HEADER_FIGURE}>{formatBalance(pChainBalance)} AVAX</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <div className="flex items-baseline justify-between px-2 pb-1 pt-1.5">
          <span className="text-[11px] font-medium text-muted-foreground">P-Chain</span>
          <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
            {formatBalance(pChainBalance)} AVAX
          </span>
        </div>
        <AddressPanel
          label="P-Chain address"
          address={pChainAddress}
          onRefresh={updatePChainBalance}
          explorerUrl={`/explorer/${isTestnet ? 'fuji' : 'mainnet'}/p-chain/address/${pChainAddress}`}
        />
        <DropdownMenuSeparator />
        <PChainFaucetMenuItem />
        <DropdownMenuItem
          onSelect={() => (window.location.href = '/console/primary-network/c-p-bridge')}
          className="cursor-pointer gap-2.5 px-2"
        >
          <ArrowLeftRight className="h-3.5 w-3.5" />
          Bridge AVAX from C-Chain
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const formatBalance = (balance: number | string) => {
  const num = typeof balance === 'string' ? parseFloat(balance) : balance;
  if (isNaN(num)) return '0';
  return num.toFixed(2);
};
