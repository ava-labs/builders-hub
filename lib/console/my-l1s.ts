import { getBlockchainInfoForNetwork } from '@/components/toolbox/coreViem/utils/glacier';

// Per-L1 aggregation of one user's NodeRegistration rows. The dashboard reads
// from this instead of `walletChainId` so the page survives Reset Console
// State and wallet network switches: the source of truth becomes the user's
// Builder Hub account, not the wallet's selected chain.
export interface MyL1 {
  /** P-Chain subnet ID (CB58). Unique per L1. */
  subnetId: string;
  /** P-Chain blockchain ID (CB58) of the primary chain on this subnet. */
  blockchainId: string;
  /** EVM chain ID (decimal) - matches `walletChainId` when the wallet is on this L1. */
  evmChainId: number | null;
  /** Display name from glacier or NodeRegistration.chain_name fallback. */
  chainName: string;
  /** RPC endpoint to call from the dashboard / wallet. */
  rpcUrl: string;
  /** Whether glacier reports this chain as testnet (managed nodes are always testnet). */
  isTestnet: boolean;
  /** L1-level status: 'active' if any node is alive, 'expired' if all nodes spun down. */
  status: 'active' | 'expired';
  /** Latest active-node expiry for live L1s, or latest historical expiry for spun-down L1s. */
  expiresAt: string;
  /** First time the user provisioned a node for this L1. */
  firstSeenAt: string;
  /** Most recent activity for this L1 - used to sort. */
  lastSeenAt: string;
  /**
   * Per-L1 firn block explorer at `<8-char-slug>.firn.gg`. Always set
   * for managed L1s — slug is just `blockchainId.slice(0,8).toLowerCase()`,
   * which is the same shape firn-explorer's middleware regex accepts.
   * The CombinedL1 merge in the dashboard plumbs this through to
   * DetailHeader's "Open Explorer" button + the wallet-add `blockExplorerUrls`.
   */
  explorerUrl: string;
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

export interface NodeRow {
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

function isNodeActive(node: NodeRow, now: number): boolean {
  return node.status === 'active' && node.expires_at.getTime() > now;
}

export async function aggregateL1s(nodes: NodeRow[]): Promise<MyL1[]> {
  const now = Date.now();

  // Group nodes by subnet_id, keeping the most recent blockchain_id per subnet
  // (in practice subnet -> blockchain is 1:1, but defensively pick the newest).
  const bySubnet = new Map<string, NodeRow[]>();
  for (const node of nodes) {
    const list = bySubnet.get(node.subnet_id) ?? [];
    list.push(node);
    bySubnet.set(node.subnet_id, list);
  }

  // Resolve glacier metadata in parallel to avoid N round-trips serialized.
  // Failures fall back to NodeRegistration.chain_name + a null evmChainId so
  // the dashboard still renders the L1 (just without TPS / wallet add).
  const entries = Array.from(bySubnet.entries());
  const results = await Promise.all(
    entries.map(async ([subnetId, group]): Promise<MyL1> => {
      const sorted = [...group].sort(
        (a, b) => b.created_at.getTime() - a.created_at.getTime(),
      );
      const newest = sorted[0];
      const anyActive = group.some((n) => isNodeActive(n, now));

      let evmChainId: number | null = null;
      let chainName = newest.chain_name ?? subnetId.slice(0, 8);
      const isTestnet = true;
      try {
        const info = await getBlockchainInfoForNetwork('testnet', newest.blockchain_id);
        evmChainId = info.evmChainId;
        chainName = info.blockchainName || chainName;
      } catch {
        // Glacier may not have indexed a brand-new L1 yet; ship without enrichment.
      }

      const activeExpiryTimes = group
        .filter((n) => isNodeActive(n, now))
        .map((n) => n.expires_at.getTime());
      const allExpiryTimes = group.map((n) => n.expires_at.getTime());
      const expiresAtMs =
        activeExpiryTimes.length > 0
          ? Math.max(...activeExpiryTimes)
          : Math.max(...allExpiryTimes);
      const firstSeenAt = new Date(
        Math.min(...group.map((n) => n.created_at.getTime())),
      );
      const lastSeenAt = new Date(
        Math.max(...group.map((n) => n.created_at.getTime())),
      );

      // firn explorer URL — slug is the lowercased first 8 chars of
      // the blockchainId, matching firn-explorer's middleware regex.
      // Same derivation lives in quick-l1's finalizeSlotMetadata; we
      // duplicate it here so already-provisioned managed L1s (whose
      // NodeRegistration rows pre-date the explorer field on
      // DeploymentResult) still get a usable URL on the dashboard.
      const explorerUrl = `https://${newest.blockchain_id.toLowerCase().slice(0, 8)}.firn.gg`;

      return {
        subnetId,
        blockchainId: newest.blockchain_id,
        evmChainId,
        chainName,
        rpcUrl: newest.rpc_url,
        isTestnet,
        status: anyActive ? 'active' : 'expired',
        expiresAt: new Date(expiresAtMs).toISOString(),
        firstSeenAt: firstSeenAt.toISOString(),
        lastSeenAt: lastSeenAt.toISOString(),
        explorerUrl,
        nodes: sorted.map((n) => ({
          id: n.id,
          nodeId: n.node_id,
          nodeIndex: n.node_index,
          rpcUrl: n.rpc_url,
          status: isNodeActive(n, now) ? 'active' : 'expired',
          createdAt: n.created_at.toISOString(),
          expiresAt: n.expires_at.toISOString(),
        })),
      };
    }),
  );

  return results.sort((a, b) => b.lastSeenAt.localeCompare(a.lastSeenAt));
}
