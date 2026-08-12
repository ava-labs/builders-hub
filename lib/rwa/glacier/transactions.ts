import { fetchStatsTransfers, fetchStatsBalance } from '../stats/client'
import type { StatsTransfer } from '../stats/client'
import { cache, CacheKeys } from './cache'
import {
  ADDRESSES,
  USDC_TOKENS,
  normalizeAddress,
  isInternalAddress,
} from '../constants/addresses'
import type { ParsedTransfer } from '../types'

function parseUsdcValue(value: string): bigint {
  return BigInt(value)
}

// The Stats API is queried once per tracked USDC contract (native + bridged);
// each call already returns only that token's transfers for the address.
async function fetchAllTransfers(address: string): Promise<StatsTransfer[]> {
  const perToken = await Promise.all(
    USDC_TOKENS.map((token) => fetchStatsTransfers(address, token))
  )
  return perToken.flat()
}

function parseTransfers(transfers: StatsTransfer[]): ParsedTransfer[] {
  return transfers.map((t) => ({
    txHash: t.txHash,
    blockNumber: t.blockNumber,
    timestamp: new Date(t.timestamp * 1000),
    from: normalizeAddress(t.from),
    to: normalizeAddress(t.to),
    amount: parseUsdcValue(t.amount),
    isInternal:
      isInternalAddress(t.from) && isInternalAddress(t.to),
  }))
}

export async function getTransfersForAddress(
  address: string,
  forceRefresh = false
): Promise<ParsedTransfer[]> {
  const cacheKey = CacheKeys.transactions(address)

  if (!forceRefresh) {
    const cached = cache.get<ParsedTransfer[]>(cacheKey)
    if (cached && !cached.isStale) return cached.data

    if (cached && cached.isStale && !cache.isRevalidating(cacheKey)) {
      cache.setRevalidating(cacheKey, true)
      fetchAndCacheTransfers(address, cacheKey).finally(() => {
        cache.setRevalidating(cacheKey, false)
      })
      return cached.data
    }
  }

  return fetchAndCacheTransfers(address, cacheKey)
}

async function fetchAndCacheTransfers(
  address: string,
  cacheKey: string
): Promise<ParsedTransfer[]> {
  const rawTransfers = await fetchAllTransfers(address)
  const parsed = parseTransfers(rawTransfers)
  cache.set(cacheKey, parsed)
  return parsed
}

export async function getAllTrackedTransfers(
  forceRefresh = false
): Promise<Map<string, ParsedTransfer[]>> {
  const addresses = [ADDRESSES.TRANCHE_POOL, ADDRESSES.BORROWER_OPERATING]

  const results = await Promise.all(
    addresses.map(async (addr) => {
      const transfers = await getTransfersForAddress(addr, forceRefresh)
      return [normalizeAddress(addr), transfers] as const
    })
  )

  return new Map(results)
}

export async function getUsdcBalance(address: string): Promise<bigint> {
  const cacheKey = CacheKeys.balance(address)
  const cached = cache.get<bigint>(cacheKey)

  if (cached && !cached.isStale) return cached.data

  try {
    const balances = await Promise.all(
      USDC_TOKENS.map((token) => fetchStatsBalance(address, token))
    )

    const totalBalance = balances.reduce(
      (sum, b) => sum + parseUsdcValue(b.balance),
      BigInt(0)
    )

    cache.set(cacheKey, totalBalance)
    return totalBalance
  } catch (error) {
    if (cached) return cached.data
    throw error
  }
}

export async function getLenderTransfers(
  forceRefresh = false
): Promise<ParsedTransfer[]> {
  const tranchePoolTransfers = await getTransfersForAddress(
    ADDRESSES.TRANCHE_POOL,
    forceRefresh
  )

  const lenderAddresses = [
    normalizeAddress(ADDRESSES.LENDER_VALINOR),
    normalizeAddress(ADDRESSES.LENDER_AVALANCHE),
  ]

  return tranchePoolTransfers.filter((t) => lenderAddresses.includes(t.from))
}
