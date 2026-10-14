import registry from '@/blueprints/_shared/networks.json';
import type { FundChain } from './useChainFunds';

type RegistryEntry = {
  name: string;
  testnet: boolean;
  evmChainId: number | null;
  rpcUrl: string | null;
  explorerUrl?: string | null;
  nativeCurrency: { symbol: string; decimals: number } | null;
  faucets?: Record<string, string>;
};

export const NETWORKS = registry.networks as unknown as Record<string, RegistryEntry>;

/** A Builder Hub catalog chain, with its public RPC and faucets, ready to fund. */
export function catalogChain(key: string): FundChain | null {
  const entry = NETWORKS[key];
  if (!entry || entry.evmChainId === null || !entry.rpcUrl || !entry.nativeCurrency) return null;
  return {
    chainId: entry.evmChainId,
    name: entry.name,
    rpcUrl: entry.rpcUrl,
    explorerUrl: entry.explorerUrl ?? null,
    nativeCurrency: { name: entry.nativeCurrency.symbol, ...entry.nativeCurrency },
    testnet: entry.testnet,
    faucets: entry.faucets,
  };
}

/** Every testnet in the catalog: what a wallet can be funded on outside any project. */
export const TESTNET_CHAINS: FundChain[] = Object.entries(NETWORKS)
  .filter(([, e]) => e.testnet)
  .map(([key]) => catalogChain(key))
  .filter((c): c is FundChain => c !== null);
