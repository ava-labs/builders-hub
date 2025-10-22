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
      new Date((b.data.date as string) ?? b.file.name).getTime() -
      new Date((a.data.date as string) ?? a.file.name).getTime()
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
          : (page.data.date as string) || page.file.name,
      authors: (page.data.authors as string[]) || [],
    },
    file: {
      name: page.file.name,
    },
  }));

  return (
    <>
      <HeroBackground />
      <main className="py-12 sm:py-20">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          {/* Header */}
          <section className="mx-auto w-full lg:mx-0 text-center">
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tighter">
              <span className="bg-gradient-to-r from-slate-900 via-slate-700 to-slate-900 bg-clip-text text-transparent dark:from-white dark:via-slate-200 dark:to-white">
                Avalanche Builder Blog
              </span>
            </h1>
            <p className="mt-6 text-base sm:text-lg leading-7 text-muted-foreground">
              Takeaways and tutorials from building a network of fast,
              efficient, highly-optimized chains.
            </p>
          </section>

          {/* Blog List with Search */}
          <BlogList blogs={blogs} />
        </div>
      </main>
    </>
  );
}
