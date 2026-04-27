import { NextRequest, NextResponse } from 'next/server';
import { getUserId, jsonError, jsonOk } from '../../managed-testnet-nodes/utils';
import { getUserNodes } from '../../managed-testnet-nodes/service';
import { getBlockchainInfoForNetwork } from '@/components/toolbox/coreViem/utils/glacier';

// Per-L1 aggregation of one user's NodeRegistration rows. The dashboard reads
// from this instead of `walletChainId` so the page survives Reset Console
// State and wallet network switches — the source of truth becomes the user's
// Builder Hub account, not the wallet's selected chain.
export interface MyL1 {
  /** P-Chain subnet ID (CB58). Unique per L1. */
  subnetId: string;
  /** P-Chain blockchain ID (CB58) of the primary chain on this subnet. */
  blockchainId: string;
  /** EVM chain ID (decimal) — matches `walletChainId` when the wallet is on this L1. */
  evmChainId: number | null;
  /** Display name from glacier or NodeRegistration.chain_name fallback. */
  chainName: string;
  /** RPC endpoint to call from the dashboard / wallet. */
  rpcUrl: string;
  /** Whether glacier reports this chain as testnet (managed nodes are always testnet). */
  isTestnet: boolean;
  /** Earliest expiry across the user's nodes for this L1 — drives the "expires in" pill. */
  expiresAt: string;
  /** First time the user provisioned a node for this L1. */
  firstSeenAt: string;
  /** Most recent activity for this L1 — used to sort. */
  lastSeenAt: string;
  /** All node registrations for this L1, newest first. */
  nodes: Array<{
    id: string;
    nodeId: string;
    nodeIndex: number | null;
    rpcUrl: string;
    status: string;
    createdAt: string;
    expiresAt: string;
  }>;
}

interface NodeRow {
  id: string;
  user_id: string;
  subnet_id: string;
  blockchain_id: string;
  node_id: string;
  node_index: number | null;
  rpc_url: string;
  chain_name: string | null;
  status: string;
  created_at: Date;
  expires_at: Date;
}

async function aggregateL1s(nodes: NodeRow[]): Promise<MyL1[]> {
  // Group nodes by subnet_id, keeping the most recent blockchain_id per subnet
  // (in practice subnet → blockchain is 1:1, but defensively pick the newest).
  const bySubnet = new Map<string, NodeRow[]>();
  for (const node of nodes) {
    const list = bySubnet.get(node.subnet_id) ?? [];
    list.push(node);
    bySubnet.set(node.subnet_id, list);
  }

  // Resolve glacier metadata in parallel to avoid N round-trips serialised.
  // Failures fall back to NodeRegistration.chain_name + a null evmChainId so
  // the dashboard still renders the L1 (just without TPS / wallet add).
  const entries = Array.from(bySubnet.entries());
  const results = await Promise.all(
    entries.map(async ([subnetId, group]): Promise<MyL1> => {
      const sorted = [...group].sort(
        (a, b) => b.created_at.getTime() - a.created_at.getTime(),
      );
      const newest = sorted[0];

      let evmChainId: number | null = null;
      let chainName = newest.chain_name ?? subnetId.slice(0, 8);
      let isTestnet = true;
      try {
        const info = await getBlockchainInfoForNetwork('testnet', newest.blockchain_id);
        evmChainId = info.evmChainId;
        chainName = info.blockchainName || chainName;
      } catch {
        // Glacier may not have indexed a brand-new L1 yet; ship without enrichment.
      }

      const expiresAtMs = Math.min(...group.map((n) => n.expires_at.getTime()));
      const firstSeenAt = new Date(
        Math.min(...group.map((n) => n.created_at.getTime())),
      );
      const lastSeenAt = new Date(
        Math.max(...group.map((n) => n.created_at.getTime())),
      );

      return {
        subnetId,
        blockchainId: newest.blockchain_id,
        evmChainId,
        chainName,
        rpcUrl: newest.rpc_url,
        isTestnet,
        expiresAt: new Date(expiresAtMs).toISOString(),
        firstSeenAt: firstSeenAt.toISOString(),
        lastSeenAt: lastSeenAt.toISOString(),
        nodes: sorted.map((n) => ({
          id: n.id,
          nodeId: n.node_id,
          nodeIndex: n.node_index,
          rpcUrl: n.rpc_url,
          status: n.status,
          createdAt: n.created_at.toISOString(),
          expiresAt: n.expires_at.toISOString(),
        })),
      };
    }),
  );

  return results.sort((a, b) => b.lastSeenAt.localeCompare(a.lastSeenAt));
}

/**
 * GET /api/console/my-l1s
 * Returns the active L1s tied to the authenticated user's Builder Hub
 * account. Aggregates NodeRegistration rows by subnet_id and enriches each
 * with glacier metadata (evmChainId, friendly name).
 */
export async function GET(_request: NextRequest): Promise<NextResponse> {
  const { userId, error } = await getUserId();
  if (error) return error;

  try {
    const nodes = await getUserNodes(userId!);
    if (nodes.length === 0) {
      return jsonOk({ l1s: [], total: 0 });
    }
    const l1s = await aggregateL1s(nodes as NodeRow[]);
    return jsonOk({ l1s, total: l1s.length });
  } catch (err) {
    return jsonError(
      500,
      err instanceof Error ? err.message : 'Failed to load my L1s',
      err,
    );
  }
}
