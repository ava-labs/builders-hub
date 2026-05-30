// Server-only: Fence Finance API client
// Do NOT import this file from client components

import { fenceAuth } from './auth'
import { FENCE_REQUEST_TIMEOUT_MS } from '../constants/fence'

export interface FenceApiMetricValue {
  id: string
  name: string
  metric_definition_id: string
  deal_id: string
  value: { value: number | string; decimals?: number; currency?: string } | number
  as_of_date: string
  value_type: string | null
  metadata?: {
    calculation_results?: { comparison_result?: boolean }
    comparison_configuration?: { threshole?: number; threshold?: number; threshold_value?: number }
  } | null
}

interface FetchMetricValuesOptions {
  asOfDateGte?: string
  asOfDateLte?: string
}

function getApiUrl(): string {
  const url = process.env.FENCE_API_URL
  if (!url) throw new Error('FENCE_API_URL not configured')
  return url
}

async function fetchWithAuth(url: string, retryOn401 = true): Promise<Response> {
  const token = await fenceAuth.getToken()

  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json',
    },
    signal: AbortSignal.timeout(FENCE_REQUEST_TIMEOUT_MS),
  })

  if (response.status === 401 && retryOn401) {
    fenceAuth.invalidate()
    return fetchWithAuth(url, false)
  }

  if (!response.ok) {
    throw new Error(`Fence API error: ${response.status} ${response.statusText}`)
  }

  return response
}

export async function fetchMetricValues(
  metricDefinitionId: string,
  options?: FetchMetricValuesOptions
): Promise<FenceApiMetricValue[]> {
  const apiUrl = getApiUrl()
  const params = new URLSearchParams()

  if (options?.asOfDateGte) {
    params.set('as_of_date_gte', options.asOfDateGte)
  }
  if (options?.asOfDateLte) {
    params.set('as_of_date_lte', options.asOfDateLte)
  }

  const queryString = params.toString()
  const url = `${apiUrl}/v3/metrics/${metricDefinitionId}/values${queryString ? `?${queryString}` : ''}`

  const response = await fetchWithAuth(url)
  return response.json()
}

export async function fetchMetricLatest(
  metricDefinitionId: string
): Promise<FenceApiMetricValue> {
  const apiUrl = getApiUrl()
  const url = `${apiUrl}/v3/metrics/${metricDefinitionId}/values/latest`

  const response = await fetchWithAuth(url)
  return response.json()
}
