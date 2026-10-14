import type { Abi } from 'viem';

export interface StudioContract {
  address: `0x${string}`;
  abi: Abi;
  chainId: number | null;
  network: string;
  explorerUrl: string | null;
}

export interface StudioChain {
  name: string;
  rpcUrl: string | null;
  explorerUrl: string | null;
  nativeCurrency: { name: string; symbol: string; decimals: number };
}

export interface StudioToken {
  address: `0x${string}`;
  symbol: string | null;
  name: string | null;
  decimals: number | null;
  logoURI: string | null;
  source: 'registry' | 'coingecko' | 'project';
}

/** What the app was built against, written by Builder Hub Studio at export time. */
export interface StudioConfig {
  title: string;
  contracts: Record<string, StudioContract>;
  chains: Record<number, StudioChain>;
  /** Token list per chain id, so token pickers work without any Builder Hub service. */
  tokens: Record<number, StudioToken[]>;
}

export interface AppScript {
  /** Absolute or /app/... URL; absent for inline code. */
  src?: string;
  code?: string;
  type?: string;
}
