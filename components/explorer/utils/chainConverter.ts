import { L1Chain } from "@/types/stats";
import { L1ListItem } from "@/components/toolbox/stores/l1ListStore";

/**
 * Converts an L1ListItem (from localStorage/console) to L1Chain format (for explorer)
 */
export function convertL1ListItemToL1Chain(item: L1ListItem): L1Chain {
  // Generate a URL-safe slug from the chain name or use evmChainId as fallback
  const slug = generateSlug(item.name) || `custom-${item.evmChainId}`;
  
  return {
    chainId: String(item.evmChainId),
    chainName: item.name,
    chainLogoURI: item.logoUrl || "",
    subnetId: item.subnetId,
    slug,
    color: "#3B82F6", // Default blue color for custom chains
    category: "Custom",
    description: item.description,
    rpcUrl: item.rpcUrl,
    tokenSymbol: item.nativeCurrency?.symbol || item.coinName,
    explorers: item.explorerUrl 
      ? [{ name: "Explorer", link: item.explorerUrl }] 
      : [],
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

