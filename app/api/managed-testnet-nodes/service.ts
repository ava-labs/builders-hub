import { prisma } from '@/prisma/prisma';
import { builderHubUrls } from './constants';
import { SubnetStatusResponse, NodeInfo } from './types';
import { toDateFromEpoch, NODE_TTL_MS } from './utils';

export async function builderHubAddNode(subnetId: string): Promise<SubnetStatusResponse> {
  const password = process.env.MANAGED_TESTNET_NODE_SERVICE_PASSWORD;
  if (!password) throw new Error('MANAGED_TESTNET_NODE_SERVICE_PASSWORD not configured');

  const url = builderHubUrls.addNode(subnetId, password);
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({})
  });

  const rawText = await response.text();
  let data: SubnetStatusResponse;
  try {
    data = JSON.parse(rawText);
  } catch {
    throw new Error(`Invalid response from Builder Hub: ${rawText.substring(0, 100)}...`);
  }
  if (!response.ok) {
    const message = (data as any).error || (data as any).message || `Builder Hub error ${response.status}`;
    throw new Error(message);
  }
  if ((data as any).error) {
    throw new Error((data as any).error || 'Builder Hub registration failed');
  }
  return data;
}

export function selectNewestNode(nodes: NodeInfo[]): NodeInfo {
  return nodes.reduce((latest, current) => current.nodeIndex > latest.nodeIndex ? current : latest);
}

export async function createDbNode(params: {
  userId: string;
  subnetId: string;
  blockchainId: string;
  newestNode: NodeInfo;
  chainName: string | null;
}) {
  const { userId, subnetId, blockchainId, newestNode, chainName } = params;

  const existingNode = await (prisma as any).nodeRegistration.findFirst({
    where: { user_id: userId, subnet_id: subnetId, node_index: newestNode.nodeIndex }
  });
  // If an inactive record exists for this index, revive/update it instead of conflicting
  if (existingNode && existingNode.status !== 'active') {
    const enforcedExpiry = new Date(Date.now() + NODE_TTL_MS);
    await (prisma as any).nodeRegistration.updateMany({
      where: { user_id: userId, subnet_id: subnetId, node_index: newestNode.nodeIndex },
      data: {
        blockchain_id: blockchainId,
        node_id: newestNode.nodeInfo.result.nodeID,
        public_key: newestNode.nodeInfo.result.nodePOP.publicKey,
        proof_of_possession: newestNode.nodeInfo.result.nodePOP.proofOfPossession,
        rpc_url: builderHubUrls.rpcEndpoint(blockchainId),
        chain_name: chainName,
        expires_at: enforcedExpiry,
        created_at: toDateFromEpoch(newestNode.dateCreated),
        status: 'active'
      }
    });
    const revived = await (prisma as any).nodeRegistration.findFirst({
      where: { user_id: userId, subnet_id: subnetId, node_index: newestNode.nodeIndex, status: 'active' }
    });
    return revived;
  }
  if (existingNode) return null;

  const enforcedExpiry = new Date(Date.now() + NODE_TTL_MS);

  const createdNode = await (prisma as any).nodeRegistration.create({
    data: {
      user_id: userId,
      subnet_id: subnetId,
      blockchain_id: blockchainId,
      node_id: newestNode.nodeInfo.result.nodeID,
      node_index: newestNode.nodeIndex,
      public_key: newestNode.nodeInfo.result.nodePOP.publicKey,
      proof_of_possession: newestNode.nodeInfo.result.nodePOP.proofOfPossession,
      rpc_url: builderHubUrls.rpcEndpoint(blockchainId),
      chain_name: chainName,
      expires_at: enforcedExpiry,
      created_at: toDateFromEpoch(newestNode.dateCreated),
      status: 'active'
    }
  });

  return createdNode;
}

export async function getUserNodes(userId: string) {
  const nodes = await (prisma as any).nodeRegistration.findMany({
    where: { user_id: userId, status: 'active' },
    orderBy: { created_at: 'desc' }
  });
  return nodes;
}


