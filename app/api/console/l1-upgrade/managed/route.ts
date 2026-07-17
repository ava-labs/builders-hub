import { NextRequest, NextResponse } from 'next/server';
import { getUserId, jsonError, jsonOk } from '@/app/api/managed-testnet-nodes/utils';
import { builderHubGetUpgradeJson, builderHubWriteUpgradeJson } from '@/app/api/managed-testnet-nodes/service';
import { isValidAvalancheId } from '@/lib/console/l1-upgrade-selection';
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
  if (!isValidAvalancheId(subnetId) || !isValidAvalancheId(blockchainId)) {
    return jsonError(400, 'subnetId and blockchainId must be valid Avalanche CB58 IDs');
  }

  const nodes = await getActiveManagedUpgradeNodes({ userId: userId!, subnetId, blockchainId });
  if (nodes.length === 0) {
    return jsonOk({ managed: false, nodes: [], upgradeJson: null, exists: false });
  }

  const nodeSummaries = nodes.map((node) => ({ id: node.id, nodeIndex: node.node_index, nodeId: node.node_id }));

  // mode=detect answers "is this L1 managed?" from the registration table
  // alone, skipping the node-service round-trip the select step doesn't need.
  if (new URL(request.url).searchParams.get('mode') === 'detect') {
    return jsonOk({ managed: true, nodes: nodeSummaries, upgradeJson: null, exists: false });
  }

  try {
    const result = await builderHubGetUpgradeJson({
      subnetId,
      blockchainId,
      nodeIndex: nodes[0].node_index!,
    });
    return jsonOk({
      managed: true,
      nodes: nodeSummaries,
      ...result,
    });
  } catch (error) {
    // The L1 is still managed even when reading the current upgrade.json
    // fails — report the service error instead of collapsing detection
    // into a 5xx that the UI would misread as "not managed".
    const message = error instanceof Error ? error.message : 'Failed to fetch managed upgrade.json';
    return jsonOk({
      managed: true,
      nodes: nodeSummaries,
      upgradeJson: null,
      exists: false,
      serviceError: message,
    });
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
  if (!isValidAvalancheId(subnetId) || !isValidAvalancheId(blockchainId)) {
    return jsonError(400, 'subnetId and blockchainId must be valid Avalanche CB58 IDs');
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

  return jsonOk({ success: true, results });
}
