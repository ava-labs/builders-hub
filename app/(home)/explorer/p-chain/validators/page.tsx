import { Metadata } from "next";
import PChainValidatorsPage from "@/components/explorer/PChainValidatorsPage";

export const metadata: Metadata = {
  title: "P-Chain Validators | Avalanche Explorer",
  description: "View all validators and delegators on the Avalanche P-Chain Primary Network.",
};

interface PageProps {
  searchParams: Promise<{ network?: string }>;
}

export default async function Page({ searchParams }: PageProps) {
  const params = await searchParams;
  const network = params.network === 'fuji' ? 'fuji' : 'mainnet';
  
  return <PChainValidatorsPage initialNetwork={network} />;
}

