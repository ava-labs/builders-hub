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

  return (
    <>
      <section className="mt-8 sm:mt-10">
        <BlogSearch blogs={blogs} onFilteredResults={handleFilteredResults} />
      </section>

      {filteredBlogs.length !== blogs.length && (
        <section className="text-center mb-6 mt-6">
          <p className="text-sm text-muted-foreground">
            Showing {filteredBlogs.length} of {blogs.length} blog posts
          </p>
        </section>
      )}

      {filteredBlogs.length === 0 && (
        <section className="text-center py-16">
          <p className="text-lg text-muted-foreground mb-2">
            No matching blog posts found
          </p>
          <p className="text-sm text-muted-foreground">
            Try adjusting your search terms or browse all blog posts
          </p>
        </section>
      )}

      {/* Blog Grid */}
      {filteredBlogs.length > 0 && (
        <section className="mt-10 sm:mt-12">
          {/* Featured Post - Full Width */}
          {filteredBlogs[0] && (
            <Link
              href={filteredBlogs[0].url}
              className="group relative flex flex-col md:flex-row gap-6 rounded-xl border border-primary/30 bg-gradient-to-br from-card/80 to-card/60 backdrop-blur-sm p-6 md:p-8 shadow-lg transition-all duration-300 hover:border-primary/50 hover:shadow-xl hover:shadow-primary/10 hover:-translate-y-0.5 dark:from-card-dark/80 dark:to-card-dark/60 dark:border-white/20 dark:hover:border-white/30 mb-8"
            >
              {/* Hover gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100 rounded-xl" />

              <div className="relative flex-1 flex flex-col">
                {/* Header */}
                <div className="flex items-center gap-3 mb-3">
                  <span className="rounded-full bg-primary/15 px-3 py-1 text-xs font-semibold text-primary ring-1 ring-primary/20">
                    Latest
                  </span>
                  <time className="text-xs font-medium text-muted-foreground/70 uppercase tracking-wider">
                    {new Date(filteredBlogs[0].data.date ?? filteredBlogs[0].url).toDateString()}
                  </time>
                </div>

                {/* Title */}
                <h3 className="text-2xl md:text-3xl font-bold tracking-tight leading-tight transition-colors group-hover:text-primary mb-3">
                  {filteredBlogs[0].data.title}
                </h3>

                {/* Description */}
                <p className="text-base text-muted-foreground/90 leading-relaxed mb-4 line-clamp-2">
                  {filteredBlogs[0].data.description}
                </p>

                {/* Topics */}
                <div className="flex flex-wrap items-center gap-2 mb-4">
                  {filteredBlogs[0].data.topics.slice(0, 4).map((topic: string) => (
                    <span
                      key={topic}
                      className="rounded-full bg-secondary/70 px-3 py-1.5 text-xs font-medium text-foreground/80 transition-colors group-hover:bg-secondary"
                    >
                      {topic}
                    </span>
                  ))}
                  {filteredBlogs[0].data.topics.length > 4 && (
                    <span className="text-xs text-muted-foreground">
                      +{filteredBlogs[0].data.topics.length - 4}
                    </span>
                  )}
                </div>

                {/* Authors & Read More */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-3 mt-auto border-t border-border/30">
                  <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground/80">
                    {filteredBlogs[0].data.authors.slice(0, 2).map((author: string) => (
                      <span key={author} className="inline-flex items-center gap-1.5">
                        <X size={12} />
                        <span className="truncate font-medium text-xs">{author}</span>
                      </span>
                    ))}
                    {filteredBlogs[0].data.authors.length > 2 && (
                      <span className="text-xs">+{filteredBlogs[0].data.authors.length - 2}</span>
                    )}
                  </div>
                  <span className="inline-flex items-center gap-1.5 text-sm font-medium text-primary transition-transform group-hover:translate-x-1">
                    Read article
                    <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
                  </span>
                </div>
              </div>
            </Link>
          )}

          {/* Regular Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredBlogs.slice(1).map((post) => (
              <Link
                key={post.url}
                href={post.url}
                className="group relative flex flex-col rounded-xl border border-border/50 bg-card/60 backdrop-blur-sm shadow-md transition-all duration-300 hover:border-primary/40 hover:shadow-xl hover:shadow-primary/10 hover:-translate-y-1 dark:bg-card-dark/60 dark:border-white/20 dark:hover:border-white/30 overflow-hidden"
              >
                {/* Hover gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

                <div className="relative flex flex-col h-full p-6">
                  {/* Header */}
                  <time className="text-xs font-medium text-muted-foreground/70 uppercase tracking-wider mb-3">
                    {new Date(post.data.date ?? post.url).toDateString()}
                  </time>

                  {/* Title */}
                  <h4 className="text-xl font-bold tracking-tight leading-snug transition-colors group-hover:text-primary mb-3">
                    {post.data.title}
                  </h4>

                  {/* Description */}
                  <p className="text-sm text-muted-foreground/90 leading-relaxed mb-4 flex-grow line-clamp-3">
                    {post.data.description}
                  </p>

                  {/* Topics */}
                  <div className="flex flex-wrap items-center gap-2 mb-4">
                    {post.data.topics.slice(0, 3).map((topic: string) => (
                      <span
                        key={topic}
                        className="rounded-full bg-secondary/70 px-3 py-1.5 text-xs font-medium text-foreground/80 transition-colors group-hover:bg-secondary"
                      >
                        {topic}
                      </span>
                    ))}
                    {post.data.topics.length > 3 && (
                      <span className="text-xs text-muted-foreground">
                        +{post.data.topics.length - 3}
                      </span>
                    )}
                  </div>

                  {/* Authors & Read More */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-border/30">
                    <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground/80">
                      {post.data.authors.slice(0, 2).map((author: string) => (
                        <span key={author} className="inline-flex items-center gap-1.5">
                          <X size={12} />
                          <span className="truncate font-medium text-xs">{author}</span>
                        </span>
                      ))}
                      {post.data.authors.length > 2 && (
                        <span className="text-xs">+{post.data.authors.length - 2}</span>
                      )}
                    </div>
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-primary transition-transform group-hover:translate-x-1">
                      Read
                      <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
