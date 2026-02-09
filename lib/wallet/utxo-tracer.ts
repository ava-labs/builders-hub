import type { FundTrace, GlacierTransaction, GlacierUtxo } from './types'
import {
  getXChainTransactions,
  getPChainTransactions,
  getTransactionDetail,
} from './glacier-client'
import { lookupGenesis } from './genesis-index'
import { stripChainPrefix } from './address-resolver'

const MAX_DEPTH = 10
const MAX_TXS_PER_ADDRESS = 20
const MAX_SOURCES_PER_LEVEL = 15

interface TraceOptions {
  chain: 'X' | 'P'
  maxDepth?: number
  direction?: 'backward' | 'forward'
}

export async function traceFunds(
  address: string,
  options: TraceOptions
): Promise<FundTrace> {
  const {
    chain,
    maxDepth = 5,
    direction = 'backward',
  } = options

  const effectiveMaxDepth = Math.min(maxDepth, MAX_DEPTH)
  const visited = new Set<string>()

  if (direction === 'backward') {
    return traceBackward(address, chain, 0, effectiveMaxDepth, visited)
  }
  return traceForward(address, chain, 0, effectiveMaxDepth, visited)
}

async function traceBackward(
  address: string,
  chain: 'X' | 'P',
  depth: number,
  maxDepth: number,
  visited: Set<string>
): Promise<FundTrace> {
  const normalizedAddr = stripChainPrefix(address)
  const visitKey = `${chain}:${normalizedAddr}`

  if (visited.has(visitKey)) {
    return {
      address: normalizedAddr,
      chain,
      depth,
      isGenesis: false,
      sources: [],
    }
  }
  visited.add(visitKey)

  const genesisAllocation = await lookupGenesis(normalizedAddr).catch(
    () => undefined
  )
  if (genesisAllocation) {
    return {
      address: normalizedAddr,
      chain,
      depth,
      isGenesis: true,
      genesisAllocation,
      sources: [],
    }
  }

  if (depth >= maxDepth) {
    return {
      address: normalizedAddr,
      chain,
      depth,
      isGenesis: false,
      sources: [],
    }
  }

  const txs = await fetchTransactions(normalizedAddr, chain)

  const sourceAddresses = new Map<string, { txHash: string; amount?: string }>()

  for (const tx of txs) {
    const consumedUtxos = tx.consumedUtxos ?? []

    const isRecipient = (tx.emittedUtxos ?? []).some((utxo) =>
      utxo.addresses?.some(
        (a) => stripChainPrefix(a).toLowerCase() === normalizedAddr.toLowerCase()
      )
    )

    if (!isRecipient) continue

    for (const utxo of consumedUtxos) {
      for (const sourceAddr of utxo.addresses ?? []) {
        const normalizedSource = stripChainPrefix(sourceAddr)
        if (
          normalizedSource.toLowerCase() !== normalizedAddr.toLowerCase() &&
          !sourceAddresses.has(normalizedSource.toLowerCase())
        ) {
          sourceAddresses.set(normalizedSource.toLowerCase(), {
            txHash: tx.txHash,
            amount: utxo.amount,
          })
        }
      }
    }

    if (sourceAddresses.size >= MAX_SOURCES_PER_LEVEL) break
  }

  const sourceEntries = Array.from(sourceAddresses.entries()).slice(
    0,
    MAX_SOURCES_PER_LEVEL
  )

  const sources = await Promise.all(
    sourceEntries.map(async ([sourceAddr, info]) => {
      const trace = await traceBackward(
        sourceAddr,
        chain,
        depth + 1,
        maxDepth,
        visited
      )
      return {
        ...trace,
        txHash: info.txHash,
        amountNanoAvax: info.amount,
      }
    })
  )

  return {
    address: normalizedAddr,
    chain,
    depth,
    isGenesis: false,
    sources,
  }
}

async function traceForward(
  address: string,
  chain: 'X' | 'P',
  depth: number,
  maxDepth: number,
  visited: Set<string>
): Promise<FundTrace> {
  const normalizedAddr = stripChainPrefix(address)
  const visitKey = `${chain}:${normalizedAddr}`

  if (visited.has(visitKey)) {
    return {
      address: normalizedAddr,
      chain,
      depth,
      isGenesis: false,
      sources: [],
    }
  }
  visited.add(visitKey)

  const genesisAllocation = await lookupGenesis(normalizedAddr).catch(
    () => undefined
  )

  if (depth >= maxDepth) {
    return {
      address: normalizedAddr,
      chain,
      depth,
      isGenesis: !!genesisAllocation,
      genesisAllocation,
      sources: [],
    }
  }

  const txs = await fetchTransactions(normalizedAddr, chain)

  const destAddresses = new Map<string, { txHash: string; amount?: string }>()

  for (const tx of txs) {
    const isSender = (tx.consumedUtxos ?? []).some((utxo) =>
      utxo.addresses?.some(
        (a) => stripChainPrefix(a).toLowerCase() === normalizedAddr.toLowerCase()
      )
    )

    if (!isSender) continue

    for (const utxo of tx.emittedUtxos ?? []) {
      for (const destAddr of utxo.addresses ?? []) {
        const normalizedDest = stripChainPrefix(destAddr)
        if (
          normalizedDest.toLowerCase() !== normalizedAddr.toLowerCase() &&
          !destAddresses.has(normalizedDest.toLowerCase())
        ) {
          destAddresses.set(normalizedDest.toLowerCase(), {
            txHash: tx.txHash,
            amount: utxo.amount,
          })
        }
      }
    }

    if (destAddresses.size >= MAX_SOURCES_PER_LEVEL) break
  }

  const destEntries = Array.from(destAddresses.entries()).slice(
    0,
    MAX_SOURCES_PER_LEVEL
  )

  const sources = await Promise.all(
    destEntries.map(async ([destAddr, info]) => {
      const trace = await traceForward(
        destAddr,
        chain,
        depth + 1,
        maxDepth,
        visited
      )
      return {
        ...trace,
        txHash: info.txHash,
        amountNanoAvax: info.amount,
      }
    })
  )

  return {
    address: normalizedAddr,
    chain,
    depth,
    isGenesis: !!genesisAllocation,
    genesisAllocation,
    sources,
  }
}

async function fetchTransactions(
  address: string,
  chain: 'X' | 'P'
): Promise<GlacierTransaction[]> {
  try {
    const fetcher =
      chain === 'X' ? getXChainTransactions : getPChainTransactions
    const resp = await fetcher(address, { pageSize: MAX_TXS_PER_ADDRESS })
    return resp.transactions ?? []
  } catch {
    return []
  }
}

export function summarizeTrace(trace: FundTrace, maxItems = 10): {
  genesisCount: number
  totalAddresses: number
  maxDepth: number
  genesisAddresses: Array<{ address: string; amount: number; depth: number }>
  truncated: boolean
} {
  const genesisAddresses: Array<{
    address: string
    amount: number
    depth: number
  }> = []
  let totalAddresses = 0
  let maxDepthFound = 0

  function walk(node: FundTrace): void {
    totalAddresses++
    if (node.depth > maxDepthFound) maxDepthFound = node.depth

    if (node.isGenesis && node.genesisAllocation) {
      genesisAddresses.push({
        address: node.address,
        amount: node.genesisAllocation.initialAmount / 1e9,
        depth: node.depth,
      })
    }

    for (const source of node.sources) {
      walk(source)
    }
  }

  walk(trace)

  const truncated = genesisAddresses.length > maxItems
  return {
    genesisCount: genesisAddresses.length,
    totalAddresses,
    maxDepth: maxDepthFound,
    genesisAddresses: genesisAddresses.slice(0, maxItems),
    truncated,
  }
}
