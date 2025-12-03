import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, ArrowRight, ExternalLink } from "lucide-react";
import { createMetadata } from "@/utils/metadata";
import { blog } from "@/lib/source";
import { AcademyLayout } from "@/components/academy/shared/academy-layout";
import { avalancheDeveloperAcademyLandingPageConfig } from "./config";
import { entrepreneurAcademyLandingPageConfig } from "../entrepreneur/config";
import type { AcademyPathType } from "@/components/academy/shared/academy-types";
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

type PageProps = {
  searchParams: Promise<{
    path?: string;
  }>;
};

const isPathType = (value: string | undefined): value is AcademyPathType => {
  return value === "avalanche" || value === "blockchain" || value === "entrepreneur";
};

export default async function AvalancheAcademyPage({ searchParams }: PageProps): Promise<React.ReactElement> {
  const resolvedSearchParams = await searchParams;
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

  const { features } = entrepreneurAcademyLandingPageConfig;

  const entrepreneurBlogsFromConfig = (features?.highlights?.blogs ?? []).map((blogEntry) => ({
    url: blogEntry.link,
    data: {
      title: blogEntry.title,
      description: blogEntry.description,
      topics: ['Entrepreneur'],
      date: blogEntry.date || '',
    },
    file: {
      name: blogEntry.id,
    },
  }));

  const entrepreneurHighlights = features?.highlights ? (
    <div className="mb-16">
      <div className="flex items-center gap-3 mb-8">
        <BookOpen className="h-6 w-6 text-red-600" />
        <h2 className="text-2xl	font-bold text-zinc-900 dark:text-white">
          {features.highlights.title}
        </h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {features.highlights.blogs.map((blog) => (
          <Link
            key={blog.id}
            href={blog.link}
            target="_blank"
            rel="noopener noreferrer"
            className="group relative flex flex-col rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 hover:shadow-lg transition-all duration-200 cursor-pointer"
          >
            <div className="flex items-start justify-between mb-4">
              <h3 className="font-semibold text-lg text-zinc-900 dark:text-white group-hover:text-red-600 dark:group-hover:text-red-500 transition-colors pr-4">
                {blog.title}
              </h3>
              <ExternalLink className="h-5 w-5 text-zinc-400 group-hover:text-red-600 transition-colors flex-shrink-0" />
            </div>

            {blog.date && (
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-3">
                {blog.date}
              </p>
            )}

            <p className="text-sm text-zinc-600 dark:text-zinc-400 flex-grow">
              {blog.description}
            </p>

            <div className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-red-600 group-hover:text-red-700 dark:text-red-500 dark:hover:text-red-400">
              Read article
              <ArrowRight className="h-4 w-4" />
            </div>
          </Link>
        ))}
      </div>
    </div>
  ) : null;

  const initialPathType = isPathType(resolvedSearchParams?.path) ? resolvedSearchParams?.path : undefined;

  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="text-zinc-600 dark:text-zinc-400">Loading...</div></div>}>
      <AcademyLayout
        config={avalancheDeveloperAcademyLandingPageConfig}
        blogs={blogs}
        blogsByPath={{
          avalanche: blogs,
          blockchain: blogs,
          entrepreneur: entrepreneurBlogsFromConfig.length > 0 ? entrepreneurBlogsFromConfig : blogs,
        }}
        afterLearningPathByPath={{
          entrepreneur: entrepreneurHighlights,
        }}
        initialPathType={initialPathType}
      />
    </Suspense>
  );
}
