'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Activity, Check, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import { ExplorerMenu } from '@/components/console/ExplorerMenu';
import { toast } from '@/lib/toast';
import type { CombinedL1 } from '../_lib/types';

export function DetailHeader({ l1 }: { l1: CombinedL1 }) {
  const nodeCount = l1.nodes?.length ?? 0;
  // Show wallet balance only when the wallet is currently connected to this
  // L1 — otherwise the cached number in the store may be from a different
  // chain and would mislead. Reading via a selector to avoid re-rendering
  // when unrelated balances change.
  const walletChainId = useWalletStore((s) => s.walletChainId);
  const balance = useWalletStore((s) =>
    l1.evmChainId !== null && walletChainId === l1.evmChainId
      ? s.balances.l1Chains[String(l1.evmChainId)] ?? null
      : null,
  );
  const isWalletOnThisL1 = l1.evmChainId !== null && walletChainId === l1.evmChainId;

  return (
    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
      <div className="flex items-start gap-3 min-w-0">
        {l1.logoUrl && (
          <img
            src={l1.logoUrl}
            alt={l1.chainName}
            className="w-10 h-10 rounded-lg object-contain bg-muted p-1 shrink-0"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
        )}
        <div className="min-w-0">
          <h2 className="text-xl font-semibold text-foreground truncate">{l1.chainName}</h2>
          <p className="text-sm text-muted-foreground">
            Chain ID: {l1.evmChainId ?? '—'} · {l1.isTestnet ? 'Testnet' : 'Mainnet'}
            {l1.source === 'managed' && (
              <>
                {' · '}
                {nodeCount} managed node{nodeCount === 1 ? '' : 's'}
              </>
            )}
            {l1.source === 'wallet' && ' · Added to wallet'}
            {l1.coinName && (
              <>
                {' · '}
                {l1.coinName}
              </>
            )}
          </p>
          {isWalletOnThisL1 && balance !== null && (
            <p className="text-sm text-foreground mt-1">
              <span className="text-muted-foreground">Your balance:</span>{' '}
              <span className="font-mono">
                {balance.toFixed(4)} {l1.coinName ?? ''}
              </span>
            </p>
          )}
        </div>
      </div>
      <div className="flex flex-wrap gap-2 shrink-0">
        <Link href={`/console/my-l1/stats/${l1.evmChainId ?? l1.subnetId}`}>
          <Button variant="outline" size="sm">
            <Activity className="w-4 h-4 mr-2" />
            View Stats
          </Button>
        </Link>
        <ExplorerMenu
          evmChainId={l1.evmChainId}
          isTestnet={l1.isTestnet}
          customExplorerUrl={l1.explorerUrl}
        />
        <CopyChainConfigButton l1={l1} />
      </div>
    </div>
  );
}

// Copies the L1's wagmi/viem-friendly chain config as JSON. Handy when the
// user wants to plug the L1 into another tool (Hardhat, Foundry, a custom
// dApp) without retyping the RPC URL + chain ID + native currency by hand.
function CopyChainConfigButton({ l1 }: { l1: CombinedL1 }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const config = {
      chainId: l1.evmChainId,
      chainName: l1.chainName,
      rpcUrls: [l1.rpcUrl],
      nativeCurrency: l1.coinName
        ? { name: l1.coinName, symbol: l1.coinName, decimals: 18 }
        : undefined,
      blockExplorerUrls: l1.explorerUrl ? [l1.explorerUrl] : undefined,
      subnetId: l1.subnetId,
      blockchainId: l1.blockchainId,
      isTestnet: l1.isTestnet,
    };
    try {
      await navigator.clipboard.writeText(JSON.stringify(config, null, 2));
      setCopied(true);
      toast.success('Chain config copied', 'Paste into Hardhat / Foundry / your wallet config.');
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      toast.error(
        'Could not copy',
        err instanceof Error ? err.message : 'Clipboard unavailable',
      );
    }
  };

  return (
    <Button variant="outline" size="sm" onClick={handleCopy}>
      {copied ? <Check className="w-4 h-4 mr-2 text-green-500" /> : <Copy className="w-4 h-4 mr-2" />}
      Copy Config
    </Button>
  );
}
