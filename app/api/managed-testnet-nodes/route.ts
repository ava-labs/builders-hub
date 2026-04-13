import type { NextRequest } from 'next/server';
import { withApi } from '@/lib/api/with-api';
import { successResponse } from '@/lib/api/response';
import { BadRequestError, ConflictError, InternalError, ValidationError } from '@/lib/api/errors';
import { builderHubAddNode, selectNewestNode, createDbNode, getUserNodes } from './service';
import { getBlockchainInfo } from '@/components/toolbox/coreViem/utils/glacier';
import type { CreateNodeRequest } from './types';
import { prisma } from '@/prisma/prisma';
import { SUBNET_EVM_VM_ID } from '@/constants/console';
import { checkAndAwardConsoleBadges } from '@/server/services/consoleBadge/consoleBadgeService';
import type { AwardedConsoleBadge } from '@/server/services/consoleBadge/types';
import { validateSubnetId } from './utils';

export const GET = withApi(
  async (_req: NextRequest, { session }) => {
    const userId = session.user.id;
    const nodes = await getUserNodes(userId);
    return successResponse({ nodes, total: nodes.length });
  },
  { auth: true },
);

// schema: not applicable — body validated inline with field-level checks
export const POST = withApi(
  async (req: NextRequest, { session }) => {
    const userId = session.user.id;

    // Enforce max 3 active nodes per user
    const activeNodes = await getUserNodes(userId);
    if (activeNodes.length >= 3) {
      throw new BadRequestError('You already have 3 active nodes. Delete one or wait for expiry.');
    }

    const body: CreateNodeRequest = await req.json();
    const { subnetId, blockchainId } = body;

    if (!subnetId || !blockchainId) {
      throw new ValidationError('Both subnetId and blockchainId are required');
    }

    if (!validateSubnetId(subnetId)) {
      throw new ValidationError('Invalid subnet ID format');
    }

    // Fetch chain information and enforce Subnet EVM VM check
    const blockchainInfo = await getBlockchainInfo(blockchainId);
    const chainName: string | null = blockchainInfo.blockchainName || null;
    if (blockchainInfo.vmId !== SUBNET_EVM_VM_ID) {
      throw new BadRequestError(
        `Unsupported VM for this service. Expected Subnet EVM (vmID ${SUBNET_EVM_VM_ID}), got ${blockchainInfo.vmId}.`,
      );
    }

    // Make the request to Builder Hub API to add node
    const data = await builderHubAddNode(subnetId);

    // Store the new node in database
    if (!data.nodes || data.nodes.length === 0) {
      throw new InternalError('No nodes returned from Builder Hub');
    }

    const newestNode = selectNewestNode(data.nodes);
    const createdNode = await createDbNode({ userId, subnetId, blockchainId, newestNode, chainName });
    if (!createdNode) {
      throw new ConflictError('Node already exists for this user (active)');
    }

    let awardedBadges: AwardedConsoleBadge[] = [];
    try {
      awardedBadges = await checkAndAwardConsoleBadges(userId, 'node_registration');
    } catch {
      // Badge check is non-critical
    }

    return successResponse(
      {
        node: createdNode,
        builder_hub_response: {
          nodeID: newestNode.nodeInfo.result.nodeID,
          nodePOP: newestNode.nodeInfo.result.nodePOP,
          nodeIndex: newestNode.nodeIndex,
        },
        awardedBadges,
      },
      201,
    );
  },
  { auth: true },
);

export const DELETE = withApi(
  async (req: NextRequest, { session }) => {
    const userId = session.user.id;
    const id = req.nextUrl.searchParams.get('id');
    if (!id) {
      throw new ValidationError('Missing node id');
    }

    const record = await prisma.nodeRegistration.findFirst({ where: { id, user_id: userId } });
    if (!record) {
      throw new BadRequestError('Node not found');
    }

    await prisma.nodeRegistration.update({ where: { id }, data: { status: 'terminated' } });
    return successResponse({ success: true, message: 'Node removed from your account.' });
  },
  { auth: true },
);
