import type { L1ListItem } from '@/components/toolbox/stores/l1ListStore';

export type CreateL1ChainStateLike = {
  chainID?: string;
  chainName?: string;
  genesisData?: string;
  evmChainId?: number | null;
};

type ResolveCreateL1RequiredChainInput = {
  createChain: CreateL1ChainStateLike | null | undefined;
  l1List: L1ListItem[];
};

type ResolveCreateL1RequiredChainResult = {
  chainId: number | null;
  chainLabel: string;
  source: 'l1-list' | 'genesis' | 'create-store' | 'missing';
  matchedL1?: L1ListItem;
};

function normalizePositiveChainId(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;

  const parsed =
    typeof value === 'string' && value.trim().toLowerCase().startsWith('0x')
      ? Number.parseInt(value, 16)
      : Number(value);

  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export function parseGenesisEvmChainId(genesisData: string | null | undefined): number | null {
  if (!genesisData || genesisData.startsWith('Error:')) return null;

  try {
    const genesis = JSON.parse(genesisData) as { config?: { chainId?: unknown } };
    return normalizePositiveChainId(genesis.config?.chainId);
  } catch {
    return null;
  }
}

export function resolveCreateL1RequiredChain({
  createChain,
  l1List,
}: ResolveCreateL1RequiredChainInput): ResolveCreateL1RequiredChainResult {
  const chainLabel = createChain?.chainName?.trim() || 'your L1';
  const createdBlockchainId = createChain?.chainID?.trim();

  if (createdBlockchainId) {
    const matchedL1 = l1List.find((l1) => l1.id === createdBlockchainId);
    if (matchedL1) {
      return {
        chainId: matchedL1.evmChainId,
        chainLabel: matchedL1.name || chainLabel,
        source: 'l1-list',
        matchedL1,
      };
    }
  }

  const genesisChainId = parseGenesisEvmChainId(createChain?.genesisData);
  if (genesisChainId !== null) {
    return {
      chainId: genesisChainId,
      chainLabel,
      source: 'genesis',
    };
  }

  const storeChainId = normalizePositiveChainId(createChain?.evmChainId);
  if (storeChainId !== null) {
    return {
      chainId: storeChainId,
      chainLabel,
      source: 'create-store',
    };
  }

  return {
    chainId: null,
    chainLabel,
    source: 'missing',
  };
}
