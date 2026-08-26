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
  const title = `P-Chain Validator · ${net}`;
  const description = `Live validator health for ${id} on Avalanche ${net}: uptime, stake, and connection status.`;
  const image = {
    url: `/api/og/validator/${network}/${encodeURIComponent(id)}`,
    width: 1200,
    height: 630,
    alt: `Validator ${id} health`,
  };
  return createMetadata({
    title,
    description,
    openGraph: {
      title,
      description,
      url: `/explorer/${network}/p-chain/node/${encodeURIComponent(id)}`,
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
  const c = getExplorerChain("p-chain");
  if (!c || !c.networks.includes(network)) notFound();
  return (
    <PchainNode
      chain={c.slug}
      network={network}
      nodeId={decodeURIComponent(nodeId)}
      subnetHint={subnet}
    />
  );
}
