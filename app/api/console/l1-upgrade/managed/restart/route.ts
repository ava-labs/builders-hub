import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/prisma/prisma';
import { getUserId, jsonError, jsonOk } from '@/app/api/managed-testnet-nodes/utils';
import { builderHubRestartManagedNode } from '@/app/api/managed-testnet-nodes/service';
import { getActiveManagedUpgradeNodes } from '../utils';

type RestartBody = {
  subnetId?: string;
  blockchainId?: string;
};

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

  const nodes = await getActiveManagedUpgradeNodes({ userId: userId!, subnetId, blockchainId });
  if (nodes.length === 0) {
    return jsonError(404, 'No active managed nodes found for this L1.');
  }

  const results = [];
  for (const node of nodes) {
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
  }

  const failed = results.filter((result) => !result.ok);
  if (failed.length > 0) {
    return jsonError(502, `Failed to restart ${failed.length} managed node(s).`, failed);
  }

  await prisma.l1UpgradeSnapshot.updateMany({
    where: { user_id: userId!, subnet_id: subnetId, blockchain_id: blockchainId },
    data: { status: 'restart-requested', source: 'managed-restart' },
  });

  return jsonOk({ success: true, results });
}
