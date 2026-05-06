import type { L1ListItem } from '@/components/toolbox/stores/l1ListStore';

export const C_CHAIN_FUJI = 43113;
export const C_CHAIN_MAINNET = 43114;
export const C_CHAIN_IDS = new Set([C_CHAIN_FUJI, C_CHAIN_MAINNET]);

export type L1DashboardConnection = {
  effectiveChainId: number;
  isConnectedToCChain: boolean;
  currentL1: L1ListItem | null;
};

export function findL1ByEvmChainId(chainId: number, l1Lists: L1ListItem[][]): L1ListItem | null {
  for (const l1List of l1Lists) {
    const match = l1List.find((l1) => l1.evmChainId === chainId);
    if (match) return match;
  }

  return null;
}

export function resolveL1DashboardConnection({
  isConnected,
  walletChainId,
  liveChainId,
  l1Lists,
}: {
  isConnected: boolean;
  walletChainId: number;
  liveChainId?: number | null;
  l1Lists: L1ListItem[][];
}): L1DashboardConnection {
  const effectiveChainId = liveChainId && liveChainId > 0 ? liveChainId : walletChainId;
  const isConnectedToCChain = isConnected && C_CHAIN_IDS.has(effectiveChainId);

  return {
    effectiveChainId,
    isConnectedToCChain,
    currentL1:
      isConnected && effectiveChainId > 0 && !isConnectedToCChain
        ? findL1ByEvmChainId(effectiveChainId, l1Lists)
        : null,
  };
}
