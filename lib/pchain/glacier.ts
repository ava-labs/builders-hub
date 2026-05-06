/**
 * P-Chain Glacier API Client
 * Provides methods for fetching P-Chain transaction history via Glacier API
 */

import type { PChainNetwork } from './rpc';

const P_CHAIN_ID = "11111111111111111111111111111111LpoYY";
const GLACIER_BASE = "https://glacier-api.avax.network/v1";
const GLACIER_TIMEOUT = 15000;

// ============================================================================
// Types
// ============================================================================

export interface GlacierUtxo {
  addresses: string[];
  utxoId: string;
  txHash: string;
  outputIndex: number;
  blockTimestamp: number;
  blockNumber: string;
  assetId: string;
  asset?: { assetId: string; name: string; symbol: string; denomination: number };
  amount?: string;
  consumingTxHash?: string;
}

export interface GlacierTransaction {
  txHash: string;
  txType: string;
  blockTimestamp: number;
  blockNumber: string;
  blockHash: string;
  memo?: string;
  consumedUtxos: GlacierUtxo[];
  emittedUtxos: GlacierUtxo[];
  amountBurned: { assetId: string; amount: string }[];
  amountStaked: { assetId: string; amount: string }[];
  sourceChain?: string;
  destinationChain?: string;
  nodeId?: string;
  rewardAddresses?: string[];
  stakingTxHash?: string;
}

interface GlacierTransactionsResponse {
  transactions: GlacierTransaction[];
  nextPageToken?: string;
}

// ============================================================================
// API Functions
// ============================================================================

/**
 * Fetch paginated transaction history for an address from Glacier API
 */
export async function getAddressTransactions(
  address: string,
  network: PChainNetwork,
  pageSize = 25,
  pageToken?: string
): Promise<{ transactions: GlacierTransaction[]; nextPageToken?: string }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), GLACIER_TIMEOUT);

  try {
    const params = new URLSearchParams({
      addresses: address,
      pageSize: String(pageSize),
    });
    if (pageToken) {
      params.set('pageToken', pageToken);
    }

    const url = `${GLACIER_BASE}/networks/${network}/blockchains/${P_CHAIN_ID}/transactions?${params.toString()}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: { 'accept': 'application/json' },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Glacier API request failed: ${response.status}`);
    }

    const data: GlacierTransactionsResponse = await response.json();

    return {
      transactions: data.transactions ?? [],
      nextPageToken: data.nextPageToken,
    };
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Glacier API request timed out');
    }
    throw error;
  }
}
