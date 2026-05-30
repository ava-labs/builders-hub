'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { fetchWithRetry } from '../fetchWithRetry'
import type { HistoricalData, TimeInterval, DateRange } from '../types'

async function fetchHistorical(
  slug: string,
  interval: TimeInterval,
  forceRefresh = false,
  dateRange?: DateRange
): Promise<HistoricalData> {
  const params = new URLSearchParams({ interval })
  if (forceRefresh) params.set('refresh', 'true')
  if (dateRange) {
    params.set('startDate', dateRange.from.toISOString())
    params.set('endDate', dateRange.to.toISOString())
  }

  const response = await fetchWithRetry(`/api/dapps/rwa/${slug}/historical?${params.toString()}`)
  return response.json()
}

interface UseHistoricalOptions {
  slug: string
  interval?: TimeInterval
  dateRange?: DateRange | null
  refreshInterval?: number
}

interface UseHistoricalResult {
  historical: HistoricalData | null
  isLoading: boolean
  error: Error | null
  refresh: () => Promise<void>
}

export function useHistorical(options: UseHistoricalOptions): UseHistoricalResult {
  const { slug, interval = 'daily', dateRange, refreshInterval = 5 * 60 * 1000 } = options
  const [historical, setHistorical] = useState<HistoricalData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const mountedRef = useRef(true)

  const loadHistorical = useCallback(async (forceRefresh = false) => {
    try {
      if (!forceRefresh) setIsLoading(true)
      if (!slug) return
      const data = await fetchHistorical(slug, interval, forceRefresh, dateRange ?? undefined)
      if (mountedRef.current) {
        setHistorical(data)
        setError(null)
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err : new Error('Failed to fetch historical data'))
      }
    } finally {
      if (mountedRef.current) setIsLoading(false)
    }
  }, [slug, interval, dateRange])

  useEffect(() => {
    mountedRef.current = true
    loadHistorical()

    const timer = setInterval(() => loadHistorical(false), refreshInterval)

    return () => {
      mountedRef.current = false
      clearInterval(timer)
    }
  }, [loadHistorical, refreshInterval])

  const refresh = useCallback(async () => {
    await loadHistorical(true)
  }, [loadHistorical])

  return { historical, isLoading, error, refresh }
}
