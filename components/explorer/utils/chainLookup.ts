import l1ChainsData from "@/constants/l1-chains.json";
import type { ChainInfo } from "@/components/stats/ChainChip";
import { getL1ListStore, type L1ListItem } from "@/components/toolbox/stores/l1ListStore";
import { convertL1ListItemToL1Chain } from "@/components/explorer/utils/chainConverter";

// Get chain info from hex blockchain ID (checks both static and custom chains)
export function getChainFromBlockchainId(hexBlockchainId: string): ChainInfo | null {
  const normalizedHex = hexBlockchainId.toLowerCase();
  
  // First, check static chains from l1ChainsData
  const staticChain = (l1ChainsData as any[]).find(c => 
    c.blockchainId?.toLowerCase() === normalizedHex
  );
  
  if (staticChain) {
    return {
      chainId: staticChain.chainId,
      chainName: staticChain.chainName,
      chainSlug: staticChain.slug,
      chainLogoURI: staticChain.chainLogoURI || '',
      color: staticChain.color || '#6B7280',
      tokenSymbol: staticChain.networkToken?.symbol || '',
    };
  }
  
  // If not found in static chains, check custom chains from localStorage
  try {
    const testnetStore = getL1ListStore(true);
    const mainnetStore = getL1ListStore(false);
    
    const testnetChains: L1ListItem[] = testnetStore.getState().l1List;
    const mainnetChains: L1ListItem[] = mainnetStore.getState().l1List;
    
    const allCustomChains = [...testnetChains, ...mainnetChains];
    
    // Convert each custom chain and check if blockchainId matches
    for (const customChain of allCustomChains) {
      const converted = convertL1ListItemToL1Chain(customChain);
      if (converted.blockchainId?.toLowerCase() === normalizedHex) {
  return {
          chainId: converted.chainId,
          chainName: converted.chainName,
          chainSlug: converted.slug,
          chainLogoURI: converted.chainLogoURI || '',
          color: converted.color || '#6B7280',
          tokenSymbol: converted.networkToken?.symbol || '',
  };
      }
    }
  } catch (e) {
    // localStorage might not be available (SSR), silently fail
  }
  
  return null;
}
