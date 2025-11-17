import type { Metadata } from "next";
import { createMetadata } from "@/utils/metadata";
import { blog } from "@/lib/source";
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
  // Get all guides server-side
  const blogPages = [...blog.getPages()]
    .sort(
      (a, b) =>
        new Date((b.data.date as string) ?? b.url).getTime() -
        new Date((a.data.date as string) ?? a.url).getTime()
    )
    .slice(0, 9); // Limit to 9 guides

  // Serialize blog data to pass to client component
  const blogs = blogPages.map((page) => ({
    url: page.url,
    data: {
      title: page.data.title || "Untitled",
      description: page.data.description || "",
      topics: (page.data.topics as string[]) || [],
      date:
        page.data.date instanceof Date
          ? page.data.date.toISOString()
          : (page.data.date as string) || "",
    },
    file: {
      name: page.url, // Use URL instead of file.name in v16
    },
  }));

  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="text-zinc-600 dark:text-zinc-400">Loading...</div></div>}>
      <AcademyLayout
        config={blockchainAcademyLandingPageConfig}
        blogs={blogs}
        blogsByPath={{
          avalanche: blogs,
          blockchain: blogs,
          entrepreneur: blogs,
        }}
      />
    </Suspense>
  );
}

