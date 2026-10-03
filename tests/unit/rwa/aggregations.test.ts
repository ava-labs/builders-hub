import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/rwa/glacier/transactions', () => ({ getAllTrackedTransfers: vi.fn(), getLenderTransfers: vi.fn() }))

import { getAllTrackedTransfers, getLenderTransfers } from '@/lib/rwa/glacier/transactions'
import { calculateHistoricalData } from '@/lib/rwa/calculations/aggregations'
import { cache, CacheKeys } from '@/lib/rwa/glacier/cache'
import { ADDRESSES } from '@/lib/rwa/constants/addresses'
import type { ParsedTransfer } from '@/lib/rwa/types'

const pool = ADDRESSES.TRANCHE_POOL.toLowerCase()
const borrower = ADDRESSES.BORROWER_OPERATING.toLowerCase()

/* midday UTC, so the local-day bucketing reads the same day in any time zone this runs in */
const move = (day: string, from: string, to: string): ParsedTransfer => ({
  txHash: `0x${day}${from.slice(2, 6)}`,
  blockNumber: 1,
  timestamp: new Date(`${day}T12:00:00Z`),
  from,
  to,
  amount: 1_000_000n,
  isInternal: false,
})

beforeEach(() => {
  vi.resetAllMocks()
  cache.invalidate(CacheKeys.historical('all', 'daily'))
})

describe('the pool history', () => {
  it('cuts each date window from the one cached history instead of storing a copy per window', async () => {
    vi.mocked(getAllTrackedTransfers).mockResolvedValue(new Map([[pool, [move('2026-09-10', pool, borrower), move('2026-09-20', pool, borrower)]], [borrower, []]]))
    vi.mocked(getLenderTransfers).mockResolvedValue([move('2026-09-01', ADDRESSES.LENDER_VALINOR.toLowerCase(), pool)])

    const late = await calculateHistoricalData('daily', false, { from: new Date('2026-09-15T00:00:00Z'), to: new Date('2026-09-30T00:00:00Z') })
    const early = await calculateHistoricalData('daily', false, { from: new Date('2026-09-01T00:00:00Z'), to: new Date('2026-09-12T00:00:00Z') })

    expect(late.assetsFinanced.map((p) => p.date)).toEqual(['2026-09-20'])
    expect(early.assetsFinanced.map((p) => p.date)).toEqual(['2026-09-10'])
    // the second window read the cached history, not the transfers
    expect(getAllTrackedTransfers).toHaveBeenCalledTimes(1)
  })
})
