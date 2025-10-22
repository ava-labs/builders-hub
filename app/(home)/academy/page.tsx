import type { Metadata } from "next";
import { createMetadata } from "@/utils/metadata";
import { blog } from "@/lib/source";
import { AcademyLayout } from "@/components/academy/shared/academy-layout";
import { avalancheDeveloperAcademyLandingPageConfig } from "@/app/(home)/academy/avalanche-developer.config";

export const metadata: Metadata = createMetadata({
  title: "Academy",
  description:
    "Learn blockchain development with courses designed for the Avalanche ecosystem",
  openGraph: {
    url: "/academy",
    images: {
      url: "/api/og/academy",
      width: 1200,
      height: 630,
      alt: "Avalanche Academy",
    },
  },
  twitter: {
    images: {
      url: "/api/og/academy",
      width: 1200,
      height: 630,
      alt: "Avalanche Academy",
    },
  },
});

export default function AcademyPage(): React.ReactElement {
  // Get all guides server-side
  const blogPages = [...blog.getPages()]
    .sort(
      (a, b) =>
        new Date((b.data.date as string) ?? b.file.name).getTime() -
        new Date((a.data.date as string) ?? a.file.name).getTime()
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
      name: page.file.name,
    },
  }));

  return (
    <AcademyLayout
      config={avalancheDeveloperAcademyLandingPageConfig}
      blogs={blogs}
    />
  );
}
