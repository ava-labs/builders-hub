export type AvalancheProvider = { request: <T = unknown>(args: { method: string; params?: unknown }) => Promise<T> };

let providerOverride: AvalancheProvider | null = null;

/**
 * The provider P-Chain operations go through: Core's window.avalanche, or a Console wallet chosen in the top bar.
 * WalletSync sets the override when the connected connector is a Console wallet and clears it otherwise.
 */
export function setAvalancheProviderOverride(provider: AvalancheProvider | null) {
  providerOverride = provider;
}

/** Core's window.avalanche, or the Console wallet the top bar connected. */
export function avalancheProvider(): AvalancheProvider | null {
  if (providerOverride) return providerOverride;
  if (typeof window === 'undefined' || !window.avalanche || typeof window.avalanche !== 'object') return null;
  return window.avalanche as unknown as AvalancheProvider;
}
