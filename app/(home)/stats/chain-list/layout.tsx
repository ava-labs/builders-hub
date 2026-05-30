import { Metadata } from "next";
import { createMetadata } from "@/utils/metadata";

export const metadata: Metadata = createMetadata({
  title: "Avalanche Chain List",
  description:
    "Discover and connect to Avalanche L1 chains. Browse all available networks, add them to your wallet, and explore chain details including RPC URLs, explorers, and native currencies.",
  openGraph: {
    url: "/stats/chain-list",
    images: {
      alt: "Avalanche Chain List",
      url: "/api/og/stats?title=Avalanche Chain List&description=Discover and connect to Avalanche L1 chains",
      width: 1280,
      height: 720,
    },
  },
  twitter: {
    images: {
      alt: "Avalanche Chain List",
      url: "/api/og/stats?title=Avalanche Chain List&description=Discover and connect to Avalanche L1 chains",
      width: 1280,
      height: 720,
    },
  },
});

export default function ChainListLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

