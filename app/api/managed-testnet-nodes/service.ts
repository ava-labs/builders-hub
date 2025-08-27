import { prisma } from '@/prisma/prisma';
import { ManagedTestnetNodesServiceURLs } from './constants';
import { SubnetStatusResponse, NodeInfo, SubnetStatusResponseSchema, ServiceErrorSchema } from './types';
import { toDateFromEpoch, NODE_TTL_MS } from './utils';

export async function builderHubAddNode(subnetId: string): Promise<SubnetStatusResponse> {
  const password = process.env.MANAGED_TESTNET_NODE_SERVICE_PASSWORD;
  if (!password) throw new Error('MANAGED_TESTNET_NODE_SERVICE_PASSWORD not configured');

  const url = ManagedTestnetNodesServiceURLs.addNode(subnetId, password);
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({}) // we need an empty body to satisfy the POST request
  });

  let json: JSON;
  try {
    json = await response.json();
  } catch {
    throw new Error('Invalid JSON response from Managed Testnet Node Service');
  }

  if (!response.ok) {
    const parsedErr = ServiceErrorSchema.safeParse(json);
    const message = parsedErr.success
      ? (parsedErr.data.error || parsedErr.data.message || `Managed Testnet Node Service error ${response.status}`)
      : `Managed Testnet Node Service error ${response.status}`;
    throw new Error(message);
  }

  const parsed = SubnetStatusResponseSchema.safeParse(json);
  if (!parsed.success) {
    throw new Error('Invalid response shape from Managed Testnet Node Service');
  }
  const data = parsed.data;
  if (data.error) {
    throw new Error(data.error || 'Managed Testnet Node Service registration failed');
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

  const existingNode = await prisma.nodeRegistration.findFirst({
    where: { user_id: userId, subnet_id: subnetId, node_index: newestNode.nodeIndex }
  });
  // If an inactive record exists for this index, revive/update it instead of conflicting
  if (existingNode && existingNode.status !== 'active') {
    const enforcedExpiry = new Date(Date.now() + NODE_TTL_MS);
    await prisma.nodeRegistration.updateMany({
      where: { user_id: userId, subnet_id: subnetId, node_index: newestNode.nodeIndex },
      data: {
        blockchain_id: blockchainId,
        node_id: newestNode.nodeInfo.result.nodeID,
        public_key: newestNode.nodeInfo.result.nodePOP.publicKey,
        proof_of_possession: newestNode.nodeInfo.result.nodePOP.proofOfPossession,
        rpc_url: ManagedTestnetNodesServiceURLs.rpcEndpoint(blockchainId),
        chain_name: chainName,
        expires_at: enforcedExpiry,
        created_at: toDateFromEpoch(newestNode.dateCreated),
        status: 'active'
      }
    });
    const revived = await prisma.nodeRegistration.findFirst({
      where: { user_id: userId, subnet_id: subnetId, node_index: newestNode.nodeIndex, status: 'active' }
    });
    return revived;
  }
  if (existingNode) return null;

  const enforcedExpiry = new Date(Date.now() + NODE_TTL_MS);

  const createdNode = await prisma.nodeRegistration.create({
    data: {
      user_id: userId,
      subnet_id: subnetId,
      blockchain_id: blockchainId,
      node_id: newestNode.nodeInfo.result.nodeID,
      node_index: newestNode.nodeIndex,
      public_key: newestNode.nodeInfo.result.nodePOP.publicKey,
      proof_of_possession: newestNode.nodeInfo.result.nodePOP.proofOfPossession,
      rpc_url: ManagedTestnetNodesServiceURLs.rpcEndpoint(blockchainId),
      chain_name: chainName,
      expires_at: enforcedExpiry,
      created_at: toDateFromEpoch(newestNode.dateCreated),
      status: 'active'
    }
  });

  return createdNode;
}

export async function getUserNodes(userId: string) {
  const nodes = await prisma.nodeRegistration.findMany({
    where: { user_id: userId, status: 'active' },
    orderBy: { created_at: 'desc' }
  });
  return nodes;
}


