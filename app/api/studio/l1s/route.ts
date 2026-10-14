import l1ChainsData from "@/constants/l1-chains.json";
import { toCb58Id } from "@/lib/studio/l1";
import { prisma } from "@/prisma/prisma";
import { QUICK_L1_UNAVAILABLE, quickL1Available } from "@/server/services/studio/quick-l1";
import { studioRoute } from "../_lib/route";

export const runtime = "nodejs";

interface CatalogChain {
  chainId: string;
  chainName?: string;
  blockchainId?: string;
  rpcUrl?: string;
  isTestnet?: boolean;
}

/** What Studio can vouch for when a builder picks an L1: their managed nodes and the L1 registry. */
export const GET = studioRoute(async ({ userId }) => {
  const nodes = await prisma.nodeRegistration.findMany({
    where: { user_id: userId, status: "active" },
    orderBy: { created_at: "desc" },
    select: { id: true, chain_name: true, blockchain_id: true, subnet_id: true, expires_at: true },
  });
  const registry = (l1ChainsData as CatalogChain[])
    .filter((c) => Number.isInteger(Number(c.chainId)) && Number(c.chainId) > 0 && c.rpcUrl)
    .map((c) => ({
      evmChainId: Number(c.chainId),
      name: c.chainName ?? `Chain ${c.chainId}`,
      blockchainId: c.blockchainId ? toCb58Id(c.blockchainId) : null,
      testnet: !!c.isTestnet,
    }));
  return {
    nodes: nodes.map((n) => ({ id: n.id, chainName: n.chain_name, blockchainId: n.blockchain_id, subnetId: n.subnet_id, expiresAt: n.expires_at })),
    registry,
    quickL1: quickL1Available() ? { available: true } : { available: false, reason: QUICK_L1_UNAVAILABLE },
  };
});
