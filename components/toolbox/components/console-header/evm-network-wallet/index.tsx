'use client';

import { useState } from 'react';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent } from '@/components/ui/dropdown-menu';
import { useL1ListStore } from '@/components/toolbox/stores/l1ListStore';
import { HEADER_CHIP, HEADER_FIGURE, HEADER_PRIMARY } from '../chip';
import { useConnectModal } from '@rainbow-me/rainbowkit';
import { Wallet } from 'lucide-react';

import { useNetworkData } from './hooks/useNetworkData';
import { useNetworkActions } from './hooks/useNetworkActions';
import { NetworkList } from './components/NetworkList';
import { WalletInfo } from './components/WalletInfo';
import { ChainLogo } from './components/ChainLogo';

export function EvmNetworkWallet() {
  const [isEditMode, setIsEditMode] = useState(false);

  const l1ListStore = useL1ListStore();
  const removeL1 = l1ListStore((s: any) => s.removeL1);

  const { currentNetwork, getNetworkBalance, isNetworkActive, walletEVMAddress } = useNetworkData();

  const l1List = l1ListStore((s: any) => s.l1List);

  const { handleNetworkChange, updateAllBalances } = useNetworkActions();

  const { openConnectModal } = useConnectModal();

  const handlePrimaryButtonClick = (): void => {
    openConnectModal?.();
  };

  const handleRemoveNetwork = (network: any) => {
    removeL1(network.id);
  };

  if (!walletEVMAddress) {
    return (
      <button type="button" onClick={handlePrimaryButtonClick} className={HEADER_PRIMARY}>
        <Wallet className="h-3.5 w-3.5" />
        Connect wallet
      </button>
    );
  }
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button" title={currentNetwork.name} className={HEADER_CHIP}>
            <ChainLogo
              logoUrl={(currentNetwork as any)?.logoUrl}
              chainName={currentNetwork.name}
              className="shrink-0"
            />
            <span className="sr-only max-w-32 truncate xl:not-sr-only">{currentNetwork.name}</span>
            <span className={HEADER_FIGURE}>
              {currentNetwork.balance === null
                ? `n/a ${(currentNetwork as any).coinName}`
                : `${typeof currentNetwork.balance === 'string' ? parseFloat(currentNetwork.balance).toFixed(4) : (currentNetwork.balance || 0).toFixed(4)} ${(currentNetwork as any).coinName}`}
            </span>
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-72">
          <NetworkList
            availableNetworks={l1List || []}
            getNetworkBalance={getNetworkBalance}
            isNetworkActive={isNetworkActive}
            onNetworkSelect={handleNetworkChange}
            onNetworkRemove={handleRemoveNetwork}
            isEditMode={isEditMode}
            onToggleEditMode={() => setIsEditMode((v) => !v)}
          />

          <WalletInfo
            walletAddress={walletEVMAddress || ''}
            currentNetworkExplorerUrl={(currentNetwork as any)?.explorerUrl}
            currentNetwork={currentNetwork as any}
            onRefreshBalances={updateAllBalances}
          />
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}

export default EvmNetworkWallet;
