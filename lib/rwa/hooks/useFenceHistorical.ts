'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { fetchWithRetry } from '../fetchWithRetry'
import type { FenceHistoricalData, DateRange } from '../types'

async function fetchFenceHistoricalApi(
  slug: string,
  forceRefresh = false,
  dateRange?: DateRange
): Promise<FenceHistoricalData> {
  const params = new URLSearchParams()
  if (forceRefresh) params.set('refresh', 'true')
  if (dateRange) {
    params.set('startDate', dateRange.from.toISOString())
    params.set('endDate', dateRange.to.toISOString())
  }

  const queryString = params.toString()
  const url = `/api/dapps/rwa/${slug}/fence/historical${queryString ? `?${queryString}` : ''}`
  const response = await fetchWithRetry(url)
  return response.json()
}

interface UseFenceHistoricalOptions {
  slug: string
  enabled?: boolean
  dateRange?: DateRange | null
  refreshInterval?: number
}

interface UseFenceHistoricalResult {
  fenceHistorical: FenceHistoricalData | null
  isLoading: boolean
  error: Error | null
  refresh: () => Promise<void>
}

export function useFenceHistorical(options: UseFenceHistoricalOptions): UseFenceHistoricalResult {
  const { slug, enabled = true, dateRange, refreshInterval = 10 * 60 * 1000 } = options
  const [fenceHistorical, setFenceHistorical] = useState<FenceHistoricalData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const mountedRef = useRef(true)

  const loadHistorical = useCallback(async (forceRefresh = false) => {
    if (!slug || !enabled) return
    try {
      if (!forceRefresh) setIsLoading(true)
      const data = await fetchFenceHistoricalApi(slug, forceRefresh, dateRange ?? undefined)
      if (mountedRef.current) {
        setFenceHistorical(data)
        setError(null)
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err : new Error('Failed to fetch Fence historical'))
      }
    } finally {
      if (mountedRef.current) setIsLoading(false)
    }
  }, [slug, enabled, dateRange])

  useEffect(() => {
    mountedRef.current = true

    if (!enabled) {
      setIsLoading(false)
      return
    }

    loadHistorical()

    const timer = setInterval(() => loadHistorical(false), refreshInterval)

    return () => {
      mountedRef.current = false
      clearInterval(timer)
    }
  }, [loadHistorical, refreshInterval, enabled])

  const refresh = useCallback(async () => {
    await loadHistorical(true)
  }, [loadHistorical])

  return { fenceHistorical, isLoading, error, refresh }
}
