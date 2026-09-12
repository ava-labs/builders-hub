import { Metadata } from "next";
import l1ChainsData from "@/constants/l1-chains.json";
import { L1Chain } from "@/types/stats";
import { VerifyContractPageClient } from "./page.client";

interface VerifyPageProps {
  params: Promise<{ network: string; chain: string; address: string }>;
}

export async function generateMetadata({ params }: VerifyPageProps): Promise<Metadata> {
  const { chain: chainSlug, address } = await params;
  const chain = l1ChainsData.find((c) => c.slug === chainSlug) as L1Chain | undefined;
  const shortAddress = `${address.slice(0, 10)}...${address.slice(-8)}`;

  return {
    title: chain
      ? `Verify ${shortAddress} | ${chain.chainName} Explorer`
      : `Verify ${shortAddress} | Explorer`,
    description:
      "Publish a contract's source code by proving it compiles to the bytecode deployed on chain.",
  };
}

export default async function VerifyContractPage({ params }: VerifyPageProps) {
  const { network, address } = await params;
  return <VerifyContractPageClient network={network} address={address} />;
}
