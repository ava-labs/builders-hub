import { Metadata } from "next";
import PChainTransactionDetailPage from "@/components/explorer/PChainTransactionDetailPage";

interface PageProps {
  params: Promise<{ txId: string }>;
  searchParams: Promise<{ network?: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { txId } = await params;
  const shortTxId = txId.length > 16 ? `${txId.slice(0, 8)}...${txId.slice(-8)}` : txId;
  
  return {
    title: `P-Chain Transaction ${shortTxId} | Avalanche Explorer`,
    description: `View details for P-Chain transaction ${txId} on Avalanche.`,
  };
}

export default async function Page({ params, searchParams }: PageProps) {
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;
  
  const { txId } = resolvedParams;
  const network = resolvedSearchParams.network === 'fuji' ? 'fuji' : 'mainnet';
  
  return <PChainTransactionDetailPage txId={txId} network={network} />;
}

