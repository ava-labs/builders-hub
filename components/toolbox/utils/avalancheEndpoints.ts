/**
 * Avalanche public RPC endpoints for the primary network's P/C/X chains.
 *
 * Use `getPChainRpcUrl(isTestnet)` for any P-Chain JSON-RPC call (e.g.
 * `platform.getTx`) that doesn't go through a wallet. Keeps the
 * mainnet/fuji split in one place so we don't sprinkle ternaries across
 * every wizard step.
 */

export const FUJI_P_CHAIN_RPC = 'https://api.avax-test.network/ext/bc/P' as const;
export const MAINNET_P_CHAIN_RPC = 'https://api.avax.network/ext/bc/P' as const;

export function getPChainRpcUrl(isTestnet: boolean): string {
  return isTestnet ? FUJI_P_CHAIN_RPC : MAINNET_P_CHAIN_RPC;
}

export const FUJI_GLACIER_NETWORK = 'fuji' as const;
export const MAINNET_GLACIER_NETWORK = 'mainnet' as const;

export function getGlacierNetwork(isTestnet: boolean): 'fuji' | 'mainnet' {
  return isTestnet ? FUJI_GLACIER_NETWORK : MAINNET_GLACIER_NETWORK;
}
