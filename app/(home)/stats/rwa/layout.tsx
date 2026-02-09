import { Metadata } from "next";
import { createMetadata } from "@/utils/metadata";

export const metadata: Metadata = createMetadata({
  title: "Avalanche RWA Dashboard",
  description:
    "Track real world asset (RWA) capital flows on Avalanche C-Chain. Valinor / OatFi SPV dashboard with live metrics and analytics.",
  openGraph: {
    url: "/stats/rwa",
    images: {
      alt: "Avalanche RWA Dashboard",
      url: "/api/og/stats?title=Avalanche RWA Dashboard&description=Track real world asset capital flows on Avalanche C-Chain.",
      width: 1280,
      height: 720,
    },
  },
  twitter: {
    images: {
      alt: "Avalanche RWA Dashboard",
      url: "/api/og/stats?title=Avalanche RWA Dashboard&description=Track real world asset capital flows on Avalanche C-Chain.",
      width: 1280,
      height: 720,
    },
  },
});

export default function RWAStatsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
