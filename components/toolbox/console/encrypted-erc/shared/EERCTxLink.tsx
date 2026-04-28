import type { ReactNode } from 'react';
import type { Hex } from '@/lib/eerc/types';

const C_CHAIN_FUJI = 43113;
const C_CHAIN_MAINNET = 43114;

function getCChainTxUrl(chainId: number, txHash: string): string | null {
  if (chainId === C_CHAIN_FUJI) return `https://testnet.snowtrace.io/tx/${txHash}`;
  if (chainId === C_CHAIN_MAINNET) return `https://snowtrace.io/tx/${txHash}`;
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
  className = 'underline text-emerald-600 dark:text-emerald-400',
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
