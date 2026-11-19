import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/rwa/stats/client', () => ({
  fetchStatsTransfers: vi.fn(),
  fetchStatsBalance: vi.fn(),
}))

import { fetchStatsTransfers, fetchStatsBalance } from '@/lib/rwa/stats/client'
import type { StatsTransfer, StatsBalance } from '@/lib/rwa/stats/client'
import {
  getTransfersForAddress,
  getAllTrackedTransfers,
  getUsdcBalance,
  getLenderTransfers,
} from '@/lib/rwa/glacier/transactions'
import { RWA_FACILITIES } from '@/lib/rwa/facilities'

const OATFI = RWA_FACILITIES.oatfi
const statsTransfersMock = vi.mocked(fetchStatsTransfers)
const statsBalanceMock = vi.mocked(fetchStatsBalance)

function row(overrides: Partial<StatsTransfer> = {}): StatsTransfer {
  return {
    token: OATFI.usdcTokens[0].toLowerCase(),
    from: OATFI.borrower.address.toLowerCase(),
    to: OATFI.pool.address.toLowerCase(),
    amount: '297198040000',
    txHash: '0x98ed',
    blockNumber: 85167402,
    logIndex: 57,
    timestamp: 1778508240,
    ...overrides,
  }
}

function balance(value: string): StatsBalance {
  return {
    address: '',
    token: '',
    balance: value,
    totalIn: '0',
    totalOut: '0',
    transferCount: 0,
    lastBlock: 0,
  }
}

beforeEach(() => {
  statsTransfersMock.mockReset()
  statsBalanceMock.mockReset()
})

describe('getTransfersForAddress', () => {
  it('fetches both usdc tokens and maps rows to ParsedTransfer', async () => {
    statsTransfersMock
      .mockResolvedValueOnce([row()])
      .mockResolvedValueOnce([
        row({
          txHash: '0xother',
          to: '0xd3a206c93e759f32ab8e01bb11726a3f2bf3ab51',
          amount: '19298140000',
        }),
      ])

    const result = await getTransfersForAddress(OATFI, OATFI.pool.address, true)

    expect(statsTransfersMock).toHaveBeenCalledTimes(2)
    expect(statsTransfersMock.mock.calls.map((c) => c[1])).toEqual([
      OATFI.usdcTokens[0],
      OATFI.usdcTokens[1],
    ])
    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({
      txHash: '0x98ed',
      blockNumber: 85167402,
      timestamp: new Date(1778508240 * 1000),
      from: OATFI.borrower.address.toLowerCase(),
      to: OATFI.pool.address.toLowerCase(),
      amount: BigInt('297198040000'),
      isInternal: true,
    })
    expect(result[1].isInternal).toBe(false)
  })
})

describe('getAllTrackedTransfers', () => {
  it('returns a map keyed by normalized tracked addresses', async () => {
    statsTransfersMock.mockResolvedValue([])

    const result = await getAllTrackedTransfers(OATFI, true)

    expect([...result.keys()]).toEqual([
      OATFI.pool.address.toLowerCase(),
      OATFI.borrower.address.toLowerCase(),
    ])
    expect(statsTransfersMock).toHaveBeenCalledTimes(4)
  })
})

describe('getUsdcBalance', () => {
  it('sums balances across both usdc tokens', async () => {
    statsBalanceMock
      .mockResolvedValueOnce(balance('100'))
      .mockResolvedValueOnce(balance('23'))

    const result = await getUsdcBalance(OATFI, OATFI.pool.address)

    expect(result).toBe(BigInt(123))
    expect(statsBalanceMock).toHaveBeenCalledTimes(2)
    expect(statsBalanceMock.mock.calls.map((c) => c[1])).toEqual([
      OATFI.usdcTokens[0],
      OATFI.usdcTokens[1],
    ])
  })

  it('propagates upstream errors when no cache exists', async () => {
    statsBalanceMock.mockRejectedValue(new Error('Stats API error: 503'))

    await expect(
      getUsdcBalance(OATFI, '0x000000000000000000000000000000000000dEaD')
    ).rejects.toThrow('Stats API error: 503')
  })
})

describe('getLenderTransfers', () => {
  it('returns only transfers sent by lender addresses', async () => {
    statsTransfersMock
      .mockResolvedValueOnce([
        row({ txHash: '0x1', from: OATFI.lenders[0].address.toLowerCase() }),
        row({ txHash: '0x2', from: OATFI.lenders[1].address.toLowerCase() }),
        row({ txHash: '0x3' }),
      ])
      .mockResolvedValueOnce([])

    const result = await getLenderTransfers(OATFI, true)

    expect(result.map((t) => t.txHash)).toEqual(['0x1', '0x2'])
  })
})
