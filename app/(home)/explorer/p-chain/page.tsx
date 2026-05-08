import { Metadata } from "next";
import { Suspense } from "react";
import PChainExplorerPage from "@/components/explorer/PChainExplorerPage";

export const metadata: Metadata = {
  title: "P-Chain Explorer | Avalanche",
  description: "Explore the Avalanche P-Chain - view blocks, transactions, validators, staking, and subnet activity on the Platform Chain.",
};

interface PageProps {
  searchParams: Promise<{ network?: string }>;
}

export default async function Page({ searchParams }: PageProps) {
  const params = await searchParams;
  const network = params.network === 'fuji' ? 'fuji' : 'mainnet';
  
  return (
    <Suspense fallback={null}>
      <PChainExplorerPage initialNetwork={network} />
    </Suspense>
  );
}

