'use client';
import { useState, useCallback } from 'react';
import Link from 'next/link';
import { ArrowRight, X } from 'lucide-react';
import { BlogSearch } from './blog-search';

interface BlogPost {
  url: string;
  data: {
    title: string;
    description: string;
    topics: string[];
    date: string;
    authors: string[];
  };
  file: {
    name: string;
  };
}

interface BlogListProps {
  blogs: BlogPost[];
}

export function BlogList({ blogs }: BlogListProps) {
  const [filteredBlogs, setFilteredBlogs] = useState<BlogPost[]>(blogs);
  const handleFilteredResults = useCallback((filtered: BlogPost[]) => {setFilteredBlogs(filtered)}, []);
  const [featured, ...others] = filteredBlogs;

  return (
    <>
      <section className="mt-8 sm:mt-12">
        <BlogSearch blogs={blogs} onFilteredResults={handleFilteredResults} />
      </section>

      {filteredBlogs.length !== blogs.length && (
        <section className="text-center mb-6">
          <p className="text-sm text-muted-foreground">
            Showing {filteredBlogs.length} of {blogs.length} blog posts
          </p>
        </section>
      )}

      {filteredBlogs.length === 0 && (
        <section className="text-center py-12">
          <p className="text-lg text-muted-foreground mb-2">
            No matching blog posts found
          </p>
          <p className="text-sm text-muted-foreground">
            Try adjusting your search terms or browse all blog posts
          </p>
        </section>
      )}

      {/* Featured Post */}
      {featured && (
        <section className="mt-6 sm:mt-8">
          <Link
            href={featured.url}
            className="group block overflow-hidden rounded-xl border border-white/20 bg-card/80 p-6 sm:p-8 shadow-sm transition duration-300 hover:border-[#E84142]/60 hover:shadow-[0_0_0_1px_rgba(232,65,66,0.6),0_0_30px_6px_rgba(232,65,66,0.35)] dark:bg-card-dark/80"
          >
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  {new Date(
                    featured.data.date ?? featured.file.name
                  ).toDateString()}
                </p>
                <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                  Featured
                </span>
              </div>

              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
                {featured.data.title}
              </h2>

              <p className="text-sm sm:text-base text-muted-foreground max-w-3xl">
                {featured.data.description}
              </p>

              <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm">
                {featured.data.topics.map((topic: string) => (
                  <span
                    key={topic}
                    className="rounded-full bg-fd-accent px-3 py-1.5 font-medium text-muted-foreground"
                  >
                    {topic}
                  </span>
                ))}
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                {featured.data.authors.map((author: string) => (
                  <span key={author} className="inline-flex items-center gap-2">
                    <X size={12} />
                    <span className="truncate">{author}</span>
                  </span>
                ))}
                <span className="ml-auto inline-flex items-center gap-1 text-primary">
                  Read article{" "}
                  <ArrowRight
                    size={14}
                    className="transition-transform group-hover:translate-x-0.5"
                  />
                </span>
              </div>
            </div>
          </Link>
        </section>
      )}

      {/* All Posts */}
      {others.length > 0 && (
        <section className="mt-12 sm:mt-16">
          <h3 className="mb-6 text-lg font-semibold tracking-tight text-foreground/90">
            {filteredBlogs.length === blogs.length
              ? "Latest posts"
              : "More matching posts"}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {others.map((g) => (
              <Link
                key={g.url}
                href={g.url}
                className="flex flex-col gap-2 rounded-lg border border-white/20 bg-card p-4 shadow-sm transition duration-300 hover:border-[#E84142]/60 hover:shadow-[0_0_0_1px_rgba(232,65,66,0.6),0_0_24px_5px_rgba(232,65,66,0.3)] dark:bg-card-dark"
              >
                <p className="text-xs text-muted-foreground">
                  {new Date(g.data.date ?? g.file.name).toDateString()}
                </p>
                <h4 className="text-xl font-semibold tracking-tight">
                  {g.data.title}
                </h4>
                <p className="text-sm text-muted-foreground line-clamp-3">
                  {g.data.description}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                  {g.data.topics.map((topic: string) => (
                    <span
                      key={topic}
                      className="rounded-full bg-fd-accent px-3 py-1.5 font-medium text-muted-foreground"
                    >
                      {topic}
                    </span>
                  ))}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                  {g.data.authors.map((author: string) => (
                    <span
                      key={author}
                      className="inline-flex items-center gap-2"
                    >
                      <X size={12} />
                      <span className="truncate">{author}</span>
                    </span>
                  ))}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
