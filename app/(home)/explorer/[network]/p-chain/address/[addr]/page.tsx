import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getExplorerChain, isPchainNetwork, NETWORK_LABEL } from "@/lib/pchain-explorer";
import { createMetadata } from "@/utils/metadata";
import { truncate } from "@/components/explorer-v2/format";
import { PchainAddress } from "@/components/explorer-v2/pchain/PchainAddress";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ network: string; addr: string }>;
}): Promise<Metadata> {
  const { network, addr: rawAddr } = await params;
  const addr = decodeURIComponent(rawAddr);
  const net = isPchainNetwork(network) ? NETWORK_LABEL[network] : network;
  const title = `P-Chain Address ${truncate(addr, 12)} · ${net}`;
  const description = `P-Chain address ${addr} on Avalanche ${net}: balance, stake, UTXOs, and transactions.`;
  // Live data card: the og route reads the balance from the explorer API at scrape time.
  const image = { url: `/api/og/pchain/address/${network}/${encodeURIComponent(addr)}`, width: 1200, height: 630, alt: title };
  return createMetadata({
    title,
    description,
    openGraph: { title, description, url: `/explorer/${network}/p-chain/address/${encodeURIComponent(addr)}`, images: image },
    twitter: { images: image },
  });
}

export default async function AddressPage({
  params,
}: {
  params: Promise<{ network: string; addr: string }>;
}) {
  const { network, addr } = await params;
  const c = getExplorerChain("p-chain");
  if (!c || !c.networks.includes(network)) notFound();
  return <PchainAddress chain={c.slug} network={network} addr={decodeURIComponent(addr)} />;
}
