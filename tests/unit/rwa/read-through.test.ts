import { format } from 'node:util'
import { CallExecutionError, HttpRequestError, TimeoutError } from 'viem'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cache, readThrough } from '@/lib/rwa/glacier/cache'

const KEY = 'rwa:test:read-through'
/** the entry that remembers a failed read of KEY */
const FAILED = `${KEY}:failed`
/** an RPC's URL, which viem writes into its errors' text: for the position's read, our own node's */
const NODE_URL = 'https://rpc.example/ext/bc/C/rpc'

/** an entry already stale and not yet expired */
const keepStale = (value: number) => cache.set(KEY, value, { ttl: -1 })

/** one turn of the event loop: a refresh behind an answer settles in it */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0))

beforeEach(() => {
  // the copy, and a failure the last test left
  cache.invalidate(KEY)
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('readThrough', () => {
  it('serves a fresh copy without reading', async () => {
    cache.set(KEY, 1)
    const read = vi.fn(async () => 2)

    expect(await readThrough(KEY, read)).toBe(1)
    expect(read).not.toHaveBeenCalled()
  })

  it('serves a stale copy at once and refreshes it once behind the answer', async () => {
    keepStale(1)
    const read = vi.fn(async () => 2)

    expect(await Promise.all([readThrough(KEY, read), readThrough(KEY, read)])).toEqual([1, 1])
    await vi.waitFor(() => expect(cache.get(KEY)).toEqual({ data: 2, isStale: false }))
    expect(read).toHaveBeenCalledTimes(1)
  })

  it('reads once for callers that miss together', async () => {
    const read = vi.fn(async () => 3)

    expect(await Promise.all([readThrough(KEY, read), readThrough(KEY, read)])).toEqual([3, 3])
    expect(read).toHaveBeenCalledTimes(1)
    // and keeps what it read, fresh for the default five minutes
    expect(cache.get(KEY)).toEqual({ data: 3, isStale: false })
  })

  it('lets a failed read through when nothing is kept', async () => {
    const read = vi.fn(async (): Promise<number> => {
      throw new Error('the query service is busy')
    })

    await expect(readThrough(KEY, read)).rejects.toThrow('the query service is busy')
  })

  it('answers a miss with the failed read for a minute, without reading again', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    const busy = new Error('the query service is busy')
    const read = vi.fn((): Promise<number> => Promise.reject(busy))

    await expect(readThrough(KEY, read)).rejects.toBe(busy)
    vi.setSystemTime(Date.now() + 59_999)
    await expect(readThrough(KEY, read)).rejects.toBe(busy)
    expect(read).toHaveBeenCalledTimes(1)
  })

  it('reads again once the minute after a failed read is over', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    const read = vi.fn<() => Promise<number>>()
    read.mockRejectedValueOnce(new Error('the query service is busy')).mockResolvedValueOnce(4)

    await expect(readThrough(KEY, read)).rejects.toThrow('the query service is busy')
    vi.setSystemTime(Date.now() + 60_001)
    expect(await readThrough(KEY, read)).toBe(4)
    expect(read).toHaveBeenCalledTimes(2)
  })

  it('keeps the stale copy when its refresh fails, and starts no refresh for a minute', async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {})
    keepStale(1)
    const read = vi.fn<() => Promise<number>>()
    read.mockRejectedValueOnce(new Error('the query service is busy')).mockResolvedValueOnce(2)

    expect(await readThrough(KEY, read)).toBe(1)
    await vi.waitFor(() => expect(logged).toHaveBeenCalledTimes(1))
    expect(cache.get(KEY)).toEqual({ data: 1, isStale: true })

    // the failed refresh is remembered: the next caller gets the stale copy and starts no second refresh
    expect(await readThrough(KEY, read)).toBe(1)
    await settle()
    expect(read).toHaveBeenCalledTimes(1)
    expect(cache.get(KEY)).toEqual({ data: 1, isStale: true })
    expect(logged).toHaveBeenCalledWith('[rwa] refresh failed:', KEY, 'Error: the query service is busy')
  })

  it('refreshes a stale copy again once the minute after a failed refresh is over', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.spyOn(console, 'error').mockImplementation(() => {})
    keepStale(1)
    const read = vi.fn<() => Promise<number>>()
    read.mockRejectedValueOnce(new Error('the query service is busy')).mockResolvedValueOnce(2)

    expect(await readThrough(KEY, read)).toBe(1)
    await settle()
    vi.setSystemTime(Date.now() + 60_001)
    expect(await readThrough(KEY, read)).toBe(1)
    await settle()
    expect(read).toHaveBeenCalledTimes(2)
    expect(cache.get(KEY)).toEqual({ data: 2, isStale: false })
  })

  it('forgets a failure once a read already running succeeds', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    cache.set(KEY, 1, { ttl: -1, staleWhileRevalidate: 1_000 })
    let finish: (value: number) => void = () => {}
    const slow = vi.fn(
      () =>
        new Promise<number>((resolve) => {
          finish = resolve
        })
    )
    const failing = vi.fn(async (): Promise<number> => {
      throw new Error('the query service is busy')
    })

    // a refresh that outlives its stale copy, and a miss behind it whose read fails
    expect(await readThrough(KEY, slow)).toBe(1)
    vi.setSystemTime(Date.now() + 1_000)
    await expect(readThrough(KEY, failing)).rejects.toThrow('the query service is busy')
    expect(cache.get(FAILED)).not.toBeNull()

    finish(2)
    await settle()
    expect(cache.get(KEY)).toEqual({ data: 2, isStale: false })
    expect(cache.get(FAILED)).toBeNull()
  })

  it('forgets a failure when its key is invalidated', async () => {
    const read = vi.fn<() => Promise<number>>()
    read.mockRejectedValueOnce(new Error('the query service is busy')).mockResolvedValueOnce(5)

    await expect(readThrough(KEY, read)).rejects.toThrow('the query service is busy')
    cache.invalidate(KEY)
    expect(await readThrough(KEY, read)).toBe(5)
  })

  it.each([
    ['an HTTP request', new HttpRequestError({ url: NODE_URL, details: 'fetch failed' })],
    ['a timeout', new TimeoutError({ url: NODE_URL, body: { method: 'eth_call' } })],
    ["the position's eth_call", new CallExecutionError(new HttpRequestError({ url: NODE_URL }), {})],
  ])('logs a refresh that failed on %s by its short message, never its URL', async (_, error) => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {})
    keepStale(1)
    const read = vi.fn(async (): Promise<number> => {
      throw error
    })

    expect(await readThrough(KEY, read)).toBe(1)
    await vi.waitFor(() => expect(logged).toHaveBeenCalledTimes(1))
    expect(format(...logged.mock.calls[0])).not.toContain(NODE_URL)
    expect(logged).toHaveBeenCalledWith('[rwa] refresh failed:', KEY, error.shortMessage)
  })
})
