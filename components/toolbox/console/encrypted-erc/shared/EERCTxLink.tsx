import type { ReactNode } from 'react';
import type { Hex } from '@/lib/eerc/types';

const C_CHAIN_FUJI = 43113;
const C_CHAIN_MAINNET = 43114;

function getCChainTxUrl(chainId: number, txHash: string): string | null {
  // Fuji C-Chain isn't fully served by our explorer yet — keep it on Snowtrace.
  if (chainId === C_CHAIN_FUJI) return `https://testnet.snowtrace.io/tx/${txHash}`;
  if (chainId === C_CHAIN_MAINNET) return `/explorer/mainnet/c-chain/tx/${txHash}`;
  return null;
}

interface EERCTxLinkProps {
  chainId: number;
  txHash: Hex | string;
  children: ReactNode;
  className?: string;
}

export function EERCTxLink({
  chainId,
  txHash,
  children,
  className = 'font-mono text-zinc-900 underline decoration-zinc-300 underline-offset-4 transition-colors hover:decoration-[#E6212F] dark:text-zinc-50 dark:decoration-zinc-600 dark:hover:decoration-[#E6212F]',
}: EERCTxLinkProps) {
  const url = getCChainTxUrl(chainId, txHash);

  if (!url) {
    return (
      <span
        className={`${className} cursor-help no-underline`}
        title="No explorer URL is configured for this custom L1"
      >
        {children}
      </span>
    );
  }

  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className={className}>
      {children}
    </a>
  );
}
