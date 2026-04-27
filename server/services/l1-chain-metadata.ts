import l1Chains from '@/constants/l1-chains.json';

interface L1Chain {
  chainId: string;
  chainName: string;
  chainLogoURI?: string;
  subnetId: string;
  slug?: string;
  isTestnet?: boolean;
}

const chains = l1Chains as L1Chain[];

export function getL1ChainName(subnetId: string): string {
  const chain = chains.find((c) => c.subnetId === subnetId);
  return chain?.chainName ?? `L1 (${subnetId.slice(0, 8)}...)`;
}

export function getL1ChainMeta(subnetId: string): { chainName: string; chainLogoURI: string } | null {
  const chain = chains.find((c) => c.subnetId === subnetId);
  if (!chain) return null;
  return { chainName: chain.chainName, chainLogoURI: chain.chainLogoURI ?? '' };
}

export function getAllMainnetSubnetIds(): string[] {
  return chains.filter((c) => !c.isTestnet).map((c) => c.subnetId);
}
