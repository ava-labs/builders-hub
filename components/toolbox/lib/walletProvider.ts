export type Eip1193Provider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, listener: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, listener: (...args: unknown[]) => void) => void;
  isAvalanche?: boolean;
  providers?: Eip1193Provider[];
  selectedProvider?: Eip1193Provider;
};

export type WalletConnectorLike = {
  getProvider?: () => unknown | Promise<unknown>;
};

export type WalletTypeLike = 'core' | 'generic-evm' | null | undefined;

function hasRequest(value: unknown): value is Eip1193Provider {
  return !!value && typeof value === 'object' && typeof (value as Eip1193Provider).request === 'function';
}

function normalizeProvider(value: unknown): Eip1193Provider | null {
  if (hasRequest(value)) return value;

  const maybeProvider = value as Eip1193Provider | null | undefined;
  if (hasRequest(maybeProvider?.selectedProvider)) return maybeProvider.selectedProvider;

  const providerFromList = maybeProvider?.providers?.find(hasRequest);
  return providerFromList ?? null;
}

export function getWindowWalletProviders(): {
  avalanche: Eip1193Provider | null;
  ethereum: Eip1193Provider | null;
} {
  if (typeof window === 'undefined') {
    return { avalanche: null, ethereum: null };
  }

  return {
    avalanche: normalizeProvider((window as any).avalanche),
    ethereum: normalizeProvider((window as any).ethereum),
  };
}

export async function resolveActiveWalletProvider({
  connector,
  walletType,
}: {
  connector?: WalletConnectorLike | null;
  walletType?: WalletTypeLike;
}): Promise<Eip1193Provider | null> {
  try {
    const connectorProvider = normalizeProvider(await connector?.getProvider?.());
    if (connectorProvider) return connectorProvider;
  } catch {
    // Fall back to the wallet type hint below.
  }

  const { avalanche, ethereum } = getWindowWalletProviders();
  if (walletType === 'core') return avalanche;
  if (walletType === 'generic-evm') return ethereum;

  return ethereum ?? avalanche;
}

export function parseProviderChainId(value: unknown): number | null {
  const parsed = typeof value === 'string' ? Number.parseInt(value, 16) : Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export async function readWalletProviderChainId(provider: Eip1193Provider | null | undefined): Promise<number | null> {
  if (!provider?.request) return null;

  try {
    return parseProviderChainId(await provider.request({ method: 'eth_chainId' }));
  } catch {
    return null;
  }
}
