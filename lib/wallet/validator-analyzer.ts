import type {
  ValidatorProfile,
  FundTrace,
  GenesisLink,
  PChainValidator,
} from './types'
import {
  getCurrentValidators,
  getPendingValidators,
} from './p-chain-client'
import { traceFunds, summarizeTrace } from './utxo-tracer'
import { stripChainPrefix } from './address-resolver'

const TRACE_DEPTH = 5

export async function analyzeValidator(
  nodeId: string
): Promise<ValidatorProfile> {
  const normalizedNodeId = nodeId.startsWith('NodeID-')
    ? nodeId
    : `NodeID-${nodeId}`

  const [currentValidators, pendingValidators] = await Promise.all([
    getCurrentValidators([normalizedNodeId]).catch(() => []),
    getPendingValidators([normalizedNodeId]).catch(() => []),
  ])

  const validator = currentValidators[0] ?? pendingValidators[0]
  const status: ValidatorProfile['status'] = currentValidators[0]
    ? 'active'
    : pendingValidators[0]
      ? 'pending'
      : 'inactive'

  const stakingAddresses = extractStakingAddresses(validator)
  const rewardAddress = extractRewardAddress(validator)

  const addressesToTrace = [...new Set([
    ...(rewardAddress ? [rewardAddress] : []),
    ...stakingAddresses,
  ])]

  const traces = await Promise.all(
    addressesToTrace.slice(0, 5).map((addr) =>
      traceFunds(stripChainPrefix(addr), {
        chain: 'P',
        maxDepth: TRACE_DEPTH,
        direction: 'backward',
      }).catch((): FundTrace => ({
        address: stripChainPrefix(addr),
        chain: 'P',
        depth: 0,
        isGenesis: false,
        sources: [],
      }))
    )
  )

  const genesisLinks = extractGenesisLinks(traces)

  return {
    nodeId: normalizedNodeId,
    status,
    stakeAmountNanoAvax: validator?.stakeAmount ?? validator?.weight,
    startTime: validator?.startTime
      ? new Date(parseInt(validator.startTime) * 1000).toISOString()
      : undefined,
    endTime: validator?.endTime
      ? new Date(parseInt(validator.endTime) * 1000).toISOString()
      : undefined,
    delegationFee: validator?.delegationFee,
    uptime: validator?.uptime,
    connected: validator?.connected,
    rewardAddress: rewardAddress ?? undefined,
    stakingAddresses,
    fundSources: traces,
    genesisLinks,
  }
}

function extractStakingAddresses(
  validator: PChainValidator | undefined
): string[] {
  if (!validator) return []
  const addresses: string[] = []

  if (validator.stakeOwners?.addresses) {
    addresses.push(...validator.stakeOwners.addresses)
  }

  return [...new Set(addresses)]
}

function extractRewardAddress(
  validator: PChainValidator | undefined
): string | null {
  if (!validator?.rewardOwner?.addresses?.length) return null
  return validator.rewardOwner.addresses[0]
}

function extractGenesisLinks(traces: FundTrace[]): GenesisLink[] {
  const links: GenesisLink[] = []

  function walk(node: FundTrace, path: string[]): void {
    const currentPath = [...path, node.address]

    if (node.isGenesis && node.genesisAllocation) {
      links.push({
        genesisAddress: node.address,
        allocation: node.genesisAllocation,
        path: currentPath,
        depth: node.depth,
      })
    }

    for (const source of node.sources) {
      walk(source, currentPath)
    }
  }

  for (const trace of traces) {
    walk(trace, [])
  }

  return links
}
