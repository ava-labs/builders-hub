import type {
  EntityCluster,
  ClusterAddress,
  ClusterEvidence,
  GlacierTransaction,
} from './types'
import {
  getPChainTransactions,
  getXChainTransactions,
} from './glacier-client'
import { stripChainPrefix, normalizeAddress } from './address-resolver'

const MAX_CLUSTER_SIZE = 50
const MAX_TXS_PER_ADDRESS = 25
const MAX_QUEUE_SIZE = 200

interface QueueEntry {
  address: string
  chain: 'X' | 'P' | 'C'
  discoveryMethod: ClusterAddress['discoveryMethod']
  sourceAddress?: string
  txHash?: string
}

export async function clusterEntity(
  seedAddress: string,
  chain?: 'X' | 'P'
): Promise<EntityCluster> {
  const normalizedSeed = stripChainPrefix(seedAddress)
  const seedChain = chain ?? 'P'

  const addresses: ClusterAddress[] = []
  const evidence: ClusterEvidence[] = []
  const visited = new Set<string>()
  const queue: QueueEntry[] = [
    {
      address: normalizedSeed,
      chain: seedChain,
      discoveryMethod: 'seed',
    },
  ]

  while (queue.length > 0 && addresses.length < MAX_CLUSTER_SIZE) {
    const entry = queue.shift()
    if (!entry) break

    const visitKey = `${entry.chain}:${entry.address.toLowerCase()}`
    if (visited.has(visitKey)) continue
    visited.add(visitKey)

    addresses.push({
      address: entry.address,
      chain: entry.chain,
      discoveryMethod: entry.discoveryMethod,
    })

    if (entry.discoveryMethod !== 'seed' && entry.sourceAddress) {
      evidence.push({
        method: entry.discoveryMethod === 'co-spent' ? 'co-spent' : 'cross-chain',
        txHash: entry.txHash,
        details: `${entry.address} linked to ${entry.sourceAddress} via ${entry.discoveryMethod}`,
        addressA: entry.sourceAddress,
        addressB: entry.address,
      })
    }

    if (entry.chain === 'C') continue

    const newEntries = await discoverLinkedAddresses(
      entry.address,
      entry.chain as 'X' | 'P',
      visited
    )

    for (const newEntry of newEntries) {
      if (queue.length >= MAX_QUEUE_SIZE) break
      if (!visited.has(`${newEntry.chain}:${newEntry.address.toLowerCase()}`)) {
        queue.push({
          ...newEntry,
          sourceAddress: entry.address,
        })
      }
    }

    // Also add cross-chain address if bech32
    const addressInfo = normalizeAddress(entry.address)
    if (addressInfo.xChain && entry.chain === 'P') {
      const xAddr = stripChainPrefix(addressInfo.xChain)
      const xKey = `X:${xAddr.toLowerCase()}`
      if (!visited.has(xKey)) {
        queue.push({
          address: xAddr,
          chain: 'X',
          discoveryMethod: 'cross-chain',
          sourceAddress: entry.address,
        })
      }
    } else if (addressInfo.pChain && entry.chain === 'X') {
      const pAddr = stripChainPrefix(addressInfo.pChain)
      const pKey = `P:${pAddr.toLowerCase()}`
      if (!visited.has(pKey)) {
        queue.push({
          address: pAddr,
          chain: 'P',
          discoveryMethod: 'cross-chain',
          sourceAddress: entry.address,
        })
      }
    }
  }

  return {
    addresses,
    evidence,
    totalAddresses: addresses.length,
  }
}

async function discoverLinkedAddresses(
  address: string,
  chain: 'X' | 'P',
  visited: Set<string>
): Promise<Array<Omit<QueueEntry, 'sourceAddress'>>> {
  const results: Array<Omit<QueueEntry, 'sourceAddress'>> = []

  try {
    const fetcher =
      chain === 'X' ? getXChainTransactions : getPChainTransactions
    const resp = await fetcher(address, { pageSize: MAX_TXS_PER_ADDRESS })
    const txs = resp.transactions ?? []

    for (const tx of txs) {
      const coSpentAddresses = extractCoSpentAddresses(tx, address)

      for (const coSpent of coSpentAddresses) {
        const visitKey = `${chain}:${coSpent.toLowerCase()}`
        if (!visited.has(visitKey)) {
          results.push({
            address: coSpent,
            chain,
            discoveryMethod: 'co-spent',
            txHash: tx.txHash,
          })
        }
      }
    }
  } catch {
    // Silently handle API errors
  }

  return results
}

function extractCoSpentAddresses(
  tx: GlacierTransaction,
  currentAddress: string
): string[] {
  const consumedUtxos = tx.consumedUtxos ?? []

  if (consumedUtxos.length < 2) return []

  const inputAddresses = new Set<string>()
  let currentAddressIsInput = false

  for (const utxo of consumedUtxos) {
    for (const addr of utxo.addresses ?? []) {
      const normalized = stripChainPrefix(addr).toLowerCase()
      if (normalized === currentAddress.toLowerCase()) {
        currentAddressIsInput = true
      } else {
        inputAddresses.add(normalized)
      }
    }
  }

  if (!currentAddressIsInput) return []

  return Array.from(inputAddresses)
}
