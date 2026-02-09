import type { GlacierTxResponse, GlacierTransaction } from './types'

const GLACIER_BASE = 'https://glacier-api.avax.network/v1'
const CACHE_TTL = 30_000

interface CacheEntry<T> {
  data: T
  timestamp: number
}

const cache = new Map<string, CacheEntry<unknown>>()

function getCached<T>(key: string): T | undefined {
  const entry = cache.get(key)
  if (!entry) return undefined
  if (Date.now() - entry.timestamp > CACHE_TTL) {
    cache.delete(key)
    return undefined
  }
  return entry.data as T
}

function setCache<T>(key: string, data: T): void {
  cache.set(key, { data, timestamp: Date.now() })
}

async function glacierFetch<T>(path: string): Promise<T> {
  const cacheKey = `glacier:${path}`
  const cached = getCached<T>(cacheKey)
  if (cached !== undefined) return cached

  const response = await fetch(`${GLACIER_BASE}${path}`, {
    headers: { accept: 'application/json' },
  })

  if (!response.ok) {
    throw new Error(
      `Glacier API error: ${response.status} ${response.statusText} for ${path}`
    )
  }

  const data: T = await response.json()
  setCache(cacheKey, data)
  return data
}

export async function getXChainTransactions(
  address: string,
  options?: { pageSize?: number; pageToken?: string }
): Promise<GlacierTxResponse> {
  const pageSize = options?.pageSize ?? 25
  const tokenParam = options?.pageToken
    ? `&pageToken=${options.pageToken}`
    : ''
  return glacierFetch<GlacierTxResponse>(
    `/networks/mainnet/blockchains/2oYMBNV4eNHyqk2fjjV5nVQLDbtmNJzq5s3qs3Lo6ftnC6FByM/transactions?pageSize=${pageSize}&addresses=${address}${tokenParam}`
  )
}

export async function getPChainTransactions(
  address: string,
  options?: { pageSize?: number; pageToken?: string }
): Promise<GlacierTxResponse> {
  const pageSize = options?.pageSize ?? 25
  const tokenParam = options?.pageToken
    ? `&pageToken=${options.pageToken}`
    : ''
  return glacierFetch<GlacierTxResponse>(
    `/networks/mainnet/blockchains/11111111111111111111111111111111LpoYY/transactions?pageSize=${pageSize}&addresses=${address}${tokenParam}`
  )
}

export async function getTransactionDetail(
  chain: 'X' | 'P',
  txHash: string
): Promise<GlacierTransaction> {
  const blockchainId =
    chain === 'X'
      ? '2oYMBNV4eNHyqk2fjjV5nVQLDbtmNJzq5s3qs3Lo6ftnC6FByM'
      : '11111111111111111111111111111111LpoYY'

  return glacierFetch<GlacierTransaction>(
    `/networks/mainnet/blockchains/${blockchainId}/transactions/${txHash}`
  )
}

export async function getPChainBalances(
  address: string
): Promise<{ unlockedUnstaked: string[]; unlockedStaked: string[] }> {
  return glacierFetch<{
    unlockedUnstaked: string[]
    unlockedStaked: string[]
  }>(
    `/networks/mainnet/blockchains/11111111111111111111111111111111LpoYY/balances?addresses=${address}`
  )
}

export async function getXChainBalances(
  address: string
): Promise<{ unlockedUnstaked: string[]; unlockedStaked: string[] }> {
  return glacierFetch<{
    unlockedUnstaked: string[]
    unlockedStaked: string[]
  }>(
    `/networks/mainnet/blockchains/2oYMBNV4eNHyqk2fjjV5nVQLDbtmNJzq5s3qs3Lo6ftnC6FByM/balances?addresses=${address}`
  )
}
