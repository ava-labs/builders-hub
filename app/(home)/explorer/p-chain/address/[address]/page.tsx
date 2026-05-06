import { Metadata } from "next";
import PChainAddressDetailPage from "@/components/explorer/PChainAddressDetailPage";

interface PageProps {
  params: Promise<{ address: string }>;
  searchParams: Promise<{ network?: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { address } = await params;
  const shortAddress = address.length > 20 ? `${address.slice(0, 12)}...${address.slice(-8)}` : address;
  
  return {
    title: `P-Chain Address ${shortAddress} | Avalanche Explorer`,
    description: `View balance, staking activity, and UTXOs for P-Chain address ${address} on Avalanche.`,
  };
}

export default async function Page({ params, searchParams }: PageProps) {
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;
  
  const { address } = resolvedParams;
  const network = resolvedSearchParams.network === 'fuji' ? 'fuji' : 'mainnet';
  
  return <PChainAddressDetailPage address={address} network={network} />;
}

