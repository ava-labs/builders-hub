function dataApiBase(): string {
  const base = new URL(process.env.GLACIER_BASE || 'https://data-api.avax.network')
  const loopback = base.hostname === 'localhost' || base.hostname === '127.0.0.1' || base.hostname === '::1'
  if (base.protocol !== 'https:' && !(loopback && base.protocol === 'http:')) {
    throw new Error('GLACIER_BASE must use HTTPS (HTTP is allowed only for loopback development)')
  }
  return base.toString().replace(/\/+$/, '')
}

const GLACIER_BASE = dataApiBase()
const GLACIER_TIMEOUT_MS = 8_000
const GLACIER_MAX_RESPONSE_BYTES = 2 * 1024 * 1024
const RETRYABLE_STATUS = new Set([429, 502, 503, 504])
const MAX_CONCURRENT = 8
const MAX_QUEUE = 100
let active = 0
const waiters: Array<{ wake: () => void; timer: ReturnType<typeof setTimeout> }> = []
export const AVALANCHE_C_CHAIN_ID = '43114'

async function withGlacierSlot<T>(fn: () => Promise<T>): Promise<T> {
  if (active >= MAX_CONCURRENT) {
    if (waiters.length >= MAX_QUEUE) throw new Error('Data API is busy; retry shortly')
    await new Promise<void>((resolve, reject) => {
      const waiter = {
        wake: resolve,
        timer: setTimeout(() => {
          const index = waiters.indexOf(waiter)
          if (index >= 0) waiters.splice(index, 1)
          reject(new Error('Data API queue timed out'))
        }, 5_000),
      }
      waiters.push(waiter)
    })
  }
  active++
  try {
    return await fn()
  } finally {
    active--
    const next = waiters.shift()
    if (next) {
      clearTimeout(next.timer)
      next.wake()
    }
  }
}

function retryDelayMs(response: Response, attempt: number): number {
  const retryAfter = Number(response.headers.get('retry-after'))
  if (Number.isFinite(retryAfter) && retryAfter >= 0) return Math.min(retryAfter * 1000, 2_000)
  return 200 * 2 ** attempt
}

async function readLimitedResponse(response: Response): Promise<string> {
  const reader = response.body?.getReader()
  if (!reader) return ''
  const chunks: Uint8Array[] = []
  let total = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > GLACIER_MAX_RESPONSE_BYTES) {
      await reader.cancel().catch(() => undefined)
      throw new Error('Data API response too large')
    }
    chunks.push(value)
  }
  const body = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    body.set(chunk, offset)
    offset += chunk.byteLength
  }
  return new TextDecoder().decode(body)
}

export async function glacierFetch<T>(
  path: string,
  params: Record<string, string> = {}
): Promise<T> {
  if (!path.startsWith('/v1/')) throw new Error('Invalid Data API path')
  const url = new URL(path, GLACIER_BASE)
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') {
      url.searchParams.set(key, value)
    }
  }

  return withGlacierSlot(async () => {
    for (let attempt = 0; attempt < 3; attempt++) {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), GLACIER_TIMEOUT_MS)
      try {
        const headers: Record<string, string> = {
          accept: 'application/json',
          'user-agent': 'Avalanche-Builders-Hub-MCP',
        }
        const apiKey = process.env.GLACIER_API_KEY || process.env.GLACIER_API_KEY_1
        if (apiKey) headers['x-glacier-api-key'] = apiKey
        const response = await fetch(url.toString(), { headers, signal: controller.signal })
        if (!response.ok) {
          if (RETRYABLE_STATUS.has(response.status) && attempt < 2) {
            await response.body?.cancel().catch(() => undefined)
            await new Promise((resolve) => setTimeout(resolve, retryDelayMs(response, attempt)))
            continue
          }
          throw new Error(`Data API error: ${response.status} ${response.statusText} for ${path}`)
        }
        const declared = Number(response.headers.get('content-length') || '0')
        if (Number.isFinite(declared) && declared > GLACIER_MAX_RESPONSE_BYTES) {
          await response.body?.cancel().catch(() => undefined)
          throw new Error('Data API response too large')
        }
        const raw = await readLimitedResponse(response)
        return JSON.parse(raw) as T
      } catch (error) {
        if (attempt < 2 && error instanceof Error && (error.name === 'AbortError' || error instanceof TypeError)) continue
        throw error
      } finally {
        clearTimeout(timer)
      }
    }
    throw new Error('Data API request failed')
  })
}

export interface GlacierErc20Transfer {
  blockNumber: string
  blockTimestamp: number
  txHash: string
  from: { address: string }
  to: { address: string }
  value: string
  erc20Token: {
    address: string
    decimals: number
  }
}

export interface GlacierErc20TransactionsResponse {
  transactions: GlacierErc20Transfer[]
  nextPageToken?: string
}

export interface GlacierErc20BalancesResponse {
  erc20TokenBalances: Array<{
    address: string
    balance: string
    decimals: number
  }>
}

export async function fetchErc20Transactions(
  chainId: string,
  address: string,
  pageSize: number = 100,
  pageToken?: string
): Promise<GlacierErc20TransactionsResponse> {
  const params: Record<string, string> = {
    pageSize: String(pageSize),
  }
  if (pageToken) {
    params.pageToken = pageToken
  }

  return glacierFetch<GlacierErc20TransactionsResponse>(
    `/v1/chains/${chainId}/addresses/${address}/transactions:listErc20`,
    params
  )
}

export async function fetchErc20Balances(
  chainId: string,
  address: string
): Promise<GlacierErc20BalancesResponse> {
  return glacierFetch<GlacierErc20BalancesResponse>(
    `/v1/chains/${chainId}/addresses/${address}/balances:listErc20`,
    {}
  )
}
