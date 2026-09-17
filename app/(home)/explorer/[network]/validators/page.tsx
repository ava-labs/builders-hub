import { Metadata } from "next";
import { redirect } from "next/navigation";
import { createMetadata } from "@/utils/metadata";
import { NetworkValidators } from "@/components/explorer-v2/network/NetworkValidators";

const ogImage = { url: "/api/og/explorer", width: 1200, height: 630, alt: "Avalanche Explorer" };

export const metadata: Metadata = createMetadata({
  title: "Validators | Avalanche Explorer",
  description:
    "Every validator set on Avalanche: stake, node counts, client versions, and health across the Primary Network and every L1.",
  openGraph: {
    title: "Avalanche Validators",
    description: "Stake, node counts, and client versions across every Avalanche validator set.",
    url: "/explorer/mainnet/validators",
    images: ogImage,
  },
  twitter: { images: ogImage },
});

/* The network scope's validator aggregate; per-chain sets live under each
   chain's own Validators tab. Mainnet-only. */
export default async function NetworkValidatorsPage({
  params,
}: {
  params: Promise<{ network: string }>;
}) {
  const { network } = await params;
  if (network !== "mainnet") redirect("/explorer/mainnet/validators");
  return <NetworkValidators />;
}
