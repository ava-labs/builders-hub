import { Metadata } from "next";
import { redirect } from "next/navigation";
import { NetworkToken } from "@/components/explorer-v2/network/NetworkToken";

export const metadata: Metadata = {
  title: "AVAX | Avalanche Explorer",
  description:
    "The AVAX token at network scope: supply, staking, fees paid and burned across the P-, C-, and X-Chains, and live block burns.",
  openGraph: {
    title: "AVAX, the Avalanche token",
    description: "Supply, staking, and fee burn across the whole Avalanche network.",
  },
};

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
