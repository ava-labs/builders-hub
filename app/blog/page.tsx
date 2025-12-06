import { blog } from "@/lib/source";
import { HeroBackground } from "@/components/landing/hero";
import { createMetadata } from "@/utils/metadata";
import { BlogList } from "@/components/blog/blog-list";
import type { Metadata } from "next";

export const metadata: Metadata = createMetadata({
  title: "Blog",
  description:
    "Takeaways and tutorials from building a network of fast, efficient, highly-optimized chains.",
  openGraph: {
    images: "/api/og/blog",
  },
  twitter: {
    images: "/api/og/blog",
  },
});

export default function Page(): React.ReactElement {
  const blogPages = [...blog.getPages()].sort(
    (a, b) =>
      new Date((b.data.date as string) ?? b.url).getTime() -
      new Date((a.data.date as string) ?? a.url).getTime()
  );

  const blogs = blogPages.map((page) => ({
    url: page.url,
    data: {
      title: page.data.title || "Untitled",
      description: page.data.description || "",
      topics: (page.data.topics as string[]) || [],
      date:
        page.data.date instanceof Date
          ? page.data.date.toISOString()
          : (page.data.date as string) || page.url,
      authors: (page.data.authors as string[]) || [],
    },
    file: {
      name: page.url,
    },
  }));

  return (
    <>
      <HeroBackground />
      <main className="relative py-12 sm:py-16">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          {/* Blog List with Search */}
          <BlogList blogs={blogs} />
        </div>
      </main>
    </>
  );
}
