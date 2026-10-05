import { defineChain, type Chain } from 'viem';
import { avalancheFuji } from 'viem/chains';
import { getL1ListStore, type L1ListItem } from '@/components/toolbox/stores/l1ListStore';

export const FUJI_C_CHAIN_ID = 43113;

export function findFaucetChain(chainId: number): L1ListItem | undefined {
  return getL1ListStore(true)
    .getState()
    .l1List.find((chain: L1ListItem) => chain.evmChainId === chainId && chain.hasBuilderHubFaucet);
}

export function createFaucetViemChain(l1Data: L1ListItem): Chain {
  if (l1Data.evmChainId === FUJI_C_CHAIN_ID) {
    return avalancheFuji;
  }

  return defineChain({
    id: l1Data.evmChainId,
    name: l1Data.name,
    nativeCurrency: {
      decimals: 18,
      name: l1Data.coinName,
      symbol: l1Data.coinName,
    },
    rpcUrls: {
      default: { http: [l1Data.rpcUrl] },
    },
    blockExplorers: l1Data.explorerUrl
      ? { default: { name: 'Explorer', url: l1Data.explorerUrl } }
      : undefined,
  });
}
