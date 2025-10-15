import { Metadata } from "next";
import { createMetadata } from "@/utils/metadata";

export const metadata: Metadata = createMetadata({
  title: "Avalanche Mainnet L1 Stats",
  description:
    "Comprehensive overview of Avalanche Mainnet L1 statistics including transaction counts, active addresses, Interchain Messaging (ICM) messaging, and validator metrics across all chains.",
  openGraph: {
    url: "/stats/overview",
    images: {
      alt: "Avalanche Mainnet L1 Stats",
      url: "/api/og/stats?title=Avalanche Mainnet L1 Stats&description=Comprehensive overview of Avalanche Mainnet L1 statistics including transaction counts, active addresses, Interchain Messaging (ICM) messaging, and validator metrics across all chains.",
      width: 1280,
      height: 720,
    },
  },
  twitter: {
    images: {
      alt: "Avalanche Mainnet L1 Stats",
      url: "/api/og/stats?title=Avalanche Mainnet L1 Stats&description=Comprehensive overview of Avalanche Mainnet L1 statistics including transaction counts, active addresses, Interchain Messaging (ICM) messaging, and validator metrics across all chains.",
      width: 1280,
      height: 720,
    },
  },
});

export default function StatsOverviewLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
