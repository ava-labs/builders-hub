'use client'

import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Copy, RefreshCw, Telescope, Wallet } from "lucide-react";
import { useWalletStore } from "@/stores/walletStore";
import { useSelectedL1 } from "@/stores/l1ListStore";
import { avalanche, avalancheFuji } from "viem/chains";
import { createCoreWalletClient } from "@/coreViem";
import { networkIDs } from "@avalabs/avalanchejs";

export function EVMWallet() {
  const walletEVMAddress = useWalletStore((s) => s.walletEVMAddress);
  const walletChainId = useWalletStore((s) => s.walletChainId);
  const cChainBalance = useWalletStore((s) => s.cChainBalance);
  const l1Balance = useWalletStore((s) => s.l1Balance);
  const updateAllBalances = useWalletStore((s) => s.updateAllBalances);
  const setCoreWalletClient = useWalletStore((s) => s.setCoreWalletClient);
  const setWalletEVMAddress = useWalletStore((s) => s.setWalletEVMAddress);
  const setPChainAddress = useWalletStore((s) => s.setPChainAddress);
  const setCoreEthAddress = useWalletStore((s) => s.setCoreEthAddress);
  const setWalletChainId = useWalletStore((s) => s.setWalletChainId);
  const setIsTestnet = useWalletStore((s) => s.setIsTestnet);
  const setAvalancheNetworkID = useWalletStore((s) => s.setAvalancheNetworkID);

  const selectedL1 = useSelectedL1()();

  const isCChain = walletChainId === avalanche.id || walletChainId === avalancheFuji.id;
  const displayedBalance = isCChain ? cChainBalance : l1Balance;
  const displayedSymbol = isCChain ? 'AVAX' : (selectedL1?.coinName ?? 'Tokens');

  const shortAddr = walletEVMAddress
    ? `${walletEVMAddress.slice(0, 6)}...${walletEVMAddress.slice(-4)}`
    : 'Not connected';

  const openExplorer = () => {
    const url = selectedL1?.explorerUrl;
    if (url) window.open(url, '_blank');
  };

  const copyAddress = async () => {
    if (walletEVMAddress) await navigator.clipboard.writeText(walletEVMAddress);
  };

  const resetConsole = () => {
    try { localStorage.clear(); } catch {}
    location.reload();
  };

  // connectWallet intentionally removed from header EVM wallet when hidden while disconnected

  if (!walletEVMAddress) {
    const connectWallet = async () => {
      if (typeof window === 'undefined') return;
      try {
        if (!window.avalanche?.request) {
          window.open('https://core.app', '_blank');
          return;
        }
        const accounts = await window.avalanche.request<string[]>({ method: 'eth_requestAccounts' });
        if (!accounts || accounts.length === 0) return;
        const account = accounts[0] as `0x${string}`;
        const client = createCoreWalletClient(account);
        if (!client) return;
        setCoreWalletClient(client);
        setWalletEVMAddress(account);
        try {
          const [pAddr, cAddr, chainId, ethChain] = await Promise.all([
            client.getPChainAddress().catch(() => ''),
            client.getCorethAddress().catch(() => ''),
            client.getChainId().catch(() => 0),
            client.getEthereumChain().catch(() => ({ isTestnet: undefined as any, chainName: '' } as any)),
          ]);
          if (pAddr) setPChainAddress(pAddr);
          if (cAddr) setCoreEthAddress(cAddr);
          if (chainId) setWalletChainId(typeof chainId === 'string' ? parseInt(chainId as any, 16) : chainId);
          if (typeof ethChain?.isTestnet === 'boolean') {
            setIsTestnet(ethChain.isTestnet);
            setAvalancheNetworkID(ethChain.isTestnet ? networkIDs.FujiID : networkIDs.MainnetID);
          }
        } catch {}
        updateAllBalances();
      } catch (e) {
        console.error('Error connecting wallet:', e);
      }
    };

    return (
      <Button variant="outline" size="sm" onClick={connectWallet}>
        <div className="flex items-center gap-2">
          <Wallet className="w-4 h-4" />
          <span className="text-sm">Connect Wallet</span>
        </div>
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 w-5 h-5 rounded-md overflow-hidden flex items-center justify-start">
              <Wallet className="w-5 h-5 text-zinc-400 dark:text-zinc-500" />
            </div>
            <div className="flex gap-2 items-center">
              <span className="text-sm font-medium leading-none">
                {shortAddr}
              </span>
              <span className="text-xs text-muted-foreground leading-none">
                {formatBalance(displayedBalance)} {displayedSymbol}
              </span>
            </div>
          </div>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56">
        <DropdownMenuItem onClick={updateAllBalances}>
          <RefreshCw className="mr-2 h-3 w-3" />
          Refresh Balances
        </DropdownMenuItem>
        <DropdownMenuItem onClick={openExplorer}>
          <Telescope className="mr-2 h-3 w-3" />
          View on Explorer
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={copyAddress}>
          <Copy className="mr-2 h-3 w-3" />
          Copy Address
        </DropdownMenuItem>
        <DropdownMenuItem onClick={resetConsole}>
          <RefreshCw className="mr-2 h-3 w-3" />
          Reset Console
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const formatBalance = (balance: number | string) => {
  const num = typeof balance === 'string' ? parseFloat(balance) : balance
  if (isNaN(num)) return "0"
  return num.toFixed(2)
}