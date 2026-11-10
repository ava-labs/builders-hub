import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/rwa/fence/auth', () => ({ fenceAuth: { getToken: vi.fn(async () => 'test-token'), invalidate: vi.fn() } }))

import { fetchMetricLatest, fetchMetricValues } from '@/lib/rwa/fence/client'
import { FENCE_HISTORY_TIMEOUT_MS, FENCE_REQUEST_TIMEOUT_MS } from '@/lib/rwa/constants/fence'

beforeEach(() => {
  vi.stubEnv('FENCE_API_URL', 'https://fence.example')
  vi.stubGlobal('fetch', vi.fn(async () => new Response('[]', { status: 200 })))
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('the Fence client', () => {
  it('gives a series read the history timeout, which outlasts a full year of readings', async () => {
    const timeout = vi.spyOn(AbortSignal, 'timeout')

    await fetchMetricValues('metric')

    expect(timeout).toHaveBeenCalledWith(FENCE_HISTORY_TIMEOUT_MS)
    expect(FENCE_HISTORY_TIMEOUT_MS).toBeGreaterThanOrEqual(30_000)
  })

  it('keeps the short timeout for a latest reading', async () => {
    const timeout = vi.spyOn(AbortSignal, 'timeout')

    await fetchMetricLatest('metric')

    expect(timeout).toHaveBeenCalledWith(FENCE_REQUEST_TIMEOUT_MS)
  })
})
