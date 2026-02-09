import type {
  PChainTxResult,
  PChainValidatorResult,
  PChainValidator,
} from './types'

const P_CHAIN_RPC = 'https://api.avax.network/ext/bc/P'
const CACHE_TTL = 30_000

interface CacheEntry<T> {
  data: T
  timestamp: number
}

const cache = new Map<string, CacheEntry<unknown>>()

function getCached<T>(key: string): T | undefined {
  const entry = cache.get(key)
  if (!entry) return undefined
  if (Date.now() - entry.timestamp > CACHE_TTL) {
    cache.delete(key)
    return undefined
  }
  return entry.data as T
}

function setCache<T>(key: string, data: T): void {
  cache.set(key, { data, timestamp: Date.now() })
}

async function pChainRpc<T>(
  method: string,
  params: Record<string, unknown>
): Promise<T> {
  const cacheKey = `pchain:${method}:${JSON.stringify(params)}`
  const cached = getCached<T>(cacheKey)
  if (cached !== undefined) return cached

  const response = await fetch(P_CHAIN_RPC, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method,
      params,
    }),
  })

  if (!response.ok) {
    throw new Error(`P-Chain RPC error: ${response.status} for ${method}`)
  }

  const json = await response.json()
  if (json.error) {
    throw new Error(
      `P-Chain RPC error: ${json.error.message ?? JSON.stringify(json.error)}`
    )
  }

  const result = json.result as T
  setCache(cacheKey, result)
  return result
}

export async function getPlatformTx(txId: string): Promise<PChainTxResult> {
  return pChainRpc<PChainTxResult>('platform.getTx', {
    txID: txId,
    encoding: 'json',
  })
}

export async function getCurrentValidators(
  nodeIds?: string[]
): Promise<PChainValidator[]> {
  const params: Record<string, unknown> = {
    subnetID: '11111111111111111111111111111111LpoYY',
  }
  if (nodeIds && nodeIds.length > 0) {
    params.nodeIDs = nodeIds
  }

  const result = await pChainRpc<PChainValidatorResult>(
    'platform.getCurrentValidators',
    params
  )

  return result.validators ?? []
}

export async function getPendingValidators(
  nodeIds?: string[]
): Promise<PChainValidator[]> {
  const params: Record<string, unknown> = {
    subnetID: '11111111111111111111111111111111LpoYY',
  }
  if (nodeIds && nodeIds.length > 0) {
    params.nodeIDs = nodeIds
  }

  const result = await pChainRpc<PChainValidatorResult>(
    'platform.getPendingValidators',
    params
  )

  return result.validators ?? []
}

export async function getPChainBalance(
  address: string
): Promise<{
  balance: string
  unlocked: string
  lockedStakeable: string
  lockedNotStakeable: string
}> {
  return pChainRpc<{
    balance: string
    unlocked: string
    lockedStakeable: string
    lockedNotStakeable: string
  }>('platform.getBalance', {
    addresses: [address],
  })
}
