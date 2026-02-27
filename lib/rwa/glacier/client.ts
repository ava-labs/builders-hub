const GLACIER_BASE = 'https://glacier-api.avax.network'
export const AVALANCHE_C_CHAIN_ID = '43114'

interface GlacierFetchOptions {
  pageSize?: number
  pageToken?: string
  address?: string
}

export async function glacierFetch<T>(
  path: string,
  params: Record<string, string> = {}
): Promise<T> {
  const url = new URL(path, GLACIER_BASE)
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') {
      url.searchParams.set(key, value)
    }
  }

  const response = await fetch(url.toString(), {
    headers: { accept: 'application/json' },
  })

  if (!response.ok) {
    throw new Error(`Glacier API error: ${response.status} ${response.statusText} for ${path}`)
  }

  return response.json() as Promise<T>
}

export interface GlacierErc20Transfer {
  blockNumber: string
  blockTimestamp: number
  txHash: string
  from: { address: string }
  to: { address: string }
  value: string
  erc20Token: {
    address: string
    decimals: number
  }
}

export interface GlacierErc20TransactionsResponse {
  transactions: GlacierErc20Transfer[]
  nextPageToken?: string
}

export interface GlacierErc20BalancesResponse {
  erc20TokenBalances: Array<{
    address: string
    balance: string
    decimals: number
  }>
}

export async function fetchErc20Transactions(
  chainId: string,
  address: string,
  pageSize: number = 100,
  pageToken?: string
): Promise<GlacierErc20TransactionsResponse> {
  const params: Record<string, string> = {
    pageSize: String(pageSize),
  }
  if (pageToken) {
    params.pageToken = pageToken
  }

  return glacierFetch<GlacierErc20TransactionsResponse>(
    `/v1/chains/${chainId}/addresses/${address}/transactions:listErc20`,
    params
  )
}

export async function fetchErc20Balances(
  chainId: string,
  address: string
): Promise<GlacierErc20BalancesResponse> {
  return glacierFetch<GlacierErc20BalancesResponse>(
    `/v1/chains/${chainId}/addresses/${address}/balances:listErc20`,
    {}
  )
}
