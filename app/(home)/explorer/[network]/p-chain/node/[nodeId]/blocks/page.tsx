import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getExplorerChain, isPchainNetwork, NETWORK_LABEL } from "@/lib/pchain-explorer";
import { createMetadata } from "@/utils/metadata";
import { ExplorerShell } from "@/components/explorer-v2/ExplorerShell";
import { NodeBlocksBody, type ProposedChain } from "@/components/explorer-v2/pchain/node-blocks";

export async function generateMetadata({ params }: { params: Promise<{ network: string; nodeId: string }> }): Promise<Metadata> {
  const { network, nodeId } = await params;
  const id = decodeURIComponent(nodeId);
  const net = isPchainNetwork(network) ? NETWORK_LABEL[network] : network;
  return createMetadata({
    title: `Blocks proposed by ${id} · ${net}`,
    description: `Every C-Chain and P-Chain block validator ${id} proposed on Avalanche ${net}.`,
  });
}

export default async function NodeBlocksPage({
  params,
  searchParams,
}: {
  params: Promise<{ network: string; nodeId: string }>;
  searchParams: Promise<{ chain?: string }>;
}) {
  const { network, nodeId } = await params;
  const { chain } = await searchParams;
  const c = getExplorerChain("p-chain");
  if (!c || !c.networks.includes(network)) notFound();
  const initial: ProposedChain = chain === "p-chain" ? "p-chain" : "c-chain";
  return (
    <ExplorerShell chain={c.slug} network={network}>
      <NodeBlocksBody network={network} nodeId={decodeURIComponent(nodeId)} initial={initial} />
    </ExplorerShell>
  );
}
