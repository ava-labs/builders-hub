import { Metadata } from "next";
import { createMetadata } from "@/utils/metadata";

export const metadata: Metadata = createMetadata({
  title: "Subnet Validator Monitor",
  description:
    "Real-time validator version tracking across Avalanche subnets. Monitor validator health, stake percentages, and client version distribution for Mainnet and Fuji networks.",
  openGraph: {
    url: "/stats/validators",
    images: {
      alt: "Subnet Validator Monitor",
      url: "/api/og/stats?title=Subnet Validator Monitor&description=Real-time validator version tracking across Avalanche subnets. Monitor validator health, stake percentages, and client version distribution.",
      width: 1280,
      height: 720,
    },
  },
  twitter: {
    images: {
      alt: "Subnet Validator Monitor",
      url: "/api/og/stats?title=Subnet Validator Monitor&description=Real-time validator version tracking across Avalanche subnets. Monitor validator health, stake percentages, and client version distribution.",
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

