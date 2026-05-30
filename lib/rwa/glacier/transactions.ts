import {
  fetchErc20Transactions,
  fetchErc20Balances,
  AVALANCHE_C_CHAIN_ID,
} from './client'
import type { GlacierErc20Transfer } from './client'
import { cache, CacheKeys } from './cache'
import {
  ADDRESSES,
  USDC_TOKENS,
  normalizeAddress,
  isInternalAddress,
  isTrackedUsdcToken,
} from '../constants/addresses'
import type { ParsedTransfer } from '../types'

function parseUsdcValue(value: string): bigint {
  return BigInt(value)
}

async function fetchAllTransfers(address: string): Promise<GlacierErc20Transfer[]> {
  const allTransfers: GlacierErc20Transfer[] = []
  let pageToken: string | undefined

  do {
    const response = await fetchErc20Transactions(
      AVALANCHE_C_CHAIN_ID,
      address,
      100,
      pageToken
    )

    const usdcTransfers = (response.transactions ?? []).filter((t) =>
      isTrackedUsdcToken(t.erc20Token.address)
    )

    allTransfers.push(...usdcTransfers)
    pageToken = response.nextPageToken
  } while (pageToken)

  return allTransfers
}

function parseTransfers(transfers: GlacierErc20Transfer[]): ParsedTransfer[] {
  return transfers.map((t) => ({
    txHash: t.txHash,
    blockNumber: parseInt(t.blockNumber, 10),
    timestamp: new Date(t.blockTimestamp * 1000),
    from: normalizeAddress(t.from.address),
    to: normalizeAddress(t.to.address),
    amount: parseUsdcValue(t.value),
    isInternal:
      isInternalAddress(t.from.address) && isInternalAddress(t.to.address),
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
    const response = await fetchErc20Balances(AVALANCHE_C_CHAIN_ID, address)

    const totalBalance = (response.erc20TokenBalances ?? [])
      .filter((b) => isTrackedUsdcToken(b.address))
      .reduce((sum, b) => sum + parseUsdcValue(b.balance), BigInt(0))

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
