import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchStatsTransfers, fetchStatsBalance } from '@/lib/rwa/stats/client'
import type { StatsTransfer } from '@/lib/rwa/stats/client'

const TP = '0xE25CB545Bdd47a8Ec2d08001cb5661B00D47621a'
const USDC = '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E'

function transfer(overrides: Partial<StatsTransfer> = {}): StatsTransfer {
  return {
    token: USDC.toLowerCase(),
    from: '0x41d9569610dae2b6696797382fb26b5156db426f',
    to: TP.toLowerCase(),
    amount: '1000000',
    txHash: '0xaaa',
    blockNumber: 100,
    logIndex: 1,
    timestamp: 1778508240,
    ...overrides,
  }
}

function jsonResponse(payload: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
    body: { cancel: async () => undefined },
  } as unknown as Response
}

const fetchMock = vi.fn()

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('fetchStatsTransfers', () => {
  it('follows nextBefore across pages and stops when it is absent', async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({ transfers: [transfer({ blockNumber: 100 })], nextBefore: 100 })
      )
      .mockResolvedValueOnce(
        jsonResponse({ transfers: [transfer({ blockNumber: 90, txHash: '0xbbb' })] })
      )

    const result = await fetchStatsTransfers(TP, USDC)

    expect(result).toHaveLength(2)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    const first = new URL(fetchMock.mock.calls[0][0] as string)
    expect(first.pathname).toBe(`/evm-api/43114/address/${TP}/transfers`)
    expect(first.searchParams.get('token')).toBe(USDC)
    expect(first.searchParams.get('limit')).toBe('100')
    expect(first.searchParams.get('before')).toBeNull()
    const second = new URL(fetchMock.mock.calls[1][0] as string)
    expect(second.searchParams.get('before')).toBe('100')
  })

  it('accepts a soft-limit page larger than the limit', async () => {
    const rows = Array.from({ length: 102 }, (_, i) =>
      transfer({ txHash: `0x${i}`, blockNumber: 100 })
    )
    fetchMock.mockResolvedValueOnce(jsonResponse({ transfers: rows }))

    const result = await fetchStatsTransfers(TP, USDC)

    expect(result).toHaveLength(102)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('throws when the cursor fails to decrease', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ transfers: [transfer()], nextBefore: 100 }))
      .mockResolvedValueOnce(
        jsonResponse({ transfers: [transfer({ txHash: '0xbbb' })], nextBefore: 100 })
      )

    await expect(fetchStatsTransfers(TP, USDC)).rejects.toThrow('cursor did not decrease')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('passes an abort signal to every fetch attempt', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ error: 'boom' }, 503))
      .mockResolvedValueOnce(jsonResponse({ transfers: [] }))

    await fetchStatsTransfers(TP, USDC)

    expect(fetchMock).toHaveBeenCalledTimes(2)
    for (const call of fetchMock.mock.calls) {
      const init = call[1] as RequestInit
      expect(init.signal).toBeInstanceOf(AbortSignal)
    }
  })

  it('stops on an empty page', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ transfers: [], nextBefore: 100 }))

    const result = await fetchStatsTransfers(TP, USDC)

    expect(result).toHaveLength(0)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('throws when pagination exceeds the page cap', async () => {
    let block = 1_000_000
    fetchMock.mockImplementation(async () =>
      jsonResponse({ transfers: [transfer({ blockNumber: block })], nextBefore: --block })
    )

    await expect(fetchStatsTransfers(TP, USDC)).rejects.toThrow('page cap')
  })
})

describe('retry behavior', () => {
  it('retries once on 5xx then succeeds', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ error: 'boom' }, 503))
      .mockResolvedValueOnce(jsonResponse({ transfers: [] }))

    const result = await fetchStatsTransfers(TP, USDC)

    expect(result).toEqual([])
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('does not retry 4xx', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'nope' }, 400))

    await expect(fetchStatsTransfers(TP, USDC)).rejects.toThrow('Stats API error: 400')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('throws after a second consecutive 5xx', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ error: 'boom' }, 503))
      .mockResolvedValueOnce(jsonResponse({ error: 'boom' }, 502))

    await expect(fetchStatsTransfers(TP, USDC)).rejects.toThrow('Stats API error: 502')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('retries once on 429 then succeeds', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ error: 'rate limited' }, 429))
      .mockResolvedValueOnce(jsonResponse({ transfers: [] }))

    const result = await fetchStatsTransfers(TP, USDC)

    expect(result).toEqual([])
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('retries once on timeout-style abort errors', async () => {
    const timeoutError = new Error('aborted')
    timeoutError.name = 'TimeoutError'
    fetchMock
      .mockRejectedValueOnce(timeoutError)
      .mockResolvedValueOnce(jsonResponse({ transfers: [] }))

    const result = await fetchStatsTransfers(TP, USDC)

    expect(result).toEqual([])
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})

describe('fetchStatsBalance', () => {
  it('returns the parsed balance payload', async () => {
    const payload = {
      address: TP.toLowerCase(),
      token: USDC.toLowerCase(),
      balance: '721686',
      totalIn: '50388352820686',
      totalOut: '50388352099000',
      transferCount: 411,
      lastBlock: 92569896,
    }
    fetchMock.mockResolvedValueOnce(jsonResponse(payload))

    const result = await fetchStatsBalance(TP, USDC)

    expect(result).toEqual(payload)
    const url = new URL(fetchMock.mock.calls[0][0] as string)
    expect(url.pathname).toBe(`/evm-api/43114/address/${TP}/erc20-balance`)
    expect(url.searchParams.get('token')).toBe(USDC)
  })
})
