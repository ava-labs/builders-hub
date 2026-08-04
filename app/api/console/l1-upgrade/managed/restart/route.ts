import { NextRequest, NextResponse } from 'next/server';
import { getUserId, jsonError, jsonOk } from '@/app/api/managed-testnet-nodes/utils';
import { builderHubRestartManagedNode } from '@/app/api/managed-testnet-nodes/service';
import { ManagedTestnetNodesServiceURLs } from '@/app/api/managed-testnet-nodes/constants';
import { isValidAvalancheId } from '@/lib/console/l1-upgrade-selection';
import { getActiveManagedUpgradeNodes } from '../utils';

type RestartBody = {
  subnetId?: string;
  blockchainId?: string;
};

// Between node restarts, wait (bounded) for the chain to be producing blocks
// again before touching the next node, so a multi-node managed set is rolled
// rather than rebooted all at once (which can drop the L1 below quorum).
// Best-effort: the shared RPC load-balances across nodes, so this confirms
// chain liveness/quorum, not a specific node — and it proceeds after the cap.
async function waitForChainLiveness(blockchainId: string, timeoutMs = 30_000): Promise<void> {
  const url = ManagedTestnetNodesServiceURLs.rpcEndpoint(blockchainId);
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_blockNumber', params: [] }),
        signal: AbortSignal.timeout(5_000),
      });
      if (response.ok) {
        const json = (await response.json().catch(() => null)) as { result?: string } | null;
        if (json?.result) return;
      }
    } catch {
      // node still coming back up — keep polling until the deadline
    }
    await new Promise((resolve) => setTimeout(resolve, 3_000));
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const { userId, error } = await getUserId();
  if (error) return error;

  let body: RestartBody;
  try {
    body = (await request.json()) as RestartBody;
  } catch {
    return jsonError(400, 'Invalid JSON body');
  }

  const { subnetId, blockchainId } = body;
  if (!subnetId || !blockchainId) {
    return jsonError(400, 'subnetId and blockchainId are required');
  }
  if (!isValidAvalancheId(subnetId) || !isValidAvalancheId(blockchainId)) {
    return jsonError(400, 'subnetId and blockchainId must be valid Avalanche CB58 IDs');
  }

  const nodes = await getActiveManagedUpgradeNodes({ userId: userId!, subnetId, blockchainId });
  if (nodes.length === 0) {
    return jsonError(404, 'No active managed nodes found for this L1.');
  }

  const results = [];
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    try {
      const result = await builderHubRestartManagedNode({ subnetId, nodeIndex: node.node_index! });
      results.push({ nodeId: node.id, nodeIndex: node.node_index, ok: true, result });
    } catch (error) {
      results.push({
        nodeId: node.id,
        nodeIndex: node.node_index,
        ok: false,
        error: error instanceof Error ? error.message : 'Failed to restart node',
      });
    }
    // Roll the restart: let the chain recover before rebooting the next node.
    if (i < nodes.length - 1) {
      await waitForChainLiveness(blockchainId);
    }
  }

  const failed = results.filter((result) => !result.ok);
  if (failed.length > 0) {
    return jsonError(502, `Failed to restart ${failed.length} managed node(s).`, failed);
  }

  return jsonOk({ success: true, results });
}
