'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Activity, Check, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import { ExplorerMenu } from '@/components/console/ExplorerMenu';
import { toast } from '@/lib/toast';
import type { CombinedL1 } from '../_lib/types';
import { WalletNetworkAction } from './WalletNetworkAction';

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

  // First letter of chain name, used as a fallback avatar when no logoUrl.
  // Stable hash of subnetId picks one of a few neutral hues so different
  // L1s look distinct without us picking a color per chain by hand.
  const initial = l1.chainName?.charAt(0).toUpperCase() ?? '?';
  const fallbackTint = pickFallbackTint(l1.subnetId);

  return (
    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
      <div className="flex items-center gap-3.5 min-w-0">
        <ChainLogo
          logoUrl={l1.logoUrl}
          chainName={l1.chainName}
          initial={initial}
          fallbackTint={fallbackTint}
        />
        <div className="min-w-0">
          <h2 className="text-2xl font-semibold tracking-tight text-foreground truncate">
            {l1.chainName}
          </h2>
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
        {/* Primary action when the wallet isn't on this L1. Renders nothing
            otherwise — replaces the old full-width banner. */}
        <WalletNetworkAction l1={l1} />
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

// Compact chain avatar: tries the wallet-provided logoUrl, falls back to a
// tinted initial when the logo is missing or 404s. Lifts the page header
// from "small icon next to text" to a real visual anchor without needing
// every L1 to have a logo asset.
function ChainLogo({
  logoUrl,
  chainName,
  initial,
  fallbackTint,
}: {
  logoUrl?: string;
  chainName: string;
  initial: string;
  fallbackTint: { bg: string; text: string };
}) {
  const [imgFailed, setImgFailed] = useState(false);
  const showImg = logoUrl && !imgFailed;
  return (
    <div
      className="w-11 h-11 rounded-xl shrink-0 ring-1 ring-border bg-muted flex items-center justify-center overflow-hidden"
      aria-hidden={showImg ? undefined : true}
    >
      {showImg ? (
        <img
          src={logoUrl}
          alt={chainName}
          className="w-full h-full object-contain p-1"
          onError={() => setImgFailed(true)}
        />
      ) : (
        <div
          className={`w-full h-full flex items-center justify-center text-base font-semibold ${fallbackTint.bg} ${fallbackTint.text}`}
        >
          {initial}
        </div>
      )}
    </div>
  );
}

// Tiny stable hash → pick one of 5 muted tints for the fallback avatar.
// Different L1s read as different swatches without us spending design
// energy on per-chain branding.
const FALLBACK_TINTS = [
  { bg: 'bg-rose-500/10 dark:bg-rose-500/15', text: 'text-rose-700 dark:text-rose-300' },
  { bg: 'bg-emerald-500/10 dark:bg-emerald-500/15', text: 'text-emerald-700 dark:text-emerald-300' },
  { bg: 'bg-sky-500/10 dark:bg-sky-500/15', text: 'text-sky-700 dark:text-sky-300' },
  { bg: 'bg-amber-500/10 dark:bg-amber-500/15', text: 'text-amber-700 dark:text-amber-300' },
  { bg: 'bg-violet-500/10 dark:bg-violet-500/15', text: 'text-violet-700 dark:text-violet-300' },
];

function pickFallbackTint(seed: string): (typeof FALLBACK_TINTS)[number] {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return FALLBACK_TINTS[hash % FALLBACK_TINTS.length];
}
