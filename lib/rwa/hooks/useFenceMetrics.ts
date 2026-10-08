'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { fetchWithRetry } from '../fetchWithRetry'
import type { FenceMetrics } from '../types'

async function fetchFenceMetricsApi(slug: string, forceRefresh = false): Promise<FenceMetrics> {
  const url = forceRefresh
    ? `/api/dapps/rwa/${slug}/fence?refresh=true`
    : `/api/dapps/rwa/${slug}/fence`
  const response = await fetchWithRetry(url)
  return response.json()
}

interface UseFenceMetricsOptions {
  slug: string
  enabled?: boolean
  refreshInterval?: number
}

interface UseFenceMetricsResult {
  fenceMetrics: FenceMetrics | null
  isLoading: boolean
  error: Error | null
  refresh: () => Promise<void>
}

export function useFenceMetrics(options: UseFenceMetricsOptions): UseFenceMetricsResult {
  const { slug, enabled = true, refreshInterval = 10 * 60 * 1000 } = options
  const [fenceMetrics, setFenceMetrics] = useState<FenceMetrics | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const mountedRef = useRef(true)

  const loadMetrics = useCallback(async (forceRefresh = false) => {
    if (!slug || !enabled) return
    try {
      if (!forceRefresh) setIsLoading(true)
      const data = await fetchFenceMetricsApi(slug, forceRefresh)
      if (mountedRef.current) {
        setFenceMetrics(data)
        setError(null)
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err : new Error('Failed to fetch Fence metrics'))
      }
    } finally {
      if (mountedRef.current) setIsLoading(false)
    }
  }, [slug, enabled])

  useEffect(() => {
    mountedRef.current = true

    if (!enabled) {
      setIsLoading(false)
      return
    }

    loadMetrics()

    const interval = setInterval(() => loadMetrics(false), refreshInterval)

    return () => {
      mountedRef.current = false
      clearInterval(interval)
    }
  }, [loadMetrics, refreshInterval, enabled])

  const refresh = useCallback(async () => {
    await loadMetrics(true)
  }, [loadMetrics])

  return { fenceMetrics, isLoading, error, refresh }
}
