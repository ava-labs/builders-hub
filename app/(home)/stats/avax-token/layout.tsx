import type { Metadata } from "next";
import { createMetadata } from "@/utils/metadata";

export const metadata: Metadata = createMetadata({
  title: "AVAX Token Stats",
  description:
    "Track AVAX token supply, staking, and burn metrics including total supply, circulating supply and fees burned across all chains.",
  openGraph: {
    url: "/stats/avax-token",
    images: {
      alt: "AVAX Token Stats",
      url: "/api/og/stats/c-chain?title=AVAX Token Stats&description=Track AVAX token supply, staking, and burn metrics",
      width: 1280,
      height: 720,
    },
  },
  twitter: {
    images: {
      alt: "AVAX Token Stats",
      url: "/api/og/stats/c-chain?title=AVAX Token Stats&description=Track AVAX token supply, staking, and burn metrics",
      width: 1280,
      height: 720,
    },
  },
});

export default function AvaxTokenLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
