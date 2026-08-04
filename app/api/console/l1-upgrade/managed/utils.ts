import { prisma } from '@/prisma/prisma';

export async function getActiveManagedUpgradeNodes(params: {
  userId: string;
  subnetId: string;
  blockchainId: string;
}) {
  return prisma.nodeRegistration.findMany({
    where: {
      user_id: params.userId,
      subnet_id: params.subnetId,
      blockchain_id: params.blockchainId,
      status: 'active',
      expires_at: { gt: new Date() },
      node_index: { not: null },
    },
    orderBy: { created_at: 'desc' },
  });
}
