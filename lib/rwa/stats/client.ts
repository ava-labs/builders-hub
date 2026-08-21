// Server-only: internal Stats API client for the RWA dashboard.
// The box is plain HTTP (see DEDICATED_STATS_BASE_URL), so this must only be
// called from server-side route handlers — never from client components.
// Upstream contract is pinned in
// docs/superpowers/specs/2026-08-12-rwa-stats-api-migration-design.md.

import { DEDICATED_STATS_BASE_URL } from '@/lib/dedicated-stats'

const C_CHAIN_ID = '43114'
const REQUEST_TIMEOUT_MS = 8_000
const RETRY_DELAY_MS = 200
const PAGE_LIMIT = 100
const MAX_PAGES = 50

export interface StatsTransfer {
  token: string
  from: string
  to: string
  amount: string
  txHash: string
  blockNumber: number
  logIndex: number
  timestamp: number
}

export interface StatsBalance {
  address: string
  token: string
  balance: string
  totalIn: string
  totalOut: string
  transferCount: number
  lastBlock: number
}

interface TransfersPage {
  transfers?: StatsTransfer[]
  nextBefore?: number | null
}

function isRetryableError(error: unknown): boolean {
  // TypeError = network failure from fetch; Abort/Timeout = our 8s signal fired
  if (error instanceof TypeError) return true
  return (
    error instanceof Error &&
    (error.name === 'AbortError' || error.name === 'TimeoutError')
  )
}

async function statsFetch<T>(path: string, params: Record<string, string>): Promise<T> {
  const url = new URL(path, DEDICATED_STATS_BASE_URL)
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value)
  }

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await fetch(url.toString(), {
        headers: { accept: 'application/json' },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      })
      if (!response.ok) {
        if ((response.status >= 500 || response.status === 429) && attempt === 0) {
          await response.body?.cancel().catch(() => undefined)
          await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS))
          continue
        }
        throw new Error(`Stats API error: ${response.status} for ${url.pathname}`)
      }
      return (await response.json()) as T
    } catch (error) {
      if (attempt === 0 && isRetryableError(error)) {
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS))
        continue
      }
      throw error
    }
  }
  throw new Error(`Stats API request failed for ${url.pathname}`)
}

export async function fetchStatsTransfers(
  address: string,
  token: string
): Promise<StatsTransfer[]> {
  const all: StatsTransfer[] = []
  let before: number | undefined

  for (let page = 0; page < MAX_PAGES; page++) {
    const params: Record<string, string> = { token, limit: String(PAGE_LIMIT) }
    if (before !== undefined) params.before = String(before)

    const data = await statsFetch<TransfersPage>(
      `/evm-api/${C_CHAIN_ID}/address/${address}/transfers`,
      params
    )
    const transfers = data.transfers ?? []
    all.push(...transfers)

    const next = data.nextBefore
    if (next === undefined || next === null || transfers.length === 0) return all
    // Defensive: upstream never splits a block across pages, so the cursor
    // must strictly decrease. A repeat means an upstream pagination bug —
    // fail loudly rather than silently truncate a finance ledger.
    if (before !== undefined && next >= before) {
      throw new Error(
        `Stats API cursor did not decrease (${next} >= ${before}) for ${address}`
      )
    }
    before = next
  }

  // Loud failure beats silent truncation on a finance dashboard: today's deal
  // is ~14 pages total, so hitting the cap means an upstream pagination bug.
  throw new Error(`Stats API pagination exceeded page cap (${MAX_PAGES}) for ${address}`)
}

export async function fetchStatsBalance(
  address: string,
  token: string
): Promise<StatsBalance> {
  return statsFetch<StatsBalance>(
    `/evm-api/${C_CHAIN_ID}/address/${address}/erc20-balance`,
    { token }
  )
}
