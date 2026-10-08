import { DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Droplets, SquareArrowOutUpRight } from 'lucide-react';
import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import { AddressPanel } from '../../AddressPanel';

interface L1ListItem {
  id: string;
  name: string;
  evmChainId: number;
  coinName: string;
  hasBuilderHubFaucet?: boolean;
  externalFaucetUrl?: string;
}

interface WalletInfoProps {
  walletAddress: string;
  currentNetworkExplorerUrl?: string;
  currentNetwork?: L1ListItem;
  onRefreshBalances: () => unknown;
}

/** The connected address and, on testnet, where to get the current network's token. */
export function WalletInfo({
  walletAddress,
  currentNetworkExplorerUrl,
  currentNetwork,
  onRefreshBalances,
}: WalletInfoProps) {
  const isTestnet = useWalletStore((s) => s.isTestnet);
  const builderHubFaucet = isTestnet && currentNetwork?.hasBuilderHubFaucet;
  const externalFaucet = isTestnet ? currentNetwork?.externalFaucetUrl : undefined;

  return (
    <>
      <DropdownMenuSeparator />
      <AddressPanel
        label="EVM address"
        address={walletAddress}
        onRefresh={onRefreshBalances}
        explorerUrl={currentNetworkExplorerUrl ? `${currentNetworkExplorerUrl}/address/${walletAddress}` : null}
      />
      {(builderHubFaucet || externalFaucet) && (
        <>
          <DropdownMenuSeparator />
          {builderHubFaucet && (
            <DropdownMenuItem
              onSelect={() => (window.location.href = '/console/primary-network/faucet')}
              className="cursor-pointer gap-2.5 px-2"
            >
              <Droplets className="h-3.5 w-3.5" />
              Get test {currentNetwork!.coinName}
            </DropdownMenuItem>
          )}
          {externalFaucet && (
            <DropdownMenuItem
              onSelect={() => (window.location.href = externalFaucet)}
              className="cursor-pointer gap-2.5 px-2"
            >
              <SquareArrowOutUpRight className="h-3.5 w-3.5" />
              Open external faucet
            </DropdownMenuItem>
          )}
        </>
      )}
    </>
  );
}
