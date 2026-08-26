import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getExplorerChain, isPchainNetwork, NETWORK_LABEL } from "@/lib/pchain-explorer";
import { createMetadata } from "@/utils/metadata";
import { PchainNode } from "@/components/explorer-v2/pchain/PchainNode";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ network: string; nodeId: string }>;
}): Promise<Metadata> {
  const { network, nodeId } = await params;
  const id = decodeURIComponent(nodeId);
  const net = isPchainNetwork(network) ? NETWORK_LABEL[network] : network;
  const title = `X-Chain Node · ${net}`;
  const description = `Node ${id} on the Avalanche X-Chain (${net}).`;
  const image = { url: "/api/og/explorer", width: 1200, height: 630, alt: "Avalanche Explorer" };
  return createMetadata({
    title,
    description,
    openGraph: {
      title,
      description,
      url: `/explorer/${network}/x-chain/node/${encodeURIComponent(id)}`,
      images: image,
    },
    twitter: { images: image },
  });
}

export default async function NodePage({
  params,
  searchParams,
}: {
  params: Promise<{ network: string; nodeId: string }>;
  searchParams: Promise<{ subnet?: string }>;
}) {
  const { network, nodeId } = await params;
  const { subnet } = await searchParams;
  const c = getExplorerChain("x-chain");
  if (!c || !c.networks.includes(network)) notFound();
  return (
    <PchainNode
      chain="x-chain"
      network={network}
      nodeId={decodeURIComponent(nodeId)}
      subnetHint={subnet}
    />
  );
}
