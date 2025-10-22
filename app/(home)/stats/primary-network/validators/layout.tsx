import { Metadata } from "next";
import { createMetadata } from "@/utils/metadata";

export const metadata: Metadata = createMetadata({
  title: "Primary Network Validator Metrics",
  description:
    "Metrics for Avalanche Primary Network validators including validator count, weight, delegator statistics, geographic distribution, and version analytics.",
  openGraph: {
    url: "/stats/primary-network/validators",
    images: {
      alt: "Primary Network Validator Metrics",
      url: "/api/og/stats?title=Primary Network Validator Metrics&description=Metrics for Avalanche Primary Network validators including validator count, weight, delegator statistics, geographic distribution, and version analytics.",
      width: 1280,
      height: 720,
    },
  },
  twitter: {
    images: {
      alt: "Primary Network Validator Metrics",
      url: "/api/og/stats?title=Primary Network Validator Metrics&description=Metrics for Avalanche Primary Network validators including validator count, weight, delegator statistics, geographic distribution, and version analytics.",
      width: 1280,
      height: 720,
    },
  },
});

export default function ValidatorsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
