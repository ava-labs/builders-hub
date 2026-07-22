import { Metadata } from "next";
import { redirect } from "next/navigation";
import { NetworkValidators } from "@/components/explorer-v2/network/NetworkValidators";

export const metadata: Metadata = {
  title: "Validators | Avalanche Explorer",
  description:
    "Every validator set on Avalanche: stake, node counts, client versions, and health across the Primary Network and every L1.",
  openGraph: {
    title: "Avalanche Validators",
    description: "Stake, node counts, and client versions across every Avalanche validator set.",
  },
};

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
