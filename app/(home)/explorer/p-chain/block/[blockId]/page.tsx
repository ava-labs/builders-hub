import { Metadata } from "next";
import PChainBlockDetailPage from "@/components/explorer/PChainBlockDetailPage";

interface PageProps {
  params: Promise<{ blockId: string }>;
  searchParams: Promise<{ network?: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { blockId } = await params;
  
  return {
    title: `P-Chain Block ${blockId} | Avalanche Explorer`,
    description: `View details for P-Chain block ${blockId} on Avalanche.`,
  };
}

export default async function Page({ params, searchParams }: PageProps) {
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;
  
  const { blockId } = resolvedParams;
  const network = resolvedSearchParams.network === 'fuji' ? 'fuji' : 'mainnet';
  
  return <PChainBlockDetailPage blockId={blockId} network={network} />;
}

