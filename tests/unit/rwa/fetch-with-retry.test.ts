import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { fetchWithRetry } from '@/lib/rwa/fetchWithRetry'

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('a read with retries', () => {
  it('does not retry a client error such as a 429', async () => {
    const fetchMock = vi.fn(async () => new Response('{}', { status: 429 }))
    vi.stubGlobal('fetch', fetchMock)

    const read = fetchWithRetry('/api/x')
    const settled = expect(read).rejects.toThrow('429')
    await vi.runAllTimersAsync()
    await settled

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('retries a server error and returns the answer that succeeds', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('', { status: 503 }))
      .mockResolvedValueOnce(new Response('{"ok":true}', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const read = fetchWithRetry('/api/x')
    await vi.runAllTimersAsync()

    expect((await read).status).toBe(200)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
