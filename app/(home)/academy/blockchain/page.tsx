import type { Metadata } from "next";
import { createMetadata } from "@/utils/metadata";
import { AcademyLayout } from "@/components/academy/shared/academy-layout";
import { blockchainAcademyLandingPageConfig } from "./config";
import { Suspense } from "react";

export const metadata: Metadata = createMetadata({
  title: "Blockchain Academy",
  description:
    "Master blockchain fundamentals and smart contract development from the ground up",
  openGraph: {
    url: "/academy/blockchain",
    images: {
      url: "/api/og/academy",
      width: 1200,
      height: 630,
      alt: "Blockchain Academy",
    },
  },
  twitter: {
    images: {
      url: "/api/og/academy",
      width: 1200,
      height: 630,
      alt: "Blockchain Academy",
    },
  },
});

export default function BlockchainAcademyPage(): React.ReactElement {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="text-zinc-600 dark:text-zinc-400">Loading...</div></div>}>
      <AcademyLayout config={blockchainAcademyLandingPageConfig} />
    </Suspense>
  );
}

