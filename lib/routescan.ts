// Routescan API client for enriching unknown contract addresses
// Uses the free Etherscan-compatible API (10K calls/day, no auth required)

const ROUTESCAN_BASE_URL =
  'https://api.routescan.io/v2/network/mainnet/evm/43114/etherscan/api';

// In-memory cache to avoid redundant API calls within the same server lifecycle
const contractNameCache = new Map<string, RoutescanContractInfo | null>();

export interface RoutescanContractInfo {
  address: string;
  contractName: string;
  compilerVersion: string;
  isProxy: boolean;
  implementation: string | null;
}

/**
 * Look up a verified contract name from Routescan.
 * Returns null if the contract is not verified or the API fails.
 */
export async function getContractName(address: string): Promise<RoutescanContractInfo | null> {
  const normalizedAddr = address.toLowerCase();

  // Check cache first
  if (contractNameCache.has(normalizedAddr)) {
    return contractNameCache.get(normalizedAddr)!;
  }

  try {
    const url = `${ROUTESCAN_BASE_URL}?module=contract&action=getsourcecode&address=${normalizedAddr}`;
    const response = await fetch(url, {
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      contractNameCache.set(normalizedAddr, null);
      return null;
    }

    const data = await response.json();

    if (data.status !== '1' || !data.result || !data.result[0]) {
      contractNameCache.set(normalizedAddr, null);
      return null;
    }

    const result = data.result[0];
    const contractName = result.ContractName;

    if (!contractName || contractName === '') {
      contractNameCache.set(normalizedAddr, null);
      return null;
    }

    const info: RoutescanContractInfo = {
      address: normalizedAddr,
      contractName,
      compilerVersion: result.CompilerVersion || '',
      isProxy: result.Proxy === '1',
      implementation: result.Implementation || null,
    };

    contractNameCache.set(normalizedAddr, info);
    return info;
  } catch {
    contractNameCache.set(normalizedAddr, null);
    return null;
  }
}

/**
 * Batch-enrich a list of addresses with Routescan contract names.
 * Respects rate limits by adding a small delay between requests.
 */
export async function enrichAddresses(
  addresses: string[],
  delayMs: number = 200
): Promise<Map<string, RoutescanContractInfo>> {
  const results = new Map<string, RoutescanContractInfo>();

  for (const address of addresses) {
    const info = await getContractName(address);
    if (info) {
      results.set(address.toLowerCase(), info);
    }

    // Rate-limit delay between requests
    if (delayMs > 0) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  return results;
}

/**
 * Clear the in-memory cache (useful for testing or forced refresh).
 */
export function clearCache(): void {
  contractNameCache.clear();
}
