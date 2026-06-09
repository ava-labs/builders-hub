import { NextRequest, NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/prisma/prisma';
import { getUserId, jsonError, jsonOk } from '@/app/api/managed-testnet-nodes/utils';
import {
  builderHubGetUpgradeJson,
  builderHubWriteUpgradeJson,
  ManagedTestnetNodeServiceRequestError,
} from '@/app/api/managed-testnet-nodes/service';
import { parseUpgradeJson } from '@/lib/console/upgrade-json';
import { getActiveManagedUpgradeNodes } from './utils';

type WriteManagedBody = {
  subnetId?: string;
  blockchainId?: string;
  chainName?: string | null;
  rpcUrl?: string | null;
  upgradeJson?: unknown;
};

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { userId, error } = await getUserId();
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const subnetId = searchParams.get('subnetId');
  const blockchainId = searchParams.get('blockchainId');
  if (!subnetId || !blockchainId) {
    return jsonError(400, 'subnetId and blockchainId are required');
  }

  const nodes = await getActiveManagedUpgradeNodes({ userId: userId!, subnetId, blockchainId });
  if (nodes.length === 0) {
    return jsonOk({ managed: false, nodes: [], upgradeJson: null, exists: false });
  }

  const firstNode = nodes[0];
  try {
    const result = await builderHubGetUpgradeJson({
      subnetId,
      blockchainId,
      nodeIndex: firstNode.node_index!,
    });
    return jsonOk({
      managed: true,
      nodes: nodes.map((node) => ({ id: node.id, nodeIndex: node.node_index, nodeId: node.node_id })),
      ...result,
    });
  } catch (error) {
    const status = error instanceof ManagedTestnetNodeServiceRequestError ? error.status : 502;
    return jsonError(status, error instanceof Error ? error.message : 'Failed to fetch managed upgrade.json', error);
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const { userId, error } = await getUserId();
  if (error) return error;

  let body: WriteManagedBody;
  try {
    body = (await request.json()) as WriteManagedBody;
  } catch {
    return jsonError(400, 'Invalid JSON body');
  }

  const { subnetId, blockchainId } = body;
  if (!subnetId || !blockchainId) {
    return jsonError(400, 'subnetId and blockchainId are required');
  }

  const parsed = parseUpgradeJson(
    typeof body.upgradeJson === 'string' ? body.upgradeJson : JSON.stringify(body.upgradeJson ?? {}),
  );
  if (!parsed.config || parsed.error) {
    return jsonError(400, parsed.error || 'Invalid upgrade.json');
  }

  const nodes = await getActiveManagedUpgradeNodes({ userId: userId!, subnetId, blockchainId });
  if (nodes.length === 0) {
    return jsonError(404, 'No active managed nodes found for this L1.');
  }

  const results = [];
  for (const node of nodes) {
    try {
      const result = await builderHubWriteUpgradeJson({
        subnetId,
        blockchainId,
        nodeIndex: node.node_index!,
        upgradeJson: parsed.config,
      });
      results.push({ nodeId: node.id, nodeIndex: node.node_index, ok: true, result });
    } catch (error) {
      results.push({
        nodeId: node.id,
        nodeIndex: node.node_index,
        ok: false,
        error: error instanceof Error ? error.message : 'Failed to write upgrade.json',
      });
    }
  }

  const failed = results.filter((result) => !result.ok);
  if (failed.length > 0) {
    return jsonError(502, `Failed to write upgrade.json to ${failed.length} managed node(s).`, failed);
  }

  const snapshot = await prisma.l1UpgradeSnapshot.upsert({
    where: {
      user_id_subnet_id_blockchain_id: {
        user_id: userId!,
        subnet_id: subnetId,
        blockchain_id: blockchainId,
      },
    },
    create: {
      user_id: userId!,
      subnet_id: subnetId,
      blockchain_id: blockchainId,
      chain_name: body.chainName ?? null,
      rpc_url: body.rpcUrl ?? null,
      upgrade_json: parsed.config as Prisma.InputJsonObject,
      source: 'managed-write',
      status: 'written',
    },
    update: {
      chain_name: body.chainName ?? null,
      rpc_url: body.rpcUrl ?? null,
      upgrade_json: parsed.config as Prisma.InputJsonObject,
      source: 'managed-write',
      status: 'written',
    },
  });

  return jsonOk({ success: true, results, snapshot });
}
