import { fetchStatsTransfers, fetchStatsBalance } from '../stats/client'
import type { StatsTransfer } from '../stats/client'
import { cache, CacheKeys } from './cache'
import { normalizeAddress } from '../constants/addresses'
import type { RWAFacility } from '../facilities'
import type { ParsedTransfer } from '../types'

function parseUsdcValue(value: string): bigint {
  return BigInt(value)
}

// The Stats API is queried once per USDC contract the facility tracks;
// each call already returns only that token's transfers for the address.
async function fetchAllTransfers(facility: RWAFacility, address: string): Promise<StatsTransfer[]> {
  const perToken = await Promise.all(
    facility.usdcTokens.map((token) => fetchStatsTransfers(address, token))
  )
  return perToken.flat()
}

function parseTransfers(facility: RWAFacility, transfers: StatsTransfer[]): ParsedTransfer[] {
  const poolAndBorrower = [facility.pool.address, facility.borrower.address].map(normalizeAddress)
  const isPoolOrBorrower = (address: string) => poolAndBorrower.includes(normalizeAddress(address))

  return transfers.map((t) => ({
    txHash: t.txHash,
    blockNumber: t.blockNumber,
    timestamp: new Date(t.timestamp * 1000),
    from: normalizeAddress(t.from),
    to: normalizeAddress(t.to),
    amount: parseUsdcValue(t.amount),
    isInternal:
      isPoolOrBorrower(t.from) && isPoolOrBorrower(t.to),
  }))
}

export async function getTransfersForAddress(
  facility: RWAFacility,
  address: string,
  forceRefresh = false
): Promise<ParsedTransfer[]> {
  const cacheKey = CacheKeys.transactions(facility.slug, address)

  if (!forceRefresh) {
    const cached = cache.get<ParsedTransfer[]>(cacheKey)
    if (cached && !cached.isStale) return cached.data

    if (cached && cached.isStale && !cache.isRevalidating(cacheKey)) {
      cache.setRevalidating(cacheKey, true)
      fetchAndCacheTransfers(facility, address, cacheKey).finally(() => {
        cache.setRevalidating(cacheKey, false)
      })
      return cached.data
    }
  }

  return fetchAndCacheTransfers(facility, address, cacheKey)
}

async function fetchAndCacheTransfers(
  facility: RWAFacility,
  address: string,
  cacheKey: string
): Promise<ParsedTransfer[]> {
  const rawTransfers = await fetchAllTransfers(facility, address)
  const parsed = parseTransfers(facility, rawTransfers)
  cache.set(cacheKey, parsed)
  return parsed
}

export async function getAllTrackedTransfers(
  facility: RWAFacility,
  forceRefresh = false
): Promise<Map<string, ParsedTransfer[]>> {
  // the pool before the borrower: the ledger lists same-time transfers in this order
  const addresses = [facility.pool.address, facility.borrower.address]

  const results = await Promise.all(
    addresses.map(async (addr) => {
      const transfers = await getTransfersForAddress(facility, addr, forceRefresh)
      return [normalizeAddress(addr), transfers] as const
    })
  )

  return new Map(results)
}

export async function getUsdcBalance(facility: RWAFacility, address: string): Promise<bigint> {
  const cacheKey = CacheKeys.balance(facility.slug, address)
  const cached = cache.get<bigint>(cacheKey)

  if (cached && !cached.isStale) return cached.data

  try {
    const balances = await Promise.all(
      facility.usdcTokens.map((token) => fetchStatsBalance(address, token))
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
  facility: RWAFacility,
  forceRefresh = false
): Promise<ParsedTransfer[]> {
  const tranchePoolTransfers = await getTransfersForAddress(
    facility,
    facility.pool.address,
    forceRefresh
  )

  const lenderAddresses = facility.lenders.map((lender) => normalizeAddress(lender.address))

  return tranchePoolTransfers.filter((t) => lenderAddresses.includes(t.from))
}
