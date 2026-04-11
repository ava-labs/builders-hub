'use client';

import { useEffect, useState, useMemo } from 'react';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent } from '@/components/ui/dropdown-menu';
import { useL1ListStore } from '@/components/toolbox/stores/l1ListStore';
import { Button } from '@/components/ui/button';
import { useConnectModal } from '@rainbow-me/rainbowkit';
import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import { createPublicClient, http, formatUnits } from 'viem';
import { avalancheFuji, avalanche } from 'viem/chains';
import { Wallet } from 'lucide-react';

import { useNetworkData } from './hooks/useNetworkData';
import { useNetworkActions } from './hooks/useNetworkActions';
import { NetworkList } from './components/NetworkList';
import { NetworkActions } from './components/NetworkActions';
import { WalletInfo } from './components/WalletInfo';
import { ChainLogo } from './components/ChainLogo';

// ERC20 ABI for balanceOf
const ERC20_BALANCE_ABI = [
  {
    inputs: [{ name: 'account', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

export function EvmNetworkWallet() {
  const [isEditMode, setIsEditMode] = useState(false);
  const [tokenBalance, setTokenBalance] = useState<string | null>(null);

  const l1ListStore = useL1ListStore();
  const removeL1 = l1ListStore((s: any) => s.removeL1);
  const { selectedToken, walletChainId } = useWalletStore();

  const { currentNetwork, getNetworkBalance, isNetworkActive, walletEVMAddress } = useNetworkData();

  const l1List = l1ListStore((s: any) => s.l1List);

  // Find the selected token info
  const selectedTokenInfo = useMemo(() => {
    if (!selectedToken || !currentNetwork) return null;
    return currentNetwork.wellKnownERC20s?.find((t: any) => t.address === selectedToken) || null;
  }, [selectedToken, currentNetwork]);

  const { handleNetworkChange, copyAddress, openExplorer, updateAllBalances } = useNetworkActions();

  const { openConnectModal } = useConnectModal();

  // Fetch selected token balance
  useEffect(() => {
    const fetchTokenBalance = async () => {
      if (!selectedTokenInfo || !walletEVMAddress || !walletChainId) {
        setTokenBalance(null);
        return;
      }

      try {
        const chain = walletChainId === 43113 ? avalancheFuji : walletChainId === 43114 ? avalanche : null;
        if (!chain) return;

        const publicClient = createPublicClient({
          chain,
          transport: http(),
        });

        const balance = await publicClient.readContract({
          address: selectedTokenInfo.address as `0x${string}`,
          abi: ERC20_BALANCE_ABI,
          functionName: 'balanceOf',
          args: [walletEVMAddress as `0x${string}`],
        });

        setTokenBalance(formatUnits(balance, selectedTokenInfo.decimals));
      } catch (err) {
        console.error(`Error fetching ${selectedTokenInfo.symbol} balance:`, err);
        setTokenBalance('0');
      }
    };

    fetchTokenBalance();
  }, [selectedTokenInfo, walletEVMAddress, walletChainId]);

  const handlePrimaryButtonClick = (): void => {
    openConnectModal?.();
  };

  const handleRemoveNetwork = (network: any) => {
    removeL1(network.id);
  };

  // Show connect wallet button if no wallet is connected
  if (!walletEVMAddress) {
    return (
      <Button onClick={handlePrimaryButtonClick} size="sm">
        <Wallet className="mr-2 h-4 w-4" />
        <span className="text-sm">Connect Wallet</span>
      </Button>
    );
  }
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm">
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0 w-5 h-5 flex items-center justify-start">
                {selectedTokenInfo ? (
                  <img
                    src={selectedTokenInfo.logoUrl}
                    alt={selectedTokenInfo.symbol}
                    className="w-5 h-5 rounded-full"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                ) : (
                  <ChainLogo logoUrl={(currentNetwork as any)?.logoUrl} chainName={currentNetwork.name} />
                )}
              </div>
              <div className="flex gap-2 items-center">
                <span className="text-sm font-medium leading-none">
                  {selectedTokenInfo ? selectedTokenInfo.symbol : currentNetwork.name}
                </span>
                <span className="text-xs text-muted-foreground leading-none">
                  {selectedTokenInfo && tokenBalance !== null
                    ? parseFloat(tokenBalance).toFixed(2)
                    : `${typeof currentNetwork.balance === 'string' ? parseFloat(currentNetwork.balance).toFixed(4) : (currentNetwork.balance || 0).toFixed(4)} ${(currentNetwork as any).coinName}`}
                </span>
              </div>
            </div>
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-60">
          <NetworkList
            availableNetworks={l1List || []}
            getNetworkBalance={getNetworkBalance}
            isNetworkActive={isNetworkActive}
            onNetworkSelect={handleNetworkChange}
            onNetworkRemove={handleRemoveNetwork}
            isEditMode={isEditMode}
          />

          <NetworkActions isEditMode={isEditMode} onToggleEditMode={() => setIsEditMode((v) => !v)} />

          <WalletInfo
            walletAddress={walletEVMAddress || ''}
            currentNetworkExplorerUrl={(currentNetwork as any)?.explorerUrl}
            currentNetwork={currentNetwork as any}
            onCopyAddress={copyAddress}
            onRefreshBalances={updateAllBalances}
            onOpenExplorer={openExplorer}
          />
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}

export default EvmNetworkWallet;
