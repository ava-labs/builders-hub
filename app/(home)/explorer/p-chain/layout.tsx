import { ReactNode } from "react";
import { Metadata } from "next";
import { PChainExplorerLayoutClient } from "./layout.client";

export const metadata: Metadata = {
  title: "P-Chain Explorer | Avalanche",
  description: "Explore the Avalanche Primary Network Platform Chain (P-Chain) - view blocks, transactions, validators, and staking activity.",
};

interface PChainExplorerLayoutProps {
  children: ReactNode;
  params: Promise<Record<string, string>>;
}

export default async function PChainExplorerLayout({ 
  children,
}: PChainExplorerLayoutProps) {
  return (
    <PChainExplorerLayoutClient>
      {children}
    </PChainExplorerLayoutClient>
  );
}
