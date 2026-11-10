'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { parseBigints, BIGINT_METRIC_KEYS } from '../utils'
import { fetchWithRetry } from '../fetchWithRetry'
import type { AllMetrics } from '../types'

async function fetchMetrics(slug: string, forceRefresh = false): Promise<AllMetrics> {
  const url = forceRefresh
    ? `/api/dapps/rwa/${slug}/metrics?refresh=true`
    : `/api/dapps/rwa/${slug}/metrics`
  const response = await fetchWithRetry(url)

  const data = await response.json()
  return parseBigints(data, BIGINT_METRIC_KEYS) as AllMetrics
}

interface UseMetricsOptions {
  slug: string
  refreshInterval?: number
}

interface UseMetricsResult {
  metrics: AllMetrics | null
  isLoading: boolean
  error: Error | null
  refresh: () => Promise<void>
}

export function useMetrics(options: UseMetricsOptions): UseMetricsResult {
  const { slug, refreshInterval = 5 * 60 * 1000 } = options
  const [metrics, setMetrics] = useState<AllMetrics | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const mountedRef = useRef(true)

  const loadMetrics = useCallback(async (forceRefresh = false) => {
    if (!slug) return
    try {
      if (!forceRefresh) setIsLoading(true)
      const data = await fetchMetrics(slug, forceRefresh)
      if (mountedRef.current) {
        setMetrics(data)
        setError(null)
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err : new Error('Failed to fetch metrics'))
      }
    } finally {
      if (mountedRef.current) setIsLoading(false)
    }
  }, [slug])

  useEffect(() => {
    mountedRef.current = true
    loadMetrics()

    const interval = setInterval(() => loadMetrics(false), refreshInterval)

    return () => {
      mountedRef.current = false
      clearInterval(interval)
    }
  }, [loadMetrics, refreshInterval])

  const refresh = useCallback(async () => {
    await loadMetrics(true)
  }, [loadMetrics])

  return { metrics, isLoading, error, refresh }
}
