import { Metadata } from "next";
import { createMetadata } from "@/utils/metadata";

export const metadata: Metadata = createMetadata({
  title: "Validator Stats",
  description:
    "Real-time validator version tracking across Avalanche chains. Monitor validator health, stake percentages, and client version distribution for Mainnet and Fuji networks.",
  openGraph: {
    url: "/stats/validators",
    images: {
      alt: "Validator Stats",
      url: "/api/og/stats?title=Validator Stats&description=Real-time validator version tracking across Avalanche chains. Monitor validator health, stake percentages, and client version distribution.",
      width: 1280,
      height: 720,
    },
  },
  twitter: {
    images: {
      alt: "Validator Stats",
      url: "/api/og/stats?title=Validator Stats&description=Real-time validator version tracking across Avalanche chains. Monitor validator health, stake percentages, and client version distribution.",
      width: 1280,
      height: 720,
    },
  },
});

export default function ValidatorStatsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

