// Thin TypeScript wrapper over the contract registry JSON.
// The actual data lives in data/contract-registry.json for easier review and contribution.

import registryData from '@/data/contract-registry.json';

export interface ContractInfo {
  address: string;
  name: string;
  protocol: string;
  category: 'dex' | 'lending' | 'derivatives' | 'bridge' | 'nft' | 'yield' | 'gaming' | 'rwa' | 'token' | 'infrastructure' | 'icm' | 'mev' | 'other';
  type: 'router' | 'factory' | 'pool' | 'vault' | 'token' | 'staking' | 'rewards' | 'orderbook' | 'controller' | 'other';
  subcategory?: 'arbitrage' | 'jit' | 'heavy-arb' | 'flash-loan-arb' | 'market-maker' | 'high-frequency' | 'sandwich' | 'backrunner' | 'yield' | 'executor';
}

// Build the registry from JSON — keyed by lowercase address
export const CONTRACT_REGISTRY: Record<string, ContractInfo> = {};
for (const entry of registryData.contracts) {
  CONTRACT_REGISTRY[entry.address] = entry as ContractInfo;
}

// Protocol slug mapping for linking to dApp pages
export const PROTOCOL_SLUGS: Record<string, string> = registryData.protocolSlugs as Record<string, string>;

// --- Utility functions ---

export function getContractInfo(address: string): ContractInfo | undefined {
  return CONTRACT_REGISTRY[address.toLowerCase()];
}

export function getProtocolContracts(protocolName: string): {
  name: string;
  slug: string | null;
  category: string;
  contracts: ContractInfo[];
} | null {
  const contracts = Object.values(CONTRACT_REGISTRY).filter(
    (c) => c.protocol === protocolName
  );
  if (contracts.length === 0) return null;

  const slug = PROTOCOL_SLUGS[protocolName] || null;
  const category = contracts[0].category;

  return { name: protocolName, slug, category, contracts };
}

export function isRouter(address: string): boolean {
  return getContractInfo(address)?.type === 'router';
}

export function isToken(address: string): boolean {
  return getContractInfo(address)?.type === 'token';
}

export function isPool(address: string): boolean {
  return getContractInfo(address)?.type === 'pool';
}
