import { L1Chain } from "@/types/stats";
import { L1ListItem } from "@/components/toolbox/stores/l1ListStore";
import { cb58ToHex } from "@/components/tools/common/utils/cb58";

/**
 * Converts an L1ListItem (from localStorage/console) to L1Chain format (for explorer)
 */
export function convertL1ListItemToL1Chain(item: L1ListItem): L1Chain {
  // Use blockchain ID (item.id) as slug for custom chains - it's unique
  // This ensures custom chains have stable, unique URLs
  const slug = item.id;
  
  const symbol = item.nativeCurrency?.symbol || item.coinName || "N/A";
  
  return {
    chainId: String(item.evmChainId),
    chainName: item.name,
    chainLogoURI: item.logoUrl || "",
    blockchainId: cb58ToHex(item.id), // The L1ListItem.id IS the blockchain ID (cb58 format)
    subnetId: item.subnetId,
    slug,
    color: "#3B82F6", // Default blue color for console chains
    description: item.description,
    rpcUrl: item.rpcUrl,
    networkToken: {
      name: item.nativeCurrency?.name || item.coinName || symbol,
      symbol,
      decimals: item.nativeCurrency?.decimals || 18,
    },
    explorers: item.explorerUrl 
      ? [{ name: "Explorer", link: item.explorerUrl }] 
      : [],
    isTestnet: item.isTestnet,
  };
}

/**
 * Generate a URL-safe slug from a chain name
 */
export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Find a custom chain by slug from L1ListItems
 * Supports matching by:
 * - Generated slug from name
 * - evmChainId (as string)
 * - blockchain ID (the 'id' field)
 */
export function findCustomChainBySlug(
  items: L1ListItem[],
  slug: string
): L1ListItem | undefined {
  return items.find((item) => {
    const generatedSlug = generateSlug(item.name);
    return (
      generatedSlug === slug ||
      String(item.evmChainId) === slug ||
      item.id === slug
    );
  });
}

