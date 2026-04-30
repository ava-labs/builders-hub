import type { L1ListItem } from '@/components/toolbox/stores/l1ListStore';
import type { MyL1 } from '@/hooks/useMyL1s';

export const PRIMARY_NETWORK_SUBNET_ID = '11111111111111111111111111111111LpoYY';

/** True for the Avalanche Primary Network (C-Chain in this dashboard's
 *  context — the wallet store seeds Fuji + Mainnet C-Chain entries with
 *  this subnet ID). Used to gate sections that don't apply to the Primary
 *  Network: Setup Progress, Precompiles, managed-node fleet, VMC type
 *  detection. C-Chain renders as a normal wallet entry otherwise. */
export function isPrimaryNetwork(l1: { subnetId: string }): boolean {
  return l1.subnetId === PRIMARY_NETWORK_SUBNET_ID;
}

// Combined view across both sources: server-backed NodeRegistration rows
// (managed) and the wallet's local l1ListStore (wallet-only). Managed
// entries take precedence on collision but get enriched with the wallet's
// L1ListItem metadata when available (validator manager, teleporter, etc.)
// so Setup Progress can reflect what's actually deployed.
//
// C-Chain entries (Fuji + Mainnet) come through as `source: 'wallet'`
// since they're seeded into l1ListStore by default; they're identified
// downstream via `isPrimaryNetwork(l1)` rather than a separate source
// variant — keeps the visual treatment uniform with other wallet L1s.
export type CombinedL1 = {
  source: 'managed' | 'wallet';
  /** 'active' for live L1s; 'expired' for spun-down managed entries that
   *  the API still surfaces so users can find their past chain. Wallet
   *  entries are always 'active' from the wallet's perspective. */
  status: 'active' | 'expired';
  subnetId: string;
  blockchainId: string;
  evmChainId: number | null;
  chainName: string;
  rpcUrl: string;
  isTestnet: boolean;
  // Present only on managed L1s — wallet-only entries don't have a TTL or
  // associated node fleet because the user added them by RPC URL.
  expiresAt?: string;
  firstSeenAt?: string;
  lastSeenAt?: string;
  nodes?: MyL1['nodes'];
  // L1ListItem-derived metadata (populated by Quick L1 success or manual
  // Add Chain). Used to drive Setup Progress checks + display niceties.
  validatorManagerAddress?: string;
  validatorManagerBlockchainId?: string;
  teleporterRegistryAddress?: string;
  wrappedTokenAddress?: string;
  coinName?: string;
  logoUrl?: string;
  explorerUrl?: string;
  hasBuilderHubFaucet?: boolean;
  externalFaucetUrl?: string;
};

export function walletItemToCombined(w: L1ListItem): CombinedL1 {
  return {
    source: 'wallet',
    status: 'active',
    subnetId: w.subnetId,
    blockchainId: w.id,
    evmChainId: w.evmChainId,
    chainName: w.name,
    rpcUrl: w.rpcUrl,
    isTestnet: w.isTestnet,
    ...metadataFromWalletItem(w),
  };
}

// Extract just the metadata fields from a wallet L1ListItem. Empty-string
// addresses (the Quick L1 placeholder for "not deployed yet") map to
// undefined so Setup Progress treats them as missing.
export function metadataFromWalletItem(w: L1ListItem) {
  const optional = (v: string | undefined) => (v && v.length > 0 ? v : undefined);
  return {
    validatorManagerAddress: optional(w.validatorManagerAddress),
    validatorManagerBlockchainId: optional(w.validatorManagerBlockchainId),
    teleporterRegistryAddress: optional(w.wellKnownTeleporterRegistryAddress),
    wrappedTokenAddress: optional(w.wrappedTokenAddress),
    coinName: w.coinName,
    logoUrl: optional(w.logoUrl),
    explorerUrl: optional(w.explorerUrl),
    hasBuilderHubFaucet: w.hasBuilderHubFaucet,
    externalFaucetUrl: optional(w.externalFaucetUrl),
  };
}

