import type { Metadata } from "next";
import { createMetadata } from "@/utils/metadata";
import { AcademyLayout } from "@/components/academy/shared/academy-layout";
import { avalancheDeveloperAcademyLandingPageConfig } from "./config";
import { Suspense } from "react";

export const metadata: Metadata = createMetadata({
  title: "Avalanche L1 Academy",
  description:
    "Learn Avalanche L1 development with courses designed for builders launching custom blockchains",
  openGraph: {
    url: "/academy/avalanche-l1",
    images: {
      url: "/api/og/academy",
      width: 1200,
      height: 630,
      alt: "Avalanche L1 Academy",
    },
  },
  twitter: {
    images: {
      url: "/api/og/academy",
      width: 1200,
      height: 630,
      alt: "Avalanche L1 Academy",
    },
  },
});

export default function AvalancheAcademyPage(): React.ReactElement {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="text-zinc-600 dark:text-zinc-400">Loading...</div></div>}>
      <AcademyLayout config={avalancheDeveloperAcademyLandingPageConfig} />
    </Suspense>
  );
}
