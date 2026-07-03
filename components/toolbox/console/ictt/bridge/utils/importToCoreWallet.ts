import type { WalletClient } from 'viem';
import type { Address } from '../types';

export interface ImportTokenOptions {
  address: Address;
  symbol: string;
  decimals: number;
  image?: string;
}

/**
 * Prompts the user's wallet (Core Wallet) to import an ERC-20 token via the
 * EIP-747 `wallet_watchAsset` JSON-RPC method.
 *
 * The caller MUST switch the wallet to the destination chain before calling —
 * Core Wallet stages the new token on whichever network is currently active.
 *
 * Returns `true` if the user accepted the prompt, `false` if they rejected it
 * or the underlying wallet does not implement the method.
 */
export async function importRemoteToCoreWallet(
  walletClient: WalletClient,
  options: ImportTokenOptions,
): Promise<boolean> {
  try {
    const added = await walletClient.watchAsset({
      type: 'ERC20',
      options: {
        address: options.address,
        symbol: options.symbol,
        decimals: options.decimals,
        image: options.image,
      },
    });
    return Boolean(added);
  } catch (err) {
    console.warn('[ictt-bridge] watchAsset failed:', err);
    return false;
  }
}
