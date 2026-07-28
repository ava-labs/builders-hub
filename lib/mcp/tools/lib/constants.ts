/**
 * Shared constants for the MCP tool domains — primary-network chain IDs,
 * console links, and the JSON-schema fragments repeated across tool definitions.
 * Previously each of these was redefined locally per-file; this is the single
 * source of truth so they can't drift out of sync with each other.
 */

import l1ChainsData from '@/constants/l1-chains.json';
import type { Network } from '../../types';

// --- Primary Network chain IDs ----------------------------------------------

/** P-Chain — the Primary Network platform chain; same cb58 id on both networks. */
export const P_CHAIN_ID = '11111111111111111111111111111111LpoYY';

export const X_CHAIN_ID: Record<Network, string> = {
  mainnet: '2oYMBNV4eNHyqk2fjjV5nVQLDbtmNJzq5s3qs3Lo6ftnC6FByM',
  fuji: '2JVSBoinj9C2J33VntvzYtVJNZdN2NKiwwKjcumHUWEb5DbBrm',
};

export const C_CHAIN_EVM_ID: Record<Network, string> = { mainnet: '43114', fuji: '43113' };
export const EVM_ID_TO_NETWORK: Record<string, Network> = { '43113': 'fuji', '43114': 'mainnet' };

/** EVM chain_ids permitted for indexed on-chain queries: tracked L1s + C-Chain (main+fuji). */
export const ALLOWED_CHAIN_IDS: Set<number> = (() => {
  const ids = new Set<number>([Number(C_CHAIN_EVM_ID.mainnet), Number(C_CHAIN_EVM_ID.fuji)]);
  for (const e of l1ChainsData as Array<{ chainId?: string | number }>) {
    const n = Number(e?.chainId);
    if (Number.isInteger(n) && n > 0) ids.add(n);
  }
  return ids;
})();

export const NETWORKS = ['mainnet', 'fuji'] as const;

export const CONSOLE_BASE = 'https://build.avax.network/console';

/**
 * VM ID -> display name, Subnet-EVM only. The two prior local tables in
 * blockchain.ts both had this ID mapped to "Coreth" and a different, unused
 * ID mapped to "Subnet-EVM" — verified against live mainnet chain data
 * (platform.getBlockchains): srEX... is used by 118/466 chains (the
 * overwhelming majority), the other ID by zero. We don't label AVM/Coreth
 * here on purpose — L1s outside Subnet-EVM fall through to "Custom VM".
 */
export const VM_NAMES: Record<string, string> = {
  srEXiWaHuhNyGwPUi444Tu47ZEDwxTWrbQiuD7FmgSAQ6X7Dy: 'Subnet-EVM',
};

export function networkLabel(isTestnet: boolean): string {
  return isTestnet ? 'Fuji Testnet' : 'Mainnet';
}

// --- Repeated JSON-schema fragment: the `network` tool-input property ------
// The same {type, enum, [default], description} shape is redefined at ~28
// tool-input sites across blockchain.ts/info.ts/platform.ts. This reproduces
// each file's existing exact shape (some set a default, some vary the wording)
// rather than normalizing them, since inputSchema is a public tool contract.

export function networkSchemaProp(opts: { description?: string; withDefault?: boolean } = {}): Record<string, unknown> {
  return {
    type: 'string',
    enum: NETWORKS,
    ...(opts.withDefault ? { default: 'mainnet' } : {}),
    ...(opts.description ? { description: opts.description } : {}),
  };
}
