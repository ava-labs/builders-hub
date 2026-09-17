import { Metadata } from "next";
import { redirect } from "next/navigation";
import { createMetadata } from "@/utils/metadata";
import { NetworkToken } from "@/components/explorer-v2/network/NetworkToken";

const ogImage = { url: "/api/og/explorer", width: 1200, height: 630, alt: "Avalanche Explorer" };

export const metadata: Metadata = createMetadata({
  title: "AVAX | Avalanche Explorer",
  description:
    "The AVAX token at network scope: supply, staking, fees paid and burned across the P-, C-, and X-Chains, and live block burns.",
  openGraph: {
    title: "AVAX, the Avalanche token",
    description: "Supply, staking, and fee burn across the whole Avalanche network.",
    url: "/explorer/mainnet/token",
    images: ogImage,
  },
  twitter: { images: ogImage },
});

/* AVAX economics span the P-, C-, and X-Chains, so the token lives at the
   network scope (formerly /stats/avax-token, scope-wrong under C-Chain). */
export default async function NetworkTokenPage({
  params,
}: {
  params: Promise<{ network: string }>;
}) {
  const { network } = await params;
  if (network !== "mainnet") redirect("/explorer/mainnet/token");
  return <NetworkToken />;
}
