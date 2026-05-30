import type { L1Chain } from "@/types/stats";
import l1ChainsData from "@/constants/l1-chains.json";

const chains = l1ChainsData as L1Chain[];

export function getSlugForSubnetId(subnetId: string): string | null {
  const chain = chains.find((c) => c.subnetId === subnetId);
  return chain?.slug || null;
}

export function getValidatorSlugForSubnetId(subnetId: string): string | null {
  const chain = chains.find((c) => c.subnetId === subnetId);
  if (chain?.isTestnet) return null;
  return chain?.slug || null;
}

export function getCategoryForSubnetId(
  subnetId: string,
  subnetName: string
): string {
  const chain = chains.find(
    (c) =>
      c.subnetId === subnetId ||
      c.chainName?.toLowerCase() === subnetName.toLowerCase()
  );
  return chain?.category || "General";
}

function findChainByIdOrName(chainId: string, chainName: string) {
  return chains.find(
    (c) =>
      c.chainId === chainId ||
      c.chainName.toLowerCase() === chainName.toLowerCase()
  );
}

export function getChainSlug(chainId: string, chainName: string): string | null {
  return findChainByIdOrName(chainId, chainName)?.slug || null;
}

export function getValidatorChainSlug(
  chainId: string,
  chainName: string
): string | null {
  const chain = findChainByIdOrName(chainId, chainName);
  if (chain?.isTestnet) return null;
  return chain?.slug || null;
}

export function getChainRpcUrl(
  chainId: string,
  chainName: string
): string | null {
  return findChainByIdOrName(chainId, chainName)?.rpcUrl || null;
}

export function getChainCategory(chainId: string, chainName: string): string {
  return findChainByIdOrName(chainId, chainName)?.category || "General";
}

export function getChainColor(chainId: string, chainName: string): string | null {
  return findChainByIdOrName(chainId, chainName)?.color || null;
}

export function getChainSubnetId(
  chainId: string,
  chainName: string
): string | undefined {
  return findChainByIdOrName(chainId, chainName)?.subnetId;
}

export function generateColorFromName(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = hash % 360;
  return `hsl(${hue}, 70%, 50%)`;
}
