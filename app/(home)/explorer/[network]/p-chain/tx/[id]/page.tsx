import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getExplorerChain, isPchainNetwork, NETWORK_LABEL } from "@/lib/pchain-explorer";
import { createMetadata } from "@/utils/metadata";
import { truncate } from "@/components/explorer-v2/format";
import { PchainTx } from "@/components/explorer-v2/pchain/PchainTx";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ network: string; id: string }>;
}): Promise<Metadata> {
  const { network, id: rawId } = await params;
  const id = decodeURIComponent(rawId);
  const net = isPchainNetwork(network) ? NETWORK_LABEL[network] : network;
  const title = `P-Chain Transaction ${truncate(id, 10)} · ${net}`;
  const description = `P-Chain transaction ${id} on Avalanche ${net}: type, amount, fee, and UTXOs.`;
  // Live data card: the og route reads the tx from the explorer API at scrape time.
  const image = { url: `/api/og/pchain/tx/${network}/${encodeURIComponent(id)}`, width: 1200, height: 630, alt: title };
  return createMetadata({
    title,
    description,
    openGraph: { title, description, url: `/explorer/${network}/p-chain/tx/${encodeURIComponent(id)}`, images: image },
    twitter: { images: image },
  });
}

export default async function TxPage({
  params,
}: {
  params: Promise<{ network: string; id: string }>;
}) {
  const { network, id } = await params;
  const c = getExplorerChain("p-chain");
  if (!c || !c.networks.includes(network)) notFound();
  return <PchainTx chain={c.slug} network={network} txHash={decodeURIComponent(id)} />;
}
