import { tool } from 'ai'
import { z } from 'zod'
import { traceFunds, summarizeTrace } from '@/lib/wallet/utxo-tracer'
import { clusterEntity } from '@/lib/wallet/entity-clusterer'
import { analyzeValidator } from '@/lib/wallet/validator-analyzer'
import { lookupGenesis } from '@/lib/wallet/genesis-index'
import { stripChainPrefix } from '@/lib/wallet/address-resolver'

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Operation timed out after ${ms}ms`)), ms)
    ),
  ])
}

function formatNanoAvax(nanoAvax: string | number | undefined): string | undefined {
  if (nanoAvax === undefined) return undefined
  const n = typeof nanoAvax === 'string' ? parseInt(nanoAvax, 10) : nanoAvax
  if (isNaN(n)) return undefined
  return `${(n / 1e9).toFixed(4)} AVAX`
}

export const walletTools = {
  wallet_trace_funds: tool({
    description:
      'Trace fund sources or destinations for an Avalanche X-Chain or P-Chain address. ' +
      'Use "backward" to trace where funds came from (toward genesis), or "forward" to trace where funds went. ' +
      'Accepts any address format: avax1..., X-avax1..., P-avax1..., or 0x... ' +
      'Example: "trace funds backward for P-avax1abc..." or "where did funds go from avax1xyz..."',
    inputSchema: z.object({
      address: z.string().describe('The address to trace (avax1..., X-avax1..., P-avax1..., or 0x...)'),
      direction: z.enum(['backward', 'forward']).default('backward').describe('backward = trace fund sources toward genesis, forward = trace fund destinations'),
      chain: z.enum(['X', 'P']).default('P').describe('Which chain to trace on (P-Chain or X-Chain)'),
      maxDepth: z.number().int().min(1).max(10).default(5).describe('Maximum trace depth (1-10, higher = slower but more complete)'),
    }),
    execute: async (input) => {
      const normalizedAddress = stripChainPrefix(input.address)

      try {
        const trace = await withTimeout(
          traceFunds(normalizedAddress, {
            chain: input.chain,
            direction: input.direction,
            maxDepth: input.maxDepth,
          }),
          55000
        )

        const summary = summarizeTrace(trace)

        return {
          address: normalizedAddress,
          chain: input.chain,
          direction: input.direction,
          maxDepthReached: summary.maxDepth,
          totalAddressesTraced: summary.totalAddresses,
          genesisConnectionsFound: summary.genesisCount,
          genesisAddresses: summary.genesisAddresses.map((g) => ({
            address: g.address,
            allocation: formatNanoAvax(g.amount * 1e9),
            depth: g.depth,
          })),
          truncated: summary.truncated,
          rootIsGenesis: trace.isGenesis,
          rootGenesisAllocation: trace.genesisAllocation
            ? {
                avaxAddr: trace.genesisAllocation.avaxAddr,
                ethAddr: trace.genesisAllocation.ethAddr,
                initialAmount: formatNanoAvax(trace.genesisAllocation.initialAmount),
              }
            : undefined,
        }
      } catch (error) {
        return {
          error: 'Fund tracing failed',
          details: error instanceof Error ? error.message : String(error),
          address: normalizedAddress,
        }
      }
    },
  }),

  wallet_cluster_entity: tool({
    description:
      'Find all addresses likely controlled by the same entity using co-spent input heuristics (BFS clustering). ' +
      'Given a seed address, discovers related addresses across X-Chain and P-Chain. ' +
      'Example: "find all addresses related to avax1abc..." or "who else controls P-avax1xyz..."',
    inputSchema: z.object({
      address: z.string().describe('Seed address to start clustering from (avax1..., X-avax1..., P-avax1...)'),
      chain: z.enum(['X', 'P']).default('P').describe('Starting chain for the cluster search'),
    }),
    execute: async (input) => {
      const normalizedAddress = stripChainPrefix(input.address)

      try {
        const cluster = await withTimeout(
          clusterEntity(normalizedAddress, input.chain),
          30000
        )

        return {
          seedAddress: normalizedAddress,
          totalAddressesFound: cluster.totalAddresses,
          addresses: cluster.addresses.map((a) => ({
            address: a.address,
            chain: a.chain,
            discoveryMethod: a.discoveryMethod,
          })),
          evidenceLinks: cluster.evidence.map((e) => ({
            method: e.method,
            txHash: e.txHash,
            addressA: e.addressA,
            addressB: e.addressB,
            details: e.details,
          })),
        }
      } catch (error) {
        return {
          error: 'Entity clustering failed',
          details: error instanceof Error ? error.message : String(error),
          address: normalizedAddress,
        }
      }
    },
  }),

  wallet_analyze_validator: tool({
    description:
      'Deep analysis of an Avalanche validator: status, stake, fund sources, and genesis connections. ' +
      'This is more thorough than the basic blockchain_lookup_validator tool - it traces fund origins. ' +
      'Accepts NodeID-xxx format or raw node ID. ' +
      'Example: "analyze validator NodeID-4gTwepTF5..." or "who funds this validator?"',
    inputSchema: z.object({
      nodeId: z.string().describe('Validator node ID (NodeID-xxx or raw ID without prefix)'),
    }),
    execute: async (input) => {
      const normalizedNodeId = input.nodeId.startsWith('NodeID-')
        ? input.nodeId
        : `NodeID-${input.nodeId}`

      try {
        const profile = await withTimeout(
          analyzeValidator(normalizedNodeId),
          55000
        )

        return {
          nodeId: profile.nodeId,
          status: profile.status,
          stakeAmount: formatNanoAvax(profile.stakeAmountNanoAvax),
          startTime: profile.startTime,
          endTime: profile.endTime,
          delegationFee: profile.delegationFee,
          uptime: profile.uptime,
          connected: profile.connected,
          rewardAddress: profile.rewardAddress,
          stakingAddresses: profile.stakingAddresses,
          genesisConnections: profile.genesisLinks.map((link) => ({
            genesisAddress: link.genesisAddress,
            allocationAvax: formatNanoAvax(link.allocation.initialAmount),
            fundingPath: link.path,
            depth: link.depth,
          })),
          totalGenesisLinks: profile.genesisLinks.length,
          fundSourcesTraced: profile.fundSources.length,
        }
      } catch (error) {
        return {
          error: 'Validator analysis failed',
          details: error instanceof Error ? error.message : String(error),
          nodeId: normalizedNodeId,
        }
      }
    },
  }),

  wallet_lookup_genesis: tool({
    description:
      'Check if an address received an allocation in the Avalanche genesis block. ' +
      'Returns whether the address is a genesis address and its initial AVAX allocation details. ' +
      'Accepts any format: avax1..., X-avax1..., P-avax1..., or 0x... ' +
      'Example: "is avax1abc... a genesis address?" or "check genesis for 0x..."',
    inputSchema: z.object({
      address: z.string().describe('Address to check (avax1..., X-avax1..., P-avax1..., or 0x...)'),
    }),
    execute: async (input) => {
      const normalizedAddress = input.address.startsWith('0x')
        ? input.address
        : stripChainPrefix(input.address)

      try {
        const allocation = await withTimeout(
          lookupGenesis(normalizedAddress),
          15000
        )

        if (!allocation) {
          return {
            address: normalizedAddress,
            isGenesis: false,
            message: 'This address did not receive a genesis allocation.',
          }
        }

        return {
          address: normalizedAddress,
          isGenesis: true,
          avaxAddress: allocation.avaxAddr,
          ethAddress: allocation.ethAddr,
          initialAmount: formatNanoAvax(allocation.initialAmount),
          unlockSchedule: allocation.unlockSchedule.map((s) => ({
            amount: formatNanoAvax(s.amount),
            locktime: new Date(s.locktime * 1000).toISOString(),
          })),
        }
      } catch (error) {
        return {
          error: 'Genesis lookup failed',
          details: error instanceof Error ? error.message : String(error),
          address: normalizedAddress,
        }
      }
    },
  }),
}
